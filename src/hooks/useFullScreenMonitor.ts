import { useEffect, useState, useCallback } from 'react';

interface FullScreenMonitorOptions {
  onFullScreenExit?: () => void;
  onViolation?: (violationType: string) => void;
  autoRequestFullScreen?: boolean;
}

interface FullScreenMonitorState {
  isFullScreen: boolean;
  violations: number;
  requestFullScreen: () => Promise<void>;
  exitFullScreen: () => Promise<void>;
}

export const useFullScreenMonitor = (
  options: FullScreenMonitorOptions = {}
): FullScreenMonitorState => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [violations, setViolations] = useState(0);

  const requestFullScreen = useCallback(async () => {
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        await (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).msRequestFullscreen) {
        await (elem as any).msRequestFullscreen();
      }
    } catch (error) {
      console.error('Failed to enter full-screen mode:', error);
    }
  }, []);

  const exitFullScreen = useCallback(async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
    } catch (error) {
      console.error('Failed to exit full-screen mode:', error);
    }
  }, []);

  useEffect(() => {
    const handleFullScreenChange = () => {
      const isNowFullScreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).msFullscreenElement
      );

      setIsFullScreen(isNowFullScreen);

      if (!isNowFullScreen && isFullScreen) {
        setViolations((prev) => prev + 1);
        if (options.onFullScreenExit) {
          options.onFullScreenExit();
        }
        if (options.onViolation) {
          options.onViolation('fullscreen_exit');
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullScreenChange);
    document.addEventListener('msfullscreenchange', handleFullScreenChange);

    if (options.autoRequestFullScreen) {
      requestFullScreen();
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullScreenChange);
      document.removeEventListener('msfullscreenchange', handleFullScreenChange);
    };
  }, [isFullScreen, options, requestFullScreen]);

  return {
    isFullScreen,
    violations,
    requestFullScreen,
    exitFullScreen,
  };
};
