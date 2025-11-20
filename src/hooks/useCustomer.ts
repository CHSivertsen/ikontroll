'use client';

import { useEffect, useMemo, useState } from 'react';
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
    if (!ownerCompanyId || !customerId) {
      return null;
    }
    return doc(db, 'companies', ownerCompanyId, 'customers', customerId);
  }, [ownerCompanyId, customerId]);

  useEffect(() => {
    if (!docRef) {
      setCustomer(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setCustomer(null);
          setError('Fant ikke kunden.');
        } else {
          const data = snapshot.data();
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
            createdAt: data.createdAt?.toDate?.() ?? undefined,
            updatedAt: data.updatedAt?.toDate?.() ?? undefined,
          });
          setError(null);
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
  }, [docRef]);

  return { customer, loading, error };
};

