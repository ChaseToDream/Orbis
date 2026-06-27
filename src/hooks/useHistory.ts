/**
 * useHistory Hook
 *
 * 管理图像生成历史记录：
 * - 启动时从 localStorage 读取（key 为 STORAGE_KEYS.HISTORY）
 * - 任何变更都通过 useEffect 自动同步回 localStorage
 * - 暴露 add / remove / clear / getById 等操作
 * - 历史按 createdAt 倒序排列，最多保留 100 条
 *
 * 另导出工具函数 createHistoryItemFromResult，便于在生成成功后
 * 将 GenerateRequest + GenerateResult 组装为可写入的历史条目
 * （供后续 Task 7 的 App 集成阶段调用，本任务不修改 useGenerate）。
 */

import { useCallback, useEffect, useState } from 'react'
import type { GenerateRequest, GenerateResult, HistoryItem } from '../types'
import { get, set, STORAGE_KEYS } from '../storage'

/** 历史记录最大保留条数（超过时删除最早的） */
const MAX_HISTORY = 100

/** useHistory Hook 返回值 */
export interface UseHistoryReturn {
  /** 历史记录列表（按 createdAt 倒序） */
  history: HistoryItem[]
  /** 新增一条历史记录，自动生成 id 与 createdAt，返回完整条目 */
  add: (item: Omit<HistoryItem, 'id' | 'createdAt'>) => HistoryItem
  /** 删除指定 id 的历史记录 */
  remove: (id: string) => void
  /** 清空所有历史记录 */
  clear: () => void
  /** 根据 id 获取历史记录 */
  getById: (id: string) => HistoryItem | undefined
  /** 当前历史记录条数 */
  count: number
}

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
 * 从 localStorage 加载历史记录并按 createdAt 倒序排序。
 *
 * 读取或解析失败时返回空数组，保证调用方零异常。
 *
 * @returns 历史记录列表（倒序）
 */
function loadHistory(): HistoryItem[] {
  const items = get<HistoryItem[]>(STORAGE_KEYS.HISTORY, [])
  return [...items].sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * useHistory —— 管理图像生成历史记录的 Hook
 *
 * @returns 历史记录相关状态与操作方法
 */
export function useHistory(): UseHistoryReturn {
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory)

  // 任何 history 变化都同步写回 localStorage
  // storage.set 内部已对 QuotaExceededError 等异常做 try/catch 容错
  useEffect(() => {
    set(STORAGE_KEYS.HISTORY, history)
  }, [history])

  /**
   * 新增一条历史记录。
   *
   * 自动生成 id 与 createdAt，插入到列表头部，并保证最多保留 MAX_HISTORY 条。
   *
   * @param item - 不含 id 与 createdAt 的历史条目
   * @returns 新增的完整历史条目
   */
  const add = useCallback(
    (item: Omit<HistoryItem, 'id' | 'createdAt'>): HistoryItem => {
      const newItem: HistoryItem = {
        ...item,
        id: generateId(),
        createdAt: Date.now(),
      }
      setHistory((prev) => {
        const next = [newItem, ...prev]
        if (next.length > MAX_HISTORY) {
          return next.slice(0, MAX_HISTORY)
        }
        return next
      })
      return newItem
    },
    [],
  )

  /**
   * 删除指定 id 的历史记录。
   *
   * @param id - 目标历史记录 id
   */
  const remove = useCallback((id: string) => {
    setHistory((prev) => prev.filter((h) => h.id !== id))
  }, [])

  /**
   * 清空所有历史记录。
   */
  const clear = useCallback(() => {
    setHistory([])
  }, [])

  /**
   * 根据 id 查询历史记录。
   *
   * @param id - 目标历史记录 id
   * @returns 命中的历史条目或 undefined
   */
  const getById = useCallback(
    (id: string): HistoryItem | undefined => {
      return history.find((h) => h.id === id)
    },
    [history],
  )

  return {
    history,
    add,
    remove,
    clear,
    getById,
    count: history.length,
  }
}

/**
 * 根据生成请求与结果组装一条可写入历史的数据。
 *
 * 取 result.provider 作为 provider，request.mode 作为 mode，
 * 完整保留 request 与 result.images。返回值不含 id 与 createdAt，
 * 交由 useHistory.add 自动补充。
 *
 * 使用示例（后续 App 集成）：
 * ```ts
 * const item = history.add(createHistoryItemFromResult(request, result))
 * ```
 *
 * @param request - 生成请求参数
 * @param result - 生成结果
 * @returns 不含 id 与 createdAt 的历史条目
 */
export function createHistoryItemFromResult(
  request: GenerateRequest,
  result: GenerateResult,
): Omit<HistoryItem, 'id' | 'createdAt'> {
  return {
    provider: result.provider,
    mode: request.mode,
    request,
    images: result.images,
  }
}
