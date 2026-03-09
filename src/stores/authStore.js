import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import { KEYS } from '@/utils/storage'
import { saveWatchGroups } from '@/utils/storage'

export const useAuthStore = defineStore('auth', () => {
  const client = ref(supabase)
  const user = ref(null)
  const isLoaded = ref(false)
  const isSyncing = ref(false)

  let _cache = {}
  let _saveTimer = null

  /** 防抖保存到云端 */
  function sbSave(patch) {
    if (isSyncing.value) return
    if (!client.value) return
    if (!user.value) return
    Object.assign(_cache, patch)

    if (_saveTimer) clearTimeout(_saveTimer)
    _saveTimer = setTimeout(async () => {
      try {
        const payload = {
          user_id: user.value.id,
          ..._cache,
          updated_at: new Date().toISOString()
        }
        const { error } = await client.value
          .from('user_data')
          .upsert(payload, { onConflict: 'user_id' })
        if (error) {
          console.error('云端保存失败:', error.message)
        }
      } catch (e) {
        console.error('云端保存异常:', e.message)
      }
    }, 800)
  }

  /** 从云端拉取数据并覆盖本地 */
  async function loadFromCloud() {
    if (!client.value || !user.value) return null
    isSyncing.value = true
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('请求超时')), 20000)
      )
      let { data, error } = await Promise.race([
        client.value
          .from('user_data')
          .select('funds, watchlist, watch_groups, pnl_history, ai_key')
          .eq('user_id', user.value.id)
          .maybeSingle(),
        timeout
      ])
      // watch_groups 列尚未建立时，降级查询（不影响其他数据）
      if (error && error.code === '42703') {
        console.warn('watch_groups 列不存在，降级查询')
        const res2 = await client.value
          .from('user_data')
          .select('funds, watchlist, pnl_history, ai_key')
          .eq('user_id', user.value.id)
          .maybeSingle()
        data = res2.data
        error = res2.error
      }
      if (error) throw error
      if (!data) {
        // 新账户：清空本地
        localStorage.setItem(KEYS.FUNDS, '[]')
        localStorage.setItem(KEYS.WATCHLIST, '[]')
        localStorage.setItem(KEYS.PNL_HISTORY, '{}')
        _cache = { funds: [], watchlist: [], pnl_history: {} }
        isLoaded.value = true
        isSyncing.value = false
        localStorage.setItem(KEYS.SB_CACHED_UID, user.value.id)
        return { isEmpty: true }
      }

      _cache = {
        funds: data.funds || [],
        watchlist: data.watchlist || [],
        watch_groups: data.watch_groups || [],
        pnl_history: data.pnl_history || {},
        ...(data.ai_key ? { ai_key: data.ai_key } : {})
      }

      if (data.ai_key) localStorage.setItem(KEYS.AI_KEY, data.ai_key)

      // 写入 localStorage
      if (data.funds) {
        const funds = data.funds
        funds.forEach(f => {
          if (f.costNav === undefined) f.costNav = null
          if (f.confirmedNav === undefined) f.confirmedNav = null
          if (f.navConfirmed === undefined) f.navConfirmed = false
          if (f.jzrq === undefined) f.jzrq = null
          if (f.confirmedDate === undefined) f.confirmedDate = null
          if (f.costBasis === undefined) f.costBasis = null
          if (f.costBasisLocked === undefined) f.costBasisLocked = false
          if (f.holdingShares === undefined) f.holdingShares = null
          if (f.holdingSharesLocked === undefined) f.holdingSharesLocked = false
          if (f.addedDate === undefined) f.addedDate = null
          if (f._lastPnlDate === undefined) f._lastPnlDate = null
          // 兼容旧版 tag(string) → tags(array)
          if (!Array.isArray(f.tags)) { f.tags = f.tag ? [f.tag] : [] }
          delete f.tag
        })
        // 合并本地新增但云端尚未同步的持仓（防止刷新时云端旧数据覆盖本地新增）
        try {
          const localFunds = JSON.parse(localStorage.getItem(KEYS.FUNDS) || '[]')
          const cloudCodes = new Set(funds.map(f => f.code))
          const localOnly = localFunds.filter(f => !cloudCodes.has(f.code))
          if (localOnly.length > 0) { funds.push(...localOnly); _cache.funds = funds }
        } catch (_) {}
        localStorage.setItem(KEYS.FUNDS, JSON.stringify(funds))
      }
      if (data.watchlist) {
        const wl = data.watchlist
        wl.forEach(w => {
          if (w.confirmedDate === undefined) w.confirmedDate = null
          if (w.navConfirmed === undefined) w.navConfirmed = false
          if (w.confirmedNav === undefined) w.confirmedNav = null
          if (w.jzrq === undefined) w.jzrq = null
          // 标签：兼容旧版 tag(string) → tags(array)
          if (!Array.isArray(w.tags)) { w.tags = w.tag ? [w.tag] : [] }
          delete w.tag
          // 分组归属（与标签完全独立）
          if (!Array.isArray(w.groups)) { w.groups = [] }
        })
        // 合并本地新增但云端尚未同步的自选（防止刷新时云端旧数据覆盖本地新增）
        try {
          const localWl = JSON.parse(localStorage.getItem(KEYS.WATCHLIST) || '[]')
          const cloudCodes = new Set(wl.map(w => w.code))
          const localOnly = localWl.filter(w => !cloudCodes.has(w.code))
          if (localOnly.length > 0) { wl.push(...localOnly); _cache.watchlist = wl }
        } catch (_) {}
        localStorage.setItem(KEYS.WATCHLIST, JSON.stringify(wl))
      }
      if (data.watch_groups) {
        saveWatchGroups(data.watch_groups)
      }
      if (data.pnl_history) {
        localStorage.setItem(KEYS.PNL_HISTORY, JSON.stringify(data.pnl_history))
      }

      isLoaded.value = true
      isSyncing.value = false
      localStorage.setItem(KEYS.SB_CACHED_UID, user.value.id)
      return { data: _cache, isEmpty: false }
    } catch (e) {
      isSyncing.value = false
      throw e
    }
  }

  /** 监听 Auth 状态 */
  function initAuthListener(onLogin, onLogout) {
    if (!client.value) {
      onLogout && onLogout()
      return
    }
    client.value.auth.onAuthStateChange(async (event, session) => {
      user.value = session ? session.user : null
      if (user.value) {
        onLogin && onLogin(user.value)
      } else {
        isLoaded.value = false
        isSyncing.value = false
        onLogout && onLogout()
      }
    })
  }

  /** 登录 */
  async function signIn(email, password) {
    if (!client.value) throw new Error('未配置 Supabase')
    const { error } = await client.value.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  /** 登出 */
  async function signOut() {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('sb-') || k.includes('supabase')) localStorage.removeItem(k)
    })
    user.value = null
    _cache = {}
    isLoaded.value = false
    isSyncing.value = false
    if (client.value) client.value.auth.signOut().catch(() => {})
  }

  return {
    client, user, isLoaded, isSyncing,
    sbSave, loadFromCloud, initAuthListener, signIn, signOut
  }
})
