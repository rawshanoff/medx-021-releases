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
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            localStorage.setItem('token', res.data.access_token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            navigate('/');
        } catch (err: any) {
            console.error('Login error:', err);
            showToast(err.response?.data?.detail || t('auth.login_failed'), 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_circle_at_10%_-10%,color-mix(in_srgb,hsl(var(--primary))_10%,transparent)_0%,transparent_58%),radial-gradient(700px_circle_at_92%_8%,color-mix(in_srgb,hsl(var(--primary))_8%,transparent)_0%,transparent_60%)]" />

            <div className="absolute right-4 top-4 flex items-center gap-2">
                <LanguageSwitcher />
                <ThemeToggle />
            </div>

            <div className="relative w-full max-w-sm rounded-md border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 text-center">
                    <div className="text-[18px] font-medium tracking-tight text-foreground">
                        MedX <span className="text-primary">Pro</span>
                    </div>
                    <div className="mt-1 text-[12px] text-muted-foreground">{t('auth.welcome')}</div>
                </div>

                <form onSubmit={handleLogin} className="space-y-3">
                    <div className="space-y-1">
                        <label className="text-[12px] font-medium text-foreground">{t('auth.username')}</label>
                        <div className="relative">
                            <UserIcon size={16} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder={t('auth.username_placeholder')}
                                className="pl-8"
                                autoFocus
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[12px] font-medium text-foreground">{t('auth.password')}</label>
                        <div className="relative">
                            <Lock size={16} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t('auth.password_placeholder')}
                                className="pl-8"
                                required
                            />
                        </div>
                    </div>

                    <Button type="submit" disabled={loading} className={cn("w-full", loading ? "opacity-80" : "")}>
                        {loading ? t('common.loading') : t('auth.login')}
                    </Button>
                </form>
            </div>
        </div>
    );
}
