const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');

let backendProc = null;
let licenseProc = null;

// Avoid Windows cache permission issues during dev.
try {
  app.setPath('userData', path.join(app.getPath('temp'), 'medx-electron-userdata'));
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
  app.commandLine.appendSwitch('disable-gpu-disk-cache');
} catch {}

function spawnPythonModule(args, cwd) {
  const python =
    process.env.MEDX_PYTHON ||
    path.join(process.cwd(), '..', '..', '.venv', 'Scripts', 'python.exe');
  return spawn(python, args, {
    cwd,
    stdio: 'inherit',
    windowsHide: true,
  });
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

async function startServices() {
  if (process.env.MEDX_DISABLE_SERVICES === '1') return;
  // __dirname = <repo>/desktop/electron
  const repoRoot = path.join(__dirname, '..', '..');

  // If services already started externally, don't spawn duplicates.
  const backendUp = await isPortOpen(8000);
  const licenseUp = await isPortOpen(8001);

  // NOTE: Для Enterprise лучше запускать без --reload и под отдельным менеджером.
  if (!backendUp) {
    backendProc = spawnPythonModule(['-m', 'uvicorn', 'backend.main:app', '--port', '8000'], repoRoot);
  }
  if (!licenseUp) {
    licenseProc = spawnPythonModule(['-m', 'uvicorn', 'license_server.main:app', '--port', '8001'], repoRoot);
  }
}

function stopServices() {
  for (const p of [backendProc, licenseProc]) {
    if (p && !p.killed) {
      try { p.kill(); } catch {}
    }
  }
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
  const indexHtml = path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html');
  win.loadFile(indexHtml);
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
  startServices();
  createWindow();
});

app.on('window-all-closed', () => {
  stopServices();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopServices();
});

