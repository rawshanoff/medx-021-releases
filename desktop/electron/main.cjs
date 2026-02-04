const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');
const fs = require('fs');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

let backendProc = null;
let licenseProc = null;
let mainWindow = null;
let isQuitting = false;
let updateWaitTimer = null;
let setupWindow = null;
let uiLoadErrorShown = false;

let _startServicesPromise = null;
let _backendSpawnInProgress = false;
let _licenseSpawnInProgress = false;

function _sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function _unlinkWithRetry(p, attempts = 40, delayMs = 500) {
  if (!p) return;
  for (let i = 0; i < attempts; i++) {
    try {
      if (!fs.existsSync(p)) return;
      fs.unlinkSync(p);
      return;
    } catch (e) {
      // Might be locked briefly by AV/scanners.
      try {
        // eslint-disable-next-line no-empty
      } catch {}
      // Busy-wait with small sleep via Atomics? Avoid; just continue with setTimeout usage elsewhere.
    }
  }
}

function _rmDirWithRetry(dir, attempts = 40, delayMs = 500) {
  if (!dir) return;
  for (let i = 0; i < attempts; i++) {
    try {
      if (!fs.existsSync(dir)) return;
      fs.rmSync(dir, { recursive: true, force: true });
      if (!fs.existsSync(dir)) return;
    } catch {}
  }
}

function cleanupUpdateArtifactsBestEffort() {
  const root = getResourcesRoot();
  // Clean marker files and leftovers. AV can lock files, so we retry a bit.
  const zipPath = path.join(root, 'update.zip');
  const tmpDir = path.join(root, '_update_tmp');
  const backupsDir = path.join(root, '_update_backup');
  const done = markerPath('._update_done');
  const failed = markerPath('._update_failed');
  const inProgress = markerPath('._update_in_progress');

  _rmDirWithRetry(tmpDir);
  _unlinkWithRetry(zipPath);

  // Keep only latest 2 backup folders by default.
  const keep = Math.max(0, Number(process.env.MEDX_UPDATE_BACKUPS_KEEP || '2') || 2);
  try {
    if (fs.existsSync(backupsDir)) {
      const items = fs
        .readdirSync(backupsDir)
        .map((name) => path.join(backupsDir, name))
        .filter((p) => {
          try { return fs.statSync(p).isDirectory(); } catch { return false; }
        })
        .map((p) => {
          try { return { p, m: fs.statSync(p).mtimeMs || 0 }; } catch { return { p, m: 0 }; }
        })
        .sort((a, b) => (b.m || 0) - (a.m || 0));

      for (const it of items.slice(keep)) {
        try {
          fs.rmSync(it.p, { recursive: true, force: true });
        } catch {}
      }
    }
  } catch {}

  // Markers: Electron should clear these after handling update result.
  _bestEffortUnlink(done);
  _bestEffortUnlink(failed);
  _bestEffortUnlink(inProgress);
}

const _restartState = {
  backend: { times: [] },
  license: { times: [] },
};

function _canRestartService(name) {
  const bucket = _restartState[name] || { times: [] };
  _restartState[name] = bucket;
  const now = Date.now();
  bucket.times = bucket.times.filter((t) => now - t < 60_000);
  if (bucket.times.length >= 5) return false;
  bucket.times.push(now);
  return true;
}

