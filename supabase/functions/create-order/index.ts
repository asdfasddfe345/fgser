import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface OrderRequest {
  planId?: string;
  couponCode?: string;
  walletDeduction?: number;
  addOnsTotal?: number;
  amount: number;
  selectedAddOns?: { [key: string]: number };
  // Added: allow client to request test mode explicitly
  testMode?: boolean;
  metadata?: {
    type?: 'webinar' | 'subscription';
    webinarId?: string;
    registrationId?: string;
    webinarTitle?: string;
  };
  userId?: string;
  currency?: string;
}

interface PlanConfig {
  id: string;
  name: string;
  price: number;
  mrp: number;
  discountPercentage: number;
  duration: string;
  optimizations: number;
  scoreChecks: number;
  linkedinMessages: number;
  guidedBuilds: number;
  durationInHours: number;
  tag: string;
  tagColor: string;
  gradient: string;
  icon: string;
  features: string[];
  popular?: boolean;
}

const plans: PlanConfig[] = [
  {
    id: 'leader_plan',
    name: 'Leader Plan',
    price: 6400,
    mrp: 12800,
    discountPercentage: 50,
    duration: 'One-time Purchase',
    optimizations: 100,
    scoreChecks: 100,
    linkedinMessages: 0,
    guidedBuilds: 0,
    tag: 'Top Tier',
    tagColor: 'text-purple-800 bg-purple-100',
    gradient: 'from-purple-500 to-indigo-500',
    icon: 'crown',
    features: [
      '✅ 100 Resume Optimizations',
      '✅ 100 Score Checks',
      '❌ LinkedIn Messages',
      '❌ Guided Builds',
      '✅ Priority Support',
    ],
    popular: true,
    durationInHours: 8760,
  },
  {
    id: 'achiever_plan',
    name: 'Achiever Plan',
    price: 3200,
    mrp: 6400,
    discountPercentage: 50,
    duration: 'One-time Purchase',
    optimizations: 50,
    scoreChecks: 50,
    linkedinMessages: 0,
    guidedBuilds: 0,
    tag: 'Best Value',
    tagColor: 'text-blue-800 bg-blue-100',
    gradient: 'from-blue-500 to-cyan-500',
    icon: 'zap',
    features: [
      '✅ 50 Resume Optimizations',
      '✅ 50 Score Checks',
      '❌ LinkedIn Messages',
      '❌ Guided Builds',
      '✅ Standard Support',
    ],
    popular: false,
    durationInHours: 8760,
  },
  {
    id: 'accelerator_plan',
    name: 'Accelerator Plan',
    price: 1600,
    mrp: 3200,
    discountPercentage: 50,
    duration: 'One-time Purchase',
    optimizations: 25,
    scoreChecks: 25,
    linkedinMessages: 0,
    guidedBuilds: 0,
    tag: 'Great Start',
    tagColor: 'text-green-800 bg-green-100',
    gradient: 'from-green-500 to-emerald-500',
    icon: 'rocket',
    features: [
      '✅ 25 Resume Optimizations',
      '✅ 25 Score Checks',
      '❌ LinkedIn Messages',
      '❌ Guided Builds',
      '✅ Email Support',
    ],
    popular: false,
    durationInHours: 8760,
  },
  {
    id: 'starter_plan',
    name: 'Starter Plan',
    price: 640,
    mrp: 1280,
    discountPercentage: 50,
    duration: 'One-time Purchase',
    optimizations: 10,
    scoreChecks: 10,
    linkedinMessages: 0,
    guidedBuilds: 0,
    tag: 'Quick Boost',
    tagColor: 'text-yellow-800 bg-yellow-100',
    gradient: 'from-yellow-500 to-orange-500',
    icon: 'target',
    features: [
      '✅ 10 Resume Optimizations',
      '✅ 10 Score Checks',
      '❌ LinkedIn Messages',
      '❌ Guided Builds',
      '✅ Basic Support',
    ],
    popular: false,
    durationInHours: 8760,
  },
  {
    id: 'kickstart_plan',
    name: 'Kickstart Plan',
    price: 320,
    mrp: 640,
    discountPercentage: 50,
    duration: 'One-time Purchase',
    optimizations: 5,
    scoreChecks: 5,
    linkedinMessages: 0,
    guidedBuilds: 0,
    tag: 'Essential',
    tagColor: 'text-red-800 bg-red-100',
    gradient: 'from-red-500 to-pink-500',
    icon: 'wrench',
    features: [
      '✅ 5 Resume Optimizations',
      '✅ 5 Score Checks',
      '❌ LinkedIn Messages',
      '❌ Guided Builds',
      '❌ Priority Support',
    ],
    popular: false,
    durationInHours: 8760,
  },
];

