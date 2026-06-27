/**
 * Toast 组件
 *
 * 全局 Toast 通知容器：
 * - 固定定位（top-4 right-4 z-50），多条 toast 垂直堆叠
 * - 根据 type 显示不同颜色（success 绿、error 红、info 蓝）
 * - 左侧小图标（inline SVG：勾 / 叉 / 信息）
 * - 右侧关闭按钮
 * - 进入动画：从右侧滑入（animate-toast-slide-in，定义于 index.css）
 *
 * 受控组件：toasts 与 onDismiss 由父组件（通常通过 useToast）传入。
 */

import type { ToastItem, ToastType } from '../hooks/useToast'

/** Toast 组件 Props */
export interface ToastProps {
  /** 当前活跃的 toast 列表 */
  toasts: ToastItem[]
  /** 关闭指定 id 的 toast */
  onDismiss: (id: string) => void
}

/** 不同 type 对应的容器 className（背景 + 边框） */
const TYPE_CONTAINER_CLASS: Record<ToastType, string> = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
}

/** 不同 type 对应的图标颜色 className */
const TYPE_ICON_CLASS: Record<ToastType, string> = {
  success: 'text-green-500',
  error: 'text-red-500',
  info: 'text-blue-500',
}

/** 成功图标（勾） */
function SuccessIcon() {
  return (
    <svg
      width="18"
      height="18"
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
        d="M8 12.5l2.5 2.5 5-5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** 错误图标（叉） */
function ErrorIcon() {
  return (
    <svg
      width="18"
      height="18"
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
        d="M9 9l6 6M15 9l-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** 信息图标 */
function InfoIcon() {
  return (
    <svg
      width="18"
      height="18"
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
        d="M12 11v5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="7.5" r="1.2" fill="currentColor" />
    </svg>
  )
}

/** 关闭图标 */
function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
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
  )
}

/** 根据 type 返回对应图标 */
function renderIcon(type: ToastType) {
  if (type === 'success') return <SuccessIcon />
  if (type === 'error') return <ErrorIcon />
  return <InfoIcon />
}

/**
 * Toast —— 全局通知容器
 *
 * @param props - 组件属性
 * @returns JSX（无 toast 时渲染 null）
 */
export function Toast({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2"
      role="region"
      aria-label="通知"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex max-w-sm items-start gap-2 rounded-lg border px-4 py-3 shadow-md animate-toast-slide-in ${TYPE_CONTAINER_CLASS[t.type]}`}
          role="alert"
        >
          {/* 左侧图标 */}
          <span className={`mt-0.5 shrink-0 ${TYPE_ICON_CLASS[t.type]}`}>
            {renderIcon(t.type)}
          </span>
          {/* 文案 */}
          <p className="flex-1 break-words text-sm font-medium">{t.message}</p>
          {/* 关闭按钮 */}
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            aria-label="关闭通知"
            className="shrink-0 rounded p-0.5 text-current opacity-60 transition-opacity hover:opacity-100"
          >
            <CloseIcon />
          </button>
        </div>
      ))}
    </div>
  )
}
