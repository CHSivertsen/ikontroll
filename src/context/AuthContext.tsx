'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { auth, db } from '@/lib/firebase';
import type { CustomerMembership } from '@/types/companyUser';
import type { CompanyMembership, CompanyRole, PortalUser } from '@/types/user';

type AuthContextValue = {
  firebaseUser: User | null;
  profile: PortalUser | null;
  companyId: string | null;
  setCompanyId: (companyId: string | null) => void;
  customerMemberships: CustomerMembership[];
  activeCustomerId: string | null;
  setActiveCustomerId: (customerId: string | null) => void;
  isSystemOwner: boolean;
  isCustomerAdmin: boolean;
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const COMPANY_STORAGE_KEY = 'ikontroll.companyId';
const CUSTOMER_STORAGE_KEY = 'ikontroll.customerId';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<PortalUser | null>(null);
  const [companyId, setCompanyIdState] = useState<string | null>(null);
  const [customerMemberships, setCustomerMemberships] = useState<CustomerMembership[]>([]);
  const [activeCustomerId, setActiveCustomerIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const stored = localStorage.getItem(COMPANY_STORAGE_KEY);
    if (stored) {
      setCompanyIdState(stored);
    }
    const storedCustomer = localStorage.getItem(CUSTOMER_STORAGE_KEY);
    if (storedCustomer) {
      setActiveCustomerIdState(storedCustomer);
    }
  }, []);

  const updateCompany = useCallback((id: string | null) => {
    setCompanyIdState(id);

    if (typeof window === 'undefined') {
      return;
    }

    if (id) {
      localStorage.setItem(COMPANY_STORAGE_KEY, id);
    } else {
      localStorage.removeItem(COMPANY_STORAGE_KEY);
    }
  }, []);

  const updateActiveCustomer = useCallback(
    (id: string | null, persist: boolean = true) => {
      setActiveCustomerIdState(id);

      if (!persist || typeof window === 'undefined') {
        return;
      }

      if (id) {
        localStorage.setItem(CUSTOMER_STORAGE_KEY, id);
      } else {
        localStorage.removeItem(CUSTOMER_STORAGE_KEY);
      }
    },
    [],
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (current) => {
      setFirebaseUser(current);
      setLoading(true);

      if (!current) {
        setProfile(null);
        updateCompany(null);
        updateActiveCustomer(null);
        setCustomerMemberships([]);
        setLoading(false);
        return;
      }

      try {
        const snapshot = await getDoc(doc(db, 'users', current.uid));
        if (snapshot.exists()) {
          const data = snapshot.data();
          const companyRaw = Array.isArray(data.companyIds) ? data.companyIds : [];

          const normalizedCompanies: CompanyMembership[] = companyRaw
            .map((entry) => {
              if (
                typeof entry === 'object' &&
                entry !== null &&
                'companyId' in entry
              ) {
                const { companyId, roles, displayName } = entry as {
                  companyId?: unknown;
                  roles?: unknown;
                  displayName?: unknown;
                };
                if (typeof companyId === 'string') {
                  const normalizedRoles = Array.isArray(roles)
                    ? roles.filter((role): role is CompanyRole =>
                        role === 'admin' || role === 'editor' || role === 'viewer',
                      )
                    : [];
                  return {
                    companyId,
                    roles: normalizedRoles,
                    displayName: typeof displayName === 'string' ? displayName : undefined,
                  };
                }
              } else if (typeof entry === 'string') {
                return { companyId: entry, roles: [] as CompanyRole[] };
              }
              return null;
            })
            .filter((entry): entry is CompanyMembership => entry !== null);

          const portalUser: PortalUser = {
            id: snapshot.id,
            email: typeof data.email === 'string' ? data.email : '',
            firstName: typeof data.firstName === 'string' ? data.firstName : '',
            lastName: typeof data.lastName === 'string' ? data.lastName : '',
            companyIds: normalizedCompanies,
            customerMemberships: Array.isArray(data.customerMemberships)
              ? (data.customerMemberships as CustomerMembership[])
              : [],
          };
          setProfile(portalUser);

          const adminCompanies =
            portalUser.companyIds?.filter((company) =>
              company.roles?.includes('admin'),
            ) ?? [];

          if (adminCompanies.length === 1) {
            updateCompany(adminCompanies[0].companyId);
          } else if (
            adminCompanies.every(
              (company) => company.companyId !== companyId,
            )
          ) {
            updateCompany(null);
          }

          const memberships =
            portalUser.customerMemberships?.filter((membership) =>
              membership.roles.includes('admin'),
            ) ?? [];
          setCustomerMemberships(memberships);

          if (memberships.length === 1) {
            updateActiveCustomer(memberships[0].customerId);
          } else if (!memberships.length) {
            updateActiveCustomer(null);
          } else if (
            memberships.every(
              (membership) => membership.customerId !== activeCustomerId,
            )
          ) {
            const stored = localStorage.getItem(CUSTOMER_STORAGE_KEY);
            const validStored = memberships.find(
              (membership) => membership.customerId === stored,
            );
            if (validStored) {
              setActiveCustomerIdState(validStored.customerId);
            } else {
              updateActiveCustomer(null, false);
            }
          }
        } else {
          setProfile(null);
          console.warn('User document missing for uid', current.uid);
          setCustomerMemberships([]);
          updateActiveCustomer(null);
        }
      } catch (error) {
        console.error('Failed to load user profile', error);
        setProfile(null);
        setCustomerMemberships([]);
        updateActiveCustomer(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [activeCustomerId, companyId, updateActiveCustomer, updateCompany]);

  const isSystemOwner =
    (profile?.companyIds ?? []).some((company) => company.roles?.includes('admin'));
  const isCustomerAdmin = customerMemberships.length > 0;

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      companyId,
      setCompanyId: updateCompany,
      customerMemberships,
      activeCustomerId,
      setActiveCustomerId: updateActiveCustomer,
      isSystemOwner,
      isCustomerAdmin,
      loading,
      logout: () => signOut(auth),
    }),
    [
      firebaseUser,
      profile,
      companyId,
      customerMemberships,
      activeCustomerId,
      isSystemOwner,
      isCustomerAdmin,
      loading,
      updateCompany,
      updateActiveCustomer,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

