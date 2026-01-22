'use server';

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

type CustomerMembershipRecord = {
  customerId: string;
  customerName?: string;
  roles: string[];
  assignedCourseIds: string[];
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
      const record = entry as {
        customerId?: unknown;
        customerName?: unknown;
        roles?: unknown;
        assignedCourseIds?: unknown;
      };
      if (typeof record.customerId !== 'string') {
        return null;
      }
      const roles = Array.isArray(record.roles)
        ? record.roles.filter((role): role is string => typeof role === 'string')
        : [];
      const assignedCourseIds = Array.isArray(record.assignedCourseIds)
        ? record.assignedCourseIds.filter((id): id is string => typeof id === 'string')
        : [];
      return {
        customerId: record.customerId,
        customerName: typeof record.customerName === 'string' ? record.customerName : undefined,
        roles,
        assignedCourseIds,
      };
    })
    .filter((entry): entry is CustomerMembershipRecord => entry !== null);
};

const ensureUserRole = (roles: string[]) => {
  if (roles.includes('user')) {
    return roles;
  }
  return [...roles, 'user'];
};

const upsertMembership = (
  memberships: CustomerMembershipRecord[],
  customerId: string,
  customerName: string,
  courseId: string,
) => {
  const existing = memberships.find((entry) => entry.customerId === customerId);
  const existingRoles = existing?.roles ?? [];
  const existingCourses = existing?.assignedCourseIds ?? [];
  const nextRoles = ensureUserRole(existingRoles.length ? existingRoles : ['user']);
  const nextCourses = Array.from(new Set([...existingCourses, courseId]));
  const nextMemberships = memberships.filter((entry) => entry.customerId !== customerId);

  nextMemberships.push({
    customerId,
    customerName: customerName.trim() ? customerName : existing?.customerName,
    roles: nextRoles,
    assignedCourseIds: nextCourses,
  });

  return nextMemberships;
};

const resolveEmail = (value: unknown) =>
  typeof value === 'string' ? value : '';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { code?: unknown; idToken?: unknown }
    | null;

  const rawCode = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
  const idToken = typeof body?.idToken === 'string' ? body.idToken : '';

  if (!rawCode) {
    return NextResponse.json({ error: 'Mangler kode.' }, { status: 400 });
  }
  if (!idToken) {
    return NextResponse.json({ error: 'Mangler idToken.' }, { status: 401 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const inviteSnap = await INVITES_COLLECTION.doc(rawCode).get();
    if (!inviteSnap.exists) {
      return NextResponse.json({ error: 'Ugyldig kode.' }, { status: 404 });
    }

    const inviteData = inviteSnap.data() ?? {};
    if (inviteData.active === false) {
      return NextResponse.json({ error: 'Koden er deaktivert.' }, { status: 410 });
    }

    const courseId = typeof inviteData.courseId === 'string' ? inviteData.courseId : '';
    const customerId = typeof inviteData.customerId === 'string' ? inviteData.customerId : '';
    if (!courseId || !customerId) {
      return NextResponse.json({ error: 'Koden er ugyldig.' }, { status: 400 });
    }

    const customerSnap = await adminDb.collection('customers').doc(customerId).get();
    const customerName =
      (customerSnap.exists ? (customerSnap.data()?.companyName as string | undefined) : undefined) ??
      (typeof inviteData.customerName === 'string' ? inviteData.customerName : '') ??
      '';

    const userDocRef = adminDb.collection('users').doc(uid);
    const userSnap = await userDocRef.get();
    const existing = userSnap.exists ? userSnap.data() : null;

    const memberships = normalizeMemberships(existing?.customerMemberships);
    const nextMemberships = upsertMembership(memberships, customerId, customerName, courseId);

    const email = existing?.email ? resolveEmail(existing.email) : resolveEmail(decoded.email);
    const phone =
      typeof existing?.phone === 'string' ? existing.phone : '';
    const firstName =
      typeof existing?.firstName === 'string' ? existing.firstName : '';
    const lastName =
      typeof existing?.lastName === 'string' ? existing.lastName : '';
    const status =
      typeof existing?.status === 'string' ? existing.status : 'active';

    await userDocRef.set(
      {
        email,
        phone,
        firstName,
        lastName,
        status,
        authUid: uid,
        customerIdRefs: FieldValue.arrayUnion(customerId),
        customerMemberships: nextMemberships,
        createdAt: existing?.createdAt ?? FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true, customerId, courseId });
  } catch (error) {
    console.error('Failed to redeem course invite', error);
    return NextResponse.json(
      { error: 'Kunne ikke registrere kurset.' },
      { status: 500 },
    );
  }
}
