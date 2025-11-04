/*
  # Job Notification System

  ## Overview
  This migration creates the complete job notification system for daily digest emails
  and welcome emails when users sign up.

  ## Tables Created

  1. **job_notification_subscriptions**
     - Stores user subscription preferences for job alerts
     - Fields: user_id, is_subscribed, preferred_domains, notification_frequency, last_sent_at
     - Users can subscribe/unsubscribe and select their preferred job domains

  2. **job_notification_logs**
     - Tracks which jobs have been sent to which users to prevent duplicates
     - Fields: user_id, job_id, sent_at, email_status
     - Ensures users don't receive the same job multiple times

  3. **email_logs**
     - Comprehensive email delivery tracking for all email types
     - Fields: user_id, email_type, recipient_email, status, sent_at, error_message
     - Tracks welcome emails, job digests, and delivery status

  ## Security (RLS Policies)
  
  - Users can view and update their own notification subscriptions
  - Users can view their own notification logs
  - Admins can view all subscriptions and logs for analytics
  - Email logs are restricted to authenticated users for their own records

  ## Indexes
  
  - Optimized for querying subscriptions by user_id and subscription status
  - Indexed preferred_domains for fast domain-based filtering
  - Indexed notification_logs by job_id and sent_at for duplicate prevention
  - Email logs indexed by user_id and email_type for quick lookups

  ## Helper Functions
  
  - get_subscribed_users_for_domain(): Returns users subscribed to specific domain
  - check_if_job_sent_to_user(): Prevents duplicate job notifications
  - log_notification_send(): Records notification delivery
  - get_notification_statistics(): Admin analytics for notification metrics
*/

-- ============================================================================
-- JOB NOTIFICATION SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_notification_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_subscribed boolean DEFAULT true NOT NULL,
  preferred_domains text[] DEFAULT ARRAY[]::text[] NOT NULL,
  notification_frequency text DEFAULT 'daily' NOT NULL CHECK (notification_frequency IN ('daily', 'immediate', 'weekly')),
  last_sent_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

ALTER TABLE job_notification_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON job_notification_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
  ON job_notification_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON job_notification_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscription"
  ON job_notification_subscriptions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions"
  ON job_notification_subscriptions FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_notification_subs_user ON job_notification_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_subs_active ON job_notification_subscriptions(is_subscribed) WHERE is_subscribed = true;
CREATE INDEX IF NOT EXISTS idx_notification_subs_domains ON job_notification_subscriptions USING GIN (preferred_domains);
CREATE INDEX IF NOT EXISTS idx_notification_subs_last_sent ON job_notification_subscriptions(last_sent_at);

-- ============================================================================
-- JOB NOTIFICATION LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE,
  sent_at timestamptz DEFAULT now() NOT NULL,
  email_status text DEFAULT 'sent' NOT NULL CHECK (email_status IN ('sent', 'failed', 'pending')),
  notification_type text DEFAULT 'daily_digest' NOT NULL CHECK (notification_type IN ('daily_digest', 'immediate', 'manual')),
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE job_notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification logs"
  ON job_notification_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notification logs"
  ON job_notification_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view all notification logs"
  ON job_notification_logs FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_notification_logs_user ON job_notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_job ON job_notification_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON job_notification_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_job ON job_notification_logs(user_id, job_id);

-- ============================================================================
-- EMAIL LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type text NOT NULL CHECK (email_type IN ('welcome', 'job_digest', 'notification', 'other')),
  recipient_email text NOT NULL,
  subject text NOT NULL,
  status text DEFAULT 'sent' NOT NULL CHECK (status IN ('sent', 'failed', 'pending', 'bounced')),
  error_message text,
  sent_at timestamptz DEFAULT now() NOT NULL,
  opened_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email logs"
  ON email_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert email logs"
  ON email_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view all email logs"
  ON email_logs FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_email_logs_user ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get subscribed users for a specific domain
