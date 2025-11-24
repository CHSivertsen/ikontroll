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
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type { CourseModule, CourseModulePayload } from '@/types/course';

interface UseCourseModulesState {
  modules: CourseModule[];
  loading: boolean;
  error: string | null;
  createModule: (payload: CourseModulePayload) => Promise<string>;
  updateModule: (id: string, payload: CourseModulePayload) => Promise<void>;
  deleteModule: (id: string) => Promise<void>;
}

export const useCourseModules = (
  courseId: string | null,
): UseCourseModulesState => {
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const modulesCollection = useMemo(() => {
    if (!courseId) return null;
    return collection(db, 'courses', courseId, 'modules');
  }, [courseId]);

  useEffect(() => {
    if (!modulesCollection || !courseId) {
      setModules([]);
      setLoading(false);
      return;
    }

    const q = query(modulesCollection, orderBy('order'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const next = snapshot.docs.map((docSnap, index) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            courseId,
            title: data.title ?? '',
            summary: data.summary ?? '',
            body: data.body ?? {},
            videoUrls: data.videoUrls ?? [],
            imageUrls: data.imageUrls ?? [],
            order: data.order ?? index,
            questions: data.questions ?? [],
            createdAt: data.createdAt?.toDate?.() ?? undefined,
            updatedAt: data.updatedAt?.toDate?.() ?? undefined,
          } satisfies CourseModule;
        });
        setModules(next);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load modules', err);
        setModules([]);
        setError('Kunne ikke hente emner');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [modulesCollection, courseId]);

  const createModule = useCallback(
    async (payload: CourseModulePayload) => {
      if (!modulesCollection) {
        throw new Error('Course is not selected');
      }
      const docRef = await addDoc(modulesCollection, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    },
    [modulesCollection],
  );

  const updateModule = useCallback(
    async (id: string, payload: CourseModulePayload) => {
      if (!courseId) {
        throw new Error('Course is not selected');
      }
      const moduleRef = doc(db, 'courses', courseId, 'modules', id);
      await updateDoc(moduleRef, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    },
    [courseId],
  );

  const deleteModule = useCallback(
    async (id: string) => {
      if (!courseId) {
        throw new Error('Course is not selected');
      }
      const moduleRef = doc(db, 'courses', courseId, 'modules', id);
      await deleteDoc(moduleRef);
    },
    [courseId],
  );

  return {
    modules,
    loading,
    error,
    createModule,
    updateModule,
    deleteModule,
  };
};

