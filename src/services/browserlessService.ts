import { AutoApplyFormData, FormFieldMapping, FormAnalysisResult } from '../types/autoApply';

export interface BrowserlessConfig {
  wsEndpoint: string;
  timeout: number;
  headless: boolean;
}

export interface BrowserlessNavigationResult {
  success: boolean;
  url: string;
  title: string;
  screenshot?: string;
  error?: string;
}

export interface BrowserlessFillResult {
  success: boolean;
  fieldsFilled: { [key: string]: string };
  fieldsSkipped: string[];
  screenshot?: string;
  error?: string;
}

export interface BrowserlessSubmitResult {
  success: boolean;
  confirmationText?: string;
  redirectUrl?: string;
  screenshot?: string;
  error?: string;
}

class BrowserlessService {
  private config: BrowserlessConfig;
  private isAvailable: boolean = false;

  constructor() {
    const wsEndpoint = import.meta.env.BROWSER_WS || '';
    const timeout = parseInt(import.meta.env.BROWSER_TIMEOUT || '60000');
    const headless = import.meta.env.BROWSER_HEADLESS !== 'false';

    this.config = {
      wsEndpoint,
      timeout,
      headless,
    };

    this.isAvailable = !!wsEndpoint && wsEndpoint.length > 0;
  }

  isBrowserlessAvailable(): boolean {
    return this.isAvailable;
  }

  getConfig(): BrowserlessConfig {
    return { ...this.config };
  }

  async analyzeForm(url: string): Promise<FormAnalysisResult> {
    if (!this.isAvailable) {
      throw new Error('Browserless service not configured');
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/browserless-automation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        action: 'analyze',
        url,
        browserConfig: this.config,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Form analysis failed: ${error}`);
    }

    return await response.json();
  }

  async navigateToApplication(url: string): Promise<BrowserlessNavigationResult> {
    if (!this.isAvailable) {
      return {
        success: false,
        url,
        title: '',
        error: 'Browserless service not configured',
      };
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/browserless-automation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        action: 'navigate',
        url,
        browserConfig: this.config,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        url,
        title: '',
        error: `Navigation failed: ${error}`,
      };
    }

    return await response.json();
  }

  async fillApplicationForm(
    url: string,
    formData: AutoApplyFormData,
    fieldMappings?: FormFieldMapping[]
  ): Promise<BrowserlessFillResult> {
    if (!this.isAvailable) {
      return {
        success: false,
        fieldsFilled: {},
        fieldsSkipped: Object.keys(formData),
        error: 'Browserless service not configured',
      };
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/browserless-automation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        action: 'fill',
        url,
        formData,
        fieldMappings,
        browserConfig: this.config,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        fieldsFilled: {},
        fieldsSkipped: Object.keys(formData),
        error: `Form filling failed: ${error}`,
      };
    }

    return await response.json();
  }

  async uploadResume(
    sessionId: string,
    resumeUrl: string,
    fileInputSelector?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isAvailable) {
      return {
        success: false,
        error: 'Browserless service not configured',
      };
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/browserless-automation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        action: 'upload',
        sessionId,
        resumeUrl,
        fileInputSelector,
        browserConfig: this.config,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `Resume upload failed: ${error}`,
      };
    }

    return await response.json();
  }

  async submitApplication(sessionId: string): Promise<BrowserlessSubmitResult> {
    if (!this.isAvailable) {
      return {
        success: false,
        error: 'Browserless service not configured',
      };
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/browserless-automation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        action: 'submit',
        sessionId,
        browserConfig: this.config,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `Application submission failed: ${error}`,
      };
    }

    return await response.json();
  }

  async captureScreenshot(sessionId: string): Promise<string | null> {
    if (!this.isAvailable) {
      return null;
    }

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/browserless-automation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          action: 'screenshot',
          sessionId,
          browserConfig: this.config,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const result = await response.json();
      return result.screenshot || null;
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      return null;
    }
  }

  async closeBrowserSession(sessionId: string): Promise<void> {
    if (!this.isAvailable) {
      return;
    }

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      await fetch(`${supabaseUrl}/functions/v1/browserless-automation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          action: 'close',
          sessionId,
        }),
      });
    } catch (error) {
      console.error('Failed to close browser session:', error);
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/browserless-automation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          action: 'health',
        }),
        signal: AbortSignal.timeout(10000),
      });

      return response.ok;
    } catch (error) {
      console.error('Browserless connection test failed:', error);
      return false;
    }
  }
}

export const browserlessService = new BrowserlessService();
