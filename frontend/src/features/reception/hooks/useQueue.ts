import { useCallback, useState } from 'react';
import client from '../../../api/client';
import type { QueueItem, QueueStatus } from '../../../types/reception';

export function useQueue(range: 'shift' | 'today' | '2days') {
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const refresh = useCallback(async () => {
    const res = await client.get('/reception/queue', { params: { range } });
    const list = Array.isArray(res.data) ? res.data : [];
    const filtered = list.filter((q: any) => q?.created_at);
    filtered.sort((a: any, b: any) => {
      const ta = new Date(String(a.created_at)).getTime();
      const tb = new Date(String(b.created_at)).getTime();
      if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return tb - ta;
      return Number(b.id || 0) - Number(a.id || 0);
    });
    setQueue(filtered);
  }, [range]);

  const updateStatus = useCallback(
    async (id: number, status: QueueStatus) => {
      await client.patch(`/reception/queue/${id}`, { status });
      await refresh();
    },
    [refresh],
  );

  return { queue, refresh, updateStatus };
}
