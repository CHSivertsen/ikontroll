'use client';

import { useEffect } from 'react';

import ConsumerNavbar from '@/components/consumer/ConsumerNavbar';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function ConsumerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, firebaseUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !firebaseUser) {
      router.push('/login');
    }
  }, [loading, firebaseUser, router]);

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
      <ConsumerNavbar />
      <main className="mx-auto max-w-5xl p-4 md:p-8">{children}</main>
    </div>
  );
}
