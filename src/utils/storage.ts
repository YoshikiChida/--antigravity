import { type AppData } from '../types';

const STORAGE_KEY = 'yamato_shift_app_data';

const initialData: AppData = {
  branches: [],
  courses: [],
  employees: [],
  shifts: [],
  currentBranchId: null,
};

export const loadData = (): AppData => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      return JSON.parse(data) as AppData;
    } catch (e) {
      console.error('Failed to parse app data', e);
    }
  }
  return initialData;
};

export const saveData = (data: AppData): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};
