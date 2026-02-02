import { useCallback, useState } from 'react';
import client from '../../../api/client';
import type { QueueItem, QueueStatus } from '../../../types/reception';

function isSameLocalDay(iso: string, today: Date) {
  const d = new Date(iso);
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

export function useQueue() {
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const refresh = useCallback(async () => {
    const res = await client.get('/reception/queue');
    const list = Array.isArray(res.data) ? res.data : [];
    const today = new Date();
    const filtered = list.filter(
      (q: any) => q?.created_at && isSameLocalDay(String(q.created_at), today),
    );
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
    [refresh],
  );

  return { queue, refresh, updateStatus };
}
