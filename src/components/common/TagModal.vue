<template>
  <BaseModal v-model="open" title="管理标签">
    <!-- 当前标签 pills -->
    <div class="tags-display">
      <span v-if="localTags.length === 0" class="tags-empty">暂无标签，在下方输入添加</span>
      <span
        v-for="t in localTags"
        :key="t"
        class="tag-pill"
      >
        {{ t }}
        <button class="tag-remove-btn" @click="removeTag(t)" title="删除">×</button>
      </span>
    </div>

    <!-- 添加新标签 -->
    <div class="add-tag-row">
      <input
        ref="input"
        v-model="newTag"
        type="text"
        maxlength="10"
        placeholder="输入标签，如：指数、混合、科技板块"
        @keyup.enter="addTag"
      />
      <button class="btn btn-primary" style="flex-shrink:0;" @click="addTag">添加</button>
    </div>
    <p v-if="addError" style="color:var(--profit);font-size:12px;margin-top:4px;">{{ addError }}</p>

    <template #footer>
      <button class="btn btn-cancel-modal" @click="open = false">取消</button>
      <button class="btn btn-primary" @click="confirm">确认</button>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue'
import BaseModal from './BaseModal.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  initialTags: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue', 'confirm'])

const open = ref(props.modelValue)
const localTags = ref([...props.initialTags])
const newTag = ref('')
const addError = ref('')
const input = ref(null)

watch(() => props.modelValue, v => {
  open.value = v
  if (v) {
    localTags.value = [...props.initialTags]
    newTag.value = ''
    addError.value = ''
    nextTick(() => input.value?.focus())
  }
})
watch(open, v => emit('update:modelValue', v))

function addTag() {
  addError.value = ''
  const t = newTag.value.trim()
  if (!t) return
  if (localTags.value.includes(t)) {
    addError.value = '该标签已存在'
    return
  }
  localTags.value.push(t)
  newTag.value = ''
}

function removeTag(t) {
  localTags.value = localTags.value.filter(x => x !== t)
}

function confirm() {
  emit('confirm', [...localTags.value])
  open.value = false
}
</script>

<style scoped>
.tags-display {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 36px;
  padding: 8px 0 12px;
}
.tags-empty {
  color: var(--text-muted);
  font-size: 13px;
  line-height: 28px;
}
.tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(124, 97, 255, 0.18);
  color: #a78bfa;
  border: 1px solid rgba(124, 97, 255, 0.35);
}
.tag-remove-btn {
  background: none;
  border: none;
  color: #a78bfa;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
  padding: 0;
  opacity: 0.7;
  transition: opacity 0.12s;
}
.tag-remove-btn:hover { opacity: 1; }
.add-tag-row {
  display: flex;
  gap: 8px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}
.add-tag-row input { flex: 1; min-width: 0; }
</style>
