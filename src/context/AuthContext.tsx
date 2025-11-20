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
import type { PortalUser } from '@/types/user';

type AuthContextValue = {
  firebaseUser: User | null;
  profile: PortalUser | null;
  companyId: string | null;
  setCompanyId: (companyId: string | null) => void;
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const COMPANY_STORAGE_KEY = 'ikontroll.companyId';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<PortalUser | null>(null);
  const [companyId, setCompanyIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const stored = localStorage.getItem(COMPANY_STORAGE_KEY);
    if (stored) {
      setCompanyIdState(stored);
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (current) => {
      setFirebaseUser(current);
      setLoading(true);

      if (!current) {
        setProfile(null);
        updateCompany(null);
        setLoading(false);
        return;
      }

      try {
        const snapshot = await getDoc(doc(db, 'users', current.uid));
        if (snapshot.exists()) {
          const data = snapshot.data() as Omit<PortalUser, 'id'>;
          const portalUser: PortalUser = { id: snapshot.id, ...data };
          setProfile(portalUser);

          const adminCompanies = portalUser.companyIds.filter((company) =>
            company.roles.includes('admin'),
          );

          if (adminCompanies.length === 1) {
            updateCompany(adminCompanies[0].companyId);
          } else if (
            adminCompanies.every(
              (company) => company.companyId !== companyId,
            )
          ) {
            updateCompany(null);
          }
        } else {
          setProfile(null);
          console.warn('User document missing for uid', current.uid);
        }
      } catch (error) {
        console.error('Failed to load user profile', error);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [companyId, updateCompany]);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      companyId,
      setCompanyId: updateCompany,
      loading,
      logout: () => signOut(auth),
    }),
    [firebaseUser, profile, companyId, loading],
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

