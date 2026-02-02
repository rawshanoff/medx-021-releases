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
      // Create a more noticeable beep sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Play two beeps for better noticeability
      [800, 1000].forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = freq; // Hz
        oscillator.type = 'sine';

        const startTime = audioContext.currentTime + index * 0.2;
        gainNode.gain.setValueAtTime(0.4, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);

        oscillator.start(startTime);
        oscillator.stop(startTime + 0.4);
      });
    } catch (e) {
      console.warn('Could not play notification sound', e);
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5 p-8 overflow-hidden">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-3">
          {t('reception.queue')}
        </h1>
        <div className="text-2xl md:text-3xl text-muted-foreground">
          {new Date().toLocaleDateString('ru-RU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>

      {currentTicket ? (
        <div className="flex flex-col items-center justify-center space-y-10 flex-1">
          {/* Main Ticket Display - Extra Large for TV */}
          <div className="rounded-3xl border-4 border-primary bg-card p-16 shadow-2xl animate-pulse-slow">
            <div className="text-center mb-8">
              <div className="text-3xl md:text-4xl text-muted-foreground mb-3 font-semibold">
                {currentTicket.doctor_name || t('reception.select_doctor')}
              </div>
              <div className="text-2xl md:text-3xl text-muted-foreground">
                {currentTicket.patient_name}
              </div>
            </div>

            <div className="text-center">
              <div className="text-lg md:text-xl text-muted-foreground mb-6 uppercase tracking-widest font-medium">
                {t('reception.ticket')}
              </div>
              {/* Extra large numbers for TV visibility */}
              <div className="text-[180px] md:text-[240px] font-black text-primary leading-none tracking-tighter drop-shadow-lg">
                {currentTicket.ticket_number}
              </div>
            </div>
          </div>

          {/* Status Indicator */}
          <div className="text-center">
            <div className="inline-flex items-center gap-3 rounded-full bg-primary/20 px-8 py-4 border-2 border-primary/30">
              <div className="h-4 w-4 animate-pulse rounded-full bg-primary"></div>
              <span className="text-2xl md:text-3xl font-semibold text-primary">
                {t('reception.waiting')}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center flex-1 flex flex-col justify-center">
          <div className="text-7xl md:text-8xl font-bold text-muted-foreground mb-6">
            {t('reception.no_queue_today')}
          </div>
          <div className="text-3xl md:text-4xl text-muted-foreground">
            {t('reception.waiting_for_patients')}
          </div>
        </div>
      )}

      {/* Queue list (smaller, at the bottom) */}
      {queue.length > 0 && (
        <div className="mt-8 w-full max-w-6xl">
          <div className="mb-4 text-center text-2xl md:text-3xl font-semibold text-foreground">
            {t('reception.current_queue')}
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {queue
              .filter((q) => q.status === 'WAITING')
              .slice(0, 16)
              .map((item) => (
                <div
                  key={item.id}
                  className={`rounded-xl border-2 p-4 text-center transition-all duration-300 ${
                    item.id === currentTicket?.id
                      ? 'border-primary bg-primary/20 scale-110 shadow-lg ring-4 ring-primary/30'
                      : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  <div className="text-3xl md:text-4xl font-bold text-foreground">
                    {item.ticket_number}
                  </div>
                  <div className="mt-2 text-sm md:text-base text-muted-foreground truncate">
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
