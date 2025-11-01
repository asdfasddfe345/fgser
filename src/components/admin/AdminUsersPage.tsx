import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Shield, Users, UserCheck, UserX, ArrowLeft, AlertCircle, Loader2, CheckCircle, Crown, User, Mail, Calendar } from 'lucide-react';
import { adminService, UserListItem, RoleOperationResult } from '../../services/adminService';

export const AdminUsersPage: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'client' | 'admin'>('all');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ userId: string; action: 'grant' | 'revoke'; userName: string } | null>(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAdmins: 0,
    totalClients: 0,
    activeUsers: 0
  });

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, [roleFilter]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const data = await adminService.getAllUsers(searchQuery, roleFilter);
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      showNotification('error', 'Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await adminService.getUserStats();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleRoleChange = (userId: string, action: 'grant' | 'revoke', userName: string) => {
    setPendingAction({ userId, action, userName });
    setShowConfirmModal(true);
  };

  const confirmRoleChange = async () => {
    if (!pendingAction) return;

    try {
      let result: RoleOperationResult;

      if (pendingAction.action === 'grant') {
        result = await adminService.grantAdminRole(pendingAction.userId);
      } else {
        result = await adminService.revokeAdminRole(pendingAction.userId);
      }

      if (result.success) {
        showNotification('success', result.message);
        await fetchUsers();
        await fetchStats();
      } else {
        showNotification('error', result.message);
      }
    } catch (error) {
      showNotification('error', 'Failed to update user role');
    } finally {
      setShowConfirmModal(false);
      setPendingAction(null);
    }
  };

  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.full_name.toLowerCase().includes(query) ||
      user.email_address.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40 dark:bg-dark-50 dark:border-dark-300">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 py-3">
            <button
              onClick={() => navigate('/admin/jobs')}
              className="bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 text-white hover:from-neon-cyan-400 hover:to-neon-blue-400 py-3 px-5 rounded-xl inline-flex items-center space-x-2 transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:block">Back to Jobs</span>
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">User Management</h1>
            <div className="w-24"></div>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="fixed top-20 right-4 z-50 animate-fade-in-down">
          <div className={`p-4 rounded-xl shadow-lg border ${
            notification.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800 dark:bg-neon-cyan-500/10 dark:border-neon-cyan-400/50 dark:text-neon-cyan-300'
              : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-500/50 dark:text-red-300'
          }`}>
            <div className="flex items-center space-x-2">
              {notification.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <p className="font-medium">{notification.message}</p>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-dark-100 rounded-xl shadow-md p-6 border border-gray-200 dark:border-dark-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Users</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.totalUsers}</p>
              </div>
              <div className="bg-blue-100 dark:bg-neon-cyan-500/20 w-12 h-12 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600 dark:text-neon-cyan-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-100 rounded-xl shadow-md p-6 border border-gray-200 dark:border-dark-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Administrators</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.totalAdmins}</p>
              </div>
              <div className="bg-purple-100 dark:bg-purple-500/20 w-12 h-12 rounded-lg flex items-center justify-center">
                <Crown className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-100 rounded-xl shadow-md p-6 border border-gray-200 dark:border-dark-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Clients</p>
                <p className="text-3xl font-bold text-green-600 dark:text-neon-cyan-400">{stats.totalClients}</p>
              </div>
              <div className="bg-green-100 dark:bg-neon-cyan-500/20 w-12 h-12 rounded-lg flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-green-600 dark:text-neon-cyan-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-100 rounded-xl shadow-md p-6 border border-gray-200 dark:border-dark-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Active Users</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.activeUsers}</p>
              </div>
              <div className="bg-gray-100 dark:bg-dark-200 w-12 h-12 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white dark:bg-dark-100 rounded-xl shadow-md border border-gray-200 dark:border-dark-300 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-dark-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:text-gray-100"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-dark-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:text-gray-100"
            >
              <option value="all">All Roles</option>
              <option value="admin">Administrators Only</option>
              <option value="client">Clients Only</option>
            </select>
          </div>
        </div>

        {/* Users List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-blue-600 dark:text-neon-cyan-400 animate-spin" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white dark:bg-dark-100 rounded-xl shadow-md border border-gray-200 dark:border-dark-300 p-12 text-center">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No users found</h3>
            <p className="text-gray-600 dark:text-gray-400">
              {searchQuery ? 'Try adjusting your search query' : 'No users match the selected filters'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-dark-100 rounded-xl shadow-md border border-gray-200 dark:border-dark-300 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-dark-200 border-b border-gray-200 dark:border-dark-300">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Resumes Created
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-dark-300">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-dark-200 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="bg-gradient-to-br from-neon-cyan-500 to-neon-blue-500 w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold">
                            {user.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">{user.full_name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{user.email_address}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-dark-300 dark:text-gray-400'
                        }`}>
                          {user.role === 'admin' ? (
                            <><Crown className="w-3 h-3 mr-1" /> Admin</>
                          ) : (
                            <><User className="w-3 h-3 mr-1" /> Client</>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                          user.is_active
                            ? 'bg-green-100 text-green-700 dark:bg-neon-cyan-500/20 dark:text-neon-cyan-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                        {user.resumes_created_count || 0}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-sm">
                        {new Date(user.profile_created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {user.role === 'admin' ? (
                          <button
                            onClick={() => handleRoleChange(user.id, 'revoke', user.full_name)}
                            className="inline-flex items-center space-x-1 px-3 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg transition-colors text-sm font-medium"
                          >
                            <UserX className="w-4 h-4" />
                            <span>Revoke Admin</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRoleChange(user.id, 'grant', user.full_name)}
                            className="inline-flex items-center space-x-1 px-3 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/10 dark:hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-lg transition-colors text-sm font-medium"
                          >
                            <Crown className="w-4 h-4" />
                            <span>Grant Admin</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-dark-300">
            <div className="flex items-center space-x-3 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                pendingAction.action === 'grant'
                  ? 'bg-purple-100 dark:bg-purple-500/20'
                  : 'bg-red-100 dark:bg-red-900/20'
              }`}>
                {pendingAction.action === 'grant' ? (
                  <Crown className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                ) : (
                  <UserX className="w-6 h-6 text-red-600 dark:text-red-400" />
                )}
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {pendingAction.action === 'grant' ? 'Grant Admin Role?' : 'Revoke Admin Role?'}
              </h3>
            </div>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {pendingAction.action === 'grant' ? (
                <>Are you sure you want to grant admin privileges to <strong>{pendingAction.userName}</strong>? They will have full access to manage users, jobs, and system settings.</>
              ) : (
                <>Are you sure you want to revoke admin privileges from <strong>{pendingAction.userName}</strong>? They will be downgraded to a regular client account.</>
              )}
            </p>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingAction(null);
                }}
                className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-dark-200 dark:hover:bg-dark-300 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRoleChange}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors text-white ${
                  pendingAction.action === 'grant'
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {pendingAction.action === 'grant' ? 'Grant Admin' : 'Revoke Admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
