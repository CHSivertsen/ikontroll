import { adminDb } from '@/lib/firebaseAdmin';

type WeeklyBucket = {
  label: string;
  start: Date;
  end: Date;
  newCustomers: number;
  newUsers: number;
  completedCourses: number;
};

type OwnerDashboardMetrics = {
  totals: {
    customers: number;
    activeCustomers: number;
    inactiveCustomers: number;
    users: number;
    courses: number;
    completedCourses: number;
  };
  weekly: WeeklyBucket[];
  generatedAt: Date;
};

const WEEK_BUCKET_COUNT = 8;
const numberFormatter = new Intl.NumberFormat('nb-NO');
const dateTimeFormatter = new Intl.DateTimeFormat('nb-NO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export default async function DashboardPage() {
  const metrics = await getOwnerDashboardMetrics();
  const latestWeek = metrics.weekly[metrics.weekly.length - 1];
  const previousWeek = metrics.weekly[metrics.weekly.length - 2];
  const customerDelta = latestWeek
    ? latestWeek.newCustomers - (previousWeek?.newCustomers ?? 0)
    : undefined;
  const userDelta = latestWeek ? latestWeek.newUsers - (previousWeek?.newUsers ?? 0) : undefined;

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Systemoversikt
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Nøkkeltall for kunder, brukere og kursaktivitet i hele plattformen.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Kunder totalt"
          value={metrics.totals.customers}
          detail={`${metrics.totals.activeCustomers} aktive • ${metrics.totals.inactiveCustomers} inaktive`}
          delta={customerDelta}
        />
        <MetricCard label="Brukere totalt" value={metrics.totals.users} delta={userDelta} />
        <MetricCard label="Kurs totalt" value={metrics.totals.courses} />
        <MetricCard label="Fullførte kurs" value={metrics.totals.completedCourses} />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Ukentlig utvikling
            </p>
            <h2 className="text-xl font-semibold text-slate-900">
              Nye kunder, brukere og fullførte kurs
            </h2>
          </div>
          <p className="text-xs font-semibold text-slate-400">
            Sist oppdatert {dateTimeFormatter.format(metrics.generatedAt)}
          </p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-3 pr-4">Uke</th>
                <th className="py-3 pr-4">Nye kunder</th>
                <th className="py-3 pr-4">Nye brukere</th>
                <th className="py-3 pr-4">Fullførte kurs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {metrics.weekly.map((week) => (
                <tr key={week.label}>
                  <td className="py-3 pr-4 font-medium text-slate-900">{week.label}</td>
                  <td className="py-3 pr-4 text-slate-600">{numberFormatter.format(week.newCustomers)}</td>
                  <td className="py-3 pr-4 text-slate-600">{numberFormatter.format(week.newUsers)}</td>
                  <td className="py-3 pr-4 text-slate-600">{numberFormatter.format(week.completedCourses)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {metrics.weekly.every(
            (week) => week.newCustomers === 0 && week.newUsers === 0 && week.completedCourses === 0,
          ) && (
            <p className="py-6 text-center text-sm text-slate-400">
              Ingen aktivitet registrert de siste ukene.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
  delta,
}: {
  label: string;
  value: number;
  detail?: string;
  delta?: number;
}) {
  const deltaClass =
    typeof delta === 'number'
      ? delta > 0
        ? 'text-emerald-600'
        : delta < 0
          ? 'text-red-600'
          : 'text-slate-400'
      : null;

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-900">{numberFormatter.format(value)}</p>
      {typeof delta === 'number' && (
        <p className={`mt-1 text-xs font-semibold ${deltaClass}`}>
          {delta === 0 ? '0' : `${delta > 0 ? '+' : ''}${numberFormatter.format(delta)}`} siste uke
        </p>
      )}
      {detail && <p className="mt-1 text-xs font-semibold text-slate-400">{detail}</p>}
    </div>
  );
}

async function getOwnerDashboardMetrics(): Promise<OwnerDashboardMetrics> {
  const weeklyBuckets = createWeekBuckets(WEEK_BUCKET_COUNT);
  const earliestStart = weeklyBuckets[0]?.start ?? startOfWeek(new Date());

  try {
    const [
      totalCustomersSnap,
      activeCustomersSnap,
      inactiveCustomersSnap,
      totalUsersSnap,
      totalCoursesSnap,
      recentCustomersSnap,
      recentUsersSnap,
      coursesSnapshot,
    ] = await Promise.all([
      adminDb.collection('customers').count().get(),
      adminDb.collection('customers').where('status', '==', 'active').count().get(),
      adminDb.collection('customers').where('status', '==', 'inactive').count().get(),
      adminDb.collection('users').count().get(),
      adminDb.collection('courses').count().get(),
      adminDb.collection('customers').where('createdAt', '>=', earliestStart).get(),
      adminDb.collection('users').where('createdAt', '>=', earliestStart).get(),
      adminDb.collection('courses').get(),
    ]);

    recentCustomersSnap.forEach((docSnap) => {
      const createdAt = docSnap.get('createdAt')?.toDate?.();
      assignToWeekBucket(weeklyBuckets, createdAt, 'newCustomers');
    });

    recentUsersSnap.forEach((docSnap) => {
      const createdAt = docSnap.get('createdAt')?.toDate?.();
      assignToWeekBucket(weeklyBuckets, createdAt, 'newUsers');
    });

    const courseModuleMap = new Map<string, Set<string>>();
    await Promise.all(
      coursesSnapshot.docs.map(async (courseDoc) => {
        const modulesSnapshot = await courseDoc.ref.collection('modules').get();
        const moduleIds = new Set(modulesSnapshot.docs.map((moduleDoc) => moduleDoc.id));
        courseModuleMap.set(courseDoc.id, moduleIds);
      }),
    );

    const progressSnapshot = await adminDb.collectionGroup('courseProgress').get();
    let totalCompletedCourses = 0;

    progressSnapshot.forEach((docSnap) => {
      const courseId = docSnap.id;
      const moduleIds = courseModuleMap.get(courseId);
      if (!moduleIds || moduleIds.size === 0) {
        return;
      }
      const completedModules = Array.isArray(docSnap.get('completedModules'))
        ? (docSnap.get('completedModules') as string[])
        : [];
      const completedSet = new Set(completedModules.filter(Boolean));
      const isCourseCompleted = [...moduleIds].every((moduleId) => completedSet.has(moduleId));
      if (!isCourseCompleted) {
        return;
      }
      totalCompletedCourses += 1;

      const updatedAt = docSnap.get('updatedAt')?.toDate?.();
      assignToWeekBucket(weeklyBuckets, updatedAt, 'completedCourses');
    });

    return {
      totals: {
        customers: totalCustomersSnap.data().count ?? 0,
        activeCustomers: activeCustomersSnap.data().count ?? 0,
        inactiveCustomers: inactiveCustomersSnap.data().count ?? 0,
        users: totalUsersSnap.data().count ?? 0,
        courses: totalCoursesSnap.data().count ?? 0,
        completedCourses: totalCompletedCourses,
      },
      weekly: weeklyBuckets,
      generatedAt: new Date(),
    };
  } catch (error) {
    console.error('Failed to load owner dashboard metrics', error);
    return {
      totals: {
        customers: 0,
        activeCustomers: 0,
        inactiveCustomers: 0,
        users: 0,
        courses: 0,
        completedCourses: 0,
      },
      weekly: weeklyBuckets,
      generatedAt: new Date(),
    };
  }
}

function createWeekBuckets(count: number): WeeklyBucket[] {
  const buckets: WeeklyBucket[] = [];
  const now = new Date();
  for (let index = count - 1; index >= 0; index -= 1) {
    const start = startOfWeek(addDays(now, -7 * index));
    const end = addDays(start, 7);
    const { week, year } = getIsoWeekInfo(start);
    const labelYear = year !== now.getFullYear() ? ` ${year}` : '';
    buckets.push({
      label: `Uke ${week}${labelYear}`,
      start,
      end,
      newCustomers: 0,
      newUsers: 0,
      completedCourses: 0,
    });
  }
  return buckets;
}

function startOfWeek(date: Date): Date {
  const clone = new Date(date);
  clone.setHours(0, 0, 0, 0);
  const day = clone.getDay() === 0 ? 6 : clone.getDay() - 1; // Monday as start
  clone.setDate(clone.getDate() - day);
  return clone;
}

function addDays(date: Date, days: number): Date {
  const clone = new Date(date);
  clone.setDate(clone.getDate() + days);
  return clone;
}

function assignToWeekBucket(
  buckets: WeeklyBucket[],
  date: Date | undefined,
  field: 'newCustomers' | 'newUsers' | 'completedCourses',
) {
  if (!date) {
    return;
  }
  const target = buckets.find((bucket) => date >= bucket.start && date < bucket.end);
  if (target) {
    target[field] += 1;
  }
}

function getIsoWeekInfo(date: Date) {
  const target = new Date(date.valueOf());
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstThursdayDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstThursdayDayNr + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / 604800000);
  return { week, year: target.getFullYear() };
}

