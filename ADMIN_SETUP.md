# Admin Setup Instructions

## Admin Credentials
- **Email:** primoboostai@gmail.com
- **Password:** Primo143@

**⚠️ SECURITY WARNING:** Change this password immediately after first login for security!

## Setup Steps

### Step 1: Create Admin Account
1. Open your application
2. Click "Sign Up"
3. Register with the admin email and password above
4. Verify your email if email confirmation is enabled

### Step 2: Grant Admin Role

#### Option A: Via Supabase Dashboard (Easiest)
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Authentication** → **Users**
4. Find user `primoboostai@gmail.com`
5. Click the user to open details
6. Scroll to **Raw User Meta Data** section
7. Edit the JSON to add the role:
   ```json
   {
     "role": "admin"
   }
   ```
8. Click **Save**

#### Option B: Via SQL Query
Run this SQL in the Supabase SQL Editor:

```sql
-- Set admin role for the user
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'primoboostai@gmail.com';
```

### Step 3: Refresh Session
1. Log out of the application
2. Log back in with admin credentials
3. You should now see "Admin Panel" in the navigation menu

## Accessing Admin Features

Once admin role is set, you can access:

- **Admin Dashboard:** `/admin/jobs`
  - View all job listings
  - Search and filter jobs
  - Quick stats overview

- **Create New Job:** `/admin/jobs/new`
  - Upload company logo
  - Fill in job details
  - Set job as active/inactive

- **Edit Job:** `/admin/jobs/:jobId/edit`
  - Update job information
  - Change company logo
  - Toggle job status

## Admin Features

### Job Management
- Create, edit, and delete job listings
- Upload company logos (PNG, JPEG, max 5MB)
- Activate/deactivate jobs
- Search by company, role, or domain
- Filter by domain and status

### Company Logo Upload
- Drag-and-drop support
- Real-time preview
- Automatic image validation
- Stored in Supabase Storage

### Security
- Protected routes (admin access only)
- Role-based access control
- Secure image upload policies
- Activity logging

## Troubleshooting

### Admin Panel Not Showing
1. Verify admin role is set in user metadata
2. Log out and log back in
3. Check browser console for errors
4. Verify you're logged in with the admin account

### Cannot Upload Images
1. Check Supabase Storage bucket exists: `company-logos`
2. Verify storage policies are applied
3. Ensure image is PNG/JPEG and under 5MB
4. Check network tab for upload errors

### Jobs Not Displaying
1. Check if `job_listings` table exists
2. Verify RLS policies allow read access
3. Check if jobs are marked as `is_active = true`
4. Look for console errors

## Security Best Practices

1. **Change the default password** immediately
2. Use strong, unique passwords
3. Enable two-factor authentication (if available)
4. Don't share admin credentials
5. Regularly audit admin actions
6. Keep admin accounts to a minimum

## Support

If you encounter issues:
1. Check browser console for errors
2. Review Supabase logs
3. Verify database migrations are applied
4. Ensure RLS policies are configured correctly
