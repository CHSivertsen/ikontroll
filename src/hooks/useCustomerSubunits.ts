'use client';

import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type { Customer, CustomerPayload } from '@/types/customer';

interface UseCustomerSubunitsState {
  subunits: Customer[];
  loading: boolean;
  error: string | null;
  createSubunit: (payload: CustomerPayload) => Promise<string>;
  updateSubunit: (id: string, payload: Partial<CustomerPayload>) => Promise<void>;
  deleteSubunit: (id: string) => Promise<void>;
}

export const useCustomerSubunits = (
  parentCustomerId: string | null,
  ownerCompanyId: string | null,
): UseCustomerSubunitsState => {
  const [subunits, setSubunits] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const collectionRef = useMemo(() => collection(db, 'customers'), []);

  useEffect(() => {
    if (!parentCustomerId) {
      startTransition(() => {
        setSubunits([]);
        setLoading(false);
        setError(null);
      });
      return;
    }

    startTransition(() => {
      setLoading(true);
    });

    const q = query(collectionRef, where('parentCustomerId', '==', parentCustomerId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const next: Customer[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            parentCustomerId: data.parentCustomerId ?? parentCustomerId,
            parentCustomerName:
              typeof data.parentCustomerName === 'string'
                ? data.parentCustomerName
                : null,
            companyName: data.companyName ?? '',
            address: data.address ?? '',
            zipno: data.zipno ?? '',
            place: data.place ?? '',
            vatNumber: data.vatNumber ?? '',
            status: data.status ?? 'active',
            allowSubunits:
              typeof data.allowSubunits === 'boolean' ? data.allowSubunits : false,
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
        setSubunits(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Failed to load customer subunits', err);
        setError('Kunne ikke hente underenheter.');
        setSubunits([]);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [collectionRef, parentCustomerId]);

  const createSubunit = useCallback(
    async (payload: CustomerPayload) => {
      if (!ownerCompanyId) {
        throw new Error('Manglende tilknytning til systemeier.');
      }
      if (!payload.parentCustomerId) {
        throw new Error('parentCustomerId må settes.');
      }
      const docRef = await addDoc(collectionRef, {
        ...payload,
        allowSubunits: payload.allowSubunits ?? false,
        courseIds: Array.isArray(payload.courseIds) ? payload.courseIds : [],
        createdByCompanyId: ownerCompanyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    },
    [collectionRef, ownerCompanyId],
  );

  const updateSubunit = useCallback(
    async (id: string, payload: Partial<CustomerPayload>) => {
      if (!id) {
        throw new Error('Ugyldig underenhet-ID.');
      }
      const subunitRef = doc(db, 'customers', id);
      await updateDoc(subunitRef, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    },
    [],
  );

  const deleteSubunit = useCallback(async (id: string) => {
    if (!id) {
      throw new Error('Ugyldig underenhet-ID.');
    }
    await deleteDoc(doc(db, 'customers', id));
  }, []);

  return {
    subunits,
    loading,
    error,
    createSubunit,
    updateSubunit,
    deleteSubunit,
  };
};


