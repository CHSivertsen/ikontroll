'use server';

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

const usersCollection = adminDb.collection('users');

type CompanyUserRole = 'admin' | 'user';

interface UserPayloadBody {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  roles: CompanyUserRole[];
  status: 'active' | 'inactive';
  assignedCourseIds?: string[];
}

interface CompanyUserPayload {
  companyId: string;
  customerId: string;
  customerName?: string;
  userId?: string;
  authUid?: string;
  user?: UserPayloadBody;
  password?: string;
}

const validateBasePayload = (body: Partial<CompanyUserPayload> | null) => {
  const errors: string[] = [];
  if (!body?.companyId) errors.push('companyId');
  if (!body?.customerId) errors.push('customerId');
  return errors;
};

const normalizeMemberships = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [] as { customerId: string; roles: CompanyUserRole[]; assignedCourseIds?: string[] }[];
  }
  return value
    .map((entry) => {
      if (
        typeof entry === 'object' &&
        entry !== null &&
        'customerId' in entry &&
        'roles' in entry
      ) {
        const { customerId, roles, assignedCourseIds } = entry as {
          customerId?: unknown;
          roles?: unknown;
          assignedCourseIds?: unknown;
        };
        if (typeof customerId === 'string') {
          const validRoles = Array.isArray(roles)
            ? roles.filter(
                (role): role is CompanyUserRole =>
                  role === 'admin' || role === 'user',
              )
            : [];
          
          const validAssignedCourseIds = Array.isArray(assignedCourseIds)
            ? assignedCourseIds.filter((id): id is string => typeof id === 'string')
            : undefined;

          return { customerId, roles: validRoles, assignedCourseIds: validAssignedCourseIds };
        }
      }
      return null;
    })
    .filter(
      (
        membership,
      ): membership is { customerId: string; roles: CompanyUserRole[]; assignedCourseIds?: string[] } =>
        membership !== null,
    );
};

const upsertMembership = (
  memberships: { customerId: string; customerName?: string; roles: CompanyUserRole[]; assignedCourseIds?: string[] }[],
  customerId: string,
  customerName: string | undefined,
  roles: CompanyUserRole[],
  assignedCourseIds?: string[]
) => {
  const filteredRoles = Array.from(new Set(roles));
  // Find existing membership to preserve other fields if needed, though we replace completely now
  const filteredMemberships = memberships.filter(
    (membership) => membership.customerId !== customerId,
  );
  
  filteredMemberships.push({ 
    customerId, 
    customerName, 
    roles: filteredRoles,
    assignedCourseIds: assignedCourseIds 
  });
  
  return filteredMemberships;
};

const upsertUserDocument = async ({
  authUid,
  user,
  companyId,
  customerId,
  customerName,
}: {
  authUid: string;
  user: UserPayloadBody;
  companyId: string;
  customerId: string;
  customerName?: string;
}) => {
  const userDocRef = usersCollection.doc(authUid);
  const snapshot = await userDocRef.get();
  const existingData = snapshot.exists ? snapshot.data() : null;
  const memberships = normalizeMemberships(existingData?.customerMemberships);
  const nextMemberships = upsertMembership(
    memberships, 
    customerId, 
    customerName, 
    user.roles,
    user.assignedCourseIds // Pass assigned courses
  );

  await userDocRef.set(
    {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      status: user.status,
      authUid,
      companyIds: FieldValue.arrayUnion(companyId),
      customerIdRefs: FieldValue.arrayUnion(customerId),
      customerMemberships: nextMemberships,
      createdAt: existingData?.createdAt ?? FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as CompanyUserPayload | null;
  console.log('POST /api/company-users payload', body);
  const missing = validateBasePayload(body);
  if (!body?.user) missing.push('user');

  if (missing.length) {
    return NextResponse.json(
      { error: `Mangler felt: ${missing.join(', ')}` },
      { status: 400 },
    );
  }

  const { companyId, customerId, customerName, user, password } = body;

  try {
    let authUser = null;
    try {
      authUser = await adminAuth.getUserByEmail(user.email);
    } catch {
      authUser = null;
    }

    if (!authUser) {
      if (!password) {
        return NextResponse.json(
          { error: 'Brukeren finnes ikke. Passord er påkrevd for nye brukere.' },
          { status: 400 },
        );
      }
      authUser = await adminAuth.createUser({
        email: user.email,
        password,
        displayName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
        disabled: user.status === 'inactive',
      });
    } else {
      await adminAuth.updateUser(authUser.uid, {
        email: user.email,
        displayName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
        disabled: user.status === 'inactive',
      });
    }

    await upsertUserDocument({
      authUid: authUser.uid,
      user,
      companyId,
      customerId,
      customerName,
    });

    return NextResponse.json({
      id: authUser.uid,
    });
  } catch (error: unknown) {
    console.error('Failed to create company user', error);
    return NextResponse.json(
      { error: (error as Error)?.message ?? 'Kunne ikke opprette bruker' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as CompanyUserPayload | null;
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

  const { companyId, customerId, customerName, userId, user, authUid } = body;
  const authTarget = authUid ?? userId;

  try {
    await upsertUserDocument({
      authUid: userId,
      user,
      companyId,
      customerId,
      customerName,
    });

    await adminAuth.updateUser(authTarget, {
      email: user.email,
      displayName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
      disabled: user.status === 'inactive',
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('Failed to update company user', error);
    return NextResponse.json(
      { error: (error as Error)?.message ?? 'Kunne ikke oppdatere bruker' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as CompanyUserPayload | null;
  console.log('DELETE /api/company-users payload', body);
  const missing = validateBasePayload(body);
  if (!body?.userId) missing.push('userId');

  if (missing.length) {
    return NextResponse.json(
      { error: `Mangler felt: ${missing.join(', ')}` },
      { status: 400 },
    );
  }

  const { userId, customerId, authUid } = body;
  const authTarget = authUid ?? userId;

  try {
    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId mangler' },
        { status: 400 },
      );
    }

    const userDocRef = usersCollection.doc(userId);
    const snapshot = await userDocRef.get();
    if (!snapshot.exists) {
      await adminAuth.deleteUser(authTarget);
      return NextResponse.json({ ok: true });
    }

    const memberships = normalizeMemberships(snapshot.data()?.customerMemberships);
    const remainingMemberships = memberships.filter(
      (membership) => membership.customerId !== customerId,
    );

    if (!remainingMemberships.length) {
      await userDocRef.delete();
      await adminAuth.deleteUser(authTarget);
    } else {
      await userDocRef.set(
        {
          customerMemberships: remainingMemberships,
          customerIdRefs: FieldValue.arrayRemove(customerId),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('Failed to delete company user', error);
    return NextResponse.json(
      { error: (error as Error)?.message ?? 'Kunne ikke slette bruker' },
      { status: 500 },
    );
  }
}
