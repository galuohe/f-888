/**
 * 基金排行 API (fund.eastmoney.com/data/rankhandler.aspx)
 * 开发环境走 Vite proxy；生产环境走 corsproxy.io
 * 返回格式: var rankData = {datas:[...], allRecords, pageIndex, pageNum, allPages}
 */

import { getTodayStr } from '@/utils/format'

const IS_DEV = import.meta.env.DEV

/**
 * 排序字段映射
 */
export const SORT_FIELDS = {
  rzdf:  '日涨幅',
  zzf:   '近1周',
  '1yzf': '近1月',
  '3yzf': '近3月',
  '6yzf': '近6月',
  '1nzf': '近1年',
  '2nzf': '近2年',
  '3nzf': '近3年',
  jnzf:  '今年来',
  lnzf:  '成立来',
}

/**
 * 基金类型映射
 */
export const FUND_TYPES = {
  all:  '全部',
  zs:   '指数型',
  gp:   '股票型',
  hh:   '混合型',
  zq:   '债券型',
  qdii: 'QDII',
  fof:  'FOF',
}

/**
 * 解析 "var rankData = {...};" 文本为 JS 对象
 */
function parseRankData(text) {
  const m = text.match(/var\s+rankData\s*=\s*(\{[\s\S]*\})\s*;?\s*$/)
  if (!m) throw new Error('解析失败')
  // datas 数组中的元素是字符串，不是标准 JSON，需要用 eval
  // 安全性：数据来源是东方财富官方接口
  const fn = new Function('return ' + m[1])
  return fn()
}

/**
 * 解析单条基金数据（逗号分隔字符串）
 */
function parseFundItem(str) {
  const p = str.split(',')
  return {
    code:       p[0],
    name:       p[1],
    jzrq:       p[3],
    dwjz:       p[4],
    ljjz:       p[5],
    rzdf:       p[6],    // 日涨跌幅
    zzf:        p[7],    // 近1周
    '1yzf':     p[8],    // 近1月
    '3yzf':     p[9],    // 近3月
    '6yzf':     p[10],   // 近6月
    '1nzf':     p[11],   // 近1年
    '2nzf':     p[12],   // 近2年
    '3nzf':     p[13],   // 近3年
    jnzf:       p[14],   // 今年来
    lnzf:       p[15],   // 成立来
    startDate:  p[16],   // 成立日期
    fee:        p[20],   // 手续费
  }
}

/**
 * 获取基金排行数据
 * @param {Object} params
 * @param {string} params.sortBy - 排序字段 (rzdf, zzf, 1yzf, 3yzf, ...)
 * @param {string} params.order  - 排序方向 (desc/asc)
 * @param {string} params.type   - 基金类型 (all, gp, hh, zq, qdii, fof)
 * @param {number} params.page   - 页码 (1-based)
 * @param {number} params.size   - 每页数量
 * @returns {Promise<{list: Array, total: number, page: number, pages: number}>}
 */
export async function fetchFundRank({ sortBy = 'rzdf', order = 'desc', type = 'all', page = 1, size = 50 } = {}) {
  const today = getTodayStr()
  const lastYear = (parseInt(today.slice(0, 4)) - 1) + today.slice(4)

  const qs = new URLSearchParams({
    op: 'ph', dt: 'kf', ft: type, rs: '', gs: '0',
    sc: sortBy, st: order,
    sd: lastYear, ed: today,
    qdii: '', tabSubtype: ',,,,,',
    pi: String(page), pn: String(size),
    dx: '1', v: '0.' + Date.now(),
  })

  const path = `/data/rankhandler.aspx?${qs}`
  let url
  if (IS_DEV) {
    url = `/api-rank${path}`
  } else {
    url = `https://corsproxy.io/?${encodeURIComponent('https://fund.eastmoney.com' + path)}`
  }

  const resp = await fetch(url)
  if (!resp.ok) throw new Error('请求失败: ' + resp.status)
  const text = await resp.text()
  const raw = parseRankData(text)

  return {
    list: (raw.datas || []).map(parseFundItem),
    total: raw.allRecords || 0,
    page: raw.pageIndex || page,
    pages: raw.allPages || 0,
    counts: {
      all:  raw.allNum || raw.allRecords || 0,
      zs:   raw.zs_count || 0,
      gp:   raw.gp_count || 0,
      hh:   raw.hh_count || 0,
      zq:   raw.zq_count || 0,
      qdii: raw.qdii_count || 0,
      fof:  raw.fof_count || 0,
    },
  }
}