const addOns = [
  {
    id: 'jd_optimization_single_purchase',
    name: 'JD-Based Optimization (1 Use)',
    price: 49,
    type: 'optimization',
    quantity: 1,
  },
  {
    id: 'resume_score_check_single_purchase',
    name: 'Resume Score Check (1 Use)',
    price: 19,
    type: 'score_check',
    quantity: 1,
  },
];

serve(async (req) => {
  console.log(`[${new Date().toISOString()}] - Function execution started.`);
  console.log(`[${new Date().toISOString()}] - Request method: ${req.method}`);
  console.log(`[${new Date().toISOString()}] - Request headers:`, Object.fromEntries(req.headers.entries()));

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let requestBody: any;
  
  try {
    const bodyText = await req.text();
    console.log(`[${new Date().toISOString()}] - Raw request body:`, bodyText);
    requestBody = JSON.parse(bodyText);
    
    const { planId, couponCode, walletDeduction, addOnsTotal, amount: frontendCalculatedAmount, selectedAddOns, metadata, testMode } = requestBody as OrderRequest;
    
    console.log(`[${new Date().toISOString()}] - Parsed request:`, {
      planId,
      couponCode,
      walletDeduction,
      addOnsTotal,
      frontendCalculatedAmount,
      selectedAddOns,
      metadata
    });

    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error(`[${new Date().toISOString()}] - No authorization header`);
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    console.log(`[${new Date().toISOString()}] - User authentication complete. User ID: ${user?.id || 'N/A'}`);

    if (userError || !user) {
      console.error(`[${new Date().toISOString()}] - User authentication failed:`, userError);
      throw new Error('Invalid user token');
    }

    // Handle webinar payment flow
    const isWebinarPayment = metadata?.type === 'webinar';

    let originalPrice = 0; // in paise
    let finalAmount = 0;   // in paise
    let discountAmount = 0; // in paise
    let appliedCoupon: string | null = null;

    if (isWebinarPayment) {
      console.log(`[${new Date().toISOString()}] - Processing webinar payment`);

      if (!metadata?.webinarId || !metadata?.registrationId) {
        console.error(`[${new Date().toISOString()}] - Missing webinar metadata:`, metadata);
        return new Response(
          JSON.stringify({ 
            error: 'Missing required webinar information',
            details: 'webinarId and registrationId are required'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          },
        );
      }

      // Fetch authoritative webinar price from DB
      const { data: webinarRow, error: webinarErr } = await supabase
        .from('webinars')
        .select('discounted_price, title')
        .eq('id', metadata.webinarId)
        .single();

      if (webinarErr || !webinarRow) {
        console.error(`[${new Date().toISOString()}] - Unable to fetch webinar for pricing:`, webinarErr);
        return new Response(
          JSON.stringify({ error: 'Unable to fetch webinar pricing' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        );
      }

      originalPrice = Number(webinarRow.discounted_price || 0);
      if (!originalPrice || originalPrice <= 0) {
        return new Response(
          JSON.stringify({ error: 'Invalid webinar price configured' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        );
      }

      finalAmount = originalPrice;

      // Apply webinar coupon "primo" for 99% OFF
      const normalizedCoupon = (couponCode || '').toLowerCase().trim();
      if (normalizedCoupon === 'primo') {
        const reduced = Math.max(100, Math.floor(originalPrice * 0.01));
        discountAmount = originalPrice - reduced;
        finalAmount = reduced;
        appliedCoupon = 'primo';
      }

      // If client sent an amount that differs, prefer server amount; do not hard-fail
      if (frontendCalculatedAmount && frontendCalculatedAmount !== finalAmount) {
        console.log(`[${new Date().toISOString()}] - Frontend amount (${frontendCalculatedAmount}) differs from server computed amount (${finalAmount}). Proceeding with server amount.`);
      }

      if (!finalAmount || finalAmount <= 0) {
        return new Response(
          JSON.stringify({ error: 'Calculated payable amount is invalid' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        );
      }
    }

    // Get plan details
    let plan: PlanConfig;
    if (isWebinarPayment) {
      plan = {
        id: 'webinar_payment',
        name: metadata?.webinarTitle || 'Webinar Registration',
        price: originalPrice / 100,
        mrp: originalPrice / 100,
        discountPercentage: 0,
        duration: 'One-time Purchase',
        optimizations: 0,
        scoreChecks: 0,
        linkedinMessages: 0,
        guidedBuilds: 0,
        durationInHours: 0,
        tag: '',
        tagColor: '',
        gradient: '',
        icon: '',
        features: [],
      };
    } else if (planId === 'addon_only_purchase' || !planId) {
      plan = {
        id: 'addon_only_purchase',
        name: 'Add-on Only Purchase',
        price: 0,
        mrp: 0,
        discountPercentage: 0,
        duration: 'One-time Purchase',
        optimizations: 0,
        scoreChecks: 0,
        linkedinMessages: 0,
        guidedBuilds: 0,
        durationInHours: 0,
        tag: '',
        tagColor: '',
        gradient: '',
        icon: '',
        features: [],
      };
    } else {
      const foundPlan = plans.find((p) => p.id === planId);
      if (!foundPlan) {
        console.error(`[${new Date().toISOString()}] - Invalid plan ID: ${planId}`);
        throw new Error('Invalid plan selected');
      }
      plan = foundPlan;
    }

    if (!isWebinarPayment) {
      originalPrice = (plan?.price || 0) * 100;
      discountAmount = 0;
      finalAmount = originalPrice;
      appliedCoupon = null;
    }

    // Coupon processing
    if (couponCode && !isWebinarPayment) {
      const normalizedCoupon = couponCode.toLowerCase().trim();

      const { count: userCouponUsageCount, error: userCouponUsageError } = await supabase
        .from('payment_transactions')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .ilike('coupon_code', normalizedCoupon)
        .in('status', ['success', 'pending']);

      if (userCouponUsageError) {
        console.error(`[${new Date().toISOString()}] - Error checking user coupon usage:`, userCouponUsageError);
        throw new Error('Failed to verify coupon usage. Please try again.');
      }

      if (userCouponUsageCount && userCouponUsageCount > 0) {
        console.log(`[${new Date().toISOString()}] - Coupon "${normalizedCoupon}" already used by user ${user.id}.`);
        return new Response(
          JSON.stringify({ error: `Coupon "${normalizedCoupon}" has already been used by this account.` }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          },
        );
      }

      if (normalizedCoupon === 'fullsupport' && planId === 'career_pro_max') {
        finalAmount = 0;
        discountAmount = plan.price * 100;
        appliedCoupon = 'fullsupport';
      }
      else if (normalizedCoupon === 'first100' && planId === 'lite_check') {
        finalAmount = 0;
        discountAmount = plan.price * 100;
        appliedCoupon = 'first100';
      }
      else if (normalizedCoupon === 'first500' && planId === 'lite_check') {
        const { count, error: countError } = await supabase
          .from('payment_transactions')
          .select('id', { count: 'exact' })
          .eq('coupon_code', 'first500')
          .in('status', ['success', 'pending']);

        if (countError) {
          console.error(`[${new Date().toISOString()}] - Error counting first500 coupon usage:`, countError);
          throw new Error('Failed to verify coupon usage. Please try again.');
        }

        if (count && count >= 500) {
          throw new Error('Coupon "first500" has reached its usage limit.');
        }

        discountAmount = Math.floor(plan.price * 100 * 0.98);
        finalAmount = (plan.price * 100) - discountAmount;
        appliedCoupon = 'first500';
      }
      else if (normalizedCoupon === 'worthyone' && planId === 'career_pro_max') {
        const discountAmount = Math.floor(plan.price * 100 * 0.5);
        finalAmount = (plan.price * 100) - discountAmount;
        appliedCoupon = 'worthyone';
      }
      else if (normalizedCoupon === 'vnkr50%' && planId === 'career_pro_max') {
        discountAmount = Math.floor(originalPrice * 0.5);
        finalAmount = originalPrice - discountAmount;
        appliedCoupon = 'vnkr50%';
      }
      else if (normalizedCoupon === 'vnk50' && planId === 'career_pro_max') {
        discountAmount = Math.floor(originalPrice * 0.5);
        finalAmount = originalPrice - discountAmount;
        appliedCoupon = 'vnk50';
      }
      else if (normalizedCoupon === 'diwali') {
        discountAmount = Math.floor(originalPrice * 0.9);
        finalAmount = originalPrice - discountAmount;
        appliedCoupon = 'diwali';
        console.log(`[${new Date().toISOString()}] - DIWALI coupon applied to plan ${planId}. Original: ${originalPrice}, Discount: ${discountAmount}, Final: ${finalAmount}`);
      }
      else {
        return new Response(
          JSON.stringify({ error: 'Invalid coupon code or not applicable to selected plan.' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          },
        );
      }
    }

    if (!isWebinarPayment && walletDeduction && walletDeduction > 0) {
      finalAmount = Math.max(0, finalAmount - walletDeduction);
    }

    if (addOnsTotal && addOnsTotal > 0) {
      finalAmount += addOnsTotal;
    }

    if (!isWebinarPayment) {
      if (finalAmount !== frontendCalculatedAmount) {
        console.error(`[${new Date().toISOString()}] - Price mismatch detected! Backend calculated: ${finalAmount}, Frontend sent: ${frontendCalculatedAmount}`);
        return new Response(
          JSON.stringify({ 
            error: 'Price mismatch detected. Please try again.',
            debug: {
              backendCalculated: finalAmount,
              frontendSent: frontendCalculatedAmount,
              difference: Math.abs(finalAmount - frontendCalculatedAmount)
            }
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          },
        );
      }
    }

    // Create pending payment_transactions record
    console.log(`[${new Date().toISOString()}] - Creating pending payment_transactions record.`);

    // Build base insert payload
    const baseInsert: any = {
      user_id: user.id,
      plan_id: (isWebinarPayment || planId === 'addon_only_purchase') ? null : planId,
      status: 'pending',
      amount: plan.price * 100,
      currency: 'INR',
      order_id: 'PENDING',
      payment_id: 'PENDING',
      coupon_code: appliedCoupon,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      purchase_type: isWebinarPayment
        ? 'webinar'
        : (planId === 'addon_only_purchase'
            ? 'addon_only'
            : (Object.keys(selectedAddOns || {}).length > 0 ? 'plan_with_addons' : 'plan')),
    };

    if (isWebinarPayment && metadata) {
      baseInsert.metadata = {
        type: 'webinar',
        webinarId: metadata.webinarId,
        registrationId: metadata.registrationId,
        webinarTitle: metadata.webinarTitle,
      };
    }

    // Attempt insert, and on schema errors (missing columns), fall back by removing fields
    const tryInsert = async (payload: any): Promise<{ id: string }> => {
      const { data, error } = await supabase
        .from('payment_transactions')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;
      return data as { id: string };
    };

    let transactionId: string | null = null;
    try {
      const t = await tryInsert(baseInsert);
      transactionId = t.id;
    } catch (e: any) {
      const msg = String(e?.message || '');
      console.warn(`[${new Date().toISOString()}] - Initial transaction insert failed: ${msg}`);
      // Create a shallow copy and remove fields known to be optional in older schemas
      const fallbackInsert = { ...baseInsert };
      delete fallbackInsert.metadata;
      // Some databases might not have purchase_type
      delete fallbackInsert.purchase_type;
      try {
        const t2 = await tryInsert(fallbackInsert);
        transactionId = t2.id;
      } catch (e2: any) {
        console.error(`[${new Date().toISOString()}] - Fallback transaction insert failed:`, e2);
        throw new Error(`Failed to initiate payment transaction: ${e2?.message || 'unknown error'}`);
      }
    }
    
    console.log(`[${new Date().toISOString()}] - Pending transaction created with ID: ${transactionId}`);

    // Create Razorpay order
    // Choose Razorpay creds based on mode (test/live)
    const envTestMode = (Deno.env.get('RAZORPAY_TEST_MODE') || '').toLowerCase() === 'true';
    const isTestMode = Boolean(testMode) || envTestMode;

    const razorpayKeyId = isTestMode
      ? (Deno.env.get('RAZORPAY_TEST_KEY_ID') || Deno.env.get('RAZORPAY_KEY_ID'))
      : Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = isTestMode
      ? (Deno.env.get('RAZORPAY_TEST_KEY_SECRET') || Deno.env.get('RAZORPAY_KEY_SECRET'))
      : Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error(`[${new Date().toISOString()}] - Razorpay credentials not configured`);
      throw new Error('Razorpay credentials not configured');
    }

    const orderData = {
      amount: finalAmount,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: {
        planId: planId || 'webinar_payment',
        planName: plan.name,
        originalAmount: plan.price * 100,
        couponCode: appliedCoupon,
        discountAmount: discountAmount,
        walletDeduction: walletDeduction || 0,
        addOnsTotal: addOnsTotal || 0,
        transactionId: transactionId,
        selectedAddOns: JSON.stringify(selectedAddOns || {}),
        paymentType: isWebinarPayment ? 'webinar' : 'subscription',
        webinarId: metadata?.webinarId || '',
        registrationId: metadata?.registrationId || '',
        webinarTitle: metadata?.webinarTitle || '',
        mode: isTestMode ? 'test' : 'live',
      },
    };

    console.log(`[${new Date().toISOString()}] - Creating Razorpay order:`, orderData);

    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    console.log(`[${new Date().toISOString()}] - Razorpay API response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${new Date().toISOString()}] - Razorpay API error:`, errorText);
      await supabase.from('payment_transactions').update({ status: 'failed' }).eq('id', transactionId);
      throw new Error(`Failed to create payment order with Razorpay: ${errorText}`);
    }

    const order = await response.json();
    console.log(`[${new Date().toISOString()}] - Razorpay order created successfully: ${order.id}`);

    // Try to persist the order_id to the pending transaction (best-effort)
    try {
      await supabase
        .from('payment_transactions')
        .update({ order_id: order.id })
        .eq('id', transactionId as string);
    } catch (e) {
      console.warn(`[${new Date().toISOString()}] - Failed to update order_id on payment_transactions:`, e);
    }

    return new Response(
      JSON.stringify({
        orderId: order.id,
        amount: finalAmount,
        keyId: razorpayKeyId,
        currency: 'INR',
        transactionId: transactionId,
        mode: isTestMode ? 'test' : 'live',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error(`[${new Date().toISOString()}] - Error creating order:`, error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});
