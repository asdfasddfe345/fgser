import React from 'react';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';

interface LiveResumePreviewControlsProps {
  scaleFactor: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFullScreen?: () => void;
  minZoom?: number;
  maxZoom?: number;
}

export const LiveResumePreviewControls: React.FC<LiveResumePreviewControlsProps> = ({
  scaleFactor,
  onZoomIn,
  onZoomOut,
  onReset,
  onFullScreen,
  minZoom = 0.3,
  maxZoom = 1.5
}) => {
  const currentZoom = Math.round(scaleFactor * 100);
  const canZoomIn = scaleFactor < maxZoom;
  const canZoomOut = scaleFactor > minZoom;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-dark-100 border-b border-gray-200 dark:border-dark-300">
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-1 bg-gray-100 dark:bg-dark-200 rounded-lg px-3 py-1.5">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Zoom:
          </span>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[48px] text-center">
            {currentZoom}%
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-1">
        <button
          onClick={onZoomOut}
          disabled={!canZoomOut}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 group"
          title="Zoom Out"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100" />
        </button>

        <button
          onClick={onReset}
          className="px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-200 transition-all duration-200 group"
          title="Reset Zoom (Fit to Screen)"
          aria-label="Reset zoom to fit"
        >
          <RotateCcw className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100" />
        </button>

        <button
          onClick={onZoomIn}
          disabled={!canZoomIn}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 group"
          title="Zoom In"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100" />
        </button>

        {onFullScreen && (
          <>
            <div className="w-px h-6 bg-gray-300 dark:bg-dark-400 mx-1" />
            <button
              onClick={onFullScreen}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-200 transition-all duration-200 group"
              title="Full Screen Preview"
              aria-label="View full screen"
            >
              <Maximize2 className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
