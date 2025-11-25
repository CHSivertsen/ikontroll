'use client';

import { useMemo } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useConsumerCourses } from '@/hooks/useConsumerCourses';
import { useCustomer } from '@/hooks/useCustomer';
import Link from 'next/link';
import type { Course } from '@/types/course';
import { getLocalizedValue, getPreferredLocale } from '@/utils/localization';
import { useCourseProgress } from '@/hooks/useCourseProgress';
import { useCourseModules } from '@/hooks/useCourseModules';

export default function MyCoursesPage() {
  const { profile } = useAuth();

  const customerIds = useMemo(() => 
    profile?.customerMemberships?.map(m => m.customerId) ?? [], 
    [profile]
  );

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Mine kurs</h1>
        <p className="text-slate-500">
          Her finner du oversikt over kurs du har tilgang til.
        </p>
      </div>

      {customerIds.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Du har ingen kurstilganger ennå.
        </div>
      ) : (
        <div className="space-y-12">
          {profile?.customerMemberships?.map((membership) => (
            <CustomerCoursesSection
              key={membership.customerId}
              customerId={membership.customerId}
              customerName={membership.customerName}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CustomerCoursesSection({ 
  customerId, 
  customerName 
}: { 
  customerId: string; 
  customerName?: string; 
}) {
  const { customer, loading: customerLoading } = useCustomer(null, customerId);
  const { courses, loading: coursesLoading } = useConsumerCourses(customer?.courseIds ?? []);

  if (customerLoading) {
    return <div className="animate-pulse h-40 rounded-2xl bg-slate-100"></div>;
  }

  if (!customer || (customer.courseIds.length === 0)) {
    return null;
  }

  if (coursesLoading) {
     return <div className="animate-pulse h-40 rounded-2xl bg-slate-100"></div>;
  }
  
  if (courses.length === 0) {
      return null;
  }

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900">
        Kurs fra {customer.companyName || customerName}
      </h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <ConsumerCourseCard key={course.id} course={course} />
        ))}
      </div>
    </section>
  );
}

function ConsumerCourseCard({ course }: { course: Course }) {
  const { completedModules } = useCourseProgress(course.id);
  const { modules } = useCourseModules(course.id);
  
  const locale = getPreferredLocale(['no', 'en']);

  const totalModules = modules.length;
  const completedCount = modules.filter((module) =>
    completedModules.includes(module.id),
  ).length;
  
  const progressPercent = totalModules
    ? Math.round((completedCount / totalModules) * 100)
    : 0;

  const isCompleted = totalModules > 0 && completedCount === totalModules;
  const isStarted = completedCount > 0;

  return (
    <Link
      href={`/my-courses/${course.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
    >
      <div className="relative h-48 bg-slate-100 overflow-hidden">
        {course.courseImageUrl ? (
          <img
            src={course.courseImageUrl}
            alt={getLocalizedValue(course.title, locale)}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
           <div className="flex h-full items-center justify-center text-slate-400">
             Ingen bilde
           </div>
        )}
        {isCompleted && (
          <div className="absolute top-3 right-3 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
            Fullført
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-semibold text-slate-900 line-clamp-2">
          {getLocalizedValue(course.title, locale)}
        </h3>
        <div className="mt-auto pt-4 space-y-2">
          <div className="flex justify-between text-xs font-medium text-slate-500">
            <span>{isStarted ? `${progressPercent}% fullført` : 'Ikke påbegynt'}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${isCompleted ? 'bg-emerald-500' : 'bg-slate-900'}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
