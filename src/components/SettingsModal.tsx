/**
 * SettingsModal 组件
 *
 * 提供用户设置的模态编辑界面：
 * - 支持切换提供商（OpenAI 兼容 / Agnes Image 2.1 Flash）
 * - 编辑当前提供商的配置（API Key / Base URL / Model / 请求超时）
 * - 受控表单，失焦或点击"保存"时写入 settings（同步到 localStorage）
 * - 内置「测试连接」功能：调用 /v1/models 验证认证与连通性
 * - 支持点击遮罩或按 ESC 关闭
 * - 支持"清除所有配置"（带二次确认）
 */

import { useEffect, useState, type MouseEvent } from 'react'
import { getProvider, openaiTestConnection, agnesTestConnection } from '../adapters'
import type { ApiProviderConfig, ProviderId } from '../types'
import { useSettings } from '../hooks/useSettings'

/** 各提供商的连接测试函数映射 */
const testConnectionMap: Record<ProviderId, typeof openaiTestConnection> = {
  openai: openaiTestConnection,
  agnes: agnesTestConnection,
}

/** 默认请求超时（秒），对应适配器内部 30000ms */
const DEFAULT_TIMEOUT_SECONDS = 30
/** 请求超时秒数范围 */
const MIN_TIMEOUT_SECONDS = 1
const MAX_TIMEOUT_SECONDS = 300

/** 连接测试状态 */
type TestStatus =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }

/** SettingsModal 组件 Props */
export interface SettingsModalProps {
  /** 是否打开 */
  open: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 清除所有配置后的回调（可选） */
  onCleared?: () => void
}

/**
 * 将毫秒超时转换为秒数（用于表单展示）。
 *
 * 非有效数值时回退到默认秒数。
 *
 * @param ms - 毫秒超时
 * @returns 秒数
 */
function msToSeconds(ms: number | undefined): number {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) {
    return DEFAULT_TIMEOUT_SECONDS
  }
  return Math.round(ms / 1000)
}

/**
 * 将秒数转换为毫秒超时（用于持久化）。
 *
 * @param seconds - 秒数
 * @returns 毫秒数
 */
function secondsToMs(seconds: number): number {
  return Math.max(1, Math.round(seconds)) * 1000
}

/**
 * SettingsModal —— 设置模态框
 *
 * @param props - 组件属性
 * @returns 模态框 JSX（关闭时返回 null）
 */
