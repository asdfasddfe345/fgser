import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  ExternalLink,
  Sparkles,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Target,
  Info,
} from 'lucide-react';
import { JobListing } from '../../types/jobs';

interface ApplicationMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobListing;
  onManualApply: () => void;
  onAIOptimizedApply: () => void;
  onScoreCheck: () => void;
}

type OptionKey = 'optimize' | 'score' | 'direct';

type TooltipState = {
  key: OptionKey;
  x: number;
  y: number;
};

interface ActionDefinition {
  title: string;
  subtitle: string;
  description: string;
  highlights: string[];
  badge?: string;
  badgeClass?: string;
  gradient: string;
  icon: React.ReactNode;
  ctaLabel: string;
  onAction: () => void;
  emphasis?: 'primary' | 'info' | 'danger';
}

export const ApplicationMethodModal: React.FC<ApplicationMethodModalProps> = ({
  isOpen,
  onClose,
  job,
  onManualApply,
  onAIOptimizedApply,
  onScoreCheck,
}) => {
  const [active, setActive] = useState<OptionKey>('optimize');
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    const update = () => {
      if (typeof window !== 'undefined') {
        setIsSmallScreen(window.innerWidth < 768); // Tailwind md breakpoint
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const actions: Record<OptionKey, ActionDefinition> = useMemo(
    () => ({
      optimize: {
        title: 'Optimize Resume with AI',
        subtitle: 'Boost your shortlist chances',
        description:
          '',
        highlights: [
          `ATS-ready formatting tuned for ${job.domain} roles`,
          `Keyword alignment with the ${job.role_title} job description`,
          'Instant access to optimized PDF and DOCX downloads',
        ],
        badge: 'Recommended',
        badgeClass:
          'bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/40 dark:to-pink-900/40 text-purple-700 dark:text-purple-300',
        gradient: 'from-purple-600 to-pink-600',
        icon: (
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 rounded-xl text-white">
            <Sparkles className="w-6 h-6" />
          </div>
        ),
        ctaLabel: 'Start Optimization',
        onAction: onAIOptimizedApply,
        emphasis: 'primary',
      },
      score: {
        title: 'Score Against This Job',
        subtitle: 'See ATS compatibility first',
        description:
          "Already have a resume ready? Benchmark it in seconds. You'll see ATS score, keyword coverage, and the exact gaps to fix before applying.",
        highlights: [
          'Detailed ATS score with keyword match percentage',
          'Spots missing skills, tools, and depth of experience',
          'Best diagnostic step before investing effort in optimization',
        ],
        badge: 'Best Insight',
        badgeClass: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
        gradient: 'from-blue-500 to-cyan-500',
        icon: (
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-3 rounded-xl text-white">
            <Target className="w-6 h-6" />
          </div>
        ),
        ctaLabel: 'Check ATS Score',
        onAction: onScoreCheck,
        emphasis: 'info',
      },
      direct: {
        title: 'Apply Directly (Risky)',
        subtitle: 'Skip prep and go straight to the portal',
        description:
          "This will take you to the company application site without tailoring. Use only if you're confident your resume already beats ATS filters.",
        highlights: [
          "High rejection risk when keywords don't match",
          'No feedback on missing skills or accomplishments',
          "Often a wasted application if your resume is not tuned",
        ],
        badge: 'Use with caution',
        badgeClass: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
        gradient: 'from-red-500 to-orange-500',
        icon: (
          <div className="bg-red-500/90 p-3 rounded-xl text-white">
            <ExternalLink className="w-6 h-6" />
          </div>
        ),
        ctaLabel: 'Continue to Company Site',
        onAction: onManualApply,
        emphasis: 'danger',
      },
    }),
    [job, onAIOptimizedApply, onManualApply, onScoreCheck]
  );

  useEffect(() => {
    if (!isOpen) {
      setTooltip(null);
    }
  }, [isOpen]);

  const anchorTooltip = (key: OptionKey, target: HTMLElement | null) => {
    if (isSmallScreen) return; // Disable floating tooltip on small screens
    if (typeof window === 'undefined' || !target) return;
    const rect = target.getBoundingClientRect();
    const tooltipWidth = 280;
    const margin = 16;
    const x = Math.min(
      Math.max(rect.left + rect.width / 2, tooltipWidth / 2 + margin),
      window.innerWidth - tooltipWidth / 2 - margin
    );
    const y = Math.max(rect.top - margin * 1.5, margin);
    setTooltip({ key, x, y });
  };

  const clearTooltip = () => setTooltip(null);

  const handleActionSwitch = (targetKey: OptionKey) => {
    setActive(targetKey);
    if (typeof document !== 'undefined') {
      const targetButton = document.querySelector<HTMLButtonElement>(
        `[data-option="${targetKey}"]`
      );
      if (targetButton) {
        targetButton.focus({ preventScroll: true });
        if (!isSmallScreen) anchorTooltip(targetKey, targetButton);
        return;
      }
    }
    clearTooltip();
  };

  if (!isOpen) return null;

  const renderTooltipContent = (key: OptionKey) => {
    const copyMap: Record<OptionKey, { title: string; body: string; iconClass: string; borderClass: string }> = {
      optimize: {
        title: 'Why optimize first?',
        body: 'Launch the AI rewrite tuned to this role. We add metrics, keywords, and formatting that keeps your resume in the recruiter short-list.',
        iconClass: 'text-purple-500 dark:text-purple-300',
        borderClass: 'border-purple-200 dark:border-purple-700 text-gray-700 dark:text-gray-200',
      },
      score: {
        title: "Need proof first?",
        body: 'Upload your resume for an instant ATS score, keyword coverage, and the gaps to fix before you apply.',
        iconClass: 'text-blue-500 dark:text-blue-300',
        borderClass: 'border-blue-200 dark:border-blue-700 text-gray-700 dark:text-gray-200',
      },
      direct: {
        title: 'Think twice before skipping prep',
        body: 'Blind applications get filtered out fast. Run the ATS check or let AI optimize first so the recruiter actually sees you.',
        iconClass: 'text-red-500 dark:text-red-300',
        borderClass: 'border-red-200 dark:border-red-700 text-red-700 dark:text-red-300',
      },
    };

    const data = copyMap[key];
    return (
      <div className="w-64 sm:w-72">
        <div className={`relative bg-white dark:bg-dark-100 border rounded-xl shadow-xl p-4 text-sm ${data.borderClass}`}>
          <div className="flex items-center gap-2 mb-2">
            <Info className={`w-4 h-4 ${data.iconClass}`} />
            <span className="font-semibold">{data.title}</span>
          </div>
          <p>{data.body}</p>
        </div>
      </div>
    );
  };

  const renderDetailHero = (key: OptionKey) => {
    const action = actions[key];
    const wrapperClass =
      action.emphasis === 'danger'
        ? 'border-red-200 dark:border-red-700 bg-red-50/70 dark:bg-red-900/10'
        : action.emphasis === 'info'
          ? 'border-blue-200 dark:border-blue-700 bg-blue-50/70 dark:bg-blue-900/10'
          : 'border-purple-200 dark:border-purple-700 bg-purple-50/70 dark:bg-purple-900/10';

    return (
      <div className={`rounded-2xl border p-6 transition-all duration-300 ${wrapperClass}`}>
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              {action.icon}
              <div>
                {action.badge && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block mb-1 ${action.badgeClass}`}>
                    {action.badge}
                  </span>
                )}
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {action.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{action.subtitle}</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">{action.description}</p>
            {isSmallScreen && key === 'direct' && (
              <div className="mb-4">
                {renderTooltipContent('direct')}
              </div>
            )}
            <ul className="space-y-2">
              {action.highlights.map((point, index) => (
                <li key={index} className="flex items-start text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                  {key === 'direct' ? (
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mr-2 mt-0.5 flex-shrink-0" />
                  ) : (
                    <CheckCircle
                      className={`w-4 h-4 mr-2 mt-0.5 flex-shrink-0 ${
                        key === 'score'
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-purple-600 dark:text-purple-400'
                      }`}
                    />
                  )}
                  {point}
                </li>
              ))}
            </ul>

            {key === 'direct' && (
              <div className="mt-6 rounded-xl border border-red-200 dark:border-red-800 bg-white/80 p-4 dark:bg-red-900/20">
                <p className="text-sm font-semibold text-red-700 dark:text-red-200">
                  Prefer a safer path?
                </p>
                <p className="text-xs text-red-600 dark:text-red-300 mb-3">
                  Use our tools first to see exactly what the ATS expects before risking this application.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:from-blue-600 hover:to-cyan-600 focus:outline-none focus:ring-2 focus:ring-blue-400 sm:w-auto"
                    onClick={() => handleActionSwitch('score')}
                  >
                    Check ATS Score First
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-400 sm:w-auto"
                    onClick={() => handleActionSwitch('optimize')}
                  >
                    Let AI Optimize For Me
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="md:w-48 flex-shrink-0">
            <button
              onClick={action.onAction}
              className={`w-full font-semibold py-3 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl ${
                key === 'direct'
                  ? 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white'
                  : key === 'score'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
              }`}
            >
              {key === 'optimize' && <Sparkles className="w-5 h-5" />}
              {key === 'score' && <Target className="w-5 h-5" />}
              {key === 'direct' && <ExternalLink className="w-5 h-5" />}
              <span>{action.ctaLabel}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {!isSmallScreen && tooltip && (
        <div
          className="fixed z-[70] pointer-events-none"
          style={{ top: tooltip.y, left: tooltip.x, transform: 'translateX(-50%)' }}
        >
          {renderTooltipContent(tooltip.key)}
        </div>
      )}

      <div
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto dark:bg-dark-100 animate-fadeIn">
          <div className="relative bg-gradient-to-r from-blue-50 to-purple-50 dark:from-dark-200 dark:to-dark-300 p-6 border-b border-gray-200 dark:border-dark-400">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-full hover:bg-white/50 dark:hover:bg-dark-100/50"
              aria-label="Close application methods modal"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="pr-12">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Choose How You Want to Apply
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Decide how you want to approach <strong>{job.role_title}</strong> at{' '}
                <strong>{job.company_name}</strong>. Benchmark or optimize first for the best reply rates.
              </p>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {(Object.keys(actions) as OptionKey[]).map((key) => {
                const action = actions[key];
                const isActive = active === key;

                return (
                  <div key={key} className="relative">
                    <button
                      data-option={key}
                      type="button"
                      onMouseEnter={(event) => anchorTooltip(key, event.currentTarget)}
                      onMouseLeave={clearTooltip}
                      onFocus={(event) => anchorTooltip(key, event.currentTarget)}
                      onBlur={clearTooltip}
                      onClick={(event) => {
                        // Mobile: select and reveal details inline under this card
                        if (isSmallScreen) {
                          setActive(key);
                          return;
                        }
                        // Desktop: select and position tooltip
                        setActive(key);
                        anchorTooltip(key, event.currentTarget);
                      }}
                    className={`w-full rounded-xl border-2 px-4 py-4 text-left transition-all duration-300 flex items-center gap-3 backdrop-blur-sm bg-white/80 dark:bg-dark-200/80 ${
                      isActive
                        ? 'border-transparent shadow-lg shadow-purple-500/20 dark:shadow-purple-500/5 ring-2 ring-offset-2 ring-purple-400 dark:ring-purple-500'
                        : 'border-gray-200 dark:border-dark-400 hover:border-blue-400 hover:shadow-md'
                      }`}
                    >
                      {action.icon}
                      <div>
                        {action.badge && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block mb-1 ${action.badgeClass}`}>
                            {action.badge}
                          </span>
                        )}
                        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{action.title}</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{action.subtitle}</p>
                      </div>
                    </button>
                    {isSmallScreen && isActive && (
                      <div className="mt-3">
                        {renderDetailHero(key)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop/tablet: show the detail hero below the options */}
            {!isSmallScreen && renderDetailHero(active)}

            <div className="mt-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                <strong>Tip:</strong> Candidates who benchmark their resume first and then optimize with AI see the highest shortlist rates. Use the insight flow before jumping straight to the company portal.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
