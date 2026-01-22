'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';

import { auth } from '@/lib/firebase';

export default function CourseSignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam) {
      setCode(codeParam);
    }
  }, [searchParams]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/course-invite/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          email,
          phone,
          password,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Kunne ikke opprette bruker.');
      }

      const data = (await response.json().catch(() => ({}))) as { token?: string };
      if (!data.token) {
        throw new Error('Mangler innloggingstoken.');
      }

      await signInWithCustomToken(auth, data.token);
      router.replace('/my-courses');
    } catch (err) {
      console.error('Failed to sign up', err);
      setError(err instanceof Error ? err.message : 'Kunne ikke opprette bruker.');
    } finally {
      setSubmitting(false);
    }
  };

  const loginHref = code ? `/login?code=${encodeURIComponent(code)}` : '/login';

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl bg-white p-8 shadow-xl"
      >
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            IKontroll
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">Registrer deg</h1>
          <p className="text-sm text-slate-500">
            Registrer deg med kurskoden du har fått fra arbeidsgiver.
          </p>
        </div>

        <label className="block space-y-2 text-sm font-medium text-slate-700">
          Kurskode
          <input
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value.trim().toUpperCase())}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            required
          />
        </label>

        <label className="block space-y-2 text-sm font-medium text-slate-700">
          E-post
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            required
          />
        </label>

        <label className="block space-y-2 text-sm font-medium text-slate-700">
          Telefon
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            required
          />
        </label>

        <label className="block space-y-2 text-sm font-medium text-slate-700">
          Passord
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            required
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
        >
          {submitting ? 'Oppretter...' : 'Opprett konto'}
        </button>

        <div className="text-center text-sm">
          Allerede registrert?{' '}
          <Link href={loginHref} className="text-slate-600 underline transition hover:text-slate-900">
            Logg inn her
          </Link>
        </div>
      </form>
    </main>
  );
}