CREATE OR REPLACE FUNCTION get_subscribed_users_for_domain(p_domain text)
RETURNS TABLE (
  user_id uuid,
  user_email text,
  preferred_domains text[],
  last_sent_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.user_id,
    u.email as user_email,
    s.preferred_domains,
    s.last_sent_at
  FROM job_notification_subscriptions s
  JOIN auth.users u ON s.user_id = u.id
  WHERE s.is_subscribed = true
    AND p_domain = ANY(s.preferred_domains)
  ORDER BY s.last_sent_at ASC NULLS FIRST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a job was already sent to a user
CREATE OR REPLACE FUNCTION check_if_job_sent_to_user(p_user_id uuid, p_job_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM job_notification_logs
    WHERE user_id = p_user_id AND job_id = p_job_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log notification send
CREATE OR REPLACE FUNCTION log_notification_send(
  p_user_id uuid,
  p_job_id uuid,
  p_email_status text DEFAULT 'sent',
  p_notification_type text DEFAULT 'daily_digest'
)
RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO job_notification_logs (user_id, job_id, email_status, notification_type)
  VALUES (p_user_id, p_job_id, p_email_status, p_notification_type)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get notification statistics (for admin dashboard)
CREATE OR REPLACE FUNCTION get_notification_statistics()
RETURNS TABLE (
  total_subscribers bigint,
  active_subscribers bigint,
  total_notifications_sent_today bigint,
  total_notifications_sent_week bigint,
  total_notifications_sent_month bigint,
  failed_notifications_today bigint,
  most_popular_domains jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM job_notification_subscriptions)::bigint,
    (SELECT COUNT(*) FROM job_notification_subscriptions WHERE is_subscribed = true)::bigint,
    (SELECT COUNT(*) FROM job_notification_logs WHERE sent_at >= CURRENT_DATE)::bigint,
    (SELECT COUNT(*) FROM job_notification_logs WHERE sent_at >= CURRENT_DATE - INTERVAL '7 days')::bigint,
    (SELECT COUNT(*) FROM job_notification_logs WHERE sent_at >= CURRENT_DATE - INTERVAL '30 days')::bigint,
    (SELECT COUNT(*) FROM job_notification_logs WHERE email_status = 'failed' AND sent_at >= CURRENT_DATE)::bigint,
    (SELECT jsonb_agg(jsonb_build_object('domain', domain, 'count', count))
     FROM (
       SELECT UNNEST(preferred_domains) as domain, COUNT(*) as count
       FROM job_notification_subscriptions
       WHERE is_subscribed = true
       GROUP BY domain
       ORDER BY count DESC
       LIMIT 10
     ) domains)::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update last_sent_at timestamp
CREATE OR REPLACE FUNCTION update_subscription_last_sent(p_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE job_notification_subscriptions
  SET last_sent_at = now(), updated_at = now()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get jobs for daily digest (jobs posted in last 24 hours matching user preferences)
CREATE OR REPLACE FUNCTION get_jobs_for_daily_digest(p_user_id uuid)
RETURNS TABLE (
  job_id uuid,
  company_name text,
  role_title text,
  domain text,
  application_link text,
  posted_date timestamptz,
  location_type text,
  package_amount integer
) AS $$
DECLARE
  v_preferred_domains text[];
BEGIN
  -- Get user's preferred domains
  SELECT preferred_domains INTO v_preferred_domains
  FROM job_notification_subscriptions
  WHERE user_id = p_user_id AND is_subscribed = true;

  -- Return jobs that match preferences and haven't been sent yet
  RETURN QUERY
  SELECT
    j.id as job_id,
    j.company_name,
    j.role_title,
    j.domain,
    j.application_link,
    j.posted_date,
    j.location_type,
    j.package_amount
  FROM job_listings j
  WHERE j.is_active = true
    AND j.posted_date >= (CURRENT_TIMESTAMP - INTERVAL '24 hours')
    AND j.domain = ANY(v_preferred_domains)
    AND NOT EXISTS (
      SELECT 1 FROM job_notification_logs
      WHERE user_id = p_user_id AND job_id = j.id
    )
  ORDER BY j.posted_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_subscription_timestamp_trigger'
  ) THEN
    CREATE TRIGGER update_subscription_timestamp_trigger
      BEFORE UPDATE ON job_notification_subscriptions
      FOR EACH ROW
      EXECUTE FUNCTION update_subscription_timestamp();
  END IF;
END $$;

-- Function to cleanup old notification logs (older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_notification_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM job_notification_logs
  WHERE sent_at < (CURRENT_TIMESTAMP - INTERVAL '90 days');
  
  DELETE FROM email_logs
  WHERE sent_at < (CURRENT_TIMESTAMP - INTERVAL '90 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_subscribed_users_for_domain(text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_if_job_sent_to_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION log_notification_send(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_notification_statistics() TO authenticated;
GRANT EXECUTE ON FUNCTION update_subscription_last_sent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_jobs_for_daily_digest(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_notification_logs() TO authenticated;