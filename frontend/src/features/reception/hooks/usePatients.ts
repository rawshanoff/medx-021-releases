import { useCallback, useEffect, useState } from 'react';
import client from '../../../api/client';
import type { Patient } from '../../../types/reception';
import { dobUiToIso, normalizeHumanName } from '../../../utils/text';

export function usePatientsSearch({
    phone,
    name,
    surname,
    dob,
    debounceMs = 500,
}: {
    phone: string;
    name: string;
    surname: string;
    dob: string;
    debounceMs?: number;
}) {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        const fullName = normalizeHumanName(`${name} ${surname}`.trim());
        const birthDateIso = dobUiToIso(dob) || undefined;

        if (!phone && !fullName && !dob) {
            setPatients([]);
            return;
        }

        setLoading(true);
        try {
            const res = await client.get('/patients/', {
                params: {
                    phone: phone || undefined,
                    full_name: fullName || undefined,
                    birth_date: birthDateIso,
                },
            });
            setPatients(Array.isArray(res.data) ? res.data : []);
        } finally {
            setLoading(false);
        }
    }, [dob, name, phone, surname]);

    const clear = useCallback(() => {
        setPatients([]);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            refresh().catch(() => {
                // Errors are handled globally by GlobalApiHandlers, keep UI stable.
            });
        }, debounceMs);
        return () => clearTimeout(timer);
    }, [debounceMs, refresh]);

    return { patients, loading, refresh, clear };
}

