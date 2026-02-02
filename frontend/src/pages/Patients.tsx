import { useEffect, useRef, useState } from 'react';
import client from '../api/client';
import { Plus, X, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { dobUiToIso, formatDobInput, normalizeHumanName } from '../utils/text';
import { Modal } from '../components/ui/modal';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useToast } from '../context/ToastContext';
import type { PatientWithBalance } from '../types/patients';
import type { PatientFile } from '../types/files';

export default function Patients() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [patients, setPatients] = useState<PatientWithBalance[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState<PatientWithBalance | null>(null);
    const [isFilesOpen, setIsFilesOpen] = useState(false);

    // Search state (same geometry as Reception)
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [surname, setSurname] = useState('');
    const [dob, setDob] = useState('');
    const phoneRef = useRef<HTMLInputElement | null>(null);
    const nameRef = useRef<HTMLInputElement | null>(null);
    const surnameRef = useRef<HTMLInputElement | null>(null);
    const dobRef = useRef<HTMLInputElement | null>(null);
    const createBtnRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchPatients();
        }, 350);
        return () => clearTimeout(timer);
    }, [phone, name, surname, dob]);

    const fetchPatients = async () => {
        setLoading(true);
        try {
            const full_name = normalizeHumanName((name + ' ' + surname).trim());
            const birth_date = dobUiToIso(dob) || undefined;
            const res = await client.get('/patients/', {
                params: {
                    phone: phone || undefined,
                    full_name: full_name || undefined,
                    birth_date,
                },
            });
            setPatients(res.data);
        } catch (error) {
            console.error("Failed to fetch patients", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePatient = async () => {
        if (!name || !surname || !phone) {
            showToast(t('patients.fill_required', { defaultValue: 'Заполните ФИО и телефон' }), 'warning');
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
            fetchPatients();
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

    return (
        <div className="flex h-full flex-col gap-3">
            <h1 className="text-xl font-medium">{t('patients.title')}</h1>

                <div className="min-h-0 flex flex-1 flex-col gap-3 overflow-hidden">
                    {/* Search */}
                    <div className="rounded-md border border-border bg-card p-2">
                        <div className="grid grid-cols-2 items-end gap-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
                            <div>
                                <label className="mb-1 block text-[12px] text-muted-foreground">{t('reception.phone')}</label>
                                <Input
                                    ref={phoneRef}
                                    placeholder="+998..."
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="h-8 text-xs"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            nameRef.current?.focus();
                                        }
                                    }}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-[12px] text-muted-foreground">{t('reception.first_name')}</label>
                                <Input
                                    ref={nameRef}
                                    placeholder={t('reception.sample_first_name')}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="h-8 text-xs"
                                    onBlur={() => setName((v) => normalizeHumanName(v))}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            surnameRef.current?.focus();
                                        }
                                    }}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-[12px] text-muted-foreground">{t('reception.last_name')}</label>
                                <Input
                                    ref={surnameRef}
                                    placeholder={t('reception.sample_last_name')}
                                    value={surname}
                                    onChange={(e) => setSurname(e.target.value)}
                                    className="h-8 text-xs"
                                    onBlur={() => setSurname((v) => normalizeHumanName(v))}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            dobRef.current?.focus();
                                        }
                                    }}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-[12px] text-muted-foreground">{t('reception.dob')}</label>
                                <Input
                                    ref={dobRef}
                                    inputMode="numeric"
                                    placeholder={t('reception.date_format')}
                                    value={dob}
                                    onChange={(e) => setDob(formatDobInput(e.target.value))}
                                    className="h-8 text-xs"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            createBtnRef.current?.click();
                                        }
                                    }}
                                />
                            </div>
                            <Button
                                ref={createBtnRef}
                                onClick={handleCreatePatient}
                                variant="default"
                                size="icon"
                                title={t('patients.new_patient', { defaultValue: 'Новый пациент' })}
                                disabled={!phone || !name || !surname}
                                type="button"
                                className="h-8 w-8 text-xs"
                            >
                                <Plus size={14} />
                            </Button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-card">
                        <div className="h-full overflow-auto">
                            <table className="w-full text-[13px]">
                                <thead className="sticky top-0 z-10 bg-secondary text-[12px] text-muted-foreground">
                                    <tr className="h-9 [&>th]:p-2 [&>th]:text-left [&>th]:font-medium">
                                        <th className="w-[110px]">{t('patients.id')}</th>
                                        <th>{t('reception.first_name')}</th>
                                        <th>{t('reception.last_name')}</th>
                                        <th>{t('reception.phone')}</th>
                                        <th className="w-[200px] text-right">{t('common.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="[&>tr]:border-t [&>tr]:border-border">
                                    {loading ? (
                                        <tr className="h-9">
                                            <td colSpan={5} className="p-2 text-[12px] text-muted-foreground">
                                                {t('common.loading')}
                                            </td>
                                        </tr>
                                    ) : null}
                                    {patients.map((patient) => (
                                        <PatientRow
                                            key={patient.id}
                                            patient={patient}
                                            formatID={formatID}
                                            formatPhone={formatPhone}
                                            onUpdate={fetchPatients}
                                            onFiles={() => {
                                                setSelectedPatient(patient);
                                                setIsFilesOpen(true);
                                            }}
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
}: {
    patient: PatientWithBalance;
    formatID: (n: number) => string;
    formatPhone: (s: string) => string;
    onUpdate: () => void;
    onFiles: () => void;
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
            showToast(t('patients.update_failed', { defaultValue: 'Не удалось обновить пациента' }), 'error');
        }
    };

    return (
        <tr className="h-8">
            <td className="p-2 font-mono text-[12px] text-muted-foreground">{formatID(patient.id)}</td>

            <td className="p-2">
                {isEditing ? <Input className="h-8 text-xs" value={editName} onChange={(e) => setEditName(e.target.value)} /> : editName}
            </td>
            <td className="p-2">
                {isEditing ? <Input className="h-8 text-xs" value={editSurname} onChange={(e) => setEditSurname(e.target.value)} /> : editSurname}
            </td>
            <td className="p-2">
                {isEditing ? <Input className="h-8 text-xs" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} /> : formatPhone(patient.phone)}
            </td>

            <td className="p-2 text-right">
                {isEditing ? (
                    <div className="flex justify-end gap-2">
                        <Button onClick={handleSave} size="icon" type="button" title={t('common.save', { defaultValue: 'Сохранить' })} className="h-8 w-8 text-xs">
                            <Check size={14} />
                        </Button>
                        <Button onClick={() => setIsEditing(false)} variant="secondary" size="icon" type="button" title={t('common.cancel')} className="h-8 w-8 text-xs">
                            <X size={14} />
                        </Button>
                    </div>
                ) : (
                    <div className="flex justify-end gap-2">
                        <Button onClick={() => setIsEditing(true)} variant="ghost" size="sm" type="button" className="h-8 text-xs">
                            {t('common.edit')}
                        </Button>
                        <Button onClick={onFiles} variant="ghost" size="sm" type="button" className="h-8 text-xs">
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
            showToast(t('patients.sent_to_telegram', { defaultValue: 'Отправлено в Telegram' }), 'success');
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
                    <label className="mb-1 block text-[12px] text-muted-foreground">{t('common.type', { defaultValue: 'Тип' })}</label>
                    <select
                        className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        value={fileType}
                        onChange={(e) => setFileType(e.target.value)}
                    >
                        <option value="analysis">{t('patients.file_type_analysis', { defaultValue: 'Анализы' })}</option>
                        <option value="uzd">{t('patients.file_type_ultrasound', { defaultValue: 'УЗИ' })}</option>
                        <option value="other">{t('patients.file_type_other', { defaultValue: 'Другое' })}</option>
                    </select>
                </div>
                <div>
                    <label className="mb-1 block text-[12px] text-muted-foreground">{t('patients.file', { defaultValue: 'Файл' })}</label>
                    <Input className="h-8 text-xs" type="file" onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)} />
                </div>
                <Button type="button" onClick={handleUpload} disabled={!uploadFile || busy} className="h-8 text-xs">
                    {t('common.save', { defaultValue: 'Сохранить' })}
                </Button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" type="button" onClick={handleGenerateLinkCode} disabled={busy} className="h-8 text-xs">
                    {t('patients.telegram_link_code', { defaultValue: 'Код привязки Telegram' })}
                </Button>
                {linkCode ? (
                    <div className="font-mono text-[12px] text-muted-foreground">
                        {t('patients.code', { defaultValue: 'Код' })}: <span className="font-semibold text-foreground">{linkCode}</span>
                    </div>
                ) : null}
            </div>

            <div className="mt-3 overflow-hidden rounded-md border border-border">
                <table className="w-full text-[13px]">
                    <thead className="bg-secondary text-[12px] text-muted-foreground">
                        <tr className="h-9 [&>th]:p-2 [&>th]:text-left [&>th]:font-medium">
                            <th>{t('patients.file_name', { defaultValue: 'Имя' })}</th>
                            <th className="w-[140px]">{t('common.type', { defaultValue: 'Тип' })}</th>
                            <th className="w-[120px]">{t('patients.size', { defaultValue: 'Размер' })}</th>
                            <th className="w-[240px] text-right">{t('common.actions', { defaultValue: 'Действия' })}</th>
                        </tr>
                    </thead>
                    <tbody className="[&>tr]:border-t [&>tr]:border-border">
                        {files.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-2 text-[12px] text-muted-foreground">
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
                                            <Button variant="ghost" size="sm" type="button" onClick={() => handleDownload(f.id, f.original_filename)} disabled={busy} className="h-8 text-xs">
                                                {t('patients.download', { defaultValue: 'Скачать' })}
                                            </Button>
                                            <Button variant="secondary" size="sm" type="button" onClick={() => handleSendTelegram(f.id)} disabled={busy} className="h-8 text-xs">
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
                    <Button variant="ghost" size="sm" type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="h-8 text-xs">
                        {t('common.prev', { defaultValue: 'Назад' })}
                    </Button>
                    <div className="text-[12px] text-muted-foreground">
                        {page + 1} / {totalPages}
                    </div>
                    <Button variant="ghost" size="sm" type="button" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="h-8 text-xs">
                        {t('common.next', { defaultValue: 'Вперёд' })}
                    </Button>
                </div>
            ) : null}
        </Modal>
    );
}
