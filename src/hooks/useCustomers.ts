'use client';

import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type { Customer, CustomerPayload } from '@/types/customer';

interface UseCustomersState {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  createCustomer: (payload: CustomerPayload) => Promise<string>;
  updateCustomer: (id: string, payload: CustomerPayload) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
}

export const useCustomers = (companyId: string | null): UseCustomersState => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      startTransition(() => {
        setCustomers([]);
        setLoading(false);
        setError(null);
      });
      return;
    }

    startTransition(() => {
      setLoading(true);
    });
    const customersRef = collection(db, 'customers');
    const q = query(
      customersRef,
      where('createdByCompanyId', '==', companyId),
      orderBy('companyName'),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const next: Customer[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            companyName: data.companyName ?? '',
            address: data.address ?? '',
            zipno: data.zipno ?? '',
            place: data.place ?? '',
            vatNumber: data.vatNumber ?? '',
            status: data.status ?? 'active',
            allowSubunits:
              typeof data.allowSubunits === 'boolean' ? data.allowSubunits : false,
            parentCustomerId:
              typeof data.parentCustomerId === 'string' ? data.parentCustomerId : null,
            parentCustomerName:
              typeof data.parentCustomerName === 'string'
                ? data.parentCustomerName
                : null,
            contactPerson: data.contactPerson ?? '',
            contactPhone: data.contactPhone ?? '',
            contactEmail: data.contactEmail ?? '',
            createdByCompanyId: data.createdByCompanyId ?? '',
            courseIds: Array.isArray(data.courseIds)
              ? (data.courseIds as string[])
              : [],
            createdAt: data.createdAt?.toDate?.() ?? undefined,
            updatedAt: data.updatedAt?.toDate?.() ?? undefined,
          };
        });
        setCustomers(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Failed to load customers', err);
        setError('Kunne ikke hente kunder');
        setCustomers([]);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [companyId]);

  const customersCollection = useMemo(() => collection(db, 'customers'), []);
  const usersCollection = useMemo(() => collection(db, 'users'), []);

  const createCustomer = useCallback(
    async (payload: CustomerPayload) => {
      if (!companyId) {
        throw new Error('Company is not selected');
      }

      const docRef = await addDoc(customersCollection, {
        ...payload,
        allowSubunits: payload.allowSubunits ?? false,
        parentCustomerId: payload.parentCustomerId ?? null,
        parentCustomerName: payload.parentCustomerName ?? null,
        courseIds: [],
        createdByCompanyId: companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    },
    [companyId, customersCollection],
  );

  const updateCustomer = useCallback(
    async (id: string, payload: CustomerPayload) => {
      if (!companyId) {
        throw new Error('Company is not selected');
      }

      const customerRef = doc(db, 'customers', id);
      await updateDoc(customerRef, {
        ...payload,
        allowSubunits: payload.allowSubunits ?? false,
        parentCustomerId: payload.parentCustomerId ?? null,
        parentCustomerName: payload.parentCustomerName ?? null,
        updatedAt: serverTimestamp(),
      });
    },
    [companyId],
  );

  const deleteCustomer = useCallback(
    async (id: string) => {
      if (!companyId) {
        throw new Error('Company is not selected');
      }

      const customerRef = doc(db, 'customers', id);
      await deleteDoc(customerRef);
      const userQuery = query(
        usersCollection,
        where('customerIdRefs', 'array-contains', id),
      );
      const usersSnapshot = await getDocs(userQuery);
      await Promise.all(
        usersSnapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const memberships = Array.isArray(data.customerMemberships)
            ? data.customerMemberships
            : [];
          const filteredMemberships = memberships.filter(
            (membership: unknown) =>
              typeof membership === 'object' &&
              membership !== null &&
              'customerId' in membership &&
              (membership as { customerId?: string }).customerId !== id,
          );
          await updateDoc(doc(db, 'users', docSnap.id), {
            customerMemberships: filteredMemberships,
            customerIdRefs: arrayRemove(id),
            updatedAt: serverTimestamp(),
          });
        }),
      );
    },
    [companyId, usersCollection],
  );

  return {
    customers,
    loading,
    error,
    createCustomer,
    updateCustomer,
    deleteCustomer,
  };
};

