import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface OptimizeResumeRequest {
  jobId: string;
  userResumeText?: string; // Optional: user can provide their own resume text
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { jobId, userResumeText }: OptimizeResumeRequest = await req.json()

    // Validate input
    if (!jobId) {
      throw new Error('Job ID is required')
    }

    // Get user from auth header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      throw new Error('Invalid user token')
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('job_listings')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      throw new Error('Job not found')
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .rpc('get_user_auto_apply_profile', { user_uuid: user.id })

    if (profileError || !userProfile || userProfile.length === 0) {
      throw new Error('User profile not found')
    }

    const profile = userProfile[0]

    // Check if resume for this job already exists
    const { data: existingResume, error: existingError } = await supabase
      .from('optimized_resumes')
      .select('*')
      .eq('user_id', user.id)
      .eq('job_listing_id', jobId)
      .maybeSingle()

    if (existingError) {
      console.error('Error checking existing resume:', existingError)
    }

    if (existingResume) {
      // Return existing optimized resume
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Resume already optimized for this job',
          resumeId: existingResume.id,
          resumeContent: existingResume.resume_content,
          pdfUrl: existingResume.pdf_url,
          docxUrl: existingResume.docx_url,
          optimizationScore: existingResume.optimization_score,
          cached: true
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    // Build resume text from user profile or use provided text
    const resumeText = userResumeText || buildResumeFromProfile(profile)

    // Simulate AI optimization (in real implementation, call OpenRouter API)
    const optimizedResumeData = await optimizeResumeWithAI(resumeText, job.full_description, profile)

    // Calculate optimization score
    const optimizationScore = Math.floor(Math.random() * 20) + 80 // Simulated score 80-100

    // Save optimized resume to database
    const { data: newResume, error: saveError } = await supabase
      .from('optimized_resumes')
      .insert({
        user_id: user.id,
        job_listing_id: jobId,
        resume_content: optimizedResumeData,
        optimization_score: optimizationScore
      })
      .select()
      .single()

    if (saveError) {
      console.error('Error saving optimized resume:', saveError)
      throw new Error('Failed to save optimized resume')
    }

    // In a real implementation, you would:
    // 1. Generate PDF and DOCX files from optimizedResumeData
    // 2. Upload them to Supabase Storage
    // 3. Update the optimized_resumes record with the file URLs

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Resume optimized successfully',
        resumeId: newResume.id,
        resumeContent: optimizedResumeData,
        pdfUrl: null, // Will be populated after file generation
        docxUrl: null, // Will be populated after file generation
        optimizationScore: optimizationScore,
        cached: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in optimize-resume-for-job function:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Internal server error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})

// Helper function to build resume text from user profile
function buildResumeFromProfile(profile: any): string {
  const sections = []

  // Personal Information
  sections.push(`Name: ${profile.full_name}`)
  sections.push(`Email: ${profile.email_address}`)
  sections.push(`Phone: ${profile.phone}`)
  if (profile.linkedin_profile_url) sections.push(`LinkedIn: ${profile.linkedin_profile_url}`)
  if (profile.github_profile_url) sections.push(`GitHub: ${profile.github_profile_url}`)
  if (profile.current_location) sections.push(`Location: ${profile.current_location}`)

  // Professional Headline
  if (profile.resume_headline) {
    sections.push(`\nPROFESSIONAL SUMMARY:\n${profile.resume_headline}`)
  }

  // Education
  if (profile.education_details) {
    sections.push('\nEDUCATION:')
    if (Array.isArray(profile.education_details)) {
      profile.education_details.forEach((edu: any) => {
        sections.push(`${edu.degree} from ${edu.school} (${edu.year})`)
        if (edu.cgpa) sections.push(`CGPA: ${edu.cgpa}`)
      })
    }
  }

  // Experience
  if (profile.experience_details) {
    sections.push('\nWORK EXPERIENCE:')
    if (Array.isArray(profile.experience_details)) {
      profile.experience_details.forEach((exp: any) => {
        sections.push(`${exp.role} at ${exp.company} (${exp.duration})`)
        if (exp.responsibilities && Array.isArray(exp.responsibilities)) {
          exp.responsibilities.forEach((resp: string) => sections.push(`• ${resp}`))
        }
      })
    }
  }

  // Skills
  if (profile.skills_details) {
    sections.push('\nSKILLS:')
    if (Array.isArray(profile.skills_details)) {
      profile.skills_details.forEach((skill: any) => {
        sections.push(`${skill.category}: ${skill.skills.join(', ')}`)
      })
    }
  }

  return sections.join('\n')
}

// Helper function to optimize resume with AI
async function optimizeResumeWithAI(resumeText: string, jobDescription: string, profile: any): Promise<any> {
  // In a real implementation, this would call OpenRouter API with a prompt
  // For now, return a structured resume object
  
  return {
    name: profile.full_name,
    phone: profile.phone,
    email: profile.email_address,
    linkedin: profile.linkedin_profile_url,
    github: profile.github_profile_url,
    location: profile.current_location,
    targetRole: extractRoleFromJobDescription(jobDescription),
    summary: profile.resume_headline,
    education: profile.education_details || [],
    workExperience: profile.experience_details || [],
    projects: [], // Could be enhanced to include projects
    skills: profile.skills_details || [],
    certifications: [],
    origin: 'jd_optimized'
  }
}

// Helper function to extract role from job description
function extractRoleFromJobDescription(jobDescription: string): string {
  // Simple extraction logic - in real implementation, use AI
  const roleKeywords = ['Developer', 'Engineer', 'Analyst', 'Manager', 'Intern', 'Associate']
  
  for (const keyword of roleKeywords) {
    if (jobDescription.toLowerCase().includes(keyword.toLowerCase())) {
      return keyword
    }
  }
  
  return 'Professional'
}