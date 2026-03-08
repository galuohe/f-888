/**
 * 市场全景 API
 * 开发环境走 Vite proxy（/api-market → https://baiyefundwork.preview.aliyun-zeabur.cn/api）
 * 生产环境直接请求（需后端配置 CORS Allow-Origin）
 */
const BASE_URL = import.meta.env.DEV
  ? '/api-market/market'
  : 'https://baiyefundwork.preview.aliyun-zeabur.cn/api/market'

export async function fetchMarketOverview() {
  const res = await fetch(`${BASE_URL}/overview?_t=${Date.now()}`)
  if (!res.ok) throw new Error('请求失败: ' + res.status)
  return res.json()
}
