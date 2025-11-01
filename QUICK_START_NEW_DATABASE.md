# Quick Start Guide - New Database Setup

## 🎯 Your New Database

**URL**: `https://rixmudvtbfkjpwjoefon.supabase.co`
**Status**: ✅ Environment configured, ⚠️ Migrations pending

---

## ⚡ 3 Steps to Complete Migration

### Step 1: Apply Migrations (5-10 minutes)
1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/rixmudvtbfkjpwjoefon/sql/new)
2. Copy & paste each migration file from `supabase/migrations/` folder
3. Click "Run" for each migration (start with oldest: `20250622114242_empty_shrine.sql`)
4. Continue through all 32 migrations in order

**Quick tip**: A combined migration file is available at `/tmp/combined_migration.sql` (5125 lines)

### Step 2: Set Up Admin User (1 minute)
1. Sign up at your app with email: `primoboostai@gmail.com`
2. Run this SQL in the editor:
```sql
-- Set admin role
DO $$
DECLARE admin_user_id uuid;
BEGIN
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'primoboostai@gmail.com';
  IF admin_user_id IS NOT NULL THEN
    UPDATE auth.users SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb WHERE id = admin_user_id;
    INSERT INTO user_profiles (id, full_name, email_address, role, is_active, profile_created_at, profile_updated_at)
    SELECT admin_user_id, 'Admin User', 'primoboostai@gmail.com', 'admin', true, now(), now()
    FROM auth.users WHERE id = admin_user_id
    ON CONFLICT (id) DO UPDATE SET role = 'admin';
  END IF;
END $$;
```

### Step 3: Test Your App (2 minutes)
1. Restart dev server: `npm run dev`
2. Visit the application
3. Try signing up with a test account
4. Verify profile creation works
5. Test admin panel access

---

## 📋 What's Already Done

✅ Environment variables updated in `.env`
✅ All application code points to new database
✅ Build verified and working
✅ No hardcoded URLs remaining
✅ Documentation created

---

## 🔍 Quick Verification Commands

Run these in Supabase SQL Editor after applying migrations:

```sql
-- Check tables exist
SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';
-- Expected: 15+ tables

-- Check functions exist
SELECT COUNT(*) as function_count FROM information_schema.routines WHERE routine_schema = 'public';
-- Expected: 10+ functions

-- Check storage buckets
SELECT COUNT(*) as bucket_count FROM storage.buckets;
-- Expected: 3 buckets (company-logos, resume-files, optimized-resumes)
```

---

## 🆘 Need Help?

**Migration not working?**
- Ensure you apply migrations in chronological order (oldest first)
- Check for error messages in SQL Editor
- See `MIGRATION_INSTRUCTIONS.md` for detailed troubleshooting

**Admin access not working?**
- Ensure you signed up with primoboostai@gmail.com first
- Run the admin setup SQL again
- Check `DATABASE_SETUP_GUIDE.md` for more details

**App not connecting?**
- Restart dev server after updating .env
- Clear browser cache and local storage
- Check browser console for errors

---

## 📚 Full Documentation

- **Complete Migration Guide**: `MIGRATION_INSTRUCTIONS.md`
- **Admin Setup Guide**: `DATABASE_SETUP_GUIDE.md`
- **Migration Summary**: `DATABASE_MIGRATION_COMPLETE.md`

---

## 🎉 After Setup Complete

Your PrimoBoost AI application will be running on the new production database with:
- Full user authentication system
- Payment and subscription management
- Job listing and application features
- Admin panel with full CRUD access
- Resume optimization tools
- Wallet and referral system
- Auto-apply functionality
- And more!

**Estimated Total Time**: 10-15 minutes

---

*Ready to migrate? Start with Step 1! 🚀*
