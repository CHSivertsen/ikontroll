export type CourseStatus = 'active' | 'inactive';

export type LocaleStringMap = Record<string, string>;

export interface Course {
  id: string;
  companyId: string;
  createdById: string;
  title: string;
  description?: string;
  status: CourseStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CourseQuestionAlternative {
  id: string;
  altText: LocaleStringMap;
}

export interface CourseQuestion {
  id: string;
  title: LocaleStringMap;
  contentText: LocaleStringMap;
  alternatives: CourseQuestionAlternative[];
  correctAnswerId: string;
}

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  summary?: string;
  body?: LocaleStringMap;
  videoUrls: string[];
  imageUrls: string[];
  order: number;
  questions: CourseQuestion[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CoursePayload
  extends Omit<Course, 'id' | 'createdAt' | 'updatedAt'> {}

export interface CourseModulePayload
  extends Omit<CourseModule, 'id' | 'courseId' | 'createdAt' | 'updatedAt'> {}

