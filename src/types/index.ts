/**
 * 核心类型定义 (Types)
 *
 * 该文件定义了图像生成工具中使用的所有核心 TypeScript 类型。
 * 全部使用严格类型，避免 any。
 */

// API 提供商类型
// 当前仅保留一个 OpenAI 兼容提供商，使用 OpenAI 标准 API 接口格式
// （/v1/images/generations、/v1/images/edits、/v1/models 等）。
export type ProviderId = 'openai';

// 生成模式
export type GenerateMode = 'text2img' | 'img2img';

// 图像尺寸
export interface ImageSize {
  width: number;
  height: number;
}

// 风格预设
export type StylePreset =
  | 'none'
  | 'realistic'
  | 'anime'
  | 'oil-painting'
  | '3d'
  | 'cyberpunk';

// 生成请求参数
export interface GenerateRequest {
  mode: GenerateMode;
  prompt: string;
  negativePrompt?: string;
  size: ImageSize;
  count: number; // 1-4
  style: StylePreset;
  steps?: number; // 适用于 Stable Diffusion 类
  cfgScale?: number; // 引导系数
  seed?: number; // 留空则随机
  // 图生图参数
  referenceImage?: string; // base64
  denoisingStrength?: number; // 0-1
}

// 生成结果
export interface GenerateResult {
  images: GeneratedImage[];
  provider: ProviderId;
  raw?: unknown;
}

export interface GeneratedImage {
  url: string; // base64 data URL 或远程 URL
  width: number;
  height: number;
}

// 历史记录条目
export interface HistoryItem {
  id: string;
  createdAt: number; // 时间戳
  provider: ProviderId;
  mode: GenerateMode;
  request: GenerateRequest;
  images: GeneratedImage[];
}

// API 提供商配置
export interface ApiProviderConfig {
  apiKey: string;
  baseUrl?: string; // 可自定义反代
  model?: string; // 可选模型标识
  timeout?: number; // 请求超时（毫秒），未配置时由适配器提供默认值
  extra?: Record<string, unknown>;
}

// 全部设置
export interface Settings {
  currentProvider: ProviderId;
  providers: Record<ProviderId, ApiProviderConfig>;
}

// 适配器支持的参数元信息
export interface ProviderParamMeta {
  supportsNegativePrompt: boolean;
  supportsSteps: boolean;
  supportsCfgScale: boolean;
  supportsSeed: boolean;
  supportsImg2Img: boolean;
  supportsCustomSize: boolean;
  sizePresets: ImageSize[];
  maxCount: number;
}
