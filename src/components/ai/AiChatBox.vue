<template>
  <!-- Chat panel -->
  <div class="ai-chat-box" :class="{ open: isOpen }">

    <!-- Header -->
    <div class="ai-chat-header">
      <div>
        <div class="ai-chat-header-title">💬 AI 基金助手</div>
        <div class="ai-chat-header-sub">DeepSeek · 专业基金分析</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;">
        <button class="ai-chat-header-btn" @click="clearHistory" title="清空对话">清空</button>
        <button class="ai-chat-header-btn" @click="openKeyModal" title="设置 API Key">Key</button>
        <button class="ai-chat-header-btn" @click="close" title="关闭">✕</button>
      </div>
    </div>

    <!-- Message list -->
    <div class="ai-chat-messages" ref="messagesEl">
      <!-- Empty state -->
      <div v-if="history.length === 0" style="text-align:center;padding:28px 0;color:var(--text-muted);font-size:12px;line-height:1.8;">
        👋 你好！我是你的 AI 基金助手<br>可以问我持仓分析、加减仓建议、板块行情等问题
      </div>

      <!-- History messages -->
      <template v-for="(msg, idx) in history" :key="idx">
        <div class="ai-msg" :class="msg.role === 'user' ? 'user' : 'bot'">
          <div class="ai-msg-avatar">{{ msg.role === 'user' ? '👤' : '🤖' }}</div>
          <div class="ai-msg-bubble" v-html="msg.role === 'user' ? escHtml(msg.content) : renderMarkdown(msg.content)"></div>
        </div>
      </template>

      <!-- Streaming / typing indicator -->
      <div v-if="isStreaming" class="ai-msg bot">
        <div class="ai-msg-avatar">🤖</div>
        <div class="ai-msg-bubble">
          <span v-if="streamingContent" v-html="renderMarkdown(streamingContent) + '<span style=\'opacity:.5;\'>▍</span>'"></span>
          <div v-else class="ai-typing"><span></span><span></span><span></span></div>
        </div>
      </div>
    </div>

    <!-- Quick questions -->
    <div class="ai-quick-btns">
      <button
        v-for="q in quickQuestions"
        :key="q"
        class="ai-quick-btn"
        :disabled="isStreaming"
        @click="sendQuick(q)"
      >{{ q }}</button>
    </div>

    <!-- Input row -->
    <div class="ai-chat-input-row">
      <textarea
        ref="inputEl"
        class="ai-chat-input"
        v-model="inputText"
        :disabled="isStreaming"
        placeholder="输入问题… (Enter 发送，Shift+Enter 换行)"
        rows="1"
        @input="resizeInput"
        @keydown="handleKeydown"
      ></textarea>
      <button
        class="ai-send-btn"
        :disabled="isStreaming || !inputText.trim()"
        @click="sendMessage"
      >发送</button>
    </div>

    <!-- API Key modal -->
    <div v-if="keyModalOpen" class="ai-key-modal" @click.self="closeKeyModal">
      <div class="ai-key-box">
        <div style="font-weight:600;margin-bottom:12px;">设置 DeepSeek API Key</div>
        <input
          ref="keyInputEl"
          class="ai-key-input"
          v-model="keyInputValue"
          type="password"
          placeholder="sk-..."
          @keydown.enter="saveKey"
        />
        <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;">
          <button class="ai-chat-header-btn" @click="closeKeyModal">取消</button>
          <button class="ai-chat-header-btn" @click="saveKey">保存</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useAiChat } from '@/composables/useAiChat'
import { useFundStore } from '@/stores/fundStore'

// ── Constants ─────────────────────────────────────────────────────────────────
const LS_KEY   = 'deepseek_api_key'
const LS_HIST  = 'ai_chat_history'
const API_URL  = 'https://api.deepseek.com/chat/completions'
const MODEL    = 'deepseek-chat'
const MAX_HIST = 20

const quickQuestions = [
  '今日持仓表现怎么样？',
  '哪些基金可以考虑加仓？',
  '帮我分析目前亏损的基金',
  '今日哪个板块表现最好？',
]

// ── Shared state ──────────────────────────────────────────────────────────────
const { isOpen, close, incrementUnread } = useAiChat()
const fundStore = useFundStore()

// ── Local state ───────────────────────────────────────────────────────────────
const history         = ref([])   // { role: 'user'|'assistant', content: string }[]
const isStreaming      = ref(false)
const streamingContent = ref('')
const inputText        = ref('')

const messagesEl  = ref(null)
const inputEl     = ref(null)

// Key modal
const keyModalOpen  = ref(false)
const keyInputValue = ref('')
const keyInputEl    = ref(null)

// ── Persistence ───────────────────────────────────────────────────────────────
function loadHistory() {
  try {
    const s = localStorage.getItem(LS_HIST)
    if (s) history.value = JSON.parse(s)
  } catch (_) {
    history.value = []
  }
}

function saveHistory() {
  try {
    localStorage.setItem(LS_HIST, JSON.stringify(history.value.slice(-MAX_HIST)))
  } catch (_) {}
}

function clearHistory() {
  history.value = []
  localStorage.removeItem(LS_HIST)
}

loadHistory()

// ── API Key ───────────────────────────────────────────────────────────────────
function getKey() {
  return localStorage.getItem(LS_KEY) || ''
}

function openKeyModal() {
  keyInputValue.value = getKey()
  keyModalOpen.value  = true
  nextTick(() => keyInputEl.value?.focus())
}

function closeKeyModal() {
  keyModalOpen.value = false
}

function saveKey() {
  const val = keyInputValue.value.trim()
  if (!val) {
    alert('请输入有效的 API Key')
    return
  }
  localStorage.setItem(LS_KEY, val)
  keyModalOpen.value = false
}

