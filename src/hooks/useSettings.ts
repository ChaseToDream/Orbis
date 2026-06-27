/**
 * useSettings Hook
 *
 * 提供对用户设置（Settings）的统一读写能力：
 * - 启动时从 localStorage 读取（key 为 STORAGE_KEYS.SETTINGS）
 * - 任何变更都通过 useEffect 自动同步回 localStorage
 * - 暴露切换提供商、合并更新提供商配置、清除全部设置等操作
 *
 * 使用 useState + useEffect + useCallback 实现，保证引用稳定性与性能。
 */

import { useCallback, useEffect, useState } from 'react'
import type { ApiProviderConfig, ProviderId, Settings } from '../types'
import { get, remove, set, STORAGE_KEYS } from '../storage'

/**
 * 创建一份默认设置的深拷贝。
 *
 * 每次调用均返回全新对象，避免多处引用共享同一份常量导致意外副作用。
 *
 * @returns 默认设置对象
 */
function createDefaultSettings(): Settings {
  return {
    // 当前 API 服务已切换为 OpenAI 兼容模式，仅保留单一提供商
    currentProvider: 'openai',
    providers: {
      openai: { apiKey: '' },
    },
  }
}

/**
 * 从 localStorage 加载设置。
 *
 * 若读取或解析失败，返回一份新的默认设置。
 *
 * @returns 当前持久化的设置或默认设置
 */
function loadSettings(): Settings {
  // 每次传入新创建的默认对象，避免 fallback 被外部修改后污染
  return get<Settings>(STORAGE_KEYS.SETTINGS, createDefaultSettings())
}

/**
 * useSettings —— 管理用户设置的 Hook
 *
 * @returns 设置相关状态与操作方法集合
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  // 任何 settings 变更都同步写入 localStorage
  useEffect(() => {
    set(STORAGE_KEYS.SETTINGS, settings)
  }, [settings])

  /**
   * 切换当前选中的提供商
   *
   * @param id - 目标提供商标识
   */
  const setCurrentProvider = useCallback((id: ProviderId) => {
    setSettings((prev) => ({ ...prev, currentProvider: id }))
  }, [])

  /**
   * 合并更新指定提供商的配置。
   *
   * 仅传入需要更新的字段，其余字段保持不变。
   *
   * @param id - 目标提供商标识
   * @param config - 需要合并的字段
   */
  const updateProviderConfig = useCallback(
    (id: ProviderId, config: Partial<ApiProviderConfig>) => {
      setSettings((prev) => {
        const existing = prev.providers[id] ?? { apiKey: '' }
        return {
          ...prev,
          providers: {
            ...prev.providers,
            [id]: { ...existing, ...config },
          },
        }
      })
    },
    [],
  )

  /**
   * 清除所有设置：移除 localStorage 中的设置项并重置内存状态为默认值。
   */
  const clearAllSettings = useCallback(() => {
    remove(STORAGE_KEYS.SETTINGS)
    setSettings(createDefaultSettings())
  }, [])

  /**
   * 判断当前或指定提供商是否已配置 API Key。
   *
   * 仅当 apiKey 为非空白字符串时视为已配置。
   *
   * @param provider - 可选，未传则使用当前选中提供商
   * @returns 是否已配置 API Key
   */
  const hasApiKey = useCallback(
    (provider?: ProviderId): boolean => {
      const id = provider ?? settings.currentProvider
      const cfg = settings.providers[id]
      return Boolean(
        cfg && typeof cfg.apiKey === 'string' && cfg.apiKey.trim().length > 0,
      )
    },
    [settings.currentProvider, settings.providers],
  )

  return {
    /** 当前完整设置对象 */
    settings,
    /** 当前选中的提供商 */
    currentProvider: settings.currentProvider,
    /** 切换当前提供商 */
    setCurrentProvider,
    /** 合并更新指定提供商配置 */
    updateProviderConfig,
    /** 清除所有设置 */
    clearAllSettings,
    /** 判断当前/指定提供商是否已配置 API Key */
    hasApiKey,
  }
}
