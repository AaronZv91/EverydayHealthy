import { useCallback, useEffect, useState } from 'react'
import { parseSupabaseError, requireSupabase } from '../lib/supabaseClient'

export function useRewards(limit = 20) {
  const [rewards, setRewards] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchRewards = useCallback(async () => {
    const { data, error } = await requireSupabase()
      .from('rewards')
      .select(`
        id,
        emoji,
        item_name,
        steps,
        mvpa_minutes,
        created_at,
        sender:sender_id ( id, display_name ),
        receiver:receiver_id ( id, display_name )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error(error)
      setLoading(false)
      return
    }

    setRewards(data ?? [])
    setLoading(false)
  }, [limit])

  useEffect(() => {
    fetchRewards()

    const channel = requireSupabase()
      .channel('rewards-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rewards' },
        () => fetchRewards()
      )
      .subscribe()

    return () => {
      requireSupabase().removeChannel(channel)
    }
  }, [fetchRewards])

  const sendReward = useCallback(async ({ receiverId, emoji, itemName, steps, mvpaMinutes }) => {
    const { data, error } = await requireSupabase().rpc('send_reward', {
      p_receiver_id: receiverId,
      p_emoji: emoji,
      p_item_name: itemName,
      p_steps: Number(steps) || 0,
      p_mvpa_minutes: Number(mvpaMinutes) || 0,
    })

    if (error) throw new Error(parseSupabaseError(error))
    await fetchRewards()
    return data
  }, [fetchRewards])

  return { rewards, loading, sendReward, refetch: fetchRewards }
}

export function useLogActivity() {
  const logActivity = useCallback(async ({ steps, mvpaMinutes, note }) => {
    const { data, error } = await requireSupabase().rpc('log_activity', {
      p_steps: Number(steps) || 0,
      p_mvpa_minutes: Number(mvpaMinutes) || 0,
      p_note: note || null,
    })

    if (error) throw new Error(parseSupabaseError(error))
    return data
  }, [])

  return { logActivity }
}