// ── System prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt() {
  const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })

  // Holdings summary
  let holdingText = '（暂无持仓数据）'
  try {
    const fundsArr = fundStore.funds
    if (fundsArr && fundsArr.length > 0) {
      holdingText = fundsArr.map(f => {
        const nav      = f.navConfirmed ? f.confirmedNav : (f.gsz || f.prevNav)
        const costNav  = (f.costBasisLocked && f.costBasis > 0) ? f.costBasis : (f.costNav || f.prevNav)
        const shares   = f.holdingShares > 0 ? f.holdingShares : (costNav && f.amount ? f.amount / costNav : 0)
        const principal = shares * (costNav || 0)
        const valueNow  = shares * (nav || 0)
        const rTotal    = principal > 0 ? ((valueNow - principal) / principal * 100) : 0
        const rToday    = f.gszzl != null ? f.gszzl : 0
        return `【${f.name || f.code}（${f.code}）】持仓金额¥${valueNow.toFixed(0)}，今日${rToday >= 0 ? '+' : ''}${rToday.toFixed(2)}%，累计${rTotal >= 0 ? '+' : ''}${rTotal.toFixed(2)}%`
      }).join('\n')
    }
  } catch (_) {}

  // Sector summary — uses window._mrCache set by MarketRankView
  let sectorText = '（暂无行情数据）'
  try {
    const cache = window._mrCache
    if (cache && cache.length > 0) {
      const sectorMap = {}
      cache.forEach(r => {
        if (!r.sector || r.ret == null || isNaN(r.ret)) return
        if (!sectorMap[r.sector]) sectorMap[r.sector] = []
        sectorMap[r.sector].push(r.ret)
      })
      const sectors = Object.entries(sectorMap)
        .map(([name, rets]) => ({ name, avg: rets.reduce((s, v) => s + v, 0) / rets.length }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 6)
      if (sectors.length > 0) {
        sectorText = sectors.map(s => `${s.name}（${s.avg >= 0 ? '+' : ''}${s.avg.toFixed(2)}%）`).join('、')
      }
    }
  } catch (_) {}

  return `你是一名专业的基金投资助手，服务于普通个人投资者。
今天日期：${today}

## 用户当前持仓
${holdingText}

## 今日板块行情（按涨跌幅降序，前6名）
${sectorText}

## 回答要求
- 用简洁、通俗的中文回答，避免大段废话
- 给出具体可操作的建议（买入比例、金额或操作时机）
- 数据分析要结合上方持仓和行情实际数据
- 提示投资有风险，建议不构成专业意见`
}

// ── Markdown & HTML helpers ───────────────────────────────────────────────────
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderMarkdown(text) {
  return escHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 4px;border-radius:3px;font-size:12px;">$1</code>')
    .replace(/^#{1,3}\s+(.+)$/gm, '<strong style="display:block;margin-top:6px;">$1</strong>')
    .replace(/\n/g, '<br>')
}

// ── Scroll ────────────────────────────────────────────────────────────────────
function scrollToBottom() {
  nextTick(() => {
    if (messagesEl.value) {
      messagesEl.value.scrollTop = messagesEl.value.scrollHeight
    }
  })
}

// ── Input resize ──────────────────────────────────────────────────────────────
function resizeInput() {
  if (!inputEl.value) return
  inputEl.value.style.height = 'auto'
  inputEl.value.style.height = Math.min(inputEl.value.scrollHeight, 80) + 'px'
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

// ── Send ──────────────────────────────────────────────────────────────────────
async function sendMessage() {
  if (isStreaming.value) return
  const text = inputText.value.trim()
  if (!text) return

  const key = getKey()
  if (!key) {
    openKeyModal()
    return
  }

  inputText.value = ''
  nextTick(resizeInput)

  history.value.push({ role: 'user', content: text })
  scrollToBottom()

  isStreaming.value    = true
  streamingContent.value = ''

  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    ...history.value.slice(-MAX_HIST),
  ]

  let fullReply = ''
  try {
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: true,
        temperature: 0.6,
        max_tokens: 1024,
      }),
    })

    if (!resp.ok) {
      const errText = await resp.text()
      let errMsg = `API 错误 ${resp.status}`
      try {
        const j = JSON.parse(errText)
        errMsg = j.error?.message || errMsg
      } catch (_) {}
      throw new Error(errMsg)
    }

    // SSE streaming read
    const reader  = resp.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() // keep incomplete line
      for (const line of lines) {
        const s = line.trim()
        if (!s || s === 'data: [DONE]') continue
        if (!s.startsWith('data: ')) continue
        try {
          const chunk = JSON.parse(s.slice(6))
          const delta = chunk.choices?.[0]?.delta?.content
          if (delta) {
            fullReply += delta
            streamingContent.value = fullReply
            scrollToBottom()
          }
        } catch (_) {}
      }
    }

    if (!fullReply) fullReply = '（未收到回复，请重试）'

    history.value.push({ role: 'assistant', content: fullReply })
    saveHistory()
    incrementUnread()

  } catch (err) {
    // Remove the user message that was just pushed (request failed, treat as unsent)
    history.value.pop()
    const errContent = `❌ 请求失败：${err.message}\n\n请检查 API Key 是否正确，或网络是否可访问 DeepSeek。`
    history.value.push({ role: 'assistant', content: errContent })
  } finally {
    isStreaming.value     = false
    streamingContent.value = ''
    scrollToBottom()
  }
}

function sendQuick(text) {
  inputText.value = text
  sendMessage()
}

// ── Focus input when opened ───────────────────────────────────────────────────
watch(isOpen, (val) => {
  if (val) {
    nextTick(() => {
      inputEl.value?.focus()
      scrollToBottom()
    })
  }
})
</script>
