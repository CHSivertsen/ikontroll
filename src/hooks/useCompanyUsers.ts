'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type {
  CompanyUser,
  CompanyUserPayload,
} from '@/types/companyUser';

interface UseCompanyUsersState {
  users: CompanyUser[];
  loading: boolean;
  error: string | null;
  createUser: (payload: CompanyUserPayload, password: string) => Promise<void>;
  updateUser: (
    id: string,
    payload: CompanyUserPayload,
    authUid?: string,
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

  const usersCollection = useMemo(() => {
    if (!ownerCompanyId || !customerId) {
      return null;
    }
    return collection(
      db,
      'companies',
      ownerCompanyId,
      'customers',
      customerId,
      'users',
    );
  }, [ownerCompanyId, customerId]);

  useEffect(() => {
    if (!usersCollection) {
      setUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(usersCollection, orderBy('firstName'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const next: CompanyUser[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            authUid: data.authUid ?? docSnap.id,
            firstName: data.firstName ?? '',
            lastName: data.lastName ?? '',
            email: data.email ?? '',
            phone: data.phone ?? '',
            role: data.role ?? 'user',
            status: data.status ?? 'active',
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
  }, [usersCollection]);

  const callApi = useCallback(
    async <T,>(method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, any>) => {
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
        let parsed: any = {};
        try {
          parsed = text ? JSON.parse(text) : {};
        } catch (error) {
          parsed = {};
        }
        throw new Error(
          parsed?.error ??
            `API-feil (${response.status}): ${text || 'Ukjent feil'}`,
        );
      }

      const json = (await response.json().catch(() => ({}))) as T;
      console.log('company-users callApi success', { method, body, json });
      return json;
    },
    [],
  );

  const createUser = useCallback(
    async (payload: CompanyUserPayload, password: string) => {
      if (!ownerCompanyId || !customerId) {
        throw new Error('Company is not selected');
      }

      await callApi('POST', {
        companyId: ownerCompanyId,
        customerId,
        user: payload,
        password,
      });
    },
    [callApi, ownerCompanyId, customerId],
  );

  const updateUser = useCallback(
    async (id: string, payload: CompanyUserPayload, authUid?: string) => {
      if (!ownerCompanyId || !customerId) {
        throw new Error('Company is not selected');
      }

      await callApi('PATCH', {
        companyId: ownerCompanyId,
        customerId,
        userId: id,
        authUid: authUid ?? id,
        user: payload,
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

