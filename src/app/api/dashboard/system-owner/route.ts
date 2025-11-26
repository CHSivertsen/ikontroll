import { NextResponse } from 'next/server';

import { adminDb } from '@/lib/firebaseAdmin';

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

const WEEK_BUCKET_COUNT = 8;

export async function GET() {
  try {
    const metrics = await buildMetrics();
    return NextResponse.json(metrics satisfies OwnerDashboardMetrics);
  } catch (error) {
    console.error('Failed to build system owner dashboard metrics', error);
    return NextResponse.json(
      { error: 'Kunne ikke hente nøkkeltall.' },
      { status: 500 },
    );
  }
}

async function buildMetrics(): Promise<OwnerDashboardMetrics> {
  const weeklyBuckets = createWeekBuckets(WEEK_BUCKET_COUNT);
  const earliestStart = weeklyBuckets[weeklyBuckets.length - 1]?.start ?? startOfWeek(new Date());

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
    generatedAt: new Date().toISOString(),
  };
}

type WeeklyBucket = {
  label: string;
  start: Date;
  end: Date;
  newCustomers: number;
  newUsers: number;
  completedCourses: number;
};

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
  const day = clone.getDay() === 0 ? 6 : clone.getDay() - 1;
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

