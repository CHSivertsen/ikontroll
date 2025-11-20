export default function CoursesPage() {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Innhold
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Kurs</h1>
        <p className="text-sm text-slate-500">
          Sett opp kursbibliotek, progresjon og vurderinger.
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-500">
          Vi kobler denne siden mot kurs-samlingen etter at datamodellen er
          klar.
        </p>
      </div>
    </section>
  );
}

