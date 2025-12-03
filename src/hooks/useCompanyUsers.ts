'use client';

import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type {
  CompanyUser,
  CompanyUserPayload,
  CustomerMembership,
} from '@/types/companyUser';

interface UseCompanyUsersState {
  users: CompanyUser[];
  loading: boolean;
  error: string | null;
  createUser: (payload: CompanyUserPayload, customerName?: string) => Promise<void>;
  updateUser: (
    id: string,
    payload: CompanyUserPayload,
    authUid?: string,
    customerName?: string,
  ) => Promise<void>;
  deleteUser: (id: string, authUid?: string) => Promise<void>;
}

export const useCompanyUsers = (
  ownerCompanyId: string | null,
  customerId: string | null,
): UseCompanyUsersState => {
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const usersCollection = useMemo(() => collection(db, 'users'), []);

  useEffect(() => {
    if (!customerId) {
      startTransition(() => {
        setUsers([]);
        setLoading(false);
        setError(null);
      });
      return;
    }

    startTransition(() => {
      setLoading(true);
    });
    const q = query(
      usersCollection,
      where('customerIdRefs', 'array-contains', customerId),
      orderBy('firstName'),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const next: CompanyUser[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const membershipsRaw = Array.isArray(data.customerMemberships)
            ? data.customerMemberships
            : [];
          const customerMemberships = membershipsRaw.reduce<CustomerMembership[]>(
            (acc, membership) => {
              if (
                typeof membership === 'object' &&
                membership !== null &&
                'customerId' in membership &&
                'roles' in membership
              ) {
                const {
                  customerId: membershipCustomerId,
                  roles,
                  assignedCourseIds,
                } = membership as {
                  customerId?: string;
                  roles?: unknown;
                  customerName?: unknown;
                  assignedCourseIds?: unknown;
                };
                if (typeof membershipCustomerId === 'string') {
                  const roleList = Array.isArray(roles)
                    ? roles.filter(
                        (role): role is 'admin' | 'user' =>
                          role === 'admin' || role === 'user',
                      )
                    : [];
                  const courseIds = Array.isArray(assignedCourseIds)
                    ? assignedCourseIds.filter((id): id is string => typeof id === 'string')
                    : undefined;

                  acc.push({
                    customerId: membershipCustomerId,
                    customerName:
                      typeof (membership as { customerName?: unknown }).customerName ===
                      'string'
                        ? ((membership as { customerName: string }).customerName)
                        : undefined,
                    roles: roleList,
                    assignedCourseIds: courseIds,
                  });
                }
              }
              return acc;
            },
            [],
          );

          return {
            id: docSnap.id,
            authUid: data.authUid ?? docSnap.id,
            firstName: data.firstName ?? '',
            lastName: data.lastName ?? '',
            email: data.email ?? '',
            phone: data.phone ?? '',
            status: data.status ?? 'active',
            companyIds: data.companyIds ?? [],
            customerIdRefs: data.customerIdRefs ?? [],
            customerMemberships,
            createdAt: data.createdAt?.toDate?.() ?? undefined,
            updatedAt: data.updatedAt?.toDate?.() ?? undefined,
          };
        });
        setUsers(next);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load company users', err);
        setUsers([]);
        setError('Kunne ikke hente brukere');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [customerId, usersCollection]);

  const callApi = useCallback(
    async <T,>(method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown>) => {
      console.log('company-users callApi start', { method, body });
      const response = await fetch('/api/company-users', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.error('Company-users API error', {
          method,
          body,
          status: response.status,
          response: text,
        });
        let parsed: Record<string, unknown> = {};
        try {
          parsed = text ? JSON.parse(text) : {};
        } catch {
          parsed = {};
        }
        const parsedError =
          parsed &&
          typeof parsed === 'object' &&
          'error' in parsed &&
          typeof (parsed as { error?: unknown }).error === 'string'
            ? (parsed as { error: string }).error
            : null;
        throw new Error(
          parsedError ?? `API-feil (${response.status}): ${text || 'Ukjent feil'}`,
        );
      }

      const json = (await response.json().catch(() => ({}))) as T;
      console.log('company-users callApi success', { method, body, json });
      return json;
    },
    [],
  );

  const createUser = useCallback(
    async (payload: CompanyUserPayload, customerName?: string) => {
      if (!ownerCompanyId || !customerId) {
        throw new Error('Company is not selected');
      }

      await callApi('POST', {
        companyId: ownerCompanyId,
        customerId,
        user: payload,
        customerName,
      });
    },
    [callApi, ownerCompanyId, customerId],
  );

  const updateUser = useCallback(
    async (
      id: string,
      payload: CompanyUserPayload,
      authUid?: string,
      customerName?: string,
    ) => {
      if (!customerId) {
        throw new Error('Customer is not selected');
      }

      await callApi('PATCH', {
        companyId: ownerCompanyId ?? undefined,
        customerId,
        userId: id,
        authUid: authUid ?? id,
        user: payload,
        customerName,
      });
    },
    [ownerCompanyId, customerId, callApi],
  );

  const deleteUser = useCallback(
    async (id: string, authUid?: string) => {
      if (!ownerCompanyId || !customerId) {
        throw new Error('Company is not selected');
      }

      await callApi('DELETE', {
        companyId: ownerCompanyId,
        customerId,
        userId: id,
        authUid: authUid ?? id,
      });
    },
    [ownerCompanyId, customerId, callApi],
  );

  return {
    users,
    loading,
    error,
    createUser,
    updateUser,
    deleteUser,
  };
};

