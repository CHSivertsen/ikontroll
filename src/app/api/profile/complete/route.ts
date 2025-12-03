'use server';

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { firstName?: unknown; lastName?: unknown; idToken?: unknown }
    | null;

  const rawFirst = typeof body?.firstName === 'string' ? body.firstName.trim() : '';
  const rawLast = typeof body?.lastName === 'string' ? body.lastName.trim() : '';
  const idToken = typeof body?.idToken === 'string' ? body.idToken : '';

  if (!idToken) {
    return NextResponse.json({ error: 'Mangler idToken' }, { status: 401 });
  }
  if (rawFirst.length < 2 || rawLast.length < 2) {
    return NextResponse.json(
      { error: 'Fornavn og etternavn må være minst 2 tegn' },
      { status: 400 },
    );
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    console.log('Completing profile', {
      uid,
      firstNameLength: rawFirst.length,
      lastNameLength: rawLast.length,
    });

    const userDocRef = adminDb.collection('users').doc(uid);
    await userDocRef.set(
      {
        firstName: rawFirst,
        lastName: rawLast,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    await adminAuth.updateUser(uid, {
      displayName: `${rawFirst} ${rawLast}`.trim(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to complete profile', error);
    return NextResponse.json(
      { error: 'Kunne ikke lagre profilen. Prøv igjen senere.' },
      { status: 500 },
    );
  }
}
