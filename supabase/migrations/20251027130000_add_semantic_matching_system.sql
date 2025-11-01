/*
  # Add Semantic Matching System for Resume Score Checker

  ## Overview
  This migration creates the infrastructure for semantic matching capabilities including:
  - Resume embeddings storage with vector support
  - JD embeddings cache
  - Semantic match results caching
  - ATS profile configurations

  ## New Tables

  ### `resume_embeddings`
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to auth.users)
  - `vector` (jsonb) - Stores the 384-dimensional embedding vector
  - `text` (text) - Original text that was embedded
  - `type` (text) - Type: 'resume_section', 'jd_requirement', 'skill', 'keyword'
  - `metadata` (jsonb) - Additional context (section name, source, etc.)
  - `created_at` (timestamptz)

  ### `jd_embeddings`
  - `id` (uuid, primary key)
  - `jd_hash` (text, indexed) - SHA-256 hash of JD content for cache lookup
  - `vector` (jsonb) - Embedding vector for the job description
  - `keywords_extracted` (text[]) - Extracted keywords from JD
  - `job_title` (text) - Job title from the JD
  - `created_at` (timestamptz)
  - `expires_at` (timestamptz) - Cache expiration (24 hours)

  ### `semantic_match_cache`
  - `id` (uuid, primary key)
  - `resume_hash` (text, indexed) - Hash of resume content
  - `jd_hash` (text, indexed) - Hash of JD content
  - `similarity_score` (numeric) - Cosine similarity score (0-1)
  - `literal_score` (numeric) - Literal keyword match score
  - `combined_score` (numeric) - Hybrid score
  - `match_details` (jsonb) - Detailed match information
  - `created_at` (timestamptz)
  - `expires_at` (timestamptz) - Cache expiration

  ### `ats_profiles`
  - `id` (uuid, primary key)
  - `name` (text, unique) - Profile name: 'workday', 'greenhouse', 'lever', 'taleo', 'generic'
  - `config_json` (jsonb) - Configuration including weights and rules
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Users can only access their own embeddings
  - JD embeddings and caches are accessible to authenticated users
  - ATS profiles are publicly readable

  ## Indexes
  - Hash-based indexes for cache lookups
  - User ID index for embeddings
  - Expiration time indexes for cache cleanup
*/

-- Create resume_embeddings table
CREATE TABLE IF NOT EXISTS resume_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  vector jsonb NOT NULL,
  text text NOT NULL,
  type text NOT NULL CHECK (type IN ('resume_section', 'jd_requirement', 'skill', 'keyword')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create jd_embeddings table
CREATE TABLE IF NOT EXISTS jd_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jd_hash text NOT NULL,
  vector jsonb NOT NULL,
  keywords_extracted text[] DEFAULT ARRAY[]::text[],
  job_title text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours')
);

-- Create semantic_match_cache table
CREATE TABLE IF NOT EXISTS semantic_match_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_hash text NOT NULL,
  jd_hash text NOT NULL,
  similarity_score numeric NOT NULL,
  literal_score numeric NOT NULL,
  combined_score numeric NOT NULL,
  match_details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours')
);

-- Create ats_profiles table
CREATE TABLE IF NOT EXISTS ats_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL CHECK (name IN ('workday', 'greenhouse', 'lever', 'taleo', 'generic')),
  config_json jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_resume_embeddings_user_id ON resume_embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_embeddings_type ON resume_embeddings(type);
CREATE INDEX IF NOT EXISTS idx_resume_embeddings_created_at ON resume_embeddings(created_at);

CREATE INDEX IF NOT EXISTS idx_jd_embeddings_hash ON jd_embeddings(jd_hash);
CREATE INDEX IF NOT EXISTS idx_jd_embeddings_expires_at ON jd_embeddings(expires_at);

CREATE INDEX IF NOT EXISTS idx_semantic_cache_resume_hash ON semantic_match_cache(resume_hash);
CREATE INDEX IF NOT EXISTS idx_semantic_cache_jd_hash ON semantic_match_cache(jd_hash);
CREATE INDEX IF NOT EXISTS idx_semantic_cache_combined ON semantic_match_cache(resume_hash, jd_hash);
CREATE INDEX IF NOT EXISTS idx_semantic_cache_expires_at ON semantic_match_cache(expires_at);

-- Enable Row Level Security
ALTER TABLE resume_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE jd_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE semantic_match_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ats_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for resume_embeddings
CREATE POLICY "Users can view own embeddings"
  ON resume_embeddings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own embeddings"
  ON resume_embeddings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own embeddings"
  ON resume_embeddings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for jd_embeddings (accessible to all authenticated users for cache sharing)
CREATE POLICY "Authenticated users can view JD embeddings"
  ON jd_embeddings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert JD embeddings"
  ON jd_embeddings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for semantic_match_cache (accessible to all authenticated users)
CREATE POLICY "Authenticated users can view match cache"
  ON semantic_match_cache
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert match cache"
  ON semantic_match_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for ats_profiles (publicly readable, admin writable)
CREATE POLICY "Anyone can view ATS profiles"
  ON ats_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage ATS profiles"
  ON ats_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Insert default ATS profiles
INSERT INTO ats_profiles (name, config_json) VALUES
  ('generic', '{
    "keyword_weight": 0.30,
    "experience_weight": 0.25,
    "section_order_strict": false,
    "parsing_tolerance": "moderate",
    "metadata_emphasis": 0.15,
    "custom_rules": {}
  }'::jsonb),
  ('workday', '{
    "keyword_weight": 0.40,
    "experience_weight": 0.20,
    "section_order_strict": true,
    "parsing_tolerance": "strict",
    "metadata_emphasis": 0.20,
    "custom_rules": {
      "emphasis_keyword_density": true,
      "strict_date_formats": true
    }
  }'::jsonb),
  ('greenhouse', '{
    "keyword_weight": 0.25,
    "experience_weight": 0.35,
    "section_order_strict": false,
    "parsing_tolerance": "moderate",
    "metadata_emphasis": 0.15,
    "custom_rules": {
      "emphasis_chronology": true,
      "tenure_tracking": true
    }
  }'::jsonb),
  ('lever', '{
    "keyword_weight": 0.30,
    "experience_weight": 0.25,
    "section_order_strict": false,
    "parsing_tolerance": "lenient",
    "metadata_emphasis": 0.20,
    "custom_rules": {
      "skill_taxonomy_matching": true,
      "culture_fit_indicators": true
    }
  }'::jsonb),
  ('taleo', '{
    "keyword_weight": 0.45,
    "experience_weight": 0.20,
    "section_order_strict": true,
    "parsing_tolerance": "strict",
    "metadata_emphasis": 0.10,
    "custom_rules": {
      "exact_keyword_matches": true,
      "rigid_formatting": true
    }
  }'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Create function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_embeddings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Clean up expired JD embeddings
  DELETE FROM jd_embeddings
  WHERE expires_at < now();

  -- Clean up expired semantic match cache
  DELETE FROM semantic_match_cache
  WHERE expires_at < now();

  -- Clean up old resume embeddings (older than 30 days)
  DELETE FROM resume_embeddings
  WHERE created_at < (now() - interval '30 days');
END;
$$;

-- Create a scheduled job to run cleanup (requires pg_cron extension)
-- Note: This requires the pg_cron extension to be enabled
-- If not available, cleanup should be triggered manually or via application logic
COMMENT ON FUNCTION cleanup_expired_embeddings IS 'Cleans up expired embedding cache entries and old resume embeddings';
