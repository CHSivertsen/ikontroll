'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';

import CourseManager from './CourseManager';

export default function CoursesPage() {
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
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Innhold
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Kurs</h1>
        <p className="text-sm text-slate-500">
          Opprett kurs, administrer emner og legg til kontrollspørsmål.
        </p>
      </div>
      <CourseManager />
    </section>
  );
}

