'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type { Customer, CustomerPayload } from '@/types/customer';

interface UseCustomersState {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  createCustomer: (payload: CustomerPayload) => Promise<void>;
  updateCustomer: (id: string, payload: CustomerPayload) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
}

export const useCustomers = (companyId: string | null): UseCustomersState => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setCustomers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const customersRef = collection(db, 'companies', companyId, 'customers');
    const q = query(customersRef, orderBy('companyName'));
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
            contactPerson: data.contactPerson ?? '',
            contactPhone: data.contactPhone ?? '',
            contactEmail: data.contactEmail ?? '',
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

  const customersRef = useMemo(() => {
    if (!companyId) {
      return null;
    }
    return collection(db, 'companies', companyId, 'customers');
  }, [companyId]);

  const createCustomer = useCallback(
    async (payload: CustomerPayload) => {
      if (!customersRef) {
        throw new Error('Company is not selected');
      }

      await addDoc(customersRef, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    [customersRef],
  );

  const updateCustomer = useCallback(
    async (id: string, payload: CustomerPayload) => {
      if (!companyId) {
        throw new Error('Company is not selected');
      }

      const customerRef = doc(db, 'companies', companyId, 'customers', id);
      await updateDoc(customerRef, {
        ...payload,
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

      const customerRef = doc(db, 'companies', companyId, 'customers', id);
      await deleteDoc(customerRef);
    },
    [companyId],
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

