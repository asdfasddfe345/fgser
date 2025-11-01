/*
  # Add Referral Contact Information and Test Patterns System

  1. Job Listings Enhancements
    - Add referral contact fields (name, email, code, link)
    - Add test pattern fields (assessment types)
    - Add AI polish status tracking
    - Add application method tracking fields

  2. Test Patterns Table
    - Create table for storing test patterns/assessments
    - Store test type, difficulty, description, sample questions
    - Link tests to job domains

  3. Job Test Patterns Junction Table
    - Many-to-many relationship between jobs and tests
    - Allow multiple test assignments per job

  4. Security
    - Enable RLS on all new tables
    - Admin-only write access for test patterns
    - Public read access for active records

  5. Indexes
    - Add indexes on frequently queried fields
    - Optimize referral and test pattern lookups
*/

-- ============================================================================
-- STEP 1: ADD REFERRAL FIELDS TO JOB LISTINGS
-- ============================================================================

DO $$
BEGIN
  -- Add referral contact person name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_listings' AND column_name = 'referral_person_name'
  ) THEN
    ALTER TABLE job_listings
    ADD COLUMN referral_person_name text;
  END IF;

  -- Add referral contact email
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_listings' AND column_name = 'referral_email'
  ) THEN
    ALTER TABLE job_listings
    ADD COLUMN referral_email text;
  END IF;

  -- Add referral code
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_listings' AND column_name = 'referral_code'
  ) THEN
    ALTER TABLE job_listings
    ADD COLUMN referral_code text;
  END IF;

  -- Add referral link
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_listings' AND column_name = 'referral_link'
  ) THEN
    ALTER TABLE job_listings
    ADD COLUMN referral_link text;
  END IF;

  -- Add referral bonus amount
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_listings' AND column_name = 'referral_bonus_amount'
  ) THEN
    ALTER TABLE job_listings
    ADD COLUMN referral_bonus_amount numeric(10, 2);
  END IF;

  -- Add referral terms
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_listings' AND column_name = 'referral_terms'
  ) THEN
    ALTER TABLE job_listings
    ADD COLUMN referral_terms text;
  END IF;

  -- Add flag to indicate if referral is available
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_listings' AND column_name = 'has_referral'
  ) THEN
    ALTER TABLE job_listings
    ADD COLUMN has_referral boolean DEFAULT false;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: ADD TEST PATTERN FIELDS TO JOB LISTINGS
-- ============================================================================

DO $$
BEGIN
  -- Add test requirements description
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_listings' AND column_name = 'test_requirements'
  ) THEN
    ALTER TABLE job_listings
    ADD COLUMN test_requirements text;
  END IF;

  -- Add flag for coding test
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_listings' AND column_name = 'has_coding_test'
  ) THEN
    ALTER TABLE job_listings
    ADD COLUMN has_coding_test boolean DEFAULT false;
  END IF;

  -- Add flag for aptitude test
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_listings' AND column_name = 'has_aptitude_test'
  ) THEN
    ALTER TABLE job_listings
    ADD COLUMN has_aptitude_test boolean DEFAULT false;
  END IF;

  -- Add flag for technical interview
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_listings' AND column_name = 'has_technical_interview'
  ) THEN
    ALTER TABLE job_listings
    ADD COLUMN has_technical_interview boolean DEFAULT false;
  END IF;

  -- Add flag for HR interview
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_listings' AND column_name = 'has_hr_interview'
  ) THEN
    ALTER TABLE job_listings
    ADD COLUMN has_hr_interview boolean DEFAULT false;
  END IF;

  -- Add estimated test duration in minutes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_listings' AND column_name = 'test_duration_minutes'
  ) THEN
    ALTER TABLE job_listings
    ADD COLUMN test_duration_minutes integer;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: ADD AI POLISH AND TRACKING FIELDS
-- ============================================================================

