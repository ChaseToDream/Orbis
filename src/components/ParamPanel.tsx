/**
 * ParamPanel 组件
 *
 * 生成参数控制面板：
 * - 图像尺寸：预设下拉 + 可选自定义 width/height
 * - 生成数量：1 - paramMeta.maxCount
 * - 风格预设：none/realistic/anime/oil-painting/3d/cyberpunk
 * - 采样步数（supportsSteps）
 * - CFG Scale（supportsCfgScale）
 * - Seed（supportsSeed，留空随机，附"随机"按钮）
 * - 重绘强度 Denoising Strength（仅 img2img 模式且 supportsImg2Img 时显示）
 *
 * 数值越界时输入框边框变红，但 onChange 仍传递原始值，由父组件统一校验。
 */

import type { ChangeEvent } from 'react'
import type {
  GenerateRequest,
  ImageSize,
  ProviderParamMeta,
  StylePreset,
} from '../types'

/** ParamPanel 组件 Props */
export interface ParamPanelProps {
  /** 当前请求参数 */
  request: GenerateRequest
  /** 部分字段更新回调 */
  onChange: (patch: Partial<GenerateRequest>) => void
  /** 当前 provider 能力元信息 */
  paramMeta: ProviderParamMeta
}

/** 风格预设选项（值 + 中文标签） */
const STYLE_OPTIONS: ReadonlyArray<{ value: StylePreset; label: string }> = [
  { value: 'none', label: '无' },
  { value: 'realistic', label: '写实' },
  { value: 'anime', label: '动漫' },
  { value: 'oil-painting', label: '油画' },
  { value: '3d', label: '3D' },
  { value: 'cyberpunk', label: '赛博朋克' },
]

/** 尺寸下拉中表示"自定义"的占位值 */
const CUSTOM_SIZE_VALUE = '__custom__'

/** 自定义尺寸范围与步长 */
const MIN_DIMENSION = 256
const MAX_DIMENSION = 2048
const DIMENSION_STEP = 64

/** 采样步数范围 */
const MIN_STEPS = 1
const MAX_STEPS = 50
const DEFAULT_STEPS = 30

/** CFG Scale 范围 */
const MIN_CFG = 1
const MAX_CFG = 30
const CFG_STEP = 0.5
const DEFAULT_CFG = 7

/** Denoising Strength 范围与默认值（仅图生图模式） */
const MIN_DENOISING = 0
const MAX_DENOISING = 1
const DENOISING_STEP = 0.05
const DEFAULT_DENOISING = 0.75

/**
 * 判断当前尺寸匹配哪个预设。
 *
 * @param size - 当前尺寸
 * @param presets - 预设列表
 * @returns 预设索引字符串；未匹配则返回自定义占位值
 */
function findPresetKey(size: ImageSize, presets: ImageSize[]): string {
  const idx = presets.findIndex(
    (p) => p.width === size.width && p.height === size.height,
  )
  return idx >= 0 ? String(idx) : CUSTOM_SIZE_VALUE
}

/**
 * 判断数值是否落在 [min, max] 区间内。
 *
 * @param value - 输入值
 * @param min - 最小值
 * @param max - 最大值
 * @returns 是否在范围内
 */
function isInRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max
}

/**
 * ParamPanel —— 参数面板
 *
 * @param props - 组件属性
 * @returns JSX
 */
