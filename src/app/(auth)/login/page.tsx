'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';

import { useAuth } from '@/context/AuthContext';
import { auth } from '@/lib/firebase';

export default function LoginPage() {
  const router = useRouter();
  const { firebaseUser, loading, isSystemOwner, isCustomerAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading || !firebaseUser) {
      return;
    }

    // Check for roles to determine redirect
    // We use the same flags as the DashboardLayout to ensure consistency
    if (isSystemOwner || isCustomerAdmin) {
      router.replace('/dashboard');
    } else {
      router.replace('/my-courses');
    }
  }, [firebaseUser, loading, isSystemOwner, isCustomerAdmin, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Navigation is handled by the useEffect above
    } catch (err) {
      console.error(err);
      setError('Feil e-post eller passord.');
      setSubmitting(false);
    }
  };

  if (loading || firebaseUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-xl">
          Logger deg inn …
        </div>
      </main>
    );
  }

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
          <h1 className="text-2xl font-semibold text-slate-900">Logg inn</h1>
          <p className="text-sm text-slate-500">
            Bruk e-post og passordet du fikk tilsendt.
          </p>
        </div>

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
          {submitting ? 'Logger inn…' : 'Logg inn'}
        </button>
      </form>
    </main>
  );
}
