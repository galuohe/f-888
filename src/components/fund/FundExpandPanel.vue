<template>
  <div class="fd-panel">
    <div class="fd-main">
      <!-- ═══ 左侧：统计 + 图表 ═══ -->
      <div class="fd-left">
        <!-- Tab 栏 + 区间开关 -->
        <div class="fd-tab-bar">
          <button class="fd-tab" :class="{ active: activeTab === 'trend' }" @click="switchTab('trend')">净值走势</button>
          <button class="fd-tab" :class="{ active: activeTab === 'intraday' }" @click="switchTab('intraday')">分时估值</button>
          <div v-if="activeTab === 'trend'" class="fd-range-toggle" @click="toggleRangeMode">
            <span class="fd-range-toggle-label">区间</span>
            <div class="fd-toggle-switch" :class="{ on: rangeEnabled }">
              <div class="fd-toggle-knob"></div>
            </div>
          </div>
        </div>

        <!-- 数据类型切换 -->
        <div v-if="activeTab === 'trend'" class="fd-dtype-tabs">
          <button class="fd-dtype-btn" :class="{ active: trendDataType === 'netWorth' }" @click="switchDataType('netWorth')">单位净值</button>
          <button class="fd-dtype-btn" :class="{ active: trendDataType === 'acWorth' }" @click="switchDataType('acWorth')">累计净值</button>
          <button class="fd-dtype-btn" :class="{ active: trendDataType === 'grandTotal' }" @click="switchDataType('grandTotal')">累计收益率</button>
        </div>

        <!-- 回撤修复天数 -->
        <div v-if="activeTab === 'trend' && trendStats && (trendStats.histRecoveryDays != null || trendStats.intervalRecoveryDays != null)" class="fd-recovery-row">
          <div v-if="trendStats.histRecoveryDays != null" class="fd-recovery-cell">
            <span class="fd-recovery-label">历史最大回撤修复天数</span>
            <span class="fd-recovery-val" :class="trendStats.histRecoveryDays > 0 ? 'profit' : 'loss'">
              {{ trendStats.histRecoveryDays > 0 ? trendStats.histRecoveryDays + ' 天' : '修复中' }}
            </span>
          </div>
          <div v-if="trendStats.intervalRecoveryDays != null" class="fd-recovery-cell">
            <span class="fd-recovery-label">区间最大回撤修复天数</span>
            <span class="fd-recovery-val" :class="trendStats.intervalRecoveryDays > 0 ? 'profit' : 'loss'">
              {{ trendStats.intervalRecoveryDays > 0 ? trendStats.intervalRecoveryDays + ' 天' : '修复中' }}
            </span>
          </div>
        </div>

        <!-- 趋势图：统计行 -->
        <div v-if="activeTab === 'trend'" class="fd-stats-row">
          <template v-if="trendStats && trendStats.isGrandTotal">
            <!-- 累计收益率统计 -->
            <div class="fd-stat">
              <span class="fd-stat-label">{{ periodOptions.find(p => p.value === trendPeriod)?.label || '成立来' }}</span>
              <span class="fd-stat-val" :class="trendStats.returnRate?.startsWith('+') ? 'profit' : 'loss'">{{ trendStats.returnRate }}</span>
            </div>
            <div class="fd-stat">
              <span class="fd-stat-label">最高</span>
              <span class="fd-stat-val profit">{{ trendStats.max }}</span>
            </div>
            <div class="fd-stat">
              <span class="fd-stat-label">最低</span>
              <span class="fd-stat-val loss">{{ trendStats.min }}</span>
            </div>
            <div class="fd-stat">
              <span class="fd-stat-label">最大回撤</span>
              <span class="fd-stat-val loss">{{ trendStats.dd }}</span>
            </div>
          </template>
          <template v-else>
            <!-- 单位净值 / 累计净值统计 -->
            <div class="fd-stat">
              <span class="fd-stat-label">{{ isRangeMode ? '区间收益' : periodOptions.find(p => p.value === trendPeriod)?.label || '收益' }}</span>
              <span class="fd-stat-val" :class="currentProfitRate != null ? (currentProfitRate >= 0 ? 'profit' : 'loss') : ''">
                {{ currentProfitRate != null ? (currentProfitRate >= 0 ? '+' : '') + fmt(currentProfitRate, 2) + '%' : '--' }}
              </span>
            </div>
            <div v-if="trendStats" class="fd-stat">
              <span class="fd-stat-label">最高</span>
              <span class="fd-stat-val">{{ trendStats.max }}</span>
            </div>
            <div v-if="trendStats" class="fd-stat">
              <span class="fd-stat-label">最低</span>
              <span class="fd-stat-val">{{ trendStats.min }}</span>
            </div>
            <div v-if="trendStats" class="fd-stat">
              <span class="fd-stat-label">最大回撤</span>
              <span class="fd-stat-val loss">{{ trendStats.dd }}</span>
            </div>
          </template>
        </div>

        <!-- 分时图统计行 -->
        <div v-if="activeTab === 'intraday' && intradayStats" class="fd-stats-row">
          <div class="fd-stat"><span class="fd-stat-label">最高</span><span class="fd-stat-val">{{ intradayStats?.max }}</span></div>
          <div class="fd-stat"><span class="fd-stat-label">最低</span><span class="fd-stat-val">{{ intradayStats?.min }}</span></div>
          <div class="fd-stat"><span class="fd-stat-label">振幅</span><span class="fd-stat-val">{{ intradayStats?.amp }}</span></div>
        </div>

        <!-- 图表 -->
        <div class="fd-chart-wrap" ref="chartWrapEl">
          <div ref="trendEl" class="fd-chart" :style="{ display: activeTab === 'trend' ? '' : 'none' }"></div>
          <div ref="intradayEl" class="fd-chart" :style="{ display: activeTab === 'intraday' ? '' : 'none' }"></div>
          <!-- 手柄叠加在图表虚线上（区间模式才显示） -->
          <template v-if="activeTab === 'trend' && _trendCache && rangeEnabled">
            <div class="fd-handle-on-chart"
              :style="{ left: handlePixelLeft + 'px', top: chartGridPadding.top + 'px', height: chartGridPadding.plotH + 'px' }"
              @mousedown.prevent="startDrag($event, 'left')" @touchstart.prevent="startDragMobile($event, 'left')">
              <div class="fd-handle-date">{{ handleLeftDate }}</div>
              <div class="fd-handle-pill">◆</div>
            </div>
            <div class="fd-handle-on-chart"
              :style="{ left: handlePixelRight + 'px', top: chartGridPadding.top + 'px', height: chartGridPadding.plotH + 'px' }"
              @mousedown.prevent="startDrag($event, 'right')" @touchstart.prevent="startDragMobile($event, 'right')">
              <div class="fd-handle-date">{{ handleRightDate }}</div>
              <div class="fd-handle-pill">◆</div>
            </div>
          </template>
        </div>

        <!-- 区间 Tab 放在底部 -->
        <div v-if="activeTab === 'trend'" class="fd-period-tabs">
          <button v-for="p in periodOptions" :key="p.value"
            class="fd-period-btn" :class="{ active: trendPeriod === p.value }"
            @click="trendPeriod = p.value; loadTrend()">{{ p.label }}</button>
        </div>
      </div>

      <!-- 右侧 -->
      <div class="fd-right">
        <div class="fd-h-header">
          <span class="fd-h-col-name">重仓股</span>
          <span class="fd-h-col-bar">持仓占比</span>
          <span class="fd-h-col-chg">今日涨跌</span>
        </div>
        <div v-if="holdingsLoading" class="fd-loading"><span class="spinner"></span>加载中…</div>
        <div v-else-if="holdingsError" class="fd-empty">{{ holdingsError }}</div>
        <div v-else-if="holdings.length === 0" class="fd-empty">暂无重仓数据</div>
        <div v-else class="fd-hi-list">
          <div v-for="(h, idx) in holdings.slice(0, 10)" :key="h.code || idx" class="fd-hi">
            <div class="fd-hi-name">
              <span class="fd-hi-n">{{ h.name || h.code }}</span>
              <span class="fd-hi-c">{{ h.code || '' }}</span>
            </div>
            <div class="fd-hi-bar-wrap">
              <div class="fd-hi-bar-track">
                <div class="fd-hi-bar-fill" :style="{ width: barWidth(h.ratio) + '%' }"></div>
              </div>
              <span class="fd-hi-pct">{{ h.ratio != null ? h.ratio.toFixed(1) + '%' : '--' }}</span>
            </div>
            <span class="fd-hi-chg" :class="chgClass(h.change)">
              {{ h.change != null ? (h.change > 0 ? '+' : '') + h.change.toFixed(2) + '%' : '--' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ 技术参考 ═══ -->
    <div v-if="techIndicators" class="fd-tech">
      <div class="fd-tech-header">
        <span class="fd-tech-icon">📊</span>
        <span class="fd-tech-title">技术参考</span>
        <span class="fd-tech-help" @click.stop="showTechHelp = true" title="指标说明">&#9432;</span>
        <span class="fd-tech-days">近{{ techIndicators.tradingDays }}个交易日</span>
      </div>

      <!-- 指标格（复用波段信号格式） -->
      <div class="fd-band-grid">
        <div class="fd-band-cell">
          <span class="fd-band-label">MA20（20日均线）</span>
          <span class="fd-band-val">{{ techIndicators.ma20 != null ? techIndicators.ma20.toFixed(4) : '--' }}</span>
        </div>
        <div class="fd-band-cell">
          <span class="fd-band-label">MA60（60日均线）</span>
          <span class="fd-band-val">{{ techIndicators.ma60 != null ? techIndicators.ma60.toFixed(4) : '--' }}</span>
        </div>
        <div class="fd-band-cell">
          <span class="fd-band-label">乖离率 Bias20</span>
          <span class="fd-band-val" :class="techIndicators.bias20 != null ? (techIndicators.bias20 >= 0 ? 'profit' : 'loss') : ''">
            {{ techIndicators.bias20 != null ? (techIndicators.bias20 >= 0 ? '+' : '') + techIndicators.bias20.toFixed(1) + '%' : '--' }}
          </span>
        </div>
        <div class="fd-band-cell">
          <span class="fd-band-label">MA60 走向</span>
          <span class="fd-band-val" :class="techIndicators.ma60Trend === 'up' ? 'profit' : techIndicators.ma60Trend === 'down' ? 'loss' : ''">
            <template v-if="techIndicators.ma60Trend === 'up'">↑ 均线上行</template>
            <template v-else-if="techIndicators.ma60Trend === 'down'">↓ 均线下行</template>
            <template v-else-if="techIndicators.ma60Trend === 'flat'">→ 横盘整理</template>
            <template v-else>--</template>
          </span>
        </div>
      </div>

      <!-- 胜率进度条（独立展示，同原始样式） -->
      <div v-if="techIndicators.winRate != null" class="fd-tech-winrate">
        <div class="fd-tech-winrate-header">
          <span class="fd-tech-label">历史同位 T+20 胜率</span>
          <span class="fd-tech-days">样本 {{ techIndicators.sampleCount }} 天（±{{ (techIndicators.usedTolerance * 100).toFixed(0) }}%）</span>
        </div>
        <div class="fd-tech-bar-track">
          <div class="fd-tech-bar-fill"
            :style="{ width: techIndicators.winRate + '%', background: techIndicators.winRate >= 50 ? 'var(--profit)' : 'var(--loss)' }">
          </div>
        </div>
        <div class="fd-tech-winrate-val" :class="techIndicators.winRate >= 50 ? 'profit' : 'loss'">
          {{ techIndicators.winRate.toFixed(1) }}%
        </div>
      </div>

      <!-- 综合信号（复用波段信号结论格式） -->
      <div v-if="techIndicators.signal" class="fd-band-signal"
        :class="techIndicators.signal.level === 'buy' ? 'zone-low' : techIndicators.signal.level === 'sell' ? 'zone-high' : 'zone-mid'">
        <div class="fd-band-signal-header">
          <span class="fd-band-zone-tag">
            {{ techIndicators.signal.level === 'buy' ? '关注布局' : techIndicators.signal.level === 'sell' ? '注意风险' : '持有观望' }}
          </span>
          <span class="fd-band-zone-hint">{{ techIndicators.signal.text }}</span>
        </div>
      </div>
    </div>

    <!-- ═══ 波段信号 ═══ -->
    <div v-if="bandSignal" class="fd-band">
      <div class="fd-tech-header">
        <span class="fd-tech-icon">📈</span>
        <span class="fd-tech-title">波段信号</span>
        <span class="fd-tech-help" @click.stop="showBandHelp = true" title="波段信号说明">&#9432;</span>
      </div>

      <!-- 8 格指标 -->
      <div class="fd-band-grid">
        <div class="fd-band-cell">
          <span class="fd-band-label">当前回撤</span>
          <span class="fd-band-val loss">{{ bandSignal.currentDD.toFixed(2) }}%</span>
        </div>
        <div class="fd-band-cell">
          <span class="fd-band-label">历史最大回撤</span>
          <span class="fd-band-val loss">{{ bandSignal.histMaxDD.toFixed(2) }}%</span>
        </div>
        <div class="fd-band-cell">
          <span class="fd-band-label">区间最大回撤</span>
          <span class="fd-band-val loss">{{ bandSignal.intervalMaxDD.toFixed(2) }}%</span>
        </div>
        <div class="fd-band-cell">
          <span class="fd-band-label">平均回撤</span>
          <span class="fd-band-val loss">{{ bandSignal.avgDD.toFixed(2) }}%</span>
        </div>
        <div class="fd-band-cell">
          <span class="fd-band-label">距历史最低差值</span>
          <span class="fd-band-val profit">+{{ bandSignal.distFromHistLow.toFixed(2) }}%</span>
          <span class="fd-band-sub">当前位置: {{ bandSignal.position.toFixed(1) }}%</span>
        </div>
        <div class="fd-band-cell">
          <span class="fd-band-label">距区间最低差值</span>
          <span class="fd-band-val profit">+{{ bandSignal.intervalDistMin.toFixed(2) }}%</span>
        </div>
        <div class="fd-band-cell">
          <span class="fd-band-label">H 高位阈值</span>
          <span class="fd-band-val">{{ bandSignal.highThreshold.toFixed(2) }}%</span>
        </div>
        <div class="fd-band-cell">
          <span class="fd-band-label">L 低位阈值</span>
          <span class="fd-band-val loss">{{ bandSignal.lowThreshold.toFixed(2) }}%</span>
        </div>
      </div>

      <!-- 多时间段回撤对比表 -->
      <div v-if="bandSignal.periodStats.length > 0" class="fd-band-table-wrap">
        <div class="fd-band-table-title">多时间段回撤对比</div>
        <table class="fd-band-table">
          <thead>
            <tr>
              <th>时间段</th>
              <th>最大回撤</th>
              <th>当前回撤</th>
              <th>平均回撤</th>
              <th>差值</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in bandSignal.periodStats" :key="p.label">
              <td>{{ p.label }}</td>
              <td class="loss">{{ p.maxDD.toFixed(2) }}%</td>
              <td class="loss">{{ p.currentDD.toFixed(2) }}%</td>
              <td>{{ p.avgDD.toFixed(2) }}%</td>
              <td :class="p.diff >= 0 ? 'profit' : 'loss'">{{ p.diff >= 0 ? '+' : '' }}{{ p.diff.toFixed(2) }}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 波段信号结论 -->
      <div class="fd-band-signal" :class="'zone-' + bandSignal.zoneLevel">
        <div class="fd-band-signal-header">
          <span class="fd-band-zone-tag">{{ bandSignal.zone }}</span>
          <span class="fd-band-zone-hint" v-if="bandSignal.zoneLevel === 'high'">建议分批止盈</span>
          <span class="fd-band-zone-hint" v-else-if="bandSignal.zoneLevel === 'low'">建议分批布局</span>
          <span class="fd-band-zone-hint" v-else>持有观望</span>
        </div>
        <div class="fd-band-advice">{{ bandSignal.advice }}</div>
      </div>
    </div>

    <!-- 波段信号说明弹窗 -->
    <BaseModal v-model="showBandHelp" title="波段信号使用说明">
      <div class="fd-tech-help-content">
        <div class="fd-help-item">
          <div class="fd-help-name">指标含义说明</div>
          <div class="fd-help-desc">
            <b>当前回撤：</b>当前净值相对于历史最高点的下跌幅度。<br/>
            <b>历史最大回撤：</b>历史上出现过的最大下跌幅度（最坏情况）。<br/>
            <b>区间最大回撤：</b>选定时间范围内的最大下跌幅度。<br/>
            <b>平均回撤：</b>历史上所有回撤幅度的平均水平。<br/>
            <b>高位/低位阈值：</b>根据历史最大回撤计算出的风险分界线（0.33/0.66分位）。
          </div>
        </div>
        <div class="fd-help-item">
          <div class="fd-help-name">波段信号原理</div>
          <div class="fd-help-desc">
            基于每只基金的历史最大回撤动态计算。将历史最大波动空间等分为三份（三分法），科学识别风险等级：<br/><br/>
            <b>t1 (0.33)：</b>回撤处于历史浅位，风险溢价低 → 高位区<br/>
            <b>t2 (0.66)：</b>回撤接近历史极值，安全边际高 → 低位区
          </div>
        </div>
        <div class="fd-help-item">
          <div class="fd-help-name" style="color: var(--loss);">高位区（回撤浅于 t1）</div>
          <div class="fd-help-desc">跌幅较浅，风险高 → 适合<b>止盈</b>。先卖出1份持仓，若继续上涨3%再卖出1份，若遇下跌则立即清仓止盈。</div>
        </div>
        <div class="fd-help-item">
          <div class="fd-help-name" style="color: var(--profit);">低位区（回撤深于 t2）</div>
          <div class="fd-help-desc">跌幅较深，风险低 → 适合<b>抄底</b>。把资金分成3-5份，进入低位区后先买入1份，每下跌2%左右再买入1份，遇到上涨则停止买入。</div>
        </div>
        <div class="fd-help-item">
          <div class="fd-help-name">观望区（中间区域）</div>
          <div class="fd-help-desc">中等跌幅 → 建议观望，等待更明确的信号。</div>
        </div>
      </div>
    </BaseModal>

    <!-- 技术指标说明弹窗 -->
    <BaseModal v-model="showTechHelp" title="技术指标说明">
      <div class="fd-tech-help-content">
        <div class="fd-help-item">
          <div class="fd-help-name">MA20 / MA60（均线）</div>
          <div class="fd-help-desc">最近 20/60 个交易日的净值算术平均值。当前净值在均线上方说明短期走势较强，反之则偏弱。</div>
        </div>
        <div class="fd-help-item">
          <div class="fd-help-name">乖离率 Bias20</div>
          <div class="fd-help-desc">当前净值偏离 MA20 的百分比，公式：(当前净值 - MA20) / MA20 × 100%。正值表示高于均线，负值表示低于均线。偏离过大时往往有回归均线的趋势。</div>
        </div>
        <div class="fd-help-item">
          <div class="fd-help-name">MA60 走向</div>
          <div class="fd-help-desc">比较当前 MA60 与 5 个交易日前的 MA60，判断中期均线趋势。上行说明中期趋势向好，下行说明中期趋势走弱。</div>
        </div>
        <div class="fd-help-item">
          <div class="fd-help-name">历史同位 T+20 胜率</div>
          <div class="fd-help-desc">在历史数据中找出与当前净值相近（±2%）的所有交易日，统计其中 20 个交易日后净值上涨的比例。胜率越高说明当前位置历史上后续上涨概率越大。样本数越多结果越有参考价值。</div>
        </div>
        <div class="fd-help-item">
          <div class="fd-help-name">综合信号</div>
          <div class="fd-help-desc">结合乖离率与历史胜率给出的参考建议。仅供参考，不构成投资建议。</div>
        </div>
      </div>
    </BaseModal>

    <!-- ═══ 操作建议 ═══ -->
    <div v-if="suggestInfo" class="fd-suggest">
      <div class="fd-tech-header">
        <span class="fd-tech-icon">💡</span>
        <span class="fd-tech-title">操作建议</span>
      </div>

      <!-- 持仓概况（4格，同波段信号指标格式） -->
      <div class="fd-band-grid">
        <div class="fd-band-cell">
          <span class="fd-band-label">累计盈亏</span>
          <span class="fd-band-val" :class="suggestInfo.profitTotal >= 0 ? 'profit' : 'loss'">{{ suggestInfo.profitTotalStr }}</span>
        </div>
        <div class="fd-band-cell">
          <span class="fd-band-label">今日涨跌</span>
          <span class="fd-band-val" :class="suggestInfo.rToday >= 0 ? 'profit' : 'loss'">{{ suggestInfo.rTodayStr }}</span>
        </div>
        <div class="fd-band-cell">
          <span class="fd-band-label">{{ suggestInfo.navLabel }}</span>
          <span class="fd-band-val">{{ suggestInfo.currentNav }}</span>
        </div>
        <div class="fd-band-cell">
          <span class="fd-band-label">持仓成本净值</span>
          <span class="fd-band-val">{{ suggestInfo.costBasisNav }}</span>
        </div>
      </div>

      <!-- 建议结论（同波段信号 zone 格式） -->
      <div class="fd-band-signal" :class="'zone-' + suggestInfo.zoneLevel">
        <div class="fd-band-signal-header">
          <span class="fd-band-zone-tag">{{ suggestInfo.zoneLabel }}</span>
          <span class="fd-band-zone-hint">{{ suggestInfo.zoneHint }}</span>
        </div>
        <div class="fd-band-advice" v-html="suggestInfo.reasonHtml"></div>
      </div>

      <!-- 规则匹配详情 -->
      <div v-html="suggestInfo.logicHtml"></div>

      <div class="fd-suggest-disclaimer">
        ⚠️ 建议基于持仓数据通过简单规则生成，不构成投资建议。基金有风险，投资需谨慎。
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'
import { fetchPingzhongdata } from '@/services/pingzhongdata'
import { fetchIntraday, fetchHoldings, fetchStockChanges } from '@/services/fundApi'
import { fmt, fmtMD, getTodayStr } from '@/utils/format'
import BaseModal from '@/components/common/BaseModal.vue'

const props = defineProps({
  code: { type: String, required: true },
  item: { type: Object, required: true }
})

const activeTab = ref('trend')
const trendEl = ref(null)
const intradayEl = ref(null)
const _charts = {}
let _dragTarget = null  // 'left' | 'right' | null
const _trendCache = ref(null)
let _intradayCache = null
const _fullTrendData = ref(null) // 完整历史净值（不受区间过滤）
const trendStats = ref(null)
const intradayStats = ref(null)
const holdings = ref([])
const showTechHelp = ref(false)
const showBandHelp = ref(false)
const holdingsLoading = ref(false)
const holdingsError = ref(null)
const trendPeriod = ref('3m')  // 默认三月
const trendDataType = ref('netWorth')  // 数据类型：netWorth / acWorth / grandTotal

// 走势原始数据（全量，由 fetchPingzhongdata 返回）
const _rawNetWorth = ref(null)   // [{x, y}]
const _rawAcWorth = ref(null)    // [[ts, nav]]

const periodOptions = [
  { value: '1m', label: '近1月' },
  { value: '3m', label: '近3月' },
  { value: '6m', label: '近6月' },
  { value: '1y', label: '近1年' },
  { value: '2y', label: '近2年' },
  { value: '3y', label: '近3年' },
  { value: '5y', label: '近5年' },
  { value: 'ytd', label: '今年来' },
  { value: 'all', label: '成立来' },
]
const rangeLeftPct = ref(0)   // 左边界百分比
const rangeRightPct = ref(100) // 右边界百分比
const isRangeMode = ref(false) // 是否处于区间选择模式（实际拖动过）
const rangeEnabled = ref(false) // 区间开关
const chartWrapEl = ref(null)
const chartGridPadding = ref({ left: 0, right: 0, top: 0, plotH: 0, plotW: 0 }) // 图表绘图区信息

// 手柄的像素 x 坐标（相对于 chart-wrap）
const handlePixelLeft = computed(() => {
  const { left, plotW } = chartGridPadding.value
  return left + rangeLeftPct.value / 100 * plotW
})
const handlePixelRight = computed(() => {
  const { left, plotW } = chartGridPadding.value
  return left + rangeRightPct.value / 100 * plotW
})

// 区间开关
function toggleRangeMode() {
  rangeEnabled.value = !rangeEnabled.value
  if (rangeEnabled.value) {
    isRangeMode.value = true
  } else {
    resetRange()
  }
}

// 手柄上方的日期标签
const handleLeftDate = computed(() => {
  if (!_trendCache.value?.data?.length) return ''
  const cData = _trendCache.value.data
  const idx = Math.max(0, Math.floor(rangeLeftPct.value / 100 * (cData.length - 1)))
  return _formatDateFull(cData[idx]?.[0])
})
const handleRightDate = computed(() => {
  if (!_trendCache.value?.data?.length) return ''
  const cData = _trendCache.value.data
  const idx = Math.min(cData.length - 1, Math.ceil(rangeRightPct.value / 100 * (cData.length - 1)))
  return _formatDateFull(cData[idx]?.[0])
})

function _formatDateFull(ts) {
  if (ts == null) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── 与 FundTable 保持一致的涨跌幅·净值计算 ──
function isLiveEstimate(f) {
  return !!(f.gztime && f.gztime.slice(0, 10) === getTodayStr())
}
function isConfirmedToday(f) {
  return !!(f.navConfirmed && f.confirmedDate === getTodayStr())
}
const displayChangeRate = computed(() => {
  const f = props.item
  // 今日已确认
  if (isConfirmedToday(f) && f.confirmedNav && f.prevNav)
    return parseFloat(((f.confirmedNav - f.prevNav) / f.prevNav * 100).toFixed(4))
  // 今日估值
  if (isLiveEstimate(f)) {
    if (f.gszzl != null && !isNaN(f.gszzl)) return f.gszzl
    if (f.gsz != null && f.prevNav) return parseFloat(((f.gsz - f.prevNav) / f.prevNav * 100).toFixed(4))
  }
  // 历史最后两个确认净值
  if (f.confirmedNav && f.prevNav && f.prevNav > 0)
    return parseFloat(((f.confirmedNav - f.prevNav) / f.prevNav * 100).toFixed(4))
  return null
})
const displayNav = computed(() => {
  const f = props.item
  if (isConfirmedToday(f)) return f.confirmedNav
  if (isLiveEstimate(f)) return f.gsz
  return f.confirmedNav ?? f.prevNav ?? null
})
const displayNavLabel = computed(() => {
  const f = props.item
  if (isConfirmedToday(f)) return '确认净值'
  if (isLiveEstimate(f)) return '估算净值'
  const d = f.confirmedDate || f.jzrq
  return d ? '净值 ' + fmtMD(d) : '净值'
})
const changeRateClass = computed(() => {
  const v = displayChangeRate.value
  if (v == null) return 'neutral'
  return v > 0 ? 'profit' : v < 0 ? 'loss' : 'neutral'
})

// ── 区间拖动控制 ──
let _rafId = null

// 将鼠标 clientX 转换为 0~100 百分比（基于图表绘图区）
function _clientXToPct(clientX) {
  const wrapEl = chartWrapEl.value
  if (!wrapEl) return 0
  const wrapRect = wrapEl.getBoundingClientRect()
  const { left, plotW } = chartGridPadding.value
  const relX = clientX - wrapRect.left - left
  return Math.max(0, Math.min(100, relX / plotW * 100))
}

function _applyDragPct(pct) {
  const minGap = 3
  if (_dragTarget === 'left') {
    rangeLeftPct.value = Math.max(0, Math.min(rangeRightPct.value - minGap, pct))
  } else {
    rangeRightPct.value = Math.min(100, Math.max(rangeLeftPct.value + minGap, pct))
  }
  if (!_rafId) {
    _rafId = requestAnimationFrame(() => { _rafId = null; updateRangeMarkers() })
  }
}

function startDrag(e, target) {
  _dragTarget = target
  isRangeMode.value = true
  function onMove(ev) { if (_dragTarget) _applyDragPct(_clientXToPct(ev.clientX)) }
  function onUp() {
    _dragTarget = null
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null }
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    updateRangeMarkers()
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function startDragMobile(e, target) {
  _dragTarget = target
  isRangeMode.value = true
  function onMove(ev) { ev.preventDefault(); if (_dragTarget) _applyDragPct(_clientXToPct(ev.touches[0].clientX)) }
  function onEnd() {
    _dragTarget = null
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null }
    document.removeEventListener('touchmove', onMove)
    document.removeEventListener('touchend', onEnd)
    updateRangeMarkers()
  }
  document.addEventListener('touchmove', onMove, { passive: false })
  document.addEventListener('touchend', onEnd)
}

function onTrendWheel(e) {
  if (!_trendCache.value || !_trendCache.value.data?.length) return
  e.preventDefault()
  const delta = e.deltaY > 0 ? 2 : -2
  const step = 0.5
  // 缩放区间（同时向内或向外移动）
  const range = rangeRightPct.value - rangeLeftPct.value
  let newRange = Math.max(5, Math.min(100, range - delta * step))
  const center = (rangeLeftPct.value + rangeRightPct.value) / 2
  rangeLeftPct.value = Math.max(0, center - newRange / 2)
  rangeRightPct.value = Math.min(100, center + newRange / 2)

  // 只有区间开关打开时才激活区间收益计算
  if (rangeEnabled.value) isRangeMode.value = true
  updateRangeMarkers()
}

function resetRange() {
  isRangeMode.value = false
  rangeLeftPct.value = 0
  rangeRightPct.value = 100
  // 确保更新标记线
  setTimeout(() => {
    updateRangeMarkers()
  }, 10)
}

// 计算当前收益（整体或区间）
const currentProfitRate = computed(() => {
  // 详细的数据检查
  if (!_trendCache.value || !_trendCache.value.data?.length) {
    return null
  }

  const cacheData = _trendCache.value.data
  // 获取数据范围索引
  let startIdx, endIdx
  if (isRangeMode.value && rangeLeftPct.value < rangeRightPct.value) {
    const total = cacheData.length
    startIdx = Math.max(0, Math.floor(rangeLeftPct.value / 100 * (total - 1)))
    endIdx = Math.min(total - 1, Math.ceil(rangeRightPct.value / 100 * (total - 1)))
  } else {
    startIdx = 0
    endIdx = cacheData.length - 1
  }

  // 安全地获取净值数据
  const startData = cacheData[startIdx]
  const endData = cacheData[endIdx]

  if (!startData || !endData) return null

  const startNav = startData[1]
  const endNav = endData[1]

  if (startNav == null || endNav == null || isNaN(startNav) || isNaN(endNav)) return null

  try {
    // 使用所选时间段的起止净值计算期间涨跌（tab 切换会重置 _trendCache，因此 startNav 随 tab 变化）
    if (startNav !== 0) {
      const rate = ((endNav - startNav) / startNav) * 100
      if (isFinite(rate)) return rate
    }

    // startNav 为 0 时，找第一个有效点
    for (let i = 0; i < cacheData.length; i++) {
      const nav = cacheData[i][1]
      if (nav !== 0 && nav != null && !isNaN(nav)) {
        const rate = ((endNav - nav) / nav) * 100
        if (isFinite(rate)) return rate
        break
      }
    }
  } catch (err) {
    console.error('[currentProfitRate] error', err)
  }

  return null
})

// ── 技术参考指标 ──
const techIndicators = computed(() => {
  const full = _fullTrendData.value
  if (!full || full.length < 20) return null

  const vals = full.map(d => d[1])
  const len = vals.length
  const current = vals[len - 1]

  // MA20
  const ma20 = len >= 20 ? vals.slice(len - 20).reduce((s, v) => s + v, 0) / 20 : null
  // MA60
  const ma60 = len >= 60 ? vals.slice(len - 60).reduce((s, v) => s + v, 0) / 60 : null

  // 乖离率 Bias20 = (当前 - MA20) / MA20 * 100
  const bias20 = ma20 ? ((current - ma20) / ma20 * 100) : null

  // MA60 走向：比较最近5日的 MA60
  let ma60Trend = null
  if (len >= 65) {
    const ma60_5ago = vals.slice(len - 65, len - 5).reduce((s, v) => s + v, 0) / 60
    if (ma60 > ma60_5ago * 1.001) ma60Trend = 'up'
    else if (ma60 < ma60_5ago * 0.999) ma60Trend = 'down'
    else ma60Trend = 'flat'
  }

  // 历史同位 T+20 胜率
  // 找出历史上与当前净值相近的点，看20天后是否上涨
  // 自动扩容容差：从 ±2% 开始，样本不足时逐步放宽至 ±5%/±8%/±12%
  let winCount = 0, sampleCount = 0, usedTolerance = 0
  const toleranceLevels = [0.02, 0.05, 0.08, 0.12]
  const minSamples = 30
  for (const pct of toleranceLevels) {
    winCount = 0; sampleCount = 0; usedTolerance = pct
    const tol = current * pct
    for (let i = 0; i < len - 20; i++) {
      if (Math.abs(vals[i] - current) <= tol) {
        sampleCount++
        if (vals[i + 20] > vals[i]) winCount++
      }
    }
    if (sampleCount >= minSamples) break
  }
  const winRate = sampleCount > 0 ? (winCount / sampleCount * 100) : null

  // 综合信号
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

  // 数据天数
  const tradingDays = len

  return { current, ma20, ma60, bias20, ma60Trend, winRate, sampleCount, usedTolerance, signal, tradingDays }
})

// ── 波段信号指标 ──
const bandSignal = computed(() => {
  const full = _fullTrendData.value
  if (!full || full.length < 60) return null

  const vals = full.map(d => d[1])
  const len = vals.length
  const current = vals[len - 1]

  // 辅助：计算一段数据的最大回撤
  function calcMaxDrawdown(arr) {
    let peak = arr[0], maxDD = 0
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] > peak) peak = arr[i]
      const dd = (arr[i] - peak) / peak * 100
      if (dd < maxDD) maxDD = dd
    }
    return maxDD
  }

  // 辅助：计算一段数据的平均回撤
  function calcAvgDrawdown(arr) {
    let peak = arr[0], sum = 0, count = 0
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] > peak) peak = arr[i]
      const dd = (arr[i] - peak) / peak * 100
      if (dd < 0) { sum += dd; count++ }
    }
    return count > 0 ? sum / count : 0
  }

  // 当前回撤（从历史最高点）
  const histPeak = Math.max(...vals)
  const currentDD = ((current - histPeak) / histPeak * 100)

  // 历史最大回撤（全部数据）
  const histMaxDD = calcMaxDrawdown(vals)

  // 历史最低值
  const histMin = Math.min(...vals)
  const distFromHistLow = ((current - histMin) / histMin * 100)

  // 平均回撤
  const avgDD = calcAvgDrawdown(vals)

  // 多时间段回撤对比
  const periods = [
    { label: '近3月', days: 63 },
    { label: '近6月', days: 126 },
    { label: '近1年', days: 252 },
    { label: '近3年', days: 756 },
    { label: '全部', days: len },
  ]
  const periodStats = []
  for (const p of periods) {
    const slice = vals.slice(Math.max(0, len - p.days))
    if (slice.length < 10) continue
    const pMaxDD = calcMaxDrawdown(slice)
    const pAvgDD = calcAvgDrawdown(slice)
    const pMin = Math.min(...slice)
    const distFromPMin = ((current - pMin) / pMin * 100)
    // 当前回撤在该区间内
    const pPeak = Math.max(...slice)
    const pCurrentDD = ((current - pPeak) / pPeak * 100)
    periodStats.push({
      label: p.label,
      maxDD: pMaxDD,
      currentDD: pCurrentDD,
      avgDD: pAvgDD,
      diff: parseFloat((pCurrentDD - pMaxDD).toFixed(2)),
      distFromMin: distFromPMin,
    })
  }

  // 选取"近1年"或最长可用区间作为主要参考
  const refPeriod = periodStats.find(p => p.label === '近1年') || periodStats[periodStats.length - 1]
  const intervalMaxDD = refPeriod ? refPeriod.maxDD : histMaxDD
  const intervalDistMin = refPeriod ? refPeriod.distFromMin : distFromHistLow

  // 高位/低位阈值（三分法）：将历史最大回撤空间等分三份
  const t1 = histMaxDD * 0.33  // 高位阈值（回撤浅）
  const t2 = histMaxDD * 0.66  // 低位阈值（回撤深）

  // 当前位置百分比（0%=历史最深, 100%=历史最高）
  const position = histMaxDD !== 0 ? ((currentDD - histMaxDD) / (0 - histMaxDD) * 100) : 50

  // 波段信号判断
  let zone, zoneLevel, advice
  if (currentDD > t1) {
    // 回撤浅于 t1 → 高位区
    zone = '高位风险区'
    zoneLevel = 'high'
    advice = '当前处于历史波动的高位区域，跌幅较浅，风险溢价低。建议分批止盈，先卖出1份持仓，若继续上涨3%再卖出1份，若遇下跌则立即清仓止盈。'
  } else if (currentDD < t2) {
    // 回撤深于 t2 → 低位区
    zone = '低位机会区'
    zoneLevel = 'low'
    advice = '当前处于历史波动的低位区域，跌幅较深，安全边际高。建议分批布局，把资金分成3-5份，进入低位区后先买入1份，每下跌2%左右再买入1份，若遇上涨则立即停止买入。'
  } else {
    zone = '观望区'
    zoneLevel = 'mid'
    advice = '当前处于中等回撤区间，建议持有观望，等待更明确的信号再操作。'
  }

  return {
    currentDD, histMaxDD, intervalMaxDD, avgDD,
    distFromHistLow, intervalDistMin,
    highThreshold: t1, lowThreshold: t2,
    position, periodStats,
    zone, zoneLevel, advice
  }
})

