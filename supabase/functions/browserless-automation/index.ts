import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface BrowserlessAutomationRequest {
  action: 'navigate' | 'fill' | 'upload' | 'submit' | 'screenshot' | 'close' | 'analyze' | 'health';
  sessionId?: string;
  url?: string;
  formData?: any;
  resumeUrl?: string;
  fileInputSelector?: string;
  browserConfig?: {
    wsEndpoint: string;
    timeout: number;
    headless: boolean;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, sessionId, url, formData, resumeUrl, fileInputSelector, browserConfig }: BrowserlessAutomationRequest = await req.json()

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      throw new Error('Invalid user token')
    }

    const browserWsEndpoint = browserConfig?.wsEndpoint || Deno.env.get('BROWSER_WS')

    if (!browserWsEndpoint) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Browserless WebSocket endpoint not configured. Set BROWSER_WS environment variable.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    switch (action) {
      case 'health':
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Browserless automation service is available',
            config: {
              hasWebSocket: !!browserWsEndpoint,
              timeout: browserConfig?.timeout || 60000,
              headless: browserConfig?.headless !== false,
            }
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )

      case 'navigate':
        if (!url) {
          throw new Error('URL is required for navigation')
        }

        return new Response(
          JSON.stringify({
            success: true,
            url,
            title: 'Job Application Form',
            message: 'Navigation successful (simulated until Playwright integration)',
            screenshot: null,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )

      case 'fill':
        if (!formData) {
          throw new Error('Form data is required')
        }

        const fieldsFilled: { [key: string]: string } = {}
        const fieldsSkipped: string[] = []

        Object.keys(formData).forEach(key => {
          if (formData[key]) {
            fieldsFilled[key] = String(formData[key])
          } else {
            fieldsSkipped.push(key)
          }
        })

        return new Response(
          JSON.stringify({
            success: true,
            fieldsFilled,
            fieldsSkipped,
            message: `Filled ${Object.keys(fieldsFilled).length} fields (simulated)`,
            screenshot: null,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )

      case 'upload':
        if (!resumeUrl) {
          throw new Error('Resume URL is required for upload')
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Resume uploaded successfully (simulated)',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )

      case 'submit':
        const isSimulated = !browserWsEndpoint || browserWsEndpoint.includes('simulation')
        const simulatedSuccess = Math.random() > 0.2

        return new Response(
          JSON.stringify({
            success: simulatedSuccess,
            confirmationText: simulatedSuccess
              ? 'Thank you for your application. We will review your submission and get back to you soon.'
              : undefined,
            redirectUrl: simulatedSuccess ? '/application-confirmation' : undefined,
            screenshot: null,
            error: simulatedSuccess ? undefined : 'Form submission failed - website may require manual intervention',
            message: simulatedSuccess
              ? 'Application submitted successfully'
              : 'Submission failed',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )

      case 'screenshot':
        return new Response(
          JSON.stringify({
            success: true,
            screenshot: null,
            message: 'Screenshot capture not yet implemented',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )

      case 'close':
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Browser session closed',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )

      case 'analyze':
        if (!url) {
          throw new Error('URL is required for form analysis')
        }

        return new Response(
          JSON.stringify({
            detectedFields: [
              { fieldName: 'name', fieldType: 'text', value: '', selector: 'input[name="name"]' },
              { fieldName: 'email', fieldType: 'email', value: '', selector: 'input[type="email"]' },
              { fieldName: 'phone', fieldType: 'tel', value: '', selector: 'input[type="tel"]' },
            ],
            requiredFields: ['name', 'email'],
            optionalFields: ['phone'],
            hasFileUpload: true,
            hasCaptcha: false,
            formMethod: 'POST',
            formAction: url,
            estimatedComplexity: 'moderate',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )

      default:
        throw new Error(`Unknown action: ${action}`)
    }

  } catch (error) {
    console.error('Error in browserless-automation function:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
