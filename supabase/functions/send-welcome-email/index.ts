import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { EmailService, logEmailSend } from '../_shared/emailService.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WelcomeEmailRequest {
  userId: string;
  recipientEmail: string;
  recipientName: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const emailData: WelcomeEmailRequest = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to PrimoBoost AI</title>
  <style>
    body {
      font-family: 'Arial', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
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
    }
    .header h1 {
      margin: 0;
      font-size: 32px;
      font-weight: bold;
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .logo {
      width: 80px;
      height: 80px;
      margin: 0 auto 20px;
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      color: white;
    }
    .greeting {
      font-size: 18px;
      margin-bottom: 20px;
      color: #555;
    }
    .content-section {
      background: #f8f9fa;
      padding: 25px;
      border-radius: 12px;
      margin: 25px 0;
      border-left: 4px solid #3b82f6;
    }
    .content-section h2 {
      margin-top: 0;
      color: #3b82f6;
      font-size: 20px;
    }
    .features-list {
      list-style: none;
      padding: 0;
      margin: 20px 0;
    }
    .features-list li {
      padding: 12px 0;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      align-items: center;
    }
    .features-list li:last-child {
      border-bottom: none;
    }
    .feature-icon {
      margin-right: 12px;
      font-size: 24px;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      color: white;
      padding: 15px 40px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: bold;
      font-size: 16px;
      margin: 10px 10px 10px 0;
      transition: all 0.3s ease;
    }
    .cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(59, 130, 246, 0.4);
    }
    .cta-section {
      text-align: center;
      margin: 30px 0;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #eee;
      color: #777;
      font-size: 14px;
    }
    .highlight-box {
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      color: white;
      padding: 25px;
      border-radius: 12px;
      margin: 25px 0;
      text-align: center;
    }
    .highlight-box h3 {
      margin-top: 0;
      font-size: 22px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">🚀</div>
    <div class="header">
      <h1>Welcome to PrimoBoost AI!</h1>
    </div>
    
    <div class="greeting">
      <p>Dear ${emailData.recipientName},</p>
      <p>Welcome aboard! 🎉</p>
      <p>We're thrilled to have you join PrimoBoost AI - your intelligent career companion powered by cutting-edge AI technology. You've just taken the first step towards landing your dream job!</p>
    </div>
    
    <div class="highlight-box">
      <h3>🎯 Your Success Journey Starts Now</h3>
      <p>PrimoBoost AI is designed to help you stand out from the crowd with AI-optimized resumes, personalized job recommendations, and smart application tools.</p>
    </div>
    
    <div class="content-section">
      <h2>🌟 What You Can Do With PrimoBoost AI:</h2>
      <ul class="features-list">
        <li>
          <span class="feature-icon">📄</span>
          <span><strong>AI-Optimized Resumes:</strong> Get your resume tailored for each job with our advanced AI engine</span>
        </li>
        <li>
          <span class="feature-icon">🎯</span>
          <span><strong>Smart Job Matching:</strong> Receive personalized job recommendations based on your skills and preferences</span>
        </li>
        <li>
          <span class="feature-icon">⚡</span>
          <span><strong>Auto-Apply Feature:</strong> Let AI handle job applications while you focus on interview prep</span>
        </li>
        <li>
          <span class="feature-icon">💼</span>
          <span><strong>Interview Practice:</strong> Prepare with AI-powered mock interviews tailored to your target roles</span>
        </li>
        <li>
          <span class="feature-icon">📊</span>
          <span><strong>Application Tracking:</strong> Monitor all your applications in one convenient dashboard</span>
        </li>
        <li>
          <span class="feature-icon">🔔</span>
          <span><strong>Job Alerts:</strong> Get daily digest emails with jobs matching your preferences</span>
        </li>
      </ul>
    </div>
    
    <div class="content-section">
      <h2>🚀 Quick Start Guide:</h2>
      <ol style="margin: 15px 0; padding-left: 25px;">
        <li style="margin: 10px 0;"><strong>Complete Your Profile:</strong> Add your education, experience, and skills</li>
        <li style="margin: 10px 0;"><strong>Set Job Preferences:</strong> Choose domains and enable job notifications</li>
        <li style="margin: 10px 0;"><strong>Browse Jobs:</strong> Explore thousands of opportunities tailored for you</li>
        <li style="margin: 10px 0;"><strong>Apply Smart:</strong> Use AI-optimized resumes or auto-apply features</li>
        <li style="margin: 10px 0;"><strong>Track Progress:</strong> Monitor your applications and get hired!</li>
      </ol>
    </div>
    
    <div class="cta-section">
      <a href="${Deno.env.get('SITE_URL') || 'https://primoboost.ai'}/profile" class="cta-button">
        ✨ Complete Your Profile
      </a>
      <a href="${Deno.env.get('SITE_URL') || 'https://primoboost.ai'}/jobs" class="cta-button">
        🔍 Browse Jobs
      </a>
    </div>
    
    <div class="content-section" style="border-left-color: #10b981; background: #ecfdf5;">
      <h2 style="color: #10b981;">💡 Pro Tips:</h2>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li style="margin: 8px 0;">Keep your profile updated with latest skills and projects</li>
        <li style="margin: 8px 0;">Enable job notifications to never miss matching opportunities</li>
        <li style="margin: 8px 0;">Use AI resume optimization for each job application</li>
        <li style="margin: 8px 0;">Practice with mock interviews before the real thing</li>
        <li style="margin: 8px 0;">Apply to multiple jobs to increase your chances</li>
      </ul>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <p style="font-size: 16px; color: #555;">
        Ready to accelerate your career? Let's get started! 🚀
      </p>
    </div>
    
    <div class="footer">
      <p><strong>Need Help?</strong></p>
      <p>If you have any questions or need assistance, our support team is here to help. Just reply to this email!</p>
      <p style="margin-top: 20px;">
        Best regards,<br>
        <strong>The PrimoBoost AI Team</strong>
      </p>
      <p style="margin-top: 20px; font-size: 12px; color: #999;">
        You're receiving this email because you signed up for PrimoBoost AI.<br>
        If you didn't create this account, please ignore this email.
      </p>
    </div>
  </div>
</body>
</html>
    `;

    console.log('Sending welcome email to:', emailData.recipientEmail);
    console.log('User ID:', emailData.userId);
    console.log('Recipient Name:', emailData.recipientName);

    const emailService = new EmailService();
    const subject = 'Welcome to PrimoBoost AI!';

    const result = await emailService.sendEmail({
      to: emailData.recipientEmail,
      subject: subject,
      html: emailHtml,
    });

    await logEmailSend(
      supabase,
      emailData.userId,
      'welcome',
      emailData.recipientEmail,
      subject,
      result.success ? 'sent' : 'failed',
      result.error
    );

    if (!result.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
          message: 'Failed to send welcome email'
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
        message: 'Welcome email sent successfully',
        recipient: emailData.recipientEmail,
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
    console.error('Error sending welcome email:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to send welcome email'
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