-- ============================================================================
-- Database Migration Verification Script
-- ============================================================================
-- Run this script in Supabase SQL Editor after applying all migrations
-- to verify the database is set up correctly.
--
-- Expected results are indicated in comments
-- ============================================================================

-- ============================================================================
-- SECTION 1: TABLE VERIFICATION
-- ============================================================================
SELECT '=== TABLE VERIFICATION ===' as section;

-- Check all tables exist
SELECT
  'Tables Created' as check_name,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) >= 15 THEN '✅ PASS'
    ELSE '❌ FAIL - Expected 15+ tables'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public';

-- List all tables
SELECT
  'Table List' as info,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================================================
-- SECTION 2: FUNCTION VERIFICATION
-- ============================================================================
SELECT '=== FUNCTION VERIFICATION ===' as section;

-- Check if key functions exist
SELECT
  'Functions Created' as check_name,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) >= 10 THEN '✅ PASS'
    ELSE '❌ FAIL - Expected 10+ functions'
  END as status
FROM information_schema.routines
WHERE routine_schema = 'public';

-- Check critical admin functions
SELECT
  'Critical Admin Functions' as check_name,
  CASE
    WHEN (
      SELECT COUNT(*) FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name IN ('is_current_user_admin', 'debug_admin_status', 'sync_user_admin_role')
    ) = 3 THEN '✅ PASS - All admin functions exist'
    ELSE '❌ FAIL - Missing admin functions'
  END as status;

-- List all functions
SELECT
  'Function List' as info,
  routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- ============================================================================
-- SECTION 3: STORAGE BUCKET VERIFICATION
-- ============================================================================
SELECT '=== STORAGE BUCKET VERIFICATION ===' as section;

-- Check if storage buckets exist
SELECT
  'Storage Buckets' as check_name,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) >= 3 THEN '✅ PASS'
    ELSE '❌ FAIL - Expected 3 buckets'
  END as status
FROM storage.buckets;

-- List all buckets with their public/private status
SELECT
  'Bucket List' as info,
  name,
  CASE WHEN public THEN 'Public' ELSE 'Private' END as access
FROM storage.buckets
ORDER BY name;

-- ============================================================================
-- SECTION 4: RLS POLICY VERIFICATION
-- ============================================================================
SELECT '=== RLS POLICY VERIFICATION ===' as section;

-- Check if RLS policies exist
SELECT
  'RLS Policies' as check_name,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) >= 40 THEN '✅ PASS'
    ELSE '⚠️ WARNING - Expected 40+ policies'
  END as status
FROM pg_policies
WHERE schemaname = 'public';

-- Count policies per table
SELECT
  'Policies Per Table' as info,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- SECTION 5: CRITICAL TABLE STRUCTURE CHECKS
-- ============================================================================
SELECT '=== CRITICAL TABLE STRUCTURE CHECKS ===' as section;

-- Check user_profiles table has role column
SELECT
  'user_profiles.role column' as check_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'user_profiles' AND column_name = 'role'
    ) THEN '✅ PASS'
    ELSE '❌ FAIL - role column missing'
  END as status;

-- Check job_listings table exists
SELECT
  'job_listings table' as check_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'job_listings' AND table_schema = 'public'
    ) THEN '✅ PASS'
    ELSE '❌ FAIL - table missing'
  END as status;

-- Check subscriptions table exists
SELECT
  'subscriptions table' as check_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'subscriptions' AND table_schema = 'public'
    ) THEN '✅ PASS'
    ELSE '❌ FAIL - table missing'
  END as status;

-- Check payment_transactions table exists
SELECT
  'payment_transactions table' as check_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'payment_transactions' AND table_schema = 'public'
    ) THEN '✅ PASS'
    ELSE '❌ FAIL - table missing'
  END as status;

-- Check wallet_transactions table exists
SELECT
  'wallet_transactions table' as check_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'wallet_transactions' AND table_schema = 'public'
    ) THEN '✅ PASS'
    ELSE '❌ FAIL - table missing'
  END as status;

-- ============================================================================
-- SECTION 6: ADMIN USER VERIFICATION
-- ============================================================================
SELECT '=== ADMIN USER VERIFICATION ===' as section;

-- Check if admin users exist
SELECT
  'Admin Users in Profiles' as check_name,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) >= 1 THEN '✅ PASS - Admin user(s) found'
    ELSE '⚠️ WARNING - No admin users found'
  END as status
FROM user_profiles
WHERE role = 'admin';

-- List admin users (if any)
SELECT
  'Admin User List' as info,
  email_address,
  full_name,
  role,
  is_active
FROM user_profiles
WHERE role = 'admin';

-- ============================================================================
-- SECTION 7: INDEX VERIFICATION
-- ============================================================================
SELECT '=== INDEX VERIFICATION ===' as section;

-- Check if indexes exist
SELECT
  'Database Indexes' as check_name,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) >= 30 THEN '✅ PASS'
    ELSE '⚠️ WARNING - Expected 30+ indexes'
  END as status
FROM pg_indexes
WHERE schemaname = 'public';

-- ============================================================================
-- SECTION 8: TRIGGER VERIFICATION
-- ============================================================================
SELECT '=== TRIGGER VERIFICATION ===' as section;

-- Check if triggers exist
SELECT
  'Database Triggers' as check_name,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) >= 5 THEN '✅ PASS'
    ELSE '⚠️ WARNING - Expected 5+ triggers'
  END as status
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- List all triggers
SELECT
  'Trigger List' as info,
  event_object_table as table_name,
  trigger_name,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- SECTION 9: FINAL SUMMARY
-- ============================================================================
SELECT '=== FINAL SUMMARY ===' as section;

SELECT
  '📊 Migration Verification Complete' as message,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as total_tables,
  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public') as total_functions,
  (SELECT COUNT(*) FROM storage.buckets) as total_buckets,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as total_policies,
  CASE
    WHEN (
      (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') >= 15
      AND (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public') >= 10
      AND (SELECT COUNT(*) FROM storage.buckets) >= 3
    ) THEN '✅ DATABASE SETUP LOOKS GOOD!'
    ELSE '⚠️ Some checks failed - review results above'
  END as overall_status;

-- ============================================================================
-- INSTRUCTIONS
-- ============================================================================
--
-- If you see mostly ✅ PASS results:
-- 1. Your database is correctly set up!
-- 2. Set up your admin user if not done already
-- 3. Start your application and test
--
-- If you see ❌ FAIL results:
-- 1. Check which migration files are missing
-- 2. Apply the missing migrations in order
-- 3. Run this verification script again
--
-- If you see ⚠️ WARNING results:
-- 1. These are usually non-critical
-- 2. The application should still work
-- 3. Review the specific warnings to ensure they're expected
--
-- ============================================================================
