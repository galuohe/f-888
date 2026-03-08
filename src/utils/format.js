/**
 * 格式化工具函数
 */

/**
 * 格式化数字（保留 n 位小数）
 */
export function fmt(n, decimals = 2) {
  if (n === null || n === undefined || isNaN(n)) return '--'
  return Number(n).toFixed(decimals)
}

/**
 * 格式化大数字（万元）
 */
export function fmtNum(n) {
  const abs = Math.abs(n)
  if (abs >= 10000) return (n / 10000).toFixed(2) + '万'
  return abs < 1000
    ? n.toFixed(2)
    : n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * 格式化日期为 MM.DD
 */
export function fmtMD(dateStr) {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  return parseInt(parts[1]) + '.' + parts[2]
}

/**
 * 获取今天日期字符串 YYYY-MM-DD
 */
export function getTodayStr() {
  const d = new Date()
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  )
}

/**
 * 简单 Markdown → HTML 转换（用于 AI 消息）
 */
export function markdownToHtml(text) {
  return escHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 4px;border-radius:3px;font-size:12px;">$1</code>')
    .replace(/^#{1,3}\s+(.+)$/gm, '<strong style="display:block;margin-top:6px;">$1</strong>')
    .replace(/\n/g, '<br>')
}

/**
 * HTML 转义
 */
export function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
