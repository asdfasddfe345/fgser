/*
  # Add Security Tracking to Mock Interview Sessions

  1. New Columns Added to `mock_interview_sessions` table:
    - `tab_switches_count` (integer) - Number of times user switched tabs during interview
    - `fullscreen_exits_count` (integer) - Number of times user exited full-screen mode
    - `total_violation_time` (integer) - Total time spent away from interview in seconds
    - `violations_log` (jsonb) - Detailed log of all violations with timestamps
    - `security_score` (integer) - Overall security compliance score (0-100)

  2. Purpose:
    - Track interview integrity and prevent cheating
    - Monitor user behavior during mock interviews
    - Provide security metrics in interview reports
    - Help employers trust interview results

  3. Notes:
    - All new fields are nullable for backward compatibility
    - Default values are set to 0 for count fields
    - Security score defaults to 100 (perfect score)
    - Violations log is stored as JSONB for flexibility
*/

-- Add security tracking columns to mock_interview_sessions table
DO $$
BEGIN
  -- Add tab switches count
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mock_interview_sessions' AND column_name = 'tab_switches_count'
  ) THEN
    ALTER TABLE mock_interview_sessions
    ADD COLUMN tab_switches_count integer DEFAULT 0;
  END IF;

  -- Add fullscreen exits count
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mock_interview_sessions' AND column_name = 'fullscreen_exits_count'
  ) THEN
    ALTER TABLE mock_interview_sessions
    ADD COLUMN fullscreen_exits_count integer DEFAULT 0;
  END IF;

  -- Add total violation time
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mock_interview_sessions' AND column_name = 'total_violation_time'
  ) THEN
    ALTER TABLE mock_interview_sessions
    ADD COLUMN total_violation_time integer DEFAULT 0;
  END IF;

  -- Add violations log
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mock_interview_sessions' AND column_name = 'violations_log'
  ) THEN
    ALTER TABLE mock_interview_sessions
    ADD COLUMN violations_log jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add security score
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mock_interview_sessions' AND column_name = 'security_score'
  ) THEN
    ALTER TABLE mock_interview_sessions
    ADD COLUMN security_score integer DEFAULT 100;
  END IF;
END $$;

-- Add comments to document the new columns
COMMENT ON COLUMN mock_interview_sessions.tab_switches_count IS 'Number of times user switched browser tabs during the interview';
COMMENT ON COLUMN mock_interview_sessions.fullscreen_exits_count IS 'Number of times user exited full-screen mode during the interview';
COMMENT ON COLUMN mock_interview_sessions.total_violation_time IS 'Total time in seconds that user spent away from the interview (switched tabs or window blur)';
COMMENT ON COLUMN mock_interview_sessions.violations_log IS 'Detailed JSON log of all security violations with type, timestamp, and duration';
COMMENT ON COLUMN mock_interview_sessions.security_score IS 'Security compliance score from 0-100, calculated based on violations (100 = perfect, no violations)';