DO $$
BEGIN
  -- Add AI polish status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_listings' AND column_name = 'ai_polished'
  ) THEN
    ALTER TABLE job_listings
    ADD COLUMN ai_polished boolean DEFAULT false;
  END IF;

  -- Add AI polish timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_listings' AND column_name = 'ai_polished_at'
  ) THEN
    ALTER TABLE job_listings
    ADD COLUMN ai_polished_at timestamptz;
  END IF;

  -- Add original description backup
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_listings' AND column_name = 'original_description'
  ) THEN
    ALTER TABLE job_listings
    ADD COLUMN original_description text;
  END IF;
END $$;

-- ============================================================================
-- STEP 4: CREATE TEST PATTERNS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS test_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name text NOT NULL,
  test_type text NOT NULL CHECK (test_type IN ('coding', 'aptitude', 'technical_interview', 'hr_interview', 'other')),
  domain text NOT NULL,
  difficulty_level text CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
  description text,
  sample_questions jsonb,
  duration_minutes integer,
  passing_score integer,
  tips text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on test_patterns
ALTER TABLE test_patterns ENABLE ROW LEVEL SECURITY;

-- Public can read active test patterns
CREATE POLICY "Anyone can view active test patterns"
  ON test_patterns
  FOR SELECT
  USING (is_active = true);

-- Only admins can insert test patterns
CREATE POLICY "Admins can insert test patterns"
  ON test_patterns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Only admins can update test patterns
CREATE POLICY "Admins can update test patterns"
  ON test_patterns
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Only admins can delete test patterns
CREATE POLICY "Admins can delete test patterns"
  ON test_patterns
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- ============================================================================
-- STEP 5: CREATE JOB TEST PATTERNS JUNCTION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_test_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_listing_id uuid NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE,
  test_pattern_id uuid NOT NULL REFERENCES test_patterns(id) ON DELETE CASCADE,
  is_mandatory boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(job_listing_id, test_pattern_id)
);

-- Enable RLS on job_test_patterns
ALTER TABLE job_test_patterns ENABLE ROW LEVEL SECURITY;

-- Anyone can view job test pattern associations
CREATE POLICY "Anyone can view job test patterns"
  ON job_test_patterns
  FOR SELECT
  USING (true);

-- Only admins can manage job test pattern associations
CREATE POLICY "Admins can insert job test patterns"
  ON job_test_patterns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update job test patterns"
  ON job_test_patterns
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete job test patterns"
  ON job_test_patterns
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- ============================================================================
-- STEP 6: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for referral lookups
CREATE INDEX IF NOT EXISTS idx_job_listings_has_referral
  ON job_listings(has_referral)
  WHERE has_referral = true AND is_active = true;

-- Index for test pattern lookups
CREATE INDEX IF NOT EXISTS idx_test_patterns_domain_type
  ON test_patterns(domain, test_type)
  WHERE is_active = true;

-- Index for job test patterns junction
CREATE INDEX IF NOT EXISTS idx_job_test_patterns_job_id
  ON job_test_patterns(job_listing_id);

CREATE INDEX IF NOT EXISTS idx_job_test_patterns_test_id
  ON job_test_patterns(test_pattern_id);

-- Index for AI polished jobs
CREATE INDEX IF NOT EXISTS idx_job_listings_ai_polished
  ON job_listings(ai_polished, ai_polished_at)
  WHERE ai_polished = true;

-- ============================================================================
-- STEP 7: INSERT SAMPLE TEST PATTERNS
-- ============================================================================

-- Insert sample coding test patterns
INSERT INTO test_patterns (test_name, test_type, domain, difficulty_level, description, duration_minutes, passing_score, tips)
VALUES
  ('DSA Coding Round', 'coding', 'SDE', 'medium', 'Data Structures and Algorithms coding assessment covering arrays, linked lists, trees, graphs, and dynamic programming.', 90, 70, 'Practice problem-solving on LeetCode, HackerRank. Focus on time and space complexity.'),
  ('Frontend Coding Challenge', 'coding', 'Frontend', 'medium', 'Build a responsive web component using HTML, CSS, and JavaScript/React.', 120, 75, 'Review JavaScript ES6+ features, React hooks, and CSS Flexbox/Grid.'),
  ('Backend API Development', 'coding', 'Backend', 'hard', 'Design and implement RESTful APIs with proper error handling and database integration.', 150, 70, 'Understand REST principles, authentication, and database optimization.'),
  ('SQL Query Assessment', 'coding', 'Data Science', 'medium', 'Write complex SQL queries involving joins, subqueries, window functions, and aggregations.', 60, 75, 'Practice window functions, CTEs, and query optimization techniques.'),
  ('Machine Learning Problem', 'coding', 'AI', 'hard', 'Build and train a machine learning model for a given dataset with proper evaluation metrics.', 180, 70, 'Review scikit-learn, pandas, and model evaluation techniques.')