onMounted(() => {
  console.log('[FundExpandPanel] onMounted - 开始加载数据')
  loadTrend();
  loadIntraday();
  loadHoldingsData();
  // 绑定图表容器的拖动事件
  setTimeout(() => {
    const chartWrapper = trendEl.value?.closest('.fd-chart-wrap')
    if (chartWrapper) {
      chartWrapper.addEventListener('wheel', onTrendWheel, { passive: false })
      chartWrapper.addEventListener('click', onTrendChartClick)
    }
  }, 100)
})
onUnmounted(() => { Object.values(_charts).forEach(c => { try { c.dispose() } catch {} }) })

watch(() => props.code, () => {
  Object.keys(_charts).forEach(k => { try { _charts[k].dispose() } catch {}; delete _charts[k] })
  _trendCache.value = null; _intradayCache = null; activeTab.value = 'trend'
  loadTrend(); loadIntraday(); loadHoldingsData()
})

function switchTab(tab) {
  if (activeTab.value === tab) return
  activeTab.value = tab
  setTimeout(() => {
    if (tab === 'trend') {
      if (_trendCache && !_charts.trend) renderTrendChart()
      else if (_charts.trend) _charts.trend.resize()
    } else {
      if (_intradayCache && !_charts.intraday) renderIntradayChart()
      else if (_charts.intraday) _charts.intraday.resize()
    }
  }, 30)
}

