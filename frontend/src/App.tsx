import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';

import { ThemeProvider } from './ThemeProvider';
import './i18n';
import GlobalApiHandlers from './components/GlobalApiHandlers';
import { clearAuth, getToken, hasAnyRole, isTokenExpired } from './utils/auth';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Activation from './pages/Activation';
import Reception from './pages/Reception';
import Patients from './pages/Patients';
import Finance from './pages/Finance';
import Doctors from './pages/Doctors';
import System from './pages/System';
import Reports from './pages/Reports';
import QueueTV from './pages/QueueTV';
import { ToastProvider } from './context/ToastContext';

// Simple Protected Route Component
const ProtectedRoute = ({ children, roles }: { children: JSX.Element; roles?: string[] }) => {
  const token = getToken();
  if (!token || isTokenExpired(token)) {
    clearAuth();
    return <Navigate to="/login" replace />;
  }
  if (roles && roles.length > 0 && !hasAnyRole(roles)) {
    return <Navigate to="/" replace />;
  }
  return children;
};

const RootLayout = () => (
  <Layout>
    <Outlet />
  </Layout>
);

function App() {
  // No more local state for auth needed here

  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <ToastProvider>
        <Router>
          <GlobalApiHandlers />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/activation" element={<Activation />} />
            {/* Queue TV - no layout, fullscreen */}
            <Route
              path="/queue-tv"
              element={
                <ProtectedRoute>
                  <QueueTV />
                </ProtectedRoute>
              }
            />

            {/* App routes with global layout */}
            <Route element={<RootLayout />}>
              <Route
                path="/"
                element={
                  <ProtectedRoute roles={['admin', 'owner', 'receptionist', 'cashier']}>
                    <Reception />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/patients"
                element={
                  <ProtectedRoute>
                    <Patients />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finance"
                element={
                  <ProtectedRoute roles={['admin', 'owner', 'cashier']}>
                    <Finance />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute roles={['admin', 'owner', 'cashier']}>
                    <Reports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/system"
                element={
                  <ProtectedRoute roles={['admin', 'owner']}>
                    <System />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/doctors"
                element={
                  <ProtectedRoute roles={['admin', 'owner', 'receptionist']}>
                    <Doctors />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Routes>
        </Router>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
