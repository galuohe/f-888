/**
 * 交易时间工具函数
 */

/**
 * 判断当前是否为交易日盘前（周一~五 09:30 前）
 */
export function isPreMarketNow() {
  const d = new Date()
  if (d.getDay() === 0 || d.getDay() === 6) return false
  const h = d.getHours()
  const m = d.getMinutes()
  return h < 9 || (h === 9 && m < 30)
}

/**
 * 判断当前是否为周末
 */
export function isWeekend() {
  const dow = new Date().getDay()
  return dow === 0 || dow === 6
}

/**
 * 获取当前市场状态
 * @returns {'pre-market' | 'trading' | 'after-close' | 'nav-releasing' | 'weekend'}
 */
export function getMarketStatus() {
  const now = new Date()
  const dow = now.getDay()
  const h = now.getHours()
  const m = now.getMinutes()

  if (dow === 0 || dow === 6) return 'weekend'
  if (h < 9 || (h === 9 && m < 30)) return 'pre-market'
  if (h < 15) return 'trading'
  if (h < 21 || (h === 21 && m < 30)) return 'after-close'
  return 'nav-releasing'
}

/**
 * 根据市场状态获取 Badge 文本和 CSS 类名
 */
export function getMarketBadge(confirmedCount, totalCount) {
  if (confirmedCount > 0) {
    const label =
      confirmedCount === totalCount
        ? '已出净值'
        : confirmedCount + '/' + totalCount + ' 已出净值'
    return { label, cls: 'nav-mode-badge confirmed' }
  }

  const status = getMarketStatus()
  switch (status) {
    case 'weekend':
      return { label: '非交易日', cls: 'nav-mode-badge estimated' }
    case 'pre-market':
      return { label: '盘前休市', cls: 'nav-mode-badge estimated' }
    case 'trading':
      return { label: '盘中实时估值', cls: 'nav-mode-badge live' }
    case 'after-close':
      return { label: '已收盘 · 待出净值', cls: 'nav-mode-badge estimated' }
    case 'nav-releasing':
      return { label: '净值陆续发布中', cls: 'nav-mode-badge estimated' }
    default:
      return { label: '--', cls: 'nav-mode-badge estimated' }
  }
}

/**
 * 判断当前是否在盘中交易时间（周一~五 09:30-15:00）
 */
export function isTradingHours() {
  const d = new Date()
  if (d.getDay() === 0 || d.getDay() === 6) return false
  const mins = d.getHours() * 60 + d.getMinutes()
  return mins >= 9 * 60 + 30 && mins < 15 * 60
}

/**
 * 计算自动刷新间隔（毫秒）
 * 盘中 60 秒，其余时间返回 null 表示不刷新
 */
export function getAutoRefreshInterval() {
  return isTradingHours() ? 60000 : null
}
