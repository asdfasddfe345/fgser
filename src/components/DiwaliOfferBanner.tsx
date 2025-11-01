// src/components/DiwaliOfferBanner.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { X, Sparkles, Gift } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DiwaliOfferBannerProps {
  onCTAClick: () => void;
}

export const DiwaliOfferBanner: React.FC<DiwaliOfferBannerProps> = ({ onCTAClick }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // ✅ End at end-of-day, TODAY
  const offerEndTs = useMemo(() => {
    const end = new Date();
    // end.setDate(end.getDate() + 3); // <-- REMOVED as requested
    end.setHours(23, 59, 59, 0); // Sets to end of the current day
    return end.getTime();
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, offerEndTs - now);

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });

      if (diff === 0) setIsVisible(false); // auto-hide on expiry
    };

    tick(); // initial
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [offerEndTs]);

  // A close button to hide the banner
  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 text-white shadow-2xl"
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
              <div className="hidden sm:flex items-center space-x-2 flex-shrink-0">
                <Gift className="w-5 h-5 sm:w-6 sm:h-6 animate-bounce" />
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3">
                  <h3 className="text-base sm:text-lg md:text-xl font-bold truncate">🪔 Diwali Special!</h3>
                  <span className="text-xl sm:text-2xl md:text-3xl font-extrabold bg-white text-orange-600 px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg shadow-lg inline-block">
                    90% OFF
                  </span>
                </div>
                <p className="text-xs sm:text-sm md:text-base mt-1">
                  Code: <span className="font-bold bg-white text-orange-600 px-1.5 py-0.5 sm:px-2 rounded">DIWALI</span>
                </p>
              </div>
            </div>

            {/* Countdown Timer - Hidden on mobile, visible on md+ */}
            <div className="hidden md:flex items-center space-x-2 flex-shrink-0">
              <div className="text-center bg-white/20 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg backdrop-blur-sm">
                <div className="text-lg sm:text-xl font-bold">{timeLeft.days}</div>
                <div className="text-xs">Days</div>
              </div>
              <div className="text-center bg-white/20 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg backdrop-blur-sm">
                <div className="text-lg sm:text-xl font-bold">{timeLeft.hours}</div>
                <div className="text-xs">Hours</div>
              </div>
              <div className="text-center bg-white/20 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg backdrop-blur-sm">
                <div className="text-lg sm:text-xl font-bold">{timeLeft.minutes}</div>
                <div className="text-xs">Mins</div>
              </div>
              {/* Seconds are usually too noisy, but uncomment if needed */}
              <div className="text-center bg-white/20 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg backdrop-blur-sm">
                <div className="text-lg sm:text-xl font-bold">{timeLeft.seconds}</div>
                <div className="text-xs">Secs</div>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={onCTAClick}
              className="bg-white text-orange-600 font-bold px-3 py-1.5 sm:px-4 sm:py-2 md:px-6 rounded-lg hover:bg-orange-50 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 text-sm sm:text-base flex-shrink-0"
            >
              Claim Now
            </button>

            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-2 right-2 text-white/70 hover:text-white transition-colors"
              aria-label="Close banner"
            >
              <X className="w-5 h-5" />
            </button>

          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DiwaliOfferBanner;