function _bestEffortUnlink(p) {
  try {
    if (p && fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
}

// Avoid Windows cache permission issues during dev.
// IMPORTANT: set userData BEFORE single-instance lock to avoid conflict with installed app.
try {
  const isDev = Boolean(process.defaultApp) || Boolean(process.env.ELECTRON_START_URL);
  if (process.env.MEDX_ELECTRON_USERDATA_TEMP === '1') {
    app.setPath('userData', path.join(app.getPath('temp'), 'medx-electron-userdata'));
  } else if (isDev) {
    // Separate profile for dev so `requestSingleInstanceLock()` doesn't collide with production install.
    app.setPath('userData', path.join(app.getPath('temp'), 'medx-electron-userdata-dev'));
  }
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
  app.commandLine.appendSwitch('disable-gpu-disk-cache');
} catch {}

// Prevent multiple app instances (reduces "endless launches" in taskbar).
try {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
  } else {
    app.on('second-instance', () => {
      try {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      } catch {}
    });
  }
} catch {}

function getResourcesRoot() {
  // In packaged app: <install>/resources
  // In dev: <repo>/desktop/electron
  return process.resourcesPath || __dirname;
}

function getAppDataRoot() {
  return path.join(app.getPath('userData'), 'medx');
}

function getLogsRoot() {
  const dir = path.join(getAppDataRoot(), 'logs');
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return dir;
}

function getBackendLogPath() {
  return path.join(getLogsRoot(), 'backend.log');
}

function ensureEnvFile() {
  const dir = getAppDataRoot();
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  const envPath = path.join(dir, '.env');
  if (!fs.existsSync(envPath)) {
    // Try copying bundled .env.example from resources; fallback to minimal template
    const example = path.join(getResourcesRoot(), '.env.example');
    try {
      if (fs.existsSync(example)) {
        fs.copyFileSync(example, envPath);
      } else {
        fs.writeFileSync(envPath, 'DATABASE_URL=\nSECRET_KEY=\n', { encoding: 'utf-8' });
      }
    } catch (e) {
      try {
        fs.writeFileSync(envPath, 'DATABASE_URL=\nSECRET_KEY=\n', { encoding: 'utf-8' });
      } catch {}
    }
  }
  return envPath;
}

function readEnvValue(envFilePath, key) {
  try {
    const raw = fs.readFileSync(envFilePath, { encoding: 'utf-8' });
    const re = new RegExp(`^\\s*${key}\\s*=\\s*(.*)\\s*$`, 'm');
    const m = raw.match(re);
    if (!m) return '';
    const v = String(m[1] || '').trim();
    // strip optional quotes
    return v.replace(/^['"]|['"]$/g, '').trim();
  } catch {
    return '';
  }
}

function parseDatabaseUrl(url) {
  const out = {
    host: '127.0.0.1',
    port: '5432',
    db: '',
    user: '',
    password: '',
  };
  const raw = String(url || '').trim();
  if (!raw) return out;
  // Expected: postgresql+asyncpg://user:pass@host:port/dbname
  const m = raw.match(/^postgresql\+asyncpg:\/\/([^:@/]+)(?::([^@/]*))?@([^:/]+)(?::(\d+))?\/(.+?)(?:\?.*)?$/i);
  if (!m) return out;
  out.user = decodeURIComponent(m[1] || '');
  out.password = decodeURIComponent(m[2] || '');
  out.host = m[3] || out.host;
  out.port = m[4] || out.port;
  out.db = decodeURIComponent(m[5] || '');
  return out;
}

function buildDatabaseUrl({ host, port, db, user, password }) {
  const h = String(host || '127.0.0.1').trim() || '127.0.0.1';
  const p = String(port || '5432').trim() || '5432';
  const d = String(db || '').trim();
  const u = String(user || '').trim();
  const pw = String(password || '');
  const auth = pw ? `${encodeURIComponent(u)}:${encodeURIComponent(pw)}` : `${encodeURIComponent(u)}`;
  return `postgresql+asyncpg://${auth}@${h}:${p}/${encodeURIComponent(d)}`;
}

function upsertEnvKey(content, key, value) {
  const lines = String(content || '').split(/\r?\n/);
  const re = new RegExp(`^\\s*${key}\\s*=`, 'i');
  const nextLine = `${key}=${value}`;
  let found = false;
  const out = lines.map((ln) => {
    if (re.test(ln)) {
      found = true;
      return nextLine;
    }
    return ln;
  });
  if (!found) out.push(nextLine);
  // ensure trailing newline
  return out.filter((x) => x != null).join('\n').replace(/\n*$/, '\n');
}

function getConfig() {
  const envPath = ensureEnvFile();
  const databaseUrl = readEnvValue(envPath, 'DATABASE_URL');
  const secretKey = readEnvValue(envPath, 'SECRET_KEY');
  const parsed = parseDatabaseUrl(databaseUrl);
  return {
    envPath,
    databaseUrl,
    secretKey,
    ...parsed,
  };
}

function isEnvConfigured() {
  const c = getConfig();
  // Treat placeholders from .env.example as "not configured" to trigger setup wizard.
  const db = String(c.databaseUrl || '').trim();
  const sk = String(c.secretKey || '').trim();
  if (!db || !sk) return false;
  if (/CHANGE_ME/i.test(db) || /CHANGE_ME/i.test(sk)) return false;
  // Basic validation: must parse and contain db/user.
  if (!String(c.db || '').trim()) return false;
  if (!String(c.user || '').trim()) return false;
  // SECRET_KEY should be reasonably long (JWT signing).
  if (sk.length < 24) return false;
  return true;
}

function serviceEnv() {
  const envFile = ensureEnvFile();
  return {
    ...process.env,
    MEDX_ENV_FILE: envFile,
  };
}

function getBackendExePath() {
  return path.join(getResourcesRoot(), 'bin', 'medx-backend.exe');
}

function findBackendExe() {
  const candidates = [
    // Production expected
    path.join(String(process.resourcesPath || ''), 'bin', 'medx-backend.exe'),
    // Dev build output (in case resourcesPath isn't set)
    getBackendExePath(),
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch {}
  }
  return '';
}

function safeSpawn(cmd, args, opts, label) {
  try {
    const p = spawn(cmd, args || [], opts || {});
    // Close log fds if we opened them.
    p.on('close', () => {
      try {
        if (p.__medxFds && Array.isArray(p.__medxFds)) {
          for (const fd of p.__medxFds) {
            try { fs.closeSync(fd); } catch {}
          }
        }
      } catch {}
    });
    p.on('error', async (e) => {
      try {
        const msg =
          `Не удалось запустить ${label || 'process'}.\n\n` +
          `Команда: ${cmd} ${(args || []).join(' ')}\n` +
          `Ошибка: ${e && e.message ? e.message : String(e)}\n\n` +
          `resourcesPath: ${String(process.resourcesPath || '')}\n` +
          `.env: ${ensureEnvFile()}`;
        await dialog.showMessageBox({
          type: 'error',
          buttons: ['OK'],
          message: 'MedX: ошибка запуска',
          detail: msg,
        });
      } catch {}
    });
    return p;
  } catch (e) {
    return null;
  }
}

function spawnPythonModule(args, cwd) {
  const python =
    process.env.MEDX_PYTHON ||
    path.join(process.cwd(), '..', '..', '.venv', 'Scripts', 'python.exe');
  return safeSpawn(python, args, {
    cwd,
    env: serviceEnv(),
    stdio: 'inherit',
    windowsHide: true,
  }, 'python');
}

function spawnBackend(cwd) {
  const exe = findBackendExe();
  if (exe) {
    // Redirect backend output to file so we can debug on target machines.
    const logPath = getBackendLogPath();
    let outFd = null;
    let errFd = null;
    try {
      outFd = fs.openSync(logPath, 'a');
      errFd = fs.openSync(logPath, 'a');
    } catch {
      outFd = null;
      errFd = null;
    }

    return safeSpawn(exe, [], {
      cwd,
      env: {
        ...serviceEnv(),
        // Tell backend where external alembic files live (resources root).
        MEDX_APP_DIR: cwd,
        // Desktop should auto-apply migrations on first run.
        MEDX_AUTO_MIGRATE: '1',
      },
      stdio: outFd != null && errFd != null ? ['ignore', outFd, errFd] : 'inherit',
      windowsHide: true,
    }, 'backend');
  }
  // Backend exe MUST exist in all supported builds; never fallback to python.
  void dialog.showMessageBox({
    type: 'error',
    buttons: ['OK'],
    message: 'MedX: отсутствует backend',
    detail:
      `Не найден файл backend exe.\n\n` +
      `Ожидаемый путь:\n${path.join(String(process.resourcesPath || ''), 'bin', 'medx-backend.exe')}\n\n` +
      `resourcesPath: ${String(process.resourcesPath || '')}\n` +
      `.env: ${ensureEnvFile()}\n\n` +
      `Похоже, установка повреждена. Переустановите MedX.`,
  });
  return null;
}

function createSetupWindow() {
  if (setupWindow && !setupWindow.isDestroyed()) return setupWindow;

  setupWindow = new BrowserWindow({
    width: 520,
    height: 560,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'MedX — Настройка подключения',
    parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
    modal: Boolean(mainWindow && !mainWindow.isDestroyed()),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  try {
    setupWindow.setAlwaysOnTop(true, 'floating');
    setupWindow.show();
    setupWindow.focus();
  } catch {}

  const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MedX Setup</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 18px; color: #0f172a; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    p { margin: 0 0 14px; color: #334155; font-size: 13px; }
    .grid { display: grid; gap: 10px; }
    label { display: block; font-size: 12px; color: #475569; margin-bottom: 4px; }
    input { width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; }
    .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
    .actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 14px; }
    button { padding: 10px 12px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; font-size: 13px; }
    button.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
    .hint { margin-top: 10px; font-size: 12px; color: #64748b; }
    code { background: #f1f5f9; padding: 1px 4px; border-radius: 6px; }
    .error { color: #b91c1c; font-size: 12px; margin-top: 8px; min-height: 16px; }
  </style>
</head>
<body>
  <h1>Настройка подключения MedX</h1>
  <p>Введите параметры PostgreSQL и секретный ключ. Файл <code>.env</code> будет создан/обновлён автоматически.</p>

  <div class="grid">
    <div class="row2">
      <div>
        <label>Host</label>
        <input id="host" placeholder="127.0.0.1" />
      </div>
      <div>
        <label>Port</label>
        <input id="port" placeholder="5432" />
      </div>
    </div>
    <div>
      <label>Имя базы данных</label>
      <input id="db" placeholder="medx_db" />
    </div>
    <div class="row2">
      <div>
        <label>Логин</label>
        <input id="user" placeholder="postgres" />
      </div>
      <div>
        <label>Пароль</label>
        <input id="password" type="password" placeholder="••••••••" />
      </div>
    </div>
    <div>
      <label>SECRET_KEY</label>
      <input id="secret" placeholder="Будет использован для JWT" />
      <div class="actions" style="justify-content:flex-start;margin-top:8px;">
        <button id="gen">Сгенерировать</button>
        <button id="openFolder">Открыть папку .env</button>
      </div>
      <div class="hint">Рекомендуется длина 32+ символа. Можно сгенерировать автоматически.</div>
    </div>
    <div class="error" id="error"></div>
    <div class="actions">
      <button id="cancel">Закрыть</button>
      <button class="primary" id="save">Сохранить и запустить</button>
    </div>
  </div>

  <script>
    const $ = (id) => document.getElementById(id);
    const showError = (msg) => { $('error').textContent = msg || ''; };

    async function load() {
      const cfg = await window.medx.configGet();
      $('host').value = cfg.host || '127.0.0.1';
      $('port').value = cfg.port || '5432';
      $('db').value = cfg.db || '';
      $('user').value = cfg.user || '';
      $('password').value = cfg.password || '';
      $('secret').value = cfg.secretKey || '';
    }

    $('gen').addEventListener('click', async () => {
      const s = await window.medx.configGenerateSecret();
      $('secret').value = s || '';
    });

    $('openFolder').addEventListener('click', async () => {
      await window.medx.configOpenEnvFolder();
    });

    $('cancel').addEventListener('click', async () => {
      window.close();
    });

    $('save').addEventListener('click', async () => {
      showError('');
      const payload = {
        host: $('host').value,
        port: $('port').value,
        db: $('db').value,
        user: $('user').value,
        password: $('password').value,
        secretKey: $('secret').value,
      };
      if (!String(payload.db || '').trim()) return showError('Введите имя базы данных');
      if (!String(payload.user || '').trim()) return showError('Введите логин');
      if (!String(payload.secretKey || '').trim()) return showError('Введите SECRET_KEY или сгенерируйте');
      const res = await window.medx.configSave(payload);
      if (!res || !res.ok) return showError(res && res.error ? String(res.error) : 'Не удалось сохранить');
      window.close();
    });

    load().catch(() => {});
  </script>
</body>
</html>`;

  const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
  setupWindow.loadURL(dataUrl);
  setupWindow.once('ready-to-show', () => {
    try { setupWindow.show(); setupWindow.focus(); } catch {}
  });
  setupWindow.on('closed', () => {
    setupWindow = null;
    // If config is now valid, start backend and show main window.
    try {
      if (isEnvConfigured()) {
        void startServices();
        if (!mainWindow || mainWindow.isDestroyed()) {
          mainWindow = createWindow();
        }
      }
    } catch {}
  });
  return setupWindow;
}

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(400);
    socket.once('error', () => {
      try { socket.destroy(); } catch {}
      resolve(false);
    });
    socket.once('timeout', () => {
      try { socket.destroy(); } catch {}
      resolve(false);
    });
    socket.connect(port, host, () => {
      try { socket.end(); socket.destroy(); } catch {}
      resolve(true);
    });
  });
}

function getRepoRoot() {
  // __dirname = <repo>/desktop/electron
  return path.join(__dirname, '..', '..');
}

function markerPath(name) {
  // Markers are created in app working directory (resources root in production).
  return path.join(getResourcesRoot(), name);
}

function hasUpdateMarkers() {
  try {
    return (
      fs.existsSync(markerPath('._update_in_progress')) ||
      fs.existsSync(markerPath('._update_done')) ||
      fs.existsSync(markerPath('._update_failed'))
    );
  } catch {
    return false;
  }
}

function clearUpdateWaitTimer() {
  if (updateWaitTimer) {
    try { clearInterval(updateWaitTimer); } catch {}
    updateWaitTimer = null;
  }
}

function reloadWindowSafe() {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.reloadIgnoringCache();
    }
  } catch {}
}

async function startServices() {
  if (_startServicesPromise) return _startServicesPromise;
  _startServicesPromise = (async () => {
    if (process.env.MEDX_DISABLE_SERVICES === '1') return;
    if (!isEnvConfigured()) {
      createSetupWindow();
      return;
    }
    const repoRoot = getRepoRoot();
    const resourcesRoot = getResourcesRoot();
    const cwd = fs.existsSync(path.join(resourcesRoot, 'backend')) ? resourcesRoot : repoRoot;

    // If services already started externally, don't spawn duplicates.
    const backendUp = await isPortOpen(8000);
    const licenseUp = await isPortOpen(8001);

    const backendRunning =
      backendProc && backendProc.exitCode == null && !backendProc.killed;
    const licenseRunning =
      licenseProc && licenseProc.exitCode == null && !licenseProc.killed;

    // NOTE: Для Enterprise лучше запускать без --reload и под отдельным менеджером.
    if (!backendUp && !backendRunning && !_backendSpawnInProgress) {
      _backendSpawnInProgress = true;
      try {
        backendProc = spawnBackend(cwd);
        attachServiceWatchers();
      } finally {
        _backendSpawnInProgress = false;
      }
    }

    // License server is optional for MVP; enable explicitly if needed.
    if (
      !licenseUp &&
      !licenseRunning &&
      process.env.MEDX_ENABLE_LICENSE_SERVER === '1' &&
      !_licenseSpawnInProgress
    ) {
      _licenseSpawnInProgress = true;
      try {
        licenseProc = spawnPythonModule(
          ['-m', 'uvicorn', 'license_server.main:app', '--port', '8001'],
          cwd,
        );
        attachServiceWatchers();
      } finally {
        _licenseSpawnInProgress = false;
      }
    }
  })().finally(() => {
    _startServicesPromise = null;
  });
  return _startServicesPromise;
}

function stopServices() {
  for (const p of [backendProc, licenseProc]) {
    if (p && !p.killed) {
      try { p.kill(); } catch {}
    }
  }
}

function attachServiceWatchers() {
  for (const [name, procRef] of [
    ['backend', backendProc],
    ['license', licenseProc],
  ]) {
    const p = procRef;
    if (!p || p.__medxWatched) continue;
    p.__medxWatched = true;
    // Attach fds created by spawnBackend (if any)
    try {
      if (name === 'backend') {
        const logPath = getBackendLogPath();
        // If backend was spawned with log redirection, keep path for dialogs.
        p.__medxBackendLogPath = logPath;
      }
    } catch {}
    p.on('exit', async (code, signal) => {
      if (isQuitting) return;

      // If update is running, wait for markers to finish then restart.
      if (hasUpdateMarkers()) {
        waitForUpdateAndRestart();
        return;
      }

      // Unexpected exit: try to restart after short delay if port is down.
      setTimeout(async () => {
        try {
          const port = name === 'backend' ? 8000 : 8001;
          const up = await isPortOpen(port);
          if (up) return;
          if (process.env.MEDX_DISABLE_SERVICES === '1') return;
          if (!_canRestartService(name)) {
            try {
              const envPath = ensureEnvFile();
              const logPath = name === 'backend' ? getBackendLogPath() : '';
              // If env isn't properly configured, show setup wizard to fix DB/SECRET_KEY.
              if (name === 'backend' && !isEnvConfigured()) {
                try { createSetupWindow(); } catch {}
              }

              const res = await dialog.showMessageBox({
                type: 'error',
                buttons: ['Открыть папку логов', 'Открыть папку .env', 'OK'],
                message: 'MedX: служба постоянно завершается',
                detail:
                  `Служба: ${name}\n` +
                  `Код выхода: ${String(code)}\n` +
                  `Сигнал: ${String(signal || '')}\n\n` +
                  `Похоже, служба падает в цикле. UI больше не будет перезагружаться.\n` +
                  `Проверьте настройки подключения к БД и логи backend.\n\n` +
                  (logPath ? `Лог: ${logPath}\n` : '') +
                  `.env: ${envPath}`,
              });
              if (res && typeof res.response === 'number') {
                if (res.response === 0) {
                  // logs
                  try { await shell.openPath(getLogsRoot()); } catch {}
                } else if (res.response === 1) {
                  try { shell.showItemInFolder(envPath); } catch {}
                }
              }
            } catch {}
            return;
          }
          const repoRoot = getRepoRoot();
          const resourcesRoot = getResourcesRoot();
          const cwd = fs.existsSync(path.join(resourcesRoot, 'backend')) ? resourcesRoot : repoRoot;

          if (name === 'backend') {
            // Never fallback to python for backend (target machines won't have it).
            backendProc = spawnBackend(cwd);
          } else {
            // License server is optional.
            if (process.env.MEDX_ENABLE_LICENSE_SERVER === '1') {
              licenseProc = spawnPythonModule(
                ['-m', 'uvicorn', 'license_server.main:app', '--port', '8001'],
                cwd,
              );
            } else {
              return;
            }
          }
          attachServiceWatchers();
        } catch (e) {
          console.error(`Failed to restart ${name}`, e);
        }
      }, 800);
    });
  }
}

function waitForUpdateAndRestart() {
  clearUpdateWaitTimer();
  const inProgress = markerPath('._update_in_progress');
  const done = markerPath('._update_done');
  const failed = markerPath('._update_failed');

  // Poll markers; updater is external and fast enough for MVP.
  updateWaitTimer = setInterval(async () => {
    try {
      const still = fs.existsSync(inProgress);
      const isDone = fs.existsSync(done);
      const isFailed = fs.existsSync(failed);

      if (still) return;

      if (isFailed) {
        clearUpdateWaitTimer();
        console.error('Update failed. See ._update_failed');
        // Restart services anyway (rollback should have happened).
      }
      if (isDone) {
        clearUpdateWaitTimer();
      }

      // Restart services (ports may already be up)
      await startServices();
      // Cleanup artifacts even if user manually restarts later.
      cleanupUpdateArtifactsBestEffort();
      // Clean markers to avoid repeated "update mode" on every crash/restart.
      _bestEffortUnlink(done);
      _bestEffortUnlink(failed);
      _bestEffortUnlink(inProgress);
      // Reload only once after update finished (not on service crash loops).
      reloadWindowSafe();
    } catch (e) {
      console.error('Update wait loop error', e);
    }
  }, 900);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // If update completed while app was closed, cleanup on next launch.
  try {
    if (hasUpdateMarkers()) {
      setTimeout(() => {
        try { cleanupUpdateArtifactsBestEffort(); } catch {}
      }, 2500);
    }
  } catch {}

  // Remove top application menu (File/Edit/View/Window/Help)
  try {
    win.setMenuBarVisibility(false);
    win.setMenu(null);
  } catch {}

  const devUrl = process.env.ELECTRON_START_URL || process.env.MEDX_DEV_URL;
  if (devUrl) {
    win.loadURL(devUrl);
    return;
  }

  // Production: load built frontend
  const candidates = [
    // Preferred: unpacked extraResources (easy to inspect/update)
    path.join(getResourcesRoot(), 'frontend_dist', 'index.html'),
    // Fallback: packaged inside app.asar (guaranteed by build step)
    path.join(app.getAppPath(), 'frontend', 'dist', 'index.html'),
  ];

  let attempt = 0;

  async function showUiLoadError(code, desc, url) {
    if (uiLoadErrorShown) return;
    uiLoadErrorShown = true;
    try {
      const existsLines = candidates
        .map((p) => {
          try {
            return `${p} => ${fs.existsSync(p) ? 'EXISTS' : 'MISSING'}`;
          } catch {
            return `${p} => ERROR`;
          }
        })
        .join('\n');

      let resourcesListing = '';
      try {
        const rr = getResourcesRoot();
        const items = fs.readdirSync(rr, { withFileTypes: true })
          .slice(0, 50)
          .map((d) => (d.isDirectory() ? `[dir] ${d.name}` : `[file] ${d.name}`))
          .join('\n');
        resourcesListing = `\n\nresources dir (first 50):\n${rr}\n${items}`;
      } catch {}

      let frontendListing = '';
      try {
        const fr = path.join(getResourcesRoot(), 'frontend_dist');
        if (fs.existsSync(fr)) {
          const items = fs.readdirSync(fr, { withFileTypes: true })
            .slice(0, 50)
            .map((d) => (d.isDirectory() ? `[dir] ${d.name}` : `[file] ${d.name}`))
            .join('\n');
          frontendListing = `\n\nfrontend_dist (first 50):\n${fr}\n${items}`;
        } else {
          frontendListing = `\n\nfrontend_dist: MISSING\n${fr}`;
        }
      } catch {}

      await dialog.showMessageBox({
        type: 'error',
        buttons: ['OK'],
        message: 'MedX: не удалось загрузить интерфейс',
        detail:
          `Файл: ${candidates[Math.min(attempt, candidates.length - 1)]}\n` +
          `Кандидаты:\n- ${candidates.join('\n- ')}\n` +
          `Exists:\n${existsLines}\n` +
          `URL: ${url}\n` +
          `Код: ${code}\n` +
          `Описание: ${desc}\n` +
          `resourcesPath: ${String(process.resourcesPath || '')}\n` +
          `appPath: ${String(app.getAppPath ? app.getAppPath() : '')}\n` +
          `__dirname: ${String(__dirname || '')}` +
          resourcesListing +
          frontendListing,
      });
    } catch {}
  }

  win.webContents.on('did-fail-load', async function (_e, code, desc, url, isMainFrame) {
    try {
      // Ignore failures for subframes/resources (only act on main navigation).
      if (isMainFrame === false) return;

      // Only treat as fatal if it failed to load the page we asked for.
      const attemptedUrl = pathToFileURL(candidates[attempt]).toString();
      if (url && attemptedUrl && String(url) !== String(attemptedUrl)) return;

      // Try next candidate automatically, then show error only if all failed.
      if (attempt + 1 < candidates.length) {
        attempt += 1;
        await win.loadURL(pathToFileURL(candidates[attempt]).toString());
        return;
      }
    } catch {}
    await showUiLoadError(code, desc, url);
  });

  // First attempt
  win.loadURL(pathToFileURL(candidates[attempt]).toString());
  return win;
}

async function waitForImagesAndFonts(webContents) {
  try {
    await webContents.executeJavaScript(
      `Promise.all([
        (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve(),
        Promise.all(Array.from(document.images || []).map(img => img.complete ? Promise.resolve() : new Promise(res => {
          img.addEventListener('load', res, { once: true });
          img.addEventListener('error', res, { once: true });
        })))
      ])`,
      true
    );
    // Ensure layout has settled (helps avoid "1cm blank" on some Windows drivers).
    await webContents.executeJavaScript(
      `new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)))`,
      true
    );
  } catch {}
}

async function measureDocumentHeightMicrons(webContents) {
  try {
    const px = await webContents.executeJavaScript(
      `(() => {
        const de = document.documentElement;
        const b = document.body;
        const h = Math.max(
          de?.scrollHeight || 0,
          b?.scrollHeight || 0,
          de?.offsetHeight || 0,
          b?.offsetHeight || 0,
          de?.clientHeight || 0,
          b?.clientHeight || 0
        );
        return Number.isFinite(h) ? h : 0;
      })()`,
      true
    );
    const heightPx = Number(px);
    // CSS inch is defined as 96 CSS pixels. 1 inch = 25400 microns.
    const microns = Math.ceil((heightPx * 25400) / 96);
    // add a small bottom padding so the last line isn't clipped
    const padded = microns + 5000;
    // clamp: min 50mm, max 1200mm (avoid runaway feeds)
    return Math.min(Math.max(padded, 50_000), 1_200_000);
  } catch {
    return 300_000; // 300mm fallback
  }
}

async function measureDocumentRectPx(webContents) {
  try {
    const rect = await webContents.executeJavaScript(
      `(() => {
        const de = document.documentElement;
        const b = document.body;
        const width = Math.max(de?.scrollWidth || 0, b?.scrollWidth || 0, de?.clientWidth || 0, b?.clientWidth || 0);
        const height = Math.max(de?.scrollHeight || 0, b?.scrollHeight || 0, de?.clientHeight || 0, b?.clientHeight || 0);
        return { width, height };
      })()`,
      true
    );
    const w = Math.max(0, Math.floor(Number(rect?.width || 0)));
    const h = Math.max(0, Math.floor(Number(rect?.height || 0)));
    return { width: w, height: h };
  } catch {
    return { width: 0, height: 0 };
  }
}

function pxToMicrons(px) {
  const n = Number(px);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.ceil((n * 25400) / 96);
}

ipcMain.handle('print:html', async (_event, payload) => {
  const html = String(payload?.html || '');
  const silent = payload?.silent !== false; // default true
  const deviceName = payload?.deviceName ? String(payload.deviceName) : undefined;
  const paperSize = payload?.paperSize ? String(payload.paperSize) : undefined;
  const scaleFactorRaw = Number(payload?.scaleFactor);
  const scaleFactor = Number.isFinite(scaleFactorRaw) ? Math.min(200, Math.max(10, scaleFactorRaw)) : 100;
  const mode = payload?.mode ? String(payload.mode) : 'html';

  const widthMicrons = paperSize === '58' ? 58_000 : paperSize === '80' ? 80_000 : undefined;
  const dpi = widthMicrons ? { horizontal: 203, vertical: 203 } : undefined;

  const jobWin = new BrowserWindow({
    // NOTE: On some Windows thermal printer drivers, printing from a fully hidden
    // window results in a tiny blank output (~1cm). We keep it hidden but place it
    // off-screen and briefly showInactive() to force a real paint.
    show: false,
    x: -20000,
    y: -20000,
    width: 640,
    height: 900,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  try {
    jobWin.webContents.setBackgroundThrottling(false);
  } catch {}

  try {
    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
    await jobWin.loadURL(dataUrl);
    await waitForImagesAndFonts(jobWin.webContents);
    // Force a paint cycle on Windows drivers that misbehave when fully hidden.
    try {
      jobWin.showInactive();
      await new Promise((r) => setTimeout(r, 80));
    } catch {}

    // Optional compatibility path: rasterize HTML to an image and print the image.
    if (mode === 'image' && widthMicrons) {
      const rect = await measureDocumentRectPx(jobWin.webContents);
      const captureRect = {
        x: 0,
        y: 0,
        width: Math.max(1, Math.min(rect.width || 1, 4000)),
        height: Math.max(1, Math.min(rect.height || 1, 12000)),
      };
      const img = await jobWin.webContents.capturePage(captureRect);
      const dataPng = img.toDataURL();
      const paperWidthMm = paperSize === '58' ? 58 : 80;
      const imgHtml = `<!doctype html><html><head><meta charset="utf-8"/><style>
        @page { size: ${paperWidthMm}mm auto; margin: 0; }
        html, body { margin: 0; padding: 0; background: #fff; }
        img { display:block; width: 100%; height: auto; }
      </style></head><body><img src="${dataPng}" alt="receipt"/></body></html>`;
      const dataUrl2 = 'data:text/html;charset=utf-8,' + encodeURIComponent(imgHtml);
      await jobWin.loadURL(dataUrl2);
      await waitForImagesAndFonts(jobWin.webContents);
    }

    const heightMicrons = widthMicrons ? await measureDocumentHeightMicrons(jobWin.webContents) : undefined;
    const pageSize = (widthMicrons && heightMicrons) ? { width: widthMicrons, height: heightMicrons } : undefined;

    let failureReason = '';
    const ok = await new Promise((resolve) => {
      jobWin.webContents.print(
        {
          silent,
          deviceName,
          printBackground: true,
          // Many Windows thermal drivers handle offsets better with 'none' than 'custom 0'.
          margins: { marginType: 'none' },
          landscape: false,
          scaleFactor,
          pageSize,
          dpi,
        },
        (success, failureReason) => {
          failureReason = String(failureReason || '');
          if (!success) console.error('Print failed:', failureReason);
          resolve(Boolean(success));
        }
      );
    });

    return { ok, failureReason, debug: { deviceName, paperSize, widthMicrons, heightMicrons, mode } };
  } finally {
    // Give Windows spooler/printer driver a moment to consume the rendered page
    // (closing too early can result in "1cm blank" or truncated output).
    try { await new Promise((r) => setTimeout(r, 1200)); } catch {}
    try { jobWin.close(); } catch {}
  }
});

ipcMain.handle('printers:list', async (event) => {
  try {
    const wc = event.sender;
    const list = await wc.getPrintersAsync();
    return (list || []).map((p) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      isDefault: Boolean(p.isDefault),
      status: p.status,
      description: p.description,
    }));
  } catch (e) {
    console.error('Failed to list printers', e);
    return [];
  }
});

app.whenReady().then(() => {
  try {
    Menu.setApplicationMenu(null);
  } catch {}
  // If not configured, show setup first (avoid "hidden behind login" UX).
  if (!isEnvConfigured()) {
    createSetupWindow();
    return;
  }
  startServices();
  mainWindow = createWindow();
});

ipcMain.handle('config:get', async () => {
  return getConfig();
});

ipcMain.handle('config:generateSecret', async () => {
  try {
    return crypto.randomBytes(32).toString('hex');
  } catch {
    return '';
  }
});

ipcMain.handle('config:openEnvFolder', async () => {
  try {
    const envPath = ensureEnvFile();
    await shell.openPath(path.dirname(envPath));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('config:save', async (_evt, payload) => {
  try {
    const envPath = ensureEnvFile();
    const cur = fs.existsSync(envPath) ? fs.readFileSync(envPath, { encoding: 'utf-8' }) : '';
    const host = String(payload?.host || '127.0.0.1');
    const port = String(payload?.port || '5432');
    const db = String(payload?.db || '');
    const user = String(payload?.user || '');
    const password = String(payload?.password || '');
    const secretKey = String(payload?.secretKey || '');
    const databaseUrl = buildDatabaseUrl({ host, port, db, user, password });

    let next = cur;
    next = upsertEnvKey(next, 'DATABASE_URL', databaseUrl);
    next = upsertEnvKey(next, 'SECRET_KEY', secretKey);
    fs.writeFileSync(envPath, next, { encoding: 'utf-8' });

    // If setup window closed, try starting services.
    setTimeout(() => {
      try { startServices(); } catch {}
    }, 200);

    return { ok: true, envPath };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

app.on('window-all-closed', () => {
  isQuitting = true;
  stopServices();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
  stopServices();
});

