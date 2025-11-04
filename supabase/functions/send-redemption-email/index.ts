import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { EmailService, logEmailSend } from '../_shared/emailService.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, amount, redeemMethod, redeemDetails } = await req.json();

    // Validate input
    if (!userId || !amount || !redeemMethod || !redeemDetails) {
      throw new Error('Missing required redemption details.');
    }

    // Initialize Supabase client with service role key for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user via JWT from request header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authorization header missing.');
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized: Invalid user token.');
    }

    // Get user's profile for email and name
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, full_name, email_address')
      .eq('user_id', user.id)
      .single();

    if (profileError || !userProfile) {
      throw new Error('Could not fetch user profile.');
    }

    // Verify user has sufficient wallet balance
    const { data: walletData, error: walletError } = await supabase
      .from('wallet_transactions')
      .select('amount')
      .eq('user_id', userProfile.id)
      .eq('status', 'completed');

    if (walletError) {
      throw new Error('Could not fetch wallet balance.');
    }

    const currentBalance = walletData.reduce((sum, transaction) => sum + parseFloat(transaction.amount), 0);
    
    if (currentBalance < amount) {
      throw new Error('Insufficient wallet balance.');
    }

    if (amount < 100) {
      throw new Error('Minimum redemption amount is ₹100.');
    }

    // Insert redemption request into wallet_transactions table
    const { data: transaction, error: transactionError } = await supabase
      .from('wallet_transactions')
      .insert({
        user_id: userProfile.id,
        type: 'redeem',
        amount: -amount, // Amount is negative for redemption
        status: 'processing',
        redeem_method: redeemMethod,
        redeem_details: redeemDetails,
        transaction_ref: `redeem_${Date.now()}_${userProfile.id.substring(0, 8)}`,
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Error inserting redemption transaction:', transactionError);
      throw new Error('Failed to record redemption request.');
    }

    // Send redemption email to admin
    console.log(`Sending redemption email to admin for user: ${userProfile.full_name}`);
    console.log(`Amount: ₹${amount.toFixed(2)}`);
    console.log(`Method: ${redeemMethod}`);
    console.log(`Transaction ID: ${transaction.id}`);

    const emailService = new EmailService();
    const adminEmail = Deno.env.get('HR_EMAIL') || 'primoboostai@gmail.com';

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redemption Request</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4; }
    .container { background: white; border-radius: 12px; padding: 30px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 24px; }
    .details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
    .detail-row:last-child { border-bottom: none; }
    .label { font-weight: bold; color: #555; }
    .value { color: #333; }
    .amount { font-size: 32px; font-weight: bold; color: #10b981; text-align: center; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #eee; color: #777; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💰 New Redemption Request</h1>
    </div>

    <div class="amount">₹${amount.toFixed(2)}</div>

    <div class="details">
      <h3 style="margin-top: 0; color: #10b981;">User Details:</h3>
      <div class="detail-row">
        <span class="label">Name:</span>
        <span class="value">${userProfile.full_name}</span>
      </div>
      <div class="detail-row">
        <span class="label">Email:</span>
        <span class="value">${userProfile.email_address}</span>
      </div>
      <div class="detail-row">
        <span class="label">User ID:</span>
        <span class="value">${userProfile.id}</span>
      </div>
    </div>

    <div class="details">
      <h3 style="margin-top: 0; color: #10b981;">Redemption Details:</h3>
      <div class="detail-row">
        <span class="label">Method:</span>
        <span class="value">${redeemMethod}</span>
      </div>
      <div class="detail-row">
        <span class="label">Details:</span>
        <span class="value">${JSON.stringify(redeemDetails)}</span>
      </div>
      <div class="detail-row">
        <span class="label">Transaction ID:</span>
        <span class="value">${transaction.id}</span>
      </div>
      <div class="detail-row">
        <span class="label">Transaction Ref:</span>
        <span class="value">${transaction.transaction_ref}</span>
      </div>
      <div class="detail-row">
        <span class="label">Status:</span>
        <span class="value" style="color: #f59e0b; font-weight: bold;">PROCESSING</span>
      </div>
    </div>

    <div class="footer">
      <p><strong>Action Required:</strong> Please process this redemption within 2 hours.</p>
      <p style="margin-top: 15px;">This is an automated notification from PrimoBoost AI Redemption System.</p>
    </div>
  </div>
</body>
</html>
    `;

    const subject = `New Redemption Request - ₹${amount.toFixed(2)} - ${userProfile.full_name}`;

    const emailResult = await emailService.sendEmail({
      to: adminEmail,
      subject: subject,
      html: emailHtml,
    });

    await logEmailSend(
      supabase,
      userProfile.id,
      'redemption',
      adminEmail,
      subject,
      emailResult.success ? 'sent' : 'failed',
      emailResult.error
    );

    if (!emailResult.success) {
      console.error('Failed to send redemption email:', emailResult.error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Redemption request submitted successfully. The money will be credited to your account within 2 hours.',
        transactionId: transaction.id,
        emailSent: emailResult.success
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Redemption request failed:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});