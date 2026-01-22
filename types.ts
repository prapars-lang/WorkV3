
export interface StudentSubmission {
  rowId?: number;
  timestamp?: string;
  name: string;
  studentNumber: string;
  grade: string;
  room: string;
  activityType: 'Sports Day' | 'Children Day';
  videoFile?: File | null;
  fileUrl?: string;
  review?: RubricReview;
  reactions?: { [key: string]: number };
}

export interface RubricReview {
  contentAccuracy: number;
  participation: number;
  presentation: number;
  discipline: number;
  totalScore: number;
  percentage: number;
  comment: string;
  gradedAt?: string;
  status: 'Graded' | 'Pending';
}

export enum AppView {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
  GALLERY = 'GALLERY',
  RESULT = 'RESULT',
  DASHBOARD = 'DASHBOARD',
  TEACHER_LOGIN = 'TEACHER_LOGIN'
}

export enum AppStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  LOADING_DATA = 'LOADING_DATA'
}

export interface GASResponse {
  success: boolean;
  message: string;
  fileUrl?: string;
  data?: any;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning';
  icon?: string;
}
