import { NavLink } from 'react-router-dom';
import {
  Archive,
  CreditCard,
  FileText,
  LayoutDashboard,
  Settings,
  Stethoscope,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { hasAnyRole } from '../utils/auth';
import { cn } from '../lib/cn';

export default function Sidebar() {
  const { t } = useTranslation();

  const isAdminOrOwner = hasAnyRole(['admin', 'owner']);

  const navItems = [
    { icon: <LayoutDashboard size={18} />, label: t('nav.dashboard'), path: '/', allow: true },
    // Appointments page is currently disabled on request.
    {
      icon: <Users size={18} />,
      label: t('nav.patients'),
      path: '/patients',
      allow: hasAnyRole(['admin', 'owner', 'receptionist', 'doctor', 'cashier']),
    },
    {
      icon: <CreditCard size={18} />,
      label: t('nav.finance'),
      path: '/finance',
      allow: hasAnyRole(['admin', 'owner', 'cashier']),
    },
    {
      icon: <FileText size={18} />,
      label: t('nav.reports'),
      path: '/reports',
      allow: hasAnyRole(['admin', 'owner', 'cashier']),
    },
    {
      icon: <Stethoscope size={18} />,
      label: t('nav.doctors'),
      path: '/doctors',
      allow: hasAnyRole(['admin', 'owner', 'receptionist']),
    },
    {
      icon: <Settings size={18} />,
      label: t('nav.system'),
      path: '/system',
      allow: isAdminOrOwner,
    },
    {
      icon: <Archive size={18} />,
      label: t('nav.archive'),
      path: '/archive',
      allow: isAdminOrOwner,
    },
  ];

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-border bg-sidebar text-sidebar-foreground',
        'transition-[width] duration-150 ease-out',
        'w-[72px]',
      )}
    >
      <div className="flex h-14 items-center border-b border-border px-0">
        <div className="h-9 w-9" />
      </div>

      <nav className="flex-1 overflow-auto px-2 py-3">
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {navItems
            .filter((i) => i.allow)
            .map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      // Fixed icon-only sidebar (50px row height)
                      'flex h-[50px] items-center justify-center rounded-xl px-2 text-[14px] font-medium',
                      'text-muted-foreground/90 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                      isActive
                        ? 'bg-sidebar-accent/70 text-sidebar-foreground shadow-[0_0_0_1px_hsl(var(--sidebar-border))]'
                        : '',
                    )
                  }
                  title={item.label}
                >
                  <span className="inline-flex text-sidebar-foreground/90">{item.icon}</span>
                </NavLink>
              </li>
            ))}
        </ul>
      </nav>
    </aside>
  );
}
