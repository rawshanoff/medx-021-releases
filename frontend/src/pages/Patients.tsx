import { useEffect, useMemo, useRef, useState } from 'react';
import client from '../api/client';
import { X, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { dobUiToIso, normalizeHumanName } from '../utils/text';
import { Modal } from '../components/ui/modal';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { useToast } from '../context/ToastContext';
import { PatientSearch } from '../features/reception/PatientSearch';
import { usePatientsSearch } from '../features/reception/hooks/usePatients';
import type { PatientWithBalance } from '../types/patients';
import type { PatientFile } from '../types/files';

export default function Patients() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [selectedPatient, setSelectedPatient] = useState<PatientWithBalance | null>(null);
  const [isFilesOpen, setIsFilesOpen] = useState(false);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);

  // Search state (same geometry as Reception)
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [dob, setDob] = useState('');
  const phoneRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const surnameRef = useRef<HTMLInputElement>(null);
  const dobRef = useRef<HTMLInputElement>(null);
  const createBtnRef = useRef<HTMLButtonElement>(null);
  const filesBtnRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const {
    patients,
    loading,
    refresh: refreshPatients,
  } = usePatientsSearch<PatientWithBalance>({
    phone,
    name,
    surname,
    dob,
    debounceMs: 350,
  });

  const handleCreatePatient = async () => {
    if (!name || !surname || !phone) {
      showToast(
        t('patients.fill_required', { defaultValue: 'Заполните ФИО и телефон' }),
        'warning',
      );
      return;
    }
    const fullName = normalizeHumanName(`${name} ${surname}`);

    try {
      await client.post('/patients/', {
        full_name: fullName,
        phone,
        birth_date: dobUiToIso(dob) || null,
      });
      // keep fields to continue registering quickly, but clear list refresh
      await refreshPatients();
    } catch (error) {
      showToast(t('patients.create_failed', { defaultValue: 'Ошибка создания пациента' }), 'error');
    }
  };

  // Helper formatters
  const formatID = (id: number) => (100000 + id).toString();
  const formatPhone = (p: string) => {
    // Simple formatter for +998 90 123-45-67 if matches
    // Assumes input is clean or basic
    // For MVP just standardizing display if starts with +998...
    return p;
  };

  const hasSearch = useMemo(() => {
    return Boolean(
      String(phone || '').trim() ||
      String(name || '').trim() ||
      String(surname || '').trim() ||
      String(dob || '').trim(),
    );
  }, [dob, name, phone, surname]);

  const focusRow = (idx: number) => {
    if (idx < 0 || idx >= patients.length) return;
    setFocusedRowIndex(idx);
    const btn = filesBtnRefs.current[idx];
    if (btn) {
      btn.focus();
      btn.scrollIntoView({ block: 'nearest' });
    }
  };

  useEffect(() => {
    // keep refs array in sync (no state updates here)
    filesBtnRefs.current = filesBtnRefs.current.slice(0, patients.length);
  }, [patients.length]);

  // Derive effective focus without setState-in-effect.
  const effectiveFocusedRowIndex =
    focusedRowIndex == null
      ? null
      : patients.length === 0
        ? null
        : Math.min(focusedRowIndex, patients.length - 1);

  return (
    <div className="flex h-full flex-col gap-3">
      <h1 className="text-xl font-medium">{t('patients.title')}</h1>

      <div className="min-h-0 flex flex-1 flex-col gap-3 overflow-hidden">
        {/* Search */}
        <PatientSearch
          phone={phone}
          setPhone={setPhone}
          name={name}
          setName={setName}
          surname={surname}
          setSurname={setSurname}
          dob={dob}
          setDob={setDob}
          phoneRef={phoneRef}
          nameRef={nameRef}
          surnameRef={surnameRef}
          dobRef={dobRef}
          createBtnRef={createBtnRef}
          canCreate={Boolean(phone && name && surname)}
          onCreate={handleCreatePatient}
          onFocusFirstResult={() => {
            if (patients.length > 0) focusRow(0);
          }}
        />

        {/* Table */}
        <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-card">
          <div className="h-full overflow-auto">
            <table className="w-full text-[14px]">
              <thead className="sticky top-0 z-10 bg-secondary text-[13px] text-muted-foreground">
                <tr className="h-10 [&>th]:px-3 [&>th]:py-2.5 [&>th]:text-left [&>th]:font-medium">
                  <th className="w-[110px]">{t('patients.id')}</th>
                  <th>{t('reception.first_name')}</th>
                  <th>{t('reception.last_name')}</th>
                  <th>{t('reception.phone')}</th>
                  <th className="w-[200px] text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="[&>tr]:border-t [&>tr]:border-border">
                {loading ? (
                  <>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <tr key={`sk-${i}`} className="[&>td]:px-3 [&>td]:py-3">
                        <td colSpan={5}>
                          <Skeleton className="h-6 w-full" />
                        </td>
                      </tr>
                    ))}
                  </>
                ) : null}

                {!loading && patients.length === 0 && hasSearch ? (
                  <tr>
                    <td colSpan={5} className="p-5 text-center text-muted-foreground">
                      {t('reception.no_results')}
                    </td>
                  </tr>
                ) : null}

                {!loading && patients.length === 0 && !hasSearch ? (
                  <tr>
                    <td colSpan={5} className="p-5 text-center text-muted-foreground">
                      {t('reception.search_placeholder')}
                    </td>
                  </tr>
                ) : null}
                {patients.map((patient, idx) => (
                  <PatientRow
                    key={patient.id}
                    patient={patient}
                    formatID={formatID}
                    formatPhone={formatPhone}
                    onUpdate={refreshPatients}
                    onFiles={() => {
                      setSelectedPatient(patient);
                      setIsFilesOpen(true);
                    }}
                    registerFilesBtnRef={(el) => {
                      filesBtnRefs.current[idx] = el;
                    }}
                    onNavigate={(dir) => {
                      focusRow(idx + dir);
                    }}
                    isFocused={effectiveFocusedRowIndex === idx}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {isFilesOpen && selectedPatient ? (
          <FilesModal
            patient={selectedPatient}
            onClose={() => {
              setIsFilesOpen(false);
              setSelectedPatient(null);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function PatientRow({
  patient,
  formatID,
  formatPhone,
  onUpdate,
  onFiles,
  registerFilesBtnRef,
  onNavigate,
  isFocused,
}: {
  patient: PatientWithBalance;
  formatID: (n: number) => string;
  formatPhone: (s: string) => string;
  onUpdate: () => void;
  onFiles: () => void;
  registerFilesBtnRef: (el: HTMLButtonElement | null) => void;
  onNavigate: (dir: -1 | 1) => void;
  isFocused: boolean;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const [namePart, ...rest] = patient.full_name.split(' ');
  const surnamePart = rest.join(' ');

  const [editName, setEditName] = useState(namePart || '');
  const [editSurname, setEditSurname] = useState(surnamePart || '');
  const [editPhone, setEditPhone] = useState(patient.phone);

  const handleSave = async () => {
    try {
      await client.put(`/patients/${patient.id}`, {
        full_name: normalizeHumanName(`${editName} ${editSurname}`),
        phone: editPhone,
      });
      setIsEditing(false);
      onUpdate();
    } catch (e) {
      showToast(
        t('patients.update_failed', { defaultValue: 'Не удалось обновить пациента' }),
        'error',
      );
    }
  };

  return (
    <tr className={isFocused ? 'h-10 bg-muted/40' : 'h-10'}>
      <td className="p-3 font-mono text-[13px] text-muted-foreground">{formatID(patient.id)}</td>

      <td className="p-3">
        {isEditing ? (
          <Input
            className="h-10 text-[13px]"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
        ) : (
          editName
        )}
      </td>
      <td className="p-3">
        {isEditing ? (
          <Input
            className="h-10 text-[13px]"
            value={editSurname}
            onChange={(e) => setEditSurname(e.target.value)}
          />
        ) : (
          editSurname
        )}
      </td>
      <td className="p-3">
        {isEditing ? (
          <Input
            className="h-10 text-[13px]"
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
          />
        ) : (
          formatPhone(patient.phone)
        )}
      </td>

      <td className="p-3 text-right">
        {isEditing ? (
          <div className="flex justify-end gap-2">
            <Button
              onClick={handleSave}
              size="icon"
              type="button"
              title={t('common.save', { defaultValue: 'Сохранить' })}
              className="h-10 w-10"
            >
              <Check size={14} />
            </Button>
            <Button
              onClick={() => setIsEditing(false)}
              variant="secondary"
              size="icon"
              type="button"
              title={t('common.cancel')}
              className="h-10 w-10"
            >
              <X size={14} />
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setIsEditing(true)}
              variant="ghost"
              size="sm"
              type="button"
              className="h-10 px-3 text-[13px]"
            >
              {t('common.edit')}
            </Button>
            <Button
              onClick={onFiles}
              variant="ghost"
              size="sm"
              type="button"
              className="h-10 px-3 text-[13px]"
              ref={registerFilesBtnRef}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  onNavigate(1);
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  onNavigate(-1);
                }
              }}
            >
              {t('patients.files', { defaultValue: 'Файлы' })}
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

function FilesModal({ patient, onClose }: { patient: PatientWithBalance; onClose: () => void }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [files, setFiles] = useState<PatientFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [fileType, setFileType] = useState('analysis');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);

  const fetchFiles = async () => {
    try {
      const res = await client.get(`/files/patient/${patient.id}`);
      setFiles(res.data);
    } catch {
      // handled globally
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [patient.id]);

  const handleUpload = async () => {
    if (!uploadFile) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('patient_id', String(patient.id));
      fd.append('file_type', fileType);
      fd.append('file', uploadFile);
      await client.post('/files/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadFile(null);
      await fetchFiles();
    } finally {
      setBusy(false);
    }
  };

  const handleSendTelegram = async (fileId: number) => {
    setBusy(true);
    try {
      await client.post(`/files/${fileId}/send/telegram`);
      showToast(
        t('patients.sent_to_telegram', { defaultValue: 'Отправлено в Telegram' }),
        'success',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async (fileId: number, filename: string) => {
    setBusy(true);
    try {
      const res = await client.get(`/files/${fileId}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateLinkCode = async () => {
    setBusy(true);
    try {
      const res = await client.post(`/files/patient/${patient.id}/telegram/link-code`);
      setLinkCode(res.data.code);
    } finally {
      setBusy(false);
    }
  };

  const [page, setPage] = useState(0);
  const pageSize = 6;
  const totalPages = Math.max(1, Math.ceil(files.length / pageSize));

  return (
    <Modal
      open={true}
      title={t('patients.files_title', { defaultValue: 'Файлы пациента' })}
      description={patient.full_name}
      onClose={onClose}
      width={920}
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_2fr_auto] md:items-end">
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
            {t('common.type', { defaultValue: 'Тип' })}
          </label>
          <select
            className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            value={fileType}
            onChange={(e) => setFileType(e.target.value)}
          >
            <option value="analysis">
              {t('patients.file_type_analysis', { defaultValue: 'Анализы' })}
            </option>
            <option value="uzd">
              {t('patients.file_type_ultrasound', { defaultValue: 'УЗИ' })}
            </option>
            <option value="other">
              {t('patients.file_type_other', { defaultValue: 'Другое' })}
            </option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
            {t('patients.file', { defaultValue: 'Файл' })}
          </label>
          <Input
            className="h-8 text-[13px]"
            type="file"
            onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
          />
        </div>
        <Button
          type="button"
          onClick={handleUpload}
          disabled={!uploadFile || busy}
          className="h-8 text-[13px]"
        >
          {t('common.save', { defaultValue: 'Сохранить' })}
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={handleGenerateLinkCode}
          disabled={busy}
          className="h-8 text-[13px]"
        >
          {t('patients.telegram_link_code', { defaultValue: 'Код привязки Telegram' })}
        </Button>
        {linkCode ? (
          <div className="font-mono text-[13px] text-muted-foreground">
            {t('patients.code', { defaultValue: 'Код' })}:{' '}
            <span className="font-semibold text-foreground">{linkCode}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-3 overflow-hidden rounded-md border border-border">
        <table className="w-full text-[13px]">
          <thead className="bg-secondary text-[13px] text-muted-foreground">
            <tr className="h-9 [&>th]:p-2 [&>th]:text-left [&>th]:font-medium">
              <th>{t('patients.file_name', { defaultValue: 'Имя' })}</th>
              <th className="w-[140px]">{t('common.type', { defaultValue: 'Тип' })}</th>
              <th className="w-[120px]">{t('patients.size', { defaultValue: 'Размер' })}</th>
              <th className="w-[240px] text-right">
                {t('common.actions', { defaultValue: 'Действия' })}
              </th>
            </tr>
          </thead>
          <tbody className="[&>tr]:border-t [&>tr]:border-border">
            {files.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-2 text-[13px] text-muted-foreground">
                  {t('patients.no_files', { defaultValue: 'Нет файлов' })}
                </td>
              </tr>
            ) : (
              files.slice(page * pageSize, page * pageSize + pageSize).map((f) => (
                <tr key={f.id} className="h-8 [&>td]:p-2">
                  <td className="truncate">{f.original_filename}</td>
                  <td>{f.file_type}</td>
                  <td>{Math.round(f.size / 1024)} KB</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => handleDownload(f.id, f.original_filename)}
                        disabled={busy}
                        className="h-8 text-[13px]"
                      >
                        {t('patients.download', { defaultValue: 'Скачать' })}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        onClick={() => handleSendTelegram(f.id)}
                        disabled={busy}
                        className="h-8 text-[13px]"
                      >
                        {t('patients.send_telegram', { defaultValue: 'В Telegram' })}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {files.length > pageSize ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="h-8 text-[13px]"
          >
            {t('common.prev', { defaultValue: 'Назад' })}
          </Button>
          <div className="text-[13px] text-muted-foreground">
            {page + 1} / {totalPages}
          </div>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="h-8 text-[13px]"
          >
            {t('common.next', { defaultValue: 'Вперёд' })}
          </Button>
        </div>
      ) : null}
    </Modal>
  );
}
