/**
 * OpenAI DALL-E 适配器
 *
 * 支持：
 * - 文生图（POST /v1/images/generations，默认 dall-e-3）
 * - 图生图（POST /v1/images/edits，默认 dall-e-2；DALL-E 3 不支持 edits）
 *
 * 不支持 negative prompt、steps、cfg_scale、seed。
 * 单次仅生成 1 张图片（maxCount = 1）。
 *
 * 错误处理：非 2xx 响应、网络异常、超时均抛出 ProviderError。
 * 超时通过 AbortController 实现，默认 30 秒。
 */
import type {
  ApiProviderConfig,
  GenerateRequest,
  GenerateResult,
} from '../types'
import type { ImageProvider } from './types'
import { ProviderError } from './types'

const DEFAULT_BASE_URL = 'https://api.openai.com'
const REQUEST_TIMEOUT_MS = 30000

/** DALL-E 支持的尺寸预设 */
const SIZE_PRESETS = [
  { width: 1024, height: 1024 },
  { width: 1024, height: 1792 },
  { width: 1792, height: 1024 },
]

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
 * @param timeoutMs - 超时毫秒，默认 30s
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ProviderError(
        `请求超时（${timeoutMs}ms）`,
        'dalle',
        undefined,
        err,
      )
    }
    throw new ProviderError(
      err instanceof Error ? err.message : '网络请求失败',
      'dalle',
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
    throw new ProviderError('DALL-E 返回为空', 'dalle', res.status, json)
  }
  const url = item.b64_json
    ? `data:image/png;base64,${item.b64_json}`
    : item.url || ''
  return {
    images: [{ url, width, height }],
    provider: 'dalle',
    raw: json,
  }
}

/** DALL-E 适配器实例 */
export const dalleProvider: ImageProvider = {
  id: 'dalle',
  displayName: 'OpenAI DALL-E',
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

    if (!apiKey || apiKey.trim().length === 0) {
      throw new ProviderError('OpenAI API Key 未配置', 'dalle')
    }

    const sizeStr = `${request.size.width}x${request.size.height}`

    if (request.mode === 'img2img') {
      // 图生图: images/edits 端点，DALL-E 3 不支持，默认使用 dall-e-2
      if (!request.referenceImage) {
        throw new ProviderError('图生图模式缺少参考图', 'dalle')
      }
      const model = config.model || 'dall-e-2'
      const form = new FormData()
      form.append('image', base64ToBlob(request.referenceImage), 'image.png')
      form.append('prompt', request.prompt)
      form.append('model', model)
      form.append('n', '1')
      form.append('size', sizeStr)
      form.append('response_format', 'b64_json')

      const res = await fetchWithTimeout(`${baseUrl}/v1/images/edits`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      })

      if (!res.ok) {
        const err = await parseError(res)
        throw new ProviderError(err.message, 'dalle', res.status, err.raw)
      }

      return parseImageResponse(res, request.size.width, request.size.height)
    }

    // 文生图: images/generations
    const model = config.model || 'dall-e-3'
    const res = await fetchWithTimeout(`${baseUrl}/v1/images/generations`, {
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
    })

    if (!res.ok) {
      const err = await parseError(res)
      throw new ProviderError(err.message, 'dalle', res.status, err.raw)
    }

    return parseImageResponse(res, request.size.width, request.size.height)
  },

  validateConfig(config: ApiProviderConfig): {
    valid: boolean
    message?: string
  } {
    if (!config.apiKey || config.apiKey.trim().length === 0) {
      return { valid: false, message: 'OpenAI API Key 未配置' }
    }
    return { valid: true }
  },
}
