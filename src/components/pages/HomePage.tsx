// src/components/pages/HomePage.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  PlusCircle,
  Target,
  ArrowRight,
  Sparkles,
  CheckCircle,
  TrendingUp,
  Star,
  Users,
  Zap,
  Award,
  Crown,
  Instagram,
  Linkedin,
  MessageCircle,
  Check,
  Plus,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Globe
} from 'lucide-react';
// Assuming these imports exist in the user's project
// import { paymentService } from '../../services/paymentService';

// Mocking the imported functions and types for a self-contained example.
// In a real application, these would be external.
const paymentService = {
  // A mock service for payment-related functions
};

// Define the type for a feature object for clarity and type-safety
interface Feature {
  id: string;
  title: string;
  description: string;
  icon: JSX.Element;
  requiresAuth: boolean;
  highlight?: boolean; // Added highlight property
  gradient: string; // Added gradient property
}

interface HomePageProps {
  // REMOVED: onPageChange: (page: string) => void;
  isAuthenticated: boolean;
  onShowAuth: () => void;
  onShowSubscriptionPlans: (featureId?: string, expandAddons?: boolean) => void;
  onShowSubscriptionPlansDirectly: () => void; // NEW PROP
  userSubscription: any; // New prop for user's subscription status
}

import { useNavigate } from 'react-router-dom'; // Import useNavigate
import { useAuth } from '../../contexts/AuthContext'; // ADDED: Import useAuth
import { authService } from '../../services/authService'; // ADDED: Import authService

// Inline WhatsApp brand icon (lucide-react has no brand icons)
const WhatsappIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 32 32"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M19.11 17.37c-.26-.13-1.52-.75-1.75-.84-.23-.09-.4-.13-.57.13s-.66.84-.81 1.01c-.15.17-.3.19-.56.06-.26-.13-1.08-.4-2.06-1.27-.76-.67-1.27-1.49-1.42-1.75-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.45.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.06-.13-.57-1.37-.78-1.88-.2-.48-.4-.41-.57-.42l-.49-.01c-.17 0-.45.06-.69.32-.23.26-.91.89-.91 2.17s.94 2.52 1.07 2.7c.13.17 1.85 2.83 4.49 3.97.63.27 1.12.43 1.5.55.63.2 1.21.17 1.66.1.51-.08 1.52-.62 1.73-1.21.21-.59.21-1.09.15-1.21-.06-.12-.24-.19-.5-.32z" />
    <path d="M26.72 5.28A13.5 13.5 0 0 0 4.47 21.06L3 29l8.11-1.42A13.49 13.49 0 1 0 26.72 5.28zM16.5 27A10.47 10.47 0 0 1 8.3 24.3l-.29-.18-4.91.85.84-4.8-.19-.31A10.5 10.5 0 1 1 16.5 27z" />
  </svg>
);