export function SettingsModal({
  open,
  onClose,
  onCleared,
}: SettingsModalProps) {
  const { settings, currentProvider, setCurrentProvider, updateProviderConfig, clearAllSettings } = useSettings()

  // 表单受控状态
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [timeoutSeconds, setTimeoutSeconds] = useState<number>(
    DEFAULT_TIMEOUT_SECONDS,
  )
  const [showApiKey, setShowApiKey] = useState(false)

  // 连接测试状态
  const [testStatus, setTestStatus] = useState<TestStatus>({ kind: 'idle' })

  // 打开或外部 providers 变化时，同步表单初始值
  useEffect(() => {
    if (!open) return
    const cfg = settings.providers[currentProvider] ?? { apiKey: '' }
    setApiKey(cfg.apiKey ?? '')
    setBaseUrl(cfg.baseUrl ?? '')
    setModel(cfg.model ?? '')
    setTimeoutSeconds(msToSeconds(cfg.timeout))
    // 重置测试状态，避免上次结果残留
    setTestStatus({ kind: 'idle' })
  }, [open, settings.providers, currentProvider])

  // ESC 键关闭
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // 关闭时重置密码可见性与测试状态，避免下次打开残留
  useEffect(() => {
    if (!open) {
      setShowApiKey(false)
      setTestStatus({ kind: 'idle' })
    }
  }, [open])

  if (!open) return null

  /**
   * 将当前表单值组装为完整的 ApiProviderConfig。
   *
   * apiKey 始终为字符串（可能为空串），baseUrl / model 为空时设为 undefined，
   * timeout 由秒数换算为毫秒。该对象既可用于 updateProviderConfig（兼容 Partial），
   * 也可直接传给 testConnection 进行连接测试。
   */
  const buildConfigPatch = (): ApiProviderConfig => {
    if (currentProvider === 'agnes') {
      return {
        apiKey: apiKey.trim(),
        baseUrl: undefined,
        model: undefined,
        timeout: undefined,
      }
    }
    return {
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim() || undefined,
      model: model.trim() || undefined,
      timeout: secondsToMs(timeoutSeconds),
    }
  }

  /**
   * 将当前表单值写入 settings（同步到 localStorage）。
   */
  const persistCurrentForm = () => {
    updateProviderConfig(currentProvider, buildConfigPatch())
  }

  /** 保存按钮 */
  const handleSave = () => {
    persistCurrentForm()
  }

  /**
   * 测试连接：先持久化当前表单，再调用 testConnection。
   *
   * 使用当前表单值（而非已持久化值）即时测试，确保用户最近输入生效。
   * 测试期间禁用按钮并展示 loading 文案，结果以成功/失败提示展示。
   */
  const handleTestConnection = async () => {
    // 先保存，保证测试与后续生成使用同一份配置
    persistCurrentForm()
    setTestStatus({ kind: 'testing' })
    const result = await testConnectionMap[currentProvider](buildConfigPatch())
    setTestStatus(
      result.ok
        ? { kind: 'success', message: result.message }
        : { kind: 'error', message: result.message },
    )
  }

  /** 清除所有配置（带二次确认） */
  const handleClearAll = () => {
    const confirmed = window.confirm('确定要清除所有配置吗？此操作不可撤销。')
    if (!confirmed) return
    clearAllSettings()
    setTestStatus({ kind: 'idle' })
    onCleared?.()
  }

  /** 遮罩点击关闭 */
  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    // 仅当点击目标正是遮罩本身时才关闭，避免点击卡片冒泡误触
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // 连接测试状态文案与样式
  const testStatusNode = (() => {
    switch (testStatus.kind) {
      case 'idle':
        return null
      case 'testing':
        return (
          <p className="text-sm text-gray-500">
            <span
              className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-gray-500 align-middle"
              aria-hidden="true"
            />
            正在测试连接...
          </p>
        )
      case 'success':
        return (
          <p className="text-sm text-green-600">
            <span className="mr-1" aria-hidden="true">
              ✓
            </span>
            {testStatus.message}
          </p>
        )
      case 'error':
        return (
          <p className="text-sm text-red-600">
            <span className="mr-1" aria-hidden="true">
              ✕
            </span>
            {testStatus.message}
          </p>
        )
      default:
        return null
    }
  })()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={handleOverlayClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="设置"
        className="w-full max-w-md rounded-lg bg-white shadow-xl"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">设置</h2>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-gray-500">API 服务：</span>
              <select
                value={currentProvider}
                onChange={(e) => setCurrentProvider(e.target.value as ProviderId)}
                className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="openai">OpenAI 兼容</option>
                <option value="agnes">Agnes Image 2.1 Flash</option>
              </select>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭"
            className="flex h-8 w-8 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            onClick={onClose}
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
        </div>

        {/* 主体 */}
        <div className="px-6 py-4">
          {/* 表单字段 */}
          <div className="space-y-4">
            {/* API Key */}
            <div>
              <label
                htmlFor="settings-api-key"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                API Key
              </label>
              <div className="relative">
                <input
                  id="settings-api-key"
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onBlur={persistCurrentForm}
                  placeholder={
                    currentProvider === 'agnes'
                      ? '请输入 Agnes API Key'
                      : '请输入 API Key（如 sk-...）'
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 pr-16 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-medium text-gray-500 hover:text-gray-700"
                  aria-label={showApiKey ? '隐藏 API Key' : '显示 API Key'}
                >
                  {showApiKey ? '隐藏' : '显示'}
                </button>
              </div>
              {currentProvider === 'agnes' && (
                <p className="mt-1 text-xs text-gray-400">
                  其他参数（Base URL、模型、超时）使用官方默认值，无需手动配置。
                </p>
              )}
            </div>

            {currentProvider === 'openai' && (
              <>
                {/* Base URL */}
                <div>
                  <label
                    htmlFor="settings-base-url"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Base URL
                    <span className="ml-1 text-xs font-normal text-gray-400">
                      （可选）
                    </span>
                  </label>
                  <input
                    id="settings-base-url"
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    onBlur={persistCurrentForm}
                    placeholder="https://api.openai.com"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoComplete="off"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    OpenAI 兼容接口的基础地址，可填自建反代地址。
                  </p>
                </div>

                {/* Model */}
                <div>
                  <label
                    htmlFor="settings-model"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Model
                    <span className="ml-1 text-xs font-normal text-gray-400">
                      （可选）
                    </span>
                  </label>
                  <input
                    id="settings-model"
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    onBlur={persistCurrentForm}
                    placeholder="dall-e-3"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoComplete="off"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    文生图默认 dall-e-3；图生图建议 dall-e-2。
                  </p>
                </div>

                {/* Request Timeout */}
                <div>
                  <label
                    htmlFor="settings-timeout"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    请求超时（秒）
                    <span className="ml-1 text-xs font-normal text-gray-400">
                      （{MIN_TIMEOUT_SECONDS}-{MAX_TIMEOUT_SECONDS}）
                    </span>
                  </label>
                  <input
                    id="settings-timeout"
                    type="number"
                    min={MIN_TIMEOUT_SECONDS}
                    max={MAX_TIMEOUT_SECONDS}
                    step={1}
                    value={timeoutSeconds}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setTimeoutSeconds(
                        Number.isFinite(v) ? v : DEFAULT_TIMEOUT_SECONDS,
                      )
                    }}
                    onBlur={persistCurrentForm}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoComplete="off"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    超过该时长未响应将中止请求并提示超时。
                  </p>
                </div>
              </>
            )}

            {/* 连接测试 */}
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-700">连接测试</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    调用 /v1/models 验证认证与连通性。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testStatus.kind === 'testing'}
                  className="rounded-md bg-gray-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {testStatus.kind === 'testing' ? '测试中...' : '测试连接'}
                </button>
              </div>
              {testStatusNode && <div className="mt-2">{testStatusNode}</div>}
            </div>
          </div>

          {/* 清除所有配置 */}
          <div className="mt-4">
            <button
              type="button"
              onClick={handleClearAll}
              className="text-sm font-medium text-red-600 hover:text-red-700"
            >
              清除所有配置
            </button>
          </div>
        </div>

        {/* 底部操作 */}
        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
          >
            关闭
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
