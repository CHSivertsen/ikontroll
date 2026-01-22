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

const ensureNorwegianPhone = (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/\s+/g, '');
  if (digits.startsWith('0047')) return `+47${digits.slice(4)}`;
  if (digits.startsWith('47')) return `+${digits}`;
  if (digits.startsWith('0')) return `+47${digits.slice(1)}`;
  return `+47${digits}`;
};

const upsertMembership = (
  memberships: CustomerMembershipRecord[],
  customerId: string,
  customerName: string,
  courseId: string,
) => {
  const nextMemberships = memberships.filter((entry) => entry.customerId !== customerId);
  nextMemberships.push({
    customerId,
    customerName,
    roles: ['user'],
    assignedCourseIds: [courseId],
  });
  return nextMemberships;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | {
        code?: unknown;
        email?: unknown;
        password?: unknown;
        phone?: unknown;
      }
    | null;

  const rawCode = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
  const rawEmail = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const rawPassword = typeof body?.password === 'string' ? body.password : '';
  const rawPhone = typeof body?.phone === 'string' ? body.phone : '';

  if (!rawCode || !rawEmail || !rawPassword) {
    return NextResponse.json(
      { error: 'Mangler kode, e-post eller passord.' },
      { status: 400 },
    );
  }
  if (rawPassword.length < 6) {
    return NextResponse.json(
      { error: 'Passordet må være minst 6 tegn.' },
      { status: 400 },
    );
  }

  try {
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

    try {
      await adminAuth.getUserByEmail(rawEmail);
      return NextResponse.json(
        { error: 'Brukeren finnes allerede. Logg inn i stedet.' },
        { status: 409 },
      );
    } catch (err) {
      if ((err as { code?: string }).code !== 'auth/user-not-found') {
        console.error('Failed to check existing user', err);
        return NextResponse.json(
          { error: 'Kunne ikke verifisere brukeren.' },
          { status: 500 },
        );
      }
    }

    const customerSnap = await adminDb.collection('customers').doc(customerId).get();
    const customerName =
      (customerSnap.exists ? (customerSnap.data()?.companyName as string | undefined) : undefined) ??
      (typeof inviteData.customerName === 'string' ? inviteData.customerName : '') ??
      '';

    const authUser = await adminAuth.createUser({
      email: rawEmail,
      password: rawPassword,
    });

    const phone = ensureNorwegianPhone(rawPhone);
    const userDocRef = adminDb.collection('users').doc(authUser.uid);
    const memberships = upsertMembership([], customerId, customerName, courseId);

    await userDocRef.set(
      {
        email: rawEmail,
        phone,
        firstName: '',
        lastName: '',
        status: 'active',
        authUid: authUser.uid,
        customerIdRefs: FieldValue.arrayUnion(customerId),
        customerMemberships: memberships,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const customToken = await adminAuth.createCustomToken(authUser.uid, {
      signupSource: 'course-invite',
      courseId,
      customerId,
    });

    return NextResponse.json({ token: customToken });
  } catch (error) {
    console.error('Failed to sign up with course invite', error);
    return NextResponse.json(
      { error: 'Kunne ikke opprette bruker.' },
      { status: 500 },
    );
  }
}
