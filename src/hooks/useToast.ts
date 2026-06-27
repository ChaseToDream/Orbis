/**
 * useToast Hook
 *
 * 提供全局 Toast 通知的统一管理：
 * - 维护 toasts 列表状态
 * - show(message, type?) 创建一条新 toast，3 秒后自动 dismiss
 * - dismiss(id) 手动移除指定 toast
 *
 * id 生成优先使用 crypto.randomUUID()（需安全上下文），
 * 不可用时退化为「时间戳 + 随机字符串」。
 *
 * 自动 dismiss 通过 setTimeout 实现；组件卸载时不会强制清理，
 * 因为 useToast 通常与 App 同生命周期，且 toast 自身也会在到期后自动消失。
 */

import { useCallback, useRef, useState } from 'react'

/** Toast 类型 */
export type ToastType = 'success' | 'error' | 'info'

/** 单条 Toast 数据结构 */
export interface ToastItem {
  /** 唯一 id */
  id: string
  /** Toast 类型 */
  type: ToastType
  /** 提示文案 */
  message: string
}

/** useToast 返回值 */
export interface UseToastReturn {
  /** 当前活跃的 toast 列表 */
  toasts: ToastItem[]
  /** 显示一条 toast；默认类型为 success，3 秒后自动 dismiss */
  show: (message: string, type?: ToastType) => void
  /** 手动移除指定 id 的 toast */
  dismiss: (id: string) => void
}

/** 自动消失时间（毫秒） */
const AUTO_DISMISS_MS = 3000

/**
 * 生成唯一 id。
 *
 * 优先使用 crypto.randomUUID()（需安全上下文），
 * 不可用时退化为「时间戳 + 随机字符串」。
 *
 * @returns 唯一 id
 */
function generateId(): string {
  try {
    if (
      typeof crypto !== 'undefined' &&
      typeof crypto.randomUUID === 'function'
    ) {
      return crypto.randomUUID()
    }
  } catch {
    // 某些环境下 crypto 可能不可用，走降级逻辑
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * useToast —— Toast 通知管理 Hook
 *
 * @returns toast 列表与操作方法
 */
export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  // 保存 setTimeout 句柄，便于扩展（如卸载时统一清理）
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  )

  /**
   * 移除指定 id 的 toast，并清理对应的定时器。
   *
   * @param id - 待移除的 toast id
   */
  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  /**
   * 显示一条 toast，3 秒后自动 dismiss。
   *
   * @param message - 提示文案
   * @param type - Toast 类型，默认 'success'
   */
  const show = useCallback(
    (message: string, type: ToastType = 'success') => {
      const id = generateId()
      const item: ToastItem = { id, type, message }
      setToasts((prev) => [...prev, item])

      const timer = setTimeout(() => {
        dismiss(id)
      }, AUTO_DISMISS_MS)
      timersRef.current.set(id, timer)
    },
    [dismiss],
  )

  return {
    toasts,
    show,
    dismiss,
  }
}
