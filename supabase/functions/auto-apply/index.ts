import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-origin, x-automation-mode',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface AutoApplyRequest {
  jobId: string;
  optimizedResumeId: string;
}

interface ExternalBrowserServicePayload {
  applicationUrl: string;
  userData: {
    fullName: string;
    email: string;
    phone: string;
    linkedin?: string;
    github?: string;
    location?: string;
    education: any[];
    workExperience: any[];
    skills: any[];
    certifications: any[];
    summary?: string;
    careerObjective?: string;
  };
  resumeFileUrl: string;
  jobDetails: {
    title: string;
    company: string;
    domain: string;
    experience: string;
    qualification: string;
    applicationUrl: string;
  };
  metadata: {
    userId: string;
    jobId: string;
    optimizedResumeId: string;
    timestamp: string;
    userAgent?: string;
    sessionId?: string;
  };
}

interface ExternalBrowserServiceResponse {
  success: boolean;
  message: string;
  status: 'submitted' | 'failed' | 'partial';
  screenshotUrl?: string;
  error?: string;
  formFieldsFilled?: {
    [fieldName: string]: string;
  };
  applicationConfirmationText?: string;
  redirectUrl?: string;
  processingTimeMs?: number;
  browserLogs?: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let autoApplyLogId: string | null = null;

