# Email System Setup and Testing Guide

This guide will help you configure and test the email functionality in PrimoBoost AI.

## Overview

The email system uses Gmail SMTP with nodemailer to send emails for:
- Welcome emails (when users sign up)
- Job digest emails (daily/weekly job notifications)
- Webinar confirmation emails
- Redemption notification emails (to admin)

## Prerequisites

- A Gmail account (or other SMTP email provider)
- Access to Supabase project dashboard
- Admin access to PrimoBoost AI platform

## Step 1: Generate Gmail App Password

For Gmail, you need to create an **App-Specific Password** (not your regular Gmail password):

1. Go to your [Google Account Security Settings](https://myaccount.google.com/security)
2. Enable **2-Step Verification** if not already enabled
3. Go to [App Passwords](https://myaccount.google.com/apppasswords)
4. Select "Mail" as the app and "Other" as the device
5. Name it "PrimoBoost AI Email Service"
6. Click **Generate**
7. Copy the 16-character password (you won't see it again)

## Step 2: Configure Supabase Environment Variables

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Edge Functions** → **Secrets**
3. Add the following environment variables:

```bash
# Required SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_specific_password_here
SMTP_FROM=noreply@primoboost.ai
HR_EMAIL=primoboostai@gmail.com
SITE_URL=https://your-domain.com

# Already configured (should exist)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Important Notes:**
- Use the App-Specific Password from Step 1, not your regular Gmail password
- `SMTP_FROM` is optional and will default to `SMTP_USER` if not set
- `SITE_URL` is used for links in email templates

## Step 3: Deploy Edge Functions

The email functions need to be deployed to Supabase. They are located in:
- `supabase/functions/send-welcome-email/`
- `supabase/functions/send-job-digest-email/`
- `supabase/functions/send-webinar-confirmation-email/`
- `supabase/functions/send-redemption-email/`
- `supabase/functions/test-email/`

These functions will automatically use the SMTP configuration you set in Step 2.

## Step 4: Test Email Functionality

### Method 1: Using Admin Panel (Recommended)

1. Log in as an admin user
2. Navigate to Admin Panel → Email Testing
3. Enter your email address
4. Select an email type (Welcome, Job Digest, Webinar Confirmation, or Redemption)
5. Click "Send Test Email"
6. Check your inbox for the test email

### Method 2: Using API Endpoint Directly

You can test emails using curl or Postman:

```bash
# Test welcome email
curl -X POST "https://your-project.supabase.co/functions/v1/test-email" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your@email.com",
    "emailType": "welcome",
    "testData": {
      "name": "Test User"
    }
  }'

# Test job digest email
curl -X POST "https://your-project.supabase.co/functions/v1/test-email" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your@email.com",
    "emailType": "job_digest",
    "testData": {
      "name": "Test User",
      "jobCount": 5
    }
  }'
```

## Step 5: Monitor Email Logs

### View Email Logs in Admin Panel

1. Go to Admin Panel → Email Testing
2. Scroll down to "Recent Email Logs"
3. View:
   - Email status (sent/failed)
   - Email type
   - Recipient
   - Subject
   - Timestamp

### Query Email Logs Directly

```sql
-- View recent email logs
SELECT * FROM email_logs
ORDER BY created_at DESC
LIMIT 50;

-- View email statistics
SELECT * FROM get_email_statistics(30);

-- View failed emails
SELECT * FROM email_logs
WHERE status = 'failed'
ORDER BY created_at DESC;
```

## Troubleshooting

### Emails Not Sending

**Check SMTP Credentials:**
- Verify `SMTP_USER` and `SMTP_PASS` are correct
- Ensure you're using the App-Specific Password, not your regular password
- Confirm 2-Step Verification is enabled on your Gmail account

**Check SMTP Connection:**
- Test the connection using the admin panel
- If connection fails, check if Gmail has blocked the login attempt
- Go to [Gmail Security](https://myaccount.google.com/lesssecureapps) and check recent activity

**Check Supabase Logs:**
```bash
# View Edge Function logs
supabase functions logs send-welcome-email
supabase functions logs test-email
```

### Gmail Blocking Emails

If Gmail blocks emails or marks them as spam:

1. **Add SPF Record** (if using custom domain):
   ```
   v=spf1 include:_spf.google.com ~all
   ```

2. **Add DKIM Record** (if using custom domain):
   - Set up DKIM in Google Workspace Admin Console
   - Add the DKIM TXT record to your domain's DNS

3. **Warm Up Your Email**:
   - Start by sending a few test emails
   - Gradually increase volume over several days
   - Don't send bulk emails immediately

### Emails in Spam Folder

To improve deliverability:

1. **Use a Custom Domain**: Instead of `smtp.gmail.com`, use a custom domain with proper SPF/DKIM records
2. **Add Plain Text Version**: All emails include both HTML and plain text versions
3. **Avoid Spam Triggers**: Don't use excessive caps, exclamation marks, or spam keywords
4. **Include Unsubscribe Link**: All marketing emails should have an unsubscribe option

### Error: "Failed to send email"

**Check Environment Variables:**
```sql
-- Verify environment variables are set in Supabase
-- Go to Supabase Dashboard → Settings → Edge Functions → Secrets
```

**Common Issues:**
- Missing `SMTP_PASS` variable
- Wrong port number (use 587 for TLS, 465 for SSL)
- Firewall blocking SMTP connections
- Gmail account not allowing less secure apps

## Email Templates

Email templates are stored in:
- `supabase/functions/send-welcome-email/index.ts`
- `supabase/functions/send-job-digest-email/index.ts`
- `supabase/functions/send-webinar-confirmation-email/index.ts`
- `supabase/functions/send-redemption-email/index.ts`

To customize templates:
1. Edit the HTML content in the respective function file
2. Redeploy the Edge Function
3. Test the changes using the admin panel

## Production Considerations

### Security

- **Never commit** SMTP credentials to git
- Use Supabase Secrets for storing credentials
- Rotate SMTP passwords periodically
- Use TLS encryption (port 587)

### Rate Limiting

Gmail has sending limits:
- **Free Gmail**: 500 emails per day
- **Google Workspace**: 2,000 emails per day

To handle higher volumes:
- Use a dedicated email service (SendGrid, Amazon SES, Mailgun)
- Implement email queue system (already included)
- Batch emails and spread them over time

### Monitoring

Set up monitoring for:
- Email delivery failures
- Bounce rates
- Spam complaints
- SMTP connection errors

Use the email logs and statistics in the admin panel to track performance.

## Advanced Configuration

### Using a Different SMTP Provider

To use Outlook, custom SMTP, or other providers:

```bash
# Outlook/Office 365
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your@outlook.com
SMTP_PASS=your_password

# Custom SMTP server
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your_password
```

### Email Queue Processing

The system includes an email queue for retry logic:

```sql
-- View pending emails in queue
SELECT * FROM email_queue
WHERE status = 'pending'
AND scheduled_for <= now();

-- Process email queue (runs automatically)
SELECT * FROM get_pending_emails(10);
```

## Support

If you encounter issues:

1. Check this documentation
2. Review Supabase Edge Function logs
3. Check email logs in admin panel
4. Verify SMTP credentials
5. Test with the test-email function

For additional help, contact the development team or check:
- Supabase Documentation: https://supabase.com/docs
- Nodemailer Documentation: https://nodemailer.com/
- Gmail SMTP Settings: https://support.google.com/mail/answer/7126229
