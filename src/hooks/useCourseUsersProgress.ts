'use client';

import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import { db } from '@/lib/firebase';

export const useCourseUsersProgress = (courseId: string | null, userIds: string[]) => {
  const [progressMap, setProgressMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  const sortedIds = useMemo(() => userIds.slice().sort(), [userIds]);

  useEffect(() => {
    if (!courseId || !sortedIds.length) {
      const timer = setTimeout(() => {
        setProgressMap({});
        setLoading(false);
      }, 0);
      return () => clearTimeout(timer);
    }

    const unsubscribes: Array<() => void> = [];
    const loadingTimer = setTimeout(() => setLoading(true), 0);

    sortedIds.forEach((uid) => {
      const docRef = doc(db, 'users', uid, 'courseProgress', courseId);
      const unsubscribe = onSnapshot(
        docRef,
        (snapshot) => {
          setProgressMap((prev) => {
            const next = { ...prev };
            if (snapshot.exists()) {
              const data = snapshot.data();
              next[uid] = Array.isArray(data.completedModules)
                ? data.completedModules
                : [];
            } else {
              next[uid] = [];
            }
            return next;
          });
          setLoading(false);
        },
        (error) => {
          console.warn(`Failed to subscribe to progress for user ${uid}`, error);
          setProgressMap((prev) => {
            const next = { ...prev };
            next[uid] = [];
            return next;
          });
          setLoading(false);
        },
      );
      unsubscribes.push(unsubscribe);
    });

    return () => {
      clearTimeout(loadingTimer);
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [courseId, sortedIds]);

  return { progressMap, loading };
};
