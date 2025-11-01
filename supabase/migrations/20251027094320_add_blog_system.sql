/*
  # Add SEO-Optimized Blog System

  1. New Tables
    - `blog_posts`
      - `id` (uuid, primary key)
      - `title` (text, required) - Main heading of blog post
      - `slug` (text, unique, required) - SEO-friendly URL
      - `excerpt` (text) - Short summary/preview
      - `body_content` (text, required) - Full article content
      - `featured_image_url` (text) - Main image URL
      - `author_id` (uuid, foreign key to auth.users)
      - `author_name` (text) - Display name
      - `status` (text, enum: draft/published/scheduled)
      - `published_at` (timestamptz)
      - `meta_title` (text) - SEO title
      - `meta_description` (text) - SEO description
      - `view_count` (integer, default 0)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `blog_categories`
      - `id` (uuid, primary key)
      - `name` (text, unique, required)
      - `slug` (text, unique, required)
      - `description` (text)
      - `created_at` (timestamptz)
    
    - `blog_tags`
      - `id` (uuid, primary key)
      - `name` (text, unique, required)
      - `slug` (text, unique, required)
      - `created_at` (timestamptz)
    
    - `blog_post_categories` (junction table)
      - `blog_post_id` (uuid, foreign key)
      - `blog_category_id` (uuid, foreign key)
      - Primary key on both columns
    
    - `blog_post_tags` (junction table)
      - `blog_post_id` (uuid, foreign key)
      - `blog_tag_id` (uuid, foreign key)
      - Primary key on both columns

  2. Security
    - Enable RLS on all blog tables
    - Public can read published blog posts
    - Only authenticated admins can create/update/delete posts
    - Categories and tags are publicly readable
    - Only admins can manage categories and tags

  3. Indexes
    - Index on blog_posts.slug for fast lookups
    - Index on blog_posts.status for filtering
    - Index on blog_posts.published_at for sorting
    - Full-text search index on title and body_content
*/

-- Create blog_posts table
CREATE TABLE IF NOT EXISTS blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  excerpt text,
  body_content text NOT NULL,
  featured_image_url text,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'scheduled')),
  published_at timestamptz,
  meta_title text,
  meta_description text,
  view_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create blog_categories table
CREATE TABLE IF NOT EXISTS blog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create blog_tags table
CREATE TABLE IF NOT EXISTS blog_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create blog_post_categories junction table
CREATE TABLE IF NOT EXISTS blog_post_categories (
  blog_post_id uuid REFERENCES blog_posts(id) ON DELETE CASCADE,
  blog_category_id uuid REFERENCES blog_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (blog_post_id, blog_category_id)
);

-- Create blog_post_tags junction table
CREATE TABLE IF NOT EXISTS blog_post_tags (
  blog_post_id uuid REFERENCES blog_posts(id) ON DELETE CASCADE,
  blog_tag_id uuid REFERENCES blog_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (blog_post_id, blog_tag_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_author_id ON blog_posts(author_id);

-- Create full-text search index
CREATE INDEX IF NOT EXISTS idx_blog_posts_search ON blog_posts USING gin(to_tsvector('english', title || ' ' || COALESCE(body_content, '')));

-- Enable Row Level Security
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_tags ENABLE ROW LEVEL SECURITY;

-- Blog Posts Policies
CREATE POLICY "Anyone can view published blog posts"
  ON blog_posts FOR SELECT
  TO public
  USING (status = 'published' AND published_at <= now());

CREATE POLICY "Authenticated admins can view all blog posts"
  ON blog_posts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'primoboostai@gmail.com'
    )
  );

CREATE POLICY "Only admins can insert blog posts"
  ON blog_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'primoboostai@gmail.com'
    )
  );

CREATE POLICY "Only admins can update blog posts"
  ON blog_posts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'primoboostai@gmail.com'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'primoboostai@gmail.com'
    )
  );

CREATE POLICY "Only admins can delete blog posts"
  ON blog_posts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'primoboostai@gmail.com'
    )
  );

-- Blog Categories Policies
CREATE POLICY "Anyone can view blog categories"
  ON blog_categories FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Only admins can insert blog categories"
  ON blog_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'primoboostai@gmail.com'
    )
  );

CREATE POLICY "Only admins can update blog categories"
  ON blog_categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'primoboostai@gmail.com'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'primoboostai@gmail.com'
    )
  );

CREATE POLICY "Only admins can delete blog categories"
  ON blog_categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'primoboostai@gmail.com'
    )
  );

-- Blog Tags Policies
CREATE POLICY "Anyone can view blog tags"
  ON blog_tags FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Only admins can insert blog tags"
  ON blog_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'primoboostai@gmail.com'
    )
  );

CREATE POLICY "Only admins can update blog tags"
  ON blog_tags FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'primoboostai@gmail.com'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'primoboostai@gmail.com'
    )
  );

CREATE POLICY "Only admins can delete blog tags"
  ON blog_tags FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'primoboostai@gmail.com'
    )
  );

-- Junction Tables Policies (follow parent table permissions)
CREATE POLICY "Anyone can view blog post categories"
  ON blog_post_categories FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Only admins can manage blog post categories"
  ON blog_post_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'primoboostai@gmail.com'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'primoboostai@gmail.com'
    )
  );

CREATE POLICY "Anyone can view blog post tags"
  ON blog_post_tags FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Only admins can manage blog post tags"
  ON blog_post_tags FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'primoboostai@gmail.com'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'primoboostai@gmail.com'
    )
  );

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_blog_post_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_blog_posts_updated_at ON blog_posts;
CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_blog_post_updated_at();

-- Insert default categories
INSERT INTO blog_categories (name, slug, description) VALUES
  ('Resume Tips', 'resume-tips', 'Expert advice on creating and optimizing resumes'),
  ('Career Advice', 'career-advice', 'Professional guidance for career growth and development'),
  ('Interview Preparation', 'interview-preparation', 'Tips and strategies for acing job interviews'),
  ('Job Search', 'job-search', 'Strategies and tools for effective job hunting')
ON CONFLICT (slug) DO NOTHING;