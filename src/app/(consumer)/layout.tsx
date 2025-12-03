'use client';

import { useEffect } from 'react';

import ConsumerNavbar from '@/components/consumer/ConsumerNavbar';
import PortalModePrompt from '@/components/PortalModePrompt';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function ConsumerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    loading,
    firebaseUser,
    portalMode,
    needsRoleChoice,
    isCustomerAdmin,
    isSystemOwner,
  } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !firebaseUser) {
      router.push('/login');
    }
  }, [loading, firebaseUser, router]);

  useEffect(() => {
    const hasAdminAccess = isSystemOwner || isCustomerAdmin;
    if (!loading && !needsRoleChoice && portalMode === 'admin' && hasAdminAccess) {
      router.replace('/dashboard');
    }
  }, [isCustomerAdmin, isSystemOwner, loading, needsRoleChoice, portalMode, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        Laster ...
      </div>
    );
  }

  if (!firebaseUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      <PortalModePrompt />
      <ConsumerNavbar />
      <main className="mx-auto max-w-5xl p-4 md:p-8">{children}</main>
    </div>
  );
}
