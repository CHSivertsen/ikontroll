'use server';

import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

type CustomerMembershipRecord = {
  customerId: string;
  roles: string[];
};

const INVITES_COLLECTION = adminDb.collection('courseInvites');

const normalizeMemberships = (value: unknown): CustomerMembershipRecord[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (typeof entry !== 'object' || entry === null) {
        return null;
      }
      const record = entry as { customerId?: unknown; roles?: unknown };
      if (typeof record.customerId !== 'string') {
        return null;
      }
      const roles = Array.isArray(record.roles)
        ? record.roles.filter((role): role is string => typeof role === 'string')
        : [];
      return { customerId: record.customerId, roles };
    })
    .filter((entry): entry is CustomerMembershipRecord => entry !== null);
};

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generateCode = (length = 6) => {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    const randomIndex = randomBytes(1)[0] % CODE_ALPHABET.length;
    code += CODE_ALPHABET[randomIndex];
  }
  return code;
};

const resolveCourseTitle = (value: unknown) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const map = value as Record<string, string>;
    return map.no ?? map.en ?? Object.values(map).find((item) => item?.trim()) ?? '';
  }
  return String(value);
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { courseId?: unknown; customerId?: unknown; idToken?: unknown }
    | null;

  const courseId = typeof body?.courseId === 'string' ? body.courseId.trim() : '';
  const customerId =
    typeof body?.customerId === 'string' ? body.customerId.trim() : '';
  const idToken = typeof body?.idToken === 'string' ? body.idToken : '';

  if (!idToken) {
    return NextResponse.json({ error: 'Mangler idToken' }, { status: 401 });
  }
  if (!courseId || !customerId) {
    return NextResponse.json(
      { error: 'Mangler courseId eller customerId' },
      { status: 400 },
    );
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const userSnap = await adminDb.collection('users').doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'Fant ikke brukeren.' }, { status: 404 });
    }

    const memberships = normalizeMemberships(userSnap.data()?.customerMemberships);
    const membership = memberships.find((entry) => entry.customerId === customerId);
    const isAdmin = membership?.roles?.includes('admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Ingen tilgang.' }, { status: 403 });
    }

    const [courseSnap, customerSnap] = await Promise.all([
      adminDb.collection('courses').doc(courseId).get(),
      adminDb.collection('customers').doc(customerId).get(),
    ]);

    if (!courseSnap.exists) {
      return NextResponse.json({ error: 'Fant ikke kurset.' }, { status: 404 });
    }
    if (!customerSnap.exists) {
      return NextResponse.json({ error: 'Fant ikke kunden.' }, { status: 404 });
    }

    const courseData = courseSnap.data() ?? {};
    const customerData = customerSnap.data() ?? {};
    const customerCourseIds = Array.isArray(customerData.courseIds)
      ? customerData.courseIds.filter((id: unknown): id is string => typeof id === 'string')
      : [];
    if (!customerCourseIds.includes(courseId)) {
      return NextResponse.json(
        { error: 'Kurset er ikke aktivt for denne kunden.' },
        { status: 400 },
      );
    }

    const companyId =
      typeof courseData.companyId === 'string'
        ? courseData.companyId
        : typeof customerData.createdByCompanyId === 'string'
          ? customerData.createdByCompanyId
          : '';

    let code = '';
    let attempts = 0;
    while (!code && attempts < 8) {
      const candidate = generateCode();
      const candidateSnap = await INVITES_COLLECTION.doc(candidate).get();
      if (!candidateSnap.exists) {
        code = candidate;
      }
      attempts += 1;
    }

    if (!code) {
      return NextResponse.json(
        { error: 'Kunne ikke generere kode. Prøv igjen.' },
        { status: 500 },
      );
    }

    await INVITES_COLLECTION.doc(code).set({
      code,
      courseId,
      courseTitle: resolveCourseTitle(courseData.title),
      customerId,
      customerName: customerData.companyName ?? '',
      companyId,
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
      active: true,
    });

    return NextResponse.json({ code });
  } catch (error) {
    console.error('Failed to create course invite code', error);
    return NextResponse.json(
      { error: 'Kunne ikke opprette kode.' },
      { status: 500 },
    );
  }
}
