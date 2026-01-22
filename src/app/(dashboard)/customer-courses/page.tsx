'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { useAuth } from '@/context/AuthContext';
import { useCustomer } from '@/hooks/useCustomer';
import { useCourses } from '@/hooks/useCourses';

const CourseCard = ({
  id,
  title,
  description,
  isAssigned,
}: {
  id: string;
  title: string;
  description: string;
  isAssigned: boolean;
}) => {
  if (!isAssigned) {
    return null;
  }

  return (
    <Link
      href={`/customer-courses/${id}`}
      className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500 line-clamp-2">{description}</p>
        </div>
        <span className="flex-shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
          Tilgang
        </span>
      </div>
    </Link>
  );
};

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
  const accessibleCourseIds = new Set(customer?.courseIds ?? []);
  const visibleCourses = courses.filter((course) => accessibleCourseIds.has(course.id));

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
            {customer?.companyName ?? membership?.customerName ?? activeCustomerId ?? ''}
          </span>
        </p>
      </div>

      {visibleCourses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
          Ingen kurs er tilgjengelige for denne kunden ennå.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleCourses.map((course) => (
            <CourseCard
              key={course.id}
              id={course.id}
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
              isAssigned
            />
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400">
        Klikk på et kurs for å administrere tildelinger og se fremdrift.
      </p>
    </section>
  );
}
