'use client';

import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useCustomer } from '@/hooks/useCustomer';
import { useCourses } from '@/hooks/useCourses';
import {
  CustomerUserRecord,
  useCustomerUsers,
} from '@/hooks/useCustomerUsers';
import { useUsersCourseProgress } from '@/hooks/useUsersCourseProgress';
import { useCourseModuleCounts } from '@/hooks/useCourseModuleCounts';

type OwnerWeeklyBucket = {
  label: string;
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
  weekly: OwnerWeeklyBucket[];
  generatedAt: string;
};

type UserAssignment = {
  courseId: string;
  title: string;
  percent: number;
  completedModules: number;
  totalModules: number;
  isCompleted: boolean;
};

type CustomerUserRow = CustomerUserRecord & {
  assignments: UserAssignment[];
  completedCount: number;
};

export default function DashboardPage() {
  const { isSystemOwner, isCustomerAdmin } = useAuth();

  if (isSystemOwner) {
    return <SystemOwnerDashboard />;
  }

  if (isCustomerAdmin) {
    return <CustomerAdminDashboard />;
  }

  return (
    <section className="space-y-4">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Dashboard
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Ingen tilgang</h1>
        <p className="text-sm text-slate-500">
          Du har ikke en rolle som gir tilgang til dashboardet.
        </p>
      </header>
    </section>
  );
}

