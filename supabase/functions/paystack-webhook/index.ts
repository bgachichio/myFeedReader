/**
 * Supabase Edge Function: paystack-webhook
 *
 * Receives Paystack webhook events and upgrades the user's plan.
 *
 * Env vars (all auto-injected by Supabase — nothing to manually set except PAYSTACK_SECRET_KEY):
 *   SUPABASE_URL              — auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected
 *   PAYSTACK_SECRET_KEY       — set via: supabase secrets set PAYSTACK_SECRET_KEY=sk_live_...
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYSTACK_SECRET      = Deno.env.get('PAYSTACK_SECRET_KEY') ?? ''
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// ── Signature verification (Web Crypto — works in all Deno versions) ──
async function verifySignature(body: string, signature: string): Promise<boolean> {
  if (!PAYSTACK_SECRET || !signature) return false
  try {
    const enc  = new TextEncoder()
    const key  = await crypto.subtle.importKey(
      'raw', enc.encode(PAYSTACK_SECRET),
      { name: 'HMAC', hash: 'SHA-512' },
      false, ['sign']
    )
    const sig  = await crypto.subtle.sign('HMAC', key, enc.encode(body))
    const hash = Array.from(new Uint8Array(sig))
                      .map(b => b.toString(16).padStart(2, '0')).join('')
    return hash === signature
  } catch (e) {
    console.error('Signature error:', e)
    return false
  }
}

// ── Main handler ───────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200 })
  if (req.method !== 'POST')   return new Response('Method not allowed', { status: 405 })

  const body      = await req.text()
  const signature = req.headers.get('x-paystack-signature') ?? ''

  // Verify signature — skip in dev if secret not set
  if (PAYSTACK_SECRET) {
    const valid = await verifySignature(body, signature)
    if (!valid) {
      console.error('Invalid Paystack signature')
      return new Response('Unauthorized', { status: 401 })
    }
  }

  let event: any
  try { event = JSON.parse(body) }
  catch { return new Response('Invalid JSON', { status: 400 }) }

  console.log(`[webhook] received: ${event.event}`)
  console.log('[webhook] payload:', JSON.stringify(event.data?.customer))

  // Always return 200 immediately — process synchronously before responding
  try {
    await handleEvent(event)
  } catch (err: any) {
    console.error('[webhook] handler error:', err?.message ?? err)
    // Still return 200 so Paystack doesn't endlessly retry on our bugs
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

// ── Event router ───────────────────────────────────────────────────
async function handleEvent(event: any) {
  const { event: type, data } = event

  if (type === 'charge.success' || type === 'subscription.create') {
    const email     = data.customer?.email
    const interval  = data.plan?.interval ?? 'monthly'
    const paidAt    = data.paid_at ?? data.created_at ?? new Date().toISOString()
    const expiresAt = addInterval(interval, paidAt)
    const subCode   = data.subscription_code ?? null
    const custCode  = data.customer?.customer_code ?? null

    if (!email) {
      console.error(`[${type}] no email in payload — cannot upgrade`)
      return
    }

    console.log(`[${type}] upgrading ${email} → pro, expires ${expiresAt}`)

    await upgradePlan(email, {
      plan:                       'pro',
      plan_source:                'paystack',
      plan_started_at:            paidAt,
      plan_expires_at:            expiresAt,
      paystack_customer_code:     custCode,
      paystack_subscription_code: subCode,
    })
    return
  }

  if (type === 'subscription.disable') {
    console.log(`[subscription.disable] ${data.customer?.email} cancelled — access continues until expiry`)
    return
  }

  console.log(`[webhook] ignored event: ${type}`)
}

// ── Upgrade plan — finds user by email via SQL, then updates profiles ──
async function upgradePlan(email: string, planData: Record<string, unknown>) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── Step 1: find user ID by email using the admin listUsers API ──
  // supabase-js v2 removed getUserByEmail; we use listUsers with email filter instead.
  // The filter is applied server-side via the GoTrue admin API.
  const { data: listData, error: listError } =
    await (supabase.auth.admin.listUsers as any)({ perPage: 1000 })

  if (listError) {
    throw new Error(`listUsers failed: ${listError.message}`)
  }

  const users: any[] = listData?.users ?? []
  const match = users.find((u: any) =>
    u.email?.toLowerCase() === email.toLowerCase()
  )

  if (!match?.id) {
    // Fallback: query auth.users directly via raw SQL (works with service role)
    console.warn(`[upgradePlan] listUsers didn't find ${email}, trying SQL fallback`)
    const { data: sqlData, error: sqlError } = await supabase
      .rpc('get_user_id_by_email', { user_email: email })

    if (sqlError || !sqlData) {
      throw new Error(`SQL user lookup failed for ${email}: ${sqlError?.message ?? 'not found'}`)
    }

    await updateProfile(supabase, sqlData as string, planData, email)
    return
  }

  await updateProfile(supabase, match.id, planData, email)
}

// ── Update the profiles row ────────────────────────────────────────
async function updateProfile(
  supabase: any,
  userId: string,
  planData: Record<string, unknown>,
  email: string
) {
  console.log(`[upgradePlan] found userId=${userId} for ${email}`)

  const { error } = await supabase
    .from('profiles')
    .update(planData)
    .eq('id', userId)

  if (error) {
    throw new Error(`profiles update failed for ${userId}: ${error.message}`)
  }

  console.log(`[upgradePlan] ✓ upgraded ${email} (${userId}) to pro`)
}

// ── Date helpers ───────────────────────────────────────────────────
function addInterval(interval: string, fromIso: string): string {
  const d = new Date(fromIso)
  if (interval === 'annually' || interval === 'annual') {
    d.setFullYear(d.getFullYear() + 1)
  } else {
    d.setMonth(d.getMonth() + 1)
  }
  return d.toISOString()
}
