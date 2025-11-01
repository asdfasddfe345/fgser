/*
  # Rename LinkedIn Message Credits to Profile Optimization Credits
  
  ## Overview
  This migration transforms the LinkedIn message generation feature into a LinkedIn Profile Optimization feature.
  
  ## Changes Made
  
  1. **Subscription Credits Renaming**
     - Rename `linkedin_messages_used` to `linkedin_optimizations_used`
     - Rename `linkedin_messages_total` to `linkedin_optimizations_total`
  
  2. **New Tables**
     - `linkedin_profile_optimizations`: Stores user profile optimization history
       - `id` (uuid, primary key)
       - `user_id` (uuid, foreign key to auth.users)
       - `original_profile_data` (jsonb, stores original profile sections)
       - `optimized_profile_data` (jsonb, stores optimized suggestions)
       - `target_role` (text, target job role)
       - `industry` (text, target industry)
       - `preferences` (jsonb, optimization preferences)
       - `created_at` (timestamptz)
       - `updated_at` (timestamptz)
  
  3. **Security**
     - Enable RLS on `linkedin_profile_optimizations` table
     - Add policy for authenticated users to read their own optimization history
     - Add policy for authenticated users to create new optimizations
     - Add policy for authenticated users to update their own optimizations
     - Add policy for authenticated users to delete their own optimizations
  
  ## Notes
  - All existing data is preserved with new column names
  - Backward compatibility maintained through column renaming
  - RLS policies ensure data privacy and security
*/

-- Step 1: Rename columns in subscriptions table
ALTER TABLE subscriptions 
  RENAME COLUMN linkedin_messages_used TO linkedin_optimizations_used;

ALTER TABLE subscriptions 
  RENAME COLUMN linkedin_messages_total TO linkedin_optimizations_total;

-- Step 2: Create linkedin_profile_optimizations table
CREATE TABLE IF NOT EXISTS linkedin_profile_optimizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_profile_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  optimized_profile_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_role text DEFAULT '',
  industry text DEFAULT '',
  preferences jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 3: Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_linkedin_profile_optimizations_user_id 
  ON linkedin_profile_optimizations(user_id);

CREATE INDEX IF NOT EXISTS idx_linkedin_profile_optimizations_created_at 
  ON linkedin_profile_optimizations(created_at DESC);

-- Step 4: Enable Row Level Security
ALTER TABLE linkedin_profile_optimizations ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS Policies

-- Policy: Users can read their own optimization history
CREATE POLICY "Users can read own linkedin profile optimizations"
  ON linkedin_profile_optimizations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can create new optimizations
CREATE POLICY "Users can create linkedin profile optimizations"
  ON linkedin_profile_optimizations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own optimizations
CREATE POLICY "Users can update own linkedin profile optimizations"
  ON linkedin_profile_optimizations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own optimizations
CREATE POLICY "Users can delete own linkedin profile optimizations"
  ON linkedin_profile_optimizations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Step 6: Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_linkedin_profile_optimizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger for auto-updating updated_at
CREATE TRIGGER trigger_update_linkedin_profile_optimizations_updated_at
  BEFORE UPDATE ON linkedin_profile_optimizations
  FOR EACH ROW
  EXECUTE FUNCTION update_linkedin_profile_optimizations_updated_at();