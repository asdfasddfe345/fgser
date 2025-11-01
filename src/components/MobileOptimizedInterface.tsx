import React, { useState } from 'react';
import { FileText, Download, ArrowLeft, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { exportToPDF, exportToWord } from '../utils/exportUtils';
import { ResumeData } from '../types/resume';

type UserType = 'fresher' | 'experienced';

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
  component: React.ReactNode;
  resumeData?: ResumeData;
  userType?: UserType;
}

interface MobileOptimizedInterfaceProps {
  sections: Section[];
  onStartNewResume: () => void;
}

export const MobileOptimizedInterface: React.FC<MobileOptimizedInterfaceProps> = ({ 
  sections, 
  onStartNewResume 
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'export'>('preview');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingWord, setIsExportingWord] = useState(false);
  const [exportStatus, setExportStatus] = useState<{
    type: 'pdf' | 'word' | null;
    status: 'success' | 'error' | null;
    message: string;
  }>({ type: null, status: null, message: '' });

  const resumeSection = sections.find(s => s.id === 'resume');
  const resumeData = resumeSection?.resumeData;
  const userType = resumeSection?.userType || 'experienced';

  const handleExportPDF = async () => {
    if (!resumeData || isExportingPDF || isExportingWord) return;
    
    setIsExportingPDF(true);
    setExportStatus({ type: null, status: null, message: '' });
    
    try {
      await exportToPDF(resumeData, userType);
      setExportStatus({
        type: 'pdf',
        status: 'success',
        message: 'PDF downloaded successfully!'
      });
      setTimeout(() => setExportStatus({ type: null, status: null, message: '' }), 3000);
    } catch (error) {
      setExportStatus({
        type: 'pdf',
        status: 'error',
        message: 'PDF export failed. Please try again.'
      });
      setTimeout(() => setExportStatus({ type: null, status: null, message: '' }), 5000);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportWord = async () => {
    if (!resumeData || isExportingWord || isExportingPDF) return;
    
    setIsExportingWord(true);
    setExportStatus({ type: null, status: null, message: '' });
    
    try {
      exportToWord(resumeData, userType);
      setExportStatus({
        type: 'word',
        status: 'success',
        message: 'Word document downloaded successfully!'
      });
      setTimeout(() => setExportStatus({ type: null, status: null, message: '' }), 3000);
    } catch (error) {
      setExportStatus({
        type: 'word',
        status: 'error',
        message: 'Word export failed. Please try again.'
      });
      setTimeout(() => setExportStatus({ type: null, status: null, message: '' }), 5000);
    } finally {
      setIsExportingWord(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-50 pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-dark-100 border-b border-gray-200 dark:border-dark-300 sticky top-0 z-40">
        <div className="px-4 py-4">
          <button
            onClick={() => {
              if (confirm('Start a new resume? Current progress will be cleared.')) {
                onStartNewResume();
              }
            }}
            className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            style={{ minHeight: '44px' }}
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-base font-medium">Create New Resume</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-t border-gray-200 dark:border-dark-300">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex-1 py-4 text-base font-medium transition-colors ${
              activeTab === 'preview'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}
            style={{ minHeight: '44px' }}
          >
            Preview
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-4 text-base font-medium transition-colors ${
              activeTab === 'export'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}
            style={{ minHeight: '44px' }}
          >
            Download
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        {activeTab === 'preview' ? (
          <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-sm border border-gray-200 dark:border-dark-300 p-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <FileText className="w-6 h-6 mr-2 text-blue-600 dark:text-blue-400" />
              Your Optimized Resume
            </h2>
            <div className="overflow-x-auto">
              {resumeSection?.component}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Success Message */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl p-6 border-2 border-green-200 dark:border-green-700">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                    Resume Ready!
                  </h3>
                  <p className="text-base text-gray-700 dark:text-gray-300">
                    Your resume has been optimized and is ready to download.
                  </p>
                </div>
              </div>
            </div>

            {/* Download Buttons */}
            <div className="space-y-4">
              <div className="bg-white dark:bg-dark-100 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-dark-300">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Download Resume
                </h3>
                
                <button
                  onClick={handleExportPDF}
                  disabled={isExportingPDF || isExportingWord}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg mb-4"
                  style={{ minHeight: '56px', fontSize: '18px' }}
                >
                  {isExportingPDF ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Generating PDF...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-6 h-6" />
                      <span>Download PDF</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleExportWord}
                  disabled={isExportingWord || isExportingPDF}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg"
                  style={{ minHeight: '56px', fontSize: '18px' }}
                >
                  {isExportingWord ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Generating Word...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-6 h-6" />
                      <span>Download Word</span>
                    </>
                  )}
                </button>
              </div>

              {/* Export Status */}
              {exportStatus.status && (
                <div className={`p-4 rounded-xl border-2 ${
                  exportStatus.status === 'success'
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
                }`}>
                  <div className="flex items-center space-x-3">
                    {exportStatus.status === 'success' ? (
                      <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" />
                    )}
                    <span className={`text-base font-medium ${
                      exportStatus.status === 'success'
                        ? 'text-green-800 dark:text-green-300'
                        : 'text-red-800 dark:text-red-300'
                    }`}>
                      {exportStatus.message}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
