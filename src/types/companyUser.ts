export type CompanyUserRole = 'admin' | 'user';
export type CompanyUserStatus = 'active' | 'inactive';

export interface CompanyUser {
  id: string;
  authUid?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: CompanyUserRole;
  status: CompanyUserStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CompanyUserPayload = Omit<
  CompanyUser,
  'id' | 'authUid' | 'createdAt' | 'updatedAt'
>;

