'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type { Customer } from '@/types/customer';

interface UseCustomerState {
  customer: Customer | null;
  loading: boolean;
  error: string | null;
}

export const useCustomer = (
  ownerCompanyId: string | null,
  customerId: string | null,
): UseCustomerState => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const docRef = useMemo(() => {
    if (!customerId) {
      return null;
    }
    return doc(db, 'customers', customerId);
  }, [customerId]);

  useEffect(() => {
    if (!docRef) {
      startTransition(() => {
        setCustomer(null);
        setLoading(false);
        setError(null);
      });
      return;
    }

    startTransition(() => {
      setLoading(true);
    });
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setCustomer(null);
          setError('Fant ikke kunden.');
        } else {
          const data = snapshot.data();
          const createdByCompanyId = data.createdByCompanyId ?? '';
          
          // If ownerCompanyId is provided (system admin context), verify ownership.
          // If null (consumer context), we assume access is checked elsewhere or this hook is used for public/authorized read.
          if (ownerCompanyId && createdByCompanyId && createdByCompanyId !== ownerCompanyId) {
            setCustomer(null);
            setError('Du har ikke tilgang til denne kunden.');
          } else {
            setCustomer({
              id: snapshot.id,
              companyName: data.companyName ?? '',
              address: data.address ?? '',
              zipno: data.zipno ?? '',
              place: data.place ?? '',
              vatNumber: data.vatNumber ?? '',
              status: data.status ?? 'active',
              contactPerson: data.contactPerson ?? '',
              contactPhone: data.contactPhone ?? '',
              contactEmail: data.contactEmail ?? '',
              createdByCompanyId,
              courseIds: Array.isArray(data.courseIds)
                ? (data.courseIds as string[])
                : [],
              createdAt: data.createdAt?.toDate?.() ?? undefined,
              updatedAt: data.updatedAt?.toDate?.() ?? undefined,
            });
            setError(null);
          }
        }
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load customer', err);
        setCustomer(null);
        setError('Kunne ikke hente kunden');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [docRef, ownerCompanyId]);

  return { customer, loading, error };
};