export function ParamPanel({ request, onChange, paramMeta }: ParamPanelProps) {
  const sizeKey = findPresetKey(request.size, paramMeta.sizePresets)
  const isCustomSize = sizeKey === CUSTOM_SIZE_VALUE

  const handleSizePresetChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value
    if (v === CUSTOM_SIZE_VALUE) {
      // 切换到自定义时保留当前尺寸（父组件可继续校验范围）
      onChange({ size: { ...request.size } })
    } else {
      const preset = paramMeta.sizePresets[Number(v)]
      if (preset) {
        onChange({ size: { ...preset } })
      }
    }
  }

  const handleWidthChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ size: { ...request.size, width: Number(e.target.value) } })
  }

  const handleHeightChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ size: { ...request.size, height: Number(e.target.value) } })
  }

  const handleCountChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ count: Number(e.target.value) })
  }

  const handleStyleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onChange({ style: e.target.value as StylePreset })
  }

  const handleStepsChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ steps: Number(e.target.value) })
  }

  const handleCfgChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ cfgScale: Number(e.target.value) })
  }

  const handleSeedChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    if (v.trim() === '') {
      onChange({ seed: undefined })
    } else {
      onChange({ seed: Number(v) })
    }
  }

  const handleRandomSeed = () => {
    onChange({ seed: undefined })
  }

  const handleDenoisingChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ denoisingStrength: Number(e.target.value) })
  }

  // 越界判断
  const widthInvalid = !isInRange(
    request.size.width,
    MIN_DIMENSION,
    MAX_DIMENSION,
  )
  const heightInvalid = !isInRange(
    request.size.height,
    MIN_DIMENSION,
    MAX_DIMENSION,
  )
  const countInvalid = !isInRange(request.count, 1, paramMeta.maxCount)
  const stepsInvalid =
    request.steps !== undefined &&
    !isInRange(request.steps, MIN_STEPS, MAX_STEPS)
  const cfgInvalid =
    request.cfgScale !== undefined &&
    !isInRange(request.cfgScale, MIN_CFG, MAX_CFG)
  const seedInvalid =
    request.seed !== undefined &&
    (!Number.isInteger(request.seed) || request.seed < 0)

  // 输入框样式
  const inputBase =
    'w-full rounded-md border px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1'
  const validBorder =
    'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
  const invalidBorder = 'border-red-500 focus:border-red-500 focus:ring-red-500'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {/* 图像尺寸 */}
        <div className="col-span-2">
          <label
            htmlFor="size-select"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            图像尺寸
          </label>
          <select
            id="size-select"
            value={sizeKey}
            onChange={handleSizePresetChange}
            className={`${inputBase} ${validBorder}`}
          >
            {paramMeta.sizePresets.map((p, i) => (
              <option key={i} value={String(i)}>
                {p.width} × {p.height}
              </option>
            ))}
            {paramMeta.supportsCustomSize && (
              <option value={CUSTOM_SIZE_VALUE}>自定义</option>
            )}
          </select>
        </div>

        {/* 自定义尺寸 width/height */}
        {paramMeta.supportsCustomSize && isCustomSize && (
          <>
            <div>
              <label
                htmlFor="width-input"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                宽度
                <span className="ml-1 text-xs font-normal text-gray-400">
                  （{MIN_DIMENSION}-{MAX_DIMENSION}）
                </span>
              </label>
              <input
                id="width-input"
                type="number"
                min={MIN_DIMENSION}
                max={MAX_DIMENSION}
                step={DIMENSION_STEP}
                value={request.size.width}
                onChange={handleWidthChange}
                className={`${inputBase} ${widthInvalid ? invalidBorder : validBorder}`}
              />
            </div>
            <div>
              <label
                htmlFor="height-input"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                高度
                <span className="ml-1 text-xs font-normal text-gray-400">
                  （{MIN_DIMENSION}-{MAX_DIMENSION}）
                </span>
              </label>
              <input
                id="height-input"
                type="number"
                min={MIN_DIMENSION}
                max={MAX_DIMENSION}
                step={DIMENSION_STEP}
                value={request.size.height}
                onChange={handleHeightChange}
                className={`${inputBase} ${heightInvalid ? invalidBorder : validBorder}`}
              />
            </div>
          </>
        )}

        {/* 生成数量 */}
        <div className="col-span-2">
          <label
            htmlFor="count-input"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            生成数量
            <span className="ml-1 text-xs font-normal text-gray-400">
              （1 - {paramMeta.maxCount}）
            </span>
          </label>
          <input
            id="count-input"
            type="number"
            min={1}
            max={paramMeta.maxCount}
            step={1}
            value={request.count}
            onChange={handleCountChange}
            className={`${inputBase} ${countInvalid ? invalidBorder : validBorder}`}
          />
        </div>

        {/* 风格预设 */}
        <div className="col-span-2">
          <label
            htmlFor="style-select"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            风格预设
          </label>
          <select
            id="style-select"
            value={request.style}
            onChange={handleStyleChange}
            className={`${inputBase} ${validBorder}`}
          >
            {STYLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 采样步数 */}
        {paramMeta.supportsSteps && (
          <div className="col-span-2">
            <label
              htmlFor="steps-input"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              采样步数
              <span className="ml-1 text-xs font-normal text-gray-400">
                （{MIN_STEPS}-{MAX_STEPS}）
              </span>
            </label>
            <input
              id="steps-input"
              type="number"
              min={MIN_STEPS}
              max={MAX_STEPS}
              step={1}
              value={request.steps ?? DEFAULT_STEPS}
              onChange={handleStepsChange}
              className={`${inputBase} ${stepsInvalid ? invalidBorder : validBorder}`}
            />
          </div>
        )}

        {/* CFG Scale */}
        {paramMeta.supportsCfgScale && (
          <div className="col-span-2">
            <label
              htmlFor="cfg-input"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              CFG Scale
              <span className="ml-1 text-xs font-normal text-gray-400">
                （{MIN_CFG}-{MAX_CFG}）
              </span>
            </label>
            <input
              id="cfg-input"
              type="number"
              min={MIN_CFG}
              max={MAX_CFG}
              step={CFG_STEP}
              value={request.cfgScale ?? DEFAULT_CFG}
              onChange={handleCfgChange}
              className={`${inputBase} ${cfgInvalid ? invalidBorder : validBorder}`}
            />
          </div>
        )}

        {/* Seed */}
        {paramMeta.supportsSeed && (
          <div className="col-span-2">
            <label
              htmlFor="seed-input"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Seed
              <span className="ml-1 text-xs font-normal text-gray-400">
                （留空随机）
              </span>
            </label>
            <div className="flex gap-2">
              <input
                id="seed-input"
                type="number"
                min={0}
                step={1}
                value={request.seed ?? ''}
                onChange={handleSeedChange}
                placeholder="随机"
                className={`flex-1 ${inputBase} ${seedInvalid ? invalidBorder : validBorder}`}
              />
              <button
                type="button"
                onClick={handleRandomSeed}
                className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                随机
              </button>
            </div>
          </div>
        )}

        {/* 重绘强度 Denoising Strength：仅图生图模式且 provider 支持时显示 */}
        {request.mode === 'img2img' && paramMeta.supportsImg2Img && (
          <div className="col-span-2">
            <label
              htmlFor="denoising-input"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              重绘强度 (Denoising Strength)
              <span className="ml-1 text-xs font-normal text-gray-400">
                （{MIN_DENOISING}-{MAX_DENOISING}）
              </span>
            </label>
            <div className="flex items-center gap-3">
              <input
                id="denoising-input"
                type="range"
                min={MIN_DENOISING}
                max={MAX_DENOISING}
                step={DENOISING_STEP}
                value={request.denoisingStrength ?? DEFAULT_DENOISING}
                onChange={handleDenoisingChange}
                className="flex-1 accent-indigo-600"
              />
              <span className="w-12 text-right text-sm font-medium text-gray-700">
                {(request.denoisingStrength ?? DEFAULT_DENOISING).toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
