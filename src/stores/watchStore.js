import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  loadWatchlist, saveWatchlist as saveToStorage,
  loadWatchGroups, saveWatchGroups as saveGroupsToStorage
} from '@/utils/storage'
import { useAuthStore } from './authStore'

export const useWatchStore = defineStore('watch', () => {
  const watchlist = ref([])
  const sortDesc = ref(true)
  const groups = ref([])  // 自选分组名列表

  function load() {
    watchlist.value = loadWatchlist()
    groups.value = loadWatchGroups()
    // 将各基金 groups 中已有的分组名补入 groups 列表（兼容迁移）
    let dirty = false
    watchlist.value.forEach(w => {
      (w.groups || []).forEach(g => {
        if (g && !groups.value.includes(g)) { groups.value.push(g); dirty = true }
      })
    })
    if (dirty) saveGroupsToStorage(groups.value)
  }

  function save() {
    const data = saveToStorage(watchlist.value)
    const authStore = useAuthStore()
    authStore.sbSave({ watchlist: data, watch_groups: groups.value })
  }

  function saveGroups() {
    saveGroupsToStorage(groups.value)
    const authStore = useAuthStore()
    authStore.sbSave({ watch_groups: groups.value })
  }

  function addGroup(name) {
    const n = name.trim()
    if (!n || groups.value.includes(n)) return false
    groups.value.push(n)
    saveGroups()
    return true
  }

  function removeGroup(name) {
    groups.value = groups.value.filter(g => g !== name)
    // 同步从所有基金的 groups 中移除
    watchlist.value.forEach(w => {
      w.groups = (w.groups || []).filter(g => g !== name)
    })
    save()
    saveGroups()
  }

  /** 给基金设置分组归属（覆盖） */
  function setFundGroups(code, groupList) {
    const w = watchlist.value.find(w => w.code === code)
    if (w) {
      w.groups = groupList
      save()
    }
  }

  function addWatch({ code, name, tags }) {
    if (watchlist.value.some(w => w.code === code)) return false
    watchlist.value.push({
      code, name: name || code,
      tags: Array.isArray(tags) ? tags : [],  // 多标签数组
      groups: [],                              // 分组归属
      prevNav: null, gsz: null, gszzl: null,
      gztime: null, jzrq: null,
      confirmedNav: null, navConfirmed: false, confirmedDate: null,
      loading: false, error: false
    })
    save()
    return true
  }

  function removeWatch(code) {
    watchlist.value = watchlist.value.filter(w => w.code !== code)
    save()
  }

  function updateWatch(code, patch) {
    const w = watchlist.value.find(w => w.code === code)
    if (w) Object.assign(w, patch)
  }

  function setSortDesc(desc) {
    sortDesc.value = desc
  }

  return {
    watchlist, sortDesc, groups,
    load, save, saveGroups, addGroup, removeGroup,
    setFundGroups, addWatch, removeWatch, updateWatch, setSortDesc
  }
})
