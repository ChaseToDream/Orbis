/**
 * ModeSwitch 组件
 *
 * 生成模式切换控件（文生图 / 图生图）：
 * - 以按钮组（segmented control）形式呈现两个 Tab
 * - 当当前 provider 不支持图生图时，"图生图"按钮禁用并显示 tooltip
 * - 选中态使用 indigo 高亮
 *
 * 受控组件：模式变更通过 onChange 上报父组件。
 */

import type { GenerateMode } from '../types'

/** ModeSwitch 组件 Props */
export interface ModeSwitchProps {
  /** 当前模式 */
  mode: GenerateMode
  /** 模式变更回调 */
  onChange: (mode: GenerateMode) => void
  /** 当前 provider 是否支持图生图（由父组件根据 paramMeta.supportsImg2Img 传入） */
  img2imgAvailable: boolean
}

/** 模式选项配置（值 + 中文标签） */
const MODE_OPTIONS: ReadonlyArray<{
  value: GenerateMode
  label: string
}> = [
  { value: 'text2img', label: '文生图' },
  { value: 'img2img', label: '图生图' },
]

/**
 * ModeSwitch —— 生成模式切换
 *
 * @param props - 组件属性
 * @returns JSX
 */
export function ModeSwitch({
  mode,
  onChange,
  img2imgAvailable,
}: ModeSwitchProps) {
  return (
    <div
      className="inline-flex overflow-hidden rounded-lg border border-gray-300"
      role="tablist"
      aria-label="生成模式选择"
    >
      {MODE_OPTIONS.map((opt) => {
        const isActive = opt.value === mode
        const isDisabled = opt.value === 'img2img' && !img2imgAvailable
        const tooltip = isDisabled ? '当前 API 不支持图生图' : undefined

        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={isDisabled}
            title={tooltip}
            onClick={() => onChange(opt.value)}
            className={
              'px-4 py-2 text-sm font-medium transition-colors ' +
              (isActive
                ? 'bg-indigo-600 text-white'
                : isDisabled
                  ? 'cursor-not-allowed bg-gray-50 text-gray-300'
                  : 'bg-white text-gray-700 hover:bg-gray-100')
            }
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
