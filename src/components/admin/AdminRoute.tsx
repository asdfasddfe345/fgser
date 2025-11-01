// src/components/admin/AdminRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AlertTriangle, User } from 'lucide-react';

interface AdminRouteProps {
  children: React.ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center dark:from-dark-50 dark:to-dark-200">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center dark:bg-dark-100">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Check both role field and email for backward compatibility
  const isAdmin = user?.role === 'admin' || user?.email === 'primoboostai@gmail.com';

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center dark:from-dark-50 dark:to-dark-200">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center max-w-md w-full mx-4 dark:bg-dark-100 dark:border-dark-300">
          <div className="bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 dark:bg-red-900/20">
            <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-400" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Access Denied
          </h1>

          <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
            This area is restricted to administrators only.
          </p>

          <div className="bg-gray-50 rounded-xl p-4 mb-6 dark:bg-dark-200">
            <div className="flex items-center justify-center space-x-3">
              <User className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Logged in as: <strong>{user?.email || 'Unknown'}</strong>
              </span>
            </div>
          </div>

          <button
            onClick={() => window.location.href = '/'}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors w-full"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
