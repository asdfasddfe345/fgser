/*
  # Create Company Logos Storage Bucket
  
  1. Storage Setup
    - Create `company-logos` storage bucket for job listing company images
    - Set bucket to public access for displaying images on job pages
    - Configure size limits and allowed file types
  
  2. Security Policies
    - Allow public READ access for all users to view company logos
    - Allow INSERT/UPDATE/DELETE only for admin users
    - Validate file types and sizes at policy level
  
  3. Notes
    - Images will be publicly accessible via URL
    - Admins can upload PNG, JPG, JPEG files up to 5MB
    - Storage bucket policies work independently from table RLS
*/

-- Create the storage bucket for company logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  true,
  5242880, -- 5MB in bytes
  ARRAY['image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public READ access to company logos (anyone can view)
CREATE POLICY "Public can view company logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-logos');

-- Allow authenticated admin users to INSERT company logos
CREATE POLICY "Admins can upload company logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos' 
  AND (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  )
);

-- Allow authenticated admin users to UPDATE company logos
CREATE POLICY "Admins can update company logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  )
);

-- Allow authenticated admin users to DELETE company logos
CREATE POLICY "Admins can delete company logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  )
);