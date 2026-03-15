/**
 * 共享的基金操作逻辑：添加监控 + 买入建议
 * 用于 热门主题展开列表、基金排行、基金净值 等页面
 */
import { ref, computed } from 'vue'
import { useFundStore } from '@/stores/fundStore'
import { useWatchStore } from '@/stores/watchStore'
import { fetchPingzhongdata } from '@/services/pingzhongdata'

export function useFundActions() {
  const fundStore = useFundStore()
  const watchStore = useWatchStore()

  /* ── 持仓/监控判断 ── */
  function isInFunds(code) {
    return fundStore.funds.some(f => f.code === code)
  }

  function isInWatch(code) {
    return watchStore.watchlist.some(w => w.code === code)
  }

  /* ── 添加监控 ── */
  function addToWatch({ code, name, nav, ret, jzrq, tags }) {
    const added = watchStore.addWatch({ code, name: name || code, tags: tags || [] })
    if (!added) return

    const navNum = parseFloat(nav)
    const retNum = parseFloat(ret)
    if (!isNaN(navNum) && navNum > 0) {
      const patch = { confirmedNav: navNum, confirmedDate: jzrq }
      if (!isNaN(retNum)) {
        patch.gszzl = retNum
        patch.prevNav = parseFloat((navNum / (1 + retNum / 100)).toFixed(4))
      }
      watchStore.updateWatch(code, patch)
      watchStore.save()
    }

    window.$toast?.(`已添加监控：${name || code}`, 'success')
    fundStore.refreshAll(watchStore)
  }

  /* ── 买入建议 Modal ── */
  const suggestModal = ref({ open: false, loading: false, data: null })

  function fmtPct(n) {
    return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
  }

  function dailyRet(arr) {
    const rets = []
    for (let i = 1; i < arr.length; i++) {
      if (arr[i - 1].y > 0) rets.push((arr[i].y - arr[i - 1].y) / arr[i - 1].y * 100)
    }
    return rets
  }

  /**
   * 打开建议弹窗
   * @param {Object} params
   * @param {string} params.code - 基金代码
   * @param {string} params.name - 基金名称
   * @param {number|string} params.nav - 当前净值
   * @param {number|string} params.ret - 今日涨跌幅
   * @param {string} [params.sector] - 板块名（可选）
   * @param {Array}  [params.sectorFunds] - 同板块基金列表（可选，用于板块对比）
   */
  async function openSuggest({ code, name, nav, ret, sector, sectorFunds }) {
    suggestModal.value = { open: true, loading: true, data: null }

    const todayRet   = (ret != null && !isNaN(Number(ret))) ? Number(ret) : 0
    const currentNav = parseFloat(nav) || 0

    // 板块分析（如果提供了板块数据）
    const hasSector     = !!sector && Array.isArray(sectorFunds) && sectorFunds.length > 0
    const sectorAvg     = hasSector
      ? sectorFunds.reduce((s, r) => s + r, 0) / sectorFunds.length
      : null
    const sectorRank    = hasSector
      ? sectorFunds.filter(r => r > todayRet).length + 1
      : null
    const relToSector   = hasSector ? todayRet - sectorAvg : null

    // 获取历史数据
    let dayAvg5 = null, dayAvg20 = null, drawdown = 0, rise5 = null, recentDays = []
    try {
      const pzd = await fetchPingzhongdata(code)
      const trend = pzd.data || pzd
      if (trend && trend.length >= 5) {
        const sorted = [...trend].sort((a, b) => a.x - b.x)
        recentDays = sorted.slice(-20)
        if (recentDays.length >= 5) {
          const last5  = recentDays.slice(-5)
          const rets5  = dailyRet(last5)
          const rets20 = dailyRet(recentDays)
          dayAvg5  = rets5.length  ? rets5.reduce((s, v) => s + v, 0) / rets5.length   : null
          dayAvg20 = rets20.length ? rets20.reduce((s, v) => s + v, 0) / rets20.length : null
          const n5Start = last5[0].y
          const n5End   = last5[last5.length - 1].y
          rise5 = n5Start > 0 ? (n5End - n5Start) / n5Start * 100 : null
          let peak = recentDays[0].y
          recentDays.forEach(d => {
            if (d.y > peak) peak = d.y
            const dd = (d.y - peak) / peak * 100
            if (dd < drawdown) drawdown = dd
          })
        }
      }
    } catch (_) {}

    // 规则标志
    const isOversold   = dayAvg5 != null && dayAvg5 < -1.5 && todayRet <= -1
    const isMomentumUp = dayAvg5 != null && dayAvg5 > 0.5 && rise5 != null && rise5 > 3
    const sectorStrong = hasSector && sectorAvg >= 2
    const sectorWeak   = hasSector && sectorAvg <= -2
    const fundLagSect  = hasSector && relToSector <= -1.5
    const bigDropToday = todayRet <= -3
    const bigRiseToday = todayRet >= 3
    const deepDrawdown = drawdown <= -8

    let badge, badgeCls, reason

    if (deepDrawdown && isOversold) {
      badge    = '🟢 建议关注买入时机'
      badgeCls = 'buy'
      reason   = `近期该基金从高点回撤约 <strong>${Math.abs(drawdown).toFixed(1)}%</strong>，近 5 日日均跌幅 <strong>${fmtPct(dayAvg5)}</strong>，今日跌 <strong>${fmtPct(todayRet)}</strong>，已进入超跌区间。`
      if (hasSector) {
        reason += `<br><br><strong>${sector}</strong> 板块今日平均 <strong>${fmtPct(sectorAvg)}</strong>，该基金在板块内排名 <strong>第 ${sectorRank} / ${sectorFunds.length}</strong>。`
      }
      reason += `<br><br>建议：在超跌位置可以考虑小额试探性买入，或者分 2～3 批在不同价位建仓，每批不超过计划买入总额的 30%。当前净值约 <strong>${currentNav.toFixed(4)}</strong>。`
    } else if (bigDropToday && (!hasSector || !sectorWeak)) {
      badge    = '🟢 今日大跌，可关注逢低买入'
      badgeCls = 'buy'
      reason   = `今日下跌 <strong>${fmtPct(todayRet)}</strong>，幅度较大。`
      if (hasSector) {
        reason += `<strong>${sector}</strong> 板块整体今日均值 <strong>${fmtPct(sectorAvg)}</strong>，板块基本面并无明显走弱。`
      }
      if (rise5 != null) {
        reason += `<br><br>近 5 日累计 <strong>${fmtPct(rise5)}</strong>，` + (rise5 > 0 ? '短期整体仍向上，今日属于正常回调。' : '近期有所调整，今日下跌是延续。')
      }
      if (hasSector) {
        reason += `<br><br>该基金在板块内今日排名 <strong>第 ${sectorRank} / ${sectorFunds.length}</strong>（相对板块 <strong>${fmtPct(relToSector)}</strong>）。`
      }
      reason += `<br><br>建议：如果看好中长期逻辑，可以考虑小额逢低买入，建议买入金额不超过计划总仓位的 20%，分批操作更稳妥。`
    } else if (isMomentumUp && (!hasSector || sectorStrong)) {
      badge    = '🟡 短期涨幅较大，谨慎追入'
      badgeCls = 'sell'
      reason   = `近 5 日日均涨幅 <strong>${fmtPct(dayAvg5)}</strong>，近 5 日累计涨幅约 <strong>${fmtPct(rise5)}</strong>，短期涨势明显。`
      if (hasSector) {
        reason += `<strong>${sector}</strong> 板块今日整体也较强，均值 <strong>${fmtPct(sectorAvg)}</strong>。`
      }
      reason += `<br><br><strong>⚠️ 追高风险提示</strong>：短期大幅上涨后往往存在回调压力。<br><br>建议：<strong>当前不建议大额追入</strong>。可以少量（不超过 5%～10% 仓位）持有观察，等回调再考虑加仓。`
    } else if (bigRiseToday && dayAvg5 != null && dayAvg5 < 0) {
      badge    = '⚪ 今日反弹，观望为主'
      badgeCls = 'hold'
      reason   = `今日上涨 <strong>${fmtPct(todayRet)}</strong>，但近 5 日日均涨幅仅 <strong>${fmtPct(dayAvg5)}</strong>，整体趋势偏弱，今日可能只是短暂反弹。`
      if (drawdown < 0) {
        reason += `<br><br>近期最大回撤约 <strong>${Math.abs(drawdown).toFixed(1)}%</strong>，` + (drawdown <= -5 ? '跌幅已不小。' : '仍在调整中。')
      }
      reason += `<br><br>建议：<strong>暂时观望</strong>，不要因为今日大涨就急于买入，等趋势稳定后再做决定。`
    } else if (hasSector && fundLagSect && !bigDropToday) {
      badge    = '🔴 板块内表现偏弱，暂不建议买入'
      badgeCls = 'sell'
      reason   = `今日该基金涨幅 <strong>${fmtPct(todayRet)}</strong>，而 <strong>${sector}</strong> 板块平均涨幅 <strong>${fmtPct(sectorAvg)}</strong>，落后板块 <strong>${Math.abs(relToSector).toFixed(2)}%</strong>，在板块内排名 <strong>第 ${sectorRank} / ${sectorFunds.length}</strong>。<br><br>建议：若想参与 <strong>${sector}</strong> 板块行情，可以优先考虑板块内涨幅靠前的基金。`
    } else {
      badge    = '⚪ 暂无明显信号，以观望为主'
      badgeCls = 'hold'
      const trendDesc = dayAvg5 != null
        ? (dayAvg5 > 0.3
            ? `近 5 日日均涨幅 <strong>${fmtPct(dayAvg5)}</strong>，短期偏多。`
            : dayAvg5 < -0.3
              ? `近 5 日日均跌幅 <strong>${fmtPct(Math.abs(dayAvg5))}</strong>，短期偏弱。`
              : `近 5 日走势较为平稳，日均 <strong>${fmtPct(dayAvg5)}</strong>。`)
        : ''
      reason = `今日涨跌 <strong>${fmtPct(todayRet)}</strong>。`
      if (hasSector) {
        reason += `<strong>${sector}</strong> 板块均值 <strong>${fmtPct(sectorAvg)}</strong>，相对板块 <strong>${fmtPct(relToSector)}</strong>。`
      }
      if (trendDesc) reason += '<br><br>' + trendDesc
      reason += '<br><br>当前没有明显的超跌买入或止盈卖出信号，属于正常震荡区间。建议观望，等待更明确的方向信号后再操作。'
    }

    // 走势摘要
    let trendSummary = false, totalRet = null, trendDays = 0
    if (recentDays.length >= 5) {
      trendSummary = true
      trendDays    = recentDays.length
      const first  = recentDays[0]
      const last_  = recentDays[recentDays.length - 1]
      totalRet     = first.y > 0 ? (last_.y - first.y) / first.y * 100 : null
    }

    // 规则匹配详情 HTML
    const rulesHtml = buildRulesHtml({
      todayRet, sectorAvg, sectorWeak, bigDropToday, bigRiseToday,
      deepDrawdown, isOversold, isMomentumUp, sectorStrong, fundLagSect,
      dayAvg5, rise5, drawdown, relToSector, hasSector,
    })

    suggestModal.value = {
      open: true,
      loading: false,
      data: {
        name: name || code,
        code,
        sector: sector || null,
        todayRet,
        currentNav,
        sectorAvg,
        sectorFunds: hasSector ? sectorFunds.length : 0,
        sectorRank,
        relToSector,
        hasSector,
        badge,
        badgeCls,
        reason,
        trendSummary,
        trendDays,
        totalRet,
        dayAvg5,
        dayAvg20,
        drawdown,
        rulesHtml,
      },
    }
  }

  /**
   * 快速标签 + 颜色
   * 返回 { cls, label }
   */
  function quickSuggest({ ret, sector, sectorFunds }) {
    const todayRet = (ret != null && !isNaN(Number(ret))) ? Number(ret) : 0
    const hasSector = !!sector && Array.isArray(sectorFunds) && sectorFunds.length > 0
    const sectorAvg = hasSector
      ? sectorFunds.reduce((s, r) => s + r, 0) / sectorFunds.length
      : 0
    const sectorWeak   = hasSector && sectorAvg <= -2
    const relToSector  = todayRet - sectorAvg
    const fundLag      = hasSector && relToSector <= -1.5

    if (todayRet <= -3 && (!hasSector || !sectorWeak))
      return { cls: 'buy',      label: '逢低关注' }
    if (todayRet <= -1.5)
      return { cls: 'buy',      label: '逢低关注' }
    if (todayRet >= 5)
      return { cls: 'sell',     label: '追高警示' }
    if (todayRet >= 3)
      return { cls: 'warn',     label: '谨慎追入' }
    if (todayRet >= 1.5)
      return { cls: 'warn-light', label: '偏多观察' }
    if (fundLag)
      return { cls: 'sell',     label: '相对偏弱' }
    if (todayRet <= -0.5)
      return { cls: 'buy-light', label: '小幅回调' }
    return { cls: 'hold', label: '观望' }
  }

  function buildRulesHtml({
    todayRet, sectorAvg, sectorWeak, bigDropToday, bigRiseToday,
    deepDrawdown, isOversold, isMomentumUp, sectorStrong, fundLagSect,
    dayAvg5, rise5, drawdown, relToSector, hasSector,
  }) {
    const tick = (ok) => ok
      ? '<span style="color:var(--profit);font-weight:700;">✅</span>'
      : '<span style="color:var(--loss);font-weight:700;">❌</span>'
    const val = (v, color) => `<strong style="color:${color}">${v}</strong>`
    const G = 'var(--profit)', R = 'var(--loss)', gray = 'var(--text-muted)'

    const rules = [
      {
        label:   '深度回调 + 连续下跌 → 超跌建仓',
        color:   G,
        checks:  [
          { name: `近期最大回撤 ≤ -8%（当前 ${val(drawdown.toFixed(1) + '%', drawdown <= -8 ? G : R)}）`, pass: deepDrawdown },
          { name: `近5日日均涨幅 < -1.5%（当前 ${val(dayAvg5 != null ? fmtPct(dayAvg5) : '--', dayAvg5 != null && dayAvg5 < -1.5 ? G : R)}）`, pass: dayAvg5 != null && dayAvg5 < -1.5 },
          { name: `今日跌幅 ≤ -1%（当前 ${val(fmtPct(todayRet), todayRet <= -1 ? G : R)}）`, pass: todayRet <= -1 },
        ],
        triggered: deepDrawdown && isOversold,
      },
      {
        label:   '今日大跌但板块不弱 → 逢低买入',
        color:   G,
        checks:  [
          { name: `今日跌幅 ≤ -3%（当前 ${val(fmtPct(todayRet), bigDropToday ? G : R)}）`, pass: bigDropToday },
          ...(hasSector ? [
            { name: `板块今日均值 > -2%（当前 ${val(fmtPct(sectorAvg), !sectorWeak ? G : R)}）`, pass: !sectorWeak },
          ] : []),
        ],
        triggered: bigDropToday && (!hasSector || !sectorWeak),
      },
      {
        label:   '近期动能强 + 短期涨幅大 → 追高警示',
        color:   '#f0a500',
        checks:  [
          { name: `近5日日均涨幅 > 0.5%（当前 ${val(dayAvg5 != null ? fmtPct(dayAvg5) : '--', dayAvg5 != null && dayAvg5 > 0.5 ? G : R)}）`, pass: dayAvg5 != null && dayAvg5 > 0.5 },
          { name: `近5日累计涨幅 > 3%（当前 ${val(rise5 != null ? fmtPct(rise5) : '--', rise5 != null && rise5 > 3 ? G : R)}）`, pass: rise5 != null && rise5 > 3 },
          ...(hasSector ? [
            { name: `板块今日均值 ≥ 2%（当前 ${val(fmtPct(sectorAvg), sectorStrong ? G : R)}）`, pass: sectorStrong },
          ] : []),
        ],
        triggered: isMomentumUp && (!hasSector || sectorStrong),
      },
      {
        label:   '今日大涨但近期趋势向下 → 疑似反弹',
        color:   gray,
        checks:  [
          { name: `今日涨幅 ≥ 3%（当前 ${val(fmtPct(todayRet), bigRiseToday ? G : R)}）`, pass: bigRiseToday },
          { name: `近5日日均涨幅 < 0%（当前 ${val(dayAvg5 != null ? fmtPct(dayAvg5) : '--', dayAvg5 != null && dayAvg5 < 0 ? G : R)}）`, pass: dayAvg5 != null && dayAvg5 < 0 },
        ],
        triggered: bigRiseToday && dayAvg5 != null && dayAvg5 < 0,
      },
      ...(hasSector ? [{
        label:   '相对板块明显落后 → 弱势基金',
        color:   R,
        checks:  [
          { name: `相对板块落后 ≥ 1.5%（当前 ${val(fmtPct(relToSector), relToSector <= -1.5 ? G : R)}）`, pass: relToSector <= -1.5 },
          { name: `今日跌幅 > -3%（非大跌）（当前 ${val(fmtPct(todayRet), !bigDropToday ? G : R)}）`, pass: !bigDropToday },
        ],
        triggered: fundLagSect && !bigDropToday,
      }] : []),
    ]

    let html = '<div style="margin-top:16px;">'
    html += '<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;letter-spacing:0.5px;">📋 分析过程 — 规则匹配详情</div>'

    rules.forEach(rule => {
      const borderColor = rule.triggered ? rule.color : 'var(--border)'
      html += `<div style="border:1px solid ${borderColor};border-radius:8px;padding:10px 12px;margin-bottom:8px;background:${rule.triggered ? 'rgba(255,255,255,0.03)' : 'transparent'}">`
      html += `<div style="font-size:12px;font-weight:600;margin-bottom:6px;color:${rule.triggered ? rule.color : 'var(--text-muted)'}">`
      html += rule.triggered ? '▶ ' : '▷ '
      html += rule.label
      if (rule.triggered) {
        html += ` <span style="font-size:10px;background:${rule.color};color:#000;border-radius:4px;padding:1px 6px;margin-left:4px;">命中</span>`
      }
      html += '</div>'
      rule.checks.forEach(c => {
        html += `<div style="font-size:11px;padding:2px 0;display:flex;gap:6px;align-items:flex-start;">${tick(c.pass)}<span style="color:var(--text-secondary)">${c.name}</span></div>`
      })
      html += '</div>'
    })

    const anyTriggered = rules.some(r => r.triggered)
    if (!anyTriggered) {
      html += '<div style="font-size:11px;color:var(--text-muted);padding:8px 0;">以上所有规则均未命中 → 默认建议：观望</div>'
    }
    html += '</div>'
    return html
  }

  return {
    isInFunds,
    isInWatch,
    addToWatch,
    suggestModal,
    openSuggest,
    quickSuggest,
    fmtPct,
  }
}
