// src/services/sessionManagementService.ts
import { supabase } from '../lib/supabaseClient';
import { encryptSessionData, decryptSessionData } from '../utils/sessionEncryption';

export interface PlatformSession {
  id: string;
  userId: string;
  platformName: string;
  platformUrl: string;
  sessionData: any;
  sessionMetadata: any;
  expiresAt: string;
  lastUsedAt: string;
  createdAt: string;
}

export interface SessionData {
  cookies: Array<{ name: string; value: string; domain?: string; path?: string }>;
  localStorage?: Record<string, string>;
  sessionStorage?: Record<string, string>;
  headers?: Record<string, string>;
  userAgent?: string;
}

export interface AuthenticationEvent {
  userId: string;
  platformName: string;
  eventType: 'login_required' | 'login_success' | 'login_failure' | 'session_expired' | 'session_created' | 'session_refreshed' | 'logout' | 'session_deleted';
  autoApplyLogId?: string;
  ipAddress?: string;
  userAgent?: string;
  eventMetadata?: any;
}

class SessionManagementService {
  private masterKey: string;

  constructor() {
    // In production, this should come from a secure environment variable
    // For client-side, we'll use the Supabase anon key as a base
    this.masterKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'fallback-key';
  }

  /**
   * Stores a new platform session with encryption
   */
  async storeSession(
    userId: string,
    platformName: string,
    platformUrl: string,
    sessionData: SessionData,
    metadata?: any
  ): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
      // Encrypt session data
      const encryptedData = encryptSessionData(sessionData, userId, this.masterKey);

      // Calculate expiry (24 hours from now)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Insert or update session
      const { data, error } = await supabase
        .from('platform_sessions')
        .upsert(
          {
            user_id: userId,
            platform_name: platformName,
            platform_url: platformUrl,
            encrypted_session_data: encryptedData,
            session_metadata: metadata || {},
            expires_at: expiresAt,
            last_used_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,platform_name',
          }
        )
        .select('id')
        .single();

      if (error) {
        console.error('Failed to store session:', error);
        return { success: false, error: error.message };
      }

      // Log authentication event
      await this.logAuthenticationEvent({
        userId,
        platformName,
        eventType: 'session_created',
        eventMetadata: { sessionId: data.id },
      });

      return { success: true, sessionId: data.id };
    } catch (error: any) {
      console.error('Session storage error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Retrieves and decrypts a platform session
   */
  async getSession(
    userId: string,
    platformName: string
  ): Promise<{ success: boolean; session?: PlatformSession; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('platform_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('platform_name', platformName)
        .maybeSingle();

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: 'Session not found' };
      }

      // Check if session is expired
      const expiresAt = new Date(data.expires_at);
      if (expiresAt < new Date()) {
        // Session expired, delete it
        await this.deleteSession(userId, platformName);
        await this.logAuthenticationEvent({
          userId,
          platformName,
          eventType: 'session_expired',
        });
        return { success: false, error: 'Session expired' };
      }

      // Decrypt session data
      const sessionData = decryptSessionData(
        data.encrypted_session_data,
        userId,
        this.masterKey
      );

      // Update last_used_at
      await supabase
        .from('platform_sessions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', data.id);

      return {
        success: true,
        session: {
          id: data.id,
          userId: data.user_id,
          platformName: data.platform_name,
          platformUrl: data.platform_url,
          sessionData,
          sessionMetadata: data.session_metadata,
          expiresAt: data.expires_at,
          lastUsedAt: data.last_used_at,
          createdAt: data.created_at,
        },
      };
    } catch (error: any) {
      console.error('Session retrieval error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Checks if a valid session exists for a platform
   */
  async hasValidSession(userId: string, platformName: string): Promise<boolean> {
    const result = await this.getSession(userId, platformName);
    return result.success && !!result.session;
  }

  /**
   * Deletes a platform session
   */
  async deleteSession(userId: string, platformName: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('platform_sessions')
        .delete()
        .eq('user_id', userId)
        .eq('platform_name', platformName);

      if (!error) {
        await this.logAuthenticationEvent({
          userId,
          platformName,
          eventType: 'session_deleted',
        });
      }

      return !error;
    } catch (error) {
      console.error('Session deletion error:', error);
      return false;
    }
  }

  /**
   * Deletes all sessions for a user (logout from all platforms)
   */
  async deleteAllSessions(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('platform_sessions')
        .delete()
        .eq('user_id', userId);

      if (!error) {
        await this.logAuthenticationEvent({
          userId,
          platformName: 'all',
          eventType: 'logout',
        });
      }

      return !error;
    } catch (error) {
      console.error('All sessions deletion error:', error);
      return false;
    }
  }

  /**
   * Gets all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<PlatformSession[]> {
    try {
      const { data, error } = await supabase
        .from('platform_sessions')
        .select('*')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('last_used_at', { ascending: false });

      if (error || !data) {
        return [];
      }

      return data.map((session) => ({
        id: session.id,
        userId: session.user_id,
        platformName: session.platform_name,
        platformUrl: session.platform_url,
        sessionData: {}, // Don't decrypt for list view
        sessionMetadata: session.session_metadata,
        expiresAt: session.expires_at,
        lastUsedAt: session.last_used_at,
        createdAt: session.created_at,
      }));
    } catch (error) {
      console.error('Get user sessions error:', error);
      return [];
    }
  }

  /**
   * Refreshes a session (extends expiry by 24 hours)
   */
  async refreshSession(userId: string, platformName: string): Promise<boolean> {
    try {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase
        .from('platform_sessions')
        .update({
          expires_at: expiresAt,
          last_used_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('platform_name', platformName);

      if (!error) {
        await this.logAuthenticationEvent({
          userId,
          platformName,
          eventType: 'session_refreshed',
        });
      }

      return !error;
    } catch (error) {
      console.error('Session refresh error:', error);
      return false;
    }
  }

  /**
   * Logs an authentication event for audit trail
   */
  async logAuthenticationEvent(event: AuthenticationEvent): Promise<void> {
    try {
      await supabase.from('authentication_events').insert({
        user_id: event.userId,
        platform_name: event.platformName,
        event_type: event.eventType,
        auto_apply_log_id: event.autoApplyLogId,
        ip_address: event.ipAddress,
        user_agent: event.userAgent || navigator.userAgent,
        event_metadata: event.eventMetadata || {},
      });
    } catch (error) {
      console.error('Failed to log authentication event:', error);
    }
  }

  /**
   * Gets authentication history for a user
   */
  async getAuthenticationHistory(
    userId: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('authentication_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      return data || [];
    } catch (error) {
      console.error('Get authentication history error:', error);
      return [];
    }
  }

  /**
   * Cleans up expired sessions (should be called periodically)
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('platform_sessions')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id');

      return data?.length || 0;
    } catch (error) {
      console.error('Session cleanup error:', error);
      return 0;
    }
  }
}

export const sessionManagementService = new SessionManagementService();
