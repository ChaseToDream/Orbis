/**
 * HistoryPanel 组件
 *
 * 历史记录展示面板：
 * - 顶部标题栏 + 总数徽标 + 清空按钮（带二次确认）
 * - 空状态提示「暂无历史记录」
 * - 响应式网格展示历史卡片（缩略图 + 元信息 + 悬浮操作）
 * - 受控内部 state 的详情弹窗（大图切换 + 完整参数 + 操作按钮）
 *
 * 交互约定：
 * - 点击卡片 / 眼睛图标均会触发 onSelect 并打开内部详情弹窗
 * - 复用 / 删除通过对应回调上交给父组件处理
 * - 详情弹窗内的复用 / 删除会先调用回调再关闭弹窗
 *
 * 图标均使用 inline SVG，未引入额外图标库。
 */

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import type {
  GenerateMode,
  HistoryItem,
  ProviderId,
  StylePreset,
} from '../types'

/** HistoryPanel 组件 Props */
export interface HistoryPanelProps {
  /** 历史记录列表（按 createdAt 倒序） */
  history: HistoryItem[]
  /** 查看详情回调（点击卡片 / 眼睛图标时触发） */
  onSelect: (item: HistoryItem) => void
  /** 复用提示词与参数重新生成 */
  onReuse: (item: HistoryItem) => void
  /** 删除指定 id 的历史记录 */
  onDelete: (id: string) => void
  /** 清空所有历史记录 */
  onClear: () => void
}

/** 风格预设中文标签映射 */
const STYLE_LABELS: Record<StylePreset, string> = {
  none: '无',
  realistic: '写实',
  anime: '动漫',
  'oil-painting': '油画',
  '3d': '3D',
  cyberpunk: '赛博朋克',
}

/**
 * 将时间戳格式化为相对时间字符串。
 *
 * 规则：
 * - < 1 分钟：刚刚
 * - < 1 小时：N 分钟前
 * - < 1 天：N 小时前
 * - < 7 天：N 天前
 * - 其它：YYYY-MM-DD
 *
 * @param timestamp - 毫秒时间戳
 * @returns 相对时间字符串
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return '刚刚'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  if (day < 7) return `${day} 天前`
  const d = new Date(timestamp)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** 生成模式中文标签 */
function modeLabel(mode: GenerateMode): string {
  return mode === 'text2img' ? '文生图' : '图生图'
}

/** 提供商徽标 className */
function providerBadgeClass(provider: ProviderId): string {
  return provider === 'dalle'
    ? 'bg-blue-50 text-blue-600'
    : 'bg-purple-50 text-purple-600'
}

/** 生成模式徽标 className */
function modeBadgeClass(mode: GenerateMode): string {
  return mode === 'text2img'
    ? 'bg-green-50 text-green-600'
    : 'bg-orange-50 text-orange-600'
}

/* ---------- 内联 SVG 图标（模块内使用，不导出） ---------- */

function EyeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function ReuseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M21 12a9 9 0 1 1-3-6.7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 3v6h-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 6h18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 10l5 5 5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 15V3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronLeftIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M15 18l-6-6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 18l6-6-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function EmptyIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
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
      <circle cx="22" cy="26" r="4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 48l14-14 8 8 8-10 10 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** 参数行（用于详情弹窗的参数列表） */
function ParamRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 py-0.5">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right text-gray-800">{value}</dd>
    </div>
  )
}

/**
 * HistoryPanel —— 历史记录展示面板
 *
 * @param props - 组件属性
 * @returns JSX
 */
