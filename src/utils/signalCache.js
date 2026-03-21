/**
 * 综合信号：计算 + 缓存
 * 纯函数提取自 FundExpandPanel 的 computed 逻辑，供面板和批量刷新共用
 */
import { reactive } from 'vue'

// key: fund code, value: { zone, zoneLevel, confidence, composite }
export const signalCache = reactive({})

/**
 * 从历史净值数组计算技术指标
 * @param {Array} fullTrend - [[timestamp, nav], ...] 或 [{x, y}, ...]
 * @returns {Object|null} techIndicators
 */
export function calcTechIndicators(fullTrend) {
  if (!fullTrend || fullTrend.length < 20) return null

  const vals = fullTrend.map(d => Array.isArray(d) ? d[1] : d.y)
  const len = vals.length
  const current = vals[len - 1]

  const ma20 = len >= 20 ? vals.slice(len - 20).reduce((s, v) => s + v, 0) / 20 : null
  const ma60 = len >= 60 ? vals.slice(len - 60).reduce((s, v) => s + v, 0) / 60 : null
  const bias20 = ma20 ? ((current - ma20) / ma20 * 100) : null

  let ma60Trend = null
  if (len >= 65) {
    const ma60_5ago = vals.slice(len - 65, len - 5).reduce((s, v) => s + v, 0) / 60
    if (ma60 > ma60_5ago * 1.001) ma60Trend = 'up'
    else if (ma60 < ma60_5ago * 0.999) ma60Trend = 'down'
    else ma60Trend = 'flat'
  }

  let winCount = 0, sampleCount = 0
  const toleranceLevels = [0.02, 0.05, 0.08, 0.12]
  for (const pct of toleranceLevels) {
    winCount = 0; sampleCount = 0
    const tol = current * pct
    for (let i = 0; i < len - 20; i++) {
      if (Math.abs(vals[i] - current) <= tol) {
        sampleCount++
        if (vals[i + 20] > vals[i]) winCount++
      }
    }
    if (sampleCount >= 30) break
  }
  const winRate = sampleCount > 0 ? (winCount / sampleCount * 100) : null

  let signal = null
  if (bias20 !== null && winRate !== null) {
    if (bias20 < -3 && winRate >= 60) signal = { text: '超跌区域，历史胜率较高，可关注', level: 'buy' }
    else if (bias20 < -2 && winRate >= 50) signal = { text: '偏离均线较远，可考虑分批布局', level: 'buy' }
    else if (bias20 > 3 && winRate < 40) signal = { text: '短期涨幅较大，注意风险', level: 'sell' }
    else if (bias20 > 2) signal = { text: '偏离均线偏高，建议分批减仓', level: 'sell' }
    else signal = { text: '均线附近震荡，持有观望', level: 'hold' }
  } else if (bias20 !== null) {
    if (bias20 < -3) signal = { text: '超跌区域，可关注', level: 'buy' }
    else if (bias20 > 3) signal = { text: '短期涨幅较大，注意风险', level: 'sell' }
    else signal = { text: '均线附近，持有观望', level: 'hold' }
  }

  return { current, ma20, ma60, bias20, ma60Trend, winRate, sampleCount, signal, tradingDays: len }
}

/**
 * 从历史净值数组计算波段信号
 * @param {Array} fullTrend - [[timestamp, nav], ...]
 * @returns {Object|null} bandSignal
 */
