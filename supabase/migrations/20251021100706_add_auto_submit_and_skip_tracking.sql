/*
  # Add Auto-Submit and Skip Question Tracking

  1. Changes to Tables
    - Add `auto_submitted` column to `interview_responses` table
      - Boolean field to track if answer was auto-submitted due to silence
    - Add `silence_duration` column to `interview_responses` table
      - Integer field to track how many seconds of silence before submission
    - Add `skipped_questions` column to `mock_interview_sessions` table
      - JSONB array to store IDs of skipped questions
    - Add `skip_count` column to `mock_interview_sessions` table
      - Integer counter for total questions skipped

  2. Purpose
    - Track which answers were automatically submitted vs manually submitted
    - Record silence duration for analytics and coaching insights
    - Monitor which questions users skip for difficulty analysis
    - Improve interview experience tracking and reporting
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interview_responses' AND column_name = 'auto_submitted'
  ) THEN
    ALTER TABLE interview_responses ADD COLUMN auto_submitted boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interview_responses' AND column_name = 'silence_duration'
  ) THEN
    ALTER TABLE interview_responses ADD COLUMN silence_duration integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mock_interview_sessions' AND column_name = 'skipped_questions'
  ) THEN
    ALTER TABLE mock_interview_sessions ADD COLUMN skipped_questions jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mock_interview_sessions' AND column_name = 'skip_count'
  ) THEN
    ALTER TABLE mock_interview_sessions ADD COLUMN skip_count integer DEFAULT 0;
  END IF;
END $$;

COMMENT ON COLUMN interview_responses.auto_submitted IS 'Indicates if the answer was automatically submitted after 5 seconds of silence';
COMMENT ON COLUMN interview_responses.silence_duration IS 'Duration of silence in seconds before auto-submission';
COMMENT ON COLUMN mock_interview_sessions.skipped_questions IS 'Array of question IDs that were skipped during the interview';
COMMENT ON COLUMN mock_interview_sessions.skip_count IS 'Total count of questions skipped in this session';
