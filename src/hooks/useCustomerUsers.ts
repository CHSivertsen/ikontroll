'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

import { db } from '@/lib/firebase';

export interface CustomerUserRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  status: string;
  globalRoles: string[];
  membershipRoles: Array<'admin' | 'user'>;
  assignedCourseIds: string[];
  companyIdRefs: string[];
  customerName?: string;
}

interface UseCustomerUsersState {
  users: CustomerUserRecord[];
  loading: boolean;
}

export const useCustomerUsers = (customerId: string | null): UseCustomerUsersState => {
  const [users, setUsers] = useState<CustomerUserRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('customerIdRefs', 'array-contains', customerId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const next: CustomerUserRecord[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const memberships = Array.isArray(data.customerMemberships)
            ? data.customerMemberships
            : [];
          const membership = memberships.find(
            (entry) =>
              typeof entry === 'object' &&
              entry !== null &&
              'customerId' in entry &&
              (entry as { customerId?: string }).customerId === customerId,
          ) as
            | {
                assignedCourseIds?: unknown;
                customerName?: unknown;
                roles?: unknown;
              }
            | undefined;

          const assignedCourseIds = Array.isArray(membership?.assignedCourseIds)
            ? membership?.assignedCourseIds.filter((id): id is string => typeof id === 'string')
            : [];

          const membershipRoles = Array.isArray(membership?.roles)
            ? (membership?.roles as unknown[]).filter(
                (role): role is 'admin' | 'user' => role === 'admin' || role === 'user',
              )
            : [];

          return {
            id: docSnap.id,
            firstName: data.firstName ?? '',
            lastName: data.lastName ?? '',
            email: data.email ?? '',
            phone: data.phone ?? '',
            status: data.status ?? 'active',
            assignedCourseIds,
            globalRoles: Array.isArray(data.roles)
              ? data.roles.filter((role): role is string => typeof role === 'string')
              : [],
            membershipRoles,
            companyIdRefs: Array.isArray(data.companyIdRefs)
              ? data.companyIdRefs.filter((id): id is string => typeof id === 'string')
              : [],
            customerName:
              typeof membership?.customerName === 'string' ? membership?.customerName : undefined,
          };
        });
        setUsers(next);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load customer users', err);
        setUsers([]);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [customerId]);

  return { users, loading };
};

