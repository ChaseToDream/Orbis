/**
 * ResultPanel 组件
 *
 * 生成结果展示面板，包含四种状态：
 * - 空状态：居中提示 + SVG 占位图标
 * - 加载中：CSS spinner + "生成中..." 文案
 * - 错误：红色错误信息 + 重试按钮
 * - 成功：网格展示图片，支持点击放大（modal 预览）与下载
 *
 * 多张图片时顶部显示"共 N 张"，并根据数量选择 1 或 2 列网格。
 */

import { useEffect, useState, type MouseEvent } from 'react'
import type { GenerateResult } from '../types'

/** ResultPanel 组件 Props */
export interface ResultPanelProps {
  /** 是否加载中 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null
  /** 生成结果 */
  result: GenerateResult | null
  /** 重试回调（错误状态下显示重试按钮） */
  onRetry?: () => void
}

/**
 * ResultPanel —— 结果展示面板
 *
 * @param props - 组件属性
 * @returns JSX
 */
export function ResultPanel({
  isLoading,
  error,
  result,
  onRetry,
}: ResultPanelProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // 切换预览时锁定/恢复 body 滚动
  useEffect(() => {
    if (!previewUrl) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [previewUrl])

  // ESC 关闭预览
  useEffect(() => {
    if (!previewUrl) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewUrl(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [previewUrl])

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setPreviewUrl(null)
    }
  }

  const isEmpty = !isLoading && !error && !result
  const hasResult = !isLoading && !error && !!result && result.images.length > 0
  const imageCount = result?.images.length ?? 0
  // 2 张及以上使用 2 列布局
  const gridCols = imageCount >= 2 ? 'grid-cols-2' : 'grid-cols-1'

  return (
    <div className="flex h-full w-full flex-col">
      {/* 空状态 */}
      {isEmpty && (
        <div className="flex flex-1 flex-col items-center justify-center text-center text-gray-400">
          <svg
            width="64"
            height="64"
            viewBox="0 0 64 64"
            fill="none"
            aria-hidden="true"
            className="mb-3"
          >
            <rect
              x="8"
              y="12"
              width="48"
              height="40"
              rx="4"
              stroke="currentColor"
              strokeWidth="2"
            />
            <circle
              cx="22"
              cy="26"
              r="4"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M12 48l14-14 8 8 8-10 10 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="text-sm">输入提示词并点击生成开始创作</p>
        </div>
      )}

      {/* 加载中 */}
      {isLoading && (
        <div className="flex flex-1 flex-col items-center justify-center text-center text-gray-500">
          <div
            className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500"
            role="status"
            aria-label="生成中"
          />
          <p className="mt-3 text-sm">生成中...</p>
        </div>
      )}

      {/* 错误 */}
      {!isLoading && error && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-3 flex items-center justify-center text-red-500">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M12 7v6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="12" cy="16.5" r="1" fill="currentColor" />
            </svg>
          </div>
          <p className="mb-3 max-w-xs text-sm text-red-600">{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              重试
            </button>
          )}
        </div>
      )}

      {/* 成功 */}
      {hasResult && result && (
        <div className="flex flex-1 flex-col">
          {imageCount > 1 && (
            <div className="mb-2 text-xs text-gray-500">共 {imageCount} 张</div>
          )}
          <div className={`grid ${gridCols} gap-3`}>
            {result.images.map((img, i) => (
              <div
                key={i}
                className="group relative overflow-hidden rounded-md border border-gray-200"
              >
                <button
                  type="button"
                  onClick={() => setPreviewUrl(img.url)}
                  className="block w-full"
                  aria-label={`放大查看第 ${i + 1} 张图片`}
                >
                  <img
                    src={img.url}
                    alt={`生成结果 ${i + 1}`}
                    className="h-auto w-full cursor-zoom-in object-cover"
                  />
                </button>
                <a
                  href={img.url}
                  download={`orbis-${Date.now()}-${i + 1}.png`}
                  className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
                >
                  下载
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 预览 Modal */}
      {previewUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="图片预览"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={handleOverlayClick}
        >
          <div className="relative max-h-full max-w-full">
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              aria-label="关闭预览"
              className="absolute -top-10 right-0 flex h-8 w-8 items-center justify-center rounded text-white hover:bg-white/10"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3.5 3.5l9 9M12.5 3.5l-9 9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <img
              src={previewUrl}
              alt="预览"
              className="max-h-[85vh] max-w-[85vw] rounded"
            />
          </div>
        </div>
      )}
    </div>
  )
}
