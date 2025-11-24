'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type { Course, CoursePayload } from '@/types/course';

interface UseCoursesState {
  courses: Course[];
  loading: boolean;
  error: string | null;
  createCourse: (payload: CoursePayload) => Promise<string>;
  updateCourse: (id: string, payload: CoursePayload) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;
}

export const useCourses = (
  companyId: string | null,
): UseCoursesState => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const coursesCollection = useMemo(() => {
    if (!companyId) return null;
    return collection(db, 'courses');
  }, [companyId]);

  useEffect(() => {
    if (!coursesCollection || !companyId) {
      setCourses([]);
      setLoading(false);
      return;
    }

    const q = query(
      coursesCollection,
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const next = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            companyId: data.companyId,
            createdById: data.createdById,
            title: data.title ?? '',
            description: data.description ?? '',
            status: data.status ?? 'inactive',
            createdAt: data.createdAt?.toDate?.() ?? undefined,
            updatedAt: data.updatedAt?.toDate?.() ?? undefined,
          } satisfies Course;
        });
        setCourses(next);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load courses', err);
        setCourses([]);
        setError('Kunne ikke hente kurs');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [coursesCollection, companyId]);

  const createCourse = useCallback(
    async (payload: CoursePayload) => {
      if (!coursesCollection) {
        throw new Error('Company is not selected');
      }
      const docRef = await addDoc(coursesCollection, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    },
    [coursesCollection],
  );

  const updateCourse = useCallback(
    async (id: string, payload: CoursePayload) => {
      if (!companyId) {
        throw new Error('Company is not selected');
      }
      const courseRef = doc(db, 'courses', id);
      await updateDoc(courseRef, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    },
    [companyId],
  );

  const deleteCourse = useCallback(
    async (id: string) => {
      const courseRef = doc(db, 'courses', id);
      await deleteDoc(courseRef);
    },
    [],
  );

  return {
    courses,
    loading,
    error,
    createCourse,
    updateCourse,
    deleteCourse,
  };
};

