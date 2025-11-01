# Admin Role System Setup Guide

This guide explains how to set up and manage admin roles in your PrimoBoost AI application.

## Overview

The admin role system allows you to designate certain users as administrators who have full access to:
- User management (view all users, grant/revoke admin roles)
- Job listings management (create, edit, delete, activate/deactivate jobs)
- System-wide data access through Row Level Security (RLS) policies
- Payment and subscription management

## Initial Setup

### Step 1: Apply the Migration

The migration file `20251002100000_add_admin_role_system.sql` adds all necessary database structures:

**Using Supabase Dashboard:**
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy the contents of `supabase/migrations/20251002100000_add_admin_role_system.sql`
4. Paste into the SQL Editor
5. Click "Run" to execute the migration

**Or use Supabase CLI (if available):**
```bash
supabase db push
```

### Step 2: Create Your First Admin

After the migration is applied, you need to manually set the first admin user. This is done directly in the Supabase dashboard:

#### Method 1: Using SQL Editor (Recommended)

1. Go to Supabase Dashboard → SQL Editor
2. Run this query, replacing `YOUR_USER_EMAIL` with your actual email:

```sql
-- Update the user_profiles table
UPDATE user_profiles
SET role = 'admin'
WHERE email_address = 'YOUR_USER_EMAIL@example.com';

-- Update the auth.users metadata (important for consistency)
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email = 'YOUR_USER_EMAIL@example.com';
```

3. Verify the admin was set:

```sql
SELECT id, full_name, email_address, role
FROM user_profiles
WHERE role = 'admin';
```

#### Method 2: Using Table Editor

1. Go to Supabase Dashboard → Table Editor
2. Navigate to the `user_profiles` table
3. Find your user by email
4. Click on the `role` column for your user
5. Change it from `client` to `admin`
6. Save the changes
7. **Important**: Also update the `auth.users` table:
   - Go to Authentication → Users
   - Find your user
   - Click on the three dots → "Edit User"
   - In the "User Metadata" section, add: `{"role": "admin"}`

### Step 3: Verify Admin Access

1. Log out and log back in to refresh your session
2. You should now see an "Admin Panel" link in the navigation menu
3. Click on it to access admin features

## Managing Admin Roles (After Setup)

Once you have at least one admin, you can manage other admins through the UI:

### Grant Admin Role to a User

1. Navigate to **Admin Panel** → **Manage Users**
2. Find the user you want to promote
3. Click the **"Grant Admin"** button next to their name
4. Confirm the action

### Revoke Admin Role from a User

1. Navigate to **Admin Panel** → **Manage Users**
2. Find the admin you want to demote
3. Click the **"Revoke Admin"** button next to their name
4. Confirm the action

**Note**: You cannot:
- Revoke your own admin role (to prevent locking yourself out)
- Revoke the last remaining admin role (at least one admin must exist)

## Database Functions

The migration creates several useful functions:

### `is_current_user_admin()`
Returns `true` if the current authenticated user is an admin.

```sql
SELECT is_current_user_admin();
```

### `grant_admin_role(user_id UUID)`
Promotes a user to admin. Only admins can execute this.

```sql
SELECT grant_admin_role('user-uuid-here');
```

Returns JSON with success status and message.

### `revoke_admin_role(user_id UUID)`
Demotes an admin to client. Only admins can execute this.

```sql
SELECT revoke_admin_role('user-uuid-here');
```

Returns JSON with success status and message.

### `get_all_admins()`
Returns a list of all admin users. Only admins can execute this.

```sql
SELECT * FROM get_all_admins();
```

### `get_all_users(search_query, role_filter, limit_count, offset_count)`
Returns a paginated list of users with filtering. Only admins can execute this.

```sql
-- Get all users
SELECT * FROM get_all_users('', 'all', 50, 0);

-- Search for users named "John"
SELECT * FROM get_all_users('John', 'all', 50, 0);

-- Get only admins
SELECT * FROM get_all_users('', 'admin', 50, 0);
```

## Frontend Integration

### Check if User is Admin

The user's role is automatically loaded in the `AuthContext` and available in components:

```typescript
import { useAuth } from './contexts/AuthContext';

function MyComponent() {
  const { user } = useAuth();

  if (user?.role === 'admin') {
    // Show admin-only features
  }
}
```

### Admin Service

Use the `adminService` for programmatic role management:

```typescript
import { adminService } from './services/adminService';

// Check if current user is admin
const isAdmin = await adminService.isCurrentUserAdmin();

// Grant admin role
const result = await adminService.grantAdminRole(userId);
if (result.success) {
  console.log(result.message);
}

// Get all admins
const admins = await adminService.getAllAdmins();

// Get all users with filtering
const users = await adminService.getAllUsers('john', 'all', 50, 0);
```

### Protecting Admin Routes

Admin routes are automatically protected using the `AdminRoute` component:

```typescript
<Route path="/admin/users" element={
  <AdminRoute>
    <AdminUsersPage />
  </AdminRoute>
} />
```

Non-admin users will see an "Access Denied" page if they try to access admin routes.

## Security Features

1. **Row Level Security (RLS)**: All database operations respect RLS policies. Admins can access all data, regular users can only access their own data.

2. **Function Security**: All admin functions use `SECURITY DEFINER` and check permissions internally.

3. **Audit Trail**: All role changes update timestamps in `user_profiles` table for tracking.

4. **Metadata Sync**: User roles are kept in sync between `user_profiles.role` and `auth.users.raw_user_meta_data`.

5. **Validation**: Built-in checks prevent:
   - Non-admins from using admin functions
   - Self-demotion
   - Removing the last admin

## Troubleshooting

### "Access Denied" after setting admin role

**Solution**: Log out and log back in to refresh your session with the new role.

### Admin functions return "permission denied"

**Solution**: Ensure you:
1. Ran the migration completely
2. Set the role in both `user_profiles` AND `auth.users.raw_user_meta_data`
3. Logged out and back in

### Role not syncing between tables

**Solution**: Run this query to manually sync:

```sql
-- Sync from auth.users to user_profiles
UPDATE user_profiles
SET role = COALESCE(auth.users.raw_user_meta_data->>'role', 'client')
FROM auth.users
WHERE user_profiles.id = auth.users.id;

-- Sync from user_profiles to auth.users
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) ||
    json_build_object('role', user_profiles.role)::jsonb
FROM user_profiles
WHERE auth.users.id = user_profiles.id;
```

### Cannot grant admin to new users

**Solution**: Verify you're currently an admin:

```sql
SELECT full_name, email_address, role
FROM user_profiles
WHERE id = auth.uid();
```

## Best Practices

1. **Limit Admin Access**: Only grant admin roles to trusted team members
2. **Regular Audits**: Periodically review the list of admins
3. **Use UI for Management**: After initial setup, use the admin UI rather than direct SQL
4. **Keep Backups**: Before making bulk role changes, backup your database
5. **Monitor Activity**: Check `user_profiles.profile_updated_at` for recent role changes

## Support

If you encounter issues not covered in this guide:
1. Check the browser console for JavaScript errors
2. Check Supabase logs for database errors
3. Verify all migrations have been applied
4. Ensure RLS policies are enabled on relevant tables
