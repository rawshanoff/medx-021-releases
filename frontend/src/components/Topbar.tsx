import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { clearAuth, getUser, getUserRole } from '../utils/auth';
import { Button } from './ui/button';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';

function getInitials(name: string) {
  const initials = (name || 'MX')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return initials || 'MX';
}

export function Topbar() {
  const { t } = useTranslation();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const pathname = location.pathname || '/';
  const routeLabel = useMemo(() => {
    const map: Array<{ prefix: string; label: string }> = [
      { prefix: '/patients', label: t('nav.patients') },
      { prefix: '/finance', label: t('nav.finance') },
      { prefix: '/reports', label: t('nav.reports') },
      { prefix: '/doctors', label: t('nav.doctors') },
      { prefix: '/system', label: t('nav.system') },
      { prefix: '/activation', label: t('nav.activation') },
      { prefix: '/', label: t('nav.dashboard') },
    ];

    const found = map.find((m) => pathname === m.prefix || pathname.startsWith(m.prefix + '/'));
    return found?.label ?? t('nav.dashboard');
  }, [pathname, t]);

  const user = getUser();
  const role = getUserRole();
  const profileName = user?.full_name?.trim() || user?.username || (role ?? 'MedX');
  const initials = getInitials(profileName);

  const handleLogout = () => {
    if (confirm(t('nav.logout_confirm'))) {
      clearAuth();
      window.location.reload();
    }
  };

  useEffect(() => {
    if (!userMenuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserMenuOpen(false);
    };
    const onMouseDown = (e: MouseEvent) => {
      const el = userMenuRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setUserMenuOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [userMenuOpen]);

  return (
    <header className="relative flex h-[55px] items-center justify-between gap-3 border-b border-border bg-background/40 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/30">
      <div className="flex min-w-0 items-center">
        <span className="block h-[18px] w-[200px] truncate px-[38px] text-[14px] text-muted-foreground">
          {routeLabel}
        </span>
      </div>

      <div className="flex w-[220px] items-center justify-start gap-2">
        <LanguageSwitcher />
        <ThemeToggle />

        <div className="h-6 w-px bg-border" />

        <Button
          variant="ghost"
          size="sm"
          className="h-[40px] w-[40px] rounded-full border border-border bg-card/80 p-0 shadow-sm backdrop-blur hover:bg-secondary/70"
          aria-label={t('common.notifications')}
          title={t('common.notifications')}
          type="button"
        >
          <span className="relative">
            <Bell size={18} />
            {/* optional notification dot (kept subtle) */}
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-destructive" />
          </span>
        </Button>

        <div className="h-6 w-px bg-border" />

        {/* Avatar: fixed 40x40, no border to "blend" */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setUserMenuOpen((v) => !v)}
            className={cn(
              'flex h-[40px] w-[40px] items-center justify-center rounded-full bg-secondary/70 shadow-sm',
              'hover:bg-secondary focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-[2px] focus-visible:ring-offset-[hsl(var(--background))]',
            )}
            aria-label={t('common.user_menu', { defaultValue: 'User menu' })}
            title={profileName}
          >
            <span className="text-[13px] font-semibold text-foreground">{initials}</span>
          </button>

          {userMenuOpen ? (
            <div className="absolute right-[52px] top-[52px] z-50 -mx-[50px] h-[80px] w-[150px] rounded-xl border border-border bg-card/90 p-2 shadow-none backdrop-blur">
              <div className="px-2 py-2">
                <div className="truncate text-center text-[14px] font-semibold">{profileName}</div>
                {role ? (
                  <div className="truncate text-center text-[13px] text-muted-foreground">{role}</div>
                ) : null}
              </div>
              <div className="h-px bg-border" />
              <button
                type="button"
                onClick={handleLogout}
                className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-xl px-3 text-[14px] font-medium text-destructive hover:bg-secondary/70"
              >
                <LogOut size={18} />
                <span>{t('nav.logout')}</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

