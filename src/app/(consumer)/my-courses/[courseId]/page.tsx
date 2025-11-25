'use client';

import { useParams } from 'next/navigation';

import ConsumerCourseView from '@/components/consumer/ConsumerCourseView';
import { useCourseModules } from '@/hooks/useCourseModules';
import { useCourse } from '@/hooks/useCourse';

export default function ConsumerCourseDetailPage() {
  const params = useParams();
  const courseId = params.courseId as string;

  const { course, loading: courseLoading, error: courseError } = useCourse(courseId);
  const { modules, loading: modulesLoading, error: modulesError } = useCourseModules(courseId);

  if (courseLoading || modulesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Laster kurs …
      </div>
    );
  }

  if (courseError || modulesError || !course) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-sm text-red-600">
          {courseError ?? modulesError ?? 'Fant ikke kurset.'}
        </div>
      </div>
    );
  }

  return (
    <ConsumerCourseView
      course={course}
      modules={modules}
      basePath="/my-courses"
    />
  );
}
