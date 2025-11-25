'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';

const OWNER_NAV_ITEMS: Array<{ href: string; label: string }> = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/customers', label: 'Kunder' },
  { href: '/courses', label: 'Kurs' },
  { href: '/templates', label: 'Maler' },
];

const CUSTOMER_NAV_ITEMS: Array<{ href: string; label: string }> = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/customer-courses', label: 'Kurs' },
  { href: '/customer-users', label: 'Brukere' },
];

export const Sidebar = () => {
  const pathname = usePathname();
  const { isSystemOwner, isCustomerAdmin } = useAuth();

  const navItems = isSystemOwner
    ? OWNER_NAV_ITEMS
    : isCustomerAdmin
      ? CUSTOMER_NAV_ITEMS
      : [];

  return (
    <aside className="w-64 border-r border-slate-200 bg-white">
      <nav className="space-y-1 p-4">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        {!navItems.length && (
          <p className="text-sm text-slate-500">Ingen navigasjon tilgjengelig.</p>
        )}
      </nav>
    </aside>
  );
};

