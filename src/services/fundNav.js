/**
 * 基金净值 API (fund.eastmoney.com/Data/Fund_JJJZ_Data.aspx)
 * 开发环境走 Vite proxy；生产环境走 corsproxy.io
 * 返回格式: var db = {datas:[...], record, pages, curpage, showday:[...]}
 */

const IS_DEV = import.meta.env.DEV

/**
 * 基金类型映射 (lx 参数)
 */
export const NAV_FUND_TYPES = {
  1: '全部',
  8: '指数型',
  2: '股票型',
  3: '混合型',
  4: '债券型',
  5: 'QDII',
  9: 'FOF',
}

/**
 * 可排序字段
 */
export const NAV_SORT_FIELDS = {
  rzdf: '日增长率',
  dwjz: '单位净值',
  ljjz: '累计净值',
}

/**
 * 解析 "var db = {...}" 文本为 JS 对象
 */
function parseDbData(text) {
  const m = text.match(/var\s+db\s*=\s*(\{[\s\S]*\})\s*;?\s*$/)
  if (!m) throw new Error('解析失败')
  const fn = new Function('return ' + m[1])
  return fn()
}

/**
 * 解析单条基金数据（数组格式）
 */
function parseNavItem(arr) {
  return {
    code:       arr[0],
    name:       arr[1],
    // arr[2] = 拼音
    dwjz:       arr[3],  // 最新单位净值
    ljjz:       arr[4],  // 最新累计净值
    prevDwjz:   arr[5],  // 上期单位净值
    prevLjjz:   arr[6],  // 上期累计净值
    dailyGrow:  arr[7],  // 日增长值
    dailyRate:  arr[8],  // 日增长率%
    buyStatus:  arr[9],  // 申购状态
    sellStatus: arr[10], // 赎回状态
    fee:        arr[18], // 手续费
  }
}

/**
 * 获取基金净值数据
 * @param {Object} params
 * @param {string} params.sortBy - 排序字段 (rzdf, dwjz, ljjz)
 * @param {string} params.order  - 排序方向 (desc/asc)
 * @param {number} params.type   - 基金类型 (1=全部,2=股票,3=混合,4=债券,5=QDII,8=指数,9=FOF)
 * @param {number} params.page   - 页码 (1-based)
 * @param {number} params.size   - 每页数量
 * @param {string} params.text   - 搜索关键词
 * @returns {Promise<{list: Array, total: number, page: number, pages: number, showday: Array}>}
 */
export async function fetchFundNav({ sortBy = 'rzdf', order = 'desc', type = 1, page = 1, size = 200, text = '' } = {}) {
  const qs = new URLSearchParams({
    t: '10',
    lx: String(type),
    letter: '',
    gsid: '',
    text,
    sort: `${sortBy},${order}`,
    page: `${page},${size}`,
    dt: String(Date.now()),
    atfc: '',
    onlySale: '0',
    isLatest: '0',
    _: String(Date.now()),
  })

  const path = `/Data/Fund_JJJZ_Data.aspx?${qs}`
  let url
  if (IS_DEV) {
    url = `/api-nav${path}`
  } else {
    url = `https://corsproxy.io/?${encodeURIComponent('https://fund.eastmoney.com' + path)}`
  }

  const resp = await fetch(url)
  if (!resp.ok) throw new Error('请求失败: ' + resp.status)
  const rawText = await resp.text()
  const raw = parseDbData(rawText)

  return {
    list: (raw.datas || []).map(parseNavItem),
    total: parseInt(raw.record) || 0,
    page: parseInt(raw.curpage) || page,
    pages: parseInt(raw.pages) || 0,
    showday: raw.showday || [],
  }
}
