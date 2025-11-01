/*
  # Add Interview Session Backups Table
  
  1. New Tables
    - `interview_session_backups`
      - `id` (uuid, primary key) - Unique identifier
      - `session_id` (text, unique) - Reference to the interview session
      - `user_id` (uuid) - Reference to the user
      - `current_question_index` (integer) - Current question being answered
      - `total_questions` (integer) - Total number of questions
      - `time_remaining` (integer) - Remaining time in seconds
      - `current_transcript` (text) - Current speech transcript
      - `text_answer` (text) - Current text answer
      - `code_answer` (text) - Current code answer
      - `selected_language` (text) - Selected programming language
      - `questions_answered` (integer) - Number of questions answered
      - `questions_skipped` (integer) - Number of questions skipped
      - `interview_type` (text) - Type of interview (realistic, smart, adaptive)
      - `last_saved` (timestamptz) - Last save timestamp
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
      
  2. Security
    - Enable RLS on `interview_session_backups` table
    - Add policies for users to manage their own session backups
*/

CREATE TABLE IF NOT EXISTS interview_session_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text UNIQUE NOT NULL,
  user_id uuid NOT NULL,
  current_question_index integer DEFAULT 0,
  total_questions integer DEFAULT 0,
  time_remaining integer DEFAULT 0,
  current_transcript text DEFAULT '',
  text_answer text DEFAULT '',
  code_answer text DEFAULT '',
  selected_language text DEFAULT 'Python',
  questions_answered integer DEFAULT 0,
  questions_skipped integer DEFAULT 0,
  interview_type text NOT NULL CHECK (interview_type IN ('realistic', 'smart', 'adaptive')),
  last_saved timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE interview_session_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session backups"
  ON interview_session_backups
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own session backups"
  ON interview_session_backups
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own session backups"
  ON interview_session_backups
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own session backups"
  ON interview_session_backups
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_session_backups_user_type 
  ON interview_session_backups(user_id, interview_type, last_saved DESC);

CREATE INDEX IF NOT EXISTS idx_session_backups_session_id 
  ON interview_session_backups(session_id);
