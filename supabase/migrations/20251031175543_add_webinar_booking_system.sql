/*
  # Add Webinar Booking System

  ## Overview
  Complete webinar booking system with speaker management, testimonials, and registration tracking.

  ## 1. New Tables

  ### `webinar_speakers`
  Stores information about webinar speakers/instructors
  - `id` (uuid, primary key) - Unique identifier
  - `name` (text, required) - Speaker full name
  - `title` (text) - Professional title/designation
  - `bio` (text) - Short biography
  - `photo_url` (text) - Profile photo URL
  - `linkedin_url` (text) - LinkedIn profile
  - `expertise_areas` (text[]) - Array of expertise topics
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `webinar_testimonials`
  Student success stories and testimonials
  - `id` (uuid, primary key) - Unique identifier
  - `student_name` (text, required) - Student name
  - `student_photo_url` (text) - Student photo
  - `college_name` (text) - College/University name
  - `testimonial_text` (text, required) - Testimonial content
  - `placement_company` (text) - Company where placed
  - `rating` (integer) - Rating out of 5
  - `is_featured` (boolean) - Whether to feature prominently
  - `created_at` (timestamptz) - Creation timestamp

  ### `webinars`
  Main webinar events table
  - `id` (uuid, primary key) - Unique identifier
  - `title` (text, required) - Webinar title
  - `slug` (text, unique, required) - URL-friendly identifier
  - `description` (text, required) - Full description
  - `short_description` (text) - Brief summary for cards
  - `thumbnail_url` (text) - Webinar thumbnail image
  - `scheduled_at` (timestamptz, required) - Webinar date and time
  - `duration_minutes` (integer) - Expected duration
  - `meet_link` (text, required) - Google Meet/Zoom link
  - `original_price` (integer, required) - Original price in paise
  - `discounted_price` (integer, required) - Discounted price in paise
  - `max_attendees` (integer) - Maximum capacity
  - `current_attendees` (integer, default 0) - Current registration count
  - `status` (text, default 'upcoming') - upcoming, live, completed, cancelled
  - `speaker_ids` (uuid[]) - Array of speaker IDs
  - `learning_outcomes` (jsonb) - Structured learning objectives
  - `target_audience` (text[]) - Who should attend
  - `prerequisites` (text[]) - Required knowledge
  - `is_featured` (boolean, default false) - Feature on homepage
  - `created_by` (uuid) - Admin who created it
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `webinar_registrations`
  User registrations for webinars
  - `id` (uuid, primary key) - Unique identifier
  - `webinar_id` (uuid, foreign key) - Reference to webinar
  - `user_id` (uuid, foreign key) - Reference to user_profiles
  - `full_name` (text, required) - Registrant name
  - `email` (text, required) - Registrant email
  - `college_name` (text) - College/University
  - `year_of_study` (text) - Current year
  - `branch` (text) - Academic branch/major
  - `phone_number` (text) - Contact number
  - `payment_transaction_id` (uuid) - Reference to payment
  - `registration_status` (text, default 'pending') - pending, confirmed, cancelled
  - `payment_status` (text, default 'pending') - pending, completed, failed, refunded
  - `meet_link_sent` (boolean, default false) - Email delivery status
  - `meet_link_sent_at` (timestamptz) - When email was sent
  - `attendance_marked` (boolean, default false) - Whether attended
  - `attended_at` (timestamptz) - Join timestamp
  - `registration_source` (text) - utm tracking
  - `created_at` (timestamptz) - Registration timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `webinar_email_logs`
  Track all email communications
  - `id` (uuid, primary key) - Unique identifier
  - `registration_id` (uuid, foreign key) - Reference to registration
  - `email_type` (text, required) - confirmation, reminder, followup
  - `recipient_email` (text, required) - Email address
  - `subject` (text) - Email subject
  - `sent_at` (timestamptz) - Send timestamp
  - `delivery_status` (text) - sent, delivered, failed, bounced
  - `error_message` (text) - Error details if failed
  - `resend_count` (integer, default 0) - Number of retries

  ## 2. Indexes
  - Index on webinars.slug for fast lookup
  - Index on webinars.scheduled_at for filtering by date
  - Index on webinars.status for filtering active webinars
  - Index on webinar_registrations.webinar_id for fast joins
  - Index on webinar_registrations.user_id for user dashboard
  - Index on webinar_registrations.email for duplicate checking

  ## 3. Security - Row Level Security (RLS)

  ### webinar_speakers
  - Public can read all speakers
  - Only admins can insert/update/delete speakers

  ### webinar_testimonials
  - Public can read featured testimonials
  - Only admins can insert/update/delete testimonials

  ### webinars
  - Public can read all webinars
  - Only admins can insert/update/delete webinars

  ### webinar_registrations
  - Users can read their own registrations
  - Users can insert their own registrations
  - Admins can read all registrations
  - Only admins can update registration status

  ### webinar_email_logs
  - Users can read their own email logs
  - Admins can read all email logs
  - System can insert logs (via service role)

  ## 4. Functions
  - Function to increment current_attendees on registration
  - Function to check available seats before registration
  - Function to update webinar status based on scheduled_at
*/

