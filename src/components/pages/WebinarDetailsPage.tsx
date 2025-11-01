import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Calendar,
  Clock,
  User,
  Mail,
  GraduationCap,
  Phone,
  CheckCircle,
  ExternalLink,
  Download,
  Bell,
  BellOff,
  Video,
  FileText,
  Megaphone,
  AlertCircle,
  Loader2,
  ArrowLeft
} from 'lucide-react';
import { webinarService } from '../../services/webinarService';
import { useAuth } from '../../contexts/AuthContext';
import type {
  WebinarRegistrationWithDetails,
  WebinarUpdateWithViewStatus
} from '../../types/webinar';
import { supabase } from '../../lib/supabaseClient';

export const WebinarDetailsPage: React.FC = () => {
  const { registrationId } = useParams<{ registrationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [registration, setRegistration] = useState<WebinarRegistrationWithDetails | null>(null);
  const [updates, setUpdates] = useState<WebinarUpdateWithViewStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    loadRegistrationData();
  }, [registrationId]);

  useEffect(() => {
    if (!registration?.webinar) return;

    // Calculate countdown
    const interval = setInterval(() => {
      calculateTimeLeft();
    }, 1000);

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`webinar_updates:${registration.webinar.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'webinar_updates',
          filter: `webinar_id=eq.${registration.webinar.id}`
        },
        () => {
          loadUpdates();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [registration]);

  const loadRegistrationData = async () => {
    try {
      setLoading(true);
      if (!registrationId || !user) return;

      const regData = await webinarService.getRegistrationById(registrationId);
      
      if (!regData) {
        alert('Registration not found');
        navigate('/webinars');
        return;
      }

      // Verify user owns this registration
      if (regData.user_id !== user.id) {
        alert('Unauthorized access');
        navigate('/webinars');
        return;
      }

      setRegistration(regData);
      
      if (regData.webinar) {
        await loadUpdates();
        await loadUnreadCount(regData.webinar.id);
      }
    } catch (error) {
      console.error('Error loading registration:', error);
      alert('Failed to load webinar details');
    } finally {
      setLoading(false);
    }
  };

  const loadUpdates = async () => {
    if (!registration?.webinar || !user) return;

    try {
      const updatesData = await webinarService.getWebinarUpdates(
        registration.webinar.id,
        user.id
      );
      setUpdates(updatesData);
    } catch (error) {
      console.error('Error loading updates:', error);
    }
  };

  const loadUnreadCount = async (webinarId: string) => {
    if (!user) return;

    try {
      const count = await webinarService.getUnreadUpdatesCount(user.id, webinarId);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const calculateTimeLeft = () => {
    if (!registration?.webinar) return;

    const scheduledDate = new Date(registration.webinar.scheduled_at);
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

  const handleMarkAsRead = async (updateId: string) => {
    if (!user) return;

    await webinarService.markUpdateAsViewed(updateId, user.id);
    setUpdates(prev =>
      prev.map(u => (u.id === updateId ? { ...u, is_viewed: true } : u))
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleMarkAllAsRead = async () => {
    if (!registration?.webinar || !user) return;

    await webinarService.markAllUpdatesAsViewed(registration.webinar.id, user.id);
    setUpdates(prev => prev.map(u => ({ ...u, is_viewed: true })));
    setUnreadCount(0);
  };

  const getUpdateIcon = (type: string) => {
    switch (type) {
      case 'meet_link':
        return <Video className="w-5 h-5" />;
      case 'material':
        return <FileText className="w-5 h-5" />;
      case 'announcement':
        return <Megaphone className="w-5 h-5" />;
      case 'schedule_change':
        return <AlertCircle className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getUpdateColor = (type: string) => {
    switch (type) {
      case 'meet_link':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'material':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'announcement':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'schedule_change':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const isWebinarLive = () => {
    if (!registration?.webinar) return false;
    const now = new Date();
    const scheduledDate = new Date(registration.webinar.scheduled_at);
    const endDate = new Date(scheduledDate.getTime() + registration.webinar.duration_minutes * 60000);
    return now >= scheduledDate && now <= endDate;
  };

  const isWebinarPast = () => {
    if (!registration?.webinar) return false;
    const now = new Date();
    const scheduledDate = new Date(registration.webinar.scheduled_at);
    const endDate = new Date(scheduledDate.getTime() + registration.webinar.duration_minutes * 60000);
    return now > endDate;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!registration || !registration.webinar) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Webinar not found</p>
          <button
            onClick={() => navigate('/webinars')}
            className="text-blue-600 hover:text-blue-700"
          >
            Back to Webinars
          </button>
        </div>
      </div>
    );
  }

  const { webinar } = registration;
  const shouldShowMeetLink = Boolean(
    webinar?.meet_link &&
    registration.payment_status === 'completed' &&
    registration.registration_status === 'confirmed'
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/webinars')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Webinars
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Webinar Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-900 rounded-xl shadow-lg overflow-hidden"
            >
              {webinar.thumbnail_url && (
                <img
                  src={webinar.thumbnail_url}
                  alt={webinar.title}
                  className="w-full h-48 object-cover"
                />
              )}
              <div className="p-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  {webinar.title}
                </h1>

                {/* Status Badge */}
                <div className="mb-4">
                  {isWebinarLive() && (
                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-full font-medium">
                      <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                      Live Now
                    </span>
                  )}
                  {isWebinarPast() && (
                    <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full font-medium">
                      Completed
                    </span>
                  )}
                  {!isWebinarLive() && !isWebinarPast() && (
                    <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full font-medium">
                      Upcoming
                    </span>
                  )}
                </div>

                {/* Countdown Timer */}
                {timeLeft && (
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    {[
                      { label: 'Days', value: timeLeft.days },
                      { label: 'Hours', value: timeLeft.hours },
                      { label: 'Minutes', value: timeLeft.minutes },
                      { label: 'Seconds', value: timeLeft.seconds }
                    ].map((item) => (
                      <div key={item.label} className="text-center">
                        <div className="bg-blue-100 rounded-lg p-3 mb-2">
                          <span className="text-2xl font-bold text-blue-600">
                            {String(item.value).padStart(2, '0')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{item.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Join / Meet Link Button */}
                {(shouldShowMeetLink || isWebinarLive() || isWebinarPast()) && (
                  <a
                    href={webinar.meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg transition-all mb-4"
                  >
                    <Video className="w-5 h-5" />
                    {isWebinarLive() ? 'Join Webinar Now' : isWebinarPast() ? 'View Recording' : 'Open Meet Link'}
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}

                {/* Webinar Info */}
                <div className="space-y-3 text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-3 text-gray-800 dark:text-gray-200">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <span>
                      {(() => {
                        const d = new Date(webinar.scheduled_at);
                        const now = new Date();
                        const isToday =
                          d.getFullYear() === now.getFullYear() &&
                          d.getMonth() === now.getMonth() &&
                          d.getDate() === now.getDate();
                        const dateText = d.toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        });
                        return isToday ? `Today, ${dateText.split(', ').slice(1).join(', ')}` : dateText;
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-800 dark:text-gray-200">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <span>
                      {(() => {
                        const d = new Date(webinar.scheduled_at);
                        const now = new Date();
                        const isToday =
                          d.getFullYear() === now.getFullYear() &&
                          d.getMonth() === now.getMonth() &&
                          d.getDate() === now.getDate();
                        const timeText = d.toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Asia/Kolkata'
                        });
                        return isToday ? `Today · ${timeText}` : timeText;
                      })()}{' '}
                      ({webinar.duration_minutes} minutes)
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Updates Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Updates</h2>
                  {unreadCount > 0 && (
                    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                      {unreadCount} New
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
                  >
                    <BellOff className="w-4 h-4" />
                    Mark all as read
                  </button>
                )}
              </div>

              {updates.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No updates yet. Check back later for announcements!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {updates.map((update) => (
                    <motion.div
                      key={update.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`border-2 rounded-lg p-4 ${getUpdateColor(update.update_type)} ${
                        !update.is_viewed ? 'ring-2 ring-blue-400' : ''
                      }`}
                      onClick={() => !update.is_viewed && handleMarkAsRead(update.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1">{getUpdateIcon(update.update_type)}</div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <h3 className="font-semibold text-lg">{update.title}</h3>
                            {!update.is_viewed && (
                              <span className="ml-2 w-2 h-2 bg-blue-600 rounded-full" />
                            )}
                          </div>
                          {update.description && (
                            <p className="text-sm mt-2 whitespace-pre-wrap">
                              {update.description}
                            </p>
                          )}
                          {update.link_url && (
                            <a
                              href={update.link_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 mt-3 text-sm font-medium hover:underline"
                            >
                              Open Link
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          <p className="text-xs mt-3 opacity-70">
                            {new Date(update.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Registration Details Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Registration Details
                </h2>
              </div>

              <div className="space-y-4 text-gray-800 dark:text-gray-200">
                <div>
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 mb-1">
                    <User className="w-4 h-4" />
                    <span className="text-sm font-medium">Name</span>
                  </div>
                  <p className="text-gray-900 dark:text-gray-100 ml-6">{registration.full_name}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 mb-1">
                    <Mail className="w-4 h-4" />
                    <span className="text-sm font-medium">Email</span>
                  </div>
                  <p className="text-gray-900 dark:text-gray-100 ml-6">{registration.email}</p>
                </div>

                {registration.college_name && (
                  <div>
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 mb-1">
                      <GraduationCap className="w-4 h-4" />
                      <span className="text-sm font-medium">College</span>
                    </div>
                    <p className="text-gray-900 dark:text-gray-100 ml-6">{registration.college_name}</p>
                  </div>
                )}

                {registration.phone_number && (
                  <div>
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 mb-1">
                      <Phone className="w-4 h-4" />
                      <span className="text-sm font-medium">Phone</span>
                    </div>
                    <p className="text-gray-900 dark:text-gray-100 ml-6">{registration.phone_number}</p>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Payment Status</span>
                    <span className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full text-xs font-medium">
                      {registration.payment_status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Registration Status</span>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-xs font-medium">
                      {registration.registration_status}
                    </span>
                  </div>
                </div>

                {shouldShowMeetLink && (
                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 mb-2">
                      <Video className="w-4 h-4" />
                      <span className="text-sm font-medium">Meeting Link</span>
                    </div>
                    <div className="flex items-center gap-2 ml-6">
                      <a
                        href={webinar.meet_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 break-all"
                      >
                        {webinar.meet_link}
                      </a>
                      <button
                        onClick={() => navigator.clipboard?.writeText(webinar.meet_link)}
                        className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded"
                        title="Copy link"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title="Receipt download coming soon"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  Download Receipt (Coming soon)
                </button>
              </div>
            </motion.div>

            {/* Quick Info Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-6"
            >
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Need Help?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                If you have any questions about this webinar, check the updates above or contact our support team.
              </p>
              <button className="w-full px-4 py-2 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg transition-colors text-sm font-medium">
                Contact Support
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};
