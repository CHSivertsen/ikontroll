export interface DiplomaTemplate {
  companyId: string;
  title: string;
  body: string;
  footer: string;
  issuerName: string;
  signatureName: string;
  signatureTitle: string;
  signatureUrl?: string;
  accentColor: string;
  logoUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CourseCompletion {
  courseId: string;
  customerId: string;
  companyId: string;
  customerName: string;
  courseTitle: string;
  participantName: string;
  completedAt: Date;
}
