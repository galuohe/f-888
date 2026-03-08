/**
 * 市场全景 API
 */
const BASE_URL = 'https://baiyefundwork.preview.aliyun-zeabur.cn/api'

export async function fetchMarketOverview() {
  const res = await fetch(`${BASE_URL}/market/overview?_t=${Date.now()}`)
  if (!res.ok) throw new Error('请求失败: ' + res.status)
  return res.json()
}
