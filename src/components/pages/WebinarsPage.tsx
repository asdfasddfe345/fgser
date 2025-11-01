import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Calendar,
  Clock,
  Users,
  Search,
  Filter,
  TrendingUp,
  Video,
  CheckCircle,
  ArrowRight,
  Star
} from 'lucide-react';
import { webinarService } from '../../services/webinarService';
import { useAuth } from '../../contexts/AuthContext';
import type { Webinar, WebinarFilters } from '../../types/webinar';

type WebinarsPageProps = {
  onShowAuth?: () => void;
};

export const WebinarsPage: React.FC<WebinarsPageProps> = ({ onShowAuth }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'my-webinars'>('all');

  useEffect(() => {
    loadWebinars();
    if (user) {
      loadMyRegistrations();
    }
  }, [user]);

  const loadWebinars = async () => {
    try {
      setLoading(true);

      const filters: WebinarFilters = {};
      if (selectedStatus !== 'all') {
        filters.status = selectedStatus as any;
      }
      if (showFeaturedOnly) {
        filters.is_featured = true;
      }
      if (searchTerm) {
        filters.search = searchTerm;
      }

      const data = await webinarService.getAllWebinars(filters);
      setWebinars(data);
    } catch (error) {
      console.error('Error loading webinars:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMyRegistrations = async () => {
    if (!user) return;

    try {
      const registrations = await webinarService.getUserRegistrations(user.id);
      setMyRegistrations(registrations);
    } catch (error) {
      console.error('Error loading registrations:', error);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadWebinars();
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchTerm, selectedStatus, showFeaturedOnly]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'live':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'completed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const calculateDaysUntil = (scheduledAt: string) => {
    const now = new Date();
    const scheduled = new Date(scheduledAt);
    const diff = scheduled.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  const WebinarCard: React.FC<{ webinar: Webinar; registrationId?: string }> = ({ webinar, registrationId }) => {
    const discountPercentage = Math.round(
      ((webinar.original_price - webinar.discounted_price) / webinar.original_price) * 100
    );
    const daysUntil = calculateDaysUntil(webinar.scheduled_at);
    const isRegistered = myRegistrations.some(reg => reg.webinar_id === webinar.id) || Boolean(registrationId);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
      >
        <div className="relative h-48 bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 flex items-center justify-center">
          {webinar.thumbnail_url ? (
            <img
              src={webinar.thumbnail_url}
              alt={webinar.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <Video className="w-16 h-16 text-white opacity-50" />
          )}
          <div className="absolute top-4 right-4">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(webinar.status)}`}>
              {webinar.status.toUpperCase()}
            </span>
          </div>
          {webinar.is_featured && (
            <div className="absolute top-4 left-4">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-400 text-yellow-900 flex items-center">
                <Star className="w-3 h-3 mr-1 fill-current" />
                Featured
              </span>
            </div>
          )}
          {isRegistered && (
            <div className="absolute bottom-4 left-4">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500 text-white flex items-center">
                <CheckCircle className="w-3 h-3 mr-1" />
                Registered
              </span>
            </div>
          )}
        </div>

        <div className="p-6">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 line-clamp-2">
            {webinar.title}
          </h3>

          <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
            {webinar.short_description || webinar.description}
          </p>

          <div className="space-y-2 mb-4">
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <Calendar className="w-4 h-4 mr-2" />
              {new Date(webinar.scheduled_at).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </div>
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <Clock className="w-4 h-4 mr-2" />
              {new Date(webinar.scheduled_at).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              })}
              {' · '}
              {webinar.duration_minutes} mins
            </div>
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <Users className="w-4 h-4 mr-2" />
              {webinar.max_attendees
                ? `${webinar.max_attendees - webinar.current_attendees} spots left`
                : `${webinar.current_attendees} registered`}
            </div>
          </div>

          {webinar.status === 'upcoming' && (
            <div className="mb-4 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                {daysUntil <= 0 ? 'Starts today!' : daysUntil === 1 ? 'Starts tomorrow!' : `Starts in ${daysUntil} days`}
              </p>
            </div>
          )}

          <div className={`flex items-center justify-between mb-4 ${registrationId ? 'hidden' : ''}`}>
            <div>
              <span className="text-gray-500 dark:text-gray-400 line-through text-sm">
                ₹{(webinar.original_price / 100).toFixed(0)}
              </span>
              <span className="text-3xl font-bold text-gray-900 dark:text-white ml-2">
                ₹{(webinar.discounted_price / 100).toFixed(0)}
              </span>
              {discountPercentage > 0 && (
                <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 rounded text-xs font-semibold">
                  {discountPercentage}% OFF
                </span>
              )}
            </div>
          </div>
          {registrationId && (
            <div className="flex items-center justify-between mb-4">
              <span className="px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded text-sm font-semibold">Enrolled</span>
            </div>
          )}

          <button
            onClick={() => {
              if (registrationId) {
                navigate(`/webinar-details/${registrationId}`);
              } else {
                navigate(`/webinar/${webinar.slug}`);
              }
            }}
            className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 flex items-center justify-center group"
          >
            {isRegistered ? 'View Details' : 'Register Now'}
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </motion.div>
    );
  };

  const MyWebinarsTab = () => {
    if (!user) {
      return (
        <div className="text-center py-20">
          <p className="text-gray-600 dark:text-gray-400 mb-4">Please log in to view your registered webinars.</p>
          <button
            onClick={() => {
              if (onShowAuth) {
                onShowAuth();
              } else {
                console.warn('Auth modal handler not provided. Ensure App passes onShowAuth to WebinarsPage.');
              }
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Log In
          </button>
        </div>
      );
    }

    if (myRegistrations.length === 0) {
      return (
        <div className="text-center py-20">
          <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">You haven't registered for any webinars yet.</p>
          <button
            onClick={() => setActiveTab('all')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Browse Webinars
          </button>
        </div>
      );
    }

    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {myRegistrations.map((registration) => (
          <div key={registration.id} className="relative">
            {registration.webinar && (
              <WebinarCard webinar={registration.webinar} registrationId={registration.id} />
            )}
            {registration.payment_status === 'completed' && registration.meet_link_sent && (
              <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-700 dark:text-green-300 mb-2 font-medium">
                  ✓ Registration Confirmed
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  Meeting link has been sent to your email
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20">
      <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              Upcoming Webinars
            </h1>
            <p className="text-xl text-white/90 max-w-3xl mx-auto">
              Join expert-led sessions to master your skills and ace your career goals
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex space-x-4">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                  activeTab === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                All Webinars
              </button>
              {user && (
                <button
                  onClick={() => setActiveTab('my-webinars')}
                  className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                    activeTab === 'my-webinars'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  My Webinars
                  {myRegistrations.length > 0 && (
                    <span className="ml-2 px-2 py-1 bg-blue-500 text-white text-xs rounded-full">
                      {myRegistrations.length}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          {activeTab === 'all' && (
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search webinars..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="upcoming">Upcoming</option>
                <option value="live">Live</option>
                <option value="completed">Completed</option>
              </select>

              <button
                onClick={() => setShowFeaturedOnly(!showFeaturedOnly)}
                className={`px-6 py-3 rounded-lg font-semibold transition-colors flex items-center ${
                  showFeaturedOnly
                    ? 'bg-yellow-400 text-yellow-900'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700'
                }`}
              >
                <Star className={`w-5 h-5 mr-2 ${showFeaturedOnly ? 'fill-current' : ''}`} />
                Featured
              </button>
            </div>
          )}
        </div>

        {activeTab === 'all' ? (
          loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
            </div>
          ) : webinars.length === 0 ? (
            <div className="text-center py-20">
              <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No webinars found matching your criteria.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {webinars.map((webinar) => (
                <WebinarCard key={webinar.id} webinar={webinar} />
              ))}
            </div>
          )
        ) : (
          <MyWebinarsTab />
        )}
      </div>
    </div>
  );
};
