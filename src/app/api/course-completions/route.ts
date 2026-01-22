'use server';

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

type CustomerMembershipRecord = {
  customerId: string;
  customerName?: string;
  assignedCourseIds: string[];
};

const normalizeMemberships = (value: unknown): CustomerMembershipRecord[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (typeof entry !== 'object' || entry === null) {
        return null;
      }
      const record = entry as {
        customerId?: unknown;
        customerName?: unknown;
        assignedCourseIds?: unknown;
      };
      if (typeof record.customerId !== 'string') {
        return null;
      }
      const assignedCourseIds = Array.isArray(record.assignedCourseIds)
        ? record.assignedCourseIds.filter((id): id is string => typeof id === 'string')
        : [];
      return {
        customerId: record.customerId,
        customerName: typeof record.customerName === 'string' ? record.customerName : undefined,
        assignedCourseIds,
      };
    })
    .filter((entry): entry is CustomerMembershipRecord => entry !== null);
};

const pickCourseTitle = (value: unknown) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const map = value as Record<string, string>;
    if (typeof map.no === 'string' && map.no.trim()) return map.no;
    const fallback = Object.values(map).find((entry) => typeof entry === 'string' && entry.trim());
    return fallback ?? '';
  }
  return String(value);
};

const getProgressCompletedAt = (value: unknown) => {
  if (!value || typeof value !== 'object') return null;
  const data = value as { updatedAt?: unknown };
  const updatedAt = data.updatedAt as { toDate?: () => Date } | Date | undefined;
  if (!updatedAt) return null;
  if (typeof (updatedAt as { toDate?: () => Date }).toDate === 'function') {
    return (updatedAt as { toDate: () => Date }).toDate();
  }
  if (updatedAt instanceof Date) {
    return updatedAt;
  }
  return null;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { courseId?: unknown; idToken?: unknown }
    | null;

  const courseId = typeof body?.courseId === 'string' ? body.courseId : '';
  const idToken = typeof body?.idToken === 'string' ? body.idToken : '';

  if (!idToken) {
    return NextResponse.json({ error: 'Mangler idToken' }, { status: 401 });
  }
  if (!courseId) {
    return NextResponse.json({ error: 'Mangler courseId' }, { status: 400 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const [courseSnap, userSnap, progressSnap] = await Promise.all([
      adminDb.collection('courses').doc(courseId).get(),
      adminDb.collection('users').doc(uid).get(),
      adminDb.collection('users').doc(uid).collection('courseProgress').doc(courseId).get(),
    ]);

    if (!courseSnap.exists) {
      return NextResponse.json({ error: 'Fant ikke kurset.' }, { status: 404 });
    }

    if (!userSnap.exists) {
      return NextResponse.json({ error: 'Fant ikke brukeren.' }, { status: 404 });
    }

    const courseData = courseSnap.data() ?? {};
    const companyId = typeof courseData.companyId === 'string' ? courseData.companyId : '';
    const courseTitle = pickCourseTitle(courseData.title);

    const userData = userSnap.data() ?? {};
    const firstName = typeof userData.firstName === 'string' ? userData.firstName.trim() : '';
    const lastName = typeof userData.lastName === 'string' ? userData.lastName.trim() : '';
    const email = typeof userData.email === 'string' ? userData.email : '';
    const participantName =
      `${firstName} ${lastName}`.trim() || email || 'Kursdeltaker';

    const memberships = normalizeMemberships(userData.customerMemberships);
    const membership = memberships.find((entry) =>
      entry.assignedCourseIds.includes(courseId),
    );

    if (!membership) {
      return NextResponse.json(
        { error: 'Kurset er ikke tildelt denne brukeren.' },
        { status: 403 },
      );
    }

    const customerId = membership.customerId;
    const customerDoc = await adminDb.collection('customers').doc(customerId).get();
    const customerName =
      membership.customerName ??
      (customerDoc.exists ? (customerDoc.data()?.companyName as string | undefined) : undefined) ??
      '';

    const modulesSnap = await adminDb
      .collection('courses')
      .doc(courseId)
      .collection('modules')
      .get();
    const moduleIds = modulesSnap.docs.map((doc) => doc.id);
    const progressData = progressSnap.data() ?? {};
    const completedModules = Array.isArray(progressData.completedModules)
      ? progressData.completedModules.filter((id): id is string => typeof id === 'string')
      : [];

    const isCompleted =
      moduleIds.length > 0 && moduleIds.every((moduleId) => completedModules.includes(moduleId));
    if (!isCompleted) {
      return NextResponse.json(
        { error: 'Kurset er ikke fullført ennå.' },
        { status: 403 },
      );
    }

    const completionId = `${courseId}_${customerId}`;
    const completionRef = adminDb
      .collection('users')
      .doc(uid)
      .collection('courseCompletions')
      .doc(completionId);

    const existingCompletion = await completionRef.get();
    const existingData = existingCompletion.exists ? existingCompletion.data() : null;
    const existingCompletedAt =
      existingData?.completedAt?.toDate?.() ??
      (existingData?.completedAt instanceof Date ? existingData.completedAt : null);

    const completedAt =
      existingCompletedAt ?? getProgressCompletedAt(progressData) ?? new Date();

    await completionRef.set(
      {
        courseId,
        customerId,
        companyId,
        customerName,
        courseTitle,
        participantName,
        completedAt,
        createdAt: existingData?.createdAt ?? FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true, completedAt: completedAt.toISOString() });
  } catch (error) {
    console.error('Failed to record course completion', error);
    return NextResponse.json(
      { error: 'Kunne ikke lagre gjennomføringen.' },
      { status: 500 },
    );
  }
}
