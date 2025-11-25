'use client';

import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';

import { db } from '@/lib/firebase';

export const useCourseUsersProgress = (courseId: string | null, userIds: string[]) => {
  const [progressMap, setProgressMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  const sortedIds = useMemo(() => userIds.slice().sort(), [userIds]);

  useEffect(() => {
    if (!courseId || !sortedIds.length) {
      setProgressMap({});
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchProgress = async () => {
      setLoading(true);
      const results: Record<string, string[]> = {};
      try {
        await Promise.all(
          sortedIds.map(async (uid) => {
            try {
              const docRef = doc(db, 'users', uid, 'courseProgress', courseId);
              const snapshot = await getDoc(docRef);
              if (snapshot.exists()) {
                const data = snapshot.data();
                results[uid] = Array.isArray(data.completedModules) ? data.completedModules : [];
              } else {
                results[uid] = [];
              }
            } catch (error) {
              console.warn(`Failed to fetch progress for user ${uid}`, error);
              results[uid] = [];
            }
          }),
        );
        if (!cancelled) {
          setProgressMap(results);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch course progress for users', error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchProgress();

    return () => {
      cancelled = true;
    };
  }, [courseId, sortedIds]);

  return { progressMap, loading };
};
