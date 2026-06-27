/**
 * ImageUpload 组件
 *
 * 参考图上传组件（用于图生图模式）：
 * - 支持点击上传（隐藏 input[type=file]，触发 label 点击）
 * - 支持拖拽上传（onDragOver / onDrop 处理）
 * - 接受格式：image/png, image/jpeg, image/webp
 * - 文件大小限制：10MB，超出时显示错误
 * - 上传后转换为 base64 data URL 调用 onChange
 * - 预览：缩略图 + 右上角删除按钮
 * - 空状态：虚线边框区域 + 提示文案
 *
 * 受控组件：value 由父组件维护，变更通过 onChange 上报。
 */

import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from 'react'

/** ImageUpload 组件 Props */
export interface ImageUploadProps {
  /** 当前 base64 data URL；未上传时为 undefined */
  value: string | undefined
  /** 上传/清除回调；上传时传入 base64，清除时传入 undefined */
  onChange: (base64: string | undefined) => void
}

/** 允许的图片 MIME 类型 */
const ACCEPTED_MIME_TYPES: ReadonlyArray<string> = [
  'image/png',
  'image/jpeg',
  'image/webp',
]

/** input accept 属性值 */
const ACCEPT_ATTR = 'image/png,image/jpeg,image/webp'

/** 文件大小上限（字节）：10MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024

/** 文件大小上限（人类可读） */
const MAX_FILE_SIZE_LABEL = '10MB'

/**
 * 将 File 转换为 base64 data URL。
 *
 * 使用 FileReader.readAsDataURL 异步读取，失败时 reject。
 *
 * @param file - 待转换的文件
 * @returns base64 data URL 字符串
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('文件读取失败'))
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

/**
 * ImageUpload —— 参考图上传
 *
 * @param props - 组件属性
 * @returns JSX
 */
export function ImageUpload({ value, onChange }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  /**
   * 校验并处理单个文件：
   * - 类型必须为 png/jpeg/webp
   * - 大小不得超过 10MB
   * 通过后转为 base64 并 onChange 上报。
   *
   * @param file - 待处理文件
   */
  const handleFile = async (file: File): Promise<void> => {
    setError(null)
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      setError('仅支持 PNG / JPG / WebP 格式')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError(`图片大小不能超过 ${MAX_FILE_SIZE_LABEL}`)
      return
    }
    try {
      const base64 = await fileToBase64(file)
      onChange(base64)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '文件读取失败'
      setError(msg)
    }
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      void handleFile(file)
    }
    // 重置 input 的 value，确保同一文件可被再次选择
    e.target.value = ''
  }

  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      void handleFile(file)
    }
  }

  /** 清除已上传图片 */
  const handleClear = () => {
    setError(null)
    onChange(undefined)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  // 已上传：展示预览 + 删除按钮
  if (value) {
    return (
      <div className="space-y-2">
        <div className="relative inline-block">
          <img
            src={value}
            alt="参考图预览"
            className="max-h-40 max-w-full rounded-md border border-gray-200 object-contain"
          />
          <button
            type="button"
            onClick={handleClear}
            aria-label="删除参考图"
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2.5 2.5l7 7M9.5 2.5l-7 7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }

  // 空状态：虚线边框 + 点击/拖拽上传
  const dropzoneClass =
    'flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors cursor-pointer ' +
    (isDragging
      ? 'border-indigo-500 bg-indigo-50'
      : 'border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/50')

  const helperNode: ReactNode = (
    <>
      <span className="text-sm font-medium text-gray-700">
        点击或拖拽上传参考图
      </span>
      <span className="text-xs text-gray-400">
        支持 PNG / JPG / WebP，最大 {MAX_FILE_SIZE_LABEL}
      </span>
    </>
  )

  return (
    <div className="space-y-2">
      <label
        htmlFor="image-upload-input"
        className={dropzoneClass}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {helperNode}
      </label>
      <input
        ref={inputRef}
        id="image-upload-input"
        type="file"
        accept={ACCEPT_ATTR}
        onChange={handleInputChange}
        className="hidden"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
