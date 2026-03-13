/**
 * useMarketData — shared composable for MarketRankView and SectorView
 *
 * Holds the deduped fund pool, fetches data in two stages:
 *   Stage 1: fetchOne() in batches of 5 (fast, always)
 *   Stage 2: fetchPingzhongdata() for confirmed NAVs after 18:00 or on weekends
 *
 * Cache rules:
 *   - If any confirmed NAV is present: cache never expires
 *   - Otherwise: cache expires after 30 minutes
 */

import { ref } from 'vue'
import { fetchOne } from '@/services/fundApi'
import { fetchPingzhongdata } from '@/services/pingzhongdata'
import { getTodayStr } from '@/utils/format'

export const MR_SECTORS = {
  '黄金':         ['000217'],
  '黄金股':       ['002207','017992','001467','025446','161810','009394','021362'],
  '油气资源':     ['023145','021620','023833','020406','021823','019828','020105','017856','021694','160723','006476','007844'],
  '有色金属':     ['003305','023307','025476','007776','021637','022321'],
  '机器人':       ['018125','016531','023567'],
  'CPO':          ['022124','022120','024460','026211','026155','010416','025422','011452','002112','016371','018957'],
  '军工':         ['025647','013566','011113','010741','017941','018075'],
  '商业航天':     ['015790','025949','025647','000690','010052'],
  '卫星产业':     ['024195','025491'],
  '电网设备':     ['025857','025833','001665','167002','011172','025793'],
  '绿色电力':     ['561560','561170','159611','017105','017106'],
  '稀土永磁':     ['011036','014111','013943','014332','019088','019875'],
  '光伏':         ['011103','007083','011967','012365','012723','014605'],
  '人工智能':     ['005963','018994','024561','023565'],
  '半导体':       ['014143','021492','015967','014319','024424'],
  '存储芯片':     ['025209','025500'],
  '通信':         ['010524','008087','007818','020900'],
  '煤炭':         ['013275','008280','013596','016814','015566','017787'],
  '基建':         ['004857','005228','017684','020904'],
  '电力':         ['017057','021753','016186','017482'],
  '云计算':       ['017488','019427'],
  '脑机接口':     ['019414'],
  'AI应用':       ['018463'],
  '稀有金属':     ['014111'],
  '工业有色金属': ['017193'],
  '有色期货':     ['007911'],
  '半导体材料设备':['017811'],
  '锂矿':         ['290014'],
  '可控核聚变':   ['024203'],
}

/** Build the deduped pool — each code gets its first matching sector */
export function getPool() {
  const codeToSector = {}
  for (const [sector, codes] of Object.entries(MR_SECTORS)) {
    for (const c of codes) {
      const code = String(c).trim()
      if (code && !codeToSector[code]) codeToSector[code] = sector
    }
  }
  return Object.entries(codeToSector).map(([code, sector]) => ({ code, sector }))
}

// ── localStorage 持久缓存 ──
const LS_KEY = 'mr_items_cache'

function _readLsCache() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function _writeLsCache(items) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ t: Date.now(), items }))
  } catch { /* quota exceeded */ }
}

// ── Module-level shared cache (survives component unmount/remount) ──
const _items     = ref([])   // { code, name, nav, ret, jzrq, confirmed, sector }
const _isLoading = ref(false)
const _lastRefresh = ref(null)
let   _cacheTime = 0
let   _lsRestored = false

function _isWeekend() {
  const d = new Date().getDay()
  return d === 0 || d === 6
}

function _useConfirmedNav() {
  if (_isWeekend()) return true
  return new Date().getHours() >= 18
}

/** Compute last-trading-day data from a pingzhongdata trend array */
function _lastTradingDayData(trend) {
  if (!trend || trend.length < 2) return null
  const sorted = [...trend].sort((a, b) => a.x - b.x)
  const last = sorted[sorted.length - 1]
  const prev = sorted[sorted.length - 2]
  if (!last?.y || !prev?.y || prev.y <= 0) return null
  const ret  = (last.y - prev.y) / prev.y * 100
  const jzrq = new Date(last.x + 8 * 3600 * 1000).toISOString().slice(0, 10)
  return { nav: last.y, jzrq, ret }
}

