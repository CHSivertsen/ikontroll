'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type {
  CourseModule,
  LocaleStringArrayMap,
  LocaleStringMap,
} from '@/types/course';
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

const normalizeLocaleArrayMap = (value: unknown): LocaleStringArrayMap => {
  if (!value) {
    return { no: [] };
  }
  if (Array.isArray(value)) {
    return { no: value.filter((item): item is string => typeof item === 'string') };
  }
  if (typeof value === 'object') {
    const result: LocaleStringArrayMap = {};
    Object.entries(value as Record<string, unknown>).forEach(([lang, entries]) => {
      if (Array.isArray(entries)) {
        result[lang] = entries.filter((item): item is string => typeof item === 'string');
      } else if (typeof entries === 'string') {
        result[lang] = [entries];
      } else if (entries == null) {
        result[lang] = [];
      } else {
        result[lang] = [String(entries)];
      }
    });
    return result;
  }
  return { no: [String(value)] };
};


interface UseCourseModuleState {
  module: CourseModule | null;
  loading: boolean;
  error: string | null;
}

export const useCourseModule = (
  courseId: string | null,
  moduleId: string | null,
): UseCourseModuleState => {
  const [module, setModule] = useState<CourseModule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId || !moduleId) {
      setModule(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = doc(db, 'courses', courseId, 'modules', moduleId);
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        if (!snapshot.exists()) {
          setModule(null);
          setError('Fant ikke emnet');
        } else {
          const data = snapshot.data();
          setModule({
            id: snapshot.id,
            courseId,
            title: normalizeLocaleMap(data.title),
            summary: normalizeLocaleMap(data.summary),
            body: normalizeLocaleMap(data.body),
            videoUrls: normalizeLocaleArrayMap(data.videoUrls),
            imageUrls: normalizeLocaleArrayMap(data.imageUrls),
            order: data.order ?? 0,
            questions: data.questions ?? [],
            createdAt: data.createdAt?.toDate?.() ?? undefined,
            updatedAt: data.updatedAt?.toDate?.() ?? undefined,
          });
          setError(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load module', err);
        setModule(null);
        setError('Kunne ikke hente emnet');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [courseId, moduleId]);

  return { module, loading, error };
};


