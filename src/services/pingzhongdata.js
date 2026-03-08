/**
 * 东方财富 pingzhongdata API
 * 用于获取近 90 日净值走势 / 历史确认净值
 * 使用 script 标签注入，无 CORS 限制
 */

let _pzdSeq = 0

/**
 * 获取基金净值历史趋势（Data_netWorthTrend）
 * @param {string} code - 6 位基金代码
 * @returns {Promise<Array>} - [{ x: timestamp_ms, y: nav, equityReturn: '...' }]
 */
export function fetchPingzhongdata(code) {
  return new Promise((resolve, reject) => {
    const scriptId = '_pzd_' + code + '_' + (++_pzdSeq)

    const existing = document.getElementById(scriptId)
    if (existing) existing.remove()

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

    // 清理上次残留的全局变量（用赋值而非 delete，因为 var 声明的全局属性
    // configurable=false，在 ES Module 严格模式下 delete 会抛 TypeError）
    window.Data_netWorthTrend = undefined

    const script = document.createElement('script')
    script.id = scriptId
    script.src = 'https://fund.eastmoney.com/pingzhongdata/' + code + '.js?v=' + Date.now()
    script.onload = function () {
      if (settled) return
      settled = true
      cleanup()
      const result = window.Data_netWorthTrend || []
      const name = window.fS_name || null
      resolve({ data: result, name })
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
