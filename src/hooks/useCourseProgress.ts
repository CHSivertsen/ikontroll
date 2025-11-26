'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc } from 'firebase/firestore';

import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';

interface CourseProgressState {
  completedModules: string[];
  loading: boolean;
  error: string | null;
  setModuleCompletion: (moduleId: string, isComplete: boolean) => Promise<void>;
}

export const useCourseProgress = (courseId: string | null): CourseProgressState => {
  const { firebaseUser } = useAuth();
  const [completedModules, setCompletedModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const completedModulesRef = useRef<string[]>([]);

  useEffect(() => {
    if (!courseId || !firebaseUser?.uid) {
      const timer = setTimeout(() => {
        setCompletedModules([]);
        completedModulesRef.current = [];
        setLoading(false);
        setError(null);
      }, 0);
      return () => clearTimeout(timer);
    }

    const progressRef = doc(db, 'users', firebaseUser.uid, 'courseProgress', courseId);
    const loadingTimer = setTimeout(() => {
      setLoading(true);
    }, 0);

    const unsubscribe = onSnapshot(
      progressRef,
      (snapshot) => {
        const data = snapshot.data();
        const modules = ((data?.completedModules as string[]) ?? []).filter(Boolean);
        setCompletedModules(modules);
        completedModulesRef.current = modules;
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load course progress', err);
        setCompletedModules([]);
        setError('Kunne ikke hente kursfremdrift.');
        setLoading(false);
      },
    );

    return () => {
      clearTimeout(loadingTimer);
      unsubscribe();
    };
  }, [courseId, firebaseUser?.uid]);

  useEffect(() => {
    completedModulesRef.current = completedModules;
  }, [completedModules]);

  const setModuleCompletion = useCallback(
    async (moduleId: string, isComplete: boolean) => {
      if (!courseId || !firebaseUser?.uid || !moduleId) {
        return;
      }

      const progressRef = doc(db, 'users', firebaseUser.uid, 'courseProgress', courseId);
      const current = completedModulesRef.current ?? [];
      const nextModules = isComplete
        ? Array.from(new Set([...current, moduleId]))
        : current.filter((id) => id !== moduleId);

      // Avoid redundant writes if nothing actually changed
      const changed =
        current.length !== nextModules.length ||
        current.some((id, index) => id !== nextModules[index]);
      if (!changed) {
        return;
      }

      setCompletedModules(nextModules);
      completedModulesRef.current = nextModules;

      try {
        await setDoc(
          progressRef,
          {
            courseId,
            updatedAt: serverTimestamp(),
            completedModules: nextModules,
          },
          { merge: true },
        );
        setError(null);
      } catch (err) {
        console.error('Failed to update module progress', err);
        completedModulesRef.current = current;
        setCompletedModules(current);
        setError('Kunne ikke oppdatere fremdrift.');
        throw err;
      }
    },
    [courseId, firebaseUser],
  );

  return {
    completedModules,
    loading,
    error,
    setModuleCompletion,
  };
};

export interface UserCourseProgress {
  courseId: string;
  completedModules: string[];
}

export const useAllCourseProgress = () => {
  const { firebaseUser } = useAuth();
  const [progress, setProgress] = useState<UserCourseProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser?.uid) {
      const timer = setTimeout(() => {
        setLoading(false);
        setProgress([]);
      }, 0);
      return () => clearTimeout(timer);
    }

    const q = query(collection(db, 'users', firebaseUser.uid, 'courseProgress'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const results: UserCourseProgress[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          results.push({
            courseId: doc.id,
            completedModules: Array.isArray(data.completedModules) ? data.completedModules : [],
          });
        });
        setProgress(results);
        setLoading(false);
      },
      (error) => {
        console.error('Failed to fetch all course progress', error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [firebaseUser?.uid]);

  return { progress, loading };
};