/**
 * Batch-fetch fetchOne for an array of {code, sector}, BATCH_SIZE concurrent.
 * Returns a map: code → raw result object (or undefined if failed).
 */
async function _fetchOneBatch(pool, BATCH = 25, onProgress) {
  const todayStr = getTodayStr()
  const isTradingDay = !_isWeekend()
  const results  = {}

  for (let i = 0; i < pool.length; i += BATCH) {
    if (onProgress) onProgress(Math.min(i + BATCH, pool.length), pool.length)
    const batch = pool.slice(i, i + BATCH)
    const batchRes = await Promise.all(batch.map(async ({ code, sector }) => {
      try {
        const d = await fetchOne(code)
        const gszzl = parseFloat(d.gszzl)
        // gszzl 无效（如部分 QDII 基金盘前无估值）则跳过，由 pingzhongdata 兜底
        if (isNaN(gszzl)) return null

        const jzrq      = (d.jzrq || '').trim()
        const jzrqToday = jzrq === todayStr
        const confirmed = isTradingDay
          ? (jzrqToday ? true : false)
          : (jzrqToday ? true : null)

        // 判断是否有今日估值
        const hasGsz = d.gsz && d.gsz !== '' && !isNaN(parseFloat(d.gsz))

        // nav：优先今日确认净值，其次估值，最后历史确认净值
        const nav = jzrqToday && d.dwjz && d.dwjz !== ''
          ? d.dwjz
          : (hasGsz ? d.gsz : (d.dwjz || '--'))

        // navDate：与 nav 值对应的日期
        //   - 今日确认净值 → jzrq（今天）
        //   - 估值（gsz）  → todayStr（估值是今天的）
        //   - 历史确认净值 → jzrq（上次确认日期）
        const navDate = jzrqToday ? jzrq : (hasGsz ? todayStr : jzrq)

        return {
          code: d.fundcode || code,
          name: d.name || code,
          sector,
          nav,
          ret: gszzl,
          confirmed,
          jzrq: navDate,
          isEstimate: !jzrqToday && hasGsz,  // true=显示的是今日gsz估值，false=历史确认净值
        }
      } catch (_) {
        return null
      }
    }))
    batchRes.forEach(r => { if (r) results[r.code] = r })
  }
  return results
}

/**
 * Batch-fetch fetchPingzhongdata for an array of {code, sector}.
 * Returns array of result objects sorted by ret desc.
 */
async function _fetchPzdBatch(pool, BATCH = 20, onProgress) {
  const todayStr = getTodayStr()
  const results  = []

  for (let i = 0; i < pool.length; i += BATCH) {
    if (onProgress) onProgress(Math.min(i + BATCH, pool.length), pool.length)
    const batch = pool.slice(i, i + BATCH)
    const batchRes = await Promise.all(batch.map(async ({ code, sector }) => {
      try {
        const pzd = await fetchPingzhongdata(code)
        const trend = pzd.data || pzd
        const data  = _lastTradingDayData(trend)
        if (!data) return null
        return {
          code,
          name: pzd.name || code,
          sector,
          nav: data.nav,
          jzrq: data.jzrq,
          ret: data.ret,
          // pingzhongdata 只含历史确认净值，永远不是盘中估值
          confirmed: data.jzrq === todayStr ? true : (_isWeekend() ? null : false),
          isEstimate: false,
        }
      } catch (_) {
        return null
      }
    }))
    results.push(...batchRes.filter(Boolean))
  }
  return results
}