export function calcBandSignal(fullTrend) {
  if (!fullTrend || fullTrend.length < 60) return null

  const vals = fullTrend.map(d => Array.isArray(d) ? d[1] : d.y)
  const len = vals.length
  const current = vals[len - 1]

  function calcMaxDrawdown(arr) {
    let peak = arr[0], maxDD = 0
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] > peak) peak = arr[i]
      const dd = (arr[i] - peak) / peak * 100
      if (dd < maxDD) maxDD = dd
    }
    return maxDD
  }

  const histPeak = Math.max(...vals)
  const currentDD = ((current - histPeak) / histPeak * 100)
  const histMaxDD = calcMaxDrawdown(vals)

  const t1 = histMaxDD * 0.33
  const t2 = histMaxDD * 0.66
  const position = histMaxDD !== 0 ? ((currentDD - histMaxDD) / (0 - histMaxDD) * 100) : 50

  let zone, zoneLevel
  if (currentDD > t1) { zone = '高位风险区'; zoneLevel = 'high' }
  else if (currentDD < t2) { zone = '低位机会区'; zoneLevel = 'low' }
  else { zone = '观望区'; zoneLevel = 'mid' }

  return { currentDD, histMaxDD, position, zone, zoneLevel }
}

/**
 * 综合三指标计算综合信号
 * @param {Object} tech - calcTechIndicators 返回值
 * @param {Object|null} band - calcBandSignal 返回值
 * @param {Object|null} suggest - suggestInfo（仅持仓基金有）
 * @returns {Object|null}
 */
export function calcCompositeSignal(tech, band, suggest) {
  if (!tech || !tech.signal) return null

  let techScore = 0
  if (tech.signal.level === 'buy') techScore = tech.bias20 < -3 ? 2 : 1
  else if (tech.signal.level === 'sell') techScore = tech.bias20 > 3 ? -2 : -1

  let bandScore = null
  if (band) {
    if (band.zoneLevel === 'low') bandScore = band.position < 20 ? 2 : 1
    else if (band.zoneLevel === 'high') bandScore = band.position > 80 ? -2 : -1
    else bandScore = 0
  }

  let suggestScore = null
  if (suggest) {
    if (suggest.zoneLevel === 'low') suggestScore = suggest.zoneHint && suggest.zoneHint.includes('分批') ? 2 : 1
    else if (suggest.zoneLevel === 'high') suggestScore = suggest.zoneHint && suggest.zoneHint.includes('大幅') ? -2 : -1
    else suggestScore = 0
  }

  const scores = [{ score: techScore, weight: 0.35, name: '技术参考', icon: '📊' }]
  let totalWeight = 0.35
  if (bandScore !== null) { scores.push({ score: bandScore, weight: 0.40, name: '波段信号', icon: '📈' }); totalWeight += 0.40 }
  if (suggestScore !== null) { scores.push({ score: suggestScore, weight: 0.25, name: '操作建议', icon: '💡' }); totalWeight += 0.25 }

  scores.forEach(s => s.normalizedWeight = s.weight / totalWeight)
  const composite = scores.reduce((sum, s) => sum + s.score * s.normalizedWeight, 0)

  const nonZero = scores.filter(s => s.score !== 0)
  const pos = nonZero.filter(s => s.score > 0).length
  const neg = nonZero.filter(s => s.score < 0).length
  let confidence
  if (pos > 0 && neg > 0) confidence = 'low'
  else if (nonZero.length === scores.length && nonZero.length > 1) confidence = 'high'
  else confidence = 'medium'

  let zone, zoneLevel, advice
  if (composite >= 1.0) { zone = '机会区'; zoneLevel = 'low'; advice = '多维指标共振偏多，可分批布局' }
  else if (composite >= 0.5) { zone = '偏多关注'; zoneLevel = 'low'; advice = '信号偏积极，可小仓试探' }
  else if (composite > -0.5) { zone = '观望区'; zoneLevel = 'mid'; advice = '信号不明确，建议持有观望' }
  else if (composite > -1.0) { zone = '偏空谨慎'; zoneLevel = 'high'; advice = '信号偏消极，注意控制仓位' }
  else { zone = '风险区'; zoneLevel = 'high'; advice = '多维指标共振偏空，建议减仓或止盈' }

  if (confidence === 'low') {
    advice += '（注意：各指标存在分歧，建议操作偏保守）'
  }

  return { composite: parseFloat(composite.toFixed(1)), scores, confidence, zone, zoneLevel, advice }
}
