import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SubscribedUser {
  user_id: string;
  user_email: string;
  preferred_domains: string[];
  last_sent_at: string | null;
}

interface JobForDigest {
  job_id: string;
  company_name: string;
  role_title: string;
  domain: string;
  application_link: string;
  posted_date: string;
  location_type: string;
  package_amount: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting daily job digest processor...');

    // Get all subscribed users
    const { data: subscriptions, error: subsError } = await supabase
      .from('job_notification_subscriptions')
      .select(`
        user_id,
        preferred_domains,
        last_sent_at
      `)
      .eq('is_subscribed', true)
      .eq('notification_frequency', 'daily');

    if (subsError) {
      throw new Error(`Failed to fetch subscriptions: ${subsError.message}`);
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No active subscriptions found');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active subscriptions to process',
          processedUsers: 0
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    console.log(`Found ${subscriptions.length} subscribed users`);

    let processedUsers = 0;
    let emailsSent = 0;
    let totalJobsSent = 0;
    const errors: string[] = [];

    // Process each user
    for (const subscription of subscriptions) {
      try {
        // Get user email from auth.users
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
          subscription.user_id
        );

        if (userError || !userData?.user?.email) {
          console.error(`Failed to get user email for ${subscription.user_id}:`, userError);
          errors.push(`User ${subscription.user_id}: Failed to fetch email`);
          continue;
        }

        const userEmail = userData.user.email;
        const userName = userData.user.user_metadata?.full_name || userData.user.email.split('@')[0];

        // Get matching jobs for this user
        const { data: jobs, error: jobsError } = await supabase
          .rpc('get_jobs_for_daily_digest', {
            p_user_id: subscription.user_id
          });

        if (jobsError) {
          console.error(`Failed to get jobs for user ${subscription.user_id}:`, jobsError);
          errors.push(`User ${subscription.user_id}: Failed to fetch jobs`);
          continue;
        }

        // Skip if no jobs found
        if (!jobs || jobs.length === 0) {
          console.log(`No matching jobs for user ${subscription.user_id}`);
          processedUsers++;
          continue;
        }

        console.log(`Found ${jobs.length} jobs for user ${subscription.user_id}`);

        // Call send-job-digest-email function
        const emailResponse = await fetch(
          `${supabaseUrl}/functions/v1/send-job-digest-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              userId: subscription.user_id,
              recipientEmail: userEmail,
              recipientName: userName,
              jobs: jobs,
              dateRange: 'Last 24 hours'
            })
          }
        );

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error(`Failed to send email to ${userEmail}:`, errorText);
          errors.push(`User ${subscription.user_id}: Failed to send email`);
          continue;
        }

        const emailResult = await emailResponse.json();
        console.log(`Successfully sent digest to ${userEmail}: ${jobs.length} jobs`);

        emailsSent++;
        totalJobsSent += jobs.length;
        processedUsers++;

      } catch (userError) {
        console.error(`Error processing user ${subscription.user_id}:`, userError);
        errors.push(`User ${subscription.user_id}: ${userError.message}`);
      }
    }

    console.log(`Daily digest processing completed:`);
    console.log(`- Processed users: ${processedUsers}/${subscriptions.length}`);
    console.log(`- Emails sent: ${emailsSent}`);
    console.log(`- Total jobs sent: ${totalJobsSent}`);
    console.log(`- Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily digest processing completed',
        stats: {
          totalSubscribers: subscriptions.length,
          processedUsers,
          emailsSent,
          totalJobsSent,
          errors: errors.length
        },
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in daily digest processor:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to process daily digest'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});