function switchDataType(dtype) {
  if (trendDataType.value === dtype) return
  trendDataType.value = dtype
  _buildTrendCache()
  renderTrendChart()
}

/**
 * 根据当前 trendDataType 和 trendPeriod 构建 _trendCache
 */
function _buildTrendCache() {
  const period = trendPeriod.value
  const d = new Date()
  let cutoff = 0
  if (period === 'all') {
    cutoff = 0
  } else if (period === 'ytd') {
    d.setMonth(0, 1); d.setHours(0, 0, 0, 0); cutoff = d.getTime()
  } else {
    d.setDate(5)
    const periodMonths = { '1m': 1, '3m': 3, '6m': 6, '1y': 12, '2y': 24, '3y': 36, '5y': 60 }
    d.setMonth(d.getMonth() - (periodMonths[period] || 3)); d.setHours(0, 0, 0, 0); cutoff = d.getTime()
  }

  const dtype = trendDataType.value
  let allData = []  // 统一为 [[ts, val]] 格式

  if (dtype === 'netWorth' && _rawNetWorth.value) {
    allData = _rawNetWorth.value.map(d => [d.x, Number(d.y)])
  } else if (dtype === 'acWorth' && _rawAcWorth.value) {
    allData = _rawAcWorth.value.map(d => [d[0], Number(d[1])])
  } else if (dtype === 'grandTotal' && _rawAcWorth.value && _rawAcWorth.value.length > 0) {
    // 累计收益率：先按时间过滤累计净值，再以区间第一个点为基准计算
    const sorted = [..._rawAcWorth.value].sort((a, b) => a[0] - b[0])
    const slicedAc = cutoff > 0 ? sorted.filter(d => d[0] >= cutoff) : sorted
    if (slicedAc.length > 0) {
      const baseNav = Number(slicedAc[0][1])
      if (baseNav > 0) {
        // 直接生成最终数据，跳过后面的 cutoff 过滤
        const vals = slicedAc.map(d => [d[0], ((Number(d[1]) / baseNav) - 1) * 100])
        allData = vals
        cutoff = 0  // 已经过滤过了，不再二次过滤
      }
    }
  }

  if (!allData.length) { _trendCache.value = null; return }

  allData.sort((a, b) => a[0] - b[0])

  // 单位净值走势保存完整数据用于波段信号计算
  if (dtype === 'netWorth') {
    _fullTrendData.value = allData
  }

  const sliced = cutoff > 0 ? allData.filter(d => d[0] >= cutoff) : allData
  if (!sliced.length) { _trendCache.value = null; return }

  const vals = sliced.map(d => d[1])
  const maxV = Math.max(...vals), minV = Math.min(...vals)

  if (dtype === 'grandTotal') {
    // 累计收益率：用绝对值差计算最大回撤（从最高收益率跌到最低收益率的幅度）
    let gtPeakIdx = 0, gtTroughIdx = 0, gtMaxDd = 0
    let curPeak = vals[0], curPeakIdx = 0
    for (let i = 1; i < vals.length; i++) {
      if (vals[i] > curPeak) { curPeak = vals[i]; curPeakIdx = i }
      else {
        const dd = curPeak - vals[i]  // 百分点差值
        if (dd > gtMaxDd) { gtMaxDd = dd; gtPeakIdx = curPeakIdx; gtTroughIdx = i }
      }
    }
    _trendCache.value = { data: sliced, peakIdx: gtPeakIdx, troughIdx: gtTroughIdx, maxDd: gtMaxDd / 100, maxV, minV }
    const lastVal = vals[vals.length - 1]
    trendStats.value = {
      returnRate: (lastVal >= 0 ? '+' : '') + lastVal.toFixed(2) + '%',
      max: (maxV >= 0 ? '+' : '') + maxV.toFixed(2) + '%',
      min: (minV >= 0 ? '+' : '') + minV.toFixed(2) + '%',
      dd: gtMaxDd.toFixed(2) + '%',
      isGrandTotal: true,
      histRecoveryDays: null, intervalRecoveryDays: null
    }
  } else {
    const { peakIdx, troughIdx, maxDd } = _findMaxDrawdown(vals)
    _trendCache.value = { data: sliced, peakIdx, troughIdx, maxDd, maxV, minV }

    if (dtype === 'netWorth') {
      let histRecoveryDays = null, intervalRecoveryDays = null
      if (maxDd > 0 && peakIdx < troughIdx) {
        const peakVal = vals[peakIdx]
        let recovered = false
        for (let i = troughIdx + 1; i < vals.length; i++) {
          if (vals[i] >= peakVal) { intervalRecoveryDays = i - troughIdx; recovered = true; break }
        }
        if (!recovered) intervalRecoveryDays = -(vals.length - 1 - troughIdx)
      }
      if (_fullTrendData.value && _fullTrendData.value.length > 60) {
        const fullVals = _fullTrendData.value.map(d => d[1])
        const fullDD = _findMaxDrawdown(fullVals)
        if (fullDD.maxDd > 0 && fullDD.peakIdx < fullDD.troughIdx) {
          const fpv = fullVals[fullDD.peakIdx]
          for (let i = fullDD.troughIdx + 1; i < fullVals.length; i++) {
            if (fullVals[i] >= fpv) { histRecoveryDays = i - fullDD.troughIdx; break }
          }
          if (histRecoveryDays === null) histRecoveryDays = -(fullVals.length - 1 - fullDD.troughIdx)
        }
      }
      trendStats.value = { max: maxV.toFixed(4), min: minV.toFixed(4), dd: (maxDd * 100).toFixed(2) + '%', histRecoveryDays, intervalRecoveryDays }
    } else {
      // 累计净值
      trendStats.value = { max: maxV.toFixed(4), min: minV.toFixed(4), dd: (maxDd * 100).toFixed(2) + '%', histRecoveryDays: null, intervalRecoveryDays: null }
    }
  }
}

