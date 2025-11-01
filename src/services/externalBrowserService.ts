// src/services/externalBrowserService.ts
import { AutoApplyRequest, AutoApplyResponse, FormAnalysisResult } from '../types/autoApply';
import { browserlessService } from './browserlessService';
import { detectPlatformStrategy, mapFormDataToFields } from './platformAutomationStrategies';

export type AutomationMode = 'browserless' | 'external' | 'simulation';

class ExternalBrowserService {
  private baseUrl: string;
  private apiKey: string;
  private automationMode: AutomationMode;

  constructor() {
    const externalUrl = import.meta.env.VITE_EXTERNAL_BROWSER_SERVICE_URL;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const browserWs = import.meta.env.BROWSER_WS;

    if (browserWs && browserlessService.isBrowserlessAvailable()) {
      this.automationMode = 'browserless';
      this.baseUrl = `${supabaseUrl}/functions/v1`;
    } else if (externalUrl && externalUrl.length > 0) {
      this.automationMode = 'external';
      this.baseUrl = externalUrl;
    } else {
      this.automationMode = 'simulation';
      this.baseUrl = `${supabaseUrl}/functions/v1`;
    }

    this.apiKey = import.meta.env.VITE_EXTERNAL_BROWSER_API_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  }

  getAutomationMode(): AutomationMode {
    return this.automationMode;
  }

  /**
   * Analyzes a job application form to understand its structure
   */
  async analyzeApplicationForm(applicationUrl: string): Promise<FormAnalysisResult> {
    try {
      const response = await fetch(`${this.baseUrl}/analyze-form`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Origin': 'primoboost-ai',
        },
        body: JSON.stringify({ url: applicationUrl }),
      });

      if (!response.ok) {
        throw new Error(`Form analysis failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error analyzing application form:', error);
      throw new Error('Failed to analyze application form structure');
    }
  }

  /**
   * Submits an auto-apply request to the external browser service
   */
  async submitAutoApply(request: AutoApplyRequest): Promise<AutoApplyResponse> {
    try {
      console.log(`ExternalBrowserService: Submitting auto-apply request in ${this.automationMode} mode...`);

      if (this.automationMode === 'browserless') {
        return await this.submitViaBrowserless(request);
      }

      const endpoint = this.automationMode === 'external'
        ? `${this.baseUrl}/auto-apply`
        : `${this.baseUrl}/auto-apply`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Origin': 'primoboost-ai',
          'X-Automation-Mode': this.automationMode,
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(180000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Auto-apply request failed: ${response.status} - ${errorText}`);
      }

      const result: AutoApplyResponse = await response.json();
      console.log('ExternalBrowserService: Auto-apply completed:', result.success);

      return result;
    } catch (error) {
      console.error('Error in submitAutoApply:', error);
      throw error;
    }
  }

  private async submitViaBrowserless(request: AutoApplyRequest): Promise<AutoApplyResponse> {
    const startTime = Date.now();
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const platform = detectPlatformStrategy(request.applicationUrl).platform;
      console.log(`Detected platform: ${platform}`);

      const navResult = await browserlessService.navigateToApplication(request.applicationUrl);
      if (!navResult.success) {
        return {
          success: false,
          message: 'Failed to navigate to application page',
          status: 'failed',
          error: navResult.error,
          processingTimeMs: Date.now() - startTime,
        };
      }

      const fillResult = await browserlessService.fillApplicationForm(
        request.applicationUrl,
        request.userData
      );

      if (!fillResult.success) {
        return {
          success: false,
          message: 'Failed to fill application form',
          status: 'partial',
          error: fillResult.error,
          formFieldsFilled: fillResult.fieldsFilled,
          screenshot: fillResult.screenshot,
          processingTimeMs: Date.now() - startTime,
        };
      }

      if (request.resumeFileUrl) {
        const uploadResult = await browserlessService.uploadResume(
          sessionId,
          request.resumeFileUrl
        );

        if (!uploadResult.success) {
          console.warn('Resume upload failed:', uploadResult.error);
        }
      }

      const submitResult = await browserlessService.submitApplication(sessionId);

      await browserlessService.closeBrowserSession(sessionId);

      return {
        success: submitResult.success,
        message: submitResult.success
          ? 'Application submitted successfully via Browserless automation'
          : 'Application submission failed',
        status: submitResult.success ? 'submitted' : 'failed',
        screenshotUrl: submitResult.screenshot,
        error: submitResult.error,
        formFieldsFilled: fillResult.fieldsFilled,
        applicationConfirmationText: submitResult.confirmationText,
        redirectUrl: submitResult.redirectUrl,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      await browserlessService.closeBrowserSession(sessionId);

      return {
        success: false,
        message: 'Browserless automation encountered an error',
        status: 'failed',
        error: error.message,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Gets the status of an ongoing auto-apply process
   */
  async getAutoApplyStatus(applicationId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'not_found';
    progress?: number;
    currentStep?: string;
    estimatedTimeRemaining?: number;
    screenshotUrl?: string;
    errorMessage?: string;
    elapsedSeconds?: number;
  }> {
    try {
      const endpoint = this.automationMode === 'simulation'
        ? `${this.baseUrl}/auto-apply-status/${applicationId}`
        : `${this.baseUrl}/auto-apply/status/${applicationId}`;

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Origin': 'primoboost-ai',
          'apikey': this.apiKey,
        },
      });

      if (!response.ok) {
        console.warn(`Status check returned ${response.status}, returning not_found status`);
        return {
          status: 'not_found',
          progress: 0,
          currentStep: 'Application record not found',
          estimatedTimeRemaining: 0,
        };
      }

      const result = await response.json();

      if (result.status === 'not_found') {
        console.warn(`Application ${applicationId} not found in database`);
      }

      return result;
    } catch (error) {
      console.error('Error checking auto-apply status:', error);
      return {
        status: 'not_found',
        progress: 0,
        currentStep: 'Unable to check status',
        estimatedTimeRemaining: 0,
      };
    }
  }

  /**
   * Cancels an ongoing auto-apply process
   */
  async cancelAutoApply(applicationId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/auto-apply/cancel/${applicationId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Origin': 'primoboost-ai',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Error canceling auto-apply:', error);
      return false;
    }
  }

  /**
   * Test connectivity to the external browser service
   */
  async testConnection(): Promise<boolean> {
    try {
      if (this.automationMode === 'simulation') {
        return true;
      }

      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Origin': 'primoboost-ai',
        },
        signal: AbortSignal.timeout(10000),
      });

      return response.ok;
    } catch (error) {
      console.error('External browser service connection test failed:', error);
      return false;
    }
  }

  /**
   * Check if service is using mock/simulation mode
   */
  isUsingMockMode(): boolean {
    return this.automationMode === 'simulation';
  }

  /**
   * Get detailed automation status
   */
  getAutomationStatus(): {
    mode: AutomationMode;
    isBrowserlessAvailable: boolean;
    isExternalServiceConfigured: boolean;
    isSimulationMode: boolean;
  } {
    return {
      mode: this.automationMode,
      isBrowserlessAvailable: browserlessService.isBrowserlessAvailable(),
      isExternalServiceConfigured: !!import.meta.env.VITE_EXTERNAL_BROWSER_SERVICE_URL,
      isSimulationMode: this.automationMode === 'simulation',
    };
  }
}

export const externalBrowserService = new ExternalBrowserService();