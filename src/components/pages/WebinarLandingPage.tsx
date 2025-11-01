import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Calendar,
  Clock,
  Users,
  CheckCircle,
  Award,
  BookOpen,
  Target,
  TrendingUp,
  Star,
  Zap,
  ArrowRight,
  DollarSign,
  MapPin,
  GraduationCap,
  Linkedin,
  Loader2
} from 'lucide-react';
import { webinarService } from '../../services/webinarService';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import type { WebinarWithSpeakers, WebinarTestimonial, WebinarRegistration } from '../../types/webinar';

declare global {
  interface Window {
    Razorpay: any;
  }
}

type WebinarLandingPageProps = {
  onShowAuth?: () => void;
};

export const WebinarLandingPage: React.FC<WebinarLandingPageProps> = ({ onShowAuth }) => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [webinar, setWebinar] = useState<WebinarWithSpeakers | null>(null);
  const [testimonials, setTestimonials] = useState<WebinarTestimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [payableAmountPaise, setPayableAmountPaise] = useState<number>(0);
  const [registrationData, setRegistrationData] = useState({
    full_name: '',
    email: '',
    college_name: '',
    year_of_study: '',
    branch: '',
    phone_number: ''
  });
  const [existingRegistration, setExistingRegistration] = useState<WebinarRegistration | null>(null);

  useEffect(() => {
    loadWebinarData();
  }, [slug]);

  useEffect(() => {
    if (webinar) {
      const interval = setInterval(() => {
        calculateTimeLeft();
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [webinar]);

  useEffect(() => {
    if (webinar) {
      setPayableAmountPaise(webinar.discounted_price);
      setAppliedCoupon(null);
      setPromoCode('');
    }
  }, [webinar]);

  // Check if the current user has already registered for this webinar
  useEffect(() => {
    const checkRegistration = async () => {
      if (!user || !webinar) return;
      try {
        const reg = await webinarService.checkUserRegistration(user.id, webinar.id);
        setExistingRegistration(reg);
      } catch (e) {
        console.warn('Failed to check existing registration:', e);
      }
    };
    checkRegistration();
  }, [user, webinar]);

  const loadWebinarData = async () => {
    try {
      setLoading(true);
      if (!slug) return;

      const webinarData = await webinarService.getWebinarBySlug(slug);
      setWebinar(webinarData);

      const testimonialsData = await webinarService.getTestimonials(true);
      setTestimonials(testimonialsData.slice(0, 3));
    } catch (error) {
      console.error('Error loading webinar:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTimeLeft = () => {
    if (!webinar) return;

    const scheduledDate = new Date(webinar.scheduled_at);
    const now = new Date();
    const difference = scheduledDate.getTime() - now.getTime();

    if (difference > 0) {
      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60)
      });
    } else {
      setTimeLeft(null);
    }
  };

  const handleRegisterClick = () => {
    if (!isAuthenticated) {
      if (onShowAuth) {
        onShowAuth();
      } else {
        // Fallback: keep user on the same page if modal handler isn't provided
        console.warn('Auth modal handler not provided. Ensure App passes onShowAuth to WebinarLandingPage.');
      }
      return;
    }

    if (user) {
      setRegistrationData({
        ...registrationData,
        full_name: user.user_metadata?.name || '',
        email: user.email || ''
      });
    }

    setShowRegistrationModal(true);
  };

  const handleRegistrationSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!webinar || !user) {
    alert('Missing webinar or user information');
    return;
  }

  // CRITICAL FIX: Validate webinar price
  if (!webinar.discounted_price || webinar.discounted_price <= 0) {
    alert('Invalid webinar price. Please contact support.');
    console.error('Invalid webinar discounted_price:', webinar.discounted_price);
    return;
  }

  // ADDED: Validate all required data
  if (!registrationData.full_name || !registrationData.email) {
    alert('Please fill in all required fields (Full Name and Email)');
    return;
  }

  setIsProcessingPayment(true);

  try {
    // Step 1: Create registration
    console.log('Creating webinar registration...');
    const registration = await webinarService.createRegistration(
      webinar.id,
      user.id,
      registrationData
    );
    console.log('Registration created:', registration.id);

    // Dev/Test toggles
    const useFakePayment = import.meta.env.VITE_FAKE_PAYMENT === 'true';
    const isTestCheckout = import.meta.env.VITE_RAZORPAY_TEST_MODE === 'true';

    if (useFakePayment) {
      console.warn('[WebinarLandingPage] Using FAKE payment flow (VITE_FAKE_PAYMENT=true). No Razorpay call will be made.');
      const fakeTxnId = `FAKE_TXN_${Date.now()}`;

      await webinarService.updateRegistrationPayment(
        registration.id,
        fakeTxnId,
        'completed'
      );

      try {
        const scheduledDate = new Date(webinar.scheduled_at);
        await supabase.functions.invoke('send-webinar-confirmation-email', {
          body: {
            registrationId: registration.id,
            recipientEmail: registrationData.email,
            recipientName: registrationData.full_name,
            webinarTitle: webinar.title,
            webinarDate: scheduledDate.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }),
            webinarTime: scheduledDate.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            }),
            meetLink: webinar.meet_link,
            duration: webinar.duration_minutes
          }
        });
      } catch (e) {
        console.warn('[WebinarLandingPage] Email function failed in fake payment mode:', e);
      }

      setShowRegistrationModal(false);
      setIsProcessingPayment(false);
      alert('Registration successful (test mode). Check your email for the meeting link.');
      navigate('/webinars');
      return;
    }

    // Step 2: Prepare payment order request
    const orderRequestBody = {
      amount: payableAmountPaise,
      currency: 'INR',
      userId: user.id,
      couponCode: appliedCoupon || undefined,
      testMode: isTestCheckout,
      metadata: {
        type: 'webinar' as const,
        webinarId: webinar.id,
        registrationId: registration.id,
        webinarTitle: webinar.title
      }
    };

    console.log('Creating payment order with body:', orderRequestBody);

    // Step 3: Create payment order via Supabase function
    const { data: orderData, error: orderError } = await supabase.functions.invoke('create-order', {
      body: orderRequestBody
    });

    console.log('Order response:', { data: orderData, error: orderError });

    if (orderError) {
      console.error('Order error details:', orderError);
      // Try to extract details from the Edge Function response for better diagnosis
      let details = '';
      try {
        const anyErr: any = orderError as any;
        if (anyErr?.context?.json) {
          const json = await anyErr.context.json();
          details = json?.error || JSON.stringify(json);
        } else if (anyErr?.context?.text) {
          details = await anyErr.context.text();
        }
      } catch (e) {
        // ignore
      }
      const baseMsg = orderError.message || 'Unknown error occurred';
      const composed = details ? `${baseMsg} — ${details}` : baseMsg;
      throw new Error(`Payment order error: ${composed}`);
    }

    if (!orderData || !orderData.orderId) {
      console.error('Invalid order data received:', orderData);
      throw new Error('Failed to create payment order - no order ID received');
    }

    // Step 4: Get Razorpay key (prefer test key when test mode)
    const razorpayKey = isTestCheckout
      ? (import.meta.env.VITE_RAZORPAY_TEST_KEY_ID || import.meta.env.VITE_RAZORPAY_KEY_ID)
      : import.meta.env.VITE_RAZORPAY_KEY_ID;
    if (!razorpayKey) {
      throw new Error('Razorpay key not configured');
    }

    // Step 5: Initialize Razorpay payment
    const options = {
      key: razorpayKey,
      amount: orderData?.amount || payableAmountPaise,
      currency: 'INR',
      name: isTestCheckout ? 'PrimoBoost AI — TEST MODE' : 'PrimoBoost AI',
      description: isTestCheckout ? `${webinar.title} (Sandbox test payment)` : webinar.title,
      order_id: orderData.orderId,
      handler: async function (response: any) {
        try {
          console.log('Payment successful, verifying...', response);
          
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-payment', {
            body: {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              transactionId: orderData.transactionId,
              metadata: {
                type: 'webinar',
                webinarId: webinar.id,
                registrationId: registration.id
              }
            }
          });

          if (verifyError || !verifyData?.verified) {
            console.error('Payment verification failed:', verifyError);
            throw new Error('Payment verification failed');
          }

          // Send confirmation email
          const scheduledDate = new Date(webinar.scheduled_at);
          await supabase.functions.invoke('send-webinar-confirmation-email', {
            body: {
              registrationId: registration.id,
              recipientEmail: registrationData.email,
              recipientName: registrationData.full_name,
              webinarTitle: webinar.title,
              webinarDate: scheduledDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }),
              webinarTime: scheduledDate.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              }),
              meetLink: webinar.meet_link,
              duration: webinar.duration_minutes
            }
          });

          setShowRegistrationModal(false);
          setIsProcessingPayment(false);

          alert('Registration successful! Check your email for the meeting link.');
          navigate(`/webinar-details/${registration.id}`);
        } catch (error) {
          console.error('Error verifying payment:', error);
          setIsProcessingPayment(false);
          alert('Payment verification failed. Please contact support with your payment details.');
        }
      },
      prefill: {
        name: registrationData.full_name,
        email: registrationData.email,
      },
      notes: {
        testMode: isTestCheckout ? 'true' : 'false',
        webinarId: webinar.id,
        registrationId: registration.id,
      },
      theme: {
        color: isTestCheckout ? '#f59e0b' : '#667eea',
      },
      modal: {
        ondismiss: function() {
          console.log('Payment modal dismissed');
          setIsProcessingPayment(false);
        }
      }
    };

    console.log('Opening Razorpay with options:', { ...options, key: 'HIDDEN' });
    const razorpay = new window.Razorpay(options);
    razorpay.open();
  } catch (error: any) {
    console.error('Error creating registration:', error);
    setIsProcessingPayment(false);
    
    // IMPROVED ERROR HANDLING
    let errorMessage = 'Failed to create registration. Please try again.';
    
    if (error?.message) {
      const msg = String(error.message);
      if (msg.includes('Edge Function returned a non-2xx status code')) {
        errorMessage = 'Payment system error. Please check your internet connection and try again.';
      } else if (/row-level security/i.test(msg)) {
        errorMessage = 'Permission denied by security policy. Your session may have expired. Please sign in again and retry.';
        // Proactively prompt re-auth
        if (onShowAuth) {
          onShowAuth();
        }
      } else if (/not signed in/i.test(msg)) {
        errorMessage = 'You are not signed in. Please log in and try again.';
        if (onShowAuth) {
          onShowAuth();
        }
      } else {
        errorMessage = msg;
      }
    }
    
    alert(`Registration Error: ${errorMessage}`);
  }
};



  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!webinar) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800">
        <div className="text-center text-white">
          <h1 className="text-4xl font-bold mb-4">Webinar Not Found</h1>
          <button
            onClick={() => navigate('/webinars')}
            className="px-6 py-3 bg-white text-blue-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            View All Webinars
          </button>
        </div>
      </div>
    );
  }

  const discountPercentage = Math.round(
    ((webinar.original_price - webinar.discounted_price) / webinar.original_price) * 100
  );

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-block mb-4 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-semibold">
              {webinar.status === 'upcoming' ? 'Upcoming Webinar' : webinar.status.toUpperCase()}
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              {webinar.title}
            </h1>

            <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto">
              {webinar.short_description || webinar.description.substring(0, 150)}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <div className="flex items-center text-white">
                <Calendar className="w-5 h-5 mr-2" />
                {new Date(webinar.scheduled_at).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
              <div className="flex items-center text-white">
                <Clock className="w-5 h-5 mr-2" />
                {new Date(webinar.scheduled_at).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
              <div className="flex items-center text-white">
                <Users className="w-5 h-5 mr-2" />
                {webinar.max_attendees ? `${webinar.max_attendees - webinar.current_attendees} spots left` : 'Limited seats'}
              </div>
            </div>

            {timeLeft && (
              <motion.div
                className="bg-white/10 backdrop-blur-md rounded-2xl p-8 max-w-2xl mx-auto mb-8"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <h3 className="text-white text-xl font-semibold mb-4">Next Webinar Starts In:</h3>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: 'Days', value: timeLeft.days },
                    { label: 'Hours', value: timeLeft.hours },
                    { label: 'Minutes', value: timeLeft.minutes },
                    { label: 'Seconds', value: timeLeft.seconds }
                  ].map((item) => (
                    <div key={item.label} className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
                      <div className="text-4xl font-bold text-white">{item.value}</div>
                      <div className="text-white/80 text-sm">{item.label}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8">
              {existingRegistration && (
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-full text-lg font-semibold shadow">
                    <CheckCircle className="w-5 h-5" />
                    Enrolled
                  </div>
                </div>
              )}
              {!existingRegistration && (
              <div className="text-center">
                <div className="text-white/70 line-through text-2xl">
                  ₹{(webinar.original_price / 100).toFixed(0)}
                </div>
                <div className="text-5xl font-bold text-white">
                  ₹{(webinar.discounted_price / 100).toFixed(0)}
                </div>
                <div className="inline-block mt-2 px-3 py-1 bg-green-500 text-white rounded-full text-sm font-semibold">
                  Save {discountPercentage}%
                </div>
              </div>
              )}
            </div>

            {existingRegistration ? (
              <motion.button
                onClick={() => navigate(`/webinar-details/${existingRegistration.id}`)}
                className="group relative inline-flex items-center justify-center px-12 py-6 text-xl font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-full overflow-hidden shadow-2xl transition-all duration-300 hover:shadow-blue-500/50 hover:scale-105"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="relative z-10 flex items-center">
                  View Details
                  <ArrowRight className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-purple-700 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </motion.button>
            ) : (
              <motion.button
                onClick={handleRegisterClick}
                className="group relative inline-flex items-center justify-center px-12 py-6 text-xl font-bold text-white bg-gradient-to-r from-pink-500 to-red-500 rounded-full overflow-hidden shadow-2xl transition-all duration-300 hover:shadow-pink-500/50 hover:scale-105"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="relative z-10 flex items-center">
                  Join the Webinar Now
                  <ArrowRight className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-pink-600 to-red-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </motion.button>
            )}
          </motion.div>
        </div>
      </section>

      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              What You'll Learn
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Master the skills you need to ace the Accenture campus drive
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Target className="w-12 h-12 text-blue-500" />,
                title: 'Round 1: Behavioral & Cognitive',
                description: 'Master behavioral assessments and cognitive games with proven strategies and practice sessions.'
              },
              {
                icon: <BookOpen className="w-12 h-12 text-purple-500" />,
                title: 'Round 2: Technical Assessment',
                description: 'Learn the technical concepts, coding patterns, and problem-solving techniques required.'
              },
              {
                icon: <Award className="w-12 h-12 text-pink-500" />,
                title: 'Guaranteed Success Strategies',
                description: 'Get insider tips, expert guidance, and personalized doubt clearing sessions.'
              }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 rounded-2xl p-8 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
              >
                <div className="mb-4">{item.icon}</div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  {item.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">{item.description}</p>
              </motion.div>
            ))}
          </div>

          {webinar.learning_outcomes && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-12 text-white"
            >
              <h3 className="text-3xl font-bold mb-8 text-center">Key Learning Outcomes</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {webinar.learning_outcomes.outcomes.map((outcome, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <CheckCircle className="w-6 h-6 flex-shrink-0 mt-1" />
                    <span className="text-lg">{outcome}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {webinar.speakers && webinar.speakers.length > 0 && (
        <section className="py-20 bg-gray-50 dark:bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
                Meet Your Expert Instructors
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400">
                Learn from industry professionals with proven track records
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8">
              {webinar.speakers.map((speaker, index) => (
                <motion.div
                  key={speaker.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300"
                >
                  {speaker.photo_url ? (
                    <img
                      src={speaker.photo_url}
                      alt={speaker.name}
                      className="w-32 h-32 rounded-full mx-auto mb-6 object-cover"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-full mx-auto mb-6 bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                      <span className="text-4xl font-bold text-white">
                        {speaker.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">
                    {speaker.name}
                  </h3>
                  {speaker.title && (
                    <p className="text-blue-600 dark:text-blue-400 font-semibold text-center mb-4">
                      {speaker.title}
                    </p>
                  )}
                  {speaker.bio && (
                    <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
                      {speaker.bio}
                    </p>
                  )}
                  {speaker.linkedin_url && (
                    <a
                      href={speaker.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <Linkedin className="w-5 h-5 mr-2" />
                      Connect on LinkedIn
                    </a>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {testimonials.length > 0 && (
        <section className="py-20 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
                Success Stories
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400">
                Hear from students who cracked their dream placements
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8">
              {testimonials.map((testimonial, index) => (
                <motion.div
                  key={testimonial.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 rounded-2xl p-8"
                >
                  {testimonial.rating && (
                    <div className="flex mb-4">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                      ))}
                    </div>
                  )}
                  <p className="text-gray-700 dark:text-gray-300 mb-6 italic">
                    "{testimonial.testimonial_text}"
                  </p>
                  <div className="flex items-center">
                    {testimonial.student_photo_url ? (
                      <img
                        src={testimonial.student_photo_url}
                        alt={testimonial.student_name}
                        className="w-12 h-12 rounded-full mr-4 object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full mr-4 bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                        <span className="text-white font-bold">
                          {testimonial.student_name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white">
                        {testimonial.student_name}
                      </div>
                      {testimonial.college_name && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {testimonial.college_name}
                        </div>
                      )}
                      {testimonial.placement_company && (
                        <div className="text-sm text-blue-600 dark:text-blue-400 font-semibold">
                          Placed at {testimonial.placement_company}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-20 bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Ace Your Interview?
            </h2>
            <p className="text-xl text-white/90 mb-8">
              Limited spots available. Secure your seat now!
            </p>
            {existingRegistration ? (
              <div className="flex items-center justify-center gap-3">
                <motion.button
                  disabled
                  className="inline-flex items-center justify-center px-12 py-6 text-xl font-bold text-blue-600 bg-white/70 rounded-full cursor-not-allowed opacity-70 transition-all duration-300 shadow-2xl"
                  whileHover={{ scale: 1 }}
                >
                  Already Enrolled
                </motion.button>
                <motion.button
                  onClick={() => navigate(`/webinar-details/${existingRegistration.id}`)}
                  className="inline-flex items-center justify-center px-6 py-6 text-xl font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-full hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-2xl hover:scale-105"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  View Details
                </motion.button>
              </div>
            ) : (
              <motion.button
                onClick={handleRegisterClick}
                className="inline-flex items-center justify-center px-12 py-6 text-xl font-bold text-blue-600 bg-white rounded-full hover:bg-gray-100 transition-all duration-300 shadow-2xl hover:shadow-white/50 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Reserve My Spot Now
                <Zap className="ml-2 w-6 h-6" />
              </motion.button>
            )}
          </motion.div>
        </div>
      </section>

      {showRegistrationModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Complete Your Registration
            </h3>
            {(import.meta.env.VITE_RAZORPAY_TEST_MODE === 'true' || import.meta.env.VITE_FAKE_PAYMENT === 'true') && (
              <div className="mb-4 inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                TEST MODE
              </div>
            )}
            <form onSubmit={handleRegistrationSubmit} className="space-y-4">
              {/* Promo Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Promo Code (optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Enter code e.g. webinar"
                    className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const code = promoCode.trim().toLowerCase();
                      if (!webinar) return;
                      if (!code) return;
                      if (code === 'primo') {
                        const discounted = Math.max(100, Math.floor(webinar.discounted_price * 0.01)); // 99% off
                        setAppliedCoupon('primo');
                        setPayableAmountPaise(discounted);
                      } else {
                        alert('Invalid promo code');
                        setAppliedCoupon(null);
                        setPayableAmountPaise(webinar.discounted_price);
                      }
                    }}
                    className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Apply
                  </button>
                </div>
                {appliedCoupon === 'primo' && (
                  <p className="mt-2 text-sm text-green-600 dark:text-green-400">PRIMO applied — 99% OFF</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={registrationData.full_name}
                  onChange={(e) => setRegistrationData({ ...registrationData, full_name: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {/* Summary */}
              {webinar && (
                <div className="mt-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40 text-sm text-gray-700 dark:text-gray-200">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>₹{(webinar.discounted_price / 100).toFixed(0)}</span>
                  </div>
                  {appliedCoupon === 'primo' && (
                    <div className="flex justify-between text-green-600 dark:text-green-400">
                      <span>PRIMO (−99%)</span>
                      <span>−₹{((webinar.discounted_price - payableAmountPaise) / 100).toFixed(0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold mt-1">
                    <span>Total</span>
                    <span>₹{(payableAmountPaise / 100).toFixed(0)}</span>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={registrationData.email}
                  onChange={(e) => setRegistrationData({ ...registrationData, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  College Name
                </label>
                <input
                  type="text"
                  value={registrationData.college_name}
                  onChange={(e) => setRegistrationData({ ...registrationData, college_name: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Year of Study
                </label>
                <select
                  value={registrationData.year_of_study}
                  onChange={(e) => setRegistrationData({ ...registrationData, year_of_study: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select year</option>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                  <option value="Final Year">Final Year</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Branch
                </label>
                <input
                  type="text"
                  value={registrationData.branch}
                  onChange={(e) => setRegistrationData({ ...registrationData, branch: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Computer Science"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={registrationData.phone_number}
                  onChange={(e) => setRegistrationData({ ...registrationData, phone_number: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRegistrationModal(false)}
                  disabled={isProcessingPayment}
                  className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingPayment}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Proceed to Payment'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
