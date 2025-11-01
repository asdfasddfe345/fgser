import React from 'react';
import { ZoomIn, ZoomOut, Maximize2, Minimize2 } from 'lucide-react';

interface ResumePreviewControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitWidth: () => void;
  onFullScreen: () => void;
  minZoom: number;
  maxZoom: number;
}

export const ResumePreviewControls: React.FC<ResumePreviewControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onFitWidth,
  onFullScreen,
  minZoom,
  maxZoom
}) => {
  return (
    <div className="flex items-center justify-between bg-gray-50 dark:bg-dark-200 px-4 py-3 border-b border-gray-200 dark:border-dark-300">
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Preview Controls
        </span>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={onZoomOut}
          disabled={zoom <= minZoom}
          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>

        <div className="px-3 py-1 bg-white dark:bg-dark-100 rounded-lg border border-gray-200 dark:border-dark-300 min-w-[60px] text-center">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {Math.round(zoom * 100)}%
          </span>
        </div>

        <button
          onClick={onZoomIn}
          disabled={zoom >= maxZoom}
          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>

        <div className="w-px h-6 bg-gray-300 dark:bg-dark-400 mx-1" />

        <button
          onClick={onFitWidth}
          className="px-3 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-300 transition-colors"
          title="Fit to Width"
        >
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Fit
          </span>
        </button>

        <button
          onClick={onFullScreen}
          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-300 transition-colors"
          title="Full Screen"
        >
          <Maximize2 className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
      </div>
    </div>
  );
};
