export interface Branch {
  id: string;
  name: string;
}

export interface Course {
  id: string;
  branchId: string;
  name: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  breakMinutes: number;
  notes: string;
}

export interface Employee {
  id: string;
  branchId: string;
  name: string;
  employeeId: string;
  assignableCourseIds: string[];
  minDaysPerMonth: number;
  maxDaysPerMonth: number;
  maxDaysPerWeek: number;
  desiredOffDays: Record<string, string[]>; // { "2026-06": ["2026-05-18", "2026-05-20"] }
  events?: Record<string, Record<string, string>>; // { "2026-06": { "2026-05-18": "希望休", "2026-05-19": "会議" } }
}

export interface Shift {
  id: string;
  branchId: string;
  yearMonth: string; // "2026-06"
  // assignments: Record<dateString, Record<courseId, employeeId>>
  assignments: Record<string, Record<string, string>>;
  requiredCourses?: Record<string, string[]>; // { [dateStr]: [courseId1, courseId2] }
}

export interface AppData {
  branches: Branch[];
  courses: Course[];
  employees: Employee[];
  shifts: Shift[];
  currentBranchId: string | null;
}
