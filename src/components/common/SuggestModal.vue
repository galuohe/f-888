<template>
  <teleport to="body">
    <div
      v-if="modal.open"
      style="display:flex;position:fixed;inset:0;z-index:2000;align-items:center;justify-content:center;"
    >
      <div class="modal-overlay" @click="modal.open = false"></div>
      <div class="modal-box suggest-modal-box">
        <div class="modal-header">
          <span class="modal-title">💡 买入建议</span>
          <button class="modal-close" @click="modal.open = false">✕</button>
        </div>
        <div class="modal-body">
          <!-- Loading -->
          <div
            v-if="modal.loading"
            style="text-align:center;padding:28px 0;color:var(--text-muted);"
          >
            <span class="spinner"></span>&nbsp;分析中，正在获取历史走势…
          </div>

          <!-- Content -->
          <template v-else-if="modal.data">
            <!-- Fund meta -->
            <div style="color:var(--text-muted);font-size:12px;margin-bottom:12px;">
              {{ modal.data.name }}&nbsp;&nbsp;
              <span style="font-size:11px;">{{ modal.data.code }}</span>&nbsp;&nbsp;
              <span v-if="modal.data.sector" class="mr-sector">{{ modal.data.sector }}</span>
            </div>

            <!-- Summary stats -->
            <div class="sg-info">
              <div class="sg-info-row">
                <span>今日涨跌幅</span>
                <span :style="{ color: modal.data.todayRet >= 0 ? 'var(--profit)' : 'var(--loss)' }">
                  {{ fmtPct(modal.data.todayRet) }}
                </span>
              </div>
              <div class="sg-info-row">
                <span>当前净值</span>
                <span>{{ modal.data.currentNav > 0 ? modal.data.currentNav.toFixed(4) : '--' }}</span>
              </div>
              <template v-if="modal.data.hasSector">
                <div class="sg-info-row">
                  <span>{{ modal.data.sector }} 板块今日均值</span>
                  <span :style="{ color: modal.data.sectorAvg >= 0 ? 'var(--profit)' : 'var(--loss)' }">
                    {{ fmtPct(modal.data.sectorAvg) }}（共 {{ modal.data.sectorFunds }} 只）
                  </span>
                </div>
                <div class="sg-info-row">
                  <span>本基金板块内排名</span>
                  <span>第 {{ modal.data.sectorRank }} / {{ modal.data.sectorFunds }}</span>
                </div>
                <div class="sg-info-row">
                  <span>相对板块超额收益</span>
                  <span :style="{ color: modal.data.relToSector >= 0 ? 'var(--profit)' : 'var(--loss)' }">
                    {{ fmtPct(modal.data.relToSector) }}
                  </span>
                </div>
              </template>
            </div>

            <!-- Badge -->
            <div class="sg-badge" :class="modal.data.badgeCls" v-html="modal.data.badge"></div>

            <!-- Reason -->
            <div class="sg-reason" v-html="modal.data.reason"></div>

            <!-- Trend summary -->
            <div v-if="modal.data.trendSummary" class="sg-info" style="margin-top:14px;">
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">
                近期走势摘要（最近 {{ modal.data.trendDays }} 个交易日）
              </div>
              <div v-if="modal.data.totalRet != null" class="sg-info-row">
                <span>期间累计涨幅</span>
                <span :style="{ color: modal.data.totalRet >= 0 ? 'var(--profit)' : 'var(--loss)' }">
                  {{ fmtPct(modal.data.totalRet) }}
                </span>
              </div>
              <div v-if="modal.data.dayAvg5 != null" class="sg-info-row">
                <span>近 5 日日均涨幅</span>
                <span :style="{ color: modal.data.dayAvg5 >= 0 ? 'var(--profit)' : 'var(--loss)' }">
                  {{ fmtPct(modal.data.dayAvg5) }}
                </span>
              </div>
              <div v-if="modal.data.dayAvg20 != null" class="sg-info-row">
                <span>近 20 日日均涨幅</span>
                <span :style="{ color: modal.data.dayAvg20 >= 0 ? 'var(--profit)' : 'var(--loss)' }">
                  {{ fmtPct(modal.data.dayAvg20) }}
                </span>
              </div>
              <div v-if="modal.data.drawdown < 0" class="sg-info-row">
                <span>近期最大回撤</span>
                <span style="color:var(--loss)">{{ modal.data.drawdown.toFixed(1) }}%</span>
              </div>
            </div>

            <!-- Rule detail -->
            <div v-html="modal.data.rulesHtml" style="margin-top:16px;"></div>

            <!-- Disclaimer -->
            <div class="sg-hint">
              ⚠️ 建议基于历史净值走势与板块数据通过简单规则生成，<strong>不构成投资建议</strong>。
              基金有风险，投资需谨慎，建议结合当日财经新闻、宏观环境及个人风险承受能力综合判断。
            </div>
          </template>

          <!-- Error -->
          <p
            v-else
            style="color:var(--text-muted);text-align:center;padding:20px 0;"
          >暂无数据</p>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
defineProps({
  modal: { type: Object, required: true },
})

function fmtPct(n) {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}
</script>
