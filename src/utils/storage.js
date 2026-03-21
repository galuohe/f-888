/**
 * localStorage 读写封装
 * 保持 v6 数据格式兼容，确保老用户数据无缝迁移
 */

export const KEYS = {
  FUNDS: 'fund_calc_v6',
  WATCHLIST: 'fund_watchlist_v1',
  WATCH_GROUPS: 'fund_watch_groups_v1',
  PNL_HISTORY: 'fund_pnl_history_v1',  // 旧版单体 key，仅用于迁移检测
  PNL_MONTH_PREFIX: 'fund_pnl_',       // 新版按月分片 key 前缀
  HIDDEN_COLS: 'fund_hidden_cols',
  AI_KEY: 'deepseek_api_key',
  AI_HISTORY: 'ai_chat_history',
  SB_CACHED_UID: 'sb_cached_uid',
}

/** 读取持仓列表 */
export function loadFunds() {
  try {
    const raw =
      localStorage.getItem(KEYS.FUNDS) ||
      localStorage.getItem('fund_calc_v5') ||
      localStorage.getItem('fund_calc_v4')
    if (!raw) return []
    const funds = JSON.parse(raw)
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
      if (!Array.isArray(f.tags)) {
        f.tags = f.tag ? [f.tag] : []
      }
      delete f.tag
    })
    return funds
  } catch (_) {
    return []
  }
}

/** 保存持仓列表 */
export function saveFunds(funds) {
  const data = funds.map(({
    code, amount, tags, costBasis, costBasisLocked,
    holdingShares, holdingSharesLocked, costNav, prevNav,
    confirmedNav, navConfirmed, confirmedDate, addedDate, _lastPnlDate,
    name, gsz, gszzl, gztime, jzrq
  }) => ({
    code, amount, tags: tags || [], costBasis, costBasisLocked,
    holdingShares, holdingSharesLocked, costNav, prevNav,
    confirmedNav, navConfirmed, confirmedDate, addedDate, _lastPnlDate,
    name, gsz, gszzl, gztime, jzrq
  }))
  localStorage.setItem(KEYS.FUNDS, JSON.stringify(data))
  return data
}

/** 读取自选列表 */
export function loadWatchlist() {
  try {
    const raw = localStorage.getItem(KEYS.WATCHLIST)
    if (!raw) return []
    const list = JSON.parse(raw)
    list.forEach(w => {
      if (w.confirmedDate === undefined) w.confirmedDate = null
      if (w.navConfirmed === undefined) w.navConfirmed = false
      if (w.confirmedNav === undefined) w.confirmedNav = null
      if (w.jzrq === undefined) w.jzrq = null
      // 标签：兼容旧版 tag(string) → tags(array)
      if (!Array.isArray(w.tags)) {
        w.tags = w.tag ? [w.tag] : []
      }
      delete w.tag
      // 分组归属（与标签完全独立）
      if (!Array.isArray(w.groups)) {
        w.groups = []
      }
    })
    return list
  } catch (_) {
    return []
  }
}

/** 保存自选列表 */
export function saveWatchlist(list) {
  const data = list.map(({
    code, name, tags, groups, prevNav, gsz, gszzl,
    gztime, jzrq, confirmedNav, navConfirmed, confirmedDate
  }) => ({
    code, name, tags: tags || [], groups: groups || [],
    prevNav, gsz, gszzl, gztime, jzrq, confirmedNav, navConfirmed, confirmedDate
  }))
  localStorage.setItem(KEYS.WATCHLIST, JSON.stringify(data))
  return data
}

/** 读取自选分组列表 */
export function loadWatchGroups() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.WATCH_GROUPS) || '[]')
  } catch (_) {
    return []
  }
}

/** 保存自选分组列表 */
export function saveWatchGroups(groups) {
  localStorage.setItem(KEYS.WATCH_GROUPS, JSON.stringify(groups))
}

/** 读取盈亏历史（按月分片存储，自动迁移旧格式） */
export function loadPnlHistory() {
  try {
    // 迁移：检测旧版单体 key，拆分为月度 key 后删除
    const legacy = localStorage.getItem(KEYS.PNL_HISTORY)
    if (legacy) {
      const old = JSON.parse(legacy)
      if (Object.keys(old).length > 0) {
        savePnlHistory(old)
      }
      localStorage.removeItem(KEYS.PNL_HISTORY)
      return old
    }

    // 正常加载：收集所有月度 key 并合并
    const merged = {}
    const prefix = KEYS.PNL_MONTH_PREFIX
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(prefix) && !k.startsWith(prefix + 'history')) {
        keys.push(k)
      }
    }
    for (const k of keys) {
      try {
        Object.assign(merged, JSON.parse(localStorage.getItem(k)))
      } catch (_) {}
    }
    return merged
  } catch (_) {
    return {}
  }
}

/** 保存盈亏历史（按月分片，仅写入变更的月份） */
export function savePnlHistory(history) {
  const prefix = KEYS.PNL_MONTH_PREFIX

  // 按 YYYY_MM 分组
  const byMonth = {}
  for (const date in history) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const monthKey = date.slice(0, 4) + '_' + date.slice(5, 7)
    if (!byMonth[monthKey]) byMonth[monthKey] = {}
    byMonth[monthKey][date] = history[date]
  }

  // 写入变更的月份
  for (const monthKey in byMonth) {
    const lsKey = prefix + monthKey
    const newJson = JSON.stringify(byMonth[monthKey])
    if (localStorage.getItem(lsKey) !== newJson) {
      localStorage.setItem(lsKey, newJson)
    }
  }

  // 删除 history 中已不存在的月份 key（支持 clear / removeFund 清理）
  const keysToRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(prefix) && !k.startsWith(prefix + 'history')) {
      const monthKey = k.slice(prefix.length)
      if (!byMonth[monthKey]) keysToRemove.push(k)
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k))
}

/** 读取隐藏列配置 */
export function loadHiddenCols() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.HIDDEN_COLS) || '{}')
  } catch (_) {
    return {}
  }
}

/** 保存隐藏列配置 */
export function saveHiddenCols(cols) {
  localStorage.setItem(KEYS.HIDDEN_COLS, JSON.stringify(cols))
}
