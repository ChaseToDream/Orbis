/**
 * PromptPanel 组件
 *
 * 文生图提示词输入面板：
 * - 提示词（必填，textarea，自动高度 1-6 行）
 * - 负向提示词（按 showNegative 控制是否显示）
 * - 字符计数显示（如 "12 / 2000"）
 *
 * 受控组件：所有变更通过 onChange 上报父组件。
 */

import { useEffect, useRef, type ChangeEvent } from 'react'

/** 提示词字段名 */
type PromptField = 'prompt' | 'negativePrompt'

/** PromptPanel 组件 Props */
export interface PromptPanelProps {
  /** 正向提示词 */
  prompt: string
  /** 负向提示词 */
  negativePrompt: string
  /** 字段变更回调 */
  onChange: (field: PromptField, value: string) => void
  /** 是否显示负向提示词（由父组件根据 provider.paramMeta.supportsNegativePrompt 控制） */
  showNegative: boolean
}

/** 提示词最大字符数 */
const MAX_PROMPT_LENGTH = 2000
/** 负向提示词最大字符数 */
const MAX_NEGATIVE_PROMPT_LENGTH = 2000
/** textarea 最小行数 */
const MIN_ROWS = 1
/** textarea 最大行数 */
const MAX_ROWS = 6

/**
 * 根据内容自动调整 textarea 高度，限制在 [MIN_ROWS, MAX_ROWS] 行之间。
 *
 * 计算逻辑：基于 lineHeight 推算最小/最大高度，将 scrollHeight 钳制在该区间内；
 * 超过最大高度时启用纵向滚动条，否则隐藏滚动条以避免视觉抖动。
 *
 * @param el - textarea 元素
 */
function autoResize(el: HTMLTextAreaElement): void {
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 22
  const minHeight = lineHeight * MIN_ROWS
  const maxHeight = lineHeight * MAX_ROWS
  el.style.height = 'auto'
  const scrollHeight = el.scrollHeight
  const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
  el.style.height = `${newHeight}px`
  el.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden'
}

/**
 * PromptPanel —— 提示词输入面板
 *
 * @param props - 组件属性
 * @returns JSX
 */
export function PromptPanel({
  prompt,
  negativePrompt,
  onChange,
  showNegative,
}: PromptPanelProps) {
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const negativeRef = useRef<HTMLTextAreaElement>(null)

  // 内容变化时重新计算高度
  useEffect(() => {
    if (promptRef.current) autoResize(promptRef.current)
  }, [prompt])

  useEffect(() => {
    if (negativeRef.current) autoResize(negativeRef.current)
  }, [negativePrompt])

  const handlePromptChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange('prompt', e.target.value)
  }

  const handleNegativeChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange('negativePrompt', e.target.value)
  }

  const promptOver = prompt.length > MAX_PROMPT_LENGTH
  const negativeOver = negativePrompt.length > MAX_NEGATIVE_PROMPT_LENGTH

  return (
    <div className="space-y-4">
      {/* 提示词 */}
      <div>
        <label
          htmlFor="prompt-input"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          提示词
          <span className="ml-1 text-red-500">*</span>
        </label>
        <textarea
          id="prompt-input"
          ref={promptRef}
          value={prompt}
          onChange={handlePromptChange}
          placeholder="描述你想要生成的图像..."
          rows={MIN_ROWS}
          className={
            'w-full resize-none rounded-md border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 ' +
            (promptOver
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500')
          }
        />
        <div
          className={
            'mt-1 text-right text-xs ' +
            (promptOver ? 'text-red-500' : 'text-gray-400')
          }
        >
          {prompt.length} / {MAX_PROMPT_LENGTH}
        </div>
      </div>

      {/* 负向提示词 */}
      {showNegative && (
        <div>
          <label
            htmlFor="negative-prompt-input"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            负向提示词
          </label>
          <textarea
            id="negative-prompt-input"
            ref={negativeRef}
            value={negativePrompt}
            onChange={handleNegativeChange}
            placeholder="不希望出现的元素..."
            rows={MIN_ROWS}
            className={
              'w-full resize-none rounded-md border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 ' +
              (negativeOver
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500')
            }
          />
          <div
            className={
              'mt-1 text-right text-xs ' +
              (negativeOver ? 'text-red-500' : 'text-gray-400')
            }
          >
            {negativePrompt.length} / {MAX_NEGATIVE_PROMPT_LENGTH}
          </div>
        </div>
      )}
    </div>
  )
}
