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
  NOT_AUTHENTICATED: '請先登入',
  RECEIVER_REQUIRED: '請選擇打賞對象',
  CANNOT_REWARD_SELF: '不能打賞自己',
  REWARD_AMOUNT_REQUIRED: '請輸入步數或 MVPA 分鐘',
  RECEIVER_NOT_FOUND: '找不到該用戶',
  INSUFFICIENT_STEPS_QUOTA: '步數額度不足',
  INSUFFICIENT_MVPA_QUOTA: 'MVPA 額度不足',
  ACTIVITY_AMOUNT_REQUIRED: '請輸入步數或 MVPA 分鐘',
  SUPABASE_NOT_CONFIGURED: '請先設定 Supabase 環境變數',
}

export function parseSupabaseError(error) {
  if (!error?.message) return '發生未知錯誤'

  const msg = error.message
  for (const [code, label] of Object.entries(REWARD_ERROR_MESSAGES)) {
    if (msg.includes(code)) {
      const match = msg.match(/:(\d+)$/)
      if (match) return `${label}（可用：${match[1]}）`
      return label
    }
  }
  return msg
}

const AUTH_ERROR_MESSAGES = {
  invalid_credentials: '帳號或密碼錯誤。若尚未註冊請先按「註冊」。',
  email_not_confirmed: '帳號尚未啟用，請聯絡管理員或重新註冊。',
  user_already_registered: '此 Email 已註冊，請直接登入。',
  email_address_invalid: 'Email 格式無效，請確認是否輸入正確。',
  weak_password: '密碼強度不足，請至少使用 6 個字元。',
  signup_disabled: '目前暫停新用戶註冊。',
  over_email_send_rate_limit: '寄信太頻繁，請稍後再試。',
  over_request_rate_limit: '請求太頻繁，請稍後再試。',
}

export function formatAuthError(error) {
  if (!error) return '操作失敗'

  const code = error.code ?? error.error_code ?? ''
  if (AUTH_ERROR_MESSAGES[code]) return AUTH_ERROR_MESSAGES[code]

  const msg = (error.message ?? '').toLowerCase()
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return AUTH_ERROR_MESSAGES.invalid_credentials
  }
  if (msg.includes('email not confirmed')) {
    return AUTH_ERROR_MESSAGES.email_not_confirmed
  }

  return error.message || '操作失敗'
}

export function requireSupabase() {
  if (!supabase) {
    throw new Error(REWARD_ERROR_MESSAGES.SUPABASE_NOT_CONFIGURED)
  }
  return supabase
}
