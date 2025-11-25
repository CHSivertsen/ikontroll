export type CompanyUserRole = 'admin' | 'user';
export type CompanyUserStatus = 'active' | 'inactive';

export interface CustomerMembership {
  customerId: string;
  roles: CompanyUserRole[];
}

export interface CompanyUser {
  id: string;
  authUid?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: CompanyUserStatus;
  companyIds?: string[];
  customerIdRefs?: string[];
  customerMemberships: CustomerMembership[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CompanyUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  roles: CompanyUserRole[];
  status: CompanyUserStatus;
}