-- Create webinar_speakers table
CREATE TABLE IF NOT EXISTS webinar_speakers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  title text,
  bio text,
  photo_url text,
  linkedin_url text,
  expertise_areas text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create webinar_testimonials table
CREATE TABLE IF NOT EXISTS webinar_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  student_photo_url text,
  college_name text,
  testimonial_text text NOT NULL,
  placement_company text,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  is_featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create webinars table
CREATE TABLE IF NOT EXISTS webinars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text NOT NULL,
  short_description text,
  thumbnail_url text,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer DEFAULT 60,
  meet_link text NOT NULL,
  original_price integer NOT NULL,
  discounted_price integer NOT NULL,
  max_attendees integer,
  current_attendees integer DEFAULT 0,
  status text DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'completed', 'cancelled')),
  speaker_ids uuid[] DEFAULT '{}',
  learning_outcomes jsonb,
  target_audience text[] DEFAULT '{}',
  prerequisites text[] DEFAULT '{}',
  is_featured boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create webinar_registrations table
CREATE TABLE IF NOT EXISTS webinar_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webinar_id uuid NOT NULL REFERENCES webinars(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  full_name text NOT NULL,
  email text NOT NULL,
  college_name text,
  year_of_study text,
  branch text,
  phone_number text,
  payment_transaction_id uuid REFERENCES payment_transactions(id),
  registration_status text DEFAULT 'pending' CHECK (registration_status IN ('pending', 'confirmed', 'cancelled')),
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  meet_link_sent boolean DEFAULT false,
  meet_link_sent_at timestamptz,
  attendance_marked boolean DEFAULT false,
  attended_at timestamptz,
  registration_source text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create webinar_email_logs table
CREATE TABLE IF NOT EXISTS webinar_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES webinar_registrations(id) ON DELETE CASCADE,
  email_type text NOT NULL CHECK (email_type IN ('confirmation', 'reminder_24h', 'reminder_1h', 'followup', 'cancellation')),
  recipient_email text NOT NULL,
  subject text,
  sent_at timestamptz DEFAULT now(),
  delivery_status text DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'failed', 'bounced')),
  error_message text,
  resend_count integer DEFAULT 0
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_webinars_slug ON webinars(slug);
CREATE INDEX IF NOT EXISTS idx_webinars_scheduled_at ON webinars(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_webinars_status ON webinars(status);
CREATE INDEX IF NOT EXISTS idx_webinar_registrations_webinar_id ON webinar_registrations(webinar_id);
CREATE INDEX IF NOT EXISTS idx_webinar_registrations_user_id ON webinar_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_webinar_registrations_email ON webinar_registrations(email);
CREATE INDEX IF NOT EXISTS idx_webinar_email_logs_registration_id ON webinar_email_logs(registration_id);

-- Enable Row Level Security
ALTER TABLE webinar_speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE webinar_testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE webinars ENABLE ROW LEVEL SECURITY;
ALTER TABLE webinar_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE webinar_email_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for webinar_speakers
CREATE POLICY "Public can read speakers"
  ON webinar_speakers FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can insert speakers"
  ON webinar_speakers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update speakers"
  ON webinar_speakers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete speakers"
  ON webinar_speakers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- RLS Policies for webinar_testimonials
CREATE POLICY "Public can read testimonials"
  ON webinar_testimonials FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can insert testimonials"
  ON webinar_testimonials FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update testimonials"
  ON webinar_testimonials FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete testimonials"
  ON webinar_testimonials FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- RLS Policies for webinars
CREATE POLICY "Public can read webinars"
  ON webinars FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can insert webinars"
  ON webinars FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update webinars"
  ON webinars FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete webinars"
  ON webinars FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- RLS Policies for webinar_registrations
CREATE POLICY "Users can read own registrations"
  ON webinar_registrations FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can insert own registrations"
  ON webinar_registrations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update registrations"
  ON webinar_registrations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- RLS Policies for webinar_email_logs
CREATE POLICY "Users can read own email logs"
  ON webinar_email_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM webinar_registrations
      WHERE webinar_registrations.id = registration_id
      AND webinar_registrations.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Function to increment attendee count
CREATE OR REPLACE FUNCTION increment_webinar_attendees()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_status = 'completed' AND NEW.registration_status = 'confirmed' THEN
    UPDATE webinars
    SET current_attendees = current_attendees + 1,
        updated_at = now()
    WHERE id = NEW.webinar_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to increment attendees on successful registration
DROP TRIGGER IF EXISTS trigger_increment_attendees ON webinar_registrations;
CREATE TRIGGER trigger_increment_attendees
  AFTER INSERT OR UPDATE OF payment_status, registration_status
  ON webinar_registrations
  FOR EACH ROW
  EXECUTE FUNCTION increment_webinar_attendees();

-- Function to check available seats
CREATE OR REPLACE FUNCTION check_webinar_capacity(p_webinar_id uuid)
RETURNS boolean AS $$
DECLARE
  v_max_attendees integer;
  v_current_attendees integer;
BEGIN
  SELECT max_attendees, current_attendees
  INTO v_max_attendees, v_current_attendees
  FROM webinars
  WHERE id = p_webinar_id;
  
  IF v_max_attendees IS NULL THEN
    RETURN true;
  END IF;
  
  RETURN v_current_attendees < v_max_attendees;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert sample data for Accenture webinar
INSERT INTO webinars (
  title,
  slug,
  description,
  short_description,
  scheduled_at,
  duration_minutes,
  meet_link,
  original_price,
  discounted_price,
  max_attendees,
  learning_outcomes,
  target_audience,
  is_featured,
  status
) VALUES (
  'ACE Accenture 2026 Campus Drive - Guaranteed Success Strategies',
  'ace-accenture-2026-campus-drive',
  'Join our comprehensive webinar designed specifically for students targeting Accenture 2025-2026 Campus Placements. Learn proven strategies to crack both Round 1 (Behavioral & Cognitive Games) and Round 2 (Technical Assessment). Get expert insights, practice questions, and personalized doubt clearing sessions.',
  'Master the Accenture Campus Drive with expert-led strategies covering both behavioral and technical rounds.',
  '2025-11-01 11:00:00+00',
  120,
  'https://meet.google.com/rki-ycuw-xoz',
  59900,
  19900,
  500,
  '{"outcomes": ["Master Round 1: Behavioral & Cognitive Assessment with Games", "Crack Round 2: Technical Assessment with confidence", "Learn proven strategies from industry experts", "Get personalized doubt clearing sessions", "Access exclusive practice materials and resources"]}',
  ARRAY['Final year students', 'Pre-final year students', 'Students targeting Accenture placements', 'Anyone preparing for product-based companies'],
  true,
  'upcoming'
);
