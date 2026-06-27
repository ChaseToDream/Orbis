/**
 * Stability AI 适配器
 *
 * 使用 Stable Diffusion v1-6 端点：
 * - 文生图: POST /v1/generation/stable-diffusion-v1-6/text-to-image
 * - 图生图: POST /v1/generation/stable-diffusion-v1-6/image-to-image
 *
 * 支持 negative prompt、steps、cfg_scale、seed，
 * 单次最多生成 4 张图片（maxCount = 4）。
 *
 * 风格预设映射：
 * - realistic -> photographic
 * - anime -> anime
 * - oil-painting -> digital-art
 * - 3d -> 3d-model
 * - cyberpunk -> digital-art
 * - none -> 不传 style_preset
 *
 * 图生图中 image_strength = 1 - denoisingStrength。
 *
 * 错误处理：非 2xx 响应、网络异常、超时均抛出 ProviderError。
 * 超时通过 AbortController 实现，默认 30 秒。
 */
import type {
  ApiProviderConfig,
  GenerateRequest,
  GenerateResult,
  StylePreset,
} from '../types'
import type { ImageProvider } from './types'
import { ProviderError } from './types'

const DEFAULT_BASE_URL = 'https://api.stability.ai'
const DEFAULT_MODEL = 'stable-diffusion-v1-6'
const REQUEST_TIMEOUT_MS = 30000

/** Stability 支持的尺寸预设 */
const SIZE_PRESETS = [
  { width: 512, height: 512 },
  { width: 1024, height: 1024 },
  { width: 768, height: 768 },
]

/** 风格预设映射到 Stability 的 style_preset 字段 */
const STYLE_PRESET_MAP: Record<StylePreset, string | undefined> = {
  none: undefined,
  realistic: 'photographic',
  anime: 'anime',
  'oil-painting': 'digital-art',
  '3d': '3d-model',
  cyberpunk: 'digital-art',
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
        'stability',
        undefined,
        err,
      )
    }
    throw new ProviderError(
      err instanceof Error ? err.message : '网络请求失败',
      'stability',
      undefined,
      err,
    )
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 解析 Stability 错误响应，提取可读 message。
 *
 * Stability 错误响应格式通常为 `{ message, name }` 或 `{ errors: [] }`，
 * 也可能为纯文本。
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
        const maybe = raw as { message?: string }
        if (maybe.message) {
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

/** Stability 生成结果项 */
interface StabilityArtifact {
  base64?: string
  url?: string
  finishReason?: number
  seed?: number
}

/** Stability 生成响应 */
interface StabilityResponse {
  artifacts?: StabilityArtifact[]
  message?: string
}

/**
 * 将 artifacts 数组归一化为 GenerateResult.images。
 *
 * @param artifacts - Stability 返回的 artifacts
 * @param width - 期望输出宽度
 * @param height - 期望输出高度
 */
function artifactsToImages(
  artifacts: StabilityArtifact[],
  width: number,
  height: number,
): Array<{ url: string; width: number; height: number }> {
  return artifacts.map((a) => ({
    url: a.base64 ? `data:image/png;base64,${a.base64}` : a.url || '',
    width,
    height,
  }))
}

/**
 * 构造 text_prompts 数组：正向提示词 + 可选负向提示词。
 *
 * @param request - 生成请求
 */
function buildTextPrompts(
  request: GenerateRequest,
): Array<{ text: string; weight: number }> {
  const prompts: Array<{ text: string; weight: number }> = [
    { text: request.prompt, weight: 1 },
  ]
  if (request.negativePrompt && request.negativePrompt.trim().length > 0) {
    prompts.push({ text: request.negativePrompt, weight: -1 })
  }
  return prompts
}

/** Stability AI 适配器实例 */
export const stabilityProvider: ImageProvider = {
  id: 'stability',
  displayName: 'Stability AI',
  paramMeta: {
    supportsNegativePrompt: true,
    supportsSteps: true,
    supportsCfgScale: true,
    supportsSeed: true,
    supportsImg2Img: true,
    supportsCustomSize: true,
    sizePresets: SIZE_PRESETS,
    maxCount: 4,
  },

  async generate(
    request: GenerateRequest,
    config: ApiProviderConfig,
  ): Promise<GenerateResult> {
    const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '')
    const apiKey = config.apiKey

    if (!apiKey || apiKey.trim().length === 0) {
      throw new ProviderError('Stability API Key 未配置', 'stability')
    }

    const stylePreset = STYLE_PRESET_MAP[request.style]
    const textPrompts = buildTextPrompts(request)
    const samples = Math.max(1, Math.min(request.count, 4))

    if (request.mode === 'img2img') {
      if (!request.referenceImage) {
        throw new ProviderError('图生图模式缺少参考图', 'stability')
      }
      const form = new FormData()
      form.append(
        'init_image',
        base64ToBlob(request.referenceImage),
        'image.png',
      )
      form.append('text_prompts', JSON.stringify(textPrompts))
      form.append('cfg_scale', String(request.cfgScale ?? 7))
      // image_strength = 1 - denoisingStrength，并钳制到 [0,1]
      const denoising = request.denoisingStrength ?? 0.5
      form.append(
        'image_strength',
        String(Math.max(0, Math.min(1, 1 - denoising))),
      )
      form.append('steps', String(request.steps ?? 30))
      form.append('samples', String(samples))
      if (request.seed !== undefined) {
        form.append('seed', String(request.seed))
      }

      const res = await fetchWithTimeout(
        `${baseUrl}/v1/generation/${DEFAULT_MODEL}/image-to-image`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
          body: form,
        },
      )

      if (!res.ok) {
        const err = await parseError(res)
        throw new ProviderError(err.message, 'stability', res.status, err.raw)
      }

      const json = (await res.json()) as StabilityResponse
      const artifacts = json.artifacts ?? []
      if (artifacts.length === 0) {
        throw new ProviderError(
          'Stability 返回为空',
          'stability',
          res.status,
          json,
        )
      }
      return {
        images: artifactsToImages(
          artifacts,
          request.size.width,
          request.size.height,
        ),
        provider: 'stability',
        raw: json,
      }
    }

    // 文生图
    const body: Record<string, unknown> = {
      text_prompts: textPrompts,
      cfg_scale: request.cfgScale ?? 7,
      clip_guidance_preset: 'NONE',
      height: request.size.height,
      width: request.size.width,
      samples,
      steps: request.steps ?? 30,
    }
    if (request.seed !== undefined) {
      body.seed = request.seed
    }
    if (stylePreset) {
      body.style_preset = stylePreset
    }

    const res = await fetchWithTimeout(
      `${baseUrl}/v1/generation/${DEFAULT_MODEL}/text-to-image`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      },
    )

    if (!res.ok) {
      const err = await parseError(res)
      throw new ProviderError(err.message, 'stability', res.status, err.raw)
    }

    const json = (await res.json()) as StabilityResponse
    const artifacts = json.artifacts ?? []
    if (artifacts.length === 0) {
      throw new ProviderError(
        'Stability 返回为空',
        'stability',
        res.status,
        json,
      )
    }
    return {
      images: artifactsToImages(
        artifacts,
        request.size.width,
        request.size.height,
      ),
      provider: 'stability',
      raw: json,
    }
  },

  validateConfig(config: ApiProviderConfig): {
    valid: boolean
    message?: string
  } {
    if (!config.apiKey || config.apiKey.trim().length === 0) {
      return { valid: false, message: 'Stability API Key 未配置' }
    }
    return { valid: true }
  },
}
