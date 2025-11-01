/*
  # Browserless Automation System Schema

  ## Summary
  Adds comprehensive browser automation tracking and logging system for Browserless/Playwright integration.

  ## New Tables
  1. **browser_session_logs**
     - Tracks individual browser automation sessions
     - Stores session state, screenshots, and execution logs
     - Links to auto_apply_applications for job application tracking

  2. **platform_field_mappings**
     - Stores learned form field patterns per platform
     - Enables intelligent form detection and auto-fill
     - Improves over time with usage data

  3. **automation_performance_metrics**
     - Tracks success rates and performance per platform
     - Enables analytics and optimization
     - Monitors cost and execution time

  ## Storage Buckets
  - Creates browser-screenshots bucket for automation screenshots
  - Creates browser-logs bucket for detailed execution logs

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Users can only access their own session data
  - Admins can view aggregated metrics
*/

-- =============================================
-- BROWSER SESSION LOGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS browser_session_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  application_id uuid REFERENCES auto_apply_applications(id) ON DELETE CASCADE,
  session_id text UNIQUE NOT NULL,
  platform text NOT NULL,
  automation_mode text CHECK (automation_mode IN ('browserless', 'external', 'simulation')) DEFAULT 'simulation',
  status text CHECK (status IN ('initializing', 'navigating', 'filling', 'uploading', 'submitting', 'completed', 'failed')) DEFAULT 'initializing',
  application_url text NOT NULL,
  browser_config jsonb DEFAULT '{}'::jsonb,
  navigation_logs jsonb DEFAULT '[]'::jsonb,
  form_interaction_logs jsonb DEFAULT '[]'::jsonb,
  screenshot_urls text[] DEFAULT ARRAY[]::text[],
  error_logs jsonb DEFAULT '[]'::jsonb,
  started_at timestamptz DEFAULT now() NOT NULL,
  completed_at timestamptz,
  execution_time_ms integer,
  success boolean DEFAULT false,
  failure_reason text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_browser_session_logs_user_id ON browser_session_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_browser_session_logs_application_id ON browser_session_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_browser_session_logs_session_id ON browser_session_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_browser_session_logs_platform ON browser_session_logs(platform);
CREATE INDEX IF NOT EXISTS idx_browser_session_logs_status ON browser_session_logs(status);

-- =============================================
-- PLATFORM FIELD MAPPINGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS platform_field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  domain text NOT NULL,
  field_name text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text', 'email', 'tel', 'textarea', 'select', 'file', 'checkbox', 'radio')),
  selectors jsonb DEFAULT '[]'::jsonb,
  alternatives jsonb DEFAULT '[]'::jsonb,
  success_count integer DEFAULT 0,
  failure_count integer DEFAULT 0,
  last_successful_at timestamptz,
  confidence_score numeric(3,2) DEFAULT 0.5,
  is_required boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(platform, domain, field_name)
);

CREATE INDEX IF NOT EXISTS idx_platform_field_mappings_platform ON platform_field_mappings(platform);
CREATE INDEX IF NOT EXISTS idx_platform_field_mappings_domain ON platform_field_mappings(domain);
CREATE INDEX IF NOT EXISTS idx_platform_field_mappings_confidence ON platform_field_mappings(confidence_score DESC);

-- =============================================
-- AUTOMATION PERFORMANCE METRICS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS automation_performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  domain text NOT NULL,
  automation_mode text CHECK (automation_mode IN ('browserless', 'external', 'simulation')) NOT NULL,
  total_attempts integer DEFAULT 0,
  successful_attempts integer DEFAULT 0,
  failed_attempts integer DEFAULT 0,
  partial_attempts integer DEFAULT 0,
  avg_execution_time_ms integer,
  min_execution_time_ms integer,
  max_execution_time_ms integer,
  total_execution_time_ms bigint DEFAULT 0,
  last_attempt_at timestamptz,
  success_rate numeric(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN total_attempts > 0 THEN (successful_attempts::numeric / total_attempts::numeric * 100)
      ELSE 0
    END
  ) STORED,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(platform, domain, automation_mode)
);

