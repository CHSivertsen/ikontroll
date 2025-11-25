'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';

export default function TemplatesPage() {
  const { isSystemOwner, isCustomerAdmin, activeCustomerId, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isSystemOwner && isCustomerAdmin && activeCustomerId) {
      router.replace(`/customers/${activeCustomerId}`);
    }
  }, [activeCustomerId, isCustomerAdmin, isSystemOwner, loading, router]);

  if (!isSystemOwner) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Denne siden er kun tilgjengelig for systemeiere.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Bibliotek
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Maler</h1>
        <p className="text-sm text-slate-500">
          Opprett og administrer maler for kurs og kommunikasjon.
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-500">
          Når Firestore-tabellene er klare, vises malene dine her.
        </p>
      </div>
    </section>
  );
}

