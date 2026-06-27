/**
 * SettingsModal 组件
 *
 * 提供用户设置的模态编辑界面：
 * - 提供商 Tab 切换（dalle / stability）
 * - 编辑当前提供商的 API Key / Base URL / Model
 * - 受控表单，失焦或点击"保存"时写入 settings（同步到 localStorage）
 * - 支持点击遮罩或按 ESC 关闭
 * - 支持"清除所有配置"（带二次确认）
 */

import { useEffect, useState, type MouseEvent } from 'react'
import type { ProviderId } from '../types'
import { useSettings } from '../hooks/useSettings'

/** 提供商 Tab 配置 */
const PROVIDER_TABS: ReadonlyArray<{ id: ProviderId; label: string }> = [
  { id: 'dalle', label: 'DALL·E' },
  { id: 'stability', label: 'Stability' },
]

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
  const { settings, updateProviderConfig, clearAllSettings } = useSettings()

  // 模态框内当前选中的 Tab（独立于全局 currentProvider，避免切换 Tab 时副作用外溢）
  const [activeTab, setActiveTab] = useState<ProviderId>(
    settings.currentProvider,
  )

  // 表单受控状态
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)

  // 打开模态框时，将 activeTab 同步为全局 currentProvider
  useEffect(() => {
    if (!open) return
    setActiveTab(settings.currentProvider)
  }, [open, settings.currentProvider])

  // 打开或切换 Tab 或外部 providers 变化时，同步表单初始值
  useEffect(() => {
    if (!open) return
    const cfg = settings.providers[activeTab] ?? { apiKey: '' }
    setApiKey(cfg.apiKey ?? '')
    setBaseUrl(cfg.baseUrl ?? '')
    setModel(cfg.model ?? '')
  }, [open, activeTab, settings.providers])

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

  // 关闭时重置密码可见性，避免下次打开残留
  useEffect(() => {
    if (!open) {
      setShowApiKey(false)
    }
  }, [open])

  if (!open) return null

  /**
   * 将当前表单值写入 settings（同步到 localStorage）。
   *
   * - apiKey 去除首尾空白
   * - baseUrl / model 为空字符串时不写入（设为 undefined）
   */
  const persistCurrentForm = () => {
    updateProviderConfig(activeTab, {
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim() || undefined,
      model: model.trim() || undefined,
    })
  }

  /** 切换 Tab：先持久化当前表单，再切换 */
  const handleTabChange = (id: ProviderId) => {
    if (id === activeTab) return
    persistCurrentForm()
    setActiveTab(id)
  }

  /** 保存按钮 */
  const handleSave = () => {
    persistCurrentForm()
  }

  /** 清除所有配置（带二次确认） */
  const handleClearAll = () => {
    const confirmed = window.confirm('确定要清除所有配置吗？此操作不可撤销。')
    if (!confirmed) return
    clearAllSettings()
    onCleared?.()
  }

  /** 遮罩点击关闭 */
  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    // 仅当点击目标正是遮罩本身时才关闭，避免点击卡片冒泡误触
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

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
          <h2 className="text-lg font-semibold text-gray-900">设置</h2>
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
          {/* 提供商 Tab */}
          <div
            className="mb-4 flex gap-2"
            role="tablist"
            aria-label="提供商选择"
          >
            {PROVIDER_TABS.map((tab) => {
              const isActive = tab.id === activeTab
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={
                    'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ' +
                    (isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
                  }
                  onClick={() => handleTabChange(tab.id)}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

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
                  placeholder="请输入 API Key"
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
            </div>

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
                placeholder={
                  activeTab === 'dalle'
                    ? 'https://api.openai.com/v1'
                    : 'https://api.stability.ai'
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoComplete="off"
              />
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
                placeholder={
                  activeTab === 'dalle' ? 'dall-e-3' : 'stable-diffusion-xl'
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoComplete="off"
              />
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
