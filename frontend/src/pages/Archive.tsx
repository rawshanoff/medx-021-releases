import { useEffect, useState } from 'react';
import { RefreshCw, RotateCcw, Users, Stethoscope, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/button';
import client from '../api/client';
import type { PatientRead } from '../types/patients';
import type { DoctorAdmin } from '../types/doctors';
import type { UserRead } from '../types/users';

type ArchivedItem = {
  type: 'patient' | 'doctor' | 'user';
  data: PatientRead | DoctorAdmin | UserRead;
};

export default function Archive() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ArchivedItem[]>([]);
  const [activeTab, setActiveTab] = useState<'patients' | 'doctors' | 'users'>('patients');

  const fetchArchived = async () => {
    setLoading(true);
    try {
      const endpoints = {
        patients: '/patients/archived/',
        doctors: '/doctors/archived/',
        users: '/users/archived/',
      };

      const res = await client.get(endpoints[activeTab]);
      const archivedItems: ArchivedItem[] = res.data.map((item: any) => ({
        type: activeTab.slice(0, -1) as 'patient' | 'doctor' | 'user', // remove 's'
        data: item,
      }));

      setItems(archivedItems);
    } catch (e) {
      showToast(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const restoreItem = async (item: ArchivedItem) => {
    try {
      const endpoints = {
        patient: `/patients/${(item.data as PatientRead).id}/restore`,
        doctor: `/doctors/${(item.data as DoctorAdmin).id}/restore`,
        user: `/users/${(item.data as UserRead).id}/restore`,
      };

      await client.post(endpoints[item.type]);
      showToast(t('archive.restored', { defaultValue: 'Восстановлено' }), 'success');
      fetchArchived(); // Refresh list
    } catch (e) {
      showToast(t('common.error'), 'error');
    }
  };

  useEffect(() => {
    fetchArchived();
  }, [activeTab]);

  const getItemName = (item: ArchivedItem) => {
    switch (item.type) {
      case 'patient':
        return (item.data as PatientRead).full_name;
      case 'doctor':
        return (item.data as DoctorAdmin).full_name;
      case 'user':
        return (item.data as UserRead).username;
      default:
        return '';
    }
  };

  const getItemDetails = (item: ArchivedItem) => {
    switch (item.type) {
      case 'patient': {
        const patient = item.data as PatientRead;
        return `${t('reception.phone')}: ${patient.phone}`;
      }
      case 'doctor': {
        const doctor = item.data as DoctorAdmin;
        return `${t('doctors.specialty')}: ${doctor.specialty}`;
      }
      case 'user': {
        const user = item.data as UserRead;
        return `${t('common.role')}: ${user.role}`;
      }
      default:
        return '';
    }
  };

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'patients':
        return <Users size={18} />;
      case 'doctors':
        return <Stethoscope size={18} />;
      case 'users':
        return <UserCheck size={18} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {t('archive.title', { defaultValue: 'Архив' })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('archive.description', { defaultValue: 'Восстановление удалённых записей' })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchArchived}
          disabled={loading}
          className="h-9 px-3"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span className="ml-2">{t('common.refresh')}</span>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['patients', 'doctors', 'users'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {getTabIcon(tab)}
            {t(`archive.tabs.${tab}`, {
              defaultValue:
                tab === 'patients' ? 'Пациенты' : tab === 'doctors' ? 'Врачи' : 'Пользователи',
            })}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            {t('archive.empty', { defaultValue: 'Нет удалённых записей' })}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={`${item.type}-${(item.data as any).id}-${index}`}
                className="flex items-center justify-between rounded-md border border-border bg-card p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground">{getItemName(item)}</div>
                  <div className="text-sm text-muted-foreground">{getItemDetails(item)}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => restoreItem(item)}
                  className="h-9 px-3 ml-4"
                >
                  <RotateCcw size={14} />
                  <span className="ml-2">
                    {t('archive.restore', { defaultValue: 'Восстановить' })}
                  </span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