export const HomePage: React.FC<HomePageProps> = ({
  // REMOVED: onPageChange,
  isAuthenticated,
  onShowAuth,
  onShowSubscriptionPlans,
  onShowSubscriptionPlansDirectly, // NEW PROP
  userSubscription // Destructure new prop
}) => {
  const [showOptimizationDropdown, setShowOptimizationDropdown] = React.useState(false);
  const [showPlanDetails, setShowPlanDetails] = React.useState(false); // New state for the dropdown
  const navigate = useNavigate(); // Initialize useNavigate
  const { user } = useAuth(); // ADDED: Access user from AuthContext
  const [globalResumesCreated, setGlobalResumesCreated] = useState<number>(50000);

  // Fetch global resumes created count on component mount
  useEffect(() => {
    const fetchGlobalCount = async () => {
      try {
        const count = await authService.getGlobalResumesCreatedCount();
        setGlobalResumesCreated(count);
      } catch (error) {
        console.error('HomePage: Error fetching global resumes count:', error);
        // Keep default value of 50000 if fetch fails
      }
    };

    fetchGlobalCount();
  }, []);

  // Helper function to get plan icon based on icon string
  const getPlanIcon = (iconType: string) => {
    switch (iconType) {
      case 'crown': return <Crown className="w-6 h-6" />;
      case 'zap': return <Zap className="w-6 h-6" />;
      case 'rocket': return <Award className="w-6 h-6" />;
      default: return <Sparkles className="w-6 h-6" />;
    }
  };

  // Helper function to check if a feature is available based on subscription
 const isFeatureAvailable = (featureId: string) => {
  // Free features - always available for authenticated users
  if (featureId === 'linkedin-generator' || featureId === 'mock-interview' || featureId === 'portfolio-builder') {
    return true;
  }

  if (!isAuthenticated) return false;
  if (!userSubscription) return false;

  switch (featureId) {
    case 'optimizer':
      return userSubscription.optimizationsTotal > userSubscription.optimizationsUsed;
    case 'score-checker':
      return userSubscription.scoreChecksTotal > userSubscription.scoreChecksUsed;
    case 'guided-builder':
      return userSubscription.guidedBuildsTotal > userSubscription.guidedBuildsUsed;
    default:
      return false;
  }
};




 const handleFeatureClick = (feature: Feature) => {
  console.log('Feature clicked:', feature.id);

  if (!isAuthenticated && feature.requiresAuth) {
    onShowAuth();
    return;
  }

  // Free features - skip subscription check
  const freeFeatures = ['linkedin-generator', 'mock-interview', 'portfolio-builder'];
  const isFreeFeature = freeFeatures.includes(feature.id);

  if (isAuthenticated && feature.requiresAuth && !isFreeFeature && !isFeatureAvailable(feature.id)) {
    onShowSubscriptionPlans(feature.id);
    return;
  }

  if (isAuthenticated || !feature.requiresAuth) {
    navigate(feature.id);
  }
};




  const features: Feature[] = [
    {
      id: 'optimizer',
      title: 'JD-Based Optimizer',
      description: 'Upload your resume and a job description to get a perfectly tailored resume.',
      icon: <Target className="w-6 h-6" />,
      requiresAuth: false,
      highlight: true, // Highlight this feature
      gradient: 'from-blue-50 to-purple-50', // Added gradient
    },
    {
      id: 'score-checker',
      title: 'Resume Score Check',
      description: 'Get an instant ATS score with detailed analysis and improvement suggestions.',
      icon: <TrendingUp className="w-6 h-6" />,
      requiresAuth: false,
      gradient: 'from-green-50 to-emerald-50', // Added gradient
    },
    {
      id: 'guided-builder',
      title: 'Guided Resume Builder',
      description: 'Create a professional resume from scratch with our step-by-step AI-powered builder.',
      icon: <PlusCircle className="w-6 h-6" />,
      requiresAuth: false,
      gradient: 'from-orange-50 to-red-50', // Added gradient
    },
   
    {
      id: 'linkedin-generator',
      // MODIFIED LINE 100: Changed title
      title: 'Outreach Message Generator',
      // MODIFIED LINE 101: Changed description
      description: 'Generate personalized messages for networking, referrals, and cold outreach.',
      icon: <MessageCircle className="w-6 h-6" />,
      requiresAuth: true,
      gradient: 'from-yellow-50 to-amber-50', // Added gradient
    },
    {
      id: 'mock-interview',
      title: 'AI Mock Interview (Beta)',
      description: 'Practice interviews with AI-powered feedback in a realistic meet-style environment.',
      icon: <Sparkles className="w-6 h-6" />,
      requiresAuth: true,
      highlight: true,
      gradient: 'from-indigo-50 to-purple-50',
    }

  ];

  const stats = [
    {
      number: globalResumesCreated.toLocaleString(),
      label: 'Resumes Created', 
      icon: <FileText className="w-5 h-5" />, 
      microcopy: 'Trusted by thousands of job seekers worldwide' 
    },
    { number: '95%', label: 'Success Rate', icon: <TrendingUp className="w-5 h-5" />, microcopy: 'Achieved by our AI-driven approach' },
    { number: '4.9/5', label: 'User Rating', icon: <Star className="w-5 h-5" />, microcopy: 'From satisfied professionals worldwide' },
    { number: '24/7', label: 'AI Support', icon: <Sparkles className="w-5 h-5" />, microcopy: 'Instant assistance whenever you need it' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 font-inter dark:from-dark-50 dark:via-dark-100 dark:to-dark-200 transition-colors duration-300">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Visuals */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-purple-600/5 dark:from-neon-cyan-500/10 dark:to-neon-purple-500/10"></div>
        <div className="absolute top-1/4 left-1/4 w-48 h-48 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob dark:bg-neon-purple-500"></div>
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000 dark:bg-neon-blue-500"></div>
        <div className="absolute top-1/2 left-1/2 w-56 h-56 bg-green-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000 dark:bg-neon-cyan-500"></div>

        <div className="relative container-responsive py-12 sm:py-16 lg:py-20">
          <div className="text-center max-w-4xl mx-auto">
            {/* Logo and Brand */}
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shadow-xl mr-4">
                <img
                  src="https://res.cloudinary.com/dlkovvlud/image/upload/w_1000,c_fill,ar_1:1,g_auto,r_max,bo_5px_solid_red,b_rgb:262c35/v1751536902/a-modern-logo-design-featuring-primoboos_XhhkS8E_Q5iOwxbAXB4CqQ_HnpCsJn4S1yrhb826jmMDw_nmycqj.jpg"
                  alt="PrimoBoost AI Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-left">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100">
                  PrimoBoost AI
                </h1>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Resume Intelligence</p>
              </div>
            </div>

            {/* Main Headline */}
            <h2 className="text-3xl sm:text-4xl lg:text-6xl font-bold text-gray-900 dark:text-gray-100 mb-6 leading-tight">
              Your Dream Job Starts with a
              <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent dark:from-neon-cyan-400 dark:to-neon-blue-400">
                Perfect Resume
              </span>
            </h2>

            {/* Subheadline Readability */}
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed max-w-3xl mx-auto">
              Choose your path to success. Whether you're building from scratch, <br /> optimizing for specific jobs, or just want to check your current resume score - we've got you covered.
            </p>

            {/* Hero CTA Button */}
            <button
              onClick={() => navigate('/optimizer')}
              className="btn-primary px-8 py-4 rounded-2xl text-lg font-bold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 mb-12"
            >
              <Sparkles className="w-6 h-6 mr-2" />
              Start Building My Resume
             
            </button>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-12">
              {stats.map((stat, index) => (
                <div
                  key={index}
                  className="card-hover bg-white/80 backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-lg transition-all duration-300 border border-white/50 dark:bg-dark-100/80 dark:border-dark-300/50 dark:hover:shadow-neon-cyan/20"
                >
                  <div className="flex items-center justify-center mb-3">
                    <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-2 sm:p-3 rounded-full dark:from-neon-cyan-500 dark:to-neon-blue-500 dark:shadow-neon-cyan">
                      {stat.icon}
                    </div>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                    {stat.number}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
                    {stat.label}
                  </div>
                  {stat.microcopy && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stat.microcopy}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Features Section - Now with a consolidated frame */}
      <div className="container-responsive py-12 sm:py-16 bg-primary-50 dark:bg-dark-100">
        <div className="mb-12">
          <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4 text-center">
            Choose Your Resume Journey
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  {features.map((feature, index) => {
    let remainingCount: number | null = null;
    if (isAuthenticated && userSubscription) {
      switch (feature.id) {
        case 'optimizer':
          remainingCount = userSubscription.optimizationsTotal - userSubscription.optimizationsUsed;
          break;
        case 'score-checker':
          remainingCount = userSubscription.scoreChecksTotal - userSubscription.scoreChecksUsed;
          break;
        case 'guided-builder':
          remainingCount = null; // Guided builder doesn't use credits
          break;
        case 'linkedin-generator':
          remainingCount = null; // Free - no payment required
          break;
        case 'mock-interview':
          remainingCount = null; // Free - no payment required
          break;
        case 'portfolio-builder':
          remainingCount = null; // Free - no payment required
          break;
        default:
          remainingCount = null;
      }
    }

    return (
      <motion.button
        key={feature.id}
        onClick={() => handleFeatureClick(feature)}
        className={`relative card-hover p-6 flex flex-col items-start sm:flex-row sm:items-center justify-between transition-all duration-300 bg-gradient-to-br ${feature.gradient} border border-secondary-100 shadow-lg hover:shadow-xl group rounded-2xl dark:from-dark-100 dark:to-dark-200 dark:border-dark-300 dark:hover:shadow-neon-cyan/20 ${feature.requiresAuth && !isAuthenticated ? 'opacity-70 cursor-not-allowed' : ''} ${feature.highlight ? 'ring-2 ring-green-500 ring-offset-4 overflow-visible' : ''}`}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45, delay: index * 0.05 }}
        whileHover={{ y: -4, scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        {feature.highlight && (
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
            <span className="inline-flex items-center bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
              <Check className="w-3 h-3 mr-1" /> Recommended
            </span>
          </div>
        )}
        <div className="flex items-center space-x-4">
          <div className="bg-primary-100 rounded-xl p-3 group-hover:bg-gradient-to-r group-hover:from-neon-cyan-500 group-hover:to-neon-blue-500 group-hover:text-white transition-all duration-300 shadow-sm flex-shrink-0 group-hover:scale-110 dark:bg-dark-200 dark:group-hover:shadow-neon-cyan">
            {React.cloneElement(feature.icon, { className: "w-8 h-8" })}
          </div>
          <div>
            <span className="text-lg font-bold text-secondary-900 dark:text-gray-100">{feature.title}</span>
            <p className="text-sm text-secondary-700 dark:text-gray-300">{feature.description}</p>
            {isAuthenticated && userSubscription && remainingCount !== null && remainingCount > 0 && (
              <p className="text-xs font-medium text-green-600 dark:text-neon-cyan-400 mt-1">
                {remainingCount} remaining
              </p>
            )}
          </div>
        </div>
        <ArrowRight className={`w-6 h-6 text-secondary-400 group-hover:text-neon-cyan-400 group-hover:translate-x-1 transition-transform duration-300 flex-shrink-0 dark:text-gray-500 dark:group-hover:text-neon-cyan-400 ${feature.requiresAuth && !isAuthenticated ? 'opacity-50' : ''}`} />
      </motion.button>
    );
  })}
</div>

      </div>

      {/* Companies Marquee Section (with illustrated background) */}
      <section className="relative isolate overflow-hidden py-12 sm:py-14 bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50 dark:from-dark-50 dark:via-dark-100 dark:to-dark-200 border-y border-gray-200/70 dark:border-dark-300">
        {/* Decorative background orbs */}
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-gradient-to-br from-cyan-300/40 to-blue-300/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-br from-purple-300/40 to-indigo-300/30 blur-3xl" />
        {/* Local styles for marquee animation */}
        <style>{`
          @keyframes marqueeX { from { transform: translateX(0); } to { transform: translateX(-50%); } }
          .marquee-track { animation: marqueeX 28s linear infinite; }
          .marquee-track.fast { animation-duration: 22s; }
          .marquee:hover .marquee-track { animation-play-state: paused; }
        `}</style>
        <div className="container-responsive">
          <div className="text-center mb-6">
            <h4 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">Top Companies Our Users Apply To</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Trusted by candidates interviewing at leading global brands</p>
          </div>

          {(() => {
            const companies = [
              'Google','Microsoft','Amazon','Meta','Netflix','Apple','NVIDIA','OpenAI','Uber','Airbnb',
              'Stripe','Coinbase','Salesforce','Adobe','Oracle','IBM','Intel','Samsung','Dell','HP',
              'Accenture','Infosys','TCS','Wipro','Capgemini','Zoho','Flipkart','Paytm','Swiggy','Zomato'
            ];
            const chip = (name: string, i: number) => (
              <span
                key={name + i}
                className="mx-2 my-2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 text-gray-700 shadow-sm border border-gray-200 backdrop-blur dark:bg-dark-200/70 dark:text-gray-200 dark:border-dark-300"
              >
                <Briefcase className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-sm font-medium">{name}</span>
              </span>
            );
            return (
              <div className="space-y-4">
                {/* Row 1 */}
                <div className="marquee overflow-hidden">
                  <div className="marquee-track whitespace-nowrap flex items-center">
                    {[...companies, ...companies].map((c, i) => chip(c, i))}
                  </div>
                </div>
                {/* Row 2 (faster) */}
                <div className="marquee overflow-hidden">
                  <div className="marquee-track fast whitespace-nowrap flex items-center">
                    {[...companies.slice(10), ...companies.slice(10)].map((c, i) => chip(c, i))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Explore Jobs CTA under marquee */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.45 }}
            className="mt-8"
          >
            <div className="max-w-4xl mx-auto rounded-2xl p-5 sm:p-6 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-4 dark:from-dark-200 dark:to-dark-100 dark:border-dark-300">
              <div className="text-center sm:text-left">
                <h5 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Explore Job Openings</h5>
                <p className="text-sm text-gray-600 dark:text-gray-400">Find roles at top companies and apply with your optimized resume.</p>
              </div>
              <button
                onClick={() => navigate('/jobs')}
                className="inline-flex items-center px-5 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 shadow hover:shadow-lg hover:from-blue-700 hover:to-cyan-700 transition-all"
              >
                <Briefcase className="w-4 h-4 mr-2" />
                Explore Jobs
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Minimalist Plans Section */}
      {isAuthenticated && (
        <div className="bg-white py-16 dark:bg-dark-100">
          <div className="container-responsive">
            {/* New Dropdown for User's Plan Status */}
            <div className="max-w-2xl mx-auto mb-10">
              <div className="relative inline-block text-left w-full">
                <button
                  onClick={() => setShowPlanDetails(!showPlanDetails)}
                  className="w-full bg-slate-100 text-slate-800 font-semibold py-3 px-6 rounded-xl flex items-center justify-between shadow-sm hover:bg-slate-200 transition-colors dark:bg-dark-200 dark:text-gray-100 dark:hover:bg-dark-300"
                >
                  <span className="flex items-center">
                    <Sparkles className="w-5 h-5 text-indigo-500 mr-2 dark:text-neon-cyan-400" />
                    {userSubscription ? (
                      <span>
                        Optimizations Left:{' '}
                        <span className="font-bold">
                          {userSubscription.optimizationsTotal - userSubscription.optimizationsUsed}
                        </span>
                      </span>
                    ) : (
                      <span>No Active Plan. Upgrade to use all features.</span>
                    )}
                  </span>
                  {showPlanDetails ? <ChevronUp className="w-5 h-5 ml-2" /> : <ChevronDown className="w-5 h-5 ml-2" />}
                </button>
                {showPlanDetails && (
                  <div className="absolute z-10 mt-2 w-full origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-dark-100 dark:ring-dark-300 dark:shadow-dark-xl">
                    <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                      {userSubscription ? (
                        <>
                          <div className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                            <p className="font-semibold">{userSubscription.name} Plan</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Details for your current subscription.</p>
                          </div>
                          <hr className="my-1 border-gray-100 dark:border-dark-300" />
                          <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 space-y-1">
                            <div className="flex justify-between items-center">
                              <span>Optimizations:</span>
                              <span className="font-medium">{userSubscription.optimizationsTotal - userSubscription.optimizationsUsed} / {userSubscription.optimizationsTotal}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Score Checks:</span>
                              <span className="font-medium">{userSubscription.scoreChecksTotal - userSubscription.scoreChecksUsed} / {userSubscription.scoreChecksTotal}</span>
                            </div>
                            
                          </div>
                        </>
                      ) : (
                        <div className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                          You currently don't have an active subscription.
                        </div>
                      )}
                      <div className="p-4 border-t border-gray-100 dark:border-dark-300">
                        <button
                          onClick={() => onShowSubscriptionPlans(undefined, true)}
                          className="w-full btn-primary py-2"
                        >
                          {userSubscription ? 'Upgrade Plan' : 'Choose Your Plan'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            
            <div className="text-center mt-12">
              <button
                onClick={onShowSubscriptionPlansDirectly} // MODIFIED: Call the new direct function
                className="btn-secondary px-8 py-3"
              >
                View All Plans & Add-ons
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Additional Features Teaser - animated and responsive */}
      <div className="relative overflow-hidden text-white py-16 sm:py-20 px-4 sm:px-0 bg-gradient-to-br from-[#0f172a] via-[#25164a] to-[#0b2c60] dark:from-dark-50 dark:via-dark-100 dark:to-dark-200">
        {/* subtle animated gradient orbs */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl"
          animate={{ scale: [1, 1.1, 1], opacity: [0.35, 0.55, 0.35] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 9, repeat: Infinity }}
        />

        <div className="container-responsive">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto text-center"
          >
            <h3 className="text-2xl sm:text-3xl font-extrabold mb-3 bg-gradient-to-r from-pink-400 via-fuchsia-400 to-purple-400 bg-clip-text text-transparent">
              Powered by Advanced AI Technology
            </h3>
            <p className="text-base sm:text-lg text-blue-100/90 dark:text-gray-300">
              Our intelligent system understands ATS requirements, job market trends, and recruiter preferences to give you the competitive edge.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mt-10 sm:mt-12">
            {/* Card 1 */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              whileHover={{ y: -6, scale: 1.02 }}
              className="text-center rounded-2xl p-6 backdrop-blur-sm bg-white/5 border border-white/10 shadow-xl"
            >
              <div className="relative mx-auto mb-5">
                <div className="relative w-20 h-20 rounded-full mx-auto flex items-center justify-center bg-cyan-500/15">
                  <Zap className="w-8 h-8 text-yellow-300" />
                </div>
              </div>
              <h4 className="font-semibold mb-2 text-lg text-yellow-300">AI-Powered Analysis</h4>
              <p className="text-blue-100/90 dark:text-gray-300 leading-relaxed">Advanced algorithms analyze and optimize your resume</p>
            </motion.div>

            {/* Card 2 */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              whileHover={{ y: -6, scale: 1.02 }}
              className="text-center rounded-2xl p-6 backdrop-blur-sm bg-white/5 border border-white/10 shadow-xl"
            >
              <div className="relative mx-auto mb-5">
                <div className="relative w-20 h-20 rounded-full mx-auto flex items-center justify-center bg-indigo-500/15">
                  <Award className="w-8 h-8 text-green-300" />
                </div>
              </div>
              <h4 className="font-semibold mb-2 text-lg text-emerald-300">ATS Optimization</h4>
              <p className="text-blue-100/90 dark:text-gray-300 leading-relaxed">Ensure your resume passes all screening systems</p>
            </motion.div>

            {/* Card 3 */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              whileHover={{ y: -6, scale: 1.02 }}
              className="text-center rounded-2xl p-6 backdrop-blur-sm bg-white/5 border border-white/10 shadow-xl"
            >
              <div className="relative mx-auto mb-5">
                <div className="relative w-20 h-20 rounded-full mx-auto flex items-center justify-center bg-fuchsia-500/15">
                  <Users className="w-8 h-8 text-fuchsia-300" />
                </div>
              </div>
              <h4 className="font-semibold mb-2 text-lg text-fuchsia-300">Expert Approved</h4>
              <p className="text-blue-100/90 dark:text-gray-300 leading-relaxed">Formats trusted by recruiters worldwide</p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* CTA Section */}

      {/* Footer */}
      <footer className="mt-8 sm:mt-16 bg-white/70 dark:bg-dark-100/80 backdrop-blur border-t border-gray-200 dark:border-dark-300">
        {/* gradient accent line */}
        <div className="h-0.5 bg-gradient-to-r from-pink-500 via-cyan-400 to-blue-600 dark:from-neon-pink-500 dark:via-neon-cyan-400 dark:to-neon-blue-500" />
        <div className="container-responsive pt-6 pb-8 sm:py-8">
          <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl overflow-hidden shadow ring-1 ring-black/5">
                <img
                  src="https://res.cloudinary.com/dlkovvlud/image/upload/w_200,c_fill,ar_1:1,g_auto,r_max,b_rgb:262c35/v1751536902/a-modern-logo-design-featuring-primoboos_XhhkS8E_Q5iOwxbAXB4CqQ_HnpCsJn4S1yrhb826jmMDw_nmycqj.jpg"
                  alt="PrimoBoost AI"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">PrimoBoost AI</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Resume Intelligence</p>
              </div>
            </div>

            {/* Copyright */}
            <div className="text-sm text-gray-600 dark:text-gray-400 text-center md:text-left">
              © {new Date().getFullYear()} PrimoBoost AI. All rights reserved.
            </div>

            {/* Socials */}
            <div className="flex items-center gap-3">
              <a
                href="https://instagram.com/primoboostai"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 text-pink-600 bg-white/70 hover:bg-pink-50 hover:ring-2 hover:ring-pink-300 transition-all dark:border-dark-300 dark:text-pink-400 dark:bg-dark-200/60 dark:hover:bg-dark-200"
                aria-label="Instagram"
                title="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="https://linkedin.com/company/primoboost-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 text-blue-700 bg-white/70 hover:bg-blue-50 hover:ring-2 hover:ring-blue-300 transition-all dark:border-dark-300 dark:text-neon-cyan-400 dark:bg-dark-200/60 dark:hover:bg-dark-200"
                aria-label="LinkedIn"
                title="LinkedIn"
              >
                <Linkedin className="w-5 h-5" />
              </a>
              <a
                href="https://wa.me/0000000000"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 text-green-600 bg-white/70 hover:bg-green-50 hover:ring-2 hover:ring-green-300 transition-all dark:border-dark-300 dark:text-green-400 dark:bg-dark-200/60 dark:hover:bg-dark-200"
                aria-label="WhatsApp"
                title="WhatsApp"
              >
                <WhatsappIcon className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
