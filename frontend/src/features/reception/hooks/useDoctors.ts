import { useCallback, useEffect, useState } from 'react';
import client from '../../../api/client';
import type { Doctor } from '../../../types/doctors';

export function useDoctors() {
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const res = await client.get('/doctors/');
            setDoctors(Array.isArray(res.data) ? res.data : []);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { doctors, loading, refresh };
}

