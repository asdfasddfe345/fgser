// src/components/modals/AutoApplyProgressModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, CheckCircle, AlertCircle, Eye, ExternalLink, Clock, Zap, RefreshCw } from 'lucide-react';
import { AutoApplyResponse } from '../../types/autoApply';
import { externalBrowserService } from '../../services/externalBrowserService';

interface AutoApplyProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string | null;
  jobTitle: string;
  companyName: string;
  onComplete: (result: AutoApplyResponse) => void;
}

type PollingPhase = 'fast' | 'slow' | 'manual';

export const AutoApplyProgressModal: React.FC<AutoApplyProgressModalProps> = ({
  isOpen,
  onClose,
  applicationId,
  jobTitle,
  companyName,
  onComplete
}) => {
  const [status, setStatus] = useState<'pending' | 'processing' | 'completed' | 'failed' | 'not_found'>('pending');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('Initializing...');
  const [result, setResult] = useState<AutoApplyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollingPhase, setPollingPhase] = useState<PollingPhase>('fast');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [consecutive404Count, setConsecutive404Count] = useState(0);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [isSimulationMode, setIsSimulationMode] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollCountRef = useRef(0);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!isOpen || !applicationId) {
      cleanup();
      return;
    }

    startTimeRef.current = Date.now();
    setElapsedTime(0);
    pollCountRef.current = 0;
    setConsecutive404Count(0);

    const isSimulation = externalBrowserService.isUsingMockMode();
    setIsSimulationMode(isSimulation);

    if (isSimulation) {
      handleSimulationMode();
      return;
    }

    startPolling();

    return cleanup;
  }, [isOpen, applicationId, onComplete]);

  const cleanup = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const handleSimulationMode = () => {
    setStatus('processing');
    setProgress(20);
    setCurrentStep('Simulating application process...');

    setTimeout(() => {
      setProgress(100);
      setStatus('completed');
      setCurrentStep('Application simulated successfully');
      setResult({
        success: true,
        message: 'Auto-apply simulated successfully! (Demo Mode)',
        status: 'submitted',
      });

      if (onComplete) {
        onComplete({
          success: true,
          message: 'Auto-apply simulated successfully! (Demo Mode)',
          status: 'submitted',
        });
      }
    }, 2000);
  };

  const startPolling = () => {
    pollStatus();
    scheduleNextPoll();
  };

  const scheduleNextPoll = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    const pollInterval = getPollInterval();
    intervalRef.current = setInterval(() => {
      pollStatus();
    }, pollInterval);
  };

  const getPollInterval = (): number => {
    if (pollingPhase === 'fast') {
      return 2000; // 2 seconds
    } else if (pollingPhase === 'slow') {
      return 5000; // 5 seconds
    }
    return 0; // Manual mode - no auto polling
  };

  const getPhaseMessage = (): string => {
    switch (pollingPhase) {
      case 'fast':
        return 'Quick check mode';
      case 'slow':
        return 'Extended check mode';
      case 'manual':
        return 'Manual refresh available';
      default:
        return '';
    }
  };

  const pollStatus = async () => {
    if (!applicationId) return;

    try {
      pollCountRef.current++;
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedTime(elapsed);

      updatePollingPhase(pollCountRef.current);

      abortControllerRef.current = new AbortController();

      const statusInfo = await externalBrowserService.getAutoApplyStatus(applicationId);

      if (statusInfo.status === 'not_found') {
        handleNotFoundStatus();
        return;
      }

      setConsecutive404Count(0);
      setStatus(statusInfo.status);
      setProgress(statusInfo.progress || 0);
      setCurrentStep(statusInfo.currentStep || 'Processing...');

      if (statusInfo.status === 'completed') {
        handleCompletedStatus(statusInfo);
      } else if (statusInfo.status === 'failed') {
        handleFailedStatus(statusInfo);
      }
    } catch (err: any) {
      console.error('Error polling auto-apply status:', err);

      if (err.name === 'AbortError') {
        return;
      }

      const newCount = consecutive404Count + 1;
      setConsecutive404Count(newCount);

      if (newCount >= 3) {
        handleNotFoundStatus();
      }
    }
  };

  const updatePollingPhase = (pollCount: number) => {
    if (pollCount <= 10 && pollingPhase !== 'fast') {
      setPollingPhase('fast');
    } else if (pollCount > 10 && pollCount <= 20 && pollingPhase !== 'slow') {
      setPollingPhase('slow');
      scheduleNextPoll();
    } else if (pollCount > 20 && pollingPhase !== 'manual') {
      setPollingPhase('manual');
      cleanup();
    }
  };

  const handleNotFoundStatus = () => {
    cleanup();
    setStatus('not_found');
    setError('Application record not available. Please retry or refresh.');
    console.warn(`Application ${applicationId} not found after ${consecutive404Count} attempts`);
  };

  const handleCompletedStatus = (statusInfo: any) => {
    cleanup();
    const completionResult = {
      success: true,
      message: 'Application submitted successfully!',
      status: 'submitted' as const,
      screenshotUrl: statusInfo.screenshotUrl,
    };
    setResult(completionResult);

    if (onComplete) {
      onComplete(completionResult);
    }
  };

  const handleFailedStatus = (statusInfo: any) => {
    cleanup();
    setError(statusInfo.errorMessage || 'Application submission failed');
  };

  const handleManualRefresh = async () => {
    setIsManualRefreshing(true);
    await pollStatus();
    setIsManualRefreshing(false);
  };

  const handleCancel = async () => {
    if (applicationId && (status === 'processing' || status === 'pending')) {
      try {
        await externalBrowserService.cancelAutoApply(applicationId);
        setStatus('failed');
        setCurrentStep('Cancelled by user');
      } catch (err) {
        console.error('Error canceling auto-apply:', err);
      }
    }
    cleanup();
    onClose();
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
      case 'processing':
        return <Loader2 className="w-8 h-8 animate-spin text-blue-600" />;
      case 'completed':
        return <CheckCircle className="w-8 h-8 text-green-600" />;
      case 'failed':
      case 'not_found':
        return <AlertCircle className="w-8 h-8 text-red-600" />;
      default:
        return <Clock className="w-8 h-8 text-gray-600" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'pending':
      case 'processing':
        return 'from-blue-50 to-sky-50';
      case 'completed':
        return 'from-green-50 to-emerald-50';
      case 'failed':
      case 'not_found':
        return 'from-red-50 to-pink-50';
      default:
        return 'from-gray-50 to-slate-50';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[95vh] overflow-y-auto dark:bg-dark-100">
        <div className={`relative bg-gradient-to-r ${getStatusColor()} p-6 border-b border-gray-200 dark:border-dark-300`}>
          <button
            onClick={handleCancel}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-white/50"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              {getStatusIcon()}
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {status === 'pending' && 'Preparing Application...'}
              {status === 'processing' && 'Applying to Job...'}
              {status === 'completed' && 'Application Submitted!'}
              {status === 'failed' && 'Application Failed'}
              {status === 'not_found' && 'Application Not Found'}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              {jobTitle} at {companyName}
            </p>
          </div>
        </div>

        <div className="p-6">
          {(status === 'pending' || status === 'processing') && (
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-dark-300">
                <div
                  className="bg-gradient-to-r from-blue-500 to-sky-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mt-2">
                <span>{currentStep}</span>
                {!isSimulationMode && <span>Processing for {elapsedTime}s</span>}
              </div>
              {!isSimulationMode && pollingPhase !== 'manual' && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                  {getPhaseMessage()}
                </p>
              )}
            </div>
          )}

          <div className="space-y-3 mb-6">
            {[
              { step: 'Analyzing application form', completed: progress > 10 },
              { step: 'Filling personal details', completed: progress > 30 },
              { step: 'Uploading resume', completed: progress > 60 },
              { step: 'Submitting application', completed: progress > 80 },
              { step: 'Capturing confirmation', completed: progress >= 100 }
            ].map((item, index) => (
              <div key={index} className="flex items-center space-x-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  item.completed ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {item.completed ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <span className="text-xs">{index + 1}</span>
                  )}
                </div>
                <span className={`text-sm ${item.completed ? 'text-green-600 font-medium' : 'text-gray-600'}`}>
                  {item.step}
                </span>
              </div>
            ))}
          </div>

          {isSimulationMode && (status === 'processing' || status === 'completed') && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 dark:bg-amber-900/20 dark:border-amber-500/50">
              <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center space-x-2">
                <Zap className="w-4 h-4" />
                <span>Simulation Mode Active</span>
              </h3>
              <p className="text-amber-700 dark:text-amber-400 text-xs">
                Browser automation is not configured. This is a simulated application process for demonstration purposes.
              </p>
            </div>
          )}

          {pollingPhase === 'manual' && status === 'processing' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 dark:bg-blue-900/20 dark:border-blue-500/50">
              <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Still Processing</h3>
              <p className="text-blue-700 dark:text-blue-400 text-sm mb-3">
                Your application is still being processed. You can manually refresh to check the latest status.
              </p>
              <button
                onClick={handleManualRefresh}
                disabled={isManualRefreshing}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg transition-colors text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${isManualRefreshing ? 'animate-spin' : ''}`} />
                <span>{isManualRefreshing ? 'Refreshing...' : 'Refresh Status'}</span>
              </button>
            </div>
          )}

          {status === 'completed' && result && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 dark:bg-green-900/20 dark:border-green-500/50">
              <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">Application Successful!</h3>
              <p className="text-green-700 dark:text-green-400 text-sm mb-3">{result.message}</p>

              <div className="flex flex-wrap gap-2">
                {result.screenshotUrl && (
                  <a
                    href={result.screenshotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View Screenshot</span>
                  </a>
                )}

                {result.redirectUrl && (
                  <a
                    href={result.redirectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>View Application</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {status === 'failed' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 dark:bg-red-900/20 dark:border-red-500/50">
              <h3 className="font-semibold text-red-800 dark:text-red-300 mb-2">Application Failed</h3>
              <p className="text-red-700 dark:text-red-400 text-sm mb-3">
                {error || 'The automated application process encountered an error.'}
              </p>
              <p className="text-red-600 dark:text-red-400 text-xs mb-3">
                You can still apply manually using the job application link.
              </p>
            </div>
          )}

          {status === 'not_found' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 dark:bg-red-900/20 dark:border-red-500/50">
              <h3 className="font-semibold text-red-800 dark:text-red-300 mb-2">Application Record Not Available</h3>
              <p className="text-red-700 dark:text-red-400 text-sm mb-3">
                {error || 'This application cannot be tracked. It may have been removed or not properly created.'}
              </p>
              <p className="text-red-600 dark:text-red-400 text-xs mb-3">
                Please try applying again or use the manual application option.
              </p>
            </div>
          )}

          <div className="flex space-x-3">
            {(status === 'processing' || status === 'pending') && (
              <button
                onClick={handleCancel}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
              >
                Cancel Application
              </button>
            )}

            {(status === 'failed' || status === 'not_found') && (
              <>
                <button
                  onClick={() => {
                    const searchQuery = encodeURIComponent(`${jobTitle} ${companyName} jobs apply`);
                    window.open(`https://www.google.com/search?q=${searchQuery}`, '_blank');
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center space-x-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Apply Manually</span>
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
                >
                  Close
                </button>
              </>
            )}

            {status === 'completed' && (
              <button
                onClick={onClose}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