export function HistoryPanel({
  history,
  onSelect,
  onReuse,
  onDelete,
  onClear,
}: HistoryPanelProps) {
  const [detailItem, setDetailItem] = useState<HistoryItem | null>(null)
  const [detailImageIndex, setDetailImageIndex] = useState(0)
  // 复制提示词的视觉反馈状态与定时器
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<number | null>(null)

  // 详情弹窗打开时锁定 body 滚动
  useEffect(() => {
    if (!detailItem) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [detailItem])

  // 组件卸载时清理复制反馈定时器，避免 setState on unmounted
  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current)
        copyTimerRef.current = null
      }
    }
  }, [])

  // ESC 关闭详情弹窗
  useEffect(() => {
    if (!detailItem) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailItem(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [detailItem])

  /** 打开详情弹窗并通知父组件 */
  const handleViewDetail = (item: HistoryItem) => {
    setDetailItem(item)
    setDetailImageIndex(0)
    onSelect(item)
  }

  /** 关闭详情弹窗 */
  const closeDetail = () => setDetailItem(null)

  /** 清空历史（带二次确认） */
  const handleClear = () => {
    if (window.confirm('确定要清空所有历史记录吗？此操作不可撤销。')) {
      onClear()
    }
  }

  /** 详情弹窗内：上一张图（循环） */
  const prevImage = () => {
    if (!detailItem) return
    const len = detailItem.images.length
    if (len === 0) return
    setDetailImageIndex((i) => (i - 1 + len) % len)
  }

  /** 详情弹窗内：下一张图（循环） */
  const nextImage = () => {
    if (!detailItem) return
    const len = detailItem.images.length
    if (len === 0) return
    setDetailImageIndex((i) => (i + 1) % len)
  }

  /** 详情弹窗内：复用提示词 */
  const handleDetailReuse = () => {
    if (!detailItem) return
    onReuse(detailItem)
    closeDetail()
  }

  /** 详情弹窗内：删除当前记录 */
  const handleDetailDelete = () => {
    if (!detailItem) return
    onDelete(detailItem.id)
    closeDetail()
  }

  /**
   * 详情弹窗内：复制提示词到剪贴板。
   *
   * 优先使用现代 Clipboard API；若不可用或失败，则退化为
   * 「临时 textarea + document.execCommand('copy')」方案。
   * 复制成功后按钮文字短暂变为「已复制」，2 秒后恢复。
   */
  const handleCopyPrompt = async () => {
    if (!detailItem) return
    const text = detailItem.request.prompt
    if (!text) return

    let ok = false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        ok = true
      }
    } catch {
      ok = false
    }
    // 降级方案：临时 textarea + execCommand('copy')
    if (!ok) {
      try {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.top = '0'
        textarea.style.left = '0'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        ok = document.execCommand('copy')
        document.body.removeChild(textarea)
      } catch {
        ok = false
      }
    }

    if (ok) {
      setCopied(true)
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current)
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopied(false)
        copyTimerRef.current = null
      }, 2000)
    }
  }

  /** 详情弹窗遮罩点击关闭 */
  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) closeDetail()
  }

  const isEmpty = history.length === 0
  const detailImages = detailItem?.images ?? []
  const detailCurrentUrl = detailImages[detailImageIndex]?.url ?? ''

  return (
    <div className="flex h-full w-full flex-col">
      {/* 标题栏 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-gray-700">历史记录</h2>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {history.length}
          </span>
        </div>
        {history.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-red-500 transition-colors hover:text-red-600 hover:underline"
          >
            清空
          </button>
        )}
      </div>

      {/* 内容区（可滚动） */}
      <div className="flex-1 overflow-auto">
        {/* 空状态 */}
        {isEmpty && (
          <div className="flex h-full flex-col items-center justify-center text-center text-gray-400">
            <EmptyIcon />
            <p className="mt-2 text-sm">暂无历史记录</p>
          </div>
        )}

        {/* 历史网格 */}
        {!isEmpty && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {history.map((item) => {
              const thumb = item.images[0]?.url
              const extra = item.images.length - 1
              return (
                <div
                  key={item.id}
                  className="group relative cursor-pointer overflow-hidden rounded-md border border-gray-200 bg-white"
                  onClick={() => handleViewDetail(item)}
                >
                  {/* 缩略图 */}
                  <div className="relative aspect-square bg-gray-100">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt="历史缩略图"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <EmptyIcon />
                      </div>
                    )}
                    {/* 多图角标 */}
                    {extra > 0 && (
                      <span className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
                        +{extra}
                      </span>
                    )}
                    {/* 悬浮操作 */}
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleViewDetail(item)
                        }}
                        aria-label="查看详情"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-700 transition-colors hover:bg-white"
                      >
                        <EyeIcon />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onReuse(item)
                        }}
                        aria-label="复用提示词"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-700 transition-colors hover:bg-white"
                      >
                        <ReuseIcon />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(item.id)
                        }}
                        aria-label="删除"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-red-500 transition-colors hover:bg-white"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                  {/* 底部信息 */}
                  <div className="p-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-xs ${providerBadgeClass(
                          item.provider,
                        )}`}
                      >
                        {item.provider}
                      </span>
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-xs ${modeBadgeClass(
                          item.mode,
                        )}`}
                      >
                        {modeLabel(item.mode)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      {formatRelativeTime(item.createdAt)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 详情弹窗（受控内部 state） */}
      {detailItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="历史详情"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={handleOverlayClick}
        >
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-auto rounded-lg bg-white">
            {/* 弹窗头部 */}
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
              <h3 className="text-sm font-medium text-gray-800">历史详情</h3>
              <button
                type="button"
                onClick={closeDetail}
                aria-label="关闭"
                className="flex h-8 w-8 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                <CloseIcon />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="grid gap-4 p-4 md:grid-cols-2">
              {/* 大图区 */}
              <div className="flex flex-col items-center">
                <div className="relative w-full">
                  {detailCurrentUrl ? (
                    <img
                      src={detailCurrentUrl}
                      alt="历史大图"
                      className="max-h-[50vh] w-full rounded border border-gray-200 object-contain"
                    />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center rounded border border-gray-200 text-gray-300">
                      <EmptyIcon />
                    </div>
                  )}
                  {detailImages.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={prevImage}
                        aria-label="上一张"
                        className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
                      >
                        <ChevronLeftIcon />
                      </button>
                      <button
                        type="button"
                        onClick={nextImage}
                        aria-label="下一张"
                        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
                      >
                        <ChevronRightIcon />
                      </button>
                    </>
                  )}
                </div>
                {detailImages.length > 1 && (
                  <div className="mt-2 text-xs text-gray-500">
                    {detailImageIndex + 1} / {detailImages.length}
                  </div>
                )}
              </div>

              {/* 信息区 */}
              <div className="flex flex-col">
                {/* 提示词 */}
                <div className="mb-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-gray-500">提示词</span>
                    <button
                      type="button"
                      onClick={handleCopyPrompt}
                      disabled={!detailItem.request.prompt}
                      className="flex items-center gap-1 rounded-md border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {copied ? '已复制' : '复制'}
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-gray-800">
                    {detailItem.request.prompt || '（空）'}
                  </p>
                </div>
                {/* 负向提示词 */}
                {detailItem.request.negativePrompt && (
                  <div className="mb-3">
                    <div className="mb-1 text-xs text-gray-500">负向提示词</div>
                    <p className="whitespace-pre-wrap break-words text-sm text-gray-800">
                      {detailItem.request.negativePrompt}
                    </p>
                  </div>
                )}
                {/* 参数列表 */}
                <div className="mb-3">
                  <div className="mb-1 text-xs text-gray-500">参数</div>
                  <dl className="rounded border border-gray-100 bg-gray-50 px-3 text-sm">
                    <ParamRow label="模式" value={modeLabel(detailItem.mode)} />
                    <ParamRow label="提供商" value={detailItem.provider} />
                    <ParamRow
                      label="尺寸"
                      value={`${detailItem.request.size.width}×${detailItem.request.size.height}`}
                    />
                    <ParamRow
                      label="数量"
                      value={String(detailItem.request.count)}
                    />
                    <ParamRow
                      label="风格"
                      value={STYLE_LABELS[detailItem.request.style]}
                    />
                    {detailItem.request.steps != null && (
                      <ParamRow
                        label="步数"
                        value={String(detailItem.request.steps)}
                      />
                    )}
                    {detailItem.request.cfgScale != null && (
                      <ParamRow
                        label="CFG"
                        value={String(detailItem.request.cfgScale)}
                      />
                    )}
                    {detailItem.request.seed != null && (
                      <ParamRow
                        label="种子"
                        value={String(detailItem.request.seed)}
                      />
                    )}
                    {detailItem.request.denoisingStrength != null && (
                      <ParamRow
                        label="去噪强度"
                        value={String(detailItem.request.denoisingStrength)}
                      />
                    )}
                  </dl>
                </div>
                {/* 操作按钮 */}
                <div className="mt-auto flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleDetailReuse}
                    className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    <ReuseIcon />
                    复用提示词
                  </button>
                  {detailCurrentUrl && (
                    <a
                      href={detailCurrentUrl}
                      download={`orbis-${detailItem.id}-${detailImageIndex + 1}.png`}
                      className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <DownloadIcon />
                      下载
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={handleDetailDelete}
                    className="flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                  >
                    <TrashIcon />
                    删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