ON CONFLICT DO NOTHING;

-- Insert sample aptitude test patterns
INSERT INTO test_patterns (test_name, test_type, domain, difficulty_level, description, duration_minutes, passing_score, tips)
VALUES
  ('Quantitative Aptitude', 'aptitude', 'All', 'medium', 'Numerical reasoning, logical puzzles, and analytical thinking questions.', 45, 65, 'Practice mental math, percentage calculations, and logical reasoning.'),
  ('Verbal Reasoning', 'aptitude', 'All', 'easy', 'English comprehension, grammar, and communication skills assessment.', 30, 70, 'Read articles, practice grammar rules, and work on vocabulary.'),
  ('Technical Aptitude', 'aptitude', 'SDE', 'medium', 'Computer science fundamentals, OS, DBMS, networking, and programming concepts.', 60, 70, 'Review core CS concepts from undergraduate curriculum.')
ON CONFLICT DO NOTHING;

-- Insert sample interview patterns
INSERT INTO test_patterns (test_name, test_type, domain, difficulty_level, description, duration_minutes, tips)
VALUES
  ('Technical Interview Round 1', 'technical_interview', 'All', 'medium', 'In-depth technical discussion covering your projects, problem-solving approach, and domain expertise.', 60, 'Be ready to explain your projects in detail, discuss trade-offs in your design decisions.'),
  ('Technical Interview Round 2', 'technical_interview', 'All', 'hard', 'System design and architecture discussion for senior roles.', 90, 'Study system design patterns, scalability, and distributed systems concepts.'),
  ('HR Interview', 'hr_interview', 'All', 'easy', 'Behavioral questions, cultural fit assessment, and discussion about role expectations.', 30, 'Prepare STAR format answers, research company culture, and be genuine.')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 8: CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to get all test patterns for a job
CREATE OR REPLACE FUNCTION get_job_test_patterns(job_id uuid)
RETURNS TABLE (
  test_pattern_id uuid,
  test_name text,
  test_type text,
  difficulty_level text,
  description text,
  duration_minutes integer,
  is_mandatory boolean,
  display_order integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tp.id,
    tp.test_name,
    tp.test_type,
    tp.difficulty_level,
    tp.description,
    tp.duration_minutes,
    jtp.is_mandatory,
    jtp.display_order
  FROM test_patterns tp
  INNER JOIN job_test_patterns jtp ON tp.id = jtp.test_pattern_id
  WHERE jtp.job_listing_id = job_id
    AND tp.is_active = true
  ORDER BY jtp.display_order ASC, tp.test_type ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update job has_referral flag based on referral fields
CREATE OR REPLACE FUNCTION update_job_referral_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically set has_referral to true if any referral field is populated
  IF NEW.referral_person_name IS NOT NULL
     OR NEW.referral_email IS NOT NULL
     OR NEW.referral_code IS NOT NULL
     OR NEW.referral_link IS NOT NULL THEN
    NEW.has_referral := true;
  ELSE
    NEW.has_referral := false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update has_referral flag
DROP TRIGGER IF EXISTS trigger_update_job_referral_status ON job_listings;
CREATE TRIGGER trigger_update_job_referral_status
  BEFORE INSERT OR UPDATE ON job_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_job_referral_status();

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Referral and Test Patterns system created successfully!';
  RAISE NOTICE '📋 Added referral contact fields to job_listings';
  RAISE NOTICE '🧪 Created test_patterns table with sample data';
  RAISE NOTICE '🔗 Created job_test_patterns junction table';
  RAISE NOTICE '🔒 RLS policies configured for admin access';
  RAISE NOTICE '⚡ Performance indexes created';
END $$;
