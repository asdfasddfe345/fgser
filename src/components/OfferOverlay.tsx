// src/components/OfferOverlay.tsx
import React from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface OfferOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onAction?: () => void;
  targetPath?: string;
  ctaLabel?: string;
}

export const OfferOverlay: React.FC<OfferOverlayProps> = ({
  isOpen,
  onClose,
  onAction,
  targetPath = '/mock-interview',
  ctaLabel,
}) => {
  const navigate = useNavigate();
  if (!isOpen) return null;

  const handleActionClick = () => {
    if (onAction) {
      onAction();
    } else if (targetPath) {
      navigate(targetPath);
    }
    onClose();
  };

  const onKeyActivate: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleActionClick();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in-down">
      <div className="relative bg-white dark:bg-dark-100 rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden border border-gray-200 dark:border-dark-300">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-gray-800/60 text-white hover:bg-gray-700 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cinematic Offer Banner */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleActionClick}
          onKeyDown={onKeyActivate}
          className="relative cursor-pointer group"
        >
          <img
            src="https://i.ibb.co/Nk95wJM/offer-banner.png"
            alt="Exclusive Interview Practice Offer"
            className="w-full h-64 object-cover brightness-95 transition-transform duration-500 group-hover:scale-105"
          />

          {/* Overlay Text */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col items-center justify-end pb-10 text-center text-white">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-3 drop-shadow-lg">
              🎯 Give Your Interview Before Your Real Interview
            </h2>
            <p className="text-sm sm:text-base max-w-lg text-gray-200 mb-6">
              Practice company-specific interviews with AI-driven feedback — boost your confidence and crack TCS, Infosys, Wipro, and more!
            </p>
            <button
              onClick={handleActionClick}
              className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-gray-900 font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all"
            >
              {ctaLabel ?? 'Start Mock Interview Now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
