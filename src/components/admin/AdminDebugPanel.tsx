import React, { useState, useEffect } from 'react';
import { Shield, RefreshCw, CheckCircle, XCircle, AlertTriangle, Info, Eye, EyeOff, Database, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface AdminStatus {
  authenticated: boolean;
  user_id: string | null;
  user_email: string | null;
  profile_exists: boolean;
  profile_role: string | null;
  metadata_role: string | null;
  is_admin_result: boolean;
  diagnosis: string;
  timestamp: string;
  raw_metadata?: any;
}

export const AdminDebugPanel: React.FC = () => {
  const [adminStatus, setAdminStatus] = useState<AdminStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRawData, setShowRawData] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [dbConnectionStatus, setDbConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [currentDbUrl, setCurrentDbUrl] = useState<string>('');
  const [functionsExist, setFunctionsExist] = useState(false);

  useEffect(() => {
    // Get the current database URL from environment
    const dbUrl = import.meta.env.VITE_SUPABASE_URL;
    setCurrentDbUrl(dbUrl || 'Not configured');

    // Check database connection on mount
    testDatabaseConnection();
  }, []);

  const testDatabaseConnection = async () => {
    setDbConnectionStatus('checking');
    try {
      // Simple query to test connection
      const { error } = await supabase.from('user_profiles').select('count').limit(1);

      if (error) {
        console.error('Database connection test failed:', error);
        setDbConnectionStatus('error');
      } else {
        setDbConnectionStatus('connected');
      }
    } catch (err) {
      console.error('Database connection test error:', err);
      setDbConnectionStatus('error');
    }
  };

  const checkAdminStatus = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: status, error: statusError } = await supabase.rpc('debug_admin_status');

      if (statusError) {
        console.error('Error checking admin status:', statusError);

        // Check if error is due to missing function
        if (statusError.message.includes('Could not find the function') ||
            statusError.message.includes('does not exist')) {
          setFunctionsExist(false);
          setError(
            'Database setup incomplete: Required admin functions are missing. ' +
            'Please run the database migrations to set up admin functionality.'
          );
        } else {
          setError(`Failed to check admin status: ${statusError.message}`);
        }
        return;
      }

      setFunctionsExist(true);
      console.log('Admin status result:', status);
      setAdminStatus(status as AdminStatus);
    } catch (err) {
      console.error('Error in checkAdminStatus:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyAdminAccess = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: result, error: verifyError } = await supabase.rpc('verify_admin_access');

      if (verifyError) {
        console.error('Error verifying admin access:', verifyError);
        setError(`Failed to verify admin access: ${verifyError.message}`);
        return;
      }

      console.log('Admin verification result:', result);
      alert(result.message || 'Verification complete');
      await checkAdminStatus();
    } catch (err) {
      console.error('Error in verifyAdminAccess:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (isSuccess: boolean) => {
    return isSuccess ? (
      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
    ) : (
      <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
    );
  };

  const getDiagnosisColor = (diagnosis: string) => {
    if (diagnosis.includes('✅')) return 'text-green-700 dark:text-green-300';
    if (diagnosis.includes('⚠️')) return 'text-yellow-700 dark:text-yellow-300';
    return 'text-red-700 dark:text-red-300';
  };

  return (
    <div className="bg-white dark:bg-dark-100 rounded-xl shadow-lg border border-gray-200 dark:border-dark-300 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-dark-200 dark:to-dark-300 p-4 border-b border-gray-200 dark:border-dark-400">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 dark:bg-blue-500 w-10 h-10 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Admin Debug Panel
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Diagnose and troubleshoot admin access issues
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-6 space-y-4">
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={checkAdminStatus}
              disabled={isLoading}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Check Admin Status</span>
            </button>

            <button
              onClick={verifyAdminAccess}
              disabled={isLoading}
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              <Shield className="w-4 h-4" />
              <span>Verify Access</span>
            </button>

            <button
              onClick={() => setShowRawData(!showRawData)}
              className="flex items-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {showRawData ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span>{showRawData ? 'Hide' : 'Show'} Raw Data</span>
            </button>
          </div>

          {/* Database Connection Status */}
          <div className="p-4 bg-gray-50 dark:bg-dark-200 rounded-xl border border-gray-200 dark:border-dark-400">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Database Connection</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 font-mono">{currentDbUrl}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {dbConnectionStatus === 'checking' && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">Checking...</span>
                )}
                {dbConnectionStatus === 'connected' && (
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                )}
                {dbConnectionStatus === 'error' && (
                  <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                )}
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/50 rounded-xl">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">Error</p>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>

                  {!functionsExist && (
                    <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-500/50">
                      <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-2">Setup Required:</p>
                      <ol className="text-xs text-yellow-700 dark:text-yellow-400 space-y-1 list-decimal list-inside">
                        <li>Apply the database migration: <code className="bg-yellow-100 dark:bg-yellow-900/40 px-1 rounded">20251002120000_comprehensive_admin_rls_fix.sql</code></li>
                        <li>This will create the required admin functions and policies</li>
                        <li>Refresh this page after applying the migration</li>
                      </ol>
                      <a
                        href="https://supabase.com/dashboard/project/rixmudvtbfkjpwjoefon/sql/new"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open Supabase SQL Editor</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Status Display */}
          {adminStatus && (
            <div className="space-y-4">
              {/* Overall Status */}
              <div className={`p-4 rounded-xl border ${
                adminStatus.is_admin_result
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-500/50'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-500/50'
              }`}>
                <div className="flex items-center space-x-3">
                  {getStatusIcon(adminStatus.is_admin_result)}
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {adminStatus.is_admin_result ? 'Admin Access Verified' : 'No Admin Access'}
                    </p>
                    <p className={`text-sm mt-1 ${getDiagnosisColor(adminStatus.diagnosis)}`}>
                      {adminStatus.diagnosis}
                    </p>
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Authentication Status */}
                <div className="p-4 bg-gray-50 dark:bg-dark-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Authenticated
                    </span>
                    {getStatusIcon(adminStatus.authenticated)}
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {adminStatus.authenticated ? 'Yes' : 'No'}
                  </p>
                </div>

                {/* Profile Exists */}
                <div className="p-4 bg-gray-50 dark:bg-dark-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Profile Exists
                    </span>
                    {getStatusIcon(adminStatus.profile_exists)}
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {adminStatus.profile_exists ? 'Yes' : 'No'}
                  </p>
                </div>

                {/* Profile Role */}
                <div className="p-4 bg-gray-50 dark:bg-dark-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Profile Role
                    </span>
                    {getStatusIcon(adminStatus.profile_role === 'admin')}
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {adminStatus.profile_role || 'Not Set'}
                  </p>
                </div>

                {/* Metadata Role */}
                <div className="p-4 bg-gray-50 dark:bg-dark-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Metadata Role
                    </span>
                    {getStatusIcon(adminStatus.metadata_role === 'admin')}
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {adminStatus.metadata_role || 'Not Set'}
                  </p>
                </div>
              </div>

              {/* User Info */}
              {adminStatus.user_email && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-500/50">
                  <div className="flex items-start space-x-3">
                    <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
                        Logged in as
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-400 mt-1 font-mono">
                        {adminStatus.user_email}
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                        User ID: {adminStatus.user_id}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Raw Data */}
              {showRawData && adminStatus.raw_metadata && (
                <div className="p-4 bg-gray-900 dark:bg-black rounded-lg border border-gray-700">
                  <p className="text-xs font-medium text-gray-400 mb-2">Raw Metadata</p>
                  <pre className="text-xs text-gray-300 overflow-x-auto">
                    {JSON.stringify(adminStatus.raw_metadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* Timestamp */}
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Last checked: {new Date(adminStatus.timestamp).toLocaleString()}
              </p>
            </div>
          )}

          {/* Help Text */}
          {!adminStatus && !error && !isLoading && (
            <div className="p-4 bg-gray-50 dark:bg-dark-200 rounded-lg border border-gray-200 dark:border-dark-400">
              <div className="flex items-start space-x-3">
                <Info className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Admin Status Checker
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Click "Check Admin Status" to diagnose admin access issues. This tool will
                    verify your authentication, profile setup, and role configuration.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
