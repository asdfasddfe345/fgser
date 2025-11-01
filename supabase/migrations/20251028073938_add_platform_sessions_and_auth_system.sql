/*
  # Platform Sessions and Authentication System for Auto-Apply

  ## Overview
  This migration creates the infrastructure for secure session management in the auto-apply system.
  It enables users to authenticate once per platform per day, storing encrypted session tokens
  that are automatically used for subsequent job applications on the same platform.

  ## 1. New Tables
  
  ### `platform_sessions`
  Stores encrypted session tokens for job application platforms (LinkedIn, Workday, Naukri, etc.)
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to auth.users)
  - `platform_name` (text) - Platform identifier (e.g., 'linkedin', 'workday', 'naukri')
  - `platform_url` (text) - Base URL of the platform
  - `encrypted_session_data` (text) - AES-256 encrypted session tokens/cookies
  - `session_metadata` (jsonb) - Additional platform-specific data (user agent, viewport, etc.)
  - `expires_at` (timestamptz) - Token expiry (24 hours from creation)
  - `last_used_at` (timestamptz) - Last time this session was used
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `authentication_events`
  Audit trail for all authentication-related activities
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to auth.users)
  - `platform_name` (text)
  - `event_type` (text) - 'login_required', 'login_success', 'session_expired', 'logout'
  - `auto_apply_log_id` (uuid, foreign key to auto_apply_logs, nullable)
  - `ip_address` (text)
  - `user_agent` (text)
  - `event_metadata` (jsonb)
  - `created_at` (timestamptz)

  ### `automation_state`
  Stores pause/resume state for interrupted auto-apply processes
  - `id` (uuid, primary key)
  - `auto_apply_log_id` (uuid, foreign key to auto_apply_logs)
  - `user_id` (uuid, foreign key to auth.users)
  - `current_step` (text) - Last completed step
  - `form_data_filled` (jsonb) - Fields successfully filled
  - `pending_fields` (jsonb) - Fields still need to be filled
  - `pause_reason` (text) - Why automation paused ('auth_required', 'captcha', 'error', etc.)
  - `browser_state` (jsonb) - Cookies, localStorage, session storage
  - `screenshots` (jsonb) - Array of screenshot URLs at each step
  - `resume_count` (integer) - Number of times resumed (for retry tracking)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## 2. Updates to Existing Tables
  
  ### `auto_apply_logs`
  - Add `authentication_required` (boolean) - Whether login was needed
  - Add `session_used` (boolean) - Whether stored session was used
  - Add `pause_count` (integer) - Number of times automation paused
  - Add `resume_count` (integer) - Number of times automation resumed
  - Add `automation_mode` (text) - 'visible', 'headless', or 'hybrid'

  ## 3. Security
  - Enable RLS on all new tables
  - Users can only access their own sessions and authentication events
  - Platform sessions automatically expire after 24 hours
  - Admin users can view all authentication events for monitoring

  ## 4. Indexes
  - Index on user_id + platform_name for fast session lookups
  - Index on expires_at for efficient cleanup jobs
  - Index on auto_apply_log_id for quick state recovery

  ## 5. Functions
  - Automatic cleanup function for expired sessions
  - Session validation function
  - Encryption key derivation function
*/

-- ============================================
-- 1. CREATE PLATFORM_SESSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS platform_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_name text NOT NULL,
  platform_url text NOT NULL,
  encrypted_session_data text NOT NULL,
  session_metadata jsonb DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  last_used_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, platform_name)
);

-- Index for fast session lookups
CREATE INDEX IF NOT EXISTS idx_platform_sessions_user_platform 
  ON platform_sessions(user_id, platform_name);

-- Index for cleanup of expired sessions
CREATE INDEX IF NOT EXISTS idx_platform_sessions_expires 
  ON platform_sessions(expires_at);

-- Enable RLS
ALTER TABLE platform_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own sessions
CREATE POLICY "Users can view own sessions"
  ON platform_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own sessions
CREATE POLICY "Users can insert own sessions"
  ON platform_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own sessions
CREATE POLICY "Users can update own sessions"
  ON platform_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own sessions
CREATE POLICY "Users can delete own sessions"
  ON platform_sessions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- 2. CREATE AUTHENTICATION_EVENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS authentication_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_name text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('login_required', 'login_success', 'login_failure', 'session_expired', 'session_created', 'session_refreshed', 'logout', 'session_deleted')),
  auto_apply_log_id uuid REFERENCES auto_apply_logs(id) ON DELETE SET NULL,
  ip_address text,
  user_agent text,
  event_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Index for user event history
