// src/components/modals/AuthenticationRequiredModal.tsx
import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Lock, AlertCircle, CheckCircle, Loader2, Shield } from 'lucide-react';
import { platformDetectionService } from '../../services/platformDetectionService';

interface AuthenticationRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  platformName: string;
  platformDisplayName: string;
  loginUrl: string;
  applicationUrl: string;
  onAuthenticationComplete: (sessionData: any) => void;
  onSkip: () => void;
}

export const AuthenticationRequiredModal: React.FC<AuthenticationRequiredModalProps> = ({
  isOpen,
  onClose,
  platformName,
  platformDisplayName,
  loginUrl,
  applicationUrl,
  onAuthenticationComplete,
  onSkip,
}) => {
  const [authMethod, setAuthMethod] = useState<'iframe' | 'newtab'>('newtab');
  const [authWindow, setAuthWindow] = useState<Window | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [authStatus, setAuthStatus] = useState<'waiting' | 'checking' | 'success' | 'failed'>('waiting');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (!isOpen) {
      // Clean up
      if (authWindow && !authWindow.closed) {
        authWindow.close();
      }
      setAuthWindow(null);
      setAuthStatus('waiting');
      setErrorMessage('');
    }
  }, [isOpen, authWindow]);

  const handleOpenNewTab = () => {
    setAuthMethod('newtab');
    const newWindow = window.open(loginUrl, '_blank', 'width=800,height=600');
    setAuthWindow(newWindow);
    setAuthStatus('waiting');

    // Start polling for authentication
    startAuthPolling();
  };

  const startAuthPolling = () => {
    let pollCount = 0;
    const maxPolls = 120; // 2 minutes max

    const pollInterval = setInterval(async () => {
      pollCount++;

      if (pollCount > maxPolls) {
        clearInterval(pollInterval);
        setAuthStatus('failed');
        setErrorMessage('Authentication timeout. Please try again.');
        return;
      }

      // Check if auth window is closed
      if (authWindow && authWindow.closed) {
        clearInterval(pollInterval);
        setAuthStatus('checking');
        await checkAuthentication();
      }
    }, 1000);
  };

  const checkAuthentication = async () => {
    setIsChecking(true);
    setAuthStatus('checking');

    try {
      // Try to detect if user is authenticated by checking for session cookies
      // In a real implementation, this would involve:
      // 1. Making a test request to the platform
      // 2. Checking for valid session cookies
      // 3. Verifying authentication state

      // Simulate authentication check
      await new Promise(resolve => setTimeout(resolve, 2000));

      // For now, we'll extract cookies from the document
      const cookies = document.cookie.split(';').map(cookie => {
        const [name, value] = cookie.trim().split('=');
        return { name, value };
      });

      // Get platform-specific cookie names
      const sessionCookieNames = platformDetectionService.getSessionCookieNames(platformName);

      const sessionCookies = cookies.filter(cookie =>
        sessionCookieNames.some(name => cookie.name.includes(name))
      );

      if (sessionCookies.length > 0) {
        setAuthStatus('success');

        // Prepare session data
        const sessionData = {
          cookies: sessionCookies,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        };

        // Notify parent component
        setTimeout(() => {
          onAuthenticationComplete(sessionData);
        }, 1500);
      } else {
        setAuthStatus('failed');
        setErrorMessage('Could not detect authentication. Please try again or skip for manual apply.');
      }
    } catch (error) {
      setAuthStatus('failed');
      setErrorMessage('Authentication verification failed. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleContinueAfterAuth = async () => {
    await checkAuthentication();
  };

  const handleSkipAuth = () => {
    if (authWindow && !authWindow.closed) {
      authWindow.close();
    }
    onSkip();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 border-b border-gray-200 dark:border-dark-300">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-full hover:bg-white/50"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Authentication Required
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Login to {platformDisplayName} to continue auto-apply
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Status Banner */}
          {authStatus === 'checking' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/50 rounded-xl p-4 mb-4">
              <div className="flex items-center space-x-3">
                <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                <div>
                  <h3 className="font-semibold text-blue-800 dark:text-blue-300">
                    Verifying Authentication
                  </h3>
                  <p className="text-blue-700 dark:text-blue-400 text-sm">
                    Please wait while we verify your login session...
                  </p>
                </div>
              </div>
            </div>
          )}

          {authStatus === 'success' && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/50 rounded-xl p-4 mb-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <div>
                  <h3 className="font-semibold text-green-800 dark:text-green-300">
                    Authentication Successful!
                  </h3>
                  <p className="text-green-700 dark:text-green-400 text-sm">
                    Resuming auto-apply process...
                  </p>
                </div>
              </div>
            </div>
          )}

          {authStatus === 'failed' && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/50 rounded-xl p-4 mb-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-800 dark:text-red-300">
                    Authentication Failed
                  </h3>
                  <p className="text-red-700 dark:text-red-400 text-sm">
                    {errorMessage}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Security Info */}
          <div className="bg-gray-50 dark:bg-dark-200 border border-gray-200 dark:border-dark-300 rounded-xl p-4 mb-6">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Your Security is Our Priority
                </h3>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• No passwords are stored or transmitted</li>
                  <li>• Only session tokens are temporarily saved (24h)</li>
                  <li>• All data is encrypted with AES-256</li>
                  <li>• You can logout anytime from your profile</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
              How to authenticate:
            </h3>
            <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start space-x-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-semibold text-xs">
                  1
                </span>
                <span>Click "Open Login Page" to open {platformDisplayName} in a new tab</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-semibold text-xs">
                  2
                </span>
                <span>Complete the login process on {platformDisplayName}</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-semibold text-xs">
                  3
                </span>
                <span>Close the tab and click "I've Logged In" to continue</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-semibold text-xs">
                  4
                </span>
                <span>We'll verify your session and resume the auto-apply process</span>
              </li>
            </ol>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {authStatus === 'waiting' && !authWindow && (
              <button
                onClick={handleOpenNewTab}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
              >
                <ExternalLink className="w-5 h-5" />
                <span>Open Login Page</span>
              </button>
            )}

            {authStatus === 'waiting' && authWindow && (
              <button
                onClick={handleContinueAfterAuth}
                disabled={isChecking}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isChecking ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>I've Logged In - Continue</span>
                  </>
                )}
              </button>
            )}

            {authStatus === 'failed' && (
              <button
                onClick={handleOpenNewTab}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
              >
                <ExternalLink className="w-5 h-5" />
                <span>Try Again</span>
              </button>
            )}

            <button
              onClick={handleSkipAuth}
              className="w-full bg-gray-200 dark:bg-dark-200 hover:bg-gray-300 dark:hover:bg-dark-300 text-gray-700 dark:text-gray-300 font-semibold py-3 px-4 rounded-xl transition-all duration-200"
            >
              Skip for Manual Apply
            </button>
          </div>

          {/* Platform Link */}
          <div className="mt-4 text-center">
            <a
              href={applicationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Open application page directly
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
