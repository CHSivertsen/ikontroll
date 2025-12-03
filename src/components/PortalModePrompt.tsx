'use client';

import { useAuth } from '@/context/AuthContext';

export const PortalModePrompt = () => {
  const { needsRoleChoice, setPortalMode } = useAuth();

  if (!needsRoleChoice) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md space-y-5 rounded-2xl bg-white p-6 text-center shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Velg arbeidsmodus
        </p>
        <h2 className="text-2xl font-semibold text-slate-900">
          Hvordan vil du bruke IKontroll?
        </h2>
        <p className="text-sm text-slate-600">
          Du har tilgang som administrator og som kursdeltaker. Velg hvilken opplevelse du vil starte
          med nå. Du kan alltid bytte senere fra menyen.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => setPortalMode('admin')}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Administrator
          </button>
          <button
            onClick={() => setPortalMode('user')}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Bruker
          </button>
        </div>
      </div>
    </div>
  );
};

export default PortalModePrompt;


