export type CourseStatus = 'active' | 'inactive';

export type LocaleStringMap = Record<string, string>;
export type LocaleStringArrayMap = Record<string, string[]>;

export interface Course {
  id: string;
  companyId: string;
  createdById: string;
  title: LocaleStringMap;
  description: LocaleStringMap;
  courseImageUrl?: string | null;
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
  title: LocaleStringMap;
  summary: LocaleStringMap;
  body?: LocaleStringMap;
  videoUrls: LocaleStringArrayMap;
  imageUrls: LocaleStringArrayMap;
  order: number;
  questions: CourseQuestion[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CoursePayload
  extends Omit<Course, 'id' | 'createdAt' | 'updatedAt'> {}

export interface CourseModulePayload
  extends Omit<CourseModule, 'id' | 'courseId' | 'createdAt' | 'updatedAt'> {}

