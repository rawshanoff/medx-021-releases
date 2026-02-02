import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import client from '../api/client';
import { Lock, User as UserIcon } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useToast } from '../context/ToastContext';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { cn } from '../lib/cn';
import { PageContainer } from '../components/PageContainer';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Use URLSearchParams for proper form encoding
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('password', password);

      const res = await client.post('/auth/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('user', JSON.stringify(res.data.user));

      // Redirect based on user role
      const userRole = res.data.user.role?.toLowerCase();
      let redirectPath = '/';

      if (userRole === 'cashier') {
        redirectPath = '/finance';
      } else if (userRole === 'doctor') {
        redirectPath = '/'; // Doctor sees reception queue
      } else if (['admin', 'owner'].includes(userRole)) {
        redirectPath = '/'; // Admin/Owner sees reception dashboard
      } else if (userRole === 'receptionist') {
        redirectPath = '/'; // Receptionist sees reception dashboard
      }

      navigate(redirectPath);
    } catch (err: any) {
      console.error('Login error:', err);
      showToast(err.response?.data?.detail || t('auth.login_failed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_circle_at_10%_-10%,color-mix(in_srgb,hsl(var(--primary))_10%,transparent)_0%,transparent_58%),radial-gradient(700px_circle_at_92%_8%,color-mix(in_srgb,hsl(var(--primary))_8%,transparent)_0%,transparent_60%)]" />

      <div className="absolute right-6 top-6 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <PageContainer className="w-full max-w-[520px]">
        <div className="relative rounded-[16px] border border-border bg-card p-[24px] shadow-[0_12px_40px_rgba(2,8,23,0.12)]">
          <div className="mb-6 text-center">
            <div className="text-2xl font-semibold tracking-tight text-foreground">
              MedX <span className="text-primary">Pro</span>
            </div>
            <div className="mt-2 text-base text-muted-foreground">{t('auth.welcome')}</div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2.5">
              <label className="text-sm font-medium text-muted-foreground">
                {t('auth.username')}
              </label>
              <div className="relative">
                <UserIcon
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('auth.username_placeholder')}
                  className="pl-10"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="text-sm font-medium text-muted-foreground">
                {t('auth.password')}
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.password_placeholder')}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              size="lg"
              className={cn('w-full', loading ? 'opacity-80' : '')}
            >
              {loading ? t('common.loading') : t('auth.login')}
            </Button>
          </form>
        </div>
      </PageContainer>
    </div>
  );
}
