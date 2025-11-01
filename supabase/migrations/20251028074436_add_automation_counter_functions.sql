/*
  # Add Automation Counter Functions

  ## Overview
  Creates database functions to safely increment pause and resume counters
  in the auto_apply_logs table.

  ## Functions
  - increment_pause_count: Increments pause_count for a log entry
  - increment_resume_count: Increments resume_count for a log entry
*/

-- Function to increment pause_count in auto_apply_logs
CREATE OR REPLACE FUNCTION increment_pause_count(log_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE auto_apply_logs
  SET pause_count = COALESCE(pause_count, 0) + 1
  WHERE id = log_id;
END;
$$;

-- Function to increment resume_count in auto_apply_logs
CREATE OR REPLACE FUNCTION increment_resume_count(log_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE auto_apply_logs
  SET resume_count = COALESCE(resume_count, 0) + 1
  WHERE id = log_id;
END;
$$;

COMMENT ON FUNCTION increment_pause_count(uuid) IS 'Safely increments the pause_count for an auto-apply log entry';
COMMENT ON FUNCTION increment_resume_count(uuid) IS 'Safely increments the resume_count for an auto-apply log entry';
