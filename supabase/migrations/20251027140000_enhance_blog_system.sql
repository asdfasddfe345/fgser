/*
  # Enhance Blog System with Advanced Features

  1. Table Modifications
    - Add reading_difficulty to blog_posts (beginner/intermediate/advanced)
    - Add is_featured flag for highlighting top blog posts
    - Add estimated_reading_time field (minutes)
    - Add trending_score for algorithm-based sorting
    - Add last_trending_update for cache management

  2. New Tables
    - `blog_user_interactions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `blog_post_id` (uuid, foreign key to blog_posts)
      - `interaction_type` (text: viewed/bookmarked/completed)
      - `reading_progress` (integer 0-100)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `blog_user_preferences`
      - `id` (uuid, primary key)
      - `user_id` (uuid, unique, foreign key to auth.users)
      - `favorite_categories` (text array)
      - `preferred_difficulty` (text)
      - `topics_of_interest` (text array)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  3. Security
    - Enable RLS on new tables
    - Users can view their own interactions and preferences
    - Users can create/update their own interactions and preferences

  4. Indexes
    - Index on blog_posts.reading_difficulty
    - Index on blog_posts.is_featured
    - Index on blog_posts.trending_score
    - Index on blog_user_interactions user and post IDs
*/

-- Add new columns to blog_posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'blog_posts' AND column_name = 'reading_difficulty'
  ) THEN
    ALTER TABLE blog_posts ADD COLUMN reading_difficulty text DEFAULT 'intermediate' CHECK (reading_difficulty IN ('beginner', 'intermediate', 'advanced'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'blog_posts' AND column_name = 'is_featured'
  ) THEN
    ALTER TABLE blog_posts ADD COLUMN is_featured boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'blog_posts' AND column_name = 'estimated_reading_time'
  ) THEN
    ALTER TABLE blog_posts ADD COLUMN estimated_reading_time integer DEFAULT 5;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'blog_posts' AND column_name = 'trending_score'
  ) THEN
    ALTER TABLE blog_posts ADD COLUMN trending_score numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'blog_posts' AND column_name = 'last_trending_update'
  ) THEN
    ALTER TABLE blog_posts ADD COLUMN last_trending_update timestamptz DEFAULT now();
  END IF;
END $$;

-- Create blog_user_interactions table
CREATE TABLE IF NOT EXISTS blog_user_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  blog_post_id uuid REFERENCES blog_posts(id) ON DELETE CASCADE NOT NULL,
  interaction_type text NOT NULL CHECK (interaction_type IN ('viewed', 'bookmarked', 'completed')),
  reading_progress integer DEFAULT 0 CHECK (reading_progress >= 0 AND reading_progress <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, blog_post_id, interaction_type)
);

-- Create blog_user_preferences table
CREATE TABLE IF NOT EXISTS blog_user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  favorite_categories text[] DEFAULT '{}',
  preferred_difficulty text DEFAULT 'intermediate' CHECK (preferred_difficulty IN ('beginner', 'intermediate', 'advanced')),
  topics_of_interest text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_reading_difficulty ON blog_posts(reading_difficulty);
CREATE INDEX IF NOT EXISTS idx_blog_posts_is_featured ON blog_posts(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_blog_posts_trending_score ON blog_posts(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_blog_user_interactions_user_id ON blog_user_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_blog_user_interactions_blog_post_id ON blog_user_interactions(blog_post_id);
CREATE INDEX IF NOT EXISTS idx_blog_user_interactions_type ON blog_user_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_blog_user_preferences_user_id ON blog_user_preferences(user_id);

-- Enable Row Level Security
ALTER TABLE blog_user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_user_preferences ENABLE ROW LEVEL SECURITY;

-- Blog User Interactions Policies
CREATE POLICY "Users can view their own interactions"
  ON blog_user_interactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own interactions"
  ON blog_user_interactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own interactions"
  ON blog_user_interactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own interactions"
  ON blog_user_interactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Blog User Preferences Policies
CREATE POLICY "Users can view their own preferences"
  ON blog_user_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON blog_user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON blog_user_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences"
  ON blog_user_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp for interactions
CREATE OR REPLACE FUNCTION update_blog_interaction_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for blog_user_interactions updated_at
DROP TRIGGER IF EXISTS update_blog_user_interactions_updated_at ON blog_user_interactions;
CREATE TRIGGER update_blog_user_interactions_updated_at
  BEFORE UPDATE ON blog_user_interactions
  FOR EACH ROW
  EXECUTE FUNCTION update_blog_interaction_updated_at();

-- Create function to automatically update updated_at timestamp for preferences
CREATE OR REPLACE FUNCTION update_blog_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for blog_user_preferences updated_at
DROP TRIGGER IF EXISTS update_blog_user_preferences_updated_at ON blog_user_preferences;
CREATE TRIGGER update_blog_user_preferences_updated_at
  BEFORE UPDATE ON blog_user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_blog_preferences_updated_at();

-- Create function to calculate trending score
CREATE OR REPLACE FUNCTION calculate_blog_trending_score(post_id uuid)
RETURNS numeric AS $$
DECLARE
  view_count_val integer;
  post_age_days numeric;
  trending_score_val numeric;
BEGIN
  SELECT
    view_count,
    EXTRACT(EPOCH FROM (now() - published_at)) / 86400.0
  INTO view_count_val, post_age_days
  FROM blog_posts
  WHERE id = post_id;

  -- Trending score formula: views / (age_in_days + 2)^1.5
  -- This gives more weight to recent posts with high views
  IF post_age_days IS NOT NULL AND view_count_val IS NOT NULL THEN
    trending_score_val := view_count_val / POWER(post_age_days + 2, 1.5);
  ELSE
    trending_score_val := 0;
  END IF;

  RETURN trending_score_val;
END;
$$ LANGUAGE plpgsql;

-- Create function to update trending scores (can be called periodically)
CREATE OR REPLACE FUNCTION update_all_trending_scores()
RETURNS void AS $$
BEGIN
  UPDATE blog_posts
  SET
    trending_score = calculate_blog_trending_score(id),
    last_trending_update = now()
  WHERE status = 'published' AND published_at <= now();
END;
$$ LANGUAGE plpgsql;

-- Create function to increment view count (alternative to the existing one)
CREATE OR REPLACE FUNCTION increment_blog_view_count(post_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE blog_posts
  SET
    view_count = view_count + 1,
    trending_score = calculate_blog_trending_score(post_id)
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;

-- Update trending scores for all existing posts
SELECT update_all_trending_scores();
