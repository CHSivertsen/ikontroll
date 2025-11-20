export default function DashboardPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Oversikt
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Her kommer KPI-er, varsler og oppgaver for ditt selskap.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6">
          <p className="text-sm font-medium text-slate-500">Snarveier</p>
          <p className="text-slate-400">
            Legg til kort for å vise kritiske tall eller snarveier.
          </p>
        </div>
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6">
          <p className="text-sm font-medium text-slate-500">Siste aktivitet</p>
          <p className="text-slate-400">
            Viste logg eller hendelser når data er klare.
          </p>
        </div>
      </div>
    </section>
  );
}

