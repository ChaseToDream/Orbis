/**
 * API 适配层 (Adapters)
 *
 * 注册并导出图像生成 API 提供商的适配器。
 * 业务层通过统一的 ImageProvider 接口与 getProvider(id) 访问适配器，
 * 无需关心底层各提供商的请求/响应差异。
 *
 * 当前注册：
 * - openai: OpenAI 兼容图像生成接口（/v1/images/generations、/v1/images/edits）
 * - agnes:  Agnes Image 2.1 Flash（Sapiens AI 图像生成模型）
 */
import type { ProviderId } from '../types'
import type { ImageProvider } from './types'
import { openaiProvider } from './openai'
import { agnesProvider } from './agnes'

// 重新导出适配器、接口与错误类型，便于上层统一从 'adapters' 入口引用
export type { ImageProvider } from './types'
export { ProviderError } from './types'
export { openaiProvider, testConnection as openaiTestConnection } from './openai'
export { agnesProvider, testConnection as agnesTestConnection } from './agnes'

// 保留旧的 testConnection 导出以兼容现有代码（默认使用 openai 的连接测试）
export { testConnection as testConnection } from './openai'

/**
 * 全部适配器注册表。
 *
 * 以 ProviderId 为键映射到对应 ImageProvider 实例。
 * 新增提供商时在此处注册即可。
 */
export const providers: Record<ProviderId, ImageProvider> = {
  openai: openaiProvider,
  agnes: agnesProvider,
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
 * 若传入的 ID 未在注册表中找到，回退到 openai 适配器。
 *
 * @param id - 提供商标识
 * @returns 对应的 ImageProvider 实例
 */
export function getProvider(id: ProviderId): ImageProvider {
  return providers[id] ?? providers.openai
}
