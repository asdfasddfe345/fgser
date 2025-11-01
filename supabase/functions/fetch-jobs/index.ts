import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

interface JobListing {
  company_name: string;
  company_logo_url?: string;
  role_title: string;
  package_amount?: number;
  package_type?: 'CTC' | 'stipend' | 'hourly';
  domain: string;
  location_type: 'Remote' | 'Onsite' | 'Hybrid';
  location_city?: string;
  experience_required: string;
  qualification: string;
  short_description: string;
  full_description: string;
  application_link: string;
  posted_date: string;
  source_api: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get query parameters
    const url = new URL(req.url)
    const filters = {
      domain: url.searchParams.get('domain'),
      location_type: url.searchParams.get('location_type'),
      experience_required: url.searchParams.get('experience_required'),
      package_min: url.searchParams.get('package_min'),
      package_max: url.searchParams.get('package_max'),
      search: url.searchParams.get('search'),
      sort_by: url.searchParams.get('sort_by') || 'posted_date',
      sort_order: url.searchParams.get('sort_order') || 'desc',
      limit: parseInt(url.searchParams.get('limit') || '20'),
      offset: parseInt(url.searchParams.get('offset') || '0')
    }

    // Build query
    let query = supabase
      .from('job_listings')
      .select('*')
      .eq('is_active', true)

    // Apply filters
    if (filters.domain) {
      query = query.eq('domain', filters.domain)
    }

    if (filters.location_type) {
      query = query.eq('location_type', filters.location_type)
    }

    if (filters.experience_required) {
      query = query.eq('experience_required', filters.experience_required)
    }

    if (filters.package_min) {
      query = query.gte('package_amount', parseInt(filters.package_min))
    }

    if (filters.package_max) {
      query = query.lte('package_amount', parseInt(filters.package_max))
    }

    if (filters.search) {
      query = query.or(`role_title.ilike.%${filters.search}%,company_name.ilike.%${filters.search}%`)
    }

    // Apply sorting
    const ascending = filters.sort_order === 'asc'
    query = query.order(filters.sort_by, { ascending })

    // Apply pagination
    query = query.range(filters.offset, filters.offset + filters.limit - 1)

    const { data: jobs, error } = await query

    if (error) {
      console.error('Error fetching jobs:', error)
      throw new Error('Failed to fetch job listings')
    }

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from('job_listings')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    if (countError) {
      console.error('Error counting jobs:', countError)
    }

    return new Response(
      JSON.stringify({
        jobs: jobs || [],
        total: count || 0,
        filters: filters,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          hasMore: (count || 0) > filters.offset + filters.limit
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in fetch-jobs function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        jobs: [],
        total: 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})