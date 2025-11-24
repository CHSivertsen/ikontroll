import CourseManager from './CourseManager';

export default function CoursesPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Innhold
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Kurs</h1>
        <p className="text-sm text-slate-500">
          Opprett kurs, administrer emner og legg til kontrollspørsmål.
        </p>
      </div>
      <CourseManager />
    </section>
  );
}

