import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { type AppData, type Branch, type Course, type Employee, type Shift } from '../types';
import { loadData, saveData } from '../utils/storage';

interface AppContextType {
  data: AppData;
  setCurrentBranch: (branchId: string | null) => void;
  addBranch: (branch: Branch) => void;
  updateBranch: (branch: Branch) => void;
  deleteBranch: (id: string) => void;
  addCourse: (course: Course) => void;
  updateCourse: (course: Course) => void;
  deleteCourse: (id: string) => void;
  addEmployee: (employee: Employee) => void;
  updateEmployee: (employee: Employee) => void;
  deleteEmployee: (id: string) => void;
  saveShift: (shift: Shift) => void;
  importData: (jsonData: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [data, setData] = useState<AppData>(loadData);

  useEffect(() => {
    saveData(data);
  }, [data]);

  const setCurrentBranch = (branchId: string | null) => {
    setData((prev) => ({ ...prev, currentBranchId: branchId }));
  };

  const addBranch = (branch: Branch) => {
    setData((prev) => ({ ...prev, branches: [...prev.branches, branch] }));
  };

  const updateBranch = (branch: Branch) => {
    setData((prev) => ({
      ...prev,
      branches: prev.branches.map((b) => (b.id === branch.id ? branch : b)),
    }));
  };

  const deleteBranch = (id: string) => {
    setData((prev) => ({
      ...prev,
      branches: prev.branches.filter((b) => b.id !== id),
      currentBranchId: prev.currentBranchId === id ? null : prev.currentBranchId,
    }));
  };

  const addCourse = (course: Course) => {
    setData((prev) => ({ ...prev, courses: [...prev.courses, course] }));
  };

  const updateCourse = (course: Course) => {
    setData((prev) => ({
      ...prev,
      courses: prev.courses.map((c) => (c.id === course.id ? course : c)),
    }));
  };

  const deleteCourse = (id: string) => {
    setData((prev) => ({
      ...prev,
      courses: prev.courses.filter((c) => c.id !== id),
    }));
  };

  const addEmployee = (employee: Employee) => {
    setData((prev) => ({ ...prev, employees: [...prev.employees, employee] }));
  };

  const updateEmployee = (employee: Employee) => {
    setData((prev) => ({
      ...prev,
      employees: prev.employees.map((e) => (e.id === employee.id ? employee : e)),
    }));
  };

  const deleteEmployee = (id: string) => {
    setData((prev) => ({
      ...prev,
      employees: prev.employees.filter((e) => e.id !== id),
    }));
  };

  const saveShift = (shift: Shift) => {
    setData((prev) => {
      const existingIndex = prev.shifts.findIndex(
        (s) => s.yearMonth === shift.yearMonth && s.branchId === shift.branchId
      );
      if (existingIndex >= 0) {
        const newShifts = [...prev.shifts];
        newShifts[existingIndex] = shift;
        return { ...prev, shifts: newShifts };
      }
      return { ...prev, shifts: [...prev.shifts, shift] };
    });
  };

  const importData = (jsonData: string) => {
    try {
      const parsed = JSON.parse(jsonData) as AppData;
      setData(parsed);
    } catch (e) {
      console.error('Failed to import data', e);
      alert('インポートに失敗しました。');
    }
  };

  return (
    <AppContext.Provider
      value={{
        data,
        setCurrentBranch,
        addBranch,
        updateBranch,
        deleteBranch,
        addCourse,
        updateCourse,
        deleteCourse,
        addEmployee,
        updateEmployee,
        deleteEmployee,
        saveShift,
        importData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
