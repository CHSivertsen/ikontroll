export type CompanyRole = 'admin' | 'editor' | 'viewer';

export interface CompanyMembership {
  companyId: string;
  roles: CompanyRole[];
  displayName?: string;
}

export interface PortalUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyIds: CompanyMembership[];
}