/**
 * 计算最大回撤区间 [peakIdx, troughIdx]
 * 遍历找出从任意峰值到其后谷值最大跌幅对应的下标
 */
function _findMaxDrawdown(vals) {
  if (vals.length < 2) return { peakIdx: 0, troughIdx: 0, maxDd: 0 }
  let maxDd = 0, peakIdx = 0, troughIdx = 0, curPeakIdx = 0
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] > vals[curPeakIdx]) {
      curPeakIdx = i
    } else {
      const dd = vals[curPeakIdx] > 0 ? (vals[curPeakIdx] - vals[i]) / vals[curPeakIdx] : 0
      if (dd > maxDd) { maxDd = dd; peakIdx = curPeakIdx; troughIdx = i }
    }
  }
  return { peakIdx, troughIdx, maxDd }
}

function loadTrend() {
  const el = trendEl.value
  if (el) el.innerHTML = '<div class="fd-loading"><span class="spinner"></span>加载中…</div>'
  trendStats.value = null
  _trendCache.value = null
  resetRange()

  if (_charts.trend) { _charts.trend.dispose(); delete _charts.trend }

  // 如果已有原始数据（仅切换时间周期），直接重建缓存
  if (_rawNetWorth.value) {
    _buildTrendCache()
    if (!_trendCache.value) { if (el) el.innerHTML = '<div class="fd-empty">暂无净值数据</div>'; return }
    if (activeTab.value === 'trend') renderTrendChart()
    return
  }

  fetchPingzhongdata(props.code).then(pzd => {
    // 保存 3 种原始数据
    const raw = pzd.data || pzd
    _rawNetWorth.value = (Array.isArray(raw) ? raw : []).sort((a, b) => a.x - b.x)
    _rawAcWorth.value = Array.isArray(pzd.acWorth) ? pzd.acWorth.sort((a, b) => a[0] - b[0]) : []


    // 波段信号始终基于单位净值全量数据
    _fullTrendData.value = _rawNetWorth.value.map(d => [d.x, Number(d.y)])

    _buildTrendCache()
    if (!_trendCache.value) { if (el) el.innerHTML = '<div class="fd-empty">暂无净值数据</div>'; return }
    if (activeTab.value === 'trend') renderTrendChart()
  }).catch(e => { console.warn('[FundExpandPanel] loadTrend:', e); if (el) el.innerHTML = '<div class="fd-empty">数据加载失败</div>' })
}

