import { NavLink } from 'react-router-dom';
import { CreditCard, FileText, LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen, Settings, Stethoscope, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { clearAuth, getUser, getUserRole, hasAnyRole } from '../utils/auth';
import { Button } from './ui/button';
import { cn } from '../lib/cn';

export default function Sidebar({ collapsed, onToggleCollapsed }: { collapsed: boolean; onToggleCollapsed: () => void }) {
    const { t } = useTranslation();

    const handleLogout = () => {
        if (confirm(t('nav.logout_confirm'))) {
            clearAuth();
            window.location.reload();
        }
    };

    const role = getUserRole();
    const user = getUser();
    const isAdminOrOwner = hasAnyRole(['admin', 'owner']);

    const navItems = [
        { icon: <LayoutDashboard size={16} />, label: t('nav.dashboard'), path: '/', allow: true },
        // Запись/appointments пока отключаем (по просьбе)
        { icon: <Users size={16} />, label: t('nav.patients'), path: '/patients', allow: hasAnyRole(['admin', 'owner', 'receptionist', 'doctor', 'cashier']) },
        { icon: <CreditCard size={16} />, label: t('nav.finance'), path: '/finance', allow: hasAnyRole(['admin', 'owner', 'cashier']) },
        { icon: <FileText size={16} />, label: t('nav.reports'), path: '/reports', allow: hasAnyRole(['admin', 'owner', 'cashier']) },
        { icon: <Stethoscope size={16} />, label: t('nav.doctors'), path: '/doctors', allow: hasAnyRole(['admin', 'owner', 'receptionist']) },
        { icon: <Settings size={16} />, label: t('nav.system'), path: '/system', allow: isAdminOrOwner },
    ];

    const profileName = user?.full_name?.trim() || user?.username || (role ?? 'MedX');
    const initials = (profileName || 'MX')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join('');

    return (
        <aside
            className={cn(
                "flex h-screen flex-col border-r border-border bg-card",
                "transition-[width] duration-150 ease-out",
                collapsed ? "w-16" : "w-60"
            )}
        >
            <div className="flex items-center justify-between gap-2 border-b border-border p-2">
                <div className="flex min-w-0 items-baseline gap-2" title="MedX Pro">
                    <div className="text-[13px] font-medium text-primary">{collapsed ? "MX" : "MedX"}</div>
                    {!collapsed ? <div className="text-[12px] text-muted-foreground">Pro</div> : null}
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggleCollapsed}
                    title={collapsed ? t('common.expand', { defaultValue: 'Развернуть' }) : t('common.collapse', { defaultValue: 'Свернуть' })}
                    aria-label={collapsed ? t('common.expand_sidebar') : t('common.collapse_sidebar')}
                >
                    {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                </Button>
            </div>

            <nav className="flex-1 overflow-hidden p-2">
                <ul className="flex flex-col gap-1">
                    {navItems.filter(i => i.allow).map((item) => (
                        <li key={item.path}>
                            <NavLink
                                to={item.path}
                                className={({ isActive }) =>
                                    cn(
                                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px]",
                                        "text-muted-foreground hover:bg-secondary hover:text-foreground",
                                        isActive ? "bg-secondary text-foreground" : "",
                                        collapsed ? "justify-center" : ""
                                    )
                                }
                                title={item.label}
                            >
                                {item.icon}
                                {!collapsed ? <span className="truncate">{item.label}</span> : null}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>

            <div className="border-t border-border p-2">
                {role && !collapsed ? (
                    <div className="mb-2 text-[12px] text-muted-foreground">
                        {t('common.role')}: <span className="font-medium text-foreground">{role}</span>
                    </div>
                ) : null}

                <div className={cn("mb-2 flex items-center gap-2 rounded-md border border-border bg-background p-2", collapsed ? "justify-center" : "")} title={profileName}>
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-[12px] font-medium text-primary">
                        {initials || 'MX'}
                    </div>
                    {!collapsed ? (
                        <div className="min-w-0">
                            <div className="truncate text-[13px] font-medium">{profileName}</div>
                            {role ? <div className="truncate text-[12px] text-muted-foreground">{role}</div> : null}
                        </div>
                    ) : null}
                </div>

                <div className={cn("mb-2 flex items-center justify-between gap-1 rounded-md border border-border bg-background p-1", collapsed ? "flex-col" : "")}>
                    <LanguageSwitcher />
                    <ThemeToggle />
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className={cn("w-full justify-start text-destructive hover:bg-secondary", collapsed ? "justify-center" : "")}
                >
                    <LogOut size={16} />
                    {!collapsed ? <span className="ml-2">{t('nav.logout')}</span> : null}
                </Button>
            </div>
        </aside>
    );
}
