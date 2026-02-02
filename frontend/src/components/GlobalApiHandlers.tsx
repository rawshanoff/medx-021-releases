import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';

type LoadingEventDetail = { delta?: number };
type LogoutEventDetail = { reason?: string };
type ApiErrorDetail = { message?: string };

export default function GlobalApiHandlers() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const onLoading = (event: Event) => {
      const detail = (event as CustomEvent<LoadingEventDetail>).detail;
      const delta = detail?.delta ?? 0;
      setPendingCount((prev) => Math.max(0, prev + delta));
    };

    const onLogout = (event: Event) => {
      const detail = (event as CustomEvent<LogoutEventDetail>).detail;
      const reason = detail?.reason;
      const message =
        reason === 'expired'
          ? t('auth.session_expired')
          : t('auth.reauth_required');
      showToast(message, 'warning');
      navigate('/login', { replace: true });
    };

    const onApiError = (event: Event) => {
      const detail = (event as CustomEvent<ApiErrorDetail>).detail;
      if (detail?.message) {
        showToast(detail.message, 'error');
      }
    };

    window.addEventListener('api:loading', onLoading);
    window.addEventListener('auth:logout', onLogout);
    window.addEventListener('api:error', onApiError);

    return () => {
      window.removeEventListener('api:loading', onLoading);
      window.removeEventListener('auth:logout', onLogout);
      window.removeEventListener('api:error', onApiError);
    };
  }, [navigate, showToast]);

  if (pendingCount <= 0) return null;

  return (
    <div className="fixed right-4 top-4 z-[9999] rounded-md border border-border bg-card px-3 py-2 text-[13px] text-foreground shadow-sm">
      {t('common.loading')}
    </div>
  );
}
