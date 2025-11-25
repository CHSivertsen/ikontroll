'use client';

import { useRouter } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';
import { useCustomer } from '@/hooks/useCustomer';
import { useCourses } from '@/hooks/useCourses';

const CourseCard = ({
  title,
  description,
  isAssigned,
}: {
  title: string;
  description: string;
  isAssigned: boolean;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          isAssigned ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
        }`}
      >
        {isAssigned ? 'Tilgang' : 'Ingen tilgang'}
      </span>
    </div>
  </div>
);

export default function CustomerCoursesPage() {
  const { activeCustomerId, isCustomerAdmin, customerMemberships, loading } = useAuth();
  const router = useRouter();

  if (!loading && (!isCustomerAdmin || !activeCustomerId)) {
    router.replace('/dashboard');
  }

  const membership = customerMemberships.find(
    (entry) => entry.customerId === activeCustomerId,
  );

  const { customer } = useCustomer(null, activeCustomerId ?? null);
  const { courses } = useCourses(customer?.createdByCompanyId ?? null);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Kursoversikt
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Tilgjengelige kurs</h1>
        <p className="text-sm text-slate-500">
          Kurs knyttet til{' '}
          <span className="font-semibold text-slate-900">
            {membership?.customerName ?? activeCustomerId ?? ''}
          </span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <CourseCard
            key={course.id}
            title={
              typeof course.title === 'object'
                ? course.title.no ?? course.title.en ?? 'Uten tittel'
                : course.title ?? 'Uten tittel'
            }
            description={
              typeof course.description === 'object'
                ? course.description.no ?? course.description.en ?? ''
                : course.description ?? ''
            }
            isAssigned={(customer?.courseIds ?? []).includes(course.id)}
          />
        ))}
      </div>

      <p className="text-xs text-slate-400">
        Kontakt systemeier for å be om tilgang til flere kurs.
      </p>
    </section>
  );
}

