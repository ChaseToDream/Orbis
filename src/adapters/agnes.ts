/**
 * Agnes Image 2.1 Flash 图像生成适配器
 *
 * 该适配器面向 Sapiens AI 的 Agnes Image 2.1 Flash 模型，API 端点兼容 OpenAI 格式，
 * 但存在一些关键差异：
 *
 * - 文生图与图生图均使用 POST /v1/images/generations 端点（无独立的 /v1/images/edits）
 * - response_format 必须放在 extra_body 内部，不能放在顶层
 * - 文生图 Base64 输出使用顶层参数 return_base64: true
 * - 图生图输入图像放在 extra_body.image 数组中
 * - 图生图 Base64 输出使用 extra_body.response_format: "b64_json"
 *
 * 配置项（ApiProviderConfig）：
 * - apiKey：Bearer 认证密钥（必填）
 * - baseUrl：API 基础地址，默认 https://apihub.agnes-ai.com
 * - model：模型标识，默认 agnes-image-2.1-flash
 * - timeout：请求超时（毫秒），默认 60000（Agnes 生成较慢，建议更长超时）
 *
 * 不支持 negative prompt、steps、cfg_scale、seed。
 * 单次仅生成 1 张图片（maxCount = 1）。
 */
import type {
  ApiProviderConfig,
  GenerateRequest,
  GenerateResult,
} from '../types'
import type { ImageProvider } from './types'
import { ProviderError } from './types'

const DEFAULT_BASE_URL = 'https://apihub.agnes-ai.com'
const DEFAULT_MODEL = 'agnes-image-2.1-flash'
const DEFAULT_TIMEOUT_MS = 60000

/** Agnes Image 2.1 Flash 支持的尺寸预设 */
const SIZE_PRESETS = [
  { width: 1024, height: 1024 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 1024, height: 1792 },
  { width: 1792, height: 1024 },
]

/**
 * 从配置中解析生效的请求超时毫秒数。
 */
function resolveTimeout(config: ApiProviderConfig): number {
  const raw = config.timeout
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_TIMEOUT_MS
  }
  return Math.max(1000, Math.min(600000, Math.round(raw)))
}

/**
 * 带超时的 fetch：超时或网络错误统一抛出 ProviderError。
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ProviderError(
        `请求超时（${timeoutMs}ms）`,
        'agnes',
        undefined,
        err,
      )
    }
    throw new ProviderError(
      err instanceof Error ? err.message : '网络请求失败',
      'agnes',
      undefined,
      err,
    )
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 解析错误响应，提取可读 message。
 */
async function parseError(
  res: Response,
): Promise<{ message: string; raw: unknown }> {
  let raw: unknown
  let message = `HTTP ${res.status} ${res.statusText}`
  try {
    const text = await res.text()
    if (text) {
      try {
        raw = JSON.parse(text)
        const maybe = raw as {
          error?: { message?: string }
          message?: string
        }
        if (maybe.error?.message) {
          message = maybe.error.message
        } else if (maybe.message) {
          message = maybe.message
        }
      } catch {
        raw = text
        message = text
      }
    }
  } catch {
    message = `HTTP ${res.status} (无法读取响应体)`
  }
  return { message, raw }
}

/** Agnes Images API 响应结构 */
interface AgnesImagesResponse {
  data?: Array<{
    b64_json?: string | null
    url?: string | null
  }>
}

/**
 * 校验并解析响应，提取首张图片 data URL。
 */
async function parseImageResponse(
  res: Response,
  width: number,
  height: number,
): Promise<GenerateResult> {
  const json = (await res.json()) as AgnesImagesResponse
  const item = json.data?.[0]
  if (!item) {
    throw new ProviderError('API 返回为空', 'agnes', res.status, json)
  }
  const url = item.b64_json
    ? `data:image/png;base64,${item.b64_json}`
    : item.url || ''
  return {
    images: [{ url, width, height }],
    provider: 'agnes',
    raw: json,
  }
}

