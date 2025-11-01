import { supabase } from '../lib/supabaseClient';

const ADMIN_EMAIL = 'primoboostai@gmail.com';

export interface AdminUser {
  id: string;
  full_name: string;
  email_address: string;
  profile_created_at: string;
}

export interface UserListItem {
  id: string;
  full_name: string;
  email_address: string;
  role: 'client' | 'admin';
  is_active: boolean;
  phone?: string;
  profile_created_at: string;
  resumes_created_count: number;
}

export interface RoleOperationResult {
  success: boolean;
  message: string;
  user_id?: string;
  user_email?: string;
}

export interface AdminStatus {
  authenticated: boolean;
  user_id: string | null;
  user_email: string | null;
  profile_exists: boolean;
  profile_role: string | null;
  metadata_role: string | null;
  is_admin_result: boolean;
  timestamp: string;
  message?: string;
  raw_metadata?: any;
}

class AdminService {
  async isCurrentUserAdmin(): Promise<boolean> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        return false;
      }

      return session.user.email === ADMIN_EMAIL;
    } catch (error) {
      console.error('AdminService: Error in isCurrentUserAdmin:', error);
      return false;
    }
  }

  async getAdminStatus(): Promise<AdminStatus | null> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        return {
          authenticated: false,
          user_id: null,
          user_email: null,
          profile_exists: false,
          profile_role: null,
          metadata_role: null,
          is_admin_result: false,
          timestamp: new Date().toISOString(),
          message: 'Not authenticated'
        };
      }

      const isAdmin = session.user.email === ADMIN_EMAIL;

      return {
        authenticated: true,
        user_id: session.user.id,
        user_email: session.user.email || null,
        profile_exists: true,
        profile_role: isAdmin ? 'admin' : 'client',
        metadata_role: isAdmin ? 'admin' : 'client',
        is_admin_result: isAdmin,
        timestamp: new Date().toISOString(),
        message: isAdmin ? 'Admin access granted' : 'Regular user'
      };
    } catch (error) {
      console.error('AdminService: Error in getAdminStatus:', error);
      return null;
    }
  }

  async verifyAndFixAdminAccess(): Promise<{ success: boolean; message: string }> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        return {
          success: false,
          message: 'No active session. Please log in.'
        };
      }

      const isAdmin = session.user.email === ADMIN_EMAIL;

      if (isAdmin) {
        return {
          success: true,
          message: 'Admin access verified successfully.'
        };
      }

      return {
        success: false,
        message: 'Admin access denied. Only primoboostai@gmail.com has admin privileges.'
      };
    } catch (error) {
      console.error('AdminService: Error in verifyAndFixAdminAccess:', error);
      return {
        success: false,
        message: 'Failed to verify admin access.'
      };
    }
  }

  async getAllUsers(
    searchQuery: string = '',
    roleFilter: 'all' | 'client' | 'admin' = 'all',
    limitCount: number = 50,
    offsetCount: number = 0
  ): Promise<UserListItem[]> {
    try {
      const { data, error } = await supabase.rpc('get_all_users', {
        search_query: searchQuery,
        role_filter: roleFilter,
        limit_count: limitCount,
        offset_count: offsetCount
      });

      if (error) {
        console.error('Error fetching users:', error);
        throw new Error(error.message || 'Failed to fetch users');
      }

      return data as UserListItem[];
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      throw error;
    }
  }

  async getUserStats(): Promise<{
    totalUsers: number;
    totalAdmins: number;
    totalClients: number;
    activeUsers: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role, is_active');

      if (error) {
        console.error('Error fetching user stats:', error);
        throw new Error('Failed to fetch user statistics');
      }

      const totalUsers = data.length;
      const totalAdmins = data.filter(u => u.role === 'admin').length;
      const totalClients = data.filter(u => u.role === 'client').length;
      const activeUsers = data.filter(u => u.is_active).length;

      return {
        totalUsers,
        totalAdmins,
        totalClients,
        activeUsers
      };
    } catch (error) {
      console.error('Error in getUserStats:', error);
      throw error;
    }
  }
}

export const adminService = new AdminService();
