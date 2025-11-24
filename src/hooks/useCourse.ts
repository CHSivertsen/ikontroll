'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type { Course } from '@/types/course';

interface UseCourseState {
  course: Course | null;
  loading: boolean;
  error: string | null;
}

export const useCourse = (courseId: string | null): UseCourseState => {
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) {
      setCourse(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = doc(db, 'courses', courseId);
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        if (!snapshot.exists()) {
          setCourse(null);
          setError('Fant ikke kurs');
        } else {
          const data = snapshot.data();
          setCourse({
            id: snapshot.id,
            companyId: data.companyId,
            createdById: data.createdById,
            title: data.title ?? '',
            description: data.description ?? '',
            status: data.status ?? 'inactive',
            createdAt: data.createdAt?.toDate?.() ?? undefined,
            updatedAt: data.updatedAt?.toDate?.() ?? undefined,
          });
          setError(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load course', err);
        setCourse(null);
        setError('Kunne ikke hente kurs');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [courseId]);

  return { course, loading, error };
};

