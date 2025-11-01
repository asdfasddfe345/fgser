import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface JobApplicationRequest {
  userId: string;
  jobListingId: string;
  fullName: string;
  email: string;
  phone: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  degree: string;
  institution: string;
  passedOutYear: number;
  completionDate?: string;
  cgpa?: string;
  companyName?: string;
  jobTitle?: string;
  experienceDuration?: string;
  experienceDescription?: string;
  whyGoodFit?: string;
  expectedSalary?: string;
  noticePeriod?: string;
  availableToStart?: string;
  resumeFileUrl: string;
  coverLetterUrl?: string;
  applicationMethod: 'optimized' | 'normal';
  optimizedResumeId?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const applicationData: JobApplicationRequest = await req.json();

    const requiredFields = [
      'userId',
      'jobListingId',
      'fullName',
      'email',
      'phone',
      'degree',
      'institution',
      'passedOutYear',
      'resumeFileUrl',
      'applicationMethod'
    ];

    for (const field of requiredFields) {
      if (!applicationData[field as keyof JobApplicationRequest]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(applicationData.email)) {
      throw new Error('Invalid email format');
    }

    const currentYear = new Date().getFullYear();
    if (applicationData.passedOutYear < 1980 || applicationData.passedOutYear > currentYear + 5) {
      throw new Error(`Passed out year must be between 1980 and ${currentYear + 5}`);
    }

    const { data: application, error } = await supabase
      .from('job_applications')
      .insert({
        user_id: applicationData.userId,
        job_listing_id: applicationData.jobListingId,
        full_name: applicationData.fullName,
        email: applicationData.email,
        phone: applicationData.phone,
        linkedin_url: applicationData.linkedinUrl || null,
        github_url: applicationData.githubUrl || null,
        portfolio_url: applicationData.portfolioUrl || null,
        degree: applicationData.degree,
        institution: applicationData.institution,
        passed_out_year: applicationData.passedOutYear,
        completion_date: applicationData.completionDate || null,
        cgpa: applicationData.cgpa || null,
        company_name: applicationData.companyName || null,
        job_title: applicationData.jobTitle || null,
        experience_duration: applicationData.experienceDuration || null,
        experience_description: applicationData.experienceDescription || null,
        why_good_fit: applicationData.whyGoodFit || null,
        expected_salary: applicationData.expectedSalary || null,
        notice_period: applicationData.noticePeriod || null,
        available_to_start: applicationData.availableToStart || null,
        resume_file_url: applicationData.resumeFileUrl,
        cover_letter_url: applicationData.coverLetterUrl || null,
        application_method: applicationData.applicationMethod,
        optimized_resume_id: applicationData.optimizedResumeId || null,
        status: 'pending',
        applied_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw new Error('Failed to save application to database');
    }

    console.log(`New job application saved with ID: ${application.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Application submitted successfully',
        applicationId: application.id,
        data: application
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error processing job application:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to process application';

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 400,
      }
    );
  }
});
