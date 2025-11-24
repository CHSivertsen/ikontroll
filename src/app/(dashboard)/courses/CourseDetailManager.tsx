'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import {
  arrayUnion,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import { useAuth } from '@/context/AuthContext';
import { useCourse } from '@/hooks/useCourse';
import { useCourseModules } from '@/hooks/useCourseModules';
import { db } from '@/lib/firebase';
import {
  CourseModulePayload,
  CourseQuestion,
  CourseQuestionAlternative,
  LocaleStringMap,
} from '@/types/course';

const DEFAULT_LANGUAGES = ['no', 'en'];

type CourseInfoFormValues = {
  title: string;
  description?: string;
  status: 'active' | 'inactive';
};

const STATUS_LABELS: Record<'active' | 'inactive', string> = {
  active: 'Aktiv',
  inactive: 'Inaktiv',
};

const STATUS_STYLES: Record<'active' | 'inactive', string> = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-slate-100 text-slate-600',
};

const generateId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const createEmptyLocaleMap = (languages: string[]): LocaleStringMap =>
  languages.reduce<LocaleStringMap>((acc, lang) => {
    acc[lang] = '';
    return acc;
  }, {});

const createEmptyAlternative = (
  languages: string[],
): CourseQuestionAlternative => ({
  id: generateId(),
  altText: createEmptyLocaleMap(languages),
});

const createEmptyQuestion = (languages: string[]): CourseQuestion => {
  const first = createEmptyAlternative(languages);
  const second = createEmptyAlternative(languages);
  return {
    id: generateId(),
    title: createEmptyLocaleMap(languages),
    contentText: createEmptyLocaleMap(languages),
    alternatives: [first, second],
    correctAnswerId: first.id,
  };
};

const createEmptyModule = (
  order: number,
  languages: string[],
): CourseModulePayload => ({
  title: '',
  summary: '',
  body: createEmptyLocaleMap(languages),
  videoUrls: [],
  imageUrls: [],
  order,
  questions: [],
});

