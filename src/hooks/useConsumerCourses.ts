'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  documentId,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

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
      setCourses([]);
      setLoading(false);
      return;
    }

    const fetchCourses = async () => {
      try {
        // Firestore 'in' query supports up to 10 items.
        // If more, we need to batch or do multiple queries.
        // For now, let's assume <= 10 or just fetch in batches if needed.
        // A safer approach for many items is multiple fetches or fetching by company if structure allows.
        // Given the requirement: users get access to ALL courses assigned to their Customer company.
        // But here we are passed specific IDs (which we derived from customer or user).

        // Actually, let's chunk it to be safe.
        const chunks: string[][] = [];
        for (let i = 0; i < assignedCourseIds.length; i += 10) {
          chunks.push(assignedCourseIds.slice(i, i + 10));
        }

        const allCourses: Course[] = [];

        for (const chunk of chunks) {
          const q = query(
            collection(db, 'courses'),
            where(documentId(), 'in', chunk),
          );
          const snapshot = await getDocs(q);
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            // Filter for active courses only? Usually yes for consumers.
            if (data.status === 'active') {
              allCourses.push({
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
            }
          });
        }

        setCourses(allCourses);
        setError(null);
      } catch (err) {
        console.error('Failed to load consumer courses', err);
        setError('Kunne ikke hente dine kurs');
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [assignedCourseIds]);

  return { courses, loading, error };
};

