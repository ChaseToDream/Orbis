/**
 * OpenAI 兼容图像生成适配器
 *
 * 该适配器面向任意兼容 OpenAI 标准 API 接口格式的图像生成服务，包括但不限于
 * OpenAI 官方接口（DALL·E）以及各类提供 OpenAI 兼容 /v1/images/generations
 * 端点的反代或第三方服务。
 *
 * 支持的 OpenAI 标准接口：
 * - 文生图：POST /v1/images/generations
 * - 图生图：POST /v1/images/edits
 * - 连接测试：GET /v1/models（testConnection 使用，用于验证认证与连通性）
 *
 * 配置项（ApiProviderConfig）：
 * - apiKey：Bearer 认证密钥（必填）
 * - baseUrl：API 基础地址，默认 https://api.openai.com，可指向自建反代
 * - model：模型标识，默认 dall-e-3
 * - timeout：请求超时（毫秒），默认 30000，可通过设置面板配置
 *
 * 不支持 negative prompt、steps、cfg_scale、seed。
 * 单次仅生成 1 张图片（maxCount = 1）。
 *
 * 错误处理：非 2xx 响应、网络异常、超时均抛出 ProviderError。
 * 超时通过 AbortController 实现，超时时长取自 config.timeout。
 */
import type {
  ApiProviderConfig,
  GenerateRequest,
  GenerateResult,
} from '../types'
import type { ImageProvider } from './types'
import { ProviderError } from './types'

const DEFAULT_BASE_URL = 'https://api.openai.com'
const DEFAULT_MODEL = 'dall-e-3'
const DEFAULT_TIMEOUT_MS = 30000

/** OpenAI 兼容服务支持的尺寸预设 */
const SIZE_PRESETS = [
  { width: 1024, height: 1024 },
  { width: 1024, height: 1792 },
  { width: 1792, height: 1024 },
]

/**
 * 从配置中解析生效的请求超时毫秒数。
 *
 * 非有限数值或非正数时回退到默认值，并钳制到 [1000, 300000] 区间，
 * 避免过短导致误超时或过长导致长时间挂起。
 *
 * @param config - 提供商配置
 * @returns 生效超时毫秒数
 */
function resolveTimeout(config: ApiProviderConfig): number {
  const raw = config.timeout
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_TIMEOUT_MS
  }
  return Math.max(1000, Math.min(300000, Math.round(raw)))
}

/**
 * 将 base64 字符串（可含 data URL 前缀）转为 PNG Blob，
 * 用于 multipart/form-data 上传（图生图模式）。
 *
 * @param base64 - 原始 base64 或 data URL
 * @returns PNG Blob
 */
function base64ToBlob(base64: string): Blob {
  const cleaned = base64.replace(/^data:[^;]+;base64,/, '')
  const binary = atob(cleaned)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: 'image/png' })
}

/**
 * 带超时的 fetch：超时或网络错误统一抛出 ProviderError。
 *
 * @param url - 请求地址
 * @param init - fetch 初始化参数
 * @param timeoutMs - 超时毫秒
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
        'openai',
        undefined,
        err,
      )
    }
    throw new ProviderError(
      err instanceof Error ? err.message : '网络请求失败',
      'openai',
      undefined,
      err,
    )
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 解析 OpenAI 错误响应，提取可读 message。
 *
 * OpenAI 错误响应格式通常为 `{ error: { message, type, code } }`，
 * 也可能为纯文本或其它 JSON 结构。
 *
 * @param res - 原始 Response 对象
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

/** OpenAI Images API 响应结构 */
interface OpenAIImagesResponse {
  data?: Array<{
    b64_json?: string
    url?: string
  }>
}

/**
 * 校验并解析响应，提取首张图片 data URL。
 *
 * @param res - 成功的 Response
 * @param width - 期望输出宽度
 * @param height - 期望输出高度
 */
async function parseImageResponse(
  res: Response,
  width: number,
  height: number,
): Promise<GenerateResult> {
  const json = (await res.json()) as OpenAIImagesResponse
  const item = json.data?.[0]
  if (!item) {
    throw new ProviderError('API 返回为空', 'openai', res.status, json)
  }
  const url = item.b64_json
    ? `data:image/png;base64,${item.b64_json}`
    : item.url || ''
  return {
    images: [{ url, width, height }],
    provider: 'openai',
    raw: json,
  }
}

/** OpenAI 兼容图像生成适配器实例 */
export const openaiProvider: ImageProvider = {
  id: 'openai',
  displayName: 'OpenAI 兼容',
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
      throw new ProviderError('API Key 未配置', 'openai')
    }

    const sizeStr = `${request.size.width}x${request.size.height}`

    if (request.mode === 'img2img') {
      // 图生图: images/edits 端点
      if (!request.referenceImage) {
        throw new ProviderError('图生图模式缺少参考图', 'openai')
      }
      const model = config.model || 'dall-e-2'
      const form = new FormData()
      form.append('image', base64ToBlob(request.referenceImage), 'image.png')
      form.append('prompt', request.prompt)
      form.append('model', model)
      form.append('n', '1')
      form.append('size', sizeStr)
      form.append('response_format', 'b64_json')

      const res = await fetchWithTimeout(
        `${baseUrl}/v1/images/edits`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
        },
        timeoutMs,
      )

      if (!res.ok) {
        const err = await parseError(res)
        throw new ProviderError(err.message, 'openai', res.status, err.raw)
      }

      return parseImageResponse(res, request.size.width, request.size.height)
    }

    // 文生图: images/generations
    const model = config.model || DEFAULT_MODEL
    const res = await fetchWithTimeout(
      `${baseUrl}/v1/images/generations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt: request.prompt,
          n: 1,
          size: sizeStr,
          response_format: 'b64_json',
        }),
      },
      timeoutMs,
    )

    if (!res.ok) {
      const err = await parseError(res)
      throw new ProviderError(err.message, 'openai', res.status, err.raw)
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
 * 连接测试：调用 OpenAI 标准 /v1/models 端点验证认证与连通性。
 *
 * 该端点不消耗图像生成额度，适合作为「连接测试」探针：
 * - 2xx：连接正常
 * - 401 / 403：认证失败（API Key 错误或无权限）
 * - 404：Base URL 错误（端点不存在）
 * - 网络异常：Base URL 不可达或 CORS 拦截
 * - 超时：网络过慢或服务无响应
 *
 * @param config - 提供商配置（使用 baseUrl / apiKey / timeout）
 * @returns 测试结果与可读信息
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
    // 针对常见认证 / 权限错误给出更友好的提示
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