  try {
    const { jobId, optimizedResumeId }: AutoApplyRequest = await req.json()

    // Validate input
    if (!jobId || !optimizedResumeId) {
      throw new Error('Missing jobId or optimizedResumeId')
    }

    console.log(`[${new Date().toISOString()}] Auto-apply started for job: ${jobId}, resume: ${optimizedResumeId}`)

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

    console.log(`[${new Date().toISOString()}] Job details fetched: ${job.role_title} at ${job.company_name}`)

    // Get optimized resume
    const { data: optimizedResume, error: resumeError } = await supabase
      .from('optimized_resumes')
      .select('*')
      .eq('id', optimizedResumeId)
      .eq('user_id', user.id)
      .single()

    if (resumeError || !optimizedResume) {
      throw new Error('Optimized resume not found')
    }

    console.log(`[${new Date().toISOString()}] Optimized resume fetched with score: ${optimizedResume.optimization_score}`)

    // Create auto apply log entry (pending status)
    const { data: autoApplyLog, error: logError } = await supabase
      .from('auto_apply_logs')
      .insert({
        user_id: user.id,
        job_listing_id: jobId,
        optimized_resume_id: optimizedResumeId,
        application_date: new Date().toISOString(),
        status: 'pending',
        form_data_snapshot: optimizedResume.resume_content
      })
      .select('id')
      .single()

    if (logError) {
      console.error('Error creating auto apply log:', logError)
      throw new Error('Failed to initiate auto-apply process')
    }

    autoApplyLogId = autoApplyLog.id
    console.log(`[${new Date().toISOString()}] Auto-apply log created with ID: ${autoApplyLogId}`)

    // Prepare payload for external headless browser service
    const resumeContent = optimizedResume.resume_content
    const externalServicePayload: ExternalBrowserServicePayload = {
      applicationUrl: job.application_link,
      userData: {
        fullName: resumeContent.name || '',
        email: resumeContent.email || '',
        phone: resumeContent.phone || '',
        linkedin: resumeContent.linkedin,
        github: resumeContent.github,
        location: resumeContent.location,
        education: resumeContent.education || [],
        workExperience: resumeContent.workExperience || [],
        skills: resumeContent.skills || [],
        certifications: resumeContent.certifications || [],
        summary: resumeContent.summary,
        careerObjective: resumeContent.careerObjective,
      },
      resumeFileUrl: optimizedResume.pdf_url || optimizedResume.docx_url || '',
      jobDetails: {
        title: job.role_title,
        company: job.company_name,
        domain: job.domain,
        experience: job.experience_required,
        qualification: job.qualification,
        applicationUrl: job.application_link,
      },
      metadata: {
        userId: user.id,
        jobId: jobId,
        optimizedResumeId: optimizedResumeId,
        timestamp: new Date().toISOString(),
      }
    }

    console.log(`[${new Date().toISOString()}] Payload prepared for external browser service`)

    // Detect platform from application URL
    let platformDetected = 'unknown'
    const appUrl = job.application_link.toLowerCase()
    if (appUrl.includes('linkedin')) platformDetected = 'linkedin'
    else if (appUrl.includes('workday')) platformDetected = 'workday'
    else if (appUrl.includes('naukri')) platformDetected = 'naukri'
    else if (appUrl.includes('greenhouse')) platformDetected = 'greenhouse'
    else if (appUrl.includes('lever')) platformDetected = 'lever'
    else if (appUrl.includes('indeed')) platformDetected = 'indeed'

    // Update log with platform detection
    await supabase
      .from('auto_apply_logs')
      .update({
        platform_detected: platformDetected,
        automation_mode: 'headless'
      })
      .eq('id', autoApplyLogId)

    // Get external browser service URL from environment
    const externalServiceUrl = Deno.env.get('EXTERNAL_BROWSER_SERVICE_URL')
    const externalServiceApiKey = Deno.env.get('EXTERNAL_SERVICE_API_KEY')
    const browserWs = Deno.env.get('BROWSER_WS')

    // Check if browserless automation is available
    const hasBrowserless = !!browserWs && browserWs.length > 0
    const hasExternalService = !!externalServiceUrl && externalServiceUrl.length > 0

    if (!hasBrowserless && !hasExternalService) {
      console.warn('No browser automation configured, returning error...')

      // Update log as failed
      await supabase
        .from('auto_apply_logs')
        .update({
          status: 'failed',
          error_message: 'Browser automation not configured. Please set up BROWSER_WS or EXTERNAL_BROWSER_SERVICE_URL environment variable.',
          automation_mode: 'simulation'
        })
        .eq('id', autoApplyLogId)

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Browser automation is not configured. Please contact support or apply manually.',
          applicationId: autoApplyLogId,
          status: 'failed',
          error: 'Browser automation service not available',
          resumeUrl: optimizedResume.pdf_url,
          fallbackUrl: job.application_link
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 503,
        },
      )
    }

    // Call external headless browser service
    try {
      console.log(`[${new Date().toISOString()}] Calling external browser service at: ${externalServiceUrl}`)
      
      const externalResponse = await fetch(`${externalServiceUrl}/auto-apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${externalServiceApiKey || 'fallback-key'}`,
          'X-Origin': 'primoboost-ai',
        },
        body: JSON.stringify(externalServicePayload),
        signal: AbortSignal.timeout(180000), // 3 minute timeout for browser automation
      })

      if (!externalResponse.ok) {
        const errorText = await externalResponse.text()
        console.error(`External service error: ${externalResponse.status}`, errorText)
        throw new Error(`External browser service failed: ${externalResponse.status}`)
      }

      const externalResult: ExternalBrowserServiceResponse = await externalResponse.json()
      console.log(`[${new Date().toISOString()}] External service response:`, externalResult.success ? 'SUCCESS' : 'FAILED')

      // Update auto apply log with actual results
      const { error: updateError } = await supabase
        .from('auto_apply_logs')
        .update({
          status: externalResult.status,
          screenshot_url: externalResult.screenshotUrl,
          error_message: externalResult.error,
        })
        .eq('id', autoApplyLogId)

      if (updateError) {
        console.error('Error updating auto apply log:', updateError)
      }

      return new Response(
        JSON.stringify({
          success: externalResult.success,
          message: externalResult.message,
          applicationId: autoApplyLogId,
          status: externalResult.status,
          screenshotUrl: externalResult.screenshotUrl,
          resumeUrl: optimizedResume.pdf_url,
          error: externalResult.error,
          formFieldsFilled: externalResult.formFieldsFilled,
          confirmationText: externalResult.applicationConfirmationText
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: externalResult.success ? 200 : 400,
        },
      )

    } catch (externalError) {
      console.error('Error calling external browser service:', externalError)
      
      // Update log as failed
      if (autoApplyLogId) {
        await supabase
          .from('auto_apply_logs')
          .update({
            status: 'failed',
            error_message: `External service error: ${externalError.message}`,
          })
          .eq('id', autoApplyLogId)
      }

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Auto-apply failed due to external service error',
          applicationId: autoApplyLogId,
          status: 'failed',
          error: externalError.message,
          fallbackUrl: job.application_link,
          resumeUrl: optimized_resume.pdf_url
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        },
      )
    }

  } catch (error) {
    console.error('Error in auto-apply function:', error)
    
    // Update log as failed if we have the ID
    if (autoApplyLogId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      
      await supabase
        .from('auto_apply_logs')
        .update({
          status: 'failed',
          error_message: error.message || 'Unknown error during auto-apply',
        })
        .eq('id', autoApplyLogId)
    }

    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Internal server error',
        applicationId: autoApplyLogId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})