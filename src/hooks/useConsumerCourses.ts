'use client';

import { useEffect, useState } from 'react';
import { collection, documentId, onSnapshot, query, where } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type { Course, LocaleStringMap } from '@/types/course';

const normalizeLocaleMap = (value: unknown): LocaleStringMap => {
  if (!value) {
    return { no: '' };
  }
  if (typeof value === 'string') {
    return { no: value };
  }
  if (typeof value === 'object') {
    return value as LocaleStringMap;
  }
  return { no: String(value) };
};

interface UseConsumerCoursesState {
  courses: Course[];
  loading: boolean;
  error: string | null;
}

export const useConsumerCourses = (
  assignedCourseIds: string[],
): UseConsumerCoursesState => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (assignedCourseIds.length === 0) {
      const timer = setTimeout(() => {
        setCourses([]);
        setLoading(false);
        setError(null);
      }, 0);
      return () => clearTimeout(timer);
    }

    const sortedIds = [...assignedCourseIds].sort();
    const chunks: string[][] = [];
    for (let i = 0; i < sortedIds.length; i += 10) {
      chunks.push(sortedIds.slice(i, i + 10));
    }

    const courseMap = new Map<string, Course>();
    let readyChunks = 0;
    const loadingTimer = setTimeout(() => {
      setLoading(true);
      setError(null);
    }, 0);

    const unsubscribes = chunks.map((chunk) => {
      const q = query(collection(db, 'courses'), where(documentId(), 'in', chunk));
      return onSnapshot(
        q,
        (snapshot) => {
          const seenIds = new Set<string>();
          snapshot.forEach((docSnap) => {
            seenIds.add(docSnap.id);
            const data = docSnap.data();
            if (data.status === 'active') {
              courseMap.set(docSnap.id, {
                id: docSnap.id,
                companyId: data.companyId,
                createdById: data.createdById,
                title: normalizeLocaleMap(data.title),
                description: normalizeLocaleMap(data.description),
                status: data.status,
                courseImageUrl: data.courseImageUrl,
                createdAt: data.createdAt?.toDate?.() ?? undefined,
                updatedAt: data.updatedAt?.toDate?.() ?? undefined,
              });
            } else {
              courseMap.delete(docSnap.id);
            }
          });

          chunk.forEach((id) => {
            if (!seenIds.has(id)) {
              courseMap.delete(id);
            }
          });

          readyChunks += 1;
          if (readyChunks >= chunks.length) {
            setLoading(false);
          }
          setCourses(Array.from(courseMap.values()));
        },
        (err) => {
          console.error('Failed to load consumer courses', err);
          setError('Kunne ikke hente dine kurs');
          setLoading(false);
        },
      );
    });

    return () => {
      clearTimeout(loadingTimer);
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [assignedCourseIds]);

  return { courses, loading, error };
};

