'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { usePathname } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';
import { useCustomer } from '@/hooks/useCustomer';

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

const SUBUNIT_NAV_ITEM = { href: '/customer-subunits', label: 'Underenheter' };

export const Sidebar = () => {
  const pathname = usePathname();
  const { isSystemOwner, isCustomerAdmin, activeCustomerId } = useAuth();
  const shouldLoadCustomer = isCustomerAdmin ? activeCustomerId ?? null : null;
  const { customer: activeCustomer } = useCustomer(null, shouldLoadCustomer);

  const customerNavItems = useMemo(() => {
    if (!isCustomerAdmin) {
      return [];
    }
    if (activeCustomer?.allowSubunits) {
      return [
        CUSTOMER_NAV_ITEMS[0],
        SUBUNIT_NAV_ITEM,
        ...CUSTOMER_NAV_ITEMS.slice(1),
      ];
    }
    return CUSTOMER_NAV_ITEMS;
  }, [isCustomerAdmin, activeCustomer?.allowSubunits]);

  const navItems = isSystemOwner ? OWNER_NAV_ITEMS : customerNavItems;

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

