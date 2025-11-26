'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { signInWithCustomToken } from 'firebase/auth';

import { auth } from '@/lib/firebase';

const normalizeRedirect = (value: string | null) => {
  if (!value) {
    return '/my-courses';
  }
  return value.startsWith('/') ? value : '/my-courses';
};

function MagicLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const attemptedRef = useRef(false);

  const token = useMemo(() => searchParams.get('token'), [searchParams]);
  const code = useMemo(() => searchParams.get('code'), [searchParams]);
  const redirectTarget = useMemo(
    () => normalizeRedirect(searchParams.get('redirect')),
    [searchParams],
  );

  useEffect(() => {
    if (attemptedRef.current || status === 'error') {
      return;
    }

    const performLogin = async () => {
      let effectiveToken = token ?? null;
      let effectiveRedirect = redirectTarget;

      try {
        if (!effectiveToken && code) {
          const response = await fetch('/api/magic-link/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          });

          if (!response.ok) {
            let errorText = '';
            try {
              const payload = (await response.json()) as { error?: string };
              errorText = payload.error ?? '';
            } catch {
              errorText = await response.text();
            }
            throw new Error(errorText || 'Kunne ikke hente magisk lenke / Failed to resolve link');
          }

          const payload = (await response.json()) as { token: string; redirect?: string };
          effectiveToken = payload.token;
          if (payload.redirect) {
            effectiveRedirect = normalizeRedirect(payload.redirect);
          }
        }

        if (!effectiveToken) {
          throw new Error('Magisk lenke mangler eller er ugyldig. / Magic link missing or invalid.');
        }

        attemptedRef.current = true;
        await signInWithCustomToken(auth, effectiveToken);
        router.replace(effectiveRedirect);
      } catch (error) {
        console.error('Magic login failed', error);
        setStatus('error');
        setErrorMessage(
          (error as Error)?.message ??
            'Kunne ikke logge deg inn automatisk. Lenken kan ha utløpt. / Automatic login failed, the link may have expired.',
        );
      }
    };

    performLogin();
  }, [token, code, redirectTarget, router, status]);

  const isLoading = status === 'loading';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {isLoading ? (
          <>
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
            <h1 className="text-xl font-semibold text-slate-900">Logger deg inn …</h1>
            <p className="mt-2 text-sm text-slate-500">
              Vi bruker lenken du fikk tilsendt for å logge deg inn automatisk.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Signing you in automatically with your secure link.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-slate-900">Kunne ikke logge inn</h1>
            <p className="mt-2 text-sm text-slate-600">
              {errorMessage ??
                'Lenken er ugyldig eller utløpt. Prøv igjen eller bruk vanlig innlogging.'}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/login"
                className="w-full rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Gå til innlogging / Go to login
              </Link>
              <Link
                href="/my-courses"
                className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Mine kurs / My courses
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function MagicLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
            <h1 className="text-xl font-semibold text-slate-900">Logger deg inn …</h1>
            <p className="mt-2 text-sm text-slate-500">
              Vi bruker lenken du fikk tilsendt for å logge deg inn automatisk.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Signing you in automatically with your secure link.
            </p>
          </div>
        </div>
      }
    >
      <MagicLoginContent />
    </Suspense>
  );
}