export function useMarketData() {
  /**
   * Load (or refresh) the fund pool data.
   * @param {boolean} force - if true, bypass cache
   * @param {Function} [onStatus] - optional callback(msg: string) for progress messages
   */
  async function load(force = false, onStatus) {
    // 首次加载时，先从 localStorage 恢复缓存立即渲染
    if (!_lsRestored && _items.value.length === 0) {
      _lsRestored = true
      const cached = _readLsCache()
      if (cached && cached.items && cached.items.length) {
        _items.value = cached.items
        _cacheTime = cached.t || 0
        _lastRefresh.value = cached.t ? new Date(cached.t) : null
        window._mrCache = cached.items
      }
    }

    // Cache validity check
    if (!force && _items.value.length > 0) {
      const age = Date.now() - _cacheTime
      const hasConfirmed = _items.value.some(r => r.confirmed === true)
      const stale = hasConfirmed ? false : age > 30 * 60 * 1000
      if (!stale) return
    }

    if (_isLoading.value) return
    _isLoading.value = true

    const pool        = getPool()
    const codeToSector = Object.fromEntries(pool.map(p => [p.code, p.sector]))
    const todayStr    = getTodayStr()

    try {
      // ── Stage 1: fetchOne (fast, handles both estimated and confirmed) ──
      if (onStatus) onStatus('加载中…')
      const raw = await _fetchOneBatch(pool, 25, (done, total) => {
        if (onStatus) onStatus(`加载中… ${done}/${total}`)
      })

      // Fallback for codes that failed: try pingzhongdata
      const failedCodes = pool.filter(p => !raw[p.code])
      if (failedCodes.length > 0) {
        if (onStatus) onStatus(`补充加载 ${failedCodes.length} 只…`)
        const fallback = await _fetchPzdBatch(failedCodes, 20, (done, total) => {
          if (onStatus) onStatus(`补充加载 ${done}/${total}`)
        })
        fallback.forEach(r => { raw[r.code] = r })
      }

      let results = Object.values(raw)
        .map(r => ({ ...r, sector: codeToSector[r.code] || r.sector || '' }))
        .sort((a, b) => b.ret - a.ret)

      _items.value = results
      _cacheTime   = Date.now()
      _lastRefresh.value = new Date()
      window._mrCache = results
      _writeLsCache(results)

      // ── Stage 2: fetchPingzhongdata for confirmed NAVs after 18:00 or weekends ──
      // 只对 Stage 1 未确认（confirmed !== true）的基金发请求，减少重复网络请求
      const unconfirmedPool = pool.filter(p => raw[p.code]?.confirmed !== true)
      const needPzd = _useConfirmedNav() && unconfirmedPool.length > 0
      if (needPzd) {
        if (onStatus) onStatus(`正在获取确认净值（${unconfirmedPool.length} 只）…`)
        const pzdResults = await _fetchPzdBatch(unconfirmedPool, 20, (done, total) => {
          if (onStatus) onStatus(`确认净值 ${done}/${total}…`)
        })

        // Replace entries where PZD has a newer or same-day confirmed date
        const cMap = {}
        pzdResults.forEach(r => {
          const existing = results.find(x => x.code === r.code)
          if (r.jzrq === todayStr || (existing && r.jzrq >= existing.jzrq)) {
            cMap[r.code] = r
          }
        })

        if (Object.keys(cMap).length > 0) {
          results = results
            .map(r => {
              const c = cMap[r.code]
              if (!c) return r
              return {
                ...c,
                sector: r.sector || c.sector,
                confirmed: c.jzrq === todayStr ? true : null,
              }
            })
            .sort((a, b) => b.ret - a.ret)

          _items.value = results
          _cacheTime   = Date.now()
          _lastRefresh.value = new Date()
          window._mrCache = results
          _writeLsCache(results)
        }

        const confirmedCount = pzdResults.filter(r => r.jzrq === todayStr).length
        if (onStatus) {
          onStatus(
            confirmedCount > 0
              ? `已更新 ${confirmedCount} 只确认净值`
              : '确认净值暂未公布'
          )
        }
      }
    } catch (e) {
      if (onStatus) onStatus(`加载失败：${e.message}`)
    } finally {
      _isLoading.value = false
    }
  }

  /** Force-clear cache and reload (保留旧数据边看边刷新) */
  function forceReload(onStatus) {
    _cacheTime = 0
    return load(true, onStatus)
  }

  return {
    items: _items,
    isLoading: _isLoading,
    lastRefresh: _lastRefresh,
    load,
    forceReload,
    getPool,
    MR_SECTORS,
  }
}
