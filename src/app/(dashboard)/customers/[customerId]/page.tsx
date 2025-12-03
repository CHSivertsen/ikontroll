'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  arrayRemove,
  arrayUnion,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import { useAuth } from '@/context/AuthContext';
import { useCustomer } from '@/hooks/useCustomer';
import { useCourses } from '@/hooks/useCourses';
import { db } from '@/lib/firebase';
import type { Customer } from '@/types/customer';

import CompanyUsersManager from './CompanyUsersManager';

export default function CustomerDetailsPage() {
  const params = useParams<{ customerId: string }>();
  const customerId = params?.customerId;
  const { companyId } = useAuth();

  const { customer, loading, error } = useCustomer(
    companyId ?? null,
    customerId ?? null,
  );

  if (!companyId) {
    return (
      <section className="space-y-4">
        <Link
          href="/customers"
          className="text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          ← Tilbake til kunder
        </Link>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Velg et selskap før du administrerer kunder.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <Link
        href="/customers"
        className="inline-flex items-center text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        ← Tilbake til kunder
      </Link>
      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          Laster kunde …
        </div>
      )}
      {!loading && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
          {error}
        </div>
      )}
      {!loading && customer && companyId && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-1">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Kunde
              </p>
              <h1 className="text-3xl font-semibold text-slate-900">
                {customer.companyName}
              </h1>
              <p className="text-sm text-slate-500">
                {customer.address}, {customer.zipno} {customer.place}
              </p>
            </div>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Org.nr">{customer.vatNumber}</Info>
              <Info label="Status">
                {customer.status === 'active' ? 'Aktiv' : 'Inaktiv'}
              </Info>
              <Info label="Underenheter">
                {customer.allowSubunits
                  ? 'Kan legge til egne underenheter'
                  : 'Kan ikke legge til underenheter'}
              </Info>
              <Info label="Kontakt">
                <div className="space-y-1 text-sm text-slate-600">
                  <p className="font-medium">{customer.contactPerson}</p>
                  <p>{customer.contactEmail}</p>
                  <p>{customer.contactPhone}</p>
                </div>
              </Info>
            </dl>
          </div>

          <CourseAssignmentsCard companyId={companyId ?? customer.createdByCompanyId} customer={customer} />

          <CompanyUsersManager
            ownerCompanyId={customer.createdByCompanyId}
            customerId={customer.id}
            customerName={customer.companyName}
          />
        </>
      )}
    </section>
  );
}

const Info = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
      {label}
    </p>
    <div className="mt-2 text-sm text-slate-900">{children}</div>
  </div>
);

const CourseAssignmentsCard = ({
  companyId,
  customer,
}: {
  companyId: string;
  customer: Customer;
}) => {
  const { courses, loading, error } = useCourses(companyId);
  const [updatingCourseId, setUpdatingCourseId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  const assignedCourseIds = new Set(customer.courseIds ?? []);

  const toggleCourse = async (courseId: string, nextValue: boolean) => {
    try {
      setAssignError(null);
      setUpdatingCourseId(courseId);
      await updateDoc(doc(db, 'customers', customer.id), {
        courseIds: nextValue ? arrayUnion(courseId) : arrayRemove(courseId),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to update course access', err);
      setAssignError(
        err instanceof Error
          ? err.message
          : 'Kunne ikke oppdatere kurstilgang.',
      );
    } finally {
      setUpdatingCourseId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Kurs
        </p>
        <p className="text-base text-slate-600">
          Velg hvilke kurs denne kunden skal ha tilgang til.
        </p>
      </div>

      {assignError && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
          {assignError}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {loading && <p className="text-sm text-slate-500">Laster kurs …</p>}
        {!loading && error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        {!loading && !error && courses.length === 0 && (
          <p className="text-sm text-slate-500">
            Det er ingen kurs tilgjengelig for denne systemeieren ennå.
          </p>
        )}
        {!loading &&
          !error &&
          courses.map((course) => {
            const courseTitle =
              typeof course.title === 'object'
                ? course.title.no ?? course.title.en ?? 'Uten tittel'
                : course.title ?? 'Uten tittel';
            const isChecked = assignedCourseIds.has(course.id);
            const busy = updatingCourseId === course.id;
            return (
              <label
                key={course.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 hover:bg-slate-50"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {courseTitle}
                  </p>
                  <p className="text-xs text-slate-500">{course.status}</p>
                </div>
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={busy}
                  onChange={(event) =>
                    toggleCourse(course.id, event.target.checked)
                  }
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                />
              </label>
            );
          })}
      </div>
    </div>
  );
};

