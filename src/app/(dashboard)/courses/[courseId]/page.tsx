'use client';

import { useParams } from 'next/navigation';

import CourseDetailManager from '../CourseDetailManager';

export default function CourseDetailPage() {
  const params = useParams<{ courseId?: string | string[] }>();
  const courseParam = params?.courseId;
  const courseId = Array.isArray(courseParam) ? courseParam[0] : courseParam ?? null;

  if (!courseId) {
    return (
      <section className="space-y-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Klarte ikke å finne kurset.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <CourseDetailManager courseId={courseId} />
    </section>
  );
}

