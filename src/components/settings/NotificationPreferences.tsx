import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, BellOff, Check, X, Loader2, Mail, Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { userPreferencesService } from '../../services/userPreferencesService';

export const NotificationPreferences: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [availableDomains, setAvailableDomains] = useState<string[]>([]);
  const [notificationFrequency, setNotificationFrequency] = useState<'daily' | 'immediate' | 'weekly'>('daily');
  const [stats, setStats] = useState<{
    totalNotifications: number;
    lastNotificationDate: string | null;
  }>({ totalNotifications: 0, lastNotificationDate: null });

  useEffect(() => {
    if (user) {
      loadNotificationPreferences();
      loadAvailableDomains();
      loadStats();
    }
  }, [user]);

  const loadNotificationPreferences = async () => {
    if (!user) return;

    try {
      const subscription = await userPreferencesService.getNotificationSubscription(user.id);
      if (subscription) {
        setIsSubscribed(subscription.is_subscribed);
        setSelectedDomains(subscription.preferred_domains || []);
        setNotificationFrequency(subscription.notification_frequency || 'daily');
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableDomains = async () => {
    try {
      const domains = await userPreferencesService.getAvailableDomains();
      setAvailableDomains(domains);
    } catch (error) {
      console.error('Error loading available domains:', error);
    }
  };

  const loadStats = async () => {
    if (!user) return;

    try {
      const userStats = await userPreferencesService.getNotificationStats(user.id);
      setStats(userStats);
    } catch (error) {
      console.error('Error loading notification stats:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setMessage(null);

    try {
      const success = await userPreferencesService.updateNotificationSubscription(
        user.id,
        selectedDomains,
        isSubscribed,
        notificationFrequency
      );

      if (success) {
        setMessage({ type: 'success', text: 'Notification preferences saved successfully!' });
        loadStats();
      } else {
        setMessage({ type: 'error', text: 'Failed to save preferences. Please try again.' });
      }
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      setMessage({ type: 'error', text: 'An error occurred while saving preferences.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const toggleDomain = (domain: string) => {
    setSelectedDomains(prev =>
      prev.includes(domain)
        ? prev.filter(d => d !== domain)
        : [...prev, domain]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-neon-cyan-400" />
      </div>
    );
  }

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
            Job Notifications
          </h2>
        </div>
        <button
          onClick={() => setIsSubscribed(!isSubscribed)}
          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
            isSubscribed
              ? 'bg-blue-600 dark:bg-neon-cyan-500'
              : 'bg-gray-300 dark:bg-dark-300'
          }`}
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
              isSubscribed ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-6 p-4 rounded-lg flex items-center space-x-2 ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="w-5 h-5 flex-shrink-0" />
          ) : (
            <X className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="text-sm font-medium">{message.text}</span>
        </motion.div>
      )}

      {isSubscribed ? (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-dark-text-secondary mb-3">
              Notification Frequency
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { value: 'daily', icon: Calendar, label: 'Daily Digest', desc: 'Once per day' },
                { value: 'immediate', icon: Bell, label: 'Immediate', desc: 'As posted' },
                { value: 'weekly', icon: Mail, label: 'Weekly', desc: 'Once per week' },
              ].map((freq) => {
                const Icon = freq.icon;
                const isSelected = notificationFrequency === freq.value;
                return (
                  <button
                    key={freq.value}
                    onClick={() => setNotificationFrequency(freq.value as any)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-blue-600 dark:border-neon-cyan-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-dark-300 hover:border-blue-400 dark:hover:border-neon-cyan-600'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mx-auto mb-2 ${
                      isSelected ? 'text-blue-600 dark:text-neon-cyan-400' : 'text-gray-600 dark:text-gray-400'
                    }`} />
                    <div className={`font-semibold text-sm ${
                      isSelected ? 'text-blue-900 dark:text-neon-cyan-300' : 'text-gray-900 dark:text-dark-text-primary'
                    }`}>
                      {freq.label}
                    </div>
                    <div className={`text-xs mt-1 ${
                      isSelected ? 'text-blue-700 dark:text-neon-cyan-400' : 'text-gray-500 dark:text-gray-500'
                    }`}>
                      {freq.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-dark-text-secondary mb-3">
              Preferred Job Domains
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Select domains you're interested in. You'll receive notifications for jobs matching these domains.
            </p>
            <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-1">
              {availableDomains.map((domain) => {
                const isSelected = selectedDomains.includes(domain);
                return (
                  <button
                    key={domain}
                    onClick={() => toggleDomain(domain)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isSelected
                        ? 'bg-blue-600 dark:bg-neon-cyan-500 text-white'
                        : 'bg-gray-100 dark:bg-dark-200 text-gray-700 dark:text-dark-text-secondary hover:bg-gray-200 dark:hover:bg-dark-300'
                    }`}
                  >
                    {domain}
                  </button>
                );
              })}
            </div>
            {selectedDomains.length === 0 && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                Please select at least one domain to receive notifications.
              </p>
            )}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-neon-cyan-300 mb-2">
              Notification Statistics
            </h3>
            <div className="space-y-1 text-sm text-blue-800 dark:text-blue-300">
              <p>Total notifications received: <strong>{stats.totalNotifications}</strong></p>
              {stats.lastNotificationDate && (
                <p>
                  Last notification: <strong>{new Date(stats.lastNotificationDate).toLocaleDateString()}</strong>
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || selectedDomains.length === 0}
            className={`w-full py-3 px-6 rounded-lg font-semibold transition-all ${
              saving || selectedDomains.length === 0
                ? 'bg-gray-300 dark:bg-dark-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 dark:bg-neon-cyan-500 text-white hover:bg-blue-700 dark:hover:bg-neon-cyan-600'
            }`}
          >
            {saving ? (
              <span className="flex items-center justify-center space-x-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Saving...</span>
              </span>
            ) : (
              'Save Preferences'
            )}
          </button>
        </div>
      ) : (
        <div className="text-center py-12">
          <BellOff className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary mb-2">
            Notifications Disabled
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Enable notifications to receive daily job alerts matching your preferences.
          </p>
          <button
            onClick={() => setIsSubscribed(true)}
            className="bg-blue-600 dark:bg-neon-cyan-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 dark:hover:bg-neon-cyan-600 transition-colors"
          >
            Enable Notifications
          </button>
        </div>
      )}
    </motion.div>
  );
};
