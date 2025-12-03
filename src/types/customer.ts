export type CustomerStatus = 'active' | 'inactive';

export interface Customer {
  id: string;
  companyName: string;
  address: string;
  zipno: string;
  place: string;
  vatNumber: string;
  status: CustomerStatus;
  allowSubunits: boolean;
  parentCustomerId?: string | null;
  parentCustomerName?: string | null;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  createdByCompanyId: string;
  courseIds: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export type CustomerPayload = Omit<
  Customer,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'createdByCompanyId'
  | 'courseIds'
>;

