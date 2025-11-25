'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';

import { useCourseProgress } from '@/hooks/useCourseProgress';
import { useCourseModules } from '@/hooks/useCourseModules';
import type {
  Course,
  CourseModule,
  CourseQuestion,
  CourseQuestionAlternative,
} from '@/types/course';
import {
  getLocalizedList,
  getLocalizedValue,
  getPreferredLocale,
} from '@/utils/localization';
import { getTranslation } from '@/utils/translations';

interface ConsumerModuleViewProps {
  course: Course;
  module: CourseModule;
  basePath?: string; // e.g. '/my-courses'
}

const isYouTubeUrl = (url: string): boolean =>
  /youtu\.be|youtube\.com/.test(url.toLowerCase());

const getAlternativeLabel = (
  alternative: CourseQuestionAlternative,
  locale: string,
) => getLocalizedValue(alternative.altText, locale) || 'Alternativ';

export default function ConsumerModuleView({
  course,
  module,
  basePath = '/my-courses',
}: ConsumerModuleViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedLang = searchParams.get('lang');
  const { completedModules, setModuleCompletion } = useCourseProgress(course.id);
  const { modules } = useCourseModules(course.id); // Needed to find next module

  const availableLocales = useMemo(() => {
    const set = new Set<string>();
    if (module.title) Object.keys(module.title).forEach((lang) => set.add(lang));
    if (module.summary) Object.keys(module.summary).forEach((lang) => set.add(lang));
    if (module.body) Object.keys(module.body).forEach((lang) => set.add(lang));
    Object.keys(module.videoUrls ?? {}).forEach((lang) => set.add(lang));
    Object.keys(module.imageUrls ?? {}).forEach((lang) => set.add(lang));
    module.questions?.forEach((question) => {
      Object.keys(question.contentText ?? {}).forEach((lang) => set.add(lang));
      question.alternatives.forEach((alternative) => {
        Object.keys(alternative.altText ?? {}).forEach((lang) => set.add(lang));
      });
    });
    if (course.title) Object.keys(course.title).forEach((lang) => set.add(lang));
    return Array.from(set);
  }, [module, course]);

  const locale = useMemo(
    () => getPreferredLocale(availableLocales, requestedLang),
    [availableLocales, requestedLang],
  );

  const t = getTranslation(locale);

  const videos = getLocalizedList(module.videoUrls, locale);
  const images = getLocalizedList(module.imageUrls, locale);
  const moduleTitle = getLocalizedValue(module.title, locale) || t.modules.module;
  const summary = getLocalizedValue(module.summary, locale);
  const rawBodyHtml = getLocalizedValue(module.body, locale);
  const bodyHtml = useMemo(() => {
    if (!rawBodyHtml) return '';
    const containsHtmlTags = /<\/?[a-z][\s\S]*>/i.test(rawBodyHtml);
    if (containsHtmlTags) {
      return rawBodyHtml;
    }
    const parts = rawBodyHtml.split('\n').map((line) => line.trim());
    return parts
      .map((line) => (line.length ? `<p>${line}</p>` : '<br />'))
      .join('');
  }, [rawBodyHtml]);
  const questions = module.questions ?? [];
  const isModuleCompleted = completedModules.includes(module.id);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [showCourseComplete, setShowCourseComplete] = useState(false);
  const courseCompletionAcknowledgedRef = useRef(false);

  const currentQuestion: CourseQuestion | undefined = questions[currentIndex];
  const handleSelectAlternative = (questionId: string, alternativeId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: alternativeId }));
  };

  const handleNext = () => {
    if (!currentQuestion) return;
    if (currentIndex === questions.length - 1) {
      setShowSummary(true);
    } else {
      setCurrentIndex((prev) => Math.min(prev + 1, questions.length - 1));
    }
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const resetQuiz = () => {
    courseCompletionAcknowledgedRef.current = false;
    setAnswers({});
    setCurrentIndex(0);
    setShowSummary(false);
    setShowCourseComplete(false);
  };

  const incorrectQuestions = useMemo(
    () =>
      questions.filter(
        (question) => answers[question.id] !== question.correctAnswerId,
      ),
    [questions, answers],
  );

  useEffect(() => {
    if (!module.id || !showSummary || questions.length === 0) {
      return;
    }
    const allCorrect = incorrectQuestions.length === 0;
    if (allCorrect) {
      setModuleCompletion(module.id, true).then(() => {
        // Check for overall course completion
        if (!modules) return;
        
        const allOtherModulesCompleted = modules
          .filter(m => m.id !== module.id)
          .every(m => completedModules.includes(m.id));
          
        if (allOtherModulesCompleted && !courseCompletionAcknowledgedRef.current) {
          setShowCourseComplete(true);
        }
      }).catch((err) => {
        console.error('Failed to update module progress', err);
      });
    }
  }, [
    module.id,
    showSummary,
    incorrectQuestions.length,
    questions.length,
    setModuleCompletion,
    completedModules,
    modules,
  ]);

  useEffect(() => {
    if (!showCourseComplete) {
      return;
    }

    confetti({
      particleCount: 50,
      spread: 65,
      angle: 115,
      startVelocity: 40,
      gravity: 1.05,
      origin: { x: 0.48, y: 0.58 },
      colors: ['#10b981', '#34d399', '#059669', '#f8fafc'],
    });
    confetti({
      particleCount: 50,
      spread: 65,
      angle: 65,
      startVelocity: 40,
      gravity: 1.05,
      origin: { x: 0.52, y: 0.58 },
        colors: ['#10b981', '#34d399', '#059669', '#f8fafc'],
    });
  }, [showCourseComplete]);

  const courseOverviewHref = useMemo(
    () => `${basePath}/${course.id}?lang=${locale}`,
    [basePath, course.id, locale],
  );

  const acknowledgeCompletion = useCallback(() => {
    courseCompletionAcknowledgedRef.current = true;
    setShowSummary(false);
    setShowCourseComplete(false);
  }, []);

  const handleReturnToCourse = useCallback(() => {
    acknowledgeCompletion();
    router.replace(courseOverviewHref);
  }, [acknowledgeCompletion, router, courseOverviewHref]);

  const autoRedirectedRef = useRef(false);

  useEffect(() => {
    if (!showCourseComplete) {
      autoRedirectedRef.current = false;
      return;
    }

    if (autoRedirectedRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      autoRedirectedRef.current = true;
      handleReturnToCourse();
    }, 2000);

    return () => clearTimeout(timer);
  }, [showCourseComplete, handleReturnToCourse]);

  // Find next module
  const nextModuleId = useMemo(() => {
    if (!modules) return null;
    const currentIndex = modules.findIndex(m => m.id === module.id);
    if (currentIndex === -1 || currentIndex === modules.length - 1) return null;
    return modules[currentIndex + 1].id;
  }, [modules, module.id]);

  const handleGoToNextModule = () => {
    if (nextModuleId) {
      router.push(`${basePath}/${course.id}/modules/${nextModuleId}?lang=${locale}`);
    }
  };

  const scorePercentage = questions.length
    ? Math.round(
        ((questions.length - incorrectQuestions.length) / questions.length) * 100,
      )
    : 0;

  if (showCourseComplete) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center px-4">
        <div className="rounded-full bg-emerald-100 p-6">
          <div className="text-6xl">🏆</div>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">
            {t.modules.courseCompleteHeading}
          </h1>
          <p className="text-lg text-slate-600">
            {t.modules.courseCompleteDescription(
              getLocalizedValue(course.title, locale),
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={handleReturnToCourse}
          className="mt-4 rounded-2xl bg-slate-900 px-8 py-3 text-base font-semibold text-white transition hover:bg-slate-800"
        >
          {t.modules.backToOverview}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-12">
      <header className="space-y-6">
        <Link
          href={courseOverviewHref}
          className="text-sm font-semibold text-slate-500 transition hover:text-slate-900"
        >
          ← {t.modules.backToOverview}
        </Link>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t.modules.module}
            </p>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isModuleCompleted
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {isModuleCompleted ? t.courses.completed : t.courses.notStarted}
            </span>
          </div>
          <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
            {moduleTitle}
          </h1>
          {summary && <p className="mt-3 text-base text-slate-600">{summary}</p>}
        </div>
      </header>

      {(images.length > 0 || videos.length > 0) && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <h2 className="text-xl font-semibold text-slate-900">{t.modules.mediaGallery}</h2>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            {images.map((url) => (
              <div
                key={url}
                className="relative h-56 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
              >
                <img src={url} alt="Modulbilde" className="h-full w-full object-cover" />
              </div>
            ))}
            {videos.map((url) => (
              <div
                key={url}
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-black"
              >
                {isYouTubeUrl(url) ? (
                  <iframe
                    src={url}
                    title="Modulvideo"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="aspect-video w-full"
                  />
                ) : (
                  <video controls className="aspect-video w-full">
                    <source src={url} />
                    {t.modules.videoNotSupported}
                  </video>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {bodyHtml && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <div
            className="prose prose-slate max-w-none"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        </section>
      )}

      {questions.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">{t.modules.questions}</h2>
            <span className="text-sm text-slate-500">
              {showSummary
                ? t.modules.summary
                : `${t.modules.question} ${currentIndex + 1} av ${questions.length}`}
            </span>
          </div>

          {showSummary ? (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
                <p>
                  {t.modules.result(questions.length - incorrectQuestions.length, questions.length, scorePercentage)}
                </p>
              </div>
              {incorrectQuestions.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-slate-700">
                    {t.modules.reviewQuestions}
                  </p>
                  {incorrectQuestions.map((question) => {
                    const questionText = getLocalizedValue(
                      question.contentText,
                      locale,
                    );
                    const correctAlternative = question.alternatives.find(
                      (alternative) => alternative.id === question.correctAnswerId,
                    );
                    const userAlternative = question.alternatives.find(
                      (alternative) => alternative.id === answers[question.id],
                    );
                    return (
                      <div
                        key={question.id}
                        className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4"
                      >
                        <p className="text-sm font-semibold text-red-700">
                          {questionText || t.modules.question}
                        </p>
                        <p className="mt-2 text-sm text-red-600">
                          {t.modules.yourAnswer}{' '}
                          {userAlternative
                            ? getAlternativeLabel(userAlternative, locale)
                            : '—'}
                        </p>
                        {correctAlternative && (
                          <p className="text-sm text-slate-600">
                            {t.modules.correctAnswer}{' '}
                            {getAlternativeLabel(correctAlternative, locale)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
                  {t.modules.allCorrect}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-3">
                  {incorrectQuestions.length > 0 && (
                    <button
                    type="button"
                    onClick={resetQuiz}
                      className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {t.modules.retry}
                    </button>
                  )}
                  <Link
                    href={courseOverviewHref}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    {t.modules.backToOverview}
                  </Link>
                </div>
                {incorrectQuestions.length === 0 && nextModuleId && !showCourseComplete && (
                  <button
                  type="button"
                    onClick={handleGoToNextModule}
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    {t.modules.nextModule}
                  </button>
                )}
              </div>
            </div>
          ) : currentQuestion ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700">
                {getLocalizedValue(currentQuestion.contentText, locale) || t.modules.question}
              </div>
              <div className="space-y-3">
                {currentQuestion.alternatives.map((alternative) => {
                  const label = getAlternativeLabel(alternative, locale);
                  const isSelected = answers[currentQuestion.id] === alternative.id;
                  return (
                    <button
                      key={alternative.id}
                      onClick={() =>
                        handleSelectAlternative(currentQuestion.id, alternative.id)
                      }
                      className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                        isSelected
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t.modules.previousQuestion}
                </button>
                <button
                  onClick={handleNext}
                  disabled={!answers[currentQuestion.id]}
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {currentIndex === questions.length - 1
                    ? t.modules.finishQuiz
                    : t.modules.nextQuestion}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600">{t.modules.noQuestions}</p>
          )}
        </section>
      )}

      {questions.length === 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm md:p-10">
          {t.modules.noQuestionsYet}
        </div>
      )}
    </div>
  );
}
