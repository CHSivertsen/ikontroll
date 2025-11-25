'use client';

import { useMemo } from 'react';
import { GraduationCap } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { useConsumerCourses } from '@/hooks/useConsumerCourses';
import { useCourseProgress } from '@/hooks/useCourseProgress';
import { useCustomer } from '@/hooks/useCustomer';
import type { Course } from '@/types/course';
import { getLocalizedValue, getPreferredLocale } from '@/utils/localization';
import { useCourseModules } from '@/hooks/useCourseModules';

export default function ProfilePage() {
  const { profile } = useAuth();

  const customerIds = useMemo(() => 
    profile?.customerMemberships?.map(m => m.customerId) ?? [], 
    [profile]
  );

  // We will check if there are NO courses at all, or no COMPLETED courses to show appropriate empty state.
  // Since the loaders are async and independent, handling the "global empty state" for completed courses perfectly
  // without a parent data fetcher is tricky.
  // For now, we'll show the empty state if customerIds is empty.
  // If customerIds exist but no courses are completed, the list will just be empty. 
  // To improve this, we'd need to lift the state up.
  // Let's stick to a simple empty state for "No customer access" first, 
  // and we can add a "No completed courses" placeholder inside the list if needed.

  return (
    <div className="flex flex-col items-center gap-8 pb-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-900 text-3xl font-bold text-white shadow-lg">
          {profile?.firstName?.[0]}
          {profile?.lastName?.[0]}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {profile?.firstName} {profile?.lastName}
          </h1>
          <p className="text-slate-500">{profile?.email}</p>
        </div>
      </div>

      <div className="w-full max-w-2xl space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <h2 className="text-xl font-semibold text-slate-900">Fullførte kurs</h2>
        
        {customerIds.length === 0 ? (
           <EmptyState />
        ) : (
          <div className="space-y-4">
             <CoursesList customerIds={customerIds} />
          </div>
        )}
      </div>
    </div>
  );
}

// A wrapper component to handle the logic of "Do we have ANY completed courses?"
// This is still hard without fetching everything at the top level.
// We will just render the list. If it's empty, it's empty.
// To make it nicer, we can't easily know if *all* children returned null without context/state.
// So for now, we render the loaders. 
// If you want a global "No completed courses" message, we need to refactor to fetch all courses in the parent.

function CoursesList({ customerIds }: { customerIds: string[] }) {
    // This component is just a container for now.
    // A true empty state for "You have access to courses but haven't completed any" 
    // requires fetching completion status for ALL courses here.
    return (
        <>
            {customerIds.map((customerId) => (
               <CompletedCoursesLoader
                 key={customerId}
                 customerId={customerId}
               />
            ))}
             {/* 
                Ideally we would show <EmptyState /> here if the total count of rendered items is 0.
                But we can't know that from here since data is fetched in children.
                Visual improvement: We can show the EmptyState by default and hide it if we find content? No.
                
                Let's stick to the current implementation where we show nothing if nothing is completed.
                If the user wants an explicit "No completed courses" message when they have access but 0 completed, 
                we'd need a bigger refactor.
             */}
        </>
    )
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-center text-slate-500">
            <div className="rounded-full bg-slate-100 p-4">
                <GraduationCap className="h-8 w-8 text-slate-400" />
            </div>
            <p>Ingen fullførte kurs ennå.</p>
        </div>
    )
}

function CompletedCoursesLoader({ customerId }: { customerId: string }) {
  const { customer } = useCustomer(null, customerId);
  const { courses } = useConsumerCourses(customer?.courseIds ?? []);

  if (!customer || !courses.length) return null;

  return (
    <>
      {courses.map(course => (
        <CompletedCourseItem key={course.id} course={course} />
      ))}
    </>
  );
}

function CompletedCourseItem({ course }: { course: Course }) {
  const { completedModules, loading } = useCourseProgress(course.id);
  const { modules } = useCourseModules(course.id);
  
  const locale = getPreferredLocale(['no', 'en']);

  if (loading || !modules.length) return null;

  const totalModules = modules.length;
  const completedCount = modules.filter((module) =>
    completedModules.includes(module.id),
  ).length;

  const isCompleted = totalModules > 0 && completedCount === totalModules;

  if (!isCompleted) return null;

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
      <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-emerald-100 text-2xl">
        🏆
      </div>
      <div>
        <h3 className="font-semibold text-slate-900">
          {getLocalizedValue(course.title, locale)}
        </h3>
        <p className="text-xs text-emerald-700">
           Fullført
        </p>
      </div>
    </div>
  );
}
