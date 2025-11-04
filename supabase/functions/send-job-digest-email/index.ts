import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { EmailService, logEmailSend } from '../_shared/emailService.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface JobDigestRequest {
  userId: string;
  recipientEmail: string;
  recipientName: string;
  jobs: Array<{
    job_id: string;
    company_name: string;
    role_title: string;
    domain: string;
    application_link: string;
    location_type?: string;
    package_amount?: number;
  }>;
  dateRange?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const emailData: JobDigestRequest = await req.json();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // If no jobs, don't send email
    if (!emailData.jobs || emailData.jobs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No jobs to send, email skipped',
          recipient: emailData.recipientEmail
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const dateRange = emailData.dateRange || 'Last 24 hours';
    const jobCount = emailData.jobs.length;
    const siteUrl = Deno.env.get('SITE_URL') || 'https://primoboost.ai';

    // Generate job cards HTML
    const jobCardsHtml = emailData.jobs.map((job, index) => `
      <div class="job-card">
        <div class="job-header">
          <h3 class="job-title">${job.role_title}</h3>
          <span class="job-company">${job.company_name}</span>
        </div>
        <div class="job-details">
          <div class="job-detail-item">
            <span class="detail-icon">🎯</span>
            <span>${job.domain}</span>
          </div>
          ${job.location_type ? `
          <div class="job-detail-item">
            <span class="detail-icon">📍</span>
            <span>${job.location_type}</span>
          </div>
          ` : ''}
          ${job.package_amount ? `
          <div class="job-detail-item">
            <span class="detail-icon">💰</span>
            <span>₹${job.package_amount.toLocaleString()}</span>
          </div>
          ` : ''}
        </div>
        <div class="job-actions">
          <a href="${job.application_link}" class="apply-button" target="_blank">
            Apply Now →
          </a>
          <a href="${siteUrl}/jobs/${job.job_id}" class="view-details" target="_blank">
            View Details
          </a>
        </div>
      </div>
    `).join('');

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Daily Job Digest</title>
  <style>
    body {
      font-family: 'Arial', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 650px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f4f4f4;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #f0f0f0;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 28px;
      font-weight: bold;
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .header p {
      margin: 0;
      color: #666;
      font-size: 14px;
    }
    .job-count-badge {
      display: inline-block;
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      color: white;
      padding: 8px 20px;
      border-radius: 20px;
      font-weight: bold;
      font-size: 14px;
      margin: 15px 0;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 25px;
      color: #555;
    }
    .job-card {
      background: #ffffff;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
      transition: all 0.3s ease;
    }
    .job-card:hover {
      border-color: #3b82f6;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
    }
    .job-header {
      margin-bottom: 15px;
    }
    .job-title {
      margin: 0 0 8px 0;
      font-size: 20px;
      color: #1f2937;
      font-weight: bold;
    }
    .job-company {
      color: #6b7280;
      font-size: 16px;
      font-weight: 500;
    }
    .job-details {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      margin: 15px 0;
      padding: 15px 0;
      border-top: 1px solid #e5e7eb;
      border-bottom: 1px solid #e5e7eb;
    }
    .job-detail-item {
      display: flex;
      align-items: center;
      font-size: 14px;
      color: #4b5563;
    }
    .detail-icon {
      margin-right: 6px;
      font-size: 16px;
    }
    .job-actions {
      display: flex;
      gap: 12px;
      margin-top: 15px;
    }
    .apply-button {
      display: inline-block;
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: bold;
      font-size: 14px;
      transition: all 0.3s ease;
    }
    .apply-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }
    .view-details {
      display: inline-block;
      background: transparent;
      color: #3b82f6;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: bold;
      font-size: 14px;
      border: 2px solid #3b82f6;
      transition: all 0.3s ease;
    }
    .view-details:hover {
      background: #3b82f6;
      color: white;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #f0f0f0;
      color: #777;
      font-size: 13px;
    }
    .footer a {
      color: #3b82f6;
      text-decoration: none;
    }
    .footer a:hover {
      text-decoration: underline;
    }
    .tip-box {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 20px;
      border-radius: 8px;
      margin: 25px 0;
    }
    .tip-box h3 {
      margin-top: 0;
      color: #1e40af;
      font-size: 16px;
    }
    .tip-box p {
      margin: 8px 0;
      color: #1e40af;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔔 Your Daily Job Digest</h1>
      <p>${dateRange}</p>
      <div class="job-count-badge">
        ${jobCount} New ${jobCount === 1 ? 'Job' : 'Jobs'} Matching Your Preferences
      </div>
    </div>
    
    <div class="greeting">
      <p>Hi ${emailData.recipientName},</p>
      <p>We found ${jobCount} exciting ${jobCount === 1 ? 'opportunity' : 'opportunities'} that match your preferences! Here's what's new:</p>
    </div>
    
    ${jobCardsHtml}
    
    <div class="tip-box">
      <h3>💡 Quick Tip:</h3>
      <p>Apply early to increase your chances! Employers often review applications in the order they receive them.</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${siteUrl}/jobs" class="apply-button" style="display: inline-block;">
        🔍 Browse All Jobs
      </a>
    </div>
    
    <div class="footer">
      <p><strong>PrimoBoost AI</strong> - Your Intelligent Career Companion</p>
      <p style="margin: 15px 0;">
        <a href="${siteUrl}/profile">Update Preferences</a> |
        <a href="${siteUrl}/settings">Manage Notifications</a>
      </p>
      <p style="margin-top: 15px; font-size: 12px; color: #999;">
        You're receiving this email because you subscribed to job notifications on PrimoBoost AI.<br>
        To unsubscribe, <a href="${siteUrl}/unsubscribe?token=${emailData.userId}">click here</a>.
      </p>
    </div>
  </div>
</body>
</html>
    `;

    console.log(`Sending job digest email to: ${emailData.recipientEmail}`);
    console.log(`Number of jobs: ${jobCount}`);
    console.log(`User ID: ${emailData.userId}`);

    const emailService = new EmailService();
    const subject = `🔔 ${jobCount} New ${jobCount === 1 ? 'Job' : 'Jobs'} Matching Your Preferences`;

    const result = await emailService.sendEmail({
      to: emailData.recipientEmail,
      subject: subject,
      html: emailHtml,
    });

    const emailStatus = result.success ? 'sent' : 'failed';

    // Log email send
    await logEmailSend(
      supabase,
      emailData.userId,
      'job_digest',
      emailData.recipientEmail,
      subject,
      emailStatus,
      result.error
    );

    if (result.success) {
      // Log each job notification
      for (const job of emailData.jobs) {
        await supabase.rpc('log_notification_send', {
          p_user_id: emailData.userId,
          p_job_id: job.job_id,
          p_email_status: emailStatus,
          p_notification_type: 'daily_digest'
        }).catch(err => console.error('Error logging notification:', err));
      }

      // Update last sent timestamp
      await supabase.rpc('update_subscription_last_sent', {
        p_user_id: emailData.userId
      }).catch(err => console.error('Error updating last sent:', err));
    }

    if (!result.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
          message: 'Failed to send job digest email'
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Job digest email sent successfully',
        recipient: emailData.recipientEmail,
        jobCount: jobCount,
        userId: emailData.userId,
        messageId: result.messageId
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error sending job digest email:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to send job digest email'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});