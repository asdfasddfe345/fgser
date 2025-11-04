/*
  # Add Email Queue and Templates Tables

  1. New Tables
    - `email_queue` - Manages queued emails for batch processing and retry logic
    - `email_templates` - Stores customizable email templates

  2. Functions
    - `get_pending_emails` - Get pending emails from queue
    - `update_email_queue_status` - Update email queue status
    - `get_email_statistics` - Get email delivery statistics

  3. Security
    - Enable RLS on both tables
    - Admin-only access to email_queue
    - Service role can manage queue
*/

-- Create email_queue table
CREATE TABLE IF NOT EXISTS email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type text NOT NULL,
  recipient_email text NOT NULL,
  email_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority integer DEFAULT 0,
  scheduled_for timestamptz DEFAULT now(),
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

-- Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text UNIQUE NOT NULL,
  subject text NOT NULL,
  html_content text NOT NULL,
  text_content text,
  variables jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_queue_user_id ON email_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled_for ON email_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_email_queue_priority ON email_queue(priority DESC);

-- Enable RLS
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_queue
CREATE POLICY "Only admins can view email queue"
  ON email_queue FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Service role can manage email queue"
  ON email_queue FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for email_templates
CREATE POLICY "Anyone can view active email templates"
  ON email_templates FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage email templates"
  ON email_templates FOR ALL
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

-- Function to get email statistics
CREATE OR REPLACE FUNCTION get_email_statistics(
  p_user_id uuid DEFAULT NULL,
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  email_type text,
  total_sent bigint,
  total_failed bigint,
  success_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    el.email_type,
    COUNT(*) FILTER (WHERE el.status = 'sent') as total_sent,
    COUNT(*) FILTER (WHERE el.status = 'failed') as total_failed,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(*) FILTER (WHERE el.status = 'sent')::numeric / COUNT(*)::numeric) * 100, 2)
      ELSE 0
    END as success_rate
  FROM email_logs el
  WHERE 
    el.created_at >= now() - (p_days || ' days')::interval
    AND (p_user_id IS NULL OR el.user_id = p_user_id)
  GROUP BY el.email_type
  ORDER BY total_sent DESC;
END;
$$;

-- Function to process email queue (returns pending emails)
CREATE OR REPLACE FUNCTION get_pending_emails(
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email_type text,
  recipient_email text,
  email_data jsonb,
  attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    eq.id,
    eq.user_id,
    eq.email_type,
    eq.recipient_email,
    eq.email_data,
    eq.attempts
  FROM email_queue eq
  WHERE 
    eq.status = 'pending'
    AND eq.scheduled_for <= now()
    AND eq.attempts < eq.max_attempts
  ORDER BY eq.priority DESC, eq.scheduled_for ASC
  LIMIT p_limit;
END;
$$;

-- Function to update email queue status
CREATE OR REPLACE FUNCTION update_email_queue_status(
  p_queue_id uuid,
  p_status text,
  p_error_message text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE email_queue
  SET
    status = p_status,
    error_message = p_error_message,
    attempts = attempts + 1,
    updated_at = now(),
    processed_at = CASE WHEN p_status IN ('sent', 'failed') THEN now() ELSE processed_at END
  WHERE id = p_queue_id;
  
  RETURN FOUND;
END;
$$;

-- Insert default email templates
INSERT INTO email_templates (template_name, subject, html_content, text_content, variables) VALUES
('welcome', 'Welcome to PrimoBoost AI!', 
 '<h1>Welcome {{name}}!</h1><p>Thanks for joining PrimoBoost AI.</p>', 
 'Welcome {{name}}! Thanks for joining PrimoBoost AI.',
 '{"name": "string"}'::jsonb)
ON CONFLICT (template_name) DO NOTHING;

INSERT INTO email_templates (template_name, subject, html_content, text_content, variables) VALUES
('job_digest', '🔔 {{job_count}} New Jobs Matching Your Preferences', 
 '<h1>Your Daily Job Digest</h1><p>Hi {{name}}, we found {{job_count}} jobs for you!</p>', 
 'Your Daily Job Digest: Hi {{name}}, we found {{job_count}} jobs for you!',
 '{"name": "string", "job_count": "number", "jobs": "array"}'::jsonb)
ON CONFLICT (template_name) DO NOTHING;

INSERT INTO email_templates (template_name, subject, html_content, text_content, variables) VALUES
('webinar_confirmation', 'Webinar Registration Confirmed - {{webinar_title}}', 
 '<h1>Registration Confirmed!</h1><p>You are registered for {{webinar_title}} on {{webinar_date}}.</p>', 
 'Registration Confirmed! You are registered for {{webinar_title}} on {{webinar_date}}.',
 '{"webinar_title": "string", "webinar_date": "string", "join_link": "string"}'::jsonb)
ON CONFLICT (template_name) DO NOTHING;

INSERT INTO email_templates (template_name, subject, html_content, text_content, variables) VALUES
('redemption', 'Your Redemption Code - PrimoBoost AI', 
 '<h1>Redemption Successful!</h1><p>Your code: {{redemption_code}}</p>', 
 'Redemption Successful! Your code: {{redemption_code}}',
 '{"redemption_code": "string", "amount": "number"}'::jsonb)
ON CONFLICT (template_name) DO NOTHING;