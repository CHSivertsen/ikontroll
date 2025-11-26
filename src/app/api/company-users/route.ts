'use server';

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';

import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

const usersCollection = adminDb.collection('users');
const SVEVE_USERNAME = process.env.SVEVE_USERNAME;
const SVEVE_PASSWORD = process.env.SVEVE_PASSWORD;
const SVEVE_SENDER = process.env.SVEVE_SENDER ?? 'Ikontroll';
const PORTAL_LOGIN_URL =
  process.env.PORTAL_LOGIN_URL ??
  process.env.NEXT_PUBLIC_PORTAL_URL ??
  'https://portal.ikontroll.no/login';
const PORTAL_MAGIC_LOGIN_URL =
  process.env.PORTAL_MAGIC_LOGIN_URL ??
  PORTAL_LOGIN_URL.replace(/\/login$/, '/magic-login');
const MAGIC_LINK_TTL_MS = Number(process.env.MAGIC_LINK_TTL_MS ?? 1000 * 60 * 30); // 30 min default
const MAGIC_LINK_COLLECTION = adminDb.collection('magicLinks');

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
    return [] as {
      customerId: string;
      roles: CompanyUserRole[];
      assignedCourseIds: string[];
    }[];
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
            : [];

          return { customerId, roles: validRoles, assignedCourseIds: validAssignedCourseIds };
        }
      }
      return null;
    })
    .filter(
      (
        membership,
      ): membership is {
        customerId: string;
        roles: CompanyUserRole[];
        assignedCourseIds: string[];
      } => membership !== null,
    );
};

