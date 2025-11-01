import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { ResumePreview } from './ResumePreview';
import { ResumeData, UserType } from '../types/resume';
import { ExportOptions } from '../types/export';

interface FullScreenPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  resumeData: ResumeData;
  userType: UserType;
  exportOptions?: ExportOptions;
}

export const FullScreenPreviewModal: React.FC<FullScreenPreviewModalProps> = ({
  isOpen,
  onClose,
  resumeData,
  userType,
  exportOptions
}) => {
  const [zoom, setZoom] = useState(1.8);

  if (!isOpen) return null;

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.1, 2));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 0.98));
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
   <div
  className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm"
  onClick={handleBackdropClick}
>

      <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between bg-gray-50 dark:bg-dark-200 px-6 py-4 border-b border-gray-200 dark:border-dark-300">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Full Screen Preview
          </h2>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={handleZoomOut}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-300 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>

              <div className="px-3 py-1 bg-white dark:bg-dark-100 rounded-lg border border-gray-200 dark:border-dark-300 min-w-[70px] text-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {Math.round(zoom * 100)}%
                </span>
              </div>

              <button
                onClick={handleZoomIn}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-300 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-300 transition-colors"
            >
              <X className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-100 dark:bg-dark-50 p-8">
          <div
            className="mx-auto transition-transform duration-200"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
          >
            <ResumePreview
              resumeData={resumeData}
              userType={userType}
              exportOptions={exportOptions}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
