import { useEffect, useState, useCallback, useRef } from 'react';

interface TabSwitchDetectorOptions {
  onTabSwitch?: () => void;
  onWindowBlur?: () => void;
  onViolation?: (violationType: string, duration: number) => void;
}

interface TabSwitchDetectorState {
  isTabActive: boolean;
  isWindowFocused: boolean;
  tabSwitchCount: number;
  totalTimeAway: number;
  violations: Array<{
    type: string;
    timestamp: number;
    duration: number;
  }>;
}

export const useTabSwitchDetector = (
  options: TabSwitchDetectorOptions = {}
): TabSwitchDetectorState => {
  const [isTabActive, setIsTabActive] = useState(true);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [totalTimeAway, setTotalTimeAway] = useState(0);
  const [violations, setViolations] = useState<Array<{
    type: string;
    timestamp: number;
    duration: number;
  }>>([]);

  const awayStartTimeRef = useRef<number | null>(null);

  const handleVisibilityChange = useCallback(() => {
    const isHidden = document.hidden || document.visibilityState === 'hidden';
    setIsTabActive(!isHidden);

    if (isHidden) {
      awayStartTimeRef.current = Date.now();
      setTabSwitchCount((prev) => prev + 1);
      if (options.onTabSwitch) {
        options.onTabSwitch();
      }
    } else {
      if (awayStartTimeRef.current) {
        const duration = Math.floor((Date.now() - awayStartTimeRef.current) / 1000);
        setTotalTimeAway((prev) => prev + duration);

        const violation = {
          type: 'tab_switch',
          timestamp: awayStartTimeRef.current,
          duration,
        };

        setViolations((prev) => [...prev, violation]);

        if (options.onViolation) {
          options.onViolation('tab_switch', duration);
        }

        awayStartTimeRef.current = null;
      }
    }
  }, [options]);

  const handleWindowBlur = useCallback(() => {
    setIsWindowFocused(false);
    if (!awayStartTimeRef.current) {
      awayStartTimeRef.current = Date.now();
    }
    if (options.onWindowBlur) {
      options.onWindowBlur();
    }
  }, [options]);

  const handleWindowFocus = useCallback(() => {
    setIsWindowFocused(true);
    if (awayStartTimeRef.current) {
      const duration = Math.floor((Date.now() - awayStartTimeRef.current) / 1000);
      setTotalTimeAway((prev) => prev + duration);

      const violation = {
        type: 'window_blur',
        timestamp: awayStartTimeRef.current,
        duration,
      };

      setViolations((prev) => [...prev, violation]);

      if (options.onViolation) {
        options.onViolation('window_blur', duration);
      }

      awayStartTimeRef.current = null;
    }
  }, [options]);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);

      if (awayStartTimeRef.current) {
        const duration = Math.floor((Date.now() - awayStartTimeRef.current) / 1000);
        setTotalTimeAway((prev) => prev + duration);
      }
    };
  }, [handleVisibilityChange, handleWindowBlur, handleWindowFocus]);

  return {
    isTabActive,
    isWindowFocused,
    tabSwitchCount,
    totalTimeAway,
    violations,
  };
};
