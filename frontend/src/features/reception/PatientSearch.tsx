import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { formatDobInput, normalizeHumanName } from '../../utils/text';

export function PatientSearch({
    phone,
    setPhone,
    name,
    setName,
    surname,
    setSurname,
    dob,
    setDob,
    phoneRef,
    nameRef,
    surnameRef,
    dobRef,
    createBtnRef,
    canCreate,
    onCreate,
    onFocusFirstResult,
}: {
    phone: string;
    setPhone: (v: string) => void;
    name: string;
    setName: (v: string) => void;
    surname: string;
    setSurname: (v: string) => void;
    dob: string;
    setDob: (v: string) => void;
    phoneRef: React.RefObject<HTMLInputElement>;
    nameRef: React.RefObject<HTMLInputElement>;
    surnameRef: React.RefObject<HTMLInputElement>;
    dobRef: React.RefObject<HTMLInputElement>;
    createBtnRef: React.RefObject<HTMLButtonElement>;
    canCreate: boolean;
    onCreate: () => void;
    onFocusFirstResult: () => void;
}) {
    const { t } = useTranslation();

    return (
        <div className="rounded-md border border-border bg-card p-3">
            <div className="grid grid-cols-2 items-end gap-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
                <div>
                    <label className="mb-1 block text-[12px] text-muted-foreground">{t('reception.phone')}</label>
                    <Input
                        ref={phoneRef}
                        placeholder="+998..."
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                onFocusFirstResult();
                                return;
                            }
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
                        onBlur={() => setName((v) => normalizeHumanName(v))}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                onFocusFirstResult();
                                return;
                            }
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
                        onBlur={() => setSurname((v) => normalizeHumanName(v))}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                onFocusFirstResult();
                                return;
                            }
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
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                onFocusFirstResult();
                                return;
                            }
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                createBtnRef.current?.click();
                            }
                        }}
                    />
                </div>

                <Button
                    ref={createBtnRef}
                    onClick={onCreate}
                    variant="default"
                    size="icon"
                    title={t('reception.create_new')}
                    disabled={!canCreate}
                    type="button"
                >
                    <Plus size={16} />
                </Button>
            </div>
        </div>
    );
}

