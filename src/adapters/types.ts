/**
 * 适配器接口与统一错误类型 (Adapter Types)
 *
 * 定义所有图像生成 API 提供商适配器需实现的 ImageProvider 接口，
 * 以及统一的错误类型 ProviderError。
 *
 * 注意：因 tsconfig 启用 `erasableSyntaxOnly`，禁止使用构造函数参数属性
 * （parameter properties），故 ProviderError 使用显式字段声明。
 */
import type {
  ApiProviderConfig,
  GenerateRequest,
  GenerateResult,
  ProviderId,
  ProviderParamMeta,
} from '../types'

/**
 * 图像生成提供商适配器接口。
 *
 * 每个适配器负责将统一的 GenerateRequest 转换为对应提供商的 API 调用，
 * 并将返回结果归一化为 GenerateResult。
 */
export interface ImageProvider {
  /** 提供商标识 */
  readonly id: ProviderId
  /** 展示名称 */
  readonly displayName: string
  /** 参数能力元信息，供 UI 层据此渲染表单 */
  readonly paramMeta: ProviderParamMeta
  /** 执行图像生成 */
  generate(
    request: GenerateRequest,
    config: ApiProviderConfig,
  ): Promise<GenerateResult>
  /** 校验配置是否可用 */
  validateConfig(config: ApiProviderConfig): {
    valid: boolean
    message?: string
  }
}

/**
 * 适配器统一错误类型。
 *
 * 所有适配器在调用 API 失败时均应抛出此错误，
 * 便于上层根据 provider、statusCode 进行统一处理与提示。
 */
export class ProviderError extends Error {
  public readonly provider: ProviderId
  public readonly statusCode?: number
  public readonly raw?: unknown

  constructor(
    message: string,
    provider: ProviderId,
    statusCode?: number,
    raw?: unknown,
  ) {
    super(message)
    this.name = 'ProviderError'
    this.provider = provider
    this.statusCode = statusCode
    this.raw = raw
  }
}
