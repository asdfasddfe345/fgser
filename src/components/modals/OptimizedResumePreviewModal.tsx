// src/components/modals/OptimizedResumePreviewModal.tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FileText,
  Download,
  ExternalLink,
  Target,
  TrendingUp,
  CheckCircle,
  Sparkles
} from 'lucide-react';
import { JobListing, OptimizedResume } from '../../types/jobs';
import { ResumePreview } from '../ResumePreview';

interface OptimizedResumePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobListing | null;
  optimizedResume: OptimizedResume | null;
  onConfirm: () => void;
}

export const OptimizedResumePreviewModal: React.FC<OptimizedResumePreviewModalProps> = ({
  isOpen,
  onClose,
  job,
  optimizedResume,
  onConfirm
}) => {
  if (!isOpen || !job || !optimizedResume) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleDownloadResume = () => {
    if (optimizedResume.pdf_url) {
      window.open(optimizedResume.pdf_url, '_blank');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={handleBackdropClick}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden dark:bg-dark-100"
        >
          {/* Header */}
          <div className="relative bg-gradient-to-r from-blue-50 to-purple-50 p-6 border-b border-gray-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-white/50"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center pr-16">
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Resume Optimized for {job.role_title}
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Your resume has been tailored for <strong>{job.company_name}</strong>
              </p>
              
              {/* Optimization Score */}
              <div className="flex items-center justify-center space-x-4 mt-4">
                <div className="bg-white rounded-lg px-4 py-2 shadow-sm dark:bg-dark-100">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Optimization Score: 
                      <span className="text-green-600 font-bold ml-1">
                        {optimizedResume.optimization_score}/100
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-col lg:flex-row h-full max-h-[70vh]">
            {/* Resume Preview */}
            <div className="flex-1 p-6 overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                Optimized Resume Preview
              </h3>
              <div className="border border-gray-200 rounded-xl overflow-hidden dark:border-dark-300">
                <ResumePreview 
                  resumeData={optimizedResume.resume_content} 
                  userType="experienced"
                />
              </div>
            </div>

            {/* Job Details Sidebar */}
            <div className="w-full lg:w-80 bg-gray-50 p-6 border-l border-gray-200 dark:bg-dark-200 dark:border-dark-300">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                <Target className="w-5 h-5 mr-2 text-purple-600" />
                Job Details
              </h3>
              
              <div className="space-y-4 mb-6">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">{job.role_title}</h4>
                  <p className="text-gray-600 dark:text-gray-300">{job.company_name}</p>
                </div>
                
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  <p className="mb-2"><strong>Domain:</strong> {job.domain}</p>
                  <p className="mb-2"><strong>Location:</strong> {job.location_type}</p>
                  <p className="mb-2"><strong>Experience:</strong> {job.experience_required}</p>
                  <p><strong>Qualification:</strong> {job.qualification}</p>
                </div>

                <div className="bg-blue-50 rounded-lg p-3 dark:bg-blue-900/20">
                  <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
                    {job.short_description}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {optimizedResume.pdf_url && (
                  <button
                    onClick={handleDownloadResume}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-semibold transition-colors flex items-center justify-center space-x-2"
                  >
                    <Download className="w-5 h-5" />
                    <span>Download Resume</span>
                  </button>
                )}

                <button
                  onClick={onConfirm}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-3 px-4 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
                >
                  <ExternalLink className="w-5 h-5" />
                  <span>Proceed to Apply</span>
                </button>

                <button
                  onClick={onClose}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 px-4 rounded-xl font-semibold transition-colors dark:bg-dark-300 dark:hover:bg-dark-400 dark:text-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};