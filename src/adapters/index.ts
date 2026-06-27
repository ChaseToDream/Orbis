/**
 * API 适配层 (Adapters)
 *
 * 注册并导出所有图像生成 API 提供商的适配器。
 * 业务层通过统一的 ImageProvider 接口与 getProvider(id) 访问适配器，
 * 无需关心底层各提供商的请求/响应差异。
 *
 * 当前注册：
 * - dalle: OpenAI DALL-E（文生图 + 图生图）
 * - stability: Stability AI Stable Diffusion v1-6（文生图 + 图生图）
 */
import type { ProviderId } from '../types'
import type { ImageProvider } from './types'
import { dalleProvider } from './dalle'
import { stabilityProvider } from './stability'

// 重新导出适配器、接口与错误类型，便于上层统一从 'adapters' 入口引用
export type { ImageProvider } from './types'
export { ProviderError } from './types'
export { dalleProvider } from './dalle'
export { stabilityProvider } from './stability'

/**
 * 全部适配器注册表。
 *
 * 以 ProviderId 为键映射到对应 ImageProvider 实例。
 * 新增提供商时在此处注册即可。
 */
export const providers: Record<ProviderId, ImageProvider> = {
  dalle: dalleProvider,
  stability: stabilityProvider,
}

/**
 * 所有受支持的提供商 ID 列表。
 *
 * 派生自 providers 注册表，保持与注册表同步。
 */
export const providerIds: ProviderId[] = Object.keys(providers) as ProviderId[]

/**
 * 按提供商 ID 获取适配器实例。
 *
 * @param id - 提供商标识
 * @returns 对应的 ImageProvider 实例
 */
export function getProvider(id: ProviderId): ImageProvider {
  return providers[id]
}