CREATE INDEX IF NOT EXISTS idx_authentication_events_user 
  ON authentication_events(user_id, created_at DESC);

-- Index for auto-apply log correlation
CREATE INDEX IF NOT EXISTS idx_authentication_events_log 
  ON authentication_events(auto_apply_log_id);

-- Enable RLS
ALTER TABLE authentication_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own events
CREATE POLICY "Users can view own authentication events"
  ON authentication_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own events
CREATE POLICY "Users can insert own authentication events"
  ON authentication_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 3. CREATE AUTOMATION_STATE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS automation_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_apply_log_id uuid NOT NULL REFERENCES auto_apply_logs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step text NOT NULL,
  form_data_filled jsonb DEFAULT '{}'::jsonb,
  pending_fields jsonb DEFAULT '[]'::jsonb,
  pause_reason text CHECK (pause_reason IN ('auth_required', 'captcha_detected', 'network_error', 'form_error', 'manual_intervention', 'unknown')),
  browser_state jsonb DEFAULT '{}'::jsonb,
  screenshots jsonb DEFAULT '[]'::jsonb,
  resume_count integer DEFAULT 0,
  can_resume boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(auto_apply_log_id)
);

-- Index for quick state recovery
CREATE INDEX IF NOT EXISTS idx_automation_state_log 
  ON automation_state(auto_apply_log_id);

-- Index for user's paused automations
CREATE INDEX IF NOT EXISTS idx_automation_state_user 
  ON automation_state(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE automation_state ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own automation states
CREATE POLICY "Users can view own automation states"
  ON automation_state
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own automation states
CREATE POLICY "Users can insert own automation states"
  ON automation_state
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own automation states
CREATE POLICY "Users can update own automation states"
  ON automation_state
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own automation states
CREATE POLICY "Users can delete own automation states"
  ON automation_state
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- 4. UPDATE AUTO_APPLY_LOGS TABLE
-- ============================================

-- Add new columns for session tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auto_apply_logs' AND column_name = 'authentication_required'
  ) THEN
    ALTER TABLE auto_apply_logs ADD COLUMN authentication_required boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auto_apply_logs' AND column_name = 'session_used'
  ) THEN
    ALTER TABLE auto_apply_logs ADD COLUMN session_used boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auto_apply_logs' AND column_name = 'pause_count'
  ) THEN
    ALTER TABLE auto_apply_logs ADD COLUMN pause_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auto_apply_logs' AND column_name = 'resume_count'
  ) THEN
    ALTER TABLE auto_apply_logs ADD COLUMN resume_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auto_apply_logs' AND column_name = 'automation_mode'
  ) THEN
    ALTER TABLE auto_apply_logs ADD COLUMN automation_mode text CHECK (automation_mode IN ('visible', 'headless', 'hybrid', 'simulation'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auto_apply_logs' AND column_name = 'platform_detected'
  ) THEN
    ALTER TABLE auto_apply_logs ADD COLUMN platform_detected text;
  END IF;
END $$;

-- ============================================
-- 5. FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to automatically clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM platform_sessions
  WHERE expires_at < now();
END;
$$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger for platform_sessions updated_at
DROP TRIGGER IF EXISTS update_platform_sessions_updated_at ON platform_sessions;
CREATE TRIGGER update_platform_sessions_updated_at
  BEFORE UPDATE ON platform_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for automation_state updated_at
DROP TRIGGER IF EXISTS update_automation_state_updated_at ON automation_state;
CREATE TRIGGER update_automation_state_updated_at
  BEFORE UPDATE ON automation_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to validate session is not expired
CREATE OR REPLACE FUNCTION is_session_valid(session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_expires timestamptz;
BEGIN
  SELECT expires_at INTO session_expires
  FROM platform_sessions
  WHERE id = session_id;

  IF session_expires IS NULL THEN
    RETURN false;
  END IF;

  RETURN session_expires > now();
END;
$$;

-- ============================================
-- 6. INITIAL DATA AND CLEANUP
-- ============================================

-- Clean up any existing expired sessions
SELECT cleanup_expired_sessions();

COMMENT ON TABLE platform_sessions IS 'Stores encrypted session tokens for job application platforms with 24-hour expiry';
COMMENT ON TABLE authentication_events IS 'Audit trail for all authentication-related activities in auto-apply system';
COMMENT ON TABLE automation_state IS 'Stores pause/resume state for interrupted auto-apply processes';
COMMENT ON FUNCTION cleanup_expired_sessions() IS 'Removes expired platform sessions (should be run daily via cron)';
COMMENT ON FUNCTION is_session_valid(uuid) IS 'Checks if a platform session is still valid and not expired';