CREATE INDEX IF NOT EXISTS idx_automation_metrics_platform ON automation_performance_metrics(platform);
CREATE INDEX IF NOT EXISTS idx_automation_metrics_success_rate ON automation_performance_metrics(success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_automation_metrics_mode ON automation_performance_metrics(automation_mode);

-- =============================================
-- STORAGE BUCKETS
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('browser-screenshots', 'browser-screenshots', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('browser-logs', 'browser-logs', false)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Browser Session Logs Policies
ALTER TABLE browser_session_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own browser sessions" ON browser_session_logs;
CREATE POLICY "Users can view own browser sessions"
  ON browser_session_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own browser sessions" ON browser_session_logs;
CREATE POLICY "Users can create own browser sessions"
  ON browser_session_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own browser sessions" ON browser_session_logs;
CREATE POLICY "Users can update own browser sessions"
  ON browser_session_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role has full access to browser sessions" ON browser_session_logs;
CREATE POLICY "Service role has full access to browser sessions"
  ON browser_session_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Platform Field Mappings Policies
ALTER TABLE platform_field_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read field mappings" ON platform_field_mappings;
CREATE POLICY "Anyone can read field mappings"
  ON platform_field_mappings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role can manage field mappings" ON platform_field_mappings;
CREATE POLICY "Service role can manage field mappings"
  ON platform_field_mappings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Automation Performance Metrics Policies
ALTER TABLE automation_performance_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read performance metrics" ON automation_performance_metrics;
CREATE POLICY "Anyone can read performance metrics"
  ON automation_performance_metrics FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role can manage performance metrics" ON automation_performance_metrics;
CREATE POLICY "Service role can manage performance metrics"
  ON automation_performance_metrics FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================
-- STORAGE POLICIES
-- =============================================

-- Browser Screenshots Storage Policies
DROP POLICY IF EXISTS "Users can view own screenshots" ON storage.objects;
CREATE POLICY "Users can view own screenshots"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'browser-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can upload own screenshots" ON storage.objects;
CREATE POLICY "Users can upload own screenshots"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'browser-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Service role full access to screenshots" ON storage.objects;
CREATE POLICY "Service role full access to screenshots"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'browser-screenshots')
  WITH CHECK (bucket_id = 'browser-screenshots');

-- Browser Logs Storage Policies
DROP POLICY IF EXISTS "Users can view own logs" ON storage.objects;
CREATE POLICY "Users can view own logs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'browser-logs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Service role full access to logs" ON storage.objects;
CREATE POLICY "Service role full access to logs"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'browser-logs')
  WITH CHECK (bucket_id = 'browser-logs');

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to update performance metrics after application attempt
CREATE OR REPLACE FUNCTION update_automation_metrics()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('submitted', 'failed', 'partial') AND OLD.status != NEW.status THEN
    INSERT INTO automation_performance_metrics (
      platform,
      domain,
      automation_mode,
      total_attempts,
      successful_attempts,
      failed_attempts,
      partial_attempts,
      total_execution_time_ms,
      min_execution_time_ms,
      max_execution_time_ms,
      avg_execution_time_ms,
      last_attempt_at
    )
    VALUES (
      NEW.platform,
      REGEXP_REPLACE(NEW.application_url, '^https?://([^/]+).*', '\1'),
      COALESCE((
        SELECT automation_mode
        FROM browser_session_logs
        WHERE application_id = NEW.id
        ORDER BY created_at DESC
        LIMIT 1
      ), 'simulation'),
      1,
      CASE WHEN NEW.status = 'submitted' THEN 1 ELSE 0 END,
      CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END,
      CASE WHEN NEW.status = 'partial' THEN 1 ELSE 0 END,
      COALESCE(NEW.time_taken_seconds * 1000, 0),
      COALESCE(NEW.time_taken_seconds * 1000, 0),
      COALESCE(NEW.time_taken_seconds * 1000, 0),
      COALESCE(NEW.time_taken_seconds * 1000, 0),
      now()
    )
    ON CONFLICT (platform, domain, automation_mode) DO UPDATE SET
      total_attempts = automation_performance_metrics.total_attempts + 1,
      successful_attempts = automation_performance_metrics.successful_attempts +
        CASE WHEN NEW.status = 'submitted' THEN 1 ELSE 0 END,
      failed_attempts = automation_performance_metrics.failed_attempts +
        CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END,
      partial_attempts = automation_performance_metrics.partial_attempts +
        CASE WHEN NEW.status = 'partial' THEN 1 ELSE 0 END,
      total_execution_time_ms = automation_performance_metrics.total_execution_time_ms +
        COALESCE(NEW.time_taken_seconds * 1000, 0),
      min_execution_time_ms = LEAST(
        automation_performance_metrics.min_execution_time_ms,
        COALESCE(NEW.time_taken_seconds * 1000, automation_performance_metrics.min_execution_time_ms)
      ),
      max_execution_time_ms = GREATEST(
        automation_performance_metrics.max_execution_time_ms,
        COALESCE(NEW.time_taken_seconds * 1000, automation_performance_metrics.max_execution_time_ms)
      ),
      avg_execution_time_ms = (
        automation_performance_metrics.total_execution_time_ms + COALESCE(NEW.time_taken_seconds * 1000, 0)
      ) / (automation_performance_metrics.total_attempts + 1),
      last_attempt_at = now(),
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto_apply_applications status changes
DROP TRIGGER IF EXISTS trigger_update_automation_metrics ON auto_apply_applications;
CREATE TRIGGER trigger_update_automation_metrics
  AFTER UPDATE ON auto_apply_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_automation_metrics();
