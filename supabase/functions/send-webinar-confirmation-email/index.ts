import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { EmailService, logEmailSend } from '../_shared/emailService.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailRequest {
  registrationId: string;
  recipientEmail: string;
  recipientName: string;
  webinarTitle: string;
  webinarDate: string;
  webinarTime: string;
  meetLink: string;
  duration: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const emailData: EmailRequest = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Webinar Confirmation</title>
  <style>
    body {
      font-family: 'Arial', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .header h1 {
      margin: 0;
      font-size: 32px;
      font-weight: bold;
    }
    .greeting {
      font-size: 18px;
      margin-bottom: 20px;
      color: #555;
    }
    .webinar-details {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      margin: 30px 0;
    }
    .webinar-details h2 {
      margin: 0 0 20px 0;
      font-size: 24px;
    }
    .detail-row {
      display: flex;
      align-items: center;
      margin: 15px 0;
      font-size: 16px;
    }
    .detail-icon {
      margin-right: 10px;
      font-size: 20px;
    }
    .meet-link {
      display: inline-block;
      background: white;
      color: #667eea;
      padding: 15px 40px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: bold;
      font-size: 16px;
      margin: 20px 0;
      transition: all 0.3s ease;
    }
    .meet-link:hover {
      background: #f0f0f0;
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    }
    .instructions {
      background: #f8f9fa;
      border-left: 4px solid #667eea;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .instructions h3 {
      margin-top: 0;
      color: #667eea;
    }
    .instructions ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    .instructions li {
      margin: 8px 0;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #eee;
      color: #777;
      font-size: 14px;
    }
    .success-badge {
      display: inline-block;
      background: #10b981;
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: bold;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Registration Confirmed!</h1>
    </div>
    
    <div class="success-badge">
      ✓ Payment Successful
    </div>
    
    <div class="greeting">
      <p>Dear ${emailData.recipientName},</p>
      <p>Warm greetings! 🙏</p>
      <p>Thank you for registering for our webinar. We're excited to have you join us for this incredible learning experience!</p>
    </div>
    
    <div class="webinar-details">
      <h2>${emailData.webinarTitle}</h2>
      <div class="detail-row">
        <span class="detail-icon">📅</span>
        <span>${emailData.webinarDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-icon">⏰</span>
        <span>${emailData.webinarTime} (Duration: ${emailData.duration} minutes)</span>
      </div>
      <div class="detail-row">
        <span class="detail-icon">👥</span>
        <span>Join from anywhere with Google Meet</span>
      </div>
    </div>
    
    <div style="text-align: center;">
      <a href="${emailData.meetLink}" class="meet-link">
        🎥 Join Webinar
      </a>
      <p style="color: #777; font-size: 14px; margin-top: 10px;">
        Or copy this link: <br>
        <code style="background: #f0f0f0; padding: 5px 10px; border-radius: 4px; display: inline-block; margin-top: 5px;">${emailData.meetLink}</code>
      </p>
    </div>
    
    <div class="instructions">
      <h3>📝 Important Instructions:</h3>
      <ul>
        <li><strong>Save this email</strong> - You'll need the meeting link to join</li>
        <li><strong>Join 5 minutes early</strong> - Ensure your audio and video are working</li>
        <li><strong>Keep your notifications on</strong> - We'll send reminders before the session</li>
        <li><strong>Prepare questions</strong> - We'll have a Q&A session at the end</li>
        <li><strong>Have a stable internet connection</strong> - For the best experience</li>
      </ul>
    </div>
    
    <div class="instructions" style="border-left-color: #10b981; background: #ecfdf5;">
      <h3 style="color: #10b981;">💡 What to Expect:</h3>
      <p>This session will cover proven strategies, expert insights, and practical tips to help you succeed. You'll have the opportunity to:</p>
      <ul>
        <li>Learn from industry experts</li>
        <li>Get your doubts cleared in real-time</li>
        <li>Network with fellow participants</li>
        <li>Access exclusive resources and materials</li>
      </ul>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <p style="font-size: 16px; color: #555;">
        We look forward to seeing you at the webinar! 🚀
      </p>
    </div>
    
    <div class="footer">
      <p><strong>Need Help?</strong></p>
      <p>If you have any questions or face any issues joining the webinar, please don't hesitate to reach out to our support team.</p>
      <p style="margin-top: 20px;">
        Best regards,<br>
        <strong>The Webinar Team</strong>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    console.log('Sending webinar confirmation email to:', emailData.recipientEmail);
    console.log('Webinar:', emailData.webinarTitle);
    console.log('Meet Link:', emailData.meetLink);

    const emailService = new EmailService();
    const subject = `Webinar Confirmed: ${emailData.webinarTitle}`;

    const result = await emailService.sendEmail({
      to: emailData.recipientEmail,
      subject: subject,
      html: emailHtml,
    });

    await logEmailSend(
      supabase,
      emailData.registrationId,
      'webinar_confirmation',
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
          message: 'Failed to send webinar confirmation email'
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
        message: 'Confirmation email sent successfully',
        recipient: emailData.recipientEmail,
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
    console.error('Error sending email:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to send email'
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
