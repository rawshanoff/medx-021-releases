import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import {
  Building2,
  Download,
  FileText,
  KeyRound,
  Printer,
  RefreshCw,
  Settings,
  ShieldCheck,
  Upload,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { getUser, hasAnyRole } from '../utils/auth';
import {
  buildReceiptHtml,
  defaultSettings,
  getPrintSettings,
  openPrintWindow,
  printReceipt,
  setPrintSettings,
} from '../utils/print';
import { cn } from '../lib/cn';
import { loggers } from '../utils/logger';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import {
  SettingsSidebar,
  type SettingsNavGroup,
  type SettingsNavKey,
} from '../components/settings/SettingsSidebar';
import { SectionHeader } from '../features/system-settings/SectionHeader';
import { UsersPane } from '../features/system-settings/panes/UsersPane';
import { HistoryPane } from '../features/system-settings/panes/HistoryPane';

interface UserRow {
  id: number;
  username: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

type AuditRow = {
  id: number;
  user_id: number;
  user?: { id: number; username: string; full_name?: string | null } | null;
  action: string;
  setting_key: string;
  old_value: any;
  new_value: any;
  details?: string | null;
  created_at?: string | null;
};

type SectionKey =
  | 'requisites'
  | 'license'
  | 'printer'
  | 'receipt'
  | 'users'
  | 'updates'
  | 'history'
  | 'danger';

const DEFAULT_SECTION: SectionKey = 'requisites';

export default function SystemSettingsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const tr = (key: string, defaultValue: string) => t(key, { defaultValue });
  const confirmReset = () =>
    confirm(tr('system.confirm_reset', 'Сбросить изменения и загрузить сохранённые настройки?'));
  const confirmResetDefaults = () => {
    if (!confirm(tr('system.confirm_reset_defaults', 'Сбросить настройки к умолчанию?')))
      return false;
    return confirm(
      tr('system.confirm_reset_defaults_again', 'Подтвердите ещё раз сброс к умолчанию'),
    );
  };

  const canManageUsers = useMemo(() => hasAnyRole(['admin', 'owner']), []);

  const [activeKey, setActiveKey] = useState<SectionKey>(() => {
    const fromUrl = (searchParams.get('tab') || '').trim() as SectionKey;
    return fromUrl || DEFAULT_SECTION;
  });

  const setActive = (next: SectionKey) => {
    setActiveKey(next);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('tab', next);
      return p;
    });
  };

  // System States
  const [version, setVersion] = useState(t('common.loading'));
  const [licenseStatus, setLicenseStatus] = useState(t('common.unknown'));
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [activeFeatures, setActiveFeatures] = useState<string[]>([]);

  // Update States
  const [updateInfo, setUpdateInfo] = useState<{
    update_available: boolean;
    latest_version: string;
    current_version: string;
    release_notes: string;
    download_url: string | null;
  } | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);

  // Print settings
  const [printSettings, setLocalPrintSettings] = useState(defaultSettings());
  const [printers, setPrinters] = useState<
    Array<{ name: string; displayName: string; isDefault: boolean }>
  >([]);
  const [showPrintersInline, setShowPrintersInline] = useState(false);
  const [lastSilentPrint, setLastSilentPrint] = useState<any>(null);

  // Users
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersPage, setUsersPage] = useState(0);
  const usersPageSize = 10;
  const [showCreateUserInline, setShowCreateUserInline] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'doctor',
  });

  // History (audit)
  const [auditKey, setAuditKey] = useState('print_config');
  const [auditKeys, setAuditKeys] = useState<string[]>(['print_config']);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [auditBusy, setAuditBusy] = useState(false);

  useEffect(() => {
    const initializeSettings = async () => {
      void fetchSystemInfo();
      if (canManageUsers) void fetchUsers();
      try {
        const settings = await getPrintSettings();
        setLocalPrintSettings(settings);
      } catch (e) {
        loggers.system.error('Failed to load print settings', e);
      }
    };
    void initializeSettings();
  }, [canManageUsers]);

  useEffect(() => {
    // When tab changes: fetch on-demand for heavier sections.
    if (activeKey === 'updates') void checkForUpdates();
    if (activeKey === 'history') {
      void fetchAuditKeys();
      void fetchAudit();
    }
  }, [activeKey]);

  useEffect(() => {
    if (activeKey !== 'history') return;
    void fetchAudit();
  }, [auditKey]);

  const fetchSystemInfo = async () => {
    try {
      const res = await client.get('/system/version');
      setVersion(res.data?.version || 'unknown');
      const lic = await client.get('/licenses/status');
      if (lic.data?.error) {
        setLicenseStatus(`${t('common.inactive')}: ${lic.data.error}`);
        setActiveFeatures([]);
      } else {
        setLicenseStatus(t('common.active'));
        setActiveFeatures(Array.isArray(lic.data?.active_features) ? lic.data.active_features : []);
      }
    } catch (e) {
      setVersion(t('common.unknown'));
    }
  };

  const checkForUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const res = await client.get('/system/update-check');
      setUpdateInfo(res.data);
    } catch (e) {
      showToast(t('system.failed_check_updates'), 'error');
    } finally {
      setCheckingUpdates(false);
    }
  };

  const installUpdate = async () => {
    setCheckingUpdates(true);
    try {
      const res = await client.post('/system/update-install');
      setUpdateInfo(res.data);
      showToast(
        t('system.updating_now', {
          defaultValue: 'Устанавливаем обновление… приложение перезапустится.',
        }),
        'info',
      );
    } catch (e: any) {
      const msg = e?.response?.data?.detail || t('common.error', { defaultValue: 'Ошибка' });
      showToast(String(msg), 'error');
    } finally {
      setCheckingUpdates(false);
    }

    // UX: poll version after install attempt and notify on success.
    const startedAt = Date.now();
    const timeoutMs = 60_000;
    const prevVersion = version;
    const poll = async () => {
      try {
        const res = await client.get('/system/version');
        const newVersion = res.data?.version;
        if (newVersion && newVersion !== prevVersion) {
          setVersion(newVersion);
          showToast(
            t('system.update_installed', {
              defaultValue: 'Обновление установлено: {{version}}',
              version: newVersion,
            }),
            'success',
          );
          try {
            const u = await client.get('/system/update-check');
            setUpdateInfo(u.data);
          } catch {}
          return;
        }
      } catch {
        // backend may be restarting
      }
      if (Date.now() - startedAt < timeoutMs) setTimeout(poll, 2000);
    };
    setTimeout(poll, 2000);
  };

  const handleLicenseUpload = () => {
    if (!licenseFile) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      try {
        const res = await client.post('/licenses/upload', { token: content });
        if (res.data?.error) {
          setLicenseStatus(`${t('common.inactive')}: ${res.data.error}`);
          setActiveFeatures([]);
          showToast(String(res.data.error), 'error');
        } else {
          setLicenseStatus(t('common.active'));
          setActiveFeatures(
            Array.isArray(res.data?.active_features) ? res.data.active_features : [],
          );
          showToast(t('common.license') + ': OK', 'success');
        }
      } catch (err: any) {
        showToast(err.response?.data?.detail || t('system.license_load_failed'), 'error');
      } finally {
        setLicenseFile(null);
      }
    };
    reader.readAsText(licenseFile);
  };

  const fetchUsers = async () => {
    try {
      const res = await client.get('/users/');
      setUsers(res.data);
    } catch (e) {
      loggers.system.error('Failed to load users', e);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await client.post('/users/', formData);
      setShowCreateUserInline(false);
      setFormData({ username: '', password: '', full_name: '', role: 'doctor' });
      void fetchUsers();
      showToast(t('system.user_created'), 'success');
    } catch (e) {
      showToast(t('system.user_create_failed'), 'error');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm(t('common.confirm'))) return;
    try {
      await client.delete(`/users/${id}`);
      void fetchUsers();
      showToast(t('system.user_deleted'), 'success');
    } catch (e) {
      showToast(t('system.user_delete_failed'), 'error');
    }
  };

  const fetchAuditKeys = async () => {
    try {
      const res = await client.get('/system/settings/keys');
      const keys = Array.isArray(res.data) ? (res.data as string[]) : [];
      setAuditKeys(keys.length ? keys : ['print_config']);
    } catch {
      setAuditKeys(['print_config']);
    }
  };

  const fetchAudit = async () => {
    setAuditBusy(true);
    try {
      const res = await client.get(
        `/system/settings/audit/${encodeURIComponent(auditKey)}?limit=50`,
      );
      setAuditRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      showToast(tr('system.audit_load_failed', 'Не удалось загрузить историю'), 'error');
    } finally {
      setAuditBusy(false);
    }
  };

  const rollbackAudit = async (auditId: number) => {
    if (!confirm(tr('system.confirm_rollback', 'Откатить настройки к этому состоянию?'))) return;
    try {
      await client.post(`/system/settings/${encodeURIComponent(auditKey)}/rollback/${auditId}`);
      showToast(tr('system.rolled_back', 'Откат выполнен'), 'success');
      try {
        const settings = await getPrintSettings();
        setLocalPrintSettings(settings);
      } catch {}
      void fetchAudit();
    } catch (e: any) {
      showToast(String(e?.response?.data?.detail || tr('common.error', 'Ошибка')), 'error');
    }
  };

  const navGroups: SettingsNavGroup[] = useMemo(() => {
    return [
      {
        label: tr('system.group_clinic', 'Клиника'),
        items: [
          {
            key: 'requisites',
            label: tr('system.clinic_details', 'Реквизиты'),
            description: tr('system.clinic_details_desc', 'Логотип, адрес, QR, текст под QR'),
            icon: <Building2 size={18} />,
          },
          {
            key: 'license',
            label: tr('system.activation', 'Лицензия / активация'),
            description: tr('system.activation_desc', 'Статус и загрузка ключа'),
            icon: <KeyRound size={18} />,
          },
        ],
      },
      {
        label: tr('system.group_hardware', 'Оборудование'),
        items: [
          {
            key: 'printer',
            label: tr('system.printer_settings', 'Принтер'),
            description: tr('system.printer_settings_desc', 'deviceName, бумага, silent‑печать'),
            icon: <Printer size={18} />,
          },
          {
            key: 'receipt',
            label: tr('system.receipt_settings', 'Шаблон чека'),
            description: tr('system.receipt_settings_desc', 'Поля, предпросмотр, тесты'),
            icon: <FileText size={18} />,
          },
        ],
      },
      {
        label: tr('system.group_team', 'Команда'),
        items: [
          {
            key: 'users',
            label: tr('system.users', 'Пользователи и роли'),
            description: tr('system.users_desc', 'Создание, роли, удаление'),
            icon: <Users size={18} />,
            disabled: !canManageUsers,
          },
        ],
      },
      {
        label: tr('system.group_system', 'Система'),
        items: [
          {
            key: 'updates',
            label: tr('system.updates', 'Обновления'),
            description: tr('system.updates_desc', 'Проверка и установка обновлений'),
            icon: <Download size={18} />,
          },
          {
            key: 'history',
            label: tr('system.audit_log', 'История изменений'),
            description: tr('system.audit_log_desc', 'Кто и когда менял настройки'),
            icon: <Settings size={18} />,
          },
          {
            key: 'danger',
            label: tr('system.danger_zone', 'Опасная зона'),
            description: tr('system.danger_zone_desc', 'Сброс и восстановление'),
            icon: <Settings size={18} />,
          },
        ],
      },
    ];
  }, [canManageUsers, t]);

  const activeMeta = useMemo(() => {
    for (const g of navGroups) {
      for (const it of g.items) if (it.key === activeKey) return { group: g.label, item: it };
    }
    return null;
  }, [navGroups, activeKey]);

  const PaneRequisites = () => (
    <div className="grid gap-6">
      <SectionHeader
        title={tr('system.clinic_title', 'Реквизиты')}
        subtitle={tr('system.clinic_description', 'Данные клиники и QR/логотип для печати.')}
        right={
          <Button variant="secondary" size="sm" type="button" onClick={fetchSystemInfo}>
            {tr('common.refresh', 'Обновить')}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{tr('system.section_basic', 'Основное')}</CardTitle>
          <CardDescription>
            {tr('system.requisites_hint', 'Эти данные отображаются в чеке и в QR‑блоке.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tr('system.logo_for_receipt', 'Логотип (для чека)')}
            </label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const dataUrl = String(reader.result || '');
                  setLocalPrintSettings((p) => ({ ...p, logoDataUrl: dataUrl }));
                };
                reader.readAsDataURL(f);
              }}
            />
            {printSettings.logoDataUrl ? (
              <div className="mt-3 flex items-center gap-3">
                <div className="h-32 w-32 overflow-hidden rounded-md border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
                  <img
                    src={printSettings.logoDataUrl}
                    alt="logo-preview"
                    className="h-full w-full object-contain"
                  />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setLocalPrintSettings((p) => ({ ...p, logoDataUrl: '' }))}
                >
                  {tr('system.remove_logo', 'Удалить')}
                </Button>
              </div>
            ) : null}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tr('system.clinic_name', 'Название клиники')}
            </label>
            <Input
              value={printSettings.clinicName}
              onChange={(e) => setLocalPrintSettings((p) => ({ ...p, clinicName: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tr('system.clinic_phone', 'Телефон')}
            </label>
            <Input
              value={printSettings.clinicPhone}
              onChange={(e) =>
                setLocalPrintSettings((p) => ({ ...p, clinicPhone: e.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tr('system.clinic_address', 'Адрес')}
            </label>
            <Input
              value={printSettings.clinicAddress}
              onChange={(e) =>
                setLocalPrintSettings((p) => ({ ...p, clinicAddress: e.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tr('system.footer_note', 'Примечание внизу')}
            </label>
            <Input
              value={printSettings.footerNote}
              onChange={(e) => setLocalPrintSettings((p) => ({ ...p, footerNote: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tr('system.under_qr_text', 'Текст под QR')}
            </label>
            <Input
              placeholder={tr('system.telegram_placeholder', 'Например: t.me/ваш_канал')}
              value={printSettings.underQrText}
              onChange={(e) =>
                setLocalPrintSettings((p) => ({ ...p, underQrText: e.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tr('system.qr_url_optional', 'QR ссылка (опционально)')}
            </label>
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder={tr('system.qr_url_placeholder', 'https://...')}
                value={printSettings.qrUrl}
                onChange={(e) => setLocalPrintSettings((p) => ({ ...p, qrUrl: e.target.value }))}
              />
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={async () => {
                  if (!printSettings.qrUrl) {
                    showToast(tr('system.qr_url_required', 'Сначала укажите QR ссылку'), 'warning');
                    return;
                  }
                  const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(printSettings.qrUrl)}`;
                  const res = await fetch(url);
                  const blob = await res.blob();
                  const reader = new FileReader();
                  reader.onload = () => {
                    const dataUrl = String(reader.result || '');
                    setLocalPrintSettings((p) => ({ ...p, qrImageDataUrl: dataUrl }));
                  };
                  reader.readAsDataURL(blob);
                }}
              >
                {tr('system.generate_qr', 'Сгенерировать')}
              </Button>
            </div>
            {printSettings.qrImageDataUrl ? (
              <div className="mt-3 flex items-center gap-3">
                <img
                  src={printSettings.qrImageDataUrl}
                  alt="qr-preview"
                  className="h-20 w-20 rounded-md border border-slate-200 bg-white p-1 object-contain dark:border-slate-700 dark:bg-slate-800"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setLocalPrintSettings((p) => ({ ...p, qrImageDataUrl: '' }))}
                >
                  {tr('system.remove_qr', 'Удалить QR')}
                </Button>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={async () => {
            try {
              await setPrintSettings(printSettings);
              showToast(tr('common.saved', 'Сохранено'), 'success');
            } catch {
              showToast(tr('common.error', 'Ошибка сохранения'), 'error');
            }
          }}
        >
          {tr('common.save', 'Сохранить')}
        </Button>
        <Button
          variant="secondary"
          type="button"
          onClick={async () => {
            if (!confirmReset()) return;
            try {
              const settings = await getPrintSettings();
              setLocalPrintSettings(settings);
              showToast(tr('system.settings_loaded', 'Настройки загружены'), 'success');
            } catch {
              showToast(
                tr('system.settings_load_failed', 'Не удалось загрузить настройки'),
                'error',
              );
            }
          }}
        >
          {tr('common.reset', 'Сбросить')}
        </Button>
      </div>
    </div>
  );

  const PaneLicense = () => (
    <div className="grid gap-6">
      <SectionHeader
        title={tr('system.activation_title', 'Активация / лицензия')}
        subtitle={tr('system.activation_description', 'Статус лицензии и загрузка ключа.')}
        right={
          <Button variant="secondary" size="sm" type="button" onClick={fetchSystemInfo}>
            {tr('common.refresh', 'Обновить')}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{tr('system.license_status', 'Статус')}</CardTitle>
          <CardDescription>
            {tr('system.license_fail_closed', 'Лицензирование работает в режиме fail‑closed.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-muted-foreground" />
              <div
                className={cn(
                  'text-sm font-semibold',
                  licenseStatus === t('common.active')
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-destructive',
                )}
              >
                {licenseStatus}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {tr('system.current_version', 'Текущая версия')}:{' '}
              <span className="font-medium text-foreground">{version}</span>
            </div>
          </div>

          {activeFeatures.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {activeFeatures.map((f) => (
                <span
                  key={f}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900/30"
                >
                  {f}
                </span>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tr('system.license_upload', 'Загрузка ключа')}</CardTitle>
          <CardDescription>
            {tr('system.license_file_hint', 'Файл лицензии `.key`.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Upload size={18} />
              <div>{licenseFile ? licenseFile.name : tr('auth.click_upload', 'Выберите файл')}</div>
            </div>
            <Input
              type="file"
              accept=".key"
              onChange={(e) => setLicenseFile(e.target.files ? e.target.files[0] : null)}
            />
            <div className="flex justify-end">
              <Button type="button" onClick={handleLicenseUpload} disabled={!licenseFile}>
                {tr('auth.activate_btn', 'Активировать')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const PanePrinter = () => (
    <div className="grid gap-6">
      <SectionHeader
        title={tr('system.printer_title', 'Настройка принтера')}
        subtitle={tr(
          'system.printer_description',
          'Выбор принтера (deviceName) и параметры silent‑печати.',
        )}
      />

      <Card>
        <CardHeader>
          <CardTitle>{tr('system.printer_card_title', 'Принтер')}</CardTitle>
          <CardDescription>
            {tr(
              'system.printer_card_desc',
              'В Electron можно выбрать `deviceName` для silent‑печати.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tr('system.printer_display_name', 'Название принтера (для интерфейса)')}
            </label>
            <Input
              placeholder={tr('system.printer_placeholder', 'Например: Epson TM‑T20')}
              value={printSettings.preferredPrinterName}
              onChange={(e) =>
                setLocalPrintSettings((p) => ({ ...p, preferredPrinterName: e.target.value }))
              }
            />
          </div>

          <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <span className="text-muted-foreground">
                {tr('system.current_label', 'Текущий')}{' '}
              </span>
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-900/40">
                deviceName
              </code>
              <span className="text-muted-foreground">: </span>
              <span className="font-medium text-foreground">
                {printSettings.preferredPrinterDeviceName || tr('system.not_selected', 'не выбран')}
              </span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={async () => {
                const api: any = (window as any).medx;
                if (!api?.listPrinters) {
                  showToast(
                    tr(
                      'system.printers_electron_only',
                      'Список принтеров доступен только в Electron',
                    ),
                    'warning',
                  );
                  return;
                }
                const list = await api.listPrinters();
                setPrinters(Array.isArray(list) ? list : []);
                setShowPrintersInline((v) => !v);
              }}
            >
              {showPrintersInline
                ? tr('system.hide_printers', 'Скрыть список')
                : tr('system.show_printers', 'Показать список принтеров')}
            </Button>
          </div>

          {showPrintersInline ? (
            <div className="md:col-span-2">
              <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 dark:border-slate-700/60 dark:bg-slate-900/30">
                {printers.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    {tr('system.printers_empty', 'Список пуст')}
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {printers.map((p) => (
                      <Button
                        key={p.name}
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full justify-between gap-3"
                        onClick={() => {
                          setLocalPrintSettings((prev) => ({
                            ...prev,
                            preferredPrinterDeviceName: p.name,
                            preferredPrinterName: p.displayName || p.name,
                          }));
                          showToast(
                            tr('system.printer_selected', 'Выбран принтер: {{name}}', {
                              name: p.displayName || p.name,
                            }),
                            'success',
                          );
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate text-left">
                          {p.displayName || p.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {p.isDefault ? tr('system.default_printer', 'Default') : ''}
                        </span>
                      </Button>
                    ))}
                  </div>
                )}
                <div className="mt-3 text-xs text-muted-foreground">
                  {tr('system.printer_device_hint_prefix', 'Это выбирает')} <code>deviceName</code>{' '}
                  {tr('system.printer_device_hint_suffix', 'для silent‑печати в Electron.')}
                </div>
              </div>
            </div>
          ) : null}

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tr('system.paper_size', 'Размер бумаги')}
            </label>
            <select
              className={cn(
                'h-10 w-full rounded-md border border-border bg-background px-3 text-sm shadow-none outline-none',
                'focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500',
              )}
              value={printSettings.paperSize}
              onChange={(e) =>
                setLocalPrintSettings((p) => ({ ...p, paperSize: e.target.value as any }))
              }
            >
              <option value="58">{tr('system.paper_size_58', '58 мм')}</option>
              <option value="80">{tr('system.paper_size_80', '80 мм')}</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tr('system.print_scale', 'Масштаб печати (%)')}
            </label>
            <Input
              type="number"
              min={70}
              max={120}
              value={
                Number.isFinite(Number(printSettings.silentScalePercent))
                  ? Number(printSettings.silentScalePercent)
                  : 100
              }
              onChange={(e) =>
                setLocalPrintSettings((p) => ({
                  ...p,
                  silentScalePercent: Number(e.target.value || 100),
                }))
              }
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tr('system.silent_print_mode', 'Режим silent‑печати')}
            </label>
            <select
              className={cn(
                'h-10 w-full rounded-md border border-border bg-background px-3 text-sm shadow-none outline-none',
                'focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500',
              )}
              value={printSettings.silentPrintMode || 'html'}
              onChange={(e) =>
                setLocalPrintSettings((p) => ({ ...p, silentPrintMode: e.target.value as any }))
              }
            >
              <option value="html">{tr('system.silent_mode_html', 'HTML')}</option>
              <option value="image">
                {tr('system.silent_mode_image', 'Картинка (совместимость)')}
              </option>
            </select>
          </div>

          <div
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 dark:border-slate-700/60 dark:bg-slate-900/30 cursor-pointer"
            role="button"
            tabIndex={0}
            onClick={() => setLocalPrintSettings((p) => ({ ...p, autoPrint: !p.autoPrint }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setLocalPrintSettings((p) => ({ ...p, autoPrint: !p.autoPrint }));
              }
            }}
          >
            <div className="min-w-0">
              <div className="text-sm font-medium">
                {tr('system.auto_print', 'Автопечать после оплаты')}
              </div>
              <div className="text-xs text-muted-foreground">
                {tr('system.auto_print_hint', 'Silent‑печать без диалогов (Electron).')}
              </div>
            </div>
            <span onClick={(e) => e.stopPropagation()}>
              <Switch
                checked={Boolean(printSettings.autoPrint)}
                onCheckedChange={(v) => setLocalPrintSettings((p) => ({ ...p, autoPrint: v }))}
              />
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={async () => {
            try {
              await setPrintSettings(printSettings);
              showToast(tr('common.saved', 'Сохранено'), 'success');
            } catch {
              showToast(tr('common.error', 'Ошибка сохранения'), 'error');
            }
          }}
        >
          {tr('common.save', 'Сохранить')}
        </Button>
        <Button
          variant="secondary"
          type="button"
          onClick={async () => {
            if (!confirmReset()) return;
            try {
              const settings = await getPrintSettings();
              setLocalPrintSettings(settings);
              showToast(tr('system.settings_loaded', 'Настройки загружены'), 'success');
            } catch {
              showToast(
                tr('system.settings_load_failed', 'Не удалось загрузить настройки'),
                'error',
              );
            }
          }}
        >
          {tr('common.reset', 'Сбросить')}
        </Button>
      </div>
    </div>
  );

  const receiptFieldDefs: Array<{ key: keyof typeof printSettings; label: string }> = [
    { key: 'showLogo', label: tr('system.show_logo', 'Показывать логотип') },
    { key: 'showClinicName', label: tr('system.show_clinic_name', 'Показывать название клиники') },
    { key: 'showClinicAddress', label: tr('system.show_clinic_address', 'Показывать адрес') },
    { key: 'showClinicPhone', label: tr('system.show_clinic_phone', 'Показывать телефон') },
    { key: 'showDateTime', label: tr('system.show_date_time', 'Показывать дату/время') },
    { key: 'showPatientName', label: tr('system.show_patient', 'Показывать пациента') },
    { key: 'showQueue', label: tr('system.show_queue', 'Показывать номер очереди') },
    { key: 'showDoctor', label: tr('system.show_doctor', 'Показывать врача') },
    { key: 'showDoctorRoom', label: tr('system.show_doctor_room', 'Показывать кабинет врача') },
    { key: 'showServices', label: tr('system.show_services', 'Показывать услуги') },
    { key: 'showTotalAmount', label: tr('system.show_total', 'Показывать итого сумму') },
    { key: 'showPaymentType', label: tr('system.show_payment_type', 'Показывать тип оплаты') },
    { key: 'showQr', label: tr('system.show_qr', 'Показывать QR') },
    { key: 'showUnderQrText', label: tr('system.show_under_qr', 'Показывать текст под QR') },
    { key: 'showFooterNote', label: tr('system.show_footer', 'Показывать нижнюю подпись') },
    { key: 'boldAllText', label: tr('system.bold_all', 'Жирный шрифт (весь чек)') },
  ];

  const PaneReceipt = () => (
    <div className="grid gap-6">
      <SectionHeader
        title={tr('system.receipt_title', 'Настройка чека')}
        subtitle={tr(
          'system.receipt_description',
          'Шаблон, что показывать в чеке, предпросмотр и тесты.',
        )}
      />

      <Card>
        <CardHeader>
          <CardTitle>{tr('system.receipt_template_width', 'Шаблон и ширина')}</CardTitle>
          <CardDescription>
            {tr(
              'system.receipt_template_width_desc',
              'Выберите стиль и “безопасную” ширину, если принтер обрезает.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tr('system.receipt_template', 'Шаблон чека')}
            </label>
            <select
              className={cn(
                'h-10 w-full rounded-md border border-border bg-background px-3 text-sm shadow-none outline-none',
                'focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500',
              )}
              value={printSettings.receiptTemplateId}
              onChange={(e) =>
                setLocalPrintSettings((p) => ({ ...p, receiptTemplateId: e.target.value as any }))
              }
            >
              <option value="check-6">{tr('system.template_check_6', 'check-6 (таблица)')}</option>
              <option value="check-1">{tr('system.template_check_1', 'check-1 (рамка)')}</option>
              <option value="check-4-58">
                {tr('system.template_check_4_58', 'check-4 58 (блок очереди)')}
              </option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tr('system.receipt_width', 'Ширина чека')}
            </label>
            <select
              className={cn(
                'h-10 w-full rounded-md border border-border bg-background px-3 text-sm shadow-none outline-none',
                'focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500',
              )}
              value={printSettings.receiptWidthMode || 'standard'}
              onChange={(e) =>
                setLocalPrintSettings((p) => ({ ...p, receiptWidthMode: e.target.value as any }))
              }
            >
              <option value="standard">
                {tr('system.receipt_width_standard', 'Стандарт (58/80мм)')}
              </option>
              <option value="safe">
                {tr('system.receipt_width_safe', 'Безопасная (если обрезает)')}
              </option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tr('system.receipt_fields', 'Поля чека')}</CardTitle>
          <CardDescription>
            {tr('system.receipt_fields_desc', 'Переключатели вместо чекбоксов — быстрее и чище.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {receiptFieldDefs.map((f) => {
              // For “show*” fields we treat undefined as true for backward compatibility
              const checked = String(f.key).startsWith('show')
                ? (printSettings as any)[f.key] !== false
                : Boolean((printSettings as any)[f.key]);

              return (
                <div
                  key={String(f.key)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 dark:border-slate-700/60 dark:bg-slate-900/30 cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setLocalPrintSettings((p) => {
                      const nextChecked = String(f.key).startsWith('show')
                        ? (p as any)[f.key] !== false
                        : Boolean((p as any)[f.key]);
                      return { ...p, [f.key]: !nextChecked } as any;
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setLocalPrintSettings((p) => {
                        const nextChecked = String(f.key).startsWith('show')
                          ? (p as any)[f.key] !== false
                          : Boolean((p as any)[f.key]);
                        return { ...p, [f.key]: !nextChecked } as any;
                      });
                    }
                  }}
                >
                  <div className="min-w-0 text-sm">
                    <div className="font-medium">{f.label}</div>
                  </div>
                  <span onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={checked}
                      onCheckedChange={(v) =>
                        setLocalPrintSettings((p) => ({ ...p, [f.key]: v }) as any)
                      }
                    />
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tr('system.preview_test', 'Предпросмотр и тест')}</CardTitle>
          <CardDescription>
            {tr('system.preview_test_desc', 'Проверьте итоговый HTML и запустите печать.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const now = new Date().toISOString();
                const html = buildReceiptHtml(
                  {
                    receiptNo: 'TEST-0001',
                    ticket: 'T-001',
                    createdAtIso: now,
                    patientName: 'Test Patient',
                    doctorName: 'Test Doctor',
                    doctorRoom: '7',
                    serviceName: 'Test Service',
                    amount: 12345,
                    currency: t('common.currency', { defaultValue: "so'm" }),
                    paymentMethod: 'CASH',
                  } as any,
                  { ...printSettings, autoPrint: false } as any,
                );
                const win = openPrintWindow();
                try {
                  win?.document?.open();
                  win?.document?.write(html);
                  win?.document?.close();
                } catch (e) {
                  loggers.system.error('Preview open failed', e);
                }
              }}
            >
              {tr('system.preview', 'Предпросмотр')}
            </Button>
            <Button
              type="button"
              onClick={async () => {
                try {
                  const api: any = (window as any).medx;
                  const now = new Date().toISOString();
                  const payload = {
                    receiptNo: 'TEST-0001',
                    ticket: 'T-001',
                    createdAtIso: now,
                    patientName: 'Test Patient',
                    doctorName: 'Test Doctor',
                    doctorRoom: '7',
                    serviceName: 'Test Service',
                    amount: 12345,
                    currency: t('common.currency', { defaultValue: "so'm" }),
                    paymentMethod: 'CASH',
                  } as any;

                  // Electron: use silent print API to get structured debug result
                  if (api?.printHtml) {
                    if (!printSettings.preferredPrinterDeviceName) {
                      showToast(
                        tr(
                          'system.select_device_name_first',
                          'Сначала выберите deviceName принтера',
                        ),
                        'warning',
                      );
                      return;
                    }
                    const html = buildReceiptHtml(payload, {
                      ...printSettings,
                      autoPrint: true,
                    } as any);
                    const res = await api.printHtml({
                      html,
                      deviceName: printSettings.preferredPrinterDeviceName,
                      silent: true,
                      paperSize: printSettings.paperSize,
                      scaleFactor: Number.isFinite(Number(printSettings.silentScalePercent))
                        ? Number(printSettings.silentScalePercent)
                        : 100,
                      mode: printSettings.silentPrintMode || 'html',
                    });
                    setLastSilentPrint(res);
                    if (res?.ok)
                      showToast(tr('system.print_sent', 'Отправлено в печать'), 'success');
                    return;
                  }

                  // Browser/dev fallback
                  printReceipt(payload, { ...printSettings, autoPrint: true } as any);
                  showToast(tr('system.print_started', 'Печать запущена'), 'success');
                } catch (e: any) {
                  showToast(
                    String(e?.message || tr('system.print_failed', 'Печать не удалась')),
                    'error',
                  );
                }
              }}
            >
              {tr('system.test_print', 'Тест печати')}
            </Button>
          </div>

          {lastSilentPrint ? (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-xs text-muted-foreground dark:border-slate-700/60 dark:bg-slate-900/30">
              <div className="font-medium text-foreground">
                {tr('system.last_result', 'Последний результат')}
              </div>
              <div className="mt-1 break-words">
                <span className="font-medium text-foreground">
                  {tr('system.last_result_ok', 'ok')}:
                </span>{' '}
                {String(Boolean(lastSilentPrint.ok))}
              </div>
              {lastSilentPrint?.error ? (
                <div className="mt-1 break-words">
                  <span className="font-medium text-foreground">
                    {tr('system.last_result_error', 'error')}:
                  </span>{' '}
                  {String(lastSilentPrint.error)}
                </div>
              ) : null}
              {lastSilentPrint?.debug ? (
                <div className="mt-1 break-words">
                  <span className="font-medium text-foreground">
                    {tr('system.last_result_debug', 'debug')}:
                  </span>{' '}
                  <code>{JSON.stringify(lastSilentPrint.debug)}</code>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={async () => {
            try {
              await setPrintSettings(printSettings);
              showToast(tr('common.saved', 'Сохранено'), 'success');
            } catch {
              showToast(tr('common.error', 'Ошибка сохранения'), 'error');
            }
          }}
        >
          {tr('common.save', 'Сохранить')}
        </Button>
        <Button
          variant="secondary"
          type="button"
          onClick={async () => {
            if (!confirmReset()) return;
            try {
              const settings = await getPrintSettings();
              setLocalPrintSettings(settings);
              showToast(tr('system.settings_loaded', 'Настройки загружены'), 'success');
            } catch {
              showToast(
                tr('system.settings_load_failed', 'Не удалось загрузить настройки'),
                'error',
              );
            }
          }}
        >
          {tr('common.reset', 'Сбросить')}
        </Button>
      </div>
    </div>
  );

  const PaneUpdates = () => (
    <div className="grid gap-6">
      <SectionHeader
        title={tr('system.updates', 'Обновления')}
        subtitle={tr('system.updates_desc', 'Проверка и установка обновлений системы')}
        right={
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={checkForUpdates}
            disabled={checkingUpdates}
          >
            <RefreshCw size={14} className={checkingUpdates ? 'animate-spin' : ''} />{' '}
            {tr('system.check_updates', 'Проверить')}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{tr('system.update_status', 'Статус')}</CardTitle>
          <CardDescription>
            {tr('system.update_status_desc', 'Версия приложения и наличие обновлений.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="text-sm font-medium">
              {tr('system.current_version', 'Текущая версия')}
            </div>
            <div className="text-sm font-semibold text-foreground">{version}</div>
          </div>

          {checkingUpdates ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw size={16} className="animate-spin" />
              {tr('system.checking_updates', 'Проверяем обновления…')}
            </div>
          ) : updateInfo ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">
                  {tr('system.latest_version', 'Последняя версия')}
                </div>
                <div
                  className={cn(
                    'text-sm font-semibold',
                    updateInfo.update_available
                      ? 'text-blue-600 dark:text-blue-300'
                      : 'text-muted-foreground',
                  )}
                >
                  {updateInfo.latest_version}
                </div>
              </div>

              {updateInfo.release_notes ? (
                <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-sm text-muted-foreground dark:border-slate-700/60 dark:bg-slate-900/30">
                  {updateInfo.release_notes}
                </div>
              ) : null}

              {updateInfo.update_available ? (
                <div className="rounded-xl border border-blue-600/30 bg-blue-600/10 p-3">
                  <div className="text-sm font-semibold text-blue-700 dark:text-blue-200">
                    {tr('system.update_available', 'Доступно обновление')}:{' '}
                    {updateInfo.latest_version}
                  </div>
                  {!updateInfo.download_url ? (
                    <div className="mt-1 text-sm text-muted-foreground">
                      {tr('system.update_url_not_configured', 'URL обновления не настроен')}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 dark:border-slate-700/60 dark:bg-slate-900/30">
                  <div className="text-sm font-medium text-muted-foreground">
                    {tr('system.update_not_available', 'Обновлений нет')}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                {updateInfo.update_available && updateInfo.download_url ? (
                  <Button type="button" onClick={installUpdate} disabled={checkingUpdates}>
                    <Download size={14} /> {tr('system.install_update', 'Установить')}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              {tr('system.check_updates_prompt', 'Проверьте обновления')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const PaneDanger = () => (
    <div className="grid gap-6">
      <SectionHeader
        title={tr('system.danger_zone', 'Опасная зона')}
        subtitle={tr('system.danger_zone_desc', 'Сброс и восстановление')}
      />

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">
            {tr('system.reset_settings', 'Сбросить настройки')}
          </CardTitle>
          <CardDescription>
            {tr('system.reset_settings_desc', 'Вернуть значения по умолчанию')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="destructive"
            onClick={async () => {
              if (!confirmResetDefaults()) return;
              try {
                const next = defaultSettings();
                const saved = await setPrintSettings(next);
                setLocalPrintSettings({ ...next, ...(saved as any) });
                showToast(tr('common.saved', 'Сохранено'), 'success');
              } catch {
                showToast(tr('common.error', 'Ошибка'), 'error');
              }
            }}
          >
            {tr('system.reset_to_defaults', 'Сбросить к умолчанию')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              if (!confirmReset()) return;
              try {
                const settings = await getPrintSettings();
                setLocalPrintSettings(settings);
                showToast(tr('system.settings_loaded', 'Настройки загружены'), 'success');
              } catch {
                showToast(
                  tr('system.settings_load_failed', 'Не удалось загрузить настройки'),
                  'error',
                );
              }
            }}
          >
            {tr('system.restore_saved', 'Восстановить сохранённые')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderPane = () => {
    if (activeKey === 'requisites') return <PaneRequisites />;
    if (activeKey === 'license') return <PaneLicense />;
    if (activeKey === 'printer') return <PanePrinter />;
    if (activeKey === 'receipt') return <PaneReceipt />;
    if (activeKey === 'users')
      return canManageUsers ? (
        <UsersPane
          tr={tr}
          users={users}
          usersPage={usersPage}
          usersPageSize={usersPageSize}
          setUsersPage={setUsersPage}
          fetchUsers={fetchUsers}
          showCreateUserInline={showCreateUserInline}
          setShowCreateUserInline={setShowCreateUserInline}
          formData={formData}
          setFormData={setFormData}
          handleCreateUser={handleCreateUser}
          handleDeleteUser={handleDeleteUser}
        />
      ) : (
        <PaneDanger />
      );
    if (activeKey === 'updates') return <PaneUpdates />;
    if (activeKey === 'history')
      return (
        <HistoryPane
          tr={tr}
          auditKey={auditKey}
          setAuditKey={setAuditKey}
          auditKeys={auditKeys}
          auditRows={auditRows}
          auditBusy={auditBusy}
          fetchAudit={fetchAudit}
          rollbackAudit={rollbackAudit}
          me={getUser()}
        />
      );
    if (activeKey === 'danger') return <PaneDanger />;
    return <PaneRequisites />;
  };

  return (
    <div className="flex min-h-[calc(100vh-160px)] w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-700/60 dark:bg-slate-800">
      <aside className="hidden w-[280px] shrink-0 border-r border-slate-200/80 bg-white/80 dark:border-slate-700/60 dark:bg-slate-800/60 lg:block">
        <div className="sticky top-6">
          <div className="px-6 pt-6">
            <div className="text-base font-semibold">{tr('system.settings', 'Настройки')}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {tr('system.settings_desc', 'Управление клиникой, оборудованием и системой')}
            </div>
          </div>
          <SettingsSidebar
            groups={navGroups}
            activeKey={activeKey}
            onSelect={(k: SettingsNavKey) => setActive(k as SectionKey)}
          />
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-auto bg-slate-50/70 p-6 dark:bg-slate-900/30">
        {/* Mobile top selector */}
        <div className="mb-4 grid gap-2 lg:hidden">
          <div className="text-base font-semibold">{tr('system.settings', 'Настройки')}</div>
          <select
            className={cn(
              'h-11 w-full rounded-md border border-border bg-background px-3 text-sm shadow-none outline-none',
              'focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500',
            )}
            value={activeKey}
            onChange={(e) => setActive(e.target.value as SectionKey)}
          >
            {navGroups.flatMap((g) =>
              g.items.map((it) => (
                <option key={it.key} value={it.key} disabled={it.disabled}>
                  {g.label} · {it.label}
                </option>
              )),
            )}
          </select>
        </div>

        {/* Optional breadcrumb */}
        {activeMeta ? (
          <div className="mb-4 text-xs text-muted-foreground">
            {activeMeta.group} /{' '}
            <span className="font-medium text-foreground">{activeMeta.item.label}</span>
          </div>
        ) : null}

        {renderPane()}
      </div>
    </div>
  );
}
