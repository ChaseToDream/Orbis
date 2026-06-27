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
    currentProvider: 'openai',
    providers: {
      openai: { apiKey: '' },
      agnes: { apiKey: '' },
    },
  }
}

/**
 * 校验并修补从 localStorage 加载的设置，确保与当前代码兼容。
 *
 * 即使旧版设置中缺少某些 provider，也会补齐默认配置。
 *
 * @param raw - 从 localStorage 反序列化得到的原始数据
 * @returns 修补后的合法 Settings 对象
 */
function normalizeSettings(raw: unknown): Settings {
  const defaults = createDefaultSettings()
  if (!raw || typeof raw !== 'object') return defaults

  const obj = raw as Record<string, unknown>
  const currentProvider =
    typeof obj.currentProvider === 'string' &&
    (obj.currentProvider === 'openai' || obj.currentProvider === 'agnes')
      ? (obj.currentProvider as ProviderId)
      : defaults.currentProvider

  const rawProviders = obj.providers
  const providers: Record<string, ApiProviderConfig> = {}

  // 确保所有已知 provider 都有配置
  for (const id of Object.keys(defaults.providers) as ProviderId[]) {
    const rawCfg =
      rawProviders && typeof rawProviders === 'object'
        ? (rawProviders as Record<string, unknown>)[id]
        : undefined
    if (rawCfg && typeof rawCfg === 'object') {
      const cfg = rawCfg as Record<string, unknown>
      providers[id] = {
        apiKey: typeof cfg.apiKey === 'string' ? cfg.apiKey : '',
        baseUrl: typeof cfg.baseUrl === 'string' ? cfg.baseUrl : undefined,
        model: typeof cfg.model === 'string' ? cfg.model : undefined,
        timeout:
          typeof cfg.timeout === 'number' ? cfg.timeout : undefined,
        extra:
          cfg.extra && typeof cfg.extra === 'object'
            ? (cfg.extra as Record<string, unknown>)
            : undefined,
      }
    } else {
      providers[id] = { apiKey: '' }
    }
  }

  return {
    currentProvider,
    providers: providers as Record<ProviderId, ApiProviderConfig>,
  }
}

/**
 * 从 localStorage 加载设置。
 *
 * 若读取或解析失败，返回一份新的默认设置。
 * 加载后通过 normalizeSettings 确保数据格式兼容。
 *
 * @returns 当前持久化的设置或默认设置
 */
function loadSettings(): Settings {
  const raw = get<unknown>(STORAGE_KEYS.SETTINGS, null)
  if (raw === null) return createDefaultSettings()
  return normalizeSettings(raw)
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
