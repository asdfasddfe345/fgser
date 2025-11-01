import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Origin, X-Automation-Mode",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const applicationId = pathParts[pathParts.length - 1];

    if (!applicationId || applicationId === 'auto-apply-status') {
      return new Response(
        JSON.stringify({
          status: 'not_found',
          error: 'Application ID is required',
          progress: 0,
          currentStep: 'Invalid request',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(applicationId)) {
      return new Response(
        JSON.stringify({
          status: 'not_found',
          error: 'Invalid application ID format',
          progress: 0,
          currentStep: 'Invalid ID format',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: autoApplyLog, error } = await supabase
      .from('auto_apply_logs')
      .select('*')
      .eq('id', applicationId)
      .maybeSingle();

    if (error) {
      console.error('Database error fetching auto_apply_log:', error);
      return new Response(
        JSON.stringify({
          status: 'not_found',
          error: 'Database error occurred',
          progress: 0,
          currentStep: 'Error checking status',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!autoApplyLog) {
      return new Response(
        JSON.stringify({
          status: 'not_found',
          error: 'Application record not found',
          progress: 0,
          currentStep: 'Application not found',
          applicationId: applicationId,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const createdAt = new Date(autoApplyLog.application_date).getTime();
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - createdAt) / 1000);

    let status: 'pending' | 'processing' | 'completed' | 'failed' | 'not_found' = 'pending';
    let progress = 0;
    let currentStep = 'Initializing...';
    let estimatedTimeRemaining = 120;

    if (autoApplyLog.status === 'submitted') {
      status = 'completed';
      progress = 100;
      currentStep = 'Application submitted successfully';
      estimatedTimeRemaining = 0;
    } else if (autoApplyLog.status === 'failed') {
      status = 'failed';
      progress = 0;
      currentStep = 'Application failed';
      estimatedTimeRemaining = 0;
    } else if (autoApplyLog.status === 'pending' && elapsedSeconds < 120) {
      status = 'processing';

      if (elapsedSeconds < 10) {
        progress = 10;
        currentStep = 'Analyzing application form...';
        estimatedTimeRemaining = 110;
      } else if (elapsedSeconds < 30) {
        progress = 30;
        currentStep = 'Filling personal details...';
        estimatedTimeRemaining = 90;
      } else if (elapsedSeconds < 60) {
        progress = 60;
        currentStep = 'Uploading resume...';
        estimatedTimeRemaining = 60;
      } else if (elapsedSeconds < 90) {
        progress = 80;
        currentStep = 'Submitting application...';
        estimatedTimeRemaining = 30;
      } else {
        progress = 95;
        currentStep = 'Capturing confirmation...';
        estimatedTimeRemaining = 5;
      }
    } else {
      status = 'processing';
      progress = 95;
      currentStep = 'Finalizing submission...';
      estimatedTimeRemaining = 5;
    }

    return new Response(
      JSON.stringify({
        status,
        progress,
        currentStep,
        estimatedTimeRemaining,
        applicationId: autoApplyLog.id,
        jobId: autoApplyLog.job_listing_id,
        screenshotUrl: autoApplyLog.screenshot_url,
        errorMessage: autoApplyLog.error_message,
        elapsedSeconds,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in auto-apply-status:', error);
    return new Response(
      JSON.stringify({
        status: 'not_found',
        error: error.message || 'Internal server error',
        progress: 0,
        currentStep: 'Error occurred',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
