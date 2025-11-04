import nodemailer from 'npm:nodemailer@7.0.10';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private transporter: any;
  private config: EmailConfig;

  constructor(config?: EmailConfig) {
    this.config = config || {
      host: Deno.env.get('SMTP_HOST') || 'smtp.gmail.com',
      port: parseInt(Deno.env.get('SMTP_PORT') || '587'),
      secure: Deno.env.get('SMTP_PORT') === '465',
      user: Deno.env.get('SMTP_USER') || '',
      pass: Deno.env.get('SMTP_PASS') || '',
      from: Deno.env.get('SMTP_FROM') || Deno.env.get('SMTP_USER') || 'noreply@primoboost.ai'
    };

    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.user,
        pass: this.config.pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!this.config.user || !this.config.pass) {
        console.warn('SMTP credentials not configured, email will not be sent');
        return {
          success: false,
          error: 'SMTP credentials not configured'
        };
      }

      const info = await this.transporter.sendMail({
        from: `"PrimoBoost AI" <${this.config.from}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
      });

      console.log('Email sent successfully:', info.messageId);
      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      console.error('Error sending email:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email'
      };
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('SMTP connection verified successfully');
      return true;
    } catch (error) {
      console.error('SMTP connection verification failed:', error);
      return false;
    }
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>.*<\/style>/gm, '')
      .replace(/<script[^>]*>.*<\/script>/gm, '')
      .replace(/<[^>]+>/gm, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export async function logEmailSend(
  supabase: any,
  userId: string,
  emailType: string,
  recipientEmail: string,
  subject: string,
  status: 'sent' | 'failed',
  errorMessage?: string
): Promise<void> {
  try {
    await supabase.from('email_logs').insert({
      user_id: userId,
      email_type: emailType,
      recipient_email: recipientEmail,
      subject: subject,
      status: status,
      error_message: errorMessage,
      sent_at: status === 'sent' ? new Date().toISOString() : null
    });
  } catch (error) {
    console.error('Error logging email send:', error);
  }
}

export function replaceTemplateVariables(template: string, variables: Record<string, any>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(regex, String(value));
  }
  return result;
}