/** Agnes Image 2.1 Flash 适配器实例 */
export const agnesProvider: ImageProvider = {
  id: 'agnes',
  displayName: 'Agnes Image 2.1 Flash',
  paramMeta: {
    supportsNegativePrompt: false,
    supportsSteps: false,
    supportsCfgScale: false,
    supportsSeed: false,
    supportsImg2Img: true,
    supportsCustomSize: true,
    sizePresets: SIZE_PRESETS,
    maxCount: 1,
  },

  async generate(
    request: GenerateRequest,
    config: ApiProviderConfig,
  ): Promise<GenerateResult> {
    const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '')
    const apiKey = config.apiKey
    const timeoutMs = resolveTimeout(config)

    if (!apiKey || apiKey.trim().length === 0) {
      throw new ProviderError('API Key 未配置', 'agnes')
    }

    const sizeStr = `${request.size.width}x${request.size.height}`
    const model = config.model || DEFAULT_MODEL

    if (request.mode === 'img2img') {
      // 图生图：使用 images/generations 端点，图片放在 extra_body.image 中
      if (!request.referenceImage) {
        throw new ProviderError('图生图模式缺少参考图', 'agnes')
      }

      const body: Record<string, unknown> = {
        model,
        prompt: request.prompt,
        size: sizeStr,
        extra_body: {
          image: [request.referenceImage],
          response_format: 'b64_json',
        },
      }

      const res = await fetchWithTimeout(
        `${baseUrl}/v1/images/generations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        },
        timeoutMs,
      )

      if (!res.ok) {
        const err = await parseError(res)
        throw new ProviderError(err.message, 'agnes', res.status, err.raw)
      }

      return parseImageResponse(res, request.size.width, request.size.height)
    }

    // 文生图：使用 return_base64 获取 Base64 输出
    const body: Record<string, unknown> = {
      model,
      prompt: request.prompt,
      size: sizeStr,
      return_base64: true,
      extra_body: {
        response_format: 'b64_json',
      },
    }

    const res = await fetchWithTimeout(
      `${baseUrl}/v1/images/generations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      },
      timeoutMs,
    )

    if (!res.ok) {
      const err = await parseError(res)
      throw new ProviderError(err.message, 'agnes', res.status, err.raw)
    }

    return parseImageResponse(res, request.size.width, request.size.height)
  },

  validateConfig(config: ApiProviderConfig): {
    valid: boolean
    message?: string
  } {
    if (!config.apiKey || config.apiKey.trim().length === 0) {
      return { valid: false, message: 'API Key 未配置' }
    }
    return { valid: true }
  },
}

/**
 * 连接测试：调用 /v1/models 端点验证认证与连通性。
 */
export async function testConnection(
  config: ApiProviderConfig,
): Promise<{ ok: boolean; message: string }> {
  const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '')
  const apiKey = config.apiKey
  const timeoutMs = resolveTimeout(config)

  if (!apiKey || apiKey.trim().length === 0) {
    return { ok: false, message: 'API Key 未配置，无法测试连接' }
  }

  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/v1/models`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      },
      timeoutMs,
    )
    if (res.ok) {
      return { ok: true, message: '连接成功，API 服务响应正常' }
    }
    const err = await parseError(res)
    if (res.status === 401) {
      return {
        ok: false,
        message: `认证失败（401）：API Key 错误或已失效。${err.message}`,
      }
    }
    if (res.status === 403) {
      return {
        ok: false,
        message: `禁止访问（403）：API Key 无权限或被限制。${err.message}`,
      }
    }
    if (res.status === 404) {
      return {
        ok: false,
        message: `端点不存在（404）：请检查 Base URL 是否正确。${err.message}`,
      }
    }
    return {
      ok: false,
      message: `请求失败（${res.status}）：${err.message}`,
    }
  } catch (err) {
    if (err instanceof ProviderError) {
      return { ok: false, message: err.message }
    }
    return {
      ok: false,
      message: err instanceof Error ? err.message : '连接测试失败',
    }
  }
}