export default function CourseDetailManager({ courseId }: { courseId: string }) {
  const router = useRouter();
  const { companyId } = useAuth();
  const { course, loading, error } = useCourse(courseId);
  const {
    modules,
    loading: modulesLoading,
    error: modulesError,
    createModule,
    updateModule,
    deleteModule,
  } = useCourseModules(courseId);

  const form = useForm<CourseInfoFormValues>({
    defaultValues: {
      title: course?.title ?? '',
      description: course?.description ?? '',
      status: course?.status ?? 'inactive',
    },
  });

  useEffect(() => {
    if (!course) return;
    form.reset({
      title: course.title,
      description: course.description ?? '',
      status: course.status,
    });
  }, [course, form]);

  const [languages, setLanguages] = useState<string[]>(DEFAULT_LANGUAGES);
  const [languageInput, setLanguageInput] = useState('');

  useEffect(() => {
    const discovered = new Set(DEFAULT_LANGUAGES);
    modules.forEach((module) => {
      Object.keys(module.body ?? {}).forEach((lang) => discovered.add(lang));
      module.questions.forEach((question) => {
        Object.keys(question.title ?? {}).forEach((lang) => discovered.add(lang));
        Object.keys(question.contentText ?? {}).forEach((lang) =>
          discovered.add(lang),
        );
        question.alternatives.forEach((alt) => {
          Object.keys(alt.altText ?? {}).forEach((lang) => discovered.add(lang));
        });
      });
    });
    setLanguages((prev) => {
      const union = new Set([...prev, ...discovered]);
      return Array.from(union);
    });
  }, [modules]);

  const [moduleDraft, setModuleDraft] = useState<CourseModulePayload | null>(null);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [isModuleDialogOpen, setModuleDialogOpen] = useState(false);
  const [moduleSaving, setModuleSaving] = useState(false);

  const openCreateModule = () => {
    const nextOrder =
      modules.length > 0 ? (modules[modules.length - 1].order ?? modules.length) + 1 : 0;
    setEditingModuleId(null);
    setModuleDraft(createEmptyModule(nextOrder, languages));
    setModuleDialogOpen(true);
  };

  const ensureLocaleKeys = (map: LocaleStringMap | undefined) => {
    const base = createEmptyLocaleMap(languages);
    if (!map) return base;
    return languages.reduce<LocaleStringMap>((acc, lang) => {
      acc[lang] = map[lang] ?? '';
      return acc;
    }, {});
  };

  const openEditModule = (moduleId: string) => {
    const target = modules.find((m) => m.id === moduleId);
    if (!target) return;
    setEditingModuleId(moduleId);
    setModuleDraft({
      title: target.title,
      summary: target.summary ?? '',
      body: ensureLocaleKeys(target.body),
      videoUrls: target.videoUrls ?? [],
      imageUrls: target.imageUrls ?? [],
      order: target.order,
      questions: (target.questions ?? []).map((question) => ({
        ...question,
        title: ensureLocaleKeys(question.title),
        contentText: ensureLocaleKeys(question.contentText),
        alternatives: question.alternatives.map((alt) => ({
          ...alt,
          altText: ensureLocaleKeys(alt.altText),
        })),
      })),
    });
    setModuleDialogOpen(true);
  };

  const closeModuleDialog = () => {
    setModuleDialogOpen(false);
    setEditingModuleId(null);
    setModuleDraft(null);
  };

  const handleSaveModule = async () => {
    if (!moduleDraft) return;
    try {
      setModuleSaving(true);
      if (editingModuleId) {
        await updateModule(editingModuleId, moduleDraft);
      } else {
        await createModule(moduleDraft);
      }
      closeModuleDialog();
    } catch (err) {
      console.error('Failed to save module', err);
      alert('Kunne ikke lagre emnet.');
    } finally {
      setModuleSaving(false);
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    const target = modules.find((m) => m.id === moduleId);
    if (!target) return;
    const confirmed = window.confirm(
      `Slett emnet "${target.title}"? Dette kan ikke angres.`,
    );
    if (!confirmed) return;
    try {
      await deleteModule(moduleId);
    } catch (err) {
      console.error('Failed to delete module', err);
      alert('Kunne ikke slette emnet.');
    }
  };

  const addLanguage = (lang: string) => {
    const trimmed = lang.trim().toLowerCase();
    if (!trimmed || languages.includes(trimmed)) return;
    const nextLanguages = [...languages, trimmed];
    setLanguages(nextLanguages);
    setLanguageInput('');

    setModuleDraft((prev) =>
      prev
        ? {
            ...prev,
            body: {
              ...createEmptyLocaleMap(nextLanguages),
              ...(prev.body ?? {}),
            },
            questions: prev.questions.map((q) => ({
              ...q,
              title: {
                ...createEmptyLocaleMap(nextLanguages),
                ...(q.title ?? {}),
              },
              contentText: {
                ...createEmptyLocaleMap(nextLanguages),
                ...(q.contentText ?? {}),
              },
              alternatives: q.alternatives.map((alt) => ({
                ...alt,
                altText: {
                  ...createEmptyLocaleMap(nextLanguages),
                  ...(alt.altText ?? {}),
                },
              })),
            })),
          }
        : prev,
    );
  };

  const handleCourseInfoSave = form.handleSubmit(async (values) => {
    if (!course) return;
    try {
      await updateDoc(doc(db, 'courses', course.id), {
        title: values.title,
        description: values.description ?? '',
        status: values.status,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to update course', err);
      alert('Kunne ikke oppdatere kursinformasjon.');
    }
  });

  const handleDeleteCourse = async () => {
    if (!course) return;
    const confirmed = window.confirm(
      `Slett kurset "${course.title}"? Dette kan ikke angres.`,
    );
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, 'courses', course.id));
      router.push('/courses');
    } catch (err) {
      console.error('Failed to delete course', err);
      alert('Kunne ikke slette kurset.');
    }
  };

  const moduleList = modules.length ? (
    <div className="space-y-4">
      {modules.map((module) => (
        <div
          key={module.id}
          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Emne #{module.order ?? 0}
              </p>
              <h4 className="text-lg font-semibold text-slate-900">
                {module.title}
              </h4>
              {module.summary && (
                <p className="text-sm text-slate-500">{module.summary}</p>
              )}
              <p className="text-xs text-slate-500">
                {module.questions.length} kontrollspørsmål
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => openEditModule(module.id)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              >
                Rediger
              </button>
              <button
                onClick={() => handleDeleteModule(module.id)}
                className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:border-red-300 hover:bg-red-50"
              >
                Slett
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
      Ingen emner er opprettet ennå. Klikk “Nytt emne” for å komme i gang.
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Kursinformasjon
            </p>
            <h2 className="text-2xl font-semibold text-slate-900">
              {course?.title ?? '…'}
            </h2>
            {course?.createdAt && (
              <p className="text-xs text-slate-500">
                Opprettet {course.createdAt.toLocaleString('no-NO')}
              </p>
            )}
          </div>
          <button
            onClick={handleDeleteCourse}
            className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:border-red-300 hover:bg-red-50"
          >
            Slett kurs
          </button>
        </div>

        <form onSubmit={handleCourseInfoSave} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Tittel
            <input
              {...form.register('title', { required: true })}
              className="rounded-xl border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Status
            <select
              {...form.register('status')}
              className="rounded-xl border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="active">Aktiv</option>
              <option value="inactive">Inaktiv</option>
            </select>
          </label>
          <label className="md:col-span-2 flex flex-col gap-1 text-sm font-medium text-slate-700">
            Beskrivelse
            <textarea
              {...form.register('description')}
              rows={3}
              className="rounded-xl border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </label>

          <div className="md:col-span-2 flex items-center justify-end gap-3">
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Oppdater kurs
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Emner
            </p>
            <p className="text-sm text-slate-500">
              Bakgrunnsinnhold og kontrollspørsmål for kurset.
            </p>
          </div>
          <button
            onClick={openCreateModule}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            + Nytt emne
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Språk
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {languages.map((lang) => (
              <span
                key={lang}
                className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
              >
                {lang.toUpperCase()}
              </span>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addLanguage(languageInput);
              }}
              className="flex items-center gap-2"
            >
              <input
                value={languageInput}
                onChange={(e) => setLanguageInput(e.target.value)}
                placeholder="Legg til språk (f.eks. it)"
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Legg til
              </button>
            </form>
          </div>
        </div>

        {modulesError && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {modulesError}
          </div>
        )}

        {modulesLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-slate-500">
            Laster emner …
          </div>
        ) : (
          <div className="mt-4">{moduleList}</div>
        )}
      </div>

      {isModuleDialogOpen && moduleDraft && (
        <ModuleDialog
          draft={moduleDraft}
          onChange={setModuleDraft}
          onClose={closeModuleDialog}
          onSave={handleSaveModule}
          languages={languages}
          saving={moduleSaving}
        />
      )}
    </div>
  );
}

const ModuleDialog = ({
  draft,
  onChange,
  onClose,
  onSave,
  languages,
  saving,
}: {
  draft: CourseModulePayload;
  onChange: (next: CourseModulePayload) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
  languages: string[];
  saving: boolean;
}) => {
  const updateField = <K extends keyof CourseModulePayload>(
    key: K,
    value: CourseModulePayload[K],
  ) => {
    onChange({ ...draft, [key]: value });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {draft.title ? 'Rediger emne' : 'Nytt emne'}
            </p>
            <h4 className="text-2xl font-semibold text-slate-900">
              {draft.title || 'Emnedetaljer'}
            </h4>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 transition hover:text-slate-700"
            aria-label="Lukk"
          >
            ×
          </button>
        </div>

        <div className="mt-6 space-y-6">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Emnetittel
            <input
              value={draft.title}
              onChange={(e) => updateField('title', e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Sammendrag
            <textarea
              value={draft.summary ?? ''}
              onChange={(e) => updateField('summary', e.target.value)}
              rows={3}
              className="rounded-xl border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </label>

          <LocaleFieldEditor
            label="Tekstlig innhold"
            value={draft.body ?? {}}
            onChange={(next) => updateField('body', next)}
            languages={languages}
            multiline
          />

          <MediaListEditor
            label="Videoer (URL)"
            values={draft.videoUrls}
            onChange={(next) => updateField('videoUrls', next)}
          />
          <MediaListEditor
            label="Bilder (URL)"
            values={draft.imageUrls}
            onChange={(next) => updateField('imageUrls', next)}
          />

          <QuestionListEditor
            questions={draft.questions}
            onChange={(next) => updateField('questions', next)}
            languages={languages}
          />
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            disabled={saving}
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-70"
            disabled={saving}
          >
            {saving ? 'Lagrer …' : 'Lagre emne'}
          </button>
        </div>
      </div>
    </div>
  );
};

const LocaleFieldEditor = ({
  label,
  value,
  onChange,
  languages,
  multiline,
}: {
  label: string;
  value: LocaleStringMap;
  onChange: (next: LocaleStringMap) => void;
  languages: string[];
  multiline?: boolean;
}) => (
  <div className="space-y-3">
    <p className="text-sm font-semibold text-slate-700">{label}</p>
    <div className="grid gap-3 md:grid-cols-2">
      {languages.map((lang) => (
        <label
          key={lang}
          className="flex flex-col gap-1 text-sm font-medium text-slate-700"
        >
          {lang.toUpperCase()}
          {multiline ? (
            <textarea
              value={value?.[lang] ?? ''}
              onChange={(e) =>
                onChange({ ...value, [lang]: e.target.value })
              }
              rows={4}
              className="rounded-xl border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          ) : (
            <input
              value={value?.[lang] ?? ''}
              onChange={(e) =>
                onChange({ ...value, [lang]: e.target.value })
              }
              className="rounded-xl border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          )}
        </label>
      ))}
    </div>
  </div>
);

const MediaListEditor = ({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
}) => {
  const updateValue = (index: number, value: string) => {
    const next = [...values];
    next[index] = value;
    onChange(next);
  };

  const removeValue = (index: number) => {
    onChange(values.filter((_, idx) => idx !== index));
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      {values.map((url, index) => (
        <div key={index} className="flex gap-2">
          <input
            value={url}
            onChange={(e) => updateValue(index, e.target.value)}
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
          <button
            type="button"
            onClick={() => removeValue(index)}
            className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:border-red-300 hover:bg-red-50"
          >
            Fjern
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...values, ''])}
        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      >
        Legg til URL
      </button>
    </div>
  );
};

const QuestionListEditor = ({
  questions,
  onChange,
  languages,
}: {
  questions: CourseQuestion[];
  onChange: (next: CourseQuestion[]) => void;
  languages: string[];
}) => {
  const addQuestion = () => {
    onChange([...questions, createEmptyQuestion(languages)]);
  };

  const updateQuestion = (index: number, question: CourseQuestion) => {
    const next = [...questions];
    next[index] = question;
    onChange(next);
  };

  const removeQuestion = (index: number) => {
    onChange(questions.filter((_, idx) => idx !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">
          Kontrollspørsmål ({questions.length})
        </p>
        <button
          type="button"
          onClick={addQuestion}
          className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
        >
          Legg til spørsmål
        </button>
      </div>
      {questions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
          Ingen kontrollspørsmål lagt til ennå.
        </div>
      ) : (
        questions.map((question, index) => (
          <QuestionEditor
            key={question.id}
            index={index}
            question={question}
            onChange={(next) => updateQuestion(index, next)}
            onRemove={() => removeQuestion(index)}
            languages={languages}
          />
        ))
      )}
    </div>
  );
};

const QuestionEditor = ({
  question,
  onChange,
  onRemove,
  languages,
  index,
}: {
  question: CourseQuestion;
  onChange: (next: CourseQuestion) => void;
  onRemove: () => void;
  languages: string[];
  index: number;
}) => {
  const updateLocaleField = (key: 'title' | 'contentText', map: LocaleStringMap) => {
    onChange({ ...question, [key]: map });
  };

  const addAlternative = () => {
    onChange({
      ...question,
      alternatives: [...question.alternatives, createEmptyAlternative(languages)],
    });
  };

  const updateAlternative = (altId: string, map: LocaleStringMap) => {
    onChange({
      ...question,
      alternatives: question.alternatives.map((alt) =>
        alt.id === altId ? { ...alt, altText: map } : alt,
      ),
    });
  };

  const removeAlternative = (altId: string) => {
    const filtered = question.alternatives.filter((alt) => alt.id !== altId);
    let nextCorrect = question.correctAnswerId;
    if (nextCorrect === altId && filtered.length > 0) {
      nextCorrect = filtered[0].id;
    }
    onChange({
      ...question,
      alternatives: filtered,
      correctAnswerId: nextCorrect,
    });
  };

  const updateCorrectAnswer = (altId: string) => {
    onChange({ ...question, correctAnswerId: altId });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Spørsmål #{index + 1}
          </p>
          <p className="text-xs text-slate-500">
            {question.alternatives.length} alternativer
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:border-red-300 hover:bg-red-50"
        >
          Fjern spørsmål
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <LocaleFieldEditor
          label="Spørsmålstittel"
          value={question.title}
          onChange={(next) => updateLocaleField('title', next)}
          languages={languages}
        />
        <LocaleFieldEditor
          label="Introduksjon / beskrivende tekst"
          value={question.contentText}
          onChange={(next) => updateLocaleField('contentText', next)}
          languages={languages}
          multiline
        />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Svaralternativer</p>
            <button
              type="button"
              onClick={addAlternative}
              className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            >
              Legg til alternativ
            </button>
          </div>

          {question.alternatives.map((alternative, idx) => (
            <div
              key={alternative.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex items-start justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Alternativ {idx + 1}
                </p>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                    <input
                      type="radio"
                      name={`question-${question.id}-correct`}
                      checked={question.correctAnswerId === alternative.id}
                      onChange={() => updateCorrectAnswer(alternative.id)}
                    />
                    Riktig svar
                  </label>
                  {question.alternatives.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeAlternative(alternative.id)}
                      className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:border-red-300 hover:bg-red-50"
                    >
                      Fjern
                    </button>
                  )}
                </div>
              </div>

              <LocaleFieldEditor
                label="Alternativ tekst"
                value={alternative.altText}
                onChange={(next) => updateAlternative(alternative.id, next)}
                languages={languages}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

