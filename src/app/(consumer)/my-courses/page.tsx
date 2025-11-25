'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';

import { useAuth } from '@/context/AuthContext';
import { useConsumerCourses } from '@/hooks/useConsumerCourses';
import { useCustomer } from '@/hooks/useCustomer';
import type { Course } from '@/types/course';
import { getLocalizedValue, getPreferredLocale } from '@/utils/localization';
import { getTranslation } from '@/utils/translations';
import { useCourseProgress } from '@/hooks/useCourseProgress';
import { useCourseModules } from '@/hooks/useCourseModules';

export default function MyCoursesPage() {
  const { profile } = useAuth();
  const [locale, setLocale] = useState('no');

  useEffect(() => {
    setLocale(getPreferredLocale(['no', 'en']));
  }, []);

  const t = getTranslation(locale);

  const customerIds = useMemo(() => 
    profile?.customerMemberships?.map(m => m.customerId) ?? [], 
    [profile]
  );

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">{t.courses.title}</h1>
        <p className="text-slate-500">
          {t.courses.subtitle}
        </p>
      </div>

      {customerIds.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          {t.courses.noAccess}
        </div>
      ) : (
        <div className="space-y-12">
          {profile?.customerMemberships?.map((membership) => (
            <CustomerCoursesSection
              key={membership.customerId}
              customerId={membership.customerId}
              customerName={membership.customerName}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CustomerCoursesSection({ 
  customerId, 
  customerName,
  locale
}: { 
  customerId: string; 
  customerName?: string; 
  locale: string;
}) {
  const { customer, loading: customerLoading } = useCustomer(null, customerId);
  const { courses, loading: coursesLoading } = useConsumerCourses(customer?.courseIds ?? []);
  const t = getTranslation(locale);

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
        {t.courses.courseFrom} {customer.companyName || customerName}
      </h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <ConsumerCourseCard key={course.id} course={course} locale={locale} />
        ))}
      </div>
    </section>
  );
}

function ConsumerCourseCard({ course, locale }: { course: Course; locale: string }) {
  const { completedModules } = useCourseProgress(course.id);
  const { modules } = useCourseModules(course.id);
  const t = getTranslation(locale);
  
  const courseLocale = getPreferredLocale(['no', 'en']); // Content fallback logic can remain or use UI locale if appropriate.
  // Usually we want content locale to follow UI locale if possible, but fallback to what's available.
  // getLocalizedValue handles the fallback logic internally given a requested locale.
  
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
             {t.courses.noImage}
           </div>
        )}
        {isCompleted && (
          <div className="absolute top-3 right-3 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
            {t.courses.completed}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-semibold text-slate-900 line-clamp-2">
          {getLocalizedValue(course.title, locale)}
        </h3>
        <div className="mt-auto pt-4 space-y-2">
          <div className="flex justify-between text-xs font-medium text-slate-500">
            <span>{isStarted ? `${progressPercent}${t.courses.percentCompleted}` : t.courses.notStarted}</span>
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
