import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchOne } from '@/services/fundApi'
import { fetchPingzhongdata } from '@/services/pingzhongdata'
import { loadFunds, saveFunds, loadPnlHistory, savePnlHistory } from '@/utils/storage'
import { getTodayStr } from '@/utils/format'
import { isWeekend, isTradingHours, getAutoRefreshInterval } from '@/utils/market'
import { useAuthStore } from './authStore'

export const useFundStore = defineStore('fund', () => {
  const funds = ref([])
  const pnlHistory = ref({})
  const timer = ref(null)
  const lastUpdateTime = ref(null)
  const isRefreshing = ref(false)

  /** 初始化：从 localStorage 加载 */
  function load() {
    funds.value = loadFunds()
    pnlHistory.value = loadPnlHistory()
  }

  /** 保存到 localStorage + 云端 */
  function save() {
    const data = saveFunds(funds.value)
    const authStore = useAuthStore()
    authStore.sbSave({ funds: data })
  }

  function savePnl() {
    savePnlHistory(pnlHistory.value)
    const authStore = useAuthStore()
    authStore.sbSave({ pnl_history: pnlHistory.value })
  }

  /** 添加基金 */
  function addFund({ code, amount, tags, costNav: initCostNav, holdingShares: initShares, holdingSharesLocked: initSharesLocked }) {
    if (funds.value.some(f => f.code === code)) return false
    const hasCostNav = initCostNav && initCostNav > 0
    const hasShares = initShares && initShares > 0
    funds.value.push({
      code, amount, tags: Array.isArray(tags) ? tags : [],
      costBasis: hasCostNav ? initCostNav : null,
      costBasisLocked: hasCostNav,
      holdingShares: hasShares ? initShares : null,
      holdingSharesLocked: hasShares && !!initSharesLocked,
      costNav: hasCostNav ? initCostNav : null, prevNav: null,
      confirmedNav: null, navConfirmed: false, confirmedDate: null,
      addedDate: getTodayStr(), _lastPnlDate: null,
      name: code, gsz: null, gszzl: null, gztime: null, jzrq: null,
      loading: false, error: false
    })
    save()
    return true
  }

  /** 删除基金 */
  function removeFund(code) {
    funds.value = funds.value.filter(f => f.code !== code)
    // 同步从日历历史中移除
    let changed = false
    for (const date in pnlHistory.value) {
      const rec = pnlHistory.value[date]
      if (!rec || !rec.funds) continue
      const idx = rec.funds.findIndex(x => x.code === code)
      if (idx === -1) continue
      const removed = rec.funds.splice(idx, 1)[0]
      rec.total = parseFloat((rec.total - (removed.profit || 0)).toFixed(2))
      if (rec.funds.length === 0) delete pnlHistory.value[date]
      changed = true
    }
    save()
    if (changed) savePnl()
  }

  /** 更新基金字段 */
  function updateFund(code, patch) {
    const f = funds.value.find(f => f.code === code)
    if (f) Object.assign(f, patch)
  }

  /** 刷新所有基金数据（持仓 + 自选） */
  async function refreshAll(watchStore) {
    const allItems = [...funds.value, ...(watchStore?.watchlist || [])]
    if (allItems.length === 0) return { ok: 0, total: 0 }

    isRefreshing.value = true
    allItems.forEach(f => { f.loading = true; f.error = false })

    const todayStr = getTodayStr()
    let ok = 0

    for (const f of allItems) {
      try {
        const data = await fetchOne(f.code)
        if (data.name) f.name = data.name
        if (data.jzrq) f.jzrq = data.jzrq

        const alreadyConfirmedToday = f.confirmedDate === todayStr
        if (!alreadyConfirmedToday) {
          // gsz/gszzl/gztime 三者绑定更新：gsz 为 0 说明无实时估值，不写入避免涨跌幅显示 0
          const gszNum = parseFloat(data.gsz)
          if (data.gsz && gszNum > 0) {
            f.gsz = gszNum
            if (data.gztime) f.gztime = data.gztime
            // API gszzl 可能返回 0（未刷新默认值），优先用 gsz/prevNav 自算
            const rawGszzl = parseFloat(data.gszzl)
            if (rawGszzl && !isNaN(rawGszzl)) {
              f.gszzl = rawGszzl
            } else if (f.prevNav && f.prevNav > 0) {
              f.gszzl = parseFloat(((gszNum - f.prevNav) / f.prevNav * 100).toFixed(4))
            }
          }
        }

        const apiConfirmed = data.jzrq === todayStr

        if (alreadyConfirmedToday) {
          f.navConfirmed = true
          // 如果 fundgz 已返回今日确认净值（jzrq === today），用 dwjz 作为权威值覆盖缓存
          if (apiConfirmed && data.dwjz) {
            f.confirmedNav = parseFloat(data.dwjz)
          }
          if (f.confirmedNav) {
            f.gsz = f.confirmedNav
            if (f.prevNav) f.gszzl = parseFloat(((f.confirmedNav - f.prevNav) / f.prevNav * 100).toFixed(4))
          }
          _lockCostBasis(f)
          _lockHoldingShares(f)
          _updateAmountByShares(f)
        } else if (apiConfirmed) {
          f.navConfirmed = true
          f.confirmedNav = parseFloat(data.dwjz)
          f.confirmedDate = todayStr
          _lockCostBasis(f)
          _lockHoldingShares(f)
          _updateAmountByShares(f)
        } else {
          f.navConfirmed = false
          if (f.confirmedDate && f.prevNav && f.holdingShares > 0 && f.prevNav !== f.confirmedNav) {
            f._pnlPrevNav = f.prevNav
            f._pnlSnapDate = f.confirmedDate
          }
          if (data.dwjz) f.prevNav = parseFloat(data.dwjz)
          if (data.dwjz && !f.costNav) f.costNav = parseFloat(data.dwjz)
          if (f.confirmedNav && f.confirmedDate && f.confirmedDate > (data.jzrq || '')) {
            f.prevNav = f.confirmedNav
            if (f.holdingShares > 0) {
              f.amount = parseFloat((f.holdingShares * f.confirmedNav).toFixed(2))
            }
          }
          if (!f.costBasisLocked && f.gsz) f.costBasis = f.gsz
          if (!f.holdingSharesLocked && f.holdingShares === null && f.costNav && f.amount) {
            f.holdingShares = parseFloat((f.amount / f.costNav).toFixed(4))
          }
        }
        f.loading = false
        ok++
      } catch (_) {
        f.loading = false
        f.error = true
      }

      // 二次请求：获取最新确认净值
      // 条件：无确认净值 / 周末未确认今日 / jzrq 比存储的 confirmedDate 更新
      const nowH2 = new Date().getHours()
      const todayStr2 = getTodayStr()
      const weekend2 = [0, 6].includes(new Date().getDay())
      // f.jzrq 在 try 块内已由 data.jzrq 赋值，可安全使用
      const apiJzrq = f.jzrq || ''
      const prevNavBad = !f.prevNav || (f.confirmedNav && f.prevNav === f.confirmedNav)
      // 缓存标记今日已确认，但 fundgz 的 jzrq 还没更新到今天 → 缓存可能不可靠，需要 pingzhongdata 校正
      const cachedButUnverified = f.confirmedDate === todayStr2 && apiJzrq !== todayStr2
      const needFetch = !f.error && (
        !f.confirmedNav ||
        (f.confirmedDate !== todayStr2 && (weekend2 || nowH2 >= 15)) ||
        (apiJzrq && apiJzrq > (f.confirmedDate || '')) ||
        prevNavBad ||
        (!f.navConfirmed && nowH2 >= 15) ||
        cachedButUnverified
      )
      if (needFetch) {
        try {
          const pzd = await fetchPingzhongdata(f.code)
          const trend = pzd.data || pzd
          if (trend && trend.length > 0) {
            // 按时间排序，确保 last = 最新，prev = 倒数第二
            const sorted = [...trend].sort((a, b) => a.x - b.x)
            const last = sorted[sorted.length - 1]
            const prevItem = sorted.length >= 2 ? sorted[sorted.length - 2] : null
            const lastDate = new Date(last.x + 8 * 3600 * 1000).toISOString().slice(0, 10)
            const cnav = last.y
            const prevNavFromTrend = prevItem ? prevItem.y : null
            if (lastDate === todayStr2) {
              f.navConfirmed = true
              f.confirmedNav = cnav
              f.confirmedDate = todayStr2
              f.gsz = cnav
              // 用 trend 倒数第二项作为 prevNav（比 data.dwjz 更准确）
              if (prevNavFromTrend) {
                f.prevNav = prevNavFromTrend
                f.gszzl = parseFloat(((cnav - prevNavFromTrend) / prevNavFromTrend * 100).toFixed(4))
              } else if (f.prevNav) {
                f.gszzl = parseFloat(((cnav - f.prevNav) / f.prevNav * 100).toFixed(4))
              }
              if (!f.costBasisLocked) { f.costBasis = f.costNav || cnav; f.costBasisLocked = true }
              if (!f.holdingSharesLocked && f.costNav && f.amount) {
                f.holdingShares = parseFloat((f.amount / f.costNav).toFixed(4))
                f.holdingSharesLocked = true
              }
              if (f.holdingShares > 0) {
                f.amount = parseFloat((f.holdingShares * cnav).toFixed(2))
              }
            } else if (!f.confirmedNav || lastDate > (f.confirmedDate || '')) {
              // 非今日的历史确认净值（如周末取到上周五）
              f.confirmedNav = cnav
              f.confirmedDate = lastDate
              // 用倒数第二项作为 prevNav，用于涨跌幅和盈亏计算
              if (prevNavFromTrend) f.prevNav = prevNavFromTrend
              if (f.holdingShares > 0) {
                f.amount = parseFloat((f.holdingShares * cnav).toFixed(2))
              }
            } else if (prevNavFromTrend) {
              // confirmedNav 已是最新，始终用 trend 倒数第二项修正 prevNav
              // 修复：之前仅在 prevNav 为空或等于 confirmedNav 时更新，
              // 导致 prevNav 被误设为持仓成本后永远无法纠正
              f.prevNav = prevNavFromTrend
            }
          }
        } catch (_) { /* 静默回退 */ }
      }
    }

    save()
    if (watchStore) watchStore.save()
    lastUpdateTime.value = new Date()
    isRefreshing.value = false

    setTimeout(() => checkAndRecordPnl(), 200)
    return { ok, total: allItems.length }
  }

  /** 检查并记录当日盈亏（幂等）
   *  核心逻辑：只记录 confirmedDate > _lastPnlDate 的新增确认净值
   *  新添加的基金首次刷新时仅设置 baseline（_lastPnlDate），不记录盈亏
   */
  async function checkAndRecordPnl() {
    // 第一步：分离"需要设置 baseline"和"需要记录盈亏"的基金
    const needBaseline = []
    const toRecord = []

    for (const f of funds.value) {
      if (!f.confirmedDate || !f.confirmedNav || !(f.holdingShares > 0)) continue
      const dow = new Date(f.confirmedDate + 'T00:00:00').getDay()
      if (dow < 1 || dow > 5) continue

      if (!f._lastPnlDate) {
        // 首次：设置 baseline，不记录盈亏
        needBaseline.push(f)
      } else if (f.confirmedDate > f._lastPnlDate) {
        // confirmedDate 比上次记录的更新，说明有新的确认净值
        toRecord.push(f)
      }
    }

    // 设置 baseline（新添加的基金跳过首次盈亏记录）
    if (needBaseline.length > 0) {
      for (const f of needBaseline) {
        f._lastPnlDate = f.confirmedDate
      }
      save()
    }

    if (toRecord.length === 0) return

    // 按日期分组，整体重算每个涉及到的日期
    const datesToRefresh = [...new Set(toRecord.map(f => f.confirmedDate))]
    datesToRefresh.forEach(d => { pnlHistory.value[d] = { total: 0, funds: [] } })

    const processedKeys = new Set()
    let recorded = false
    for (const f of toRecord) {
      const date = f.confirmedDate
      const key = date + '_' + f.code
      if (processedKeys.has(key)) continue
      processedKeys.add(key)

      let prevNAV = null
      try {
        const pzd = await fetchPingzhongdata(f.code)
        const trend = pzd.data || pzd
        if (trend && trend.length >= 2) {
          const sorted = [...trend].sort((a, b) => a.x - b.x)
          for (let i = 1; i < sorted.length; i++) {
            const d = new Date(sorted[i].x + 8 * 3600 * 1000).toISOString().slice(0, 10)
            if (d === date) { prevNAV = sorted[i - 1].y; break }
          }
        }
      } catch (_) {}

      if (prevNAV == null && f.prevNav != null && f.prevNav > 0 && f.prevNav !== f.confirmedNav) {
        prevNAV = f.prevNav
      }
      if (prevNAV === null) continue

      if (!pnlHistory.value[date]) pnlHistory.value[date] = { total: 0, funds: [] }
      const profit = parseFloat((f.holdingShares * (f.confirmedNav - prevNAV)).toFixed(2))
      pnlHistory.value[date].total = parseFloat((pnlHistory.value[date].total + profit).toFixed(2))
      pnlHistory.value[date].funds.push({ code: f.code, name: f.name || f.code, profit })
      // 更新该基金的最后记录日期
      f._lastPnlDate = date
      recorded = true
    }

    if (recorded) {
      save()
      savePnl()
    }
  }

  /** 设置自动刷新定时器（仅盘中 9:30-15:00 启动，每分钟检查一次是否需要刷新） */
  function resetTimer(watchStore) {
    if (timer.value) clearInterval(timer.value)
    timer.value = null
    if (isWeekend()) return
    const todayStr = getTodayStr()
    const allConfirmed = funds.value.length > 0 && funds.value.every(f => f.confirmedDate === todayStr)
    if (allConfirmed) return

    // 每 60 秒检查一次，但只在真正盘中时才执行刷新
    timer.value = setInterval(() => {
      if (isTradingHours()) refreshAll(watchStore)
    }, 60000)
  }

  function stopTimer() {
    if (timer.value) { clearInterval(timer.value); timer.value = null }
  }

  // ── Helper functions ──
  function _lockCostBasis(f) {
    if (!f.costBasisLocked && f.confirmedNav) {
      f.costBasis = f.costNav || f.confirmedNav
      f.costBasisLocked = true
    }
  }
  function _lockHoldingShares(f) {
    if (!f.holdingSharesLocked && f.costNav && f.amount) {
      f.holdingShares = parseFloat((f.amount / f.costNav).toFixed(4))
      f.holdingSharesLocked = true
    }
  }
  function _updateAmountByShares(f) {
    if (f.holdingShares > 0 && f.confirmedNav) {
      f.amount = parseFloat((f.holdingShares * f.confirmedNav).toFixed(2))
    }
  }

  /** 计算汇总数据 */
  const summary = computed(() => {
    if (funds.value.length === 0) return null
    const todayStr = getTodayStr()
    let totalAmount = 0, todayProfitSum = 0, yesterdayValue = 0, totalAccum = 0, totalCost = 0
    let hasLive = false

    funds.value.forEach(f => {
      totalAmount += f.amount || 0
      const currentNav = f.navConfirmed ? f.confirmedNav : f.gsz
      const costNav = f.costNav || f.prevNav
      const hasTodayData = f.navConfirmed ||
        (f.gsz !== null && !isNaN(f.gsz) && f.gztime && f.gztime.slice(0, 10) === todayStr)
      const shares = (f.holdingShares !== null && f.holdingShares > 0)
        ? f.holdingShares : (costNav && f.amount ? f.amount / costNav : 0)

      if (hasTodayData && currentNav !== null && !isNaN(currentNav) && shares > 0) {
        // 优先用 gszzl 推算昨日净值，避免 prevNav 被误设为持仓成本导致盈亏错误
        let effectivePrevNav = f.prevNav
        if (!f.navConfirmed && f.gszzl && !isNaN(f.gszzl) && f.gsz) {
          effectivePrevNav = f.gsz / (1 + f.gszzl / 100)
        }
        if (effectivePrevNav && effectivePrevNav > 0) {
          todayProfitSum += (currentNav - effectivePrevNav) * shares
          yesterdayValue += effectivePrevNav * shares
          hasLive = true
        }
      }

      const costBasisNav = (f.costBasisLocked && f.costBasis !== null && f.costBasis > 0)
        ? f.costBasis : costNav
      const navForAccum = hasTodayData ? currentNav : (f.confirmedNav ?? f.prevNav ?? currentNav ?? null)
      const accumShares = (f.holdingShares !== null && f.holdingShares > 0)
        ? f.holdingShares : (f.amount / (costBasisNav || costNav))
      if (navForAccum !== null && !isNaN(navForAccum) && costBasisNav) {
        totalAccum += accumShares * (navForAccum - costBasisNav)
        totalCost += accumShares * costBasisNav
      }
    })

    const change = yesterdayValue > 0 ? (todayProfitSum / yesterdayValue) * 100 : 0
    const totalAccumRate = totalCost > 0 ? (totalAccum / totalCost) * 100 : null

    return { totalAmount, todayProfit: todayProfitSum, change, totalAccum, totalAccumRate, hasLive }
  })

  return {
    funds, pnlHistory, lastUpdateTime, isRefreshing, summary,
    load, save, savePnl, addFund, removeFund, updateFund,
    refreshAll, checkAndRecordPnl, resetTimer, stopTimer
  }
})
