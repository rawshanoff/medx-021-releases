import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueue } from '../features/reception/hooks/useQueue';
import type { QueueItem } from '../types/reception';

export default function QueueTV() {
  const { t } = useTranslation();
  const { queue, refresh } = useQueue();
  const [currentTicket, setCurrentTicket] = useState<QueueItem | null>(null);
  const [previousTicketId, setPreviousTicketId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Auto-refresh every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Find the first WAITING ticket
  useEffect(() => {
    const waiting = queue.find((q) => q.status === 'WAITING');
    if (waiting) {
      setCurrentTicket(waiting);

      // Play sound if this is a new ticket
      if (previousTicketId !== null && waiting.id !== previousTicketId) {
        playNotificationSound();
      }
      setPreviousTicketId(waiting.id);
    } else {
      setCurrentTicket(null);
    }
  }, [queue, previousTicketId]);

  const playNotificationSound = () => {
    try {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800; // Hz
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.warn('Could not play notification sound', e);
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5 p-8">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-foreground mb-2">
          {t('reception.queue', { defaultValue: 'Очередь' })}
        </h1>
        <div className="text-xl text-muted-foreground">
          {new Date().toLocaleDateString('ru-RU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>

      {currentTicket ? (
        <div className="flex flex-col items-center justify-center space-y-8">
          <div className="rounded-2xl border-4 border-primary bg-card p-12 shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-2xl text-muted-foreground mb-2">
                {currentTicket.doctor_name ||
                  t('reception.select_doctor', { defaultValue: 'Врач' })}
              </div>
              <div className="text-lg text-muted-foreground">{currentTicket.patient_name}</div>
            </div>

            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-4 uppercase tracking-wider">
                {t('reception.ticket', { defaultValue: 'Талон' })}
              </div>
              <div className="text-[120px] font-black text-primary leading-none tracking-tighter">
                {currentTicket.ticket_number}
              </div>
            </div>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/20 px-6 py-3">
              <div className="h-3 w-3 animate-pulse rounded-full bg-primary"></div>
              <span className="text-lg font-medium text-primary">
                {t('reception.waiting', { defaultValue: 'Ожидание' })}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <div className="text-6xl font-bold text-muted-foreground mb-4">
            {t('reception.no_queue_today', { defaultValue: 'Очередь пустая' })}
          </div>
          <div className="text-xl text-muted-foreground">
            {t('reception.waiting_for_patients', { defaultValue: 'Ожидание пациентов...' })}
          </div>
        </div>
      )}

      {/* Queue list (smaller, at the bottom) */}
      {queue.length > 0 && (
        <div className="mt-12 w-full max-w-4xl">
          <div className="mb-4 text-center text-lg font-medium text-foreground">
            {t('reception.current_queue', { defaultValue: 'Текущая очередь' })}
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
            {queue
              .filter((q) => q.status === 'WAITING')
              .slice(0, 12)
              .map((item) => (
                <div
                  key={item.id}
                  className={`rounded-lg border-2 p-4 text-center transition-all ${
                    item.id === currentTicket?.id
                      ? 'border-primary bg-primary/10 scale-105'
                      : 'border-border bg-card'
                  }`}
                >
                  <div className="text-2xl font-bold text-foreground">{item.ticket_number}</div>
                  <div className="mt-1 text-xs text-muted-foreground truncate">
                    {item.patient_name}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