const SystemOwnerDashboard = () => {
  const [metrics, setMetrics] = useState<OwnerDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const numberFormatter = useMemo(() => new Intl.NumberFormat('nb-NO'), []);
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('nb-NO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/dashboard/system-owner');
        if (!response.ok) {
          throw new Error('Failed to load dashboard metrics');
        }
        const json = (await response.json()) as OwnerDashboardMetrics;
        if (!cancelled) {
          setMetrics(json);
          setError(null);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError('Kunne ikke hente nøkkeltall.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const orderedWeeks = useMemo(() => {
    if (!metrics) return [];
    return [...metrics.weekly].reverse();
  }, [metrics]);

  const latestWeek = metrics?.weekly[metrics.weekly.length - 1];
  const previousWeek = metrics?.weekly[metrics.weekly.length - 2];
  const customerDelta = latestWeek
    ? latestWeek.newCustomers - (previousWeek?.newCustomers ?? 0)
    : undefined;
  const userDelta = latestWeek
    ? latestWeek.newUsers - (previousWeek?.newUsers ?? 0)
    : undefined;

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

      {loading && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Laster nøkkeltall …</p>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {!loading && metrics && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Kunder totalt"
              value={metrics.totals.customers}
              detail={`${metrics.totals.activeCustomers} aktive • ${metrics.totals.inactiveCustomers} inaktive`}
              delta={customerDelta}
              numberFormatter={numberFormatter}
            />
            <MetricCard
              label="Brukere totalt"
              value={metrics.totals.users}
              delta={userDelta}
              numberFormatter={numberFormatter}
            />
            <MetricCard
              label="Kurs totalt"
              value={metrics.totals.courses}
              numberFormatter={numberFormatter}
            />
            <MetricCard
              label="Fullførte kurs"
              value={metrics.totals.completedCourses}
              numberFormatter={numberFormatter}
            />
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
                Sist oppdatert {dateTimeFormatter.format(new Date(metrics.generatedAt))}
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
                  {orderedWeeks.map((week) => (
                    <tr key={week.label}>
                      <td className="py-3 pr-4 font-medium text-slate-900">{week.label}</td>
                      <td className="py-3 pr-4 text-slate-600">
                        {numberFormatter.format(week.newCustomers)}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {numberFormatter.format(week.newUsers)}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {numberFormatter.format(week.completedCourses)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {metrics.weekly.every(
                (week) =>
                  week.newCustomers === 0 &&
                  week.newUsers === 0 &&
                  week.completedCourses === 0,
              ) && (
                <p className="py-6 text-center text-sm text-slate-400">
                  Ingen aktivitet registrert de siste ukene.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
};

const CustomerAdminDashboard = () => {
  const { activeCustomerId } = useAuth();
  const { customer, loading: customerLoading } = useCustomer(null, activeCustomerId ?? null);
  const { courses, loading: coursesLoading } = useCourses(customer?.createdByCompanyId ?? null);
  const { users, loading: usersLoading } = useCustomerUsers(activeCustomerId ?? null);

  const customerCourseIds = useMemo(
    () => customer?.courseIds ?? [],
    [customer?.courseIds],
  );

  const visibleCourses = useMemo(
    () => courses.filter((course) => customerCourseIds.includes(course.id)),
    [courses, customerCourseIds],
  );

  const courseNameMap = useMemo(() => {
    const map = new Map<string, string>();
    visibleCourses.forEach((course) => {
      let title = 'Uten tittel';
      if (typeof course.title === 'object') {
        title = course.title.no ?? course.title.en ?? 'Uten tittel';
      } else if (typeof course.title === 'string') {
        title = course.title;
      }
      map.set(course.id, title);
    });
    return map;
  }, [visibleCourses]);

  const moduleCounts = useCourseModuleCounts(customerCourseIds);
  const progressMap = useUsersCourseProgress(users.map((user) => user.id));

  const numberFormatter = useMemo(() => new Intl.NumberFormat('nb-NO'), []);

  const userRows: CustomerUserRow[] = useMemo(() => {
    return users.map((user) => {
      const assignments: UserAssignment[] = user.assignedCourseIds
        .filter((courseId) => customerCourseIds.includes(courseId))
        .map((courseId) => {
          const title = courseNameMap.get(courseId) ?? 'Ukjent kurs';
          const totalModules = moduleCounts[courseId] ?? 0;
          const completedModules = progressMap[user.id]?.[courseId]?.length ?? 0;
          const percent =
            totalModules > 0
              ? Math.min(100, Math.round((completedModules / totalModules) * 100))
              : 0;
          const isCompleted =
            totalModules > 0 && completedModules >= totalModules;
          return {
            courseId,
            title,
            percent,
            completedModules,
            totalModules,
            isCompleted,
          };
        });
      const completedCount = assignments.filter((assignment) => assignment.isCompleted).length;
      return {
        ...user,
        assignments,
        completedCount,
      };
    });
  }, [users, customerCourseIds, courseNameMap, moduleCounts, progressMap]);

  const totalUsers = users.filter((user) => user.membershipRoles.includes('user')).length;

  const filteredUsers = users.filter((user) => user.membershipRoles.includes('user'));
  const filteredUserRows = userRows.filter((user) =>
    filteredUsers.some((filtered) => filtered.id === user.id),
  );

  const totalAssignments = filteredUserRows.reduce(
    (sum, user) => sum + user.assignments.length,
    0,
  );
  const completedAssignments = filteredUserRows.reduce(
    (sum, user) => sum + user.assignments.filter((assignment) => assignment.isCompleted).length,
    0,
  );
  const completionPercentage = totalAssignments
    ? Math.round((completedAssignments / totalAssignments) * 100)
    : 0;

  const loading = customerLoading || coursesLoading || usersLoading;

  if (!activeCustomerId) {
    return (
      <section className="space-y-4">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Dashboard
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">Velg kunde</h1>
          <p className="text-sm text-slate-500">
            Velg en kunde i listen for å se statistikk.
          </p>
        </header>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Kundeoversikt
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">
          {customer?.companyName ?? 'Kunde'}
        </h1>
        <p className="text-sm text-slate-500">
          Fremdrift og brukerstatus for denne kunden.
        </p>
      </header>

      {loading && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Laster data …</p>
        </div>
      )}

      {!loading && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label="Brukere totalt"
              value={totalUsers}
              numberFormatter={numberFormatter}
            />
            <MetricCard
              label="TOTALT FULLFØRTE"
              value={completedAssignments}
              numberFormatter={numberFormatter}
            />
            <MetricCard
              label="FULLFØRT (%)"
              value={completionPercentage}
              numberFormatter={numberFormatter}
              formatValue={(value) => `${value}%`}
            />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Brukere
                </p>
                <h2 className="text-xl font-semibold text-slate-900">
                  Kursfremdrift per bruker
                </h2>
              </div>
            </div>

            {userRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                Ingen brukere registrert for denne kunden ennå.
              </p>
            ) : (
              <div className="mt-6 space-y-4">
                {userRows.map((user) => (
                  <div
                    key={user.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {user.firstName || user.lastName
                            ? `${user.firstName} ${user.lastName}`.trim()
                            : user.email}
                        </p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                      <p className="text-xs font-semibold text-slate-500">
                        {user.completedCount}/{user.assignments.length} kurs fullført
                      </p>
                    </div>

                    {user.assignments.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-500">
                        Ingen kurs tildelt denne brukeren.
                      </p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {user.assignments.map((assignment) => (
                          <div key={`${user.id}-${assignment.courseId}`}>
                            <div className="flex items-center justify-between text-sm">
                              <p className="font-medium text-slate-800">{assignment.title}</p>
                              <p className="text-slate-500">
                                {assignment.totalModules === 0
                                  ? 'Ingen moduler'
                                  : `${assignment.percent}%`}
                              </p>
                            </div>
                            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                              <div
                                className={`h-full rounded-full ${
                                  assignment.isCompleted
                                    ? 'bg-emerald-500'
                                    : 'bg-slate-500'
                                }`}
                                style={{ width: `${assignment.percent}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};

type MetricCardProps = {
  label: string;
  value: number;
  detail?: string;
  delta?: number;
  numberFormatter: Intl.NumberFormat;
  formatValue?: (value: number) => string;
  deltaFormatter?: (delta: number, formatter: Intl.NumberFormat) => string;
};

function MetricCard({
  label,
  value,
  detail,
  delta,
  numberFormatter,
  formatValue,
  deltaFormatter,
}: MetricCardProps) {
  const formattedValue = formatValue
    ? formatValue(value)
    : numberFormatter.format(value);

  const deltaClass =
    typeof delta === 'number'
      ? delta > 0
        ? 'text-emerald-600'
        : delta < 0
        ? 'text-red-600'
        : 'text-slate-400'
      : null;

  const formattedDelta =
    typeof delta === 'number'
      ? deltaFormatter
        ? deltaFormatter(delta, numberFormatter)
        : `${delta === 0 ? '0' : `${delta > 0 ? '+' : ''}${numberFormatter.format(delta)}`} siste uke`
      : null;

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-900">{formattedValue}</p>
      {typeof delta === 'number' && formattedDelta && (
        <p className={`mt-1 text-xs font-semibold ${deltaClass}`}>{formattedDelta}</p>
      )}
      {detail && <p className="mt-1 text-xs font-semibold text-slate-400">{detail}</p>}
    </div>
  );
}

