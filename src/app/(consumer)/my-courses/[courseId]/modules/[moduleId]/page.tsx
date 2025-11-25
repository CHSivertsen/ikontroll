'use client';

import { useParams } from 'next/navigation';

import ConsumerModuleView from '@/components/consumer/ConsumerModuleView';
import { useCourse } from '@/hooks/useCourse';
import { useCourseModule } from '@/hooks/useCourseModule';

export default function ConsumerModuleDetailPage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const moduleId = params.moduleId as string;

  const { course, loading: courseLoading, error: courseError } = useCourse(courseId);
  const { module, loading: moduleLoading, error: moduleError } = useCourseModule(courseId, moduleId);

  if (courseLoading || moduleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Laster emne …
      </div>
    );
  }

  if (courseError || moduleError || !course || !module) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-sm text-red-600">
          {courseError ?? moduleError ?? 'Fant ikke emnet.'}
        </div>
      </div>
    );
  }

  return (
    <ConsumerModuleView
      course={course}
      module={module}
      basePath="/my-courses"
    />
  );
}

