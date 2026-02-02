import { useCallback, useEffect, useState } from 'react';
import client from '../../../api/client';
import type { QueueItem, QueueStatus } from '../../../types/reception';

function todayKeyUtc() {
    return new Date().toISOString().slice(0, 10);
}

function isSameLocalDay(iso: string, today: Date) {
    const d = new Date(iso);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}

export function useQueue() {
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [dayKey, setDayKey] = useState<string>(() => todayKeyUtc());

    const refresh = useCallback(async () => {
        const res = await client.get('/reception/queue');
        const list = Array.isArray(res.data) ? res.data : [];
        const today = new Date();
        const filtered = list.filter((q: any) => q?.created_at && isSameLocalDay(String(q.created_at), today));
        filtered.sort((a: any, b: any) => {
            const ta = new Date(String(a.created_at)).getTime();
            const tb = new Date(String(b.created_at)).getTime();
            if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return tb - ta;
            return Number(b.id || 0) - Number(a.id || 0);
        });
        setQueue(filtered);
    }, []);

    const updateStatus = useCallback(
        async (id: number, status: QueueStatus) => {
            await client.patch(`/reception/queue/${id}`, { status });
            await refresh();
        },
        [refresh]
    );

    // Day rollover: if day changed while app is open, clear and refetch today's queue.
    useEffect(() => {
        const tmr = setInterval(() => {
            const key = todayKeyUtc();
            setDayKey((prev) => (prev === key ? prev : key));
        }, 30_000);
        return () => clearInterval(tmr);
    }, []);

    useEffect(() => {
        setQueue([]);
        refresh();
    }, [dayKey, refresh]);

    return { queue, refresh, updateStatus };
}

