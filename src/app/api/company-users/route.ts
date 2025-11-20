'use server';

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

const usersRoot = adminDb.collection('companies');

const validateBasePayload = (body: any) => {
  const errors: string[] = [];
  if (!body?.companyId) errors.push('companyId');
  if (!body?.customerId) errors.push('customerId');
  return errors;
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  console.log('POST /api/company-users payload', body);
  const missing = validateBasePayload(body);
  if (!body?.user) missing.push('user');
  if (!body?.password) missing.push('password');

  if (missing.length) {
    return NextResponse.json(
      { error: `Mangler felt: ${missing.join(', ')}` },
      { status: 400 },
    );
  }

  const { companyId, customerId, user, password } = body;

  try {
    const authUser = await adminAuth.createUser({
      email: user.email,
      password,
      displayName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
      disabled: user.status === 'inactive',
    });

    const customerUsersRef = usersRoot
      .doc(companyId)
      .collection('customers')
      .doc(customerId)
      .collection('users');

    await customerUsersRef.doc(authUser.uid).set({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      authUid: authUser.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      id: authUser.uid,
    });
  } catch (error: any) {
    console.error('Failed to create company user', error);
    return NextResponse.json(
      { error: error?.message ?? 'Kunne ikke opprette bruker' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  console.log('PATCH /api/company-users payload', body);
  const missing = validateBasePayload(body);
  if (!body?.userId) missing.push('userId');
  if (!body?.user) missing.push('user');

  if (missing.length) {
    return NextResponse.json(
      { error: `Mangler felt: ${missing.join(', ')}` },
      { status: 400 },
    );
  }

  const { companyId, customerId, userId, user, authUid } = body;
  const authTarget = authUid ?? userId;

  try {
    const customerUsersRef = usersRoot
      .doc(companyId)
      .collection('customers')
      .doc(customerId)
      .collection('users')
      .doc(userId);

    await customerUsersRef.update({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminAuth.updateUser(authTarget, {
      email: user.email,
      displayName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
      disabled: user.status === 'inactive',
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Failed to update company user', error);
    return NextResponse.json(
      { error: error?.message ?? 'Kunne ikke oppdatere bruker' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null);
  console.log('DELETE /api/company-users payload', body);
  const missing = validateBasePayload(body);
  if (!body?.userId) missing.push('userId');

  if (missing.length) {
    return NextResponse.json(
      { error: `Mangler felt: ${missing.join(', ')}` },
      { status: 400 },
    );
  }

  const { companyId, customerId, userId, authUid } = body;
  const authTarget = authUid ?? userId;

  try {
    const userDocRef = usersRoot
      .doc(companyId)
      .collection('customers')
      .doc(customerId)
      .collection('users')
      .doc(userId);

    await userDocRef.delete();
    await adminAuth.deleteUser(authTarget);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Failed to delete company user', error);
    return NextResponse.json(
      { error: error?.message ?? 'Kunne ikke slette bruker' },
      { status: 500 },
    );
  }
}

