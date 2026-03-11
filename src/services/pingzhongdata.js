/**
 * 东方财富 pingzhongdata API
 * 获取基金净值走势数据（3种）：单位净值、累计净值、累计收益率
 * 使用 script 标签注入，无 CORS 限制
 */

let _pzdSeq = 0

/** 内存缓存：code → { netWorth, acWorth, grandTotal, name, ts } */
const _pzdCache = new Map()
const CACHE_TTL = 5 * 60 * 1000  // 5 分钟

/**
 * 串行队列：保证同一时刻只有一个 pingzhongdata script 在执行，
 * 避免多个 script 并发写全局变量互相覆盖。
 */
let _pzdQueue = Promise.resolve()

/**
 * 获取基金净值历史数据（3种走势）
 * @param {string} code - 6 位基金代码
 * @returns {Promise<{ data: Array, acWorth: Array, grandTotal: Array, name: string|null }>}
 *   - data: 单位净值 [{x, y, equityReturn, unitMoney}]（兼容旧消费端）
 *   - acWorth: 累计净值 [[timestamp, nav]]
 *   - grandTotal: 累计收益率 [{name, data: [[timestamp, pct]]}]
 */
export function fetchPingzhongdata(code) {
  const cached = _pzdCache.get(code)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return Promise.resolve({
      data: cached.netWorth,
      acWorth: cached.acWorth,
      grandTotal: cached.grandTotal,
      name: cached.name
    })
  }

  const req = _pzdQueue.then(() => _doFetch(code))
  _pzdQueue = req.catch(() => {})
  return req
}

function _doFetch(code) {
  return new Promise((resolve, reject) => {
    const scriptId = '_pzd_' + code + '_' + (++_pzdSeq)

    let settled = false
    const tid = setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error('timeout'))
    }, 12000)

    function cleanup() {
      clearTimeout(tid)
      const s = document.getElementById(scriptId)
      if (s) s.remove()
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.src = 'https://fund.eastmoney.com/pingzhongdata/' + code + '.js?v=' + Date.now()
    script.onload = function () {
      if (settled) return
      settled = true
      cleanup()
      const netWorth = window.Data_netWorthTrend || []
      const acWorth = window.Data_ACWorthTrend || []
      const grandTotal = window.Data_grandTotal || []
      const name = window.fS_name || null
      // 写入缓存
      _pzdCache.set(code, { netWorth, acWorth, grandTotal, name, ts: Date.now() })
      resolve({ data: netWorth, acWorth, grandTotal, name })
    }
    script.onerror = function () {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error('load error'))
    }
    document.head.appendChild(script)
  })
}
