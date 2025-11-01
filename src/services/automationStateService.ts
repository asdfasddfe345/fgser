// src/services/automationStateService.ts
import { supabase } from '../lib/supabaseClient';

export interface AutomationState {
  id: string;
  autoApplyLogId: string;
  userId: string;
  currentStep: string;
  formDataFilled: Record<string, any>;
  pendingFields: string[];
  pauseReason: 'auth_required' | 'captcha_detected' | 'network_error' | 'form_error' | 'manual_intervention' | 'unknown';
  browserState: {
    cookies?: Array<{ name: string; value: string; domain?: string }>;
    localStorage?: Record<string, string>;
    sessionStorage?: Record<string, string>;
    currentUrl?: string;
  };
  screenshots: string[];
  resumeCount: number;
  canResume: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaveStateParams {
  autoApplyLogId: string;
  userId: string;
  currentStep: string;
  formDataFilled?: Record<string, any>;
  pendingFields?: string[];
  pauseReason: AutomationState['pauseReason'];
  browserState?: AutomationState['browserState'];
  screenshots?: string[];
}

class AutomationStateService {
  /**
   * Saves the current automation state
   */
  async saveState(params: SaveStateParams): Promise<{ success: boolean; stateId?: string; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('automation_state')
        .upsert(
          {
            auto_apply_log_id: params.autoApplyLogId,
            user_id: params.userId,
            current_step: params.currentStep,
            form_data_filled: params.formDataFilled || {},
            pending_fields: params.pendingFields || [],
            pause_reason: params.pauseReason,
            browser_state: params.browserState || {},
            screenshots: params.screenshots || [],
            resume_count: 0,
            can_resume: true,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'auto_apply_log_id',
          }
        )
        .select('id')
        .single();

      if (error) {
        console.error('Failed to save automation state:', error);
        return { success: false, error: error.message };
      }

      // Update auto_apply_logs pause count
      await supabase.rpc('increment_pause_count', { log_id: params.autoApplyLogId });

      return { success: true, stateId: data.id };
    } catch (error: any) {
      console.error('Save automation state error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Retrieves automation state by auto-apply log ID
   */
  async getState(autoApplyLogId: string): Promise<{ success: boolean; state?: AutomationState; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('automation_state')
        .select('*')
        .eq('auto_apply_log_id', autoApplyLogId)
        .maybeSingle();

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: 'Automation state not found' };
      }

      return {
        success: true,
        state: {
          id: data.id,
          autoApplyLogId: data.auto_apply_log_id,
          userId: data.user_id,
          currentStep: data.current_step,
          formDataFilled: data.form_data_filled,
          pendingFields: data.pending_fields,
          pauseReason: data.pause_reason,
          browserState: data.browser_state,
          screenshots: data.screenshots,
          resumeCount: data.resume_count,
          canResume: data.can_resume,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      };
    } catch (error: any) {
      console.error('Get automation state error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Updates automation state (for resume)
   */
  async updateState(
    autoApplyLogId: string,
    updates: Partial<{
      currentStep: string;
      formDataFilled: Record<string, any>;
      pendingFields: string[];
      browserState: AutomationState['browserState'];
      screenshots: string[];
      canResume: boolean;
    }>
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('automation_state')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('auto_apply_log_id', autoApplyLogId);

      return !error;
    } catch (error) {
      console.error('Update automation state error:', error);
      return false;
    }
  }

  /**
   * Marks automation as resumed and increments resume count
   */
  async markAsResumed(autoApplyLogId: string): Promise<boolean> {
    try {
      // Increment resume_count in automation_state
      const { data: stateData } = await supabase
        .from('automation_state')
        .select('resume_count')
        .eq('auto_apply_log_id', autoApplyLogId)
        .single();

      if (stateData) {
        await supabase
          .from('automation_state')
          .update({
            resume_count: stateData.resume_count + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('auto_apply_log_id', autoApplyLogId);
      }

      // Update auto_apply_logs resume count
      await supabase.rpc('increment_resume_count', { log_id: autoApplyLogId });

      return true;
    } catch (error) {
      console.error('Mark as resumed error:', error);
      return false;
    }
  }

  /**
   * Deletes automation state (when completed or cancelled)
   */
  async deleteState(autoApplyLogId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('automation_state')
        .delete()
        .eq('auto_apply_log_id', autoApplyLogId);

      return !error;
    } catch (error) {
      console.error('Delete automation state error:', error);
      return false;
    }
  }

  /**
   * Gets all paused automations for a user
   */
  async getUserPausedAutomations(userId: string): Promise<AutomationState[]> {
    try {
      const { data, error } = await supabase
        .from('automation_state')
        .select('*')
        .eq('user_id', userId)
        .eq('can_resume', true)
        .order('created_at', { ascending: false });

      if (error || !data) {
        return [];
      }

      return data.map((item) => ({
        id: item.id,
        autoApplyLogId: item.auto_apply_log_id,
        userId: item.user_id,
        currentStep: item.current_step,
        formDataFilled: item.form_data_filled,
        pendingFields: item.pending_fields,
        pauseReason: item.pause_reason,
        browserState: item.browser_state,
        screenshots: item.screenshots,
        resumeCount: item.resume_count,
        canResume: item.can_resume,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }));
    } catch (error) {
      console.error('Get user paused automations error:', error);
      return [];
    }
  }

  /**
   * Adds a screenshot to the automation state
   */
  async addScreenshot(autoApplyLogId: string, screenshotUrl: string): Promise<boolean> {
    try {
      const { data: stateData } = await supabase
        .from('automation_state')
        .select('screenshots')
        .eq('auto_apply_log_id', autoApplyLogId)
        .single();

      if (stateData) {
        const updatedScreenshots = [...(stateData.screenshots || []), screenshotUrl];

        await supabase
          .from('automation_state')
          .update({
            screenshots: updatedScreenshots,
            updated_at: new Date().toISOString(),
          })
          .eq('auto_apply_log_id', autoApplyLogId);

        return true;
      }

      return false;
    } catch (error) {
      console.error('Add screenshot error:', error);
      return false;
    }
  }

  /**
   * Checks if automation can be resumed
   */
  async canResumeAutomation(autoApplyLogId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('automation_state')
        .select('can_resume, resume_count')
        .eq('auto_apply_log_id', autoApplyLogId)
        .maybeSingle();

      if (error || !data) {
        return false;
      }

      // Limit to 3 resume attempts
      return data.can_resume && data.resume_count < 3;
    } catch (error) {
      console.error('Can resume automation error:', error);
      return false;
    }
  }

  /**
   * Marks automation as non-resumable (permanent failure)
   */
  async markAsNonResumable(autoApplyLogId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('automation_state')
        .update({
          can_resume: false,
          updated_at: new Date().toISOString(),
        })
        .eq('auto_apply_log_id', autoApplyLogId);

      return !error;
    } catch (error) {
      console.error('Mark as non-resumable error:', error);
      return false;
    }
  }
}

export const automationStateService = new AutomationStateService();
