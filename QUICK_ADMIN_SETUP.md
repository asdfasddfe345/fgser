# Quick Admin Setup Guide

## Step 1: Apply the Migration

Go to your **Supabase Dashboard** → **SQL Editor** and run the migration:

```sql
-- Copy and paste the entire contents of:
-- supabase/migrations/20251002100000_add_admin_role_system.sql
```

Or just open that file and copy-paste it into the SQL Editor, then click **Run**.

## Step 2: Make Yourself an Admin

Replace `your.email@example.com` with your actual email address:

```sql
-- Set your role to admin
UPDATE user_profiles
SET role = 'admin'
WHERE email_address = 'your.email@example.com';

-- Update auth metadata (important!)
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email = 'your.email@example.com';
```

## Step 3: Verify

```sql
-- Check your admin status
SELECT full_name, email_address, role
FROM user_profiles
WHERE email_address = 'your.email@example.com';
```

You should see `role: admin` in the results.

## Step 4: Log Out and Back In

Log out of the application and log back in to refresh your session.

## Step 5: Access Admin Panel

You should now see:
- **"Admin Panel"** link in the navigation menu
- Click it to access:
  - **Manage Jobs**: Create, edit, delete job listings
  - **Manage Users**: View all users, grant/revoke admin roles

## Managing Other Admins

Once you're an admin, you can promote other users through the UI:

1. Go to **Admin Panel** → **Manage Users**
2. Find the user
3. Click **"Grant Admin"** button
4. Confirm

That's it! For detailed documentation, see `ADMIN_ROLE_SETUP.md`.
