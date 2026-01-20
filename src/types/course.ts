export type CourseStatus = 'active' | 'inactive';

export type LocaleStringMap = Record<string, string>;
export type LocaleStringArrayMap = Record<string, string[]>;

export type ModuleMediaType = 'image' | 'video' | 'document';

export interface ModuleMediaItem {
  id: string;
  url: string;
  type: ModuleMediaType;
}

export type LocaleModuleMediaMap = Record<string, ModuleMediaItem[]>;

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
  media?: LocaleModuleMediaMap;
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

