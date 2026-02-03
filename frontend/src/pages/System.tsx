import { ReactNode, useEffect, useMemo, useState } from 'react';
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
  Trash2,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { hasAnyRole } from '../utils/auth';
import {
  buildReceiptHtml,
  getPrintSettings,
  openPrintWindow,
  printReceipt,
  setPrintSettings,
} from '../utils/print';
import { Modal } from '../components/ui/modal';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { SettingHistory } from '../components/ui/setting-history';
import { cn } from '../lib/cn';

interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

type SystemSection = 'requisites' | 'printer' | 'receipt' | 'license' | 'users' | 'updates';

function SettingsModal({
  open,
  title,
  description,
  onClose,
  children,
  width = 820,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  return (
    <Modal open={open} title={title} description={description} onClose={onClose} width={width}>
      {children}
    </Modal>
  );
}

function SettingsTile({
  title,
  subtitle,
  icon,
  onClick,
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-start gap-3 rounded-md border border-border bg-card p-4 text-left transition hover:bg-accent/40"
      onClick={onClick}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0 pt-0.5">
        <div className="text-[14px] font-medium">{title}</div>
        {subtitle ? (
          <div className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
    </button>
  );
}

export default function System() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const canManageUsers = useMemo(() => hasAnyRole(['admin', 'owner']), []);
  const [openSection, setOpenSection] = useState<SystemSection | null>(null);

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
  const [printSettings, setLocalPrintSettings] = useState(() => getPrintSettings());
  const [printers, setPrinters] = useState<
    Array<{ name: string; displayName: string; isDefault: boolean }>
  >([]);
  const [showPrinters, setShowPrinters] = useState(false);
  const [lastSilentPrint, setLastSilentPrint] = useState<any>(null);
  const [printersPage, setPrintersPage] = useState(0);
  const printersPageSize = 10;

  // Users States
  const [users, setUsers] = useState<User[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [usersPage, setUsersPage] = useState(0);
  const usersPageSize = 8;

  // Form State
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'doctor', // default
  });

  useEffect(() => {
    const initializeSettings = async () => {
      fetchSystemInfo();
      if (canManageUsers) {
        fetchUsers();
      }
      // Load print settings from server
      try {
        const settings = await getPrintSettings();
        setLocalPrintSettings(settings);
      } catch (e) {
        console.error('Failed to load print settings:', e);
        // Will use defaults if loading fails
      }
    };
    initializeSettings();
  }, [canManageUsers]);

  const checkForUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const res = await client.get('/system/update-check');
      setUpdateInfo(res.data);
    } catch (e) {
      showToast('Failed to check for updates', 'error');
    } finally {
      setCheckingUpdates(false);
    }
  };

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

  const fetchUsers = async () => {
    try {
      const res = await client.get('/users/');
      setUsers(res.data);
    } catch (e) {
      console.error('Failed to load users', e);
    }
  };

  const handleLicenseUpload = () => {
    if (!licenseFile) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      try {
        const res = await client.post('/licenses/upload', { token: content });
        // keep local copy for convenience (client may show/hide features)
        localStorage.setItem('medx_license_key', content);
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
        showToast(err.response?.data?.detail || 'Не удалось загрузить лицензию', 'error');
      } finally {
        setLicenseFile(null);
      }
    };
    reader.readAsText(licenseFile);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await client.post('/users/', formData);
      setShowUserModal(false);
      setFormData({ username: '', password: '', full_name: '', role: 'doctor' });
      fetchUsers();
      showToast('User created', 'success');
    } catch (e) {
      showToast('Failed to create user. Username might exist.', 'error');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm(t('common.confirm'))) return;
    try {
      await client.delete(`/users/${id}`);
      fetchUsers();
      showToast('User deleted', 'success');
    } catch (e) {
      showToast('Failed to delete user', 'error');
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <SettingsTile
          title={t('system.clinic_details')}
          subtitle={t('system.clinic_details_desc')}
          icon={<Building2 size={18} />}
          onClick={() => setOpenSection('requisites')}
        />
        <SettingsTile
          title={t('system.printer_settings')}
          subtitle={t('system.printer_settings_desc')}
          icon={<Printer size={18} />}
          onClick={() => setOpenSection('printer')}
        />
        <SettingsTile
          title={t('system.receipt_settings')}
          subtitle={t('system.receipt_settings_desc')}
          icon={<FileText size={18} />}
          onClick={() => setOpenSection('receipt')}
        />
        <SettingsTile
          title={t('system.activation')}
          subtitle={t('system.activation_desc')}
          icon={<KeyRound size={18} />}
          onClick={() => setOpenSection('license')}
        />
        <SettingsTile
          title={t('system.updates')}
          subtitle={t('system.updates_desc')}
          icon={<Download size={18} />}
          onClick={() => {
            setOpenSection('updates');
            checkForUpdates();
          }}
        />
        {canManageUsers ? (
          <SettingsTile
            title={t('system.users')}
            subtitle={t('system.users_desc')}
            icon={<Users size={18} />}
            onClick={() => setOpenSection('users')}
          />
        ) : null}
        <SettingsTile
          title={t('system.reset_settings')}
          subtitle={t('system.reset_settings_desc')}
          icon={<Settings size={18} />}
          onClick={() => {
            setLocalPrintSettings(getPrintSettings());
            showToast('Настройки загружены из сохранённых', 'success');
          }}
        />
      </div>

      <SettingsModal
        open={openSection === 'license'}
        title={t('system.activation_title')}
        description={t('system.activation_description')}
        onClose={() => setOpenSection(null)}
        width={820}
      >
        <div className="rounded-md border border-border bg-secondary/30 p-3">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck size={16} className="text-muted-foreground" />
            <div className="text-[13px] font-medium">{t('common.license')}</div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              className={cn(
                'text-[13px] font-medium',
                licenseStatus === t('common.active')
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-destructive',
              )}
            >
              {licenseStatus}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-10 px-3 text-[13px]"
              type="button"
              onClick={fetchSystemInfo}
            >
              {t('common.refresh', { defaultValue: 'Обновить' })}
            </Button>
          </div>

          {activeFeatures.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {activeFeatures.map((f) => (
                <span
                  key={f}
                  className="rounded-sm border border-border bg-background px-2 py-0.5 text-[13px]"
                >
                  {f}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-3 rounded-md border border-dashed border-border p-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <Upload size={20} className="text-muted-foreground" />
            <Input
              type="file"
              accept=".key"
              onChange={(e) => setLicenseFile(e.target.files ? e.target.files[0] : null)}
            />
            <div className="text-[13px] text-muted-foreground">
              {licenseFile ? licenseFile.name : t('auth.click_upload')}
            </div>
            <Button
              className="h-10 px-3 text-[13px]"
              type="button"
              onClick={handleLicenseUpload}
              disabled={!licenseFile}
            >
              {t('auth.activate_btn')}
            </Button>
          </div>
        </div>
      </SettingsModal>

      <SettingsModal
        open={openSection === 'requisites'}
        title={t('system.clinic_title')}
        description={t('system.clinic_description')}
        onClose={() => setOpenSection(null)}
        width={900}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              Логотип (для чека)
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
              <div className="mt-2 flex items-center gap-2">
                <img
                  src={printSettings.logoDataUrl}
                  alt="logo-preview"
                  className="h-11 rounded-md border border-border bg-background p-1 object-contain"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 px-3 text-[13px]"
                  type="button"
                  onClick={() => setLocalPrintSettings((p) => ({ ...p, logoDataUrl: '' }))}
                >
                  Удалить логотип
                </Button>
              </div>
            ) : null}
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              Название клиники
            </label>
            <Input
              value={printSettings.clinicName}
              onChange={(e) => setLocalPrintSettings((p) => ({ ...p, clinicName: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              Телефон
            </label>
            <Input
              value={printSettings.clinicPhone}
              onChange={(e) =>
                setLocalPrintSettings((p) => ({ ...p, clinicPhone: e.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              Адрес
            </label>
            <Input
              value={printSettings.clinicAddress}
              onChange={(e) =>
                setLocalPrintSettings((p) => ({ ...p, clinicAddress: e.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              Примечание внизу
            </label>
            <Input
              value={printSettings.footerNote}
              onChange={(e) => setLocalPrintSettings((p) => ({ ...p, footerNote: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              Текст под QR
            </label>
            <Input
              placeholder={t('system.telegram_placeholder')}
              value={printSettings.underQrText}
              onChange={(e) =>
                setLocalPrintSettings((p) => ({ ...p, underQrText: e.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              QR ссылка (опционально)
            </label>
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="https://..."
                value={printSettings.qrUrl}
                onChange={(e) => setLocalPrintSettings((p) => ({ ...p, qrUrl: e.target.value }))}
              />
              <Button
                variant="secondary"
                size="sm"
                className="h-10 px-3 text-[13px]"
                type="button"
                onClick={async () => {
                  if (!printSettings.qrUrl) {
                    showToast('Сначала укажите QR ссылку', 'warning');
                    return;
                  }
                  const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(printSettings.qrUrl)}`;
                  const res = await fetch(url);
                  const blob = await res.blob();
                  const reader = new FileReader();
                  reader.onload = () => {
                    const dataUrl = String(reader.result || '');
                    setLocalPrintSettings((p) => ({ ...p, qrImageDataUrl: dataUrl }));
                    showToast('QR сохранён', 'success');
                  };
                  reader.readAsDataURL(blob);
                }}
              >
                Сгенерировать QR
              </Button>
            </div>

            {printSettings.qrImageDataUrl ? (
              <div className="mt-2 flex items-center gap-2">
                <img
                  src={printSettings.qrImageDataUrl}
                  alt="qr-preview"
                  className="h-[88px] w-[88px] rounded-md border border-border bg-background"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 px-3 text-[13px]"
                  type="button"
                  onClick={() => setLocalPrintSettings((p) => ({ ...p, qrImageDataUrl: '' }))}
                >
                  Удалить QR
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            className="h-10 px-3 text-[13px]"
            type="button"
            onClick={async () => {
              try {
                await setPrintSettings(printSettings);
                showToast(t('common.saved') || 'Сохранено', 'success');
              } catch (e) {
                showToast(t('common.error') || 'Ошибка сохранения', 'error');
              }
            }}
          >
            {t('common.save') || 'Сохранить'}
          </Button>
          <Button
            variant="secondary"
            className="h-10 px-3 text-[13px]"
            type="button"
            onClick={async () => {
              try {
                const settings = await getPrintSettings();
                setLocalPrintSettings(settings);
              } catch (e) {
                console.error('Failed to load print settings:', e);
              }
            }}
          >
            {t('common.reset') || 'Сбросить'}
          </Button>
        </div>
      </SettingsModal>

      <SettingsModal
        open={openSection === 'printer'}
        title={t('system.printer_title')}
        description={t('system.printer_description')}
        onClose={() => setOpenSection(null)}
        width={900}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              Название принтера (для интерфейса)
            </label>
            <Input
              placeholder={t('system.printer_placeholder')}
              value={printSettings.preferredPrinterName}
              onChange={(e) =>
                setLocalPrintSettings((p) => ({ ...p, preferredPrinterName: e.target.value }))
              }
            />
          </div>

          <div className="md:col-span-2 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="h-10 px-3 text-[13px]"
              type="button"
              onClick={async () => {
                const api: any = (window as any).medx;
                if (!api?.listPrinters) {
                  showToast('Список принтеров доступен только в Electron', 'warning');
                  return;
                }
                const list = await api.listPrinters();
                setPrinters(Array.isArray(list) ? list : []);
                setShowPrinters(true);
              }}
            >
              Показать список принтеров
            </Button>
            <div className="text-[13px] text-muted-foreground">
              Выберите <code>deviceName</code> для silent‑печати
            </div>
          </div>

          <div className="md:col-span-2 text-[13px] text-muted-foreground">
            Текущий <code>deviceName</code>:{' '}
            <span className="font-medium text-foreground">
              {printSettings.preferredPrinterDeviceName || 'не выбран'}
            </span>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              Размер бумаги
            </label>
            <select
              className="h-10 w-full rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              value={printSettings.paperSize}
              onChange={(e) =>
                setLocalPrintSettings((p) => ({ ...p, paperSize: e.target.value as any }))
              }
            >
              <option value="58">58 мм</option>
              <option value="80">80 мм</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              Масштаб печати (%)
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
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              Режим silent‑печати
            </label>
            <select
              className="h-10 w-full rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              value={printSettings.silentPrintMode || 'html'}
              onChange={(e) =>
                setLocalPrintSettings((p) => ({ ...p, silentPrintMode: e.target.value as any }))
              }
            >
              <option value="html">HTML</option>
              <option value="image">Картинка (совместимость)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="autoPrint"
              className="h-4 w-4 accent-primary"
              type="checkbox"
              checked={printSettings.autoPrint}
              onChange={(e) =>
                setLocalPrintSettings((p) => ({ ...p, autoPrint: e.target.checked }))
              }
            />
            <label htmlFor="autoPrint" className="text-[13px]">
              Автопечать после оплаты (silent)
            </label>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            className="h-10 px-3 text-[13px]"
            type="button"
            onClick={async () => {
              try {
                await setPrintSettings(printSettings);
                showToast(t('common.saved') || 'Сохранено', 'success');
              } catch (e) {
                showToast(t('common.error') || 'Ошибка сохранения', 'error');
              }
            }}
          >
            {t('common.save') || 'Сохранить'}
          </Button>
          <Button
            variant="secondary"
            className="h-10 px-3 text-[13px]"
            type="button"
            onClick={async () => {
              try {
                const settings = await getPrintSettings();
                setLocalPrintSettings(settings);
              } catch (e) {
                console.error('Failed to load print settings:', e);
              }
            }}
          >
            {t('common.reset') || 'Сбросить'}
          </Button>
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <SettingHistory
            settingKey="print_config"
            onRollback={() => {
              showToast('Откат выполнен', 'success');
            }}
          />
        </div>
      </SettingsModal>

      <SettingsModal
        open={openSection === 'receipt'}
        title={t('system.receipt_title')}
        description={t('system.receipt_description')}
        onClose={() => setOpenSection(null)}
        width={980}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              Шаблон чека
            </label>
            <select
              className="h-12 w-full rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              value={printSettings.receiptTemplateId}
              onChange={(e) =>
                setLocalPrintSettings((p) => ({ ...p, receiptTemplateId: e.target.value as any }))
              }
            >
              <option value="check-6">check-6 (таблица)</option>
              <option value="check-1">check-1 (рамка)</option>
              <option value="check-4-58">check-4 58 (блок очереди)</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              Ширина чека
            </label>
            <select
              className="h-12 w-full rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              value={printSettings.receiptWidthMode || 'standard'}
              onChange={(e) =>
                setLocalPrintSettings((p) => ({ ...p, receiptWidthMode: e.target.value as any }))
              }
            >
              <option value="standard">Стандарт (58/80мм)</option>
              <option value="safe">Безопасная (если обрезает)</option>
            </select>
          </div>

          <div className="md:col-span-2 grid gap-2">
            <label className="text-[13px] font-medium text-muted-foreground">Поля чека</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  className="h-4 w-4 accent-primary"
                  type="checkbox"
                  checked={printSettings.showLogo !== false}
                  onChange={(e) =>
                    setLocalPrintSettings((p) => ({ ...p, showLogo: e.target.checked }))
                  }
                />
                <span>Показывать логотип</span>
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  className="h-4 w-4 accent-primary"
                  type="checkbox"
                  checked={printSettings.showClinicName !== false}
                  onChange={(e) =>
                    setLocalPrintSettings((p) => ({ ...p, showClinicName: e.target.checked }))
                  }
                />
                <span>Показывать название клиники</span>
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  className="h-4 w-4 accent-primary"
                  type="checkbox"
                  checked={printSettings.showClinicAddress !== false}
                  onChange={(e) =>
                    setLocalPrintSettings((p) => ({ ...p, showClinicAddress: e.target.checked }))
                  }
                />
                <span>Показывать адрес</span>
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  className="h-4 w-4 accent-primary"
                  type="checkbox"
                  checked={printSettings.showClinicPhone !== false}
                  onChange={(e) =>
                    setLocalPrintSettings((p) => ({ ...p, showClinicPhone: e.target.checked }))
                  }
                />
                <span>Показывать телефон</span>
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  className="h-4 w-4 accent-primary"
                  type="checkbox"
                  checked={printSettings.showDateTime !== false}
                  onChange={(e) =>
                    setLocalPrintSettings((p) => ({ ...p, showDateTime: e.target.checked }))
                  }
                />
                <span>Показывать дату/время</span>
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  className="h-4 w-4 accent-primary"
                  type="checkbox"
                  checked={printSettings.showPatientName !== false}
                  onChange={(e) =>
                    setLocalPrintSettings((p) => ({ ...p, showPatientName: e.target.checked }))
                  }
                />
                <span>Показывать пациента</span>
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  className="h-4 w-4 accent-primary"
                  type="checkbox"
                  checked={printSettings.showQueue !== false}
                  onChange={(e) =>
                    setLocalPrintSettings((p) => ({ ...p, showQueue: e.target.checked }))
                  }
                />
                <span>Показывать номер очереди</span>
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  className="h-4 w-4 accent-primary"
                  type="checkbox"
                  checked={printSettings.showDoctor !== false}
                  onChange={(e) =>
                    setLocalPrintSettings((p) => ({ ...p, showDoctor: e.target.checked }))
                  }
                />
                <span>Показывать врача</span>
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  className="h-4 w-4 accent-primary"
                  type="checkbox"
                  checked={printSettings.showDoctorRoom !== false}
                  onChange={(e) =>
                    setLocalPrintSettings((p) => ({ ...p, showDoctorRoom: e.target.checked }))
                  }
                />
                <span>Показывать кабинет врача</span>
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  className="h-4 w-4 accent-primary"
                  type="checkbox"
                  checked={printSettings.showServices !== false}
                  onChange={(e) =>
                    setLocalPrintSettings((p) => ({ ...p, showServices: e.target.checked }))
                  }
                />
                <span>Показывать услуги</span>
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  className="h-4 w-4 accent-primary"
                  type="checkbox"
                  checked={printSettings.showTotalAmount !== false}
                  onChange={(e) =>
                    setLocalPrintSettings((p) => ({ ...p, showTotalAmount: e.target.checked }))
                  }
                />
                <span>Показывать итого сумму</span>
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  className="h-4 w-4 accent-primary"
                  type="checkbox"
                  checked={printSettings.showPaymentType !== false}
                  onChange={(e) =>
                    setLocalPrintSettings((p) => ({ ...p, showPaymentType: e.target.checked }))
                  }
                />
                <span>Показывать тип оплаты</span>
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  className="h-4 w-4 accent-primary"
                  type="checkbox"
                  checked={printSettings.showQr !== false}
                  onChange={(e) => setLocalPrintSettings((p) => ({ ...p, showQr: e.target.checked }))}
                />
                <span>Показывать QR</span>
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  className="h-4 w-4 accent-primary"
                  type="checkbox"
                  checked={printSettings.showUnderQrText !== false}
                  onChange={(e) =>
                    setLocalPrintSettings((p) => ({ ...p, showUnderQrText: e.target.checked }))
                  }
                />
                <span>Показывать текст под QR</span>
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  className="h-4 w-4 accent-primary"
                  type="checkbox"
                  checked={printSettings.showFooterNote !== false}
                  onChange={(e) =>
                    setLocalPrintSettings((p) => ({ ...p, showFooterNote: e.target.checked }))
                  }
                />
                <span>Показывать нижнюю подпись</span>
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  className="h-4 w-4 accent-primary"
                  type="checkbox"
                  checked={Boolean(printSettings.boldAllText)}
                  onChange={(e) =>
                    setLocalPrintSettings((p) => ({ ...p, boldAllText: e.target.checked }))
                  }
                />
                <span>Жирный шрифт (весь чек)</span>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-md border border-border bg-secondary/30 p-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => {
                const w = openPrintWindow();
                const now = new Date().toISOString();
                printReceipt(
                  {
                    receiptNo: 'AA-000156',
                    ticket: 'A-021',
                    createdAtIso: now,
                    patientName: "Rahmonov Ulug'bek",
                    doctorName: 'Shuxrat Holmatovich',
                    doctorRoom: '3',
                    serviceName: 'Vrach qabuli',
                    amount: 75000,
                    currency: "so'm",
                    paymentMethod: 'CASH',
                  },
                  { ...printSettings, autoPrint: false },
                  w,
                );
              }}
            >
              Предпросмотр
            </Button>

            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={async () => {
                const api: any = (window as any).medx;
                if (!api?.printHtml) {
                  showToast('Тест доступен только в Electron', 'warning');
                  return;
                }
                if (!printSettings.preferredPrinterDeviceName) {
                  showToast('Сначала выберите deviceName принтера', 'warning');
                  return;
                }
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
                    currency: "so'm",
                    paymentMethod: 'CASH',
                  },
                  { ...printSettings, autoPrint: true },
                );
                try {
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
                  if (res?.ok) showToast('Отправлено в печать', 'success');
                } catch (e: any) {
                  setLastSilentPrint({ ok: false, failureReason: String(e?.message || e) });
                  showToast(`Ошибка печати: ${String(e?.message || e)}`, 'error');
                }
              }}
            >
              Тест silent‑печати
            </Button>

            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={async () => {
                const api: any = (window as any).medx;
                if (!api?.printHtml) {
                  showToast('Доступно только в Electron', 'warning');
                  return;
                }
                if (!printSettings.preferredPrinterDeviceName) {
                  showToast('Сначала выберите deviceName принтера', 'warning');
                  return;
                }
                const now = new Date().toISOString();
                const html = buildReceiptHtml(
                  {
                    receiptNo: 'TEST-DIALOG',
                    ticket: 'T-002',
                    createdAtIso: now,
                    patientName: 'Test Patient',
                    doctorName: 'Test Doctor',
                    doctorRoom: '7',
                    serviceName: 'Test Service',
                    amount: 12345,
                    currency: "so'm",
                    paymentMethod: 'CASH',
                  },
                  { ...printSettings, autoPrint: false },
                );
                try {
                  const res = await api.printHtml({
                    html,
                    deviceName: printSettings.preferredPrinterDeviceName,
                    silent: false,
                    paperSize: printSettings.paperSize,
                    scaleFactor: Number.isFinite(Number(printSettings.silentScalePercent))
                      ? Number(printSettings.silentScalePercent)
                      : 100,
                    mode: printSettings.silentPrintMode || 'html',
                  });
                  setLastSilentPrint(res);
                } catch (e: any) {
                  setLastSilentPrint({ ok: false, failureReason: String(e?.message || e) });
                }
              }}
            >
              Тест с диалогом
            </Button>

            {lastSilentPrint ? (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(JSON.stringify(lastSilentPrint, null, 2));
                    showToast('Debug скопирован', 'success');
                  } catch {
                    showToast('Не удалось скопировать debug', 'error');
                  }
                }}
              >
                Скопировать debug
              </Button>
            ) : null}
          </div>

          {lastSilentPrint ? (
            <div className="mt-3 space-y-1 text-[13px] text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">Результат:</span>{' '}
                {String(lastSilentPrint?.ok)}
              </div>
              {lastSilentPrint?.failureReason ? (
                <div>
                  <span className="font-medium text-foreground">failureReason:</span>{' '}
                  {String(lastSilentPrint.failureReason)}
                </div>
              ) : null}
              {lastSilentPrint?.debug ? (
                <div className="break-words">
                  <span className="font-medium text-foreground">debug:</span>{' '}
                  <code>{JSON.stringify(lastSilentPrint.debug)}</code>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={async () => {
              try {
                await setPrintSettings(printSettings);
                showToast(t('common.saved') || 'Сохранено', 'success');
              } catch (e) {
                showToast(t('common.error') || 'Ошибка сохранения', 'error');
              }
            }}
          >
            {t('common.save') || 'Сохранить'}
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={async () => {
              try {
                const settings = await getPrintSettings();
                setLocalPrintSettings(settings);
              } catch (e) {
                console.error('Failed to load print settings:', e);
              }
            }}
          >
            {t('common.reset') || 'Сбросить'}
          </Button>
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <SettingHistory
            settingKey="print_config"
            onRollback={() => {
              showToast('Откат выполнен', 'success');
            }}
          />
        </div>
      </SettingsModal>

      <SettingsModal
        open={openSection === 'users'}
        title={t('system.users_title')}
        description={t('system.users_description')}
        onClose={() => {
          setOpenSection(null);
          setUsersPage(0);
        }}
        width={980}
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <Button variant="secondary" size="sm" type="button" onClick={fetchUsers}>
            Обновить список
          </Button>
          <Button size="sm" type="button" onClick={() => setShowUserModal(true)}>
            <UserPlus size={16} /> {t('common.add', { defaultValue: 'Добавить' })}
          </Button>
        </div>

        <div className="overflow-hidden rounded-md border border-border bg-card">
          <table className="w-full text-[13px]">
            <thead className="bg-secondary text-[13px] text-muted-foreground">
              <tr className="h-12 [&>th]:px-2.5 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                <th className="w-[80px]">ID</th>
                <th>Username</th>
                <th>Full Name</th>
                <th className="w-[140px]">Role</th>
                <th className="w-[120px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="[&>tr]:border-t [&>tr]:border-border">
              {users
                .slice(usersPage * usersPageSize, usersPage * usersPageSize + usersPageSize)
                .map((user) => (
                  <tr key={user.id} className="h-12 [&>td]:px-2.5 [&>td]:py-2">
                    <td className="text-muted-foreground">{user.id}</td>
                    <td className="font-medium">{user.username}</td>
                    <td>{user.full_name}</td>
                    <td>
                      <span className="inline-flex items-center rounded-sm border border-border bg-secondary px-2 py-0.5 text-[13px]">
                        {user.role}
                      </span>
                    </td>
                    <td className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        title={t('system.delete_user')}
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {users.length > usersPageSize ? (
          <div className="mt-3 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setUsersPage((p) => Math.max(0, p - 1))}
              disabled={usersPage === 0}
            >
              {t('common.prev', { defaultValue: 'Назад' })}
            </Button>
            <div className="text-[13px] text-muted-foreground">
              {usersPage + 1} / {Math.max(1, Math.ceil(users.length / usersPageSize))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() =>
                setUsersPage((p) => Math.min(Math.ceil(users.length / usersPageSize) - 1, p + 1))
              }
              disabled={usersPage >= Math.ceil(users.length / usersPageSize) - 1}
            >
              {t('common.next', { defaultValue: 'Вперёд' })}
            </Button>
          </div>
        ) : null}
      </SettingsModal>

      {showPrinters && (
        <Modal
          open={true}
          title={t('system.printers_title')}
          description={t('system.printers_description')}
          onClose={() => {
            setShowPrinters(false);
            setPrintersPage(0);
          }}
          width={920}
        >
          <div className="grid gap-2">
            {printers.length === 0 ? (
              <div className="text-[13px] text-muted-foreground">Список пуст</div>
            ) : (
              printers
                .slice(
                  printersPage * printersPageSize,
                  printersPage * printersPageSize + printersPageSize,
                )
                .map((p) => (
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
                      setShowPrinters(false);
                      setPrintersPage(0);
                      showToast(`Выбран принтер: ${p.displayName || p.name}`, 'success');
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate text-left">
                      {p.displayName || p.name}
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      {p.isDefault ? 'Default' : ''}
                    </span>
                  </Button>
                ))
            )}
          </div>

          {printers.length > printersPageSize ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setPrintersPage((p) => Math.max(0, p - 1))}
                disabled={printersPage === 0}
              >
                {t('common.prev', { defaultValue: 'Назад' })}
              </Button>
              <div className="text-[13px] text-muted-foreground">
                {printersPage + 1} / {Math.max(1, Math.ceil(printers.length / printersPageSize))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() =>
                  setPrintersPage((p) =>
                    Math.min(Math.ceil(printers.length / printersPageSize) - 1, p + 1),
                  )
                }
                disabled={printersPage >= Math.ceil(printers.length / printersPageSize) - 1}
              >
                {t('common.next', { defaultValue: 'Вперёд' })}
              </Button>
            </div>
          ) : null}

          <div className="mt-3 text-[13px] text-muted-foreground">
            Это выбирает <code>deviceName</code> для silent‑печати в Electron.
          </div>
        </Modal>
      )}

      {/* Create User Modal */}
      {showUserModal && (
        <Modal
          open={true}
          title={t('system.create_user', { defaultValue: 'Создать пользователя' })}
          description={t('system.create_user_desc', {
            defaultValue: 'Логин, пароль и роль доступа.',
          })}
          onClose={() => setShowUserModal(false)}
          width={560}
        >
          <form onSubmit={handleCreateUser} className="grid gap-3">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
                Username
              </label>
              <Input
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
                Password
              </label>
              <Input
                required
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
                Full Name
              </label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
                Role
              </label>
              <select
                className="h-12 w-full rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              >
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
                <option value="doctor">Doctor</option>
                <option value="receptionist">Receptionist</option>
                <option value="cashier">Cashier</option>
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setShowUserModal(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button size="sm" type="submit">
                {t('common.create', { defaultValue: 'Создать' })}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Updates Modal */}
      {openSection === 'updates' && (
        <SettingsModal
          open={true}
          title={t('system.updates')}
          description={t('system.updates_desc')}
          onClose={() => setOpenSection(null)}
          width={820}
        >
          <div className="rounded-md border border-border bg-secondary/30 p-3">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="text-[13px] font-medium">{t('system.current_version')}</div>
              <div className="text-[13px] font-medium text-foreground">{version}</div>
            </div>

            {checkingUpdates ? (
              <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <RefreshCw size={16} className="animate-spin" />
                {t('system.checking_updates')}
              </div>
            ) : updateInfo ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[13px] font-medium">{t('system.latest_version')}</div>
                  <div
                    className={cn(
                      'text-[13px] font-medium',
                      updateInfo.update_available ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {updateInfo.latest_version}
                  </div>
                </div>

                {updateInfo.release_notes && (
                  <div className="rounded-md border border-border bg-background p-2">
                    <div className="text-[13px] text-muted-foreground">
                      {updateInfo.release_notes}
                    </div>
                  </div>
                )}

                {updateInfo.update_available ? (
                  <div className="rounded-md border-2 border-primary bg-primary/10 p-3">
                    <div className="mb-2 text-[13px] font-medium text-primary">
                      {t('system.update_available')}: {updateInfo.latest_version}
                    </div>
                    {!updateInfo.download_url && (
                      <div className="text-[13px] text-muted-foreground">
                        {t('system.update_url_not_configured')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-md border border-border bg-background p-3">
                    <div className="text-[13px] font-medium text-muted-foreground">
                      {t('system.update_not_available')}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={checkForUpdates}
                disabled={checkingUpdates}
              >
                <RefreshCw size={14} className={checkingUpdates ? 'animate-spin' : ''} />{' '}
                {t('system.check_updates')}
              </Button>
              {updateInfo?.update_available && updateInfo.download_url ? (
                <Button
                  variant="default"
                  size="sm"
                  type="button"
                  onClick={() => {
                    showToast('Update installation will be implemented', 'info');
                  }}
                >
                  <Download size={14} /> {t('system.install_update')}
                </Button>
              ) : null}
            </div>
          </div>
        </SettingsModal>
      )}
    </div>
  );
}
