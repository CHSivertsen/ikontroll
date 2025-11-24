'use client';

import CourseDetailManager from '../CourseDetailManager';

export default function CourseDetailPage({
  params,
}: {
  params: { courseId: string };
}) {
  return (
    <section className="space-y-6">
      <CourseDetailManager courseId={params.courseId} />
    </section>
  );
}

