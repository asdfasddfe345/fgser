import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, Mail, TrendingUp, Users, CheckCircle, XCircle, Loader2, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface NotificationStats {
  total_subscribers: number;
  active_subscribers: number;
  total_notifications_sent_today: number;
  total_notifications_sent_week: number;
  total_notifications_sent_month: number;
  failed_notifications_today: number;
  most_popular_domains: Array<{ domain: string; count: number }>;
}

export const NotificationMetrics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNotificationStats();
  }, []);

  const loadNotificationStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: statsError } = await supabase
        .rpc('get_notification_statistics');

      if (statsError) throw statsError;

      if (data && data.length > 0) {
        setStats(data[0]);
      }
    } catch (err) {
      console.error('Error loading notification stats:', err);
      setError('Failed to load notification statistics');
    } finally {
      setLoading(false);
    }
  };

  const triggerManualDigest = async () => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/process-daily-job-digest`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
        }
      );

      if (response.ok) {
        alert('Daily digest triggered successfully! Check the function logs for details.');
        loadNotificationStats();
      } else {
        alert('Failed to trigger daily digest. Please check the logs.');
      }
    } catch (error) {
      console.error('Error triggering digest:', error);
      alert('Error triggering daily digest');
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-dark-100 rounded-xl border-2 border-gray-200 dark:border-dark-300 p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-neon-cyan-400" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-white dark:bg-dark-100 rounded-xl border-2 border-gray-200 dark:border-dark-300 p-6">
        <div className="text-center py-12">
          <XCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <p className="text-gray-600 dark:text-gray-400">{error || 'No data available'}</p>
          <button
            onClick={loadNotificationStats}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const successRate = stats.total_notifications_sent_today > 0
    ? ((stats.total_notifications_sent_today - stats.failed_notifications_today) / stats.total_notifications_sent_today * 100).toFixed(1)
    : '100';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white dark:bg-dark-100 rounded-xl border-2 border-gray-200 dark:border-dark-300 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Bell className="w-6 h-6 text-blue-600 dark:text-neon-cyan-400" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary">
            Notification Metrics
          </h2>
        </div>
        <button
          onClick={triggerManualDigest}
          className="px-4 py-2 bg-blue-600 dark:bg-neon-cyan-500 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 dark:hover:bg-neon-cyan-600 transition-colors"
        >
          Trigger Digest
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">
              Total
            </span>
          </div>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-300">
            {stats.total_subscribers}
          </div>
          <div className="text-xs text-blue-700 dark:text-blue-400 mt-1">
            Total Subscribers
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-2 py-1 rounded">
              Active
            </span>
          </div>
          <div className="text-2xl font-bold text-green-900 dark:text-green-300">
            {stats.active_subscribers}
          </div>
          <div className="text-xs text-green-700 dark:text-green-400 mt-1">
            Active Subscribers
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between mb-2">
            <Mail className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50 px-2 py-1 rounded">
              Today
            </span>
          </div>
          <div className="text-2xl font-bold text-purple-900 dark:text-purple-300">
            {stats.total_notifications_sent_today}
          </div>
          <div className="text-xs text-purple-700 dark:text-purple-400 mt-1">
            Emails Sent Today
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/50 px-2 py-1 rounded">
              Success
            </span>
          </div>
          <div className="text-2xl font-bold text-orange-900 dark:text-orange-300">
            {successRate}%
          </div>
          <div className="text-xs text-orange-700 dark:text-orange-400 mt-1">
            Delivery Success Rate
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-50 dark:bg-dark-200 rounded-lg p-4 border border-gray-200 dark:border-dark-300">
          <div className="flex items-center space-x-2 mb-4">
            <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="font-semibold text-gray-900 dark:text-dark-text-primary">
              Notification Activity
            </h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">This Week</span>
              <span className="font-bold text-gray-900 dark:text-dark-text-primary">
                {stats.total_notifications_sent_week}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">This Month</span>
              <span className="font-bold text-gray-900 dark:text-dark-text-primary">
                {stats.total_notifications_sent_month}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Failed Today</span>
              <span className="font-bold text-red-600 dark:text-red-400">
                {stats.failed_notifications_today}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-dark-200 rounded-lg p-4 border border-gray-200 dark:border-dark-300">
          <div className="flex items-center space-x-2 mb-4">
            <TrendingUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="font-semibold text-gray-900 dark:text-dark-text-primary">
              Popular Domains
            </h3>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {stats.most_popular_domains && stats.most_popular_domains.length > 0 ? (
              stats.most_popular_domains.map((item, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {item.domain}
                  </span>
                  <span className="font-bold text-gray-900 dark:text-dark-text-primary ml-2 flex-shrink-0">
                    {item.count}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-500 italic">
                No subscription data available
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 dark:text-neon-cyan-300 mb-2 text-sm">
          About Daily Digest
        </h3>
        <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
          The daily digest processor runs automatically every day and sends personalized job alerts to subscribed users based on their domain preferences. Users receive emails with jobs posted in the last 24 hours matching their selected domains.
        </p>
      </div>
    </motion.div>
  );
};