const upsertMembership = (
  memberships: {
    customerId: string;
    customerName?: string;
    roles: CompanyUserRole[];
    assignedCourseIds?: string[];
  }[],
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
    assignedCourseIds: Array.isArray(assignedCourseIds) ? assignedCourseIds : [],
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
  const previousMembership = memberships.find((entry) => entry.customerId === customerId);
  const previousAssignedCourses = previousMembership?.assignedCourseIds ?? [];
  const normalizedAssignedCourses = Array.isArray(user.assignedCourseIds)
    ? user.assignedCourseIds.filter((id): id is string => typeof id === 'string')
    : [];
  const nextMemberships = upsertMembership(
    memberships,
    customerId,
    customerName,
    user.roles,
    normalizedAssignedCourses,
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

  const addedCourseIds = normalizedAssignedCourses.filter(
    (courseId) => !previousAssignedCourses.includes(courseId),
  );

  return { addedCourseIds };
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

  if (!body) {
    return NextResponse.json({ error: 'Mangler payload' }, { status: 400 });
  }

  const { companyId, customerId, customerName, password } = body;
  const user = body.user!;

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

    const { addedCourseIds } = await upsertUserDocument({
      authUid: authUser.uid,
      user,
      companyId,
      customerId,
      customerName,
    });

    await notifyCourseAssignments(user.phone, addedCourseIds, authUser.uid);

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

  if (!body) {
    return NextResponse.json({ error: 'Mangler payload' }, { status: 400 });
  }

  const { companyId, customerId, customerName, authUid } = body;
  const userId = body.userId!;
  const user = body.user!;
  const authTarget = authUid ?? userId;

  try {
    const { addedCourseIds } = await upsertUserDocument({
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

    await notifyCourseAssignments(user.phone, addedCourseIds, authTarget);

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

  if (!body) {
    return NextResponse.json({ error: 'Mangler payload' }, { status: 400 });
  }

  const { customerId, authUid } = body;
  const userId = body.userId!;
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

const SVEVE_ENDPOINT = 'https://sveve.no/SMS/SendMessage';
const SVEVE_TEST_MODE = process.env.SVEVE_TEST === 'true';

const formatPhoneNumber = (raw: string) => raw.replace(/[^\d+]/g, '').replace(/^00/, '+');

const resolveCourseTitle = (data: Record<string, unknown> | undefined) => {
  if (!data) return 'Nytt kurs';
  const title = data.title as unknown;
  if (typeof title === 'string' && title.trim()) {
    return title;
  }
  if (typeof title === 'object' && title !== null) {
    const map = title as Record<string, unknown>;
    return (
      (typeof map.no === 'string' && map.no.trim()) ||
      (typeof map.en === 'string' && map.en.trim()) ||
      'Nytt kurs'
    );
  }
  return 'Nytt kurs';
};

const fetchCourseTitles = async (courseIds: string[]) => {
  const entries = await Promise.all(
    courseIds.map(async (courseId) => {
      try {
        const snapshot = await adminDb.collection('courses').doc(courseId).get();
        if (!snapshot.exists) {
          return [courseId, 'Nytt kurs'] as const;
        }
        return [courseId, resolveCourseTitle(snapshot.data() ?? undefined)] as const;
      } catch (error) {
        console.error('Failed to load course title', courseId, error);
        return [courseId, 'Nytt kurs'] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
};

const generateMagicCode = () =>
  randomBytes(6)
    .toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 10)
    .toLowerCase();

const createMagicLoginCode = async ({
  authUid,
  courseId,
}: {
  authUid: string;
  courseId?: string;
}) => {
  const redirectPath = courseId ? `/my-courses/${courseId}` : '/my-courses';
  let attempts = 0;
  while (attempts < 5) {
    const code = generateMagicCode();
    const docRef = MAGIC_LINK_COLLECTION.doc(code);
    const existing = await docRef.get();
    if (existing.exists) {
      attempts += 1;
      continue;
    }

    await docRef.set({
      authUid,
      courseId: courseId ?? null,
      redirect: redirectPath,
      expiresAt: Date.now() + MAGIC_LINK_TTL_MS,
      createdAt: FieldValue.serverTimestamp(),
      consumed: false,
    });

    return `${PORTAL_MAGIC_LOGIN_URL}?code=${code}`;
  }
  throw new Error('Failed to generate unique magic login code');
};

const buildMagicLoginUrl = async ({
  authUid,
  courseId,
}: {
  authUid: string | undefined;
  courseId?: string;
}) => {
  if (!authUid) {
    return PORTAL_LOGIN_URL;
  }

  try {
    return await createMagicLoginCode({ authUid, courseId });
  } catch (error) {
    console.error('Failed to create magic code, falling back to token', error);
    try {
      const customToken = await adminAuth.createCustomToken(authUid, {
        loginSource: 'sms',
        issuedAt: Date.now(),
        ...(courseId ? { courseId } : {}),
      });
      const targetUrl = new URL(PORTAL_MAGIC_LOGIN_URL);
      targetUrl.searchParams.set('token', customToken);
      if (courseId) {
        targetUrl.searchParams.set('redirect', `/my-courses/${courseId}`);
      }
      return targetUrl.toString();
    } catch (fallbackError) {
      console.error('Failed to create fallback magic token', fallbackError);
      return PORTAL_LOGIN_URL;
    }
  }
};

const sendSveveSms = async (to: string, text: string) => {
  if (!SVEVE_USERNAME || !SVEVE_PASSWORD) {
    console.warn('Sveve credentials missing, skipping SMS.');
    return;
  }
  const clean = formatPhoneNumber(to);
  if (!clean) {
    console.warn('Invalid recipient phone number, skipping SMS.');
    return;
  }
  const query = new URLSearchParams({
    user: SVEVE_USERNAME,
    passwd: SVEVE_PASSWORD,
    to: clean,
    msg: text,
    from: SVEVE_SENDER,
    f: 'json',
    test: SVEVE_TEST_MODE ? 'true' : 'false',
  });
  try {
    const response = await fetch(`${SVEVE_ENDPOINT}?${query.toString()}`, {
      method: 'GET',
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Sveve SMS request failed', response.status, errorText);
      return;
    }
    const json = (await response.json().catch(() => null)) as
      | { response?: { msgOkCount?: number; errors?: unknown } }
      | null;
    if (json?.response?.errors) {
      console.error('Sveve SMS response reported errors', json.response.errors);
    }
  } catch (error) {
    console.error('Sveve SMS request error', error);
  }
};

const notifyCourseAssignments = async (
  phone: string | undefined,
  courseIds: string[],
  authUid: string | undefined,
) => {
  if (!phone || !courseIds.length) {
    return;
  }
  const titles = await fetchCourseTitles(courseIds);
  await Promise.all(
    courseIds.map(async (courseId) => {
      const courseTitle = titles[courseId] ?? 'Nytt kurs';
      const magicLink = await buildMagicLoginUrl({ authUid, courseId });
      return sendSveveSms(
        phone,
        `Du har fått tilgang til kurset ${courseTitle}. Logg inn her: ${magicLink}`,
      );
    }),
  );
};