function renderTrendChart() {
  const el = trendEl.value; if (!el || !_trendCache.value) return
  el.innerHTML = ''; if (_charts.trend) { try { _charts.trend.dispose() } catch {} }
  _charts.trend = echarts.init(el)

  const { data, peakIdx, troughIdx, maxDd, maxV, minV } = _trendCache.value
  const RED = '#f04040', GREEN = '#22c45e', YELLOW = '#f5a623'
  const dtype = trendDataType.value
  const isGrandTotal = dtype === 'grandTotal'

  // 提取 x 轴标签（MM-DD）和 y 轴数组
  const xCats = data.map(d => _formatTs(d[0]))
  const yVals = data.map(d => d[1])

  const series = []

  if (dtype === 'netWorth') {
    // ── 单位净值：分段着色 + 回撤修复标注 ──
    const mkArea = color => ({
      opacity: 0.08,
      color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color }, { offset: 1, color: 'rgba(0,0,0,0)' }] }
    })
    const mkSeries = (vals, startIdx, endIdx, color, withArea) => ({
      type: 'line', symbol: 'none', smooth: false,
      data: vals.map((v, i) => (i < startIdx || i > endIdx) ? null : v),
      connectNulls: false,
      lineStyle: { width: 1.5, color },
      areaStyle: withArea ? mkArea(color) : null
    })

    let recoveryIdx = -1
    if (maxDd > 0 && peakIdx < troughIdx) {
      const peakVal = yVals[peakIdx]
      for (let i = troughIdx + 1; i < yVals.length; i++) {
        if (yVals[i] >= peakVal) { recoveryIdx = i; break }
      }
    }

    if (!maxDd || peakIdx >= troughIdx) {
      series.push({ type: 'line', symbol: 'none', smooth: false, data: yVals, lineStyle: { width: 1.5, color: RED }, areaStyle: mkArea(RED) })
    } else if (recoveryIdx > 0) {
      series.push(mkSeries(yVals, 0, peakIdx, RED, true))
      series.push(mkSeries(yVals, peakIdx, troughIdx, GREEN, true))
      series.push(mkSeries(yVals, troughIdx, recoveryIdx, YELLOW, false))
      if (recoveryIdx < yVals.length - 1) series.push(mkSeries(yVals, recoveryIdx, yVals.length - 1, RED, true))
    } else {
      series.push(mkSeries(yVals, 0, peakIdx, RED, true))
      series.push(mkSeries(yVals, peakIdx, troughIdx, GREEN, true))
      series.push(mkSeries(yVals, troughIdx, yVals.length - 1, YELLOW, false))
    }

    // 修复区域背景标注
    if (maxDd > 0 && peakIdx < troughIdx) {
      const recoveryEndIdx = recoveryIdx > 0 ? recoveryIdx : yVals.length - 1
      const recoveryDays = recoveryIdx > 0 ? recoveryIdx - troughIdx : null
      const yellowSeries = recoveryIdx > 0 ? series[2] : series[series.length - 1]
      const labelText = recoveryIdx > 0 ? '✓ 已修复 ' + recoveryDays + '天' : '修复中'
      const labelColor = recoveryIdx > 0 ? '#22c45e' : YELLOW
      yellowSeries.markArea = {
        silent: true,
        data: [[
          { xAxis: xCats[troughIdx], itemStyle: { color: 'rgba(245, 166, 35, 0.10)' },
            label: { show: true, position: 'insideTop', formatter: labelText, color: labelColor, fontSize: 10, fontWeight: 600, padding: [4, 0, 0, 0] } },
          { xAxis: xCats[recoveryEndIdx] }
        ]]
      }
    }
  } else {
    // ── 累计净值 / 累计收益率：单色线 ──
    const lineColor = isGrandTotal ? '#f5a623' : '#5b8ff9'
    series.push({
      type: 'line', symbol: 'none', smooth: false,
      data: yVals,
      lineStyle: { width: 1.5, color: lineColor },
      areaStyle: {
        opacity: 0.08,
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: lineColor }, { offset: 1, color: 'rgba(0,0,0,0)' }] }
      }
    })
  }

  const opts = _chartOption(xCats, RED, 'category')
  opts.xAxis.data = xCats
  opts.series = series

  // 累计收益率：y 轴格式化为百分比
  if (isGrandTotal) {
    opts.yAxis.axisLabel = {
      color: '#4e527a', fontSize: 10,
      formatter: v => (v >= 0 ? '+' : '') + v.toFixed(1) + '%'
    }
  }

  // 单位净值时叠加成本线和高/低位区标注
  if (dtype === 'netWorth') {
    addRangeMarkers(opts)
  }

  // 右侧 y 轴：百分比涨跌（相对第一个数据点）
  const baseNav = yVals[0]
  if (!isGrandTotal && baseNav !== 0) {
    const leftAxis = opts.yAxis
    opts.yAxis = [
      leftAxis,
      {
        type: 'value', scale: true, position: 'right',
        alignTicks: true,
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: {
          color: '#4e527a', fontSize: 10,
          formatter: v => {
            const pct = ((v - baseNav) / baseNav * 100)
            return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%'
          }
        },
        splitLine: { show: false }
      }
    ]
    opts.series.push({
      type: 'line', symbol: 'none', yAxisIndex: 1,
      data: yVals,
      lineStyle: { width: 0, opacity: 0 },
      itemStyle: { opacity: 0 },
      silent: true, tooltip: { show: false }
    })
  }

  try {
    _charts.trend.setOption(opts)
    // 获取实际绘图区偏移，用于对齐滑块
    _syncGridPadding()
  } catch (err) {
    console.warn('[FundExpandPanel] setOption error:', err)
  }

  // 延迟 resize 确保容器尺寸稳定后图表完全撑开
  setTimeout(() => {
    if (_charts.trend) {
      _charts.trend.resize()
      _syncGridPadding()
    }
  }, 150)

  // 初始计算收益
  onRangeChange()
}

function _syncGridPadding() {
  if (!_charts.trend) return
  try {
    const model = _charts.trend.getModel()
    const gridRect = model.getComponent('grid').coordinateSystem.getRect()
    const domWidth = _charts.trend.getDom().clientWidth
    chartGridPadding.value = {
      left: gridRect.x,
      right: domWidth - gridRect.x - gridRect.width,
      top: gridRect.y,
      plotH: gridRect.height,
      plotW: gridRect.width
    }
  } catch {
    chartGridPadding.value = { left: 0, right: 0, top: 0, plotH: 0, plotW: 0 }
  }
}

