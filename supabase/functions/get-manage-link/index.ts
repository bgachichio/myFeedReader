/**
 * Supabase Edge Function: get-manage-link
 *
 * Returns a Paystack subscription management link for the authenticated user.
 * Works even when paystack_subscription_code is not yet stored in profiles
 * (looks it up live from Paystack by email, then stores it for next time).
 *
 * Deploy with:
 *   supabase functions deploy get-manage-link --no-verify-jwt
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYSTACK_SECRET      = Deno.env.get('PAYSTACK_SECRET_KEY') ?? ''
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: CORS })
  if (req.method !== 'POST')   return respond({ error: 'Method not allowed' }, 405)

  // ── 1. Authenticate the caller ────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return respond({ error: 'Missing auth header' }, 401)

  const jwt = authHeader.slice(7)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
  if (authErr || !user?.email) {
    console.error('Auth failed:', authErr?.message)
    return respond({ error: 'Unauthorized' }, 401)
  }

  const email = user.email
  console.log('Generating manage link for:', email)

  // ── 2. Get profile — check if we already have a subscription code ──
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_source, paystack_subscription_code')
    .eq('id', user.id)
    .single()

  if (!profile || profile.plan !== 'pro') {
    return respond({ error: 'No active Pro subscription' }, 400)
  }

  // ── 3. Resolve subscription code ─────────────────────────────
  let subCode = profile.paystack_subscription_code

  if (!subCode) {
    // Not stored yet — look it up from Paystack by email
    console.log('subscription_code missing, fetching from Paystack...')
    subCode = await fetchSubCodeByEmail(email)

    if (subCode) {
      // Store it so we don't need to look it up again
      await supabase
        .from('profiles')
        .update({ paystack_subscription_code: subCode })
        .eq('id', user.id)
      console.log('Stored subscription_code:', subCode)
    } else {
      console.error('Could not find subscription for', email)
      return respond({
        error: 'subscription_not_found',
        message: 'No active Paystack subscription found for your account. Check your inbox for a Paystack email with a manage link, or contact support.',
      }, 404)
    }
  }

  // ── 4. Generate management link from Paystack ─────────────────
  console.log('Calling Paystack manage/link for:', subCode)
  const paystackRes = await fetch(
    `https://api.paystack.co/subscription/${subCode}/manage/link`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type':  'application/json',
      },
    }
  )

  const paystackBody = await paystackRes.json()
  console.log('Paystack response:', JSON.stringify(paystackBody))

  if (!paystackRes.ok || !paystackBody?.data?.link) {
    return respond({
      error: 'paystack_error',
      detail: paystackBody?.message ?? 'Unknown error',
    }, 502)
  }

  return respond({ link: paystackBody.data.link }, 200)
})

// ── Fetch the most recent active subscription code for an email ──
async function fetchSubCodeByEmail(email: string): Promise<string | null> {
  // Paystack: GET /subscription?customer={email}
  const res = await fetch(
    `https://api.paystack.co/subscription?customer=${encodeURIComponent(email)}&status=active&perPage=10`,
    { headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET}` } }
  )
  const body = await res.json()
  console.log('Paystack subscription list:', JSON.stringify(body))

  if (!res.ok || !Array.isArray(body?.data) || body.data.length === 0) {
    return null
  }

  // Return the most recent active subscription code
  const active = body.data.find((s: any) => s.status === 'active') ?? body.data[0]
  return active?.subscription_code ?? null
}

function respond(body: object, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}
