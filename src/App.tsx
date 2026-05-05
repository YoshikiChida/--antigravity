import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider, useAppContext } from './store/AppContext';
import { ThemeProvider } from './store/ThemeContext';
import { ToastProvider } from './components/Toast';
import { Layout } from './components/Layout';
import { BranchSelect } from './pages/BranchSelect';
import { EmployeeManage } from './pages/EmployeeManage';
import { ShiftManage } from './pages/ShiftManage';
import { EmployeeRequest } from './pages/EmployeeRequest';
import { Dashboard } from './pages/Dashboard';
import { CourseManage } from './pages/CourseManage';
import { HelpPage } from './pages/HelpPage';
import { StartupNotice } from './components/StartupNotice';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { data } = useAppContext();
  if (!data.currentBranchId) {
    return <BranchSelect />;
  }
  return <>{children}</>;
};

const AppContent = () => {
  return (
    <>
    <StartupNotice />
    <BrowserRouter>
      <Routes>
        {/* Unprotected Routes */}
        <Route path="/request" element={<EmployeeRequest />} />

        {/* Protected Admin Routes */}
        <Route path="/" element={<Layout />}>
          <Route
            index
            element={
              <ProtectedRoute>
                <ShiftManage />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="courses"
            element={
              <ProtectedRoute>
                <CourseManage />
              </ProtectedRoute>
            }
          />
          <Route
            path="employees"
            element={
              <ProtectedRoute>
                <EmployeeManage />
              </ProtectedRoute>
            }
          />
          <Route path="help" element={<HelpPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </>
  );
};

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
