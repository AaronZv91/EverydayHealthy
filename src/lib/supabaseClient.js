import { createClient } from '@supabase/supabase-js'

/** Project URL only — e.g. https://xxxx.supabase.co (no /rest/v1 suffix). */
function normalizeSupabaseUrl(url) {
  if (!url) return url
  return url.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/i, '')
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL)
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null

export const WEEKLY_GOALS = {
  steps: 70_000,
  mvpaMinutes: 200,
}

export const REWARD_ERROR_MESSAGES = {
  NOT_AUTHENTICATED: 'Please sign in first',
  RECEIVER_REQUIRED: 'Please select a recipient',
  CANNOT_REWARD_SELF: 'You cannot reward yourself',
  REWARD_AMOUNT_REQUIRED: 'Enter steps or MVPA minutes',
  RECEIVER_NOT_FOUND: 'Recipient not found',
  INSUFFICIENT_STEPS_QUOTA: 'Not enough steps quota',
  INSUFFICIENT_MVPA_QUOTA: 'Not enough MVPA quota',
  ACTIVITY_AMOUNT_REQUIRED: 'Enter steps or MVPA minutes',
  SUPABASE_NOT_CONFIGURED: 'Please configure Supabase environment variables',
}

export function parseSupabaseError(error) {
  if (!error?.message) return 'An unknown error occurred'

  const msg = error.message
  for (const [code, label] of Object.entries(REWARD_ERROR_MESSAGES)) {
    if (msg.includes(code)) {
      const match = msg.match(/:(\d+)$/)
      if (match) return `${label} (available: ${match[1]})`
      return label
    }
  }
  return msg
}

const AUTH_ERROR_MESSAGES = {
  invalid_credentials: 'Invalid email or password. Sign up first if you do not have an account.',
  email_not_confirmed: 'Account not activated. Contact an admin or sign up again.',
  user_already_registered: 'This email is already registered. Please sign in.',
  email_address_invalid: 'Invalid email address.',
  weak_password: 'Password is too weak. Use at least 6 characters.',
  signup_disabled: 'New sign-ups are currently disabled.',
  over_email_send_rate_limit: 'Too many emails sent. Please try again later.',
  over_request_rate_limit: 'Too many requests. Please try again later.',
}

export function formatAuthError(error) {
  if (!error) return 'Something went wrong'

  const code = error.code ?? error.error_code ?? ''
  if (AUTH_ERROR_MESSAGES[code]) return AUTH_ERROR_MESSAGES[code]

  const msg = (error.message ?? '').toLowerCase()
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return AUTH_ERROR_MESSAGES.invalid_credentials
  }
  if (msg.includes('email not confirmed')) {
    return AUTH_ERROR_MESSAGES.email_not_confirmed
  }

  return error.message || 'Something went wrong'
}

export function requireSupabase() {
  if (!supabase) {
    throw new Error(REWARD_ERROR_MESSAGES.SUPABASE_NOT_CONFIGURED)
  }
  return supabase
}