function addRangeMarkers(opts) {
  if (!_trendCache.value?.data?.length) return

  // 成本线（水平虚线）
  const costNav = props.item.costBasis ?? props.item.costNav
  const { maxV, minV } = _trendCache.value
  const costData = (costNav != null && costNav > 0 && maxV >= costNav && minV <= costNav)
    ? [{
        yAxis: costNav,
        lineStyle: { color: '#f5d060', type: 'dashed', width: 1.5, dashArray: [20, 20] },
        label: {
          show: true, position: 'insideStart',
          formatter: '成本: ' + costNav.toFixed(4),
          color: '#f5d060', fontSize: 11, fontWeight: 600, distance: 10
        }
      }]
    : []

  // 高位区（止盈）/ 低位区（抄底）分割线 + 半透明背景
  // highThreshold = histMaxDD * 0.33, lowThreshold = histMaxDD * 0.66
  const fullData = _fullTrendData.value
  const markAreaData = []
  if (fullData && fullData.length >= 60) {
    const fullVals = fullData.map(d => d[1])
    const histPeak = Math.max(...fullVals)
    const histMaxDD = bandSignal.value?.histMaxDD
    if (histMaxDD != null && histMaxDD < 0) {
      // 高位区(止盈)线 + 背景
      const highLineNav = histPeak * (1 + histMaxDD * 0.33 / 100)
      if (highLineNav > 0 && maxV >= highLineNav * 0.95 && minV <= highLineNav * 1.05) {
        costData.push({
          yAxis: highLineNav,
          lineStyle: { color: '#22c45e', type: 'dashed', width: 1, dashArray: [6, 4] },
          label: {
            show: true, position: 'insideEndTop',
            formatter: '高位区(止盈)',
            color: '#22c45e', fontSize: 10, fontWeight: 500
          }
        })
        // 高位区半透明背景（线上方到图表顶部）
        markAreaData.push([
          { yAxis: highLineNav, itemStyle: { color: 'rgba(34,196,94,0.06)' } },
          { yAxis: maxV * 1.05 }
        ])
      }

      // 低位区(抄底)线 + 背景
      const lowLineNav = histPeak * (1 + histMaxDD * 0.66 / 100)
      if (lowLineNav > 0 && maxV >= lowLineNav * 0.95 && minV <= lowLineNav * 1.05) {
        costData.push({
          yAxis: lowLineNav,
          lineStyle: { color: '#f04040', type: 'dashed', width: 1, dashArray: [6, 4] },
          label: {
            show: true, position: 'insideEndBottom',
            formatter: '低位区(抄底)',
            color: '#f04040', fontSize: 10, fontWeight: 500
          }
        })
        // 低位区半透明背景（线下方到图表底部）
        markAreaData.push([
          { yAxis: minV * 0.95, itemStyle: { color: 'rgba(240,64,64,0.06)' } },
          { yAxis: lowLineNav }
        ])
      }
    }
  }

  if (opts.series && opts.series.length > 0) {
    if (costData.length) {
      opts.series[0].markLine = { symbol: 'none', silent: true, data: costData }
    }
    if (markAreaData.length) {
      opts.series[0].markArea = Object.assign(opts.series[0].markArea || {}, {
        silent: true,
        data: [...(opts.series[0].markArea?.data || []), ...markAreaData]
      })
    }
  }
}

function onTrendChartClick(e) {
  if (!_charts.trend || !_trendCache.value?.data?.length) return
  if (!rangeEnabled.value) return  // 区间开关关闭时不响应点击
  const pct = _clientXToPct(e.clientX)
  isRangeMode.value = true

  // 判断离左还是右手柄更近
  const distLeft = Math.abs(pct - rangeLeftPct.value)
  const distRight = Math.abs(pct - rangeRightPct.value)

  if (distLeft <= distRight) {
    rangeLeftPct.value = Math.max(0, Math.min(rangeRightPct.value - 3, pct))
  } else {
    rangeRightPct.value = Math.min(100, Math.max(rangeLeftPct.value + 3, pct))
  }
}

function onRangeChange() {
  // 收益率用 computed currentProfitRate 计算，这里触发更新
}

function updateRangeMarkers() {
  // 手柄位置由 Vue computed (handlePixelLeft/Right) 自动更新
  // 这里不再需要操作 ECharts markLine
}

function loadIntraday() {
  const el = intradayEl.value
  if (el) el.innerHTML = '<div class="fd-loading"><span class="spinner"></span>加载中…</div>'
  intradayStats.value = null; _intradayCache = null
  if (_charts.intraday) { _charts.intraday.dispose(); delete _charts.intraday }
  fetchIntraday(props.code).then(d => {
    if (!d) { if (el) el.innerHTML = '<div class="fd-empty">暂无分时数据（非交易日或货币基金）</div>'; return }
    const { times, values, yesterdayDwjz } = d
    const maxV = Math.max(...values), minV = Math.min(...values)
    intradayStats.value = { max: maxV.toFixed(4), min: minV.toFixed(4), amp: yesterdayDwjz > 0 ? ((maxV - minV) / yesterdayDwjz * 100).toFixed(2) + '%' : '--' }
    const color = values[values.length - 1] >= values[0] ? '#f04040' : '#22c45e'
    _intradayCache = { times, values, yesterdayDwjz, color }
    if (activeTab.value === 'intraday') renderIntradayChart()
  }).catch(e => { console.warn('[FundExpandPanel] loadIntraday:', e); if (el) el.innerHTML = '<div class="fd-empty">分时数据加载失败</div>' })
}

function renderIntradayChart() {
  const el = intradayEl.value; if (!el || !_intradayCache) return
  el.innerHTML = ''; if (_charts.intraday) { try { _charts.intraday.dispose() } catch {} }
  _charts.intraday = echarts.init(el)
  const { times, values, yesterdayDwjz, color } = _intradayCache
  const opts = _chartOption(values, color, 'category')
  opts.xAxis = {
    type: 'category', data: times, boundaryGap: false,
    axisLine: { lineStyle: { color: '#272b48' } }, axisTick: { show: false },
    axisLabel: { color: '#4e527a', fontSize: 10, interval: Math.floor(times.length / 4) || 'auto' },
    splitLine: { show: false }
  }
  opts.tooltip = {
    trigger: 'axis', backgroundColor: 'rgba(24,27,46,0.95)', borderColor: '#272b48',
    textStyle: { color: '#e6e8f4', fontSize: 12 },
    formatter(p) {
      const pt = p[0]; if (!pt) return ''
      const v = values[pt.dataIndex], pct = ((v - yesterdayDwjz) / yesterdayDwjz * 100).toFixed(2)
      return `${times[pt.dataIndex]}<br/>估值：${v.toFixed(4)}<br/>涨跌：${pct >= 0 ? '+' : ''}${pct}%`
    }
  }
  _charts.intraday.setOption(opts)
}

