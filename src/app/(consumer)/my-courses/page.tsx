'use client';
/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from 'react';
import Link from 'next/link';

import { useAuth } from '@/context/AuthContext';
import { useConsumerCourses } from '@/hooks/useConsumerCourses';
import { useCustomer } from '@/hooks/useCustomer';
import type { Course } from '@/types/course';
import type { CustomerMembership } from '@/types/companyUser';
import { getLocalizedValue, getPreferredLocale } from '@/utils/localization';
import { getTranslation } from '@/utils/translations';
import { useCourseModules } from '@/hooks/useCourseModules';
import { useCourseProgress } from '@/hooks/useCourseProgress';

export default function MyCoursesPage() {
  const { profile, activeCustomerId, setActiveCustomerId } = useAuth();
  const [locale] = useState(() => getPreferredLocale(['no', 'en']));
  const t = getTranslation(locale);

  const memberships = useMemo(
    () => (profile?.customerMemberships as CustomerMembership[] | undefined) ?? [],
    [profile?.customerMemberships],
  );

  const selectedCustomerId = activeCustomerId ?? memberships[0]?.customerId ?? null;

  const selectedMembership =
    memberships.find((membership) => membership.customerId === selectedCustomerId) ??
    memberships[0];

  const { customer: selectedCustomer } = useCustomer(null, selectedMembership?.customerId ?? null);

  const assignedCourseIds = selectedMembership?.assignedCourseIds ?? [];
  const { courses, loading } = useConsumerCourses(assignedCourseIds);

  const handleSelectCustomer = (customerId: string) => {
    setActiveCustomerId(customerId);
  };

  if (!memberships.length) {
    return (
      <div className="space-y-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">{t.courses.title}</h1>
          <p className="text-slate-500">{t.courses.subtitle}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          {t.courses.noAccess}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">{t.courses.title}</h1>
        <p className="text-slate-500">{t.courses.subtitle}</p>
      </div>

      {memberships.length > 1 && (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {memberships.map((membership) => {
            const isActive = membership.customerId === selectedMembership?.customerId;
            return (
              <button
                key={membership.customerId}
                onClick={() => handleSelectCustomer(membership.customerId)}
                className={`rounded-full px-4 py-1 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {membership.customerName ?? membership.customerId}
              </button>
            );
          })}
        </div>
      )}

      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-slate-900">
        {t.courses.courseFrom}{' '}
          {selectedCustomer?.companyName ??
            selectedMembership?.customerName ??
            selectedMembership?.customerId ??
            ''}
        </h2>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-40 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : assignedCourseIds.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            Ingen kurs er tildelt denne kunden ennå.
          </div>
        ) : courses.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            Kursdetaljer kunne ikke lastes inn.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <ConsumerCourseCard key={course.id} course={course} locale={locale} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ConsumerCourseCard({ course, locale }: { course: Course; locale: string }) {
  const { completedModules } = useCourseProgress(course.id);
  const { modules } = useCourseModules(course.id);
  const t = getTranslation(locale);

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
