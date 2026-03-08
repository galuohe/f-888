/**
 * 天天基金 JSONP 接口（fundgz.1234567.com.cn）
 * 在 Vue 3 中无法使用 fetch（CORS），需保留 JSONP script tag 方式
 */

/**
 * 基金搜索（东方财富 FundSearchAPI，JSONP）
 * @param {string} keyword - 基金代码或名称关键词
 * @returns {Promise<Array<{CODE:string, NAME:string}>>}
 */
export function searchFunds(keyword) {
  if (!keyword || !keyword.trim()) return Promise.resolve([])
  const cbName = '_fsearch_' + Date.now()
  const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(keyword.trim())}&callback=${cbName}&_=${Date.now()}`
  return new Promise((resolve) => {
    const tid = setTimeout(() => {
      delete window[cbName]
      if (script.parentNode) script.remove()
      resolve([])
    }, 8000)
    window[cbName] = (data) => {
      clearTimeout(tid)
      delete window[cbName]
      if (script.parentNode) script.remove()
      const results = (data && data.Datas) ? data.Datas.filter(d =>
        d.CATEGORY === 700 || d.CATEGORY === '700' || d.CATEGORYDESC === '基金'
      ) : []
      resolve(results)
    }
    const script = document.createElement('script')
    script.src = url
    script.onerror = () => {
      clearTimeout(tid)
      delete window[cbName]
      script.remove()
      resolve([])
    }
    document.head.appendChild(script)
  })
}

/* ── fundgz 全局 dispatcher（拦截 window.jsonpgz 的赋值） ── */
const _gzResolvers = {}
let _gzFallback = null

;(function initDispatcher() {
  const _dispatch = function (d) {
    if (d && d.fundcode && _gzResolvers[d.fundcode]) {
      const fn = _gzResolvers[d.fundcode]
      delete _gzResolvers[d.fundcode]
      fn(d)
      return
    }
    if (_gzFallback) _gzFallback(d)
  }
  Object.defineProperty(window, 'jsonpgz', {
    configurable: false,
    enumerable: true,
    get() { return _dispatch },
    set(fn) { _gzFallback = fn }
  })
})()

/**
 * 获取单只基金估值数据（JSONP）
 * @param {string} code - 6 位基金代码
 * @returns {Promise<Object>} - fundgz API 数据
 */
export function fetchOne(code) {
  return new Promise((resolve, reject) => {
    const scriptId = '_fscript_' + code
    let settled = false

    const tid = setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error('timeout'))
    }, 9000)

    function cleanup() {
      clearTimeout(tid)
      const s = document.getElementById(scriptId)
      if (s) s.remove()
    }

    // 注册按 code 路由的回调
    _gzResolvers[code] = function (data) {
      if (settled) return
      settled = true
      cleanup()
      resolve(data)
    }

    // 兼容旧逻辑：也设 fallback
    window.jsonpgz = function (data) {
      if (settled) return
      settled = true
      cleanup()
      resolve(data)
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.referrerPolicy = 'no-referrer'
    script.src = 'https://fundgz.1234567.com.cn/js/' + code + '.js?t=' + Date.now()
    script.onerror = function () {
      if (settled) return
      settled = true
      cleanup()
      delete _gzResolvers[code]
      reject(new Error('load error'))
    }
    document.head.appendChild(script)
  })
}

/**
 * 获取当日分时估值数据（腾讯财经，fetch JSON，支持 CORS）
 * @param {string} code - 6 位基金代码
 * @returns {Promise<{times: string[], values: number[], yesterdayDwjz: number}|null>}
 */
export async function fetchIntraday(code) {
  const url = 'https://web.ifzq.gtimg.cn/fund/newfund/fundSsgz/getSsgz?app=web&symbol=jj' + code + '&_=' + Date.now()
  const resp = await fetch(url)
  const result = await resp.json()
  if (result.code !== 0 || !result.data || !Array.isArray(result.data.data) || !result.data.data.length) {
    return null
  }
  const yDwjz = parseFloat(result.data.yesterdayDwjz)
  if (!yDwjz) return null
  const times  = result.data.data.map(d => d[0].slice(0, 2) + ':' + d[0].slice(2))
  const values = result.data.data.map(d => Number(d[1]))
  return { times, values, yesterdayDwjz: yDwjz }
}

/**
 * 获取前十重仓股数据（东方财富 fundf10，JSONP）
 * @param {string} code - 6 位基金代码
 * @returns {Promise<Array<{code: string, name: string, ratio: number}>>}
 */
export function fetchHoldings(code) {
  return new Promise((resolve) => {
    const scriptId = '_fdH_' + code + '_s'
    const old = document.getElementById(scriptId)
    if (old) old.remove()
    window.apidata = undefined

    const script = document.createElement('script')
    script.id  = scriptId
    script.referrerPolicy = 'no-referrer'
    script.src = 'https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=' + code + '&topline=10&year=&month=&_=' + Date.now()
    script.onload = function () {
      const html = (window.apidata && window.apidata.content) || ''
      window.apidata = undefined
      script.remove()
      resolve(_parseHoldingsHtml(html))
    }
    script.onerror = function () {
      window.apidata = undefined
      script.remove()
      resolve([])
    }
    document.head.appendChild(script)
  })
}

/** 从 HTML 表格解析重仓股 */
function _parseHoldingsHtml(html) {
  if (!html) return []
  const holdings = []
  const thMatch = html.match(/<thead[\s\S]*?<\/thead>/i) || []
  const headers = ((thMatch[0] || '').match(/<th[\s\S]*?>([\s\S]*?)<\/th>/gi) || [])
    .map(th => th.replace(/<[^>]*>/g, '').trim())
  let iCode = -1, iName = -1, iWeight = -1
  headers.forEach((h, i) => {
    const t = h.replace(/\s+/g, '')
    if (iCode < 0 && (t.includes('股票代码') || t.includes('证券代码'))) iCode = i
    if (iName < 0 && (t.includes('股票名称') || t.includes('证券名称'))) iName = i
    if (iWeight < 0 && (t.includes('占净值比例') || t.includes('占比'))) iWeight = i
  })
  const tbodyMatch = html.match(/<tbody[\s\S]*?<\/tbody>/i) || []
  const rows = ((tbodyMatch[0] || html).match(/<tr[\s\S]*?<\/tr>/gi) || [])
  rows.forEach(r => {
    const tds = (r.match(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi) || [])
      .map(td => td.replace(/<[^>]*>/g, '').trim())
    if (!tds.length) return
    let code = '', name = '', weight = ''
    if (iCode >= 0 && iCode < tds.length) code = tds[iCode]
    if (iName >= 0 && iName < tds.length) name = tds[iName]
    if (iWeight >= 0 && iWeight < tds.length) weight = tds[iWeight]
    if (!code && tds.length >= 3) { code = tds[1]; name = tds[2] }
    if (!weight && tds.length >= 7) weight = tds[6]
    if (!code) return
    const ratio = parseFloat(weight.replace('%', ''))
    holdings.push({ code, name, ratio: isNaN(ratio) ? null : ratio })
  })
  return holdings
}

/**
 * 批量获取股票今日涨跌（腾讯行情 JSONP）
 * @param {Array<{code: string}>} stocks - 股票列表
 * @returns {Promise<Object>} - { stockCode: changePercent }
 */
export function fetchStockChanges(stocks) {
  if (!stocks || stocks.length === 0) return Promise.resolve({})
  const qs = stocks.map(s => {
    const c = s.code || ''
    const pfx = c.startsWith('6') ? 'sh' : 'sz'
    return 's_' + pfx + c
  }).join(',')
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.referrerPolicy = 'no-referrer'
    script.src = 'https://qt.gtimg.cn/q=' + qs + '&_=' + Date.now()
    script.onload = function () {
      const result = {}
      stocks.forEach(s => {
        const c = s.code || ''
        const pfx = c.startsWith('6') ? 'sh' : 'sz'
        const key = 'v_s_' + pfx + c
        const raw = window[key]
        if (raw) {
          const parts = String(raw).split('~')
          if (parts.length > 5) result[c] = parseFloat(parts[5])
        }
      })
      script.remove()
      resolve(result)
    }
    script.onerror = function () {
      script.remove()
      resolve({})
    }
    document.head.appendChild(script)
  })
}
