/**
 * 市场全景 API
 * 开发环境走 Vite proxy；生产环境通过 corsproxy.io 绕过 CORS
 */
const ORIGIN = 'https://baiyefundwork.preview.aliyun-zeabur.cn/api/market'

function buildUrl(path) {
  const target = `${ORIGIN}${path}?_t=${Date.now()}`
  if (import.meta.env.DEV) {
    return `/api-market/market${path}?_t=${Date.now()}`
  }
  return `https://corsproxy.io/?${encodeURIComponent(target)}`
}

export async function fetchMarketOverview() {
  const res = await fetch(buildUrl('/overview'))
  if (!res.ok) throw new Error('请求失败: ' + res.status)
  return res.json()
}
