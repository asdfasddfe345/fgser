/*
  # Add Security Tracking Columns to Realistic Interview Sessions

  1. Changes
    - Add security_score column to track overall interview integrity
    - Add tab_switches_count to track tab switch violations
    - Add fullscreen_exits_count to track fullscreen exit violations
    - Add total_violation_time to track cumulative time spent away from interview
  
  2. Notes
    - These columns support the interview integrity monitoring system
    - All columns are nullable with default values for backward compatibility
    - Security score defaults to 100 (perfect score)
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'realistic_interview_sessions' 
    AND column_name = 'security_score'
  ) THEN
    ALTER TABLE realistic_interview_sessions 
    ADD COLUMN security_score numeric DEFAULT 100;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'realistic_interview_sessions' 
    AND column_name = 'tab_switches_count'
  ) THEN
    ALTER TABLE realistic_interview_sessions 
    ADD COLUMN tab_switches_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'realistic_interview_sessions' 
    AND column_name = 'fullscreen_exits_count'
  ) THEN
    ALTER TABLE realistic_interview_sessions 
    ADD COLUMN fullscreen_exits_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'realistic_interview_sessions' 
    AND column_name = 'total_violation_time'
  ) THEN
    ALTER TABLE realistic_interview_sessions 
    ADD COLUMN total_violation_time integer DEFAULT 0;
  END IF;
END $$;