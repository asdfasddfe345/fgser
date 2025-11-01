import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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

    // Get query parameters
    const url_obj = new URL(req.url)
    const limit = parseInt(url_obj.searchParams.get('limit') || '50')
    const offset = parseInt(url_obj.searchParams.get('offset') || '0')
    const status_filter = url_obj.searchParams.get('status')
    const method_filter = url_obj.searchParams.get('method')

    // Get application history using the database function
    const { data: applications, error: historyError } = await supabase
      .rpc('get_user_application_history', { user_uuid: user.id })

    if (historyError) {
      console.error('Error fetching application history:', historyError)
      throw new Error('Failed to fetch application history')
    }

    let filteredApplications = applications || []

    // Apply filters
    if (status_filter) {
      filteredApplications = filteredApplications.filter(app => app.status === status_filter)
    }

    if (method_filter) {
      filteredApplications = filteredApplications.filter(app => app.application_method === method_filter)
    }

    // Apply pagination
    const total = filteredApplications.length
    const paginatedApplications = filteredApplications.slice(offset, offset + limit)

    // Get statistics
    const stats = {
      total: total,
      manual: filteredApplications.filter(app => app.application_method === 'manual').length,
      auto: filteredApplications.filter(app => app.application_method === 'auto').length,
      submitted: filteredApplications.filter(app => app.status === 'submitted').length,
      pending: filteredApplications.filter(app => app.status === 'pending').length,
      failed: filteredApplications.filter(app => app.status === 'failed').length
    }

    return new Response(
      JSON.stringify({
        applications: paginatedApplications,
        stats: stats,
        pagination: {
          limit: limit,
          offset: offset,
          total: total,
          hasMore: offset + limit < total
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in get-application-history function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        applications: [],
        stats: { total: 0, manual: 0, auto: 0, submitted: 0, pending: 0, failed: 0 },
        pagination: { limit: 0, offset: 0, total: 0, hasMore: false }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})