/** timestamp -> MM-DD 字符串 */
function _formatTs(ts) {
  if (ts == null) return '--'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return '--'
  return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function _chartOption(vals, color, xType) {
  // 趋势图：xType='category'，data 是净值数组；分时图：xType='category'，data 是 times 数组
  return {
    animation: false,
    grid: { left: 8, right: 12, top: 22, bottom: 6, containLabel: true },
    tooltip: {
      trigger: 'axis', backgroundColor: 'rgba(24,27,46,0.95)', borderColor: '#272b48',
      textStyle: { color: '#e6e8f4', fontSize: 12 },
      axisPointer: {
        type: 'cross',
        lineStyle: { color: 'rgba(255,255,255,0.25)', type: 'dashed', width: 1 },
        crossStyle: { color: 'rgba(255,255,255,0.25)', type: 'dashed', width: 1 },
        label: {
          backgroundColor: 'rgba(24,27,46,0.9)',
          color: '#e6e8f4', fontSize: 10, padding: [4, 6]
        }
      },
      formatter: xType === 'category' ? (p) => {
        // 过滤掉 null 值的 series，只取有值的点
        const validPt = p.find(pt => pt.value != null && pt.value !== null)
        if (!validPt) return ''
        // 从原始数据取时间戳，展示完整日期 YYYY-MM-DD
        const trendData = _trendCache.value?.data
        let dLabel = validPt.name || ''
        if (trendData && trendData[validPt.dataIndex]) {
          const dt = new Date(trendData[validPt.dataIndex][0])
          if (!isNaN(dt.getTime())) {
            dLabel = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0')
          }
        }
        const v = validPt.value
        const dtype = trendDataType.value
        if (dtype === 'grandTotal') {
          return `${dLabel}<br/>累计收益率：${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
        }
        const valLabel = dtype === 'acWorth' ? '累计净值' : '净值'
        // 计算相对第一个数据点的涨跌幅
        const baseVal = trendData && trendData[0] ? trendData[0][1] : null
        let pctStr = ''
        if (baseVal != null && baseVal > 0) {
          const pct = ((v - baseVal) / baseVal * 100)
          pctStr = `<br/>涨跌：${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
        }
        return `${dLabel}<br/>${valLabel}：${v.toFixed(4)}${pctStr}`
      } : (p) => {
        const pt = p[0]
        const d = new Date(pt.value[0])
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}<br/>净值：${pt.value[1].toFixed(4)}`
      }
    },
    xAxis: {
      type: 'category', boundaryGap: false,
      axisLine: { lineStyle: { color: '#272b48' } }, axisTick: { show: false },
      axisLabel: { color: '#4e527a', fontSize: 10, interval: Math.ceil(vals.length / 8) },
      splitLine: { show: false },
      axisPointer: {
        label: {
          // x 轴十字光标标签显示完整日期
          formatter(params) {
            const trendData = _trendCache.value?.data
            if (trendData && trendData[params.seriesData?.[0]?.dataIndex]) {
              const dt = new Date(trendData[params.seriesData[0].dataIndex][0])
              if (!isNaN(dt.getTime())) {
                return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0')
              }
            }
            return params.value
          }
        }
      }
    },
    yAxis: {
      type: 'value', scale: true,
      axisLine: { lineStyle: { color: '#272b48' } }, axisTick: { show: false },
      axisLabel: { color: '#4e527a', fontSize: 10, formatter: v => v.toFixed(3) },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' } }
    },
    series: [{
      type: 'line', symbol: 'none', smooth: true,
      lineStyle: { width: 1.5, color },
      areaStyle: { opacity: 0.1, color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color }, { offset: 1, color: 'rgba(0,0,0,0)' }] } },
      data: vals
    }]
  }
}

async function loadHoldingsData() {
  holdingsLoading.value = true; holdingsError.value = null; holdings.value = []
  try {
    const list = await fetchHoldings(props.code)
    if (!list || !list.length) { holdings.value = []; holdingsLoading.value = false; return }
    holdings.value = list; holdingsLoading.value = false
    try {
      const changes = await fetchStockChanges(list)
      holdings.value = list.map(h => ({ ...h, change: changes[h.code] != null ? changes[h.code] : null }))
    } catch {}
  } catch { holdingsError.value = '重仓数据加载失败'; holdingsLoading.value = false }
}

function barWidth(ratio) {
  const pct = Number(ratio) || 0
  const maxW = Math.max(...holdings.value.map(h => Number(h.ratio) || 0)) || 1
  return Math.round(pct / maxW * 100)
}
function chgClass(val) { return val != null ? (val > 0 ? 'profit' : val < 0 ? 'loss' : '') : '' }

// ── 操作建议（computed，与技术参考/波段信号同级展示）──
const suggestInfo = computed(() => {
  const f = props.item
  if (f.amount == null) return null  // 非持仓基金不显示

  const currentNav = (f.navConfirmed && f.confirmedNav) ? f.confirmedNav : (f.gsz || f.prevNav)
  const costBasisNav = (f.costBasisLocked && f.costBasis > 0) ? f.costBasis : (f.costNav || f.prevNav)
  if (!currentNav || !costBasisNav) return null

  const shares = (f.holdingShares > 0) ? f.holdingShares : (f.amount / costBasisNav)
  const principal = shares * costBasisNav
  const valueNow = shares * currentNav
  const profitTotal = valueNow - principal
  const rTotal = principal > 0 ? (profitTotal / principal * 100) : 0
  const rToday = (f.gszzl != null && !isNaN(f.gszzl)) ? f.gszzl : 0

  const navLabel = f.navConfirmed ? '确认净值' : '预估净值'
  const fmtY = (n) => (n >= 0 ? '+¥' : '-¥') + Math.abs(n).toFixed(2)
  const fmtP = (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%'

  let zoneLevel, zoneLabel, zoneHint, reasonHtml

  if (rTotal >= 40) {
    const sellAmt = valueNow * 0.5, sellSh = sellAmt / currentNav
    zoneLevel = 'high'; zoneLabel = '止盈区'; zoneHint = '建议分批止盈（较大幅度）'
    reasonHtml = `当前持仓累计盈利约 <strong>${fmtP(rTotal)}（${fmtY(profitTotal)}）</strong>，已达到非常可观的收益水平。今天涨跌幅 <strong>${fmtP(rToday)}</strong>，在高位时及时落袋是保护收益的明智做法。<br><br>建议：先卖出约 <strong>50% 仓位</strong>，大约 <strong>¥${sellAmt.toFixed(2)} 元（${sellSh.toFixed(2)} 份）</strong>，把一半盈利落袋为安，剩余一半继续享受后续上涨空间。`
  } else if (rTotal >= 20) {
    const sellAmt = valueNow * 0.3, sellSh = sellAmt / currentNav
    zoneLevel = 'high'; zoneLabel = '止盈区'; zoneHint = '建议小幅止盈'
    reasonHtml = `当前持仓累计盈利约 <strong>${fmtP(rTotal)}（${fmtY(profitTotal)}）</strong>，收益已经不小了。今天涨跌幅 <strong>${fmtP(rToday)}</strong>，市场有一定不确定性。<br><br>建议：卖出约 <strong>30% 仓位</strong>，大约 <strong>¥${sellAmt.toFixed(2)} 元（${sellSh.toFixed(2)} 份）</strong>，部分止盈，余下继续观察。`
  } else if (rTotal >= 5 && rToday >= 2) {
    const sellAmt = valueNow * 0.15, sellSh = sellAmt / currentNav
    zoneLevel = 'high'; zoneLabel = '减仓区'; zoneHint = '今日可小幅减仓'
    reasonHtml = `当前持仓盈利约 <strong>${fmtP(rTotal)}（${fmtY(profitTotal)}）</strong>，今天单日涨幅达到 <strong>${fmtP(rToday)}</strong>，短期情绪偏热。<br><br>建议：减仓约 <strong>15%</strong>，大约 <strong>¥${sellAmt.toFixed(2)} 元（${sellSh.toFixed(2)} 份）</strong>，不用全部卖出，保留大头继续持有。`
  } else if (rTotal <= -15 && rToday <= -2) {
    const buyAmt = principal * 0.2, buySh = buyAmt / currentNav
    zoneLevel = 'low'; zoneLabel = '加仓区'; zoneHint = '建议分批低位加仓'
    reasonHtml = `当前持仓亏损约 <strong>${fmtP(rTotal)}（${fmtY(profitTotal)}）</strong>，今天又跌了 <strong>${fmtP(rToday)}</strong>，已处于相对低位区间。<br><br>建议：可以考虑补仓约 <strong>¥${buyAmt.toFixed(2)} 元（约 ${buySh.toFixed(2)} 份）</strong>，即原始本金的 20% 左右，不要一次性重仓，以免越跌越套。`
  } else if (rTotal <= -8 && rToday <= -1.5) {
    const buyAmt = principal * 0.1, buySh = buyAmt / currentNav
    zoneLevel = 'low'; zoneLabel = '补仓区'; zoneHint = '可小额定投补仓'
    reasonHtml = `当前持仓亏损约 <strong>${fmtP(rTotal)}（${fmtY(profitTotal)}）</strong>，今天跌了 <strong>${fmtP(rToday)}</strong>，处于回调区间。<br><br>建议：少量加仓约 <strong>¥${buyAmt.toFixed(2)} 元（约 ${buySh.toFixed(2)} 份）</strong>，用定投的方式分散风险，不要用超过总仓位 10% 的资金一次性追加。`
  } else {
    zoneLevel = 'mid'; zoneLabel = '观望区'; zoneHint = '暂不操作'
    let holdDetail = ''
    if (rTotal > 0) holdDetail = `盈利约 <strong>${fmtP(rTotal)}</strong>，虽然有收益，但还不到需要止盈的水平，继续持有等待更好时机。`
    else if (rTotal < 0) holdDetail = `目前亏损约 <strong>${fmtP(Math.abs(rTotal))}</strong>，还没有跌到明显的低位补仓区域，保持现有仓位等待修复更稳妥。`
    else holdDetail = `当前接近成本价附近，盈亏基本持平，维持现状即可。`
    reasonHtml = `今日涨跌幅 <strong>${fmtP(rToday)}</strong>，属于正常波动范围。${holdDetail}不频繁操作、避免追涨杀跌是最重要的原则之一，耐心等待是最好的策略。`
  }

  return {
    valueNow: valueNow.toFixed(2),
    costBasisNav: costBasisNav.toFixed(4),
    currentNav: currentNav.toFixed(4),
    navLabel,
    profitTotal,
    profitTotalStr: `${fmtY(profitTotal)}（${fmtP(rTotal)}）`,
    rToday,
    rTodayStr: fmtP(rToday),
    zoneLevel, zoneLabel, zoneHint, reasonHtml,
    logicHtml: buildSuggestLogicHtml({ rTotal, rToday, fmtP }),
  }
})

function buildSuggestLogicHtml({ rTotal, rToday, fmtP }) {
  const tick = (ok) => ok
    ? '<span style="color:var(--profit);font-weight:700;">✅</span>'
    : '<span style="color:var(--loss);font-weight:700;">❌</span>'
  const val = (v, ok) => `<strong style="color:${ok ? 'var(--profit)' : 'var(--loss)'}">${v}</strong>`
  const red = 'var(--loss)', yellow = '#f0a500', green = 'var(--profit)', gray = 'var(--text-muted)'

  const rules = [
    {
      label: '累计盈利 ≥ 40% → 建议大幅止盈（50%仓位）', color: red,
      checks: [{ name: `累计收益率 ≥ 40%（当前 ${val(fmtP(rTotal), rTotal >= 40)}）`, pass: rTotal >= 40 }],
      triggered: rTotal >= 40,
    },
    {
      label: '累计盈利 20%–40% → 建议小幅止盈（30%仓位）', color: yellow,
      checks: [
        { name: `累计收益率 ≥ 20%（当前 ${val(fmtP(rTotal), rTotal >= 20)}）`, pass: rTotal >= 20 },
        { name: `累计收益率 < 40%（当前 ${val(fmtP(rTotal), rTotal < 40)}）`, pass: rTotal < 40 },
      ],
      triggered: rTotal >= 20 && rTotal < 40,
      note: rTotal >= 40 ? `<span style="color:${gray}">已被上一条规则命中，该条跳过。</span>` : null,
    },
    {
      label: '盈利 5%+ 且今日大涨 ≥ 2% → 小幅减仓（15%）', color: yellow,
      checks: [
        { name: `累计收益率 ≥ 5%（当前 ${val(fmtP(rTotal), rTotal >= 5)}）`, pass: rTotal >= 5 },
        { name: `今日涨幅 ≥ +2%（当前 ${val(fmtP(rToday), rToday >= 2)}）`, pass: rToday >= 2 },
      ],
      triggered: rTotal >= 5 && rToday >= 2 && rTotal < 20,
      note: rTotal >= 20 ? `<span style="color:${gray}">累计盈利已超 20%，已被止盈规则命中，该条跳过。</span>` : null,
    },
    {
      label: '亏损 ≥ 15% 且今日跌 ≥ 2% → 分批加仓（本金20%）', color: green,
      checks: [
        { name: `累计亏损 ≥ -15%（当前 ${val(fmtP(rTotal), rTotal <= -15)}）`, pass: rTotal <= -15 },
        { name: `今日跌幅 ≤ -2%（当前 ${val(fmtP(rToday), rToday <= -2)}）`, pass: rToday <= -2 },
      ],
      triggered: rTotal <= -15 && rToday <= -2,
    },
    {
      label: '亏损 8%–15% 且今日跌 ≥ 1.5% → 小额定投补仓（本金10%）', color: green,
      checks: [
        { name: `累计亏损 ≥ -8%（当前 ${val(fmtP(rTotal), rTotal <= -8)}）`, pass: rTotal <= -8 },
        { name: `累计亏损 < -15%（当前 ${val(fmtP(rTotal), rTotal > -15)}）`, pass: rTotal > -15 },
        { name: `今日跌幅 ≤ -1.5%（当前 ${val(fmtP(rToday), rToday <= -1.5)}）`, pass: rToday <= -1.5 },
      ],
      triggered: rTotal <= -8 && rTotal > -15 && rToday <= -1.5,
      note: rTotal <= -15 ? `<span style="color:${gray}">亏损已超 -15%，已被上一条规则命中，该条跳过。</span>` : null,
    },
  ]

  let html = '<div style="margin-top:16px;">'
  html += '<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;letter-spacing:0.5px;">📋 分析过程 — 规则匹配详情</div>'
  rules.forEach(rule => {
    const borderColor = rule.triggered ? rule.color : 'var(--border)'
    html += `<div style="border:1px solid ${borderColor};border-radius:8px;padding:10px 12px;margin-bottom:8px;background:${rule.triggered ? 'rgba(255,255,255,0.03)' : 'transparent'}">`
    html += `<div style="font-size:12px;font-weight:600;margin-bottom:6px;color:${rule.triggered ? rule.color : 'var(--text-muted)'}">`
    html += rule.triggered ? '▶ ' : '▷ '
    html += rule.label
    if (rule.triggered) html += ` <span style="font-size:10px;background:${rule.color};color:#fff;border-radius:4px;padding:1px 6px;margin-left:4px;">命中</span>`
    html += '</div>'
    rule.checks.forEach(c => {
      html += `<div style="font-size:11px;padding:2px 0;display:flex;gap:6px;align-items:flex-start;">${tick(c.pass)}<span style="color:var(--text-secondary);word-break:break-all;flex:1;">${c.name}</span></div>`
    })
    if (rule.note) html += `<div style="font-size:11px;margin-top:6px;">${rule.note}</div>`
    html += '</div>'
  })
  const anyTriggered = rules.some(r => r.triggered)
  if (!anyTriggered) html += '<div style="font-size:11px;color:var(--text-muted);padding:8px 0;">以上所有规则均未命中 → 默认建议：观望，暂不操作</div>'
  html += '</div>'
  return html
}


</script>

<style scoped>
/* ══════ Panel ══════ */
.fd-panel {
  background: var(--bg-secondary);
  border-top: 2px solid var(--accent);
  padding: 14px 16px;
  animation: fdSlide 0.18s ease;
}
@keyframes fdSlide { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: translateY(0) } }

/* ══════ 回撤修复天数 ══════ */
.fd-recovery-row {
  display: flex;
  gap: 0;
  margin-bottom: 4px;
}
.fd-recovery-cell {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 6px;
}
.fd-recovery-cell:first-child { margin-right: 6px; }
.fd-recovery-label { display: block; font-size: 10px; color: var(--text-muted); line-height: 1.5; }
.fd-recovery-val { display: block; font-size: 13px; font-weight: 700; line-height: 1.6; }
.fd-recovery-val.profit { color: var(--profit); }
.fd-recovery-val.loss { color: var(--loss); }

/* ══════ 统计行（收益+最大+最小+回撤 一行） ══════ */
.fd-stats-row {
  display: flex;
  gap: 4px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 4px;
  flex-shrink: 0;
}
.fd-stat {
  flex: 1;
  text-align: center;
  min-width: 0;
}
.fd-stat-label {
  font-size: 10px;
  color: var(--text-muted);
  display: block;
  line-height: 1.4;
}
.fd-stat-val {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  display: block;
  line-height: 1.4;
}
.fd-stat-val.profit { color: var(--profit); }
.fd-stat-val.loss { color: var(--loss); }

/* ══════ 区间开关 ══════ */
.fd-range-toggle {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  user-select: none;
  padding: 2px 6px;
}
.fd-range-toggle-label {
  font-size: 11px;
  color: var(--text-muted);
}
.fd-toggle-switch {
  width: 28px;
  height: 16px;
  border-radius: 8px;
  background: rgba(255,255,255,0.12);
  position: relative;
  transition: background 0.2s;
}
.fd-toggle-switch.on {
  background: #6366f1;
}
.fd-toggle-knob {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: left 0.2s;
}
.fd-toggle-switch.on .fd-toggle-knob {
  left: 14px;
}

/* ══════ Main layout — 自适应比例 ══════ */
.fd-main {
  display: flex;
  align-items: stretch;
  gap: 0;
}
.fd-left {
  flex: 6;                /* 约60% */
  min-width: 0;
  padding-right: 1em;
  display: flex;
  flex-direction: column;
}
.fd-right {
  flex: 4;                /* 约40% */
  min-width: 0;
  border-left: 1px solid var(--border);
  padding-left: 1em;
}


/* ══════ Tabs ══════ */
.fd-tab-bar { display: flex; border-bottom: 1px solid var(--border); margin-bottom: 8px; flex-shrink: 0; gap: auto; }
.fd-tab {
  padding: 5px 14px; font-size: 12px; font-weight: 600; color: var(--text-muted);
  border: none; background: none; cursor: pointer;
  border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.15s;
}
.fd-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
/* ══════ Period Tabs ══════ */
.fd-period-tabs {
  display: flex;
  gap: 0;
  margin-top: 4px;
  margin-bottom: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  position: relative;
  z-index: 5;
  flex-shrink: 0;
}
.fd-period-tabs::-webkit-scrollbar { display: none; }
.fd-period-btn {
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  border: none;
  background: none;
  cursor: pointer;
  white-space: nowrap;
  border-radius: 4px;
  transition: all 0.15s;
}
.fd-period-btn:hover { color: var(--text-primary); background: rgba(255,255,255,0.06); }
.fd-period-btn.active {
  color: var(--accent);
  background: rgba(99, 102, 241, 0.15);
  font-weight: 600;
}

/* ══════ Data Type Tabs ══════ */
.fd-dtype-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 6px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 4px;
}
.fd-dtype-btn {
  padding: 3px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  border: none;
  background: none;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}
.fd-dtype-btn:hover { color: var(--text-primary); }
.fd-dtype-btn.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  font-weight: 600;
}

/* ══════ Chart — grows to fill left col ══════ */
.fd-chart-wrap {
  flex: 1 1 0%;
  min-height: 180px;
  position: relative;
}
.fd-chart {
  position: absolute;
  inset: 0;
}

/* ══════ 图表上的手柄 ══════ */
.fd-handle-on-chart {
  position: absolute;
  width: 2px;
  background: none;
  z-index: 10;
  cursor: ew-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translateX(-50%);
}
.fd-handle-on-chart::before {
  content: '';
  position: absolute;
  top: 0; bottom: 0; left: 0; right: 0;
  border-left: 1.5px dashed #6366f1;
  pointer-events: none;
  margin-left: -0.5px;
}
.fd-handle-pill {
  position: relative;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: var(--accent, #6366f1);
  color: #fff;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.5);
  cursor: ew-resize;
  user-select: none;
  z-index: 11;
}
.fd-handle-pill:hover {
  transform: scale(1.1);
}
.fd-handle-date {
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--accent, #6366f1);
  color: #fff;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  white-space: nowrap;
  pointer-events: none;
  line-height: 1.4;
}

/* ══════ Utility ══════ */
.fd-loading { display: flex; align-items: center; justify-content: center; padding: 14px 0; color: var(--text-muted); font-size: 12px; gap: 6px; }
.fd-empty { text-align: center; color: var(--text-muted); font-size: 12px; padding: 14px 0; }

/* ══════ Holdings header ══════ */
.fd-h-header {
  display: flex; align-items: center; font-size: 10px; color: var(--text-muted);
  padding-bottom: 8px; border-bottom: 1px solid var(--border); margin-bottom: 4px;
}
.fd-h-col-name { flex: 5; }
.fd-h-col-bar { flex: 4; text-align: right; }
.fd-h-col-chg { flex: 3; text-align: right; }

/* ══════ Holdings list ══════ */
.fd-hi-list { overflow-y: auto; }

/* ══════ Holdings item — generous spacing ══════ */
.fd-hi {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.fd-hi:last-child { border-bottom: none; }

.fd-hi-name { flex: 5; min-width: 0; }
.fd-hi-n {
  font-size: 13px; font-weight: 600; color: var(--text-primary);
  display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  line-height: 1.4;
}
.fd-hi-c { font-size: 10px; color: var(--text-muted); line-height: 1.4; }

/* ══════ Holdings bar ══════ */
.fd-hi-bar-wrap { flex: 4; display: flex; align-items: center; gap: 0.4em; }
.fd-hi-bar-track { flex: 1; height: 3px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; }
.fd-hi-bar-fill { height: 100%; background: var(--accent); border-radius: 2px; transition: width 0.35s; }
.fd-hi-pct { font-size: 10px; color: var(--text-muted); white-space: nowrap; text-align: right; flex-shrink: 0; }

/* ══════ Holdings change ══════ */
.fd-hi-chg { flex: 3; text-align: right; font-size: 12px; font-weight: 600; color: var(--text-muted); white-space: nowrap; }
.fd-hi-chg.profit { color: var(--profit); }
.fd-hi-chg.loss { color: var(--loss); }

/* ══════ 技术参考 ══════ */
.fd-tech {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}
.fd-tech-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}
.fd-tech-icon { font-size: 13px; }
.fd-tech-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.fd-tech-help {
  font-size: 14px;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.15s;
  user-select: none;
  line-height: 1;
}
.fd-tech-help:hover { opacity: 1; color: var(--accent); }
.fd-tech-days { margin-left: auto; font-size: 11px; color: var(--text-muted); }

.fd-tech-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
}
.fd-tech-cell {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.fd-tech-cell:nth-child(odd) { border-right: 1px solid rgba(255,255,255,0.04); }
.fd-tech-label { display: block; font-size: 10px; color: var(--text-muted); line-height: 1.5; }
.fd-tech-val { display: block; font-size: 15px; font-weight: 700; color: var(--text-primary); line-height: 1.6; }
.fd-tech-val.profit { color: var(--profit); }
.fd-tech-val.loss { color: var(--loss); }

/* 胜率进度条 */
.fd-tech-winrate {
  padding: 10px 12px 6px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.fd-tech-winrate-header {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
}
.fd-tech-bar-track {
  width: 100%;
  height: 6px;
  background: rgba(255,255,255,0.06);
  border-radius: 3px;
  overflow: hidden;
}
.fd-tech-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}
.fd-tech-winrate-val {
  text-align: right;
  font-size: 14px;
  font-weight: 700;
  margin-top: 4px;
}
.fd-tech-winrate-val.profit { color: var(--profit); }
.fd-tech-winrate-val.loss { color: var(--loss); }

/* 综合信号 */
.fd-tech-signal {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
}
.fd-tech-signal-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.fd-tech-signal.sig-buy { color: var(--profit); }
.fd-tech-signal.sig-buy .fd-tech-signal-dot { background: var(--profit); }
.fd-tech-signal.sig-sell { color: var(--loss); }
.fd-tech-signal.sig-sell .fd-tech-signal-dot { background: var(--loss); }
.fd-tech-signal.sig-hold { color: var(--text-muted); }
.fd-tech-signal.sig-hold .fd-tech-signal-dot { background: var(--text-muted); }

/* 指标说明弹窗 */
.fd-tech-help-content { display: flex; flex-direction: column; gap: 0; }
.fd-help-item {
  padding: 10px 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.fd-help-item:last-child { border-bottom: none; }
.fd-help-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}
.fd-help-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* ══════ 波段信号 ══════ */
.fd-band {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.fd-band-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 0;
}
.fd-band-cell {
  padding: 8px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  border-right: 1px solid rgba(255,255,255,0.04);
}
.fd-band-cell:nth-child(4n) { border-right: none; }
.fd-band-label { display: block; font-size: 10px; color: var(--text-muted); line-height: 1.5; }
.fd-band-val { display: block; font-size: 14px; font-weight: 700; color: var(--text-primary); line-height: 1.6; }
.fd-band-val.profit { color: var(--profit); }
.fd-band-val.loss { color: var(--loss); }
.fd-band-sub { display: block; font-size: 10px; color: var(--text-muted); line-height: 1.4; }

/* 多时间段回撤对比表 */
.fd-band-table-wrap {
  padding: 10px 0;
}
.fd-band-table-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  padding: 0 10px 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.fd-band-table-title::before {
  content: '';
  width: 3px;
  height: 12px;
  background: var(--accent);
  border-radius: 2px;
}
.fd-band-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.fd-band-table th {
  text-align: left;
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
  padding: 6px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.fd-band-table td {
  padding: 7px 10px;
  color: var(--text-primary);
  border-bottom: 1px solid rgba(255,255,255,0.03);
}
.fd-band-table tr:last-child td { border-bottom: none; }
.fd-band-table td.profit { color: var(--profit); font-weight: 600; }
.fd-band-table td.loss { color: var(--loss); font-weight: 600; }

/* 波段信号结论 */
.fd-band-signal {
  margin: 8px 0 4px;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid;
}
.fd-band-signal.zone-high {
  background: rgba(34, 196, 94, 0.08);
  border-color: rgba(34, 196, 94, 0.2);
}
.fd-band-signal.zone-low {
  background: rgba(240, 64, 64, 0.08);
  border-color: rgba(240, 64, 64, 0.2);
}
.fd-band-signal.zone-mid {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
}
.fd-band-signal-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.fd-band-zone-tag {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  line-height: 1.5;
}
.zone-high .fd-band-zone-tag { background: var(--loss); color: #fff; }
.zone-low .fd-band-zone-tag { background: var(--profit); color: #fff; }
.zone-mid .fd-band-zone-tag { background: var(--text-muted); color: #fff; }
.fd-band-zone-hint {
  font-size: 13px;
  font-weight: 600;
}
.zone-high .fd-band-zone-hint { color: var(--loss); }
.zone-low .fd-band-zone-hint { color: var(--profit); }
.zone-mid .fd-band-zone-hint { color: var(--text-muted); }
.fd-band-advice {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.7;
}

/* ══════ 操作建议区块（复用波段信号样式，仅补充外层容器） ══════ */
.fd-suggest {
  margin-top: 16px;
}
.fd-suggest-disclaimer {
  margin-top: 10px;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.5;
}
</style>
