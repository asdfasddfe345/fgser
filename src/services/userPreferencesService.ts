import { supabase } from '../lib/supabaseClient';

export interface UserJobPreferences {
  id?: string;
  user_id: string;
  resume_text?: string;
  resume_url?: string;
  passout_year?: number;
  role_type?: 'internship' | 'fulltime' | 'both';
  tech_interests?: string[];
  preferred_modes?: string[];
  skills_extracted?: any;
  onboarding_completed?: boolean;
  last_updated?: string;
  created_at?: string;
}

class UserPreferencesService {
  /**
   * Get user preferences
   */
  async getUserPreferences(userId: string): Promise<UserJobPreferences | null> {
    try {
      const { data, error } = await supabase
        .from('user_job_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching user preferences:', error);
      return null;
    }
  }

  /**
   * Save or update user preferences
   */
  async savePreferences(preferences: UserJobPreferences): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_job_preferences')
        .upsert(
          {
            ...preferences,
            last_updated: new Date().toISOString(),
          },
          {
            onConflict: 'user_id',
          }
        );

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error saving preferences:', error);
      return false;
    }
  }

  /**
   * Upload resume file to Supabase Storage
   */
  async uploadResume(userId: string, file: File): Promise<string | null> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('user-resumes')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('user-resumes')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading resume:', error);
      return null;
    }
  }

  /**
   * Delete resume file from storage
   */
  async deleteResume(userId: string, resumeUrl: string): Promise<boolean> {
    try {
      const fileName = resumeUrl.split('/user-resumes/')[1];
      if (!fileName) return false;

      const { error } = await supabase.storage
        .from('user-resumes')
        .remove([fileName]);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting resume:', error);
      return false;
    }
  }

  /**
   * Check if user has completed onboarding
   */
  async hasCompletedOnboarding(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('user_job_preferences')
        .select('onboarding_completed')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data?.onboarding_completed || false;
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return false;
    }
  }

  /**
   * Mark onboarding as completed
   */
  async completeOnboarding(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_job_preferences')
        .update({ onboarding_completed: true })
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error completing onboarding:', error);
      return false;
    }
  }

  /**
   * Update specific preference field
   */
  async updatePreferenceField(
    userId: string,
    field: keyof UserJobPreferences,
    value: any
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_job_preferences')
        .update({ [field]: value, last_updated: new Date().toISOString() })
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating preference field:', error);
      return false;
    }
  }

  /**
   * Delete all user preferences
   */
  async deletePreferences(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_job_preferences')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting preferences:', error);
      return false;
    }
  }
}

export const userPreferencesService = new UserPreferencesService();
