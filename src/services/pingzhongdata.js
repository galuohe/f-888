/**
 * 东方财富 pingzhongdata API
 * 用于获取近 90 日净值走势 / 历史确认净值
 * 使用 script 标签注入，无 CORS 限制
 */

let _pzdSeq = 0

/** 内存缓存：code → { data, name, ts } */
const _pzdCache = new Map()
const CACHE_TTL = 5 * 60 * 1000  // 5 分钟

/**
 * 串行队列：保证同一时刻只有一个 pingzhongdata script 在执行，
 * 避免多个 script 并发写 window.Data_netWorthTrend 互相覆盖。
 */
let _pzdQueue = Promise.resolve()

/**
 * 获取基金净值历史趋势（Data_netWorthTrend）
 * @param {string} code - 6 位基金代码
 * @returns {Promise<{ data: Array, name: string|null }>}
 */
export function fetchPingzhongdata(code) {
  // 命中缓存则立即返回
  const cached = _pzdCache.get(code)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return Promise.resolve({ data: cached.data, name: cached.name })
  }

  // 将实际请求追加到串行队列末尾
  const req = _pzdQueue.then(() => _doFetch(code))
  // 让队列继续推进，即使本次请求失败也不阻断后续请求
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
      const data = window.Data_netWorthTrend || []
      const name = window.fS_name || null
      // 写入缓存
      _pzdCache.set(code, { data, name, ts: Date.now() })
      resolve({ data, name })
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
