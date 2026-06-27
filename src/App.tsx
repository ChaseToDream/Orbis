/**
 * App 组件
 *
 * Orbis 图片生成工具的主界面，负责全局集成：
 * - 顶部标题栏（应用名 + 当前 provider + 移动端参数按钮 + 设置按钮）
 * - 三栏响应式布局（桌面 lg）/ 两栏（平板 md）/ 单栏 + 抽屉（移动端）
 * - 集成 PromptPanel / ModeSwitch / ImageUpload / ParamPanel / ResultPanel / HistoryPanel
 * - 集成 SettingsModal 与 Toast 全局通知
 * - 生成流程校验：prompt 非空、API Key 已配置、图生图模式参考图已上传
 * - 首次使用引导：未配置 API Key 时自动打开设置弹窗
 * - 历史记录复用：一键加载历史参数到当前 request
 */

import { useCallback, useEffect, useState } from 'react'
import { getProvider } from './adapters'
import { HistoryPanel } from './components/HistoryPanel'
import { ImageUpload } from './components/ImageUpload'
import { ModeSwitch } from './components/ModeSwitch'
import { ParamPanel } from './components/ParamPanel'
import { PromptPanel } from './components/PromptPanel'
import { ResultPanel } from './components/ResultPanel'
import { SettingsModal } from './components/SettingsModal'
import { Toast } from './components/Toast'
import { useGenerate } from './hooks/useGenerate'
import { createHistoryItemFromResult, useHistory } from './hooks/useHistory'
import { useSettings } from './hooks/useSettings'
import { useToast } from './hooks/useToast'
import type { GenerateMode, GenerateRequest, HistoryItem } from './types'
import './App.css'

/** 默认生成请求参数 */
const DEFAULT_REQUEST: GenerateRequest = {
  mode: 'text2img',
  prompt: '',
  negativePrompt: '',
  size: { width: 1024, height: 1024 },
  count: 1,
  style: 'none',
  steps: 30,
  cfgScale: 7,
  seed: undefined,
  referenceImage: undefined,
  denoisingStrength: 0.75,
}

/** 设置齿轮图标 */
function GearIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33h.01a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.01a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** 抽屉触发图标（滑块） */
function SlidersIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 6h16M4 12h16M4 18h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle
        cx="9"
        cy="6"
        r="2"
        fill="white"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle
        cx="15"
        cy="12"
        r="2"
        fill="white"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle
        cx="7"
        cy="18"
        r="2"
        fill="white"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  )
}

/** 关闭图标 */
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
        d="M6 6l12 12M6 18L18 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** 向下箭头图标 */
function ChevronDownIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * App —— Orbis 图片生成工具主组件
 */
function App() {
  // 来自 hooks
  const { currentProvider, hasApiKey } = useSettings()
  const { generate, isLoading, error, lastResult, reset } = useGenerate()
  const {
    history,
    add: addHistory,
    remove: removeHistory,
    clear: clearHistory,
  } = useHistory()
  const { toasts, show, dismiss } = useToast()

  // 本地 UI 状态
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [request, setRequest] = useState<GenerateRequest>(DEFAULT_REQUEST)
  const [drawerOpen, setDrawerOpen] = useState(false) // 移动端参数面板抽屉
  const [historyCollapsed, setHistoryCollapsed] = useState(true) // 移动端历史折叠

  // 当前 provider 与 paramMeta
  const provider = getProvider(currentProvider)
  const paramMeta = provider.paramMeta

  // 监听 error 变化时显示 toast（useGenerate 的 error 是异步更新的 state）
  useEffect(() => {
    if (error) show(error, 'error')
  }, [error, show])

  // 首次使用引导：未配置 API Key 时自动打开设置弹窗
  useEffect(() => {
    if (!hasApiKey()) {
      setSettingsOpen(true)
      show('欢迎使用，请先配置 API Key', 'info')
    }
    // 仅在挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * 生成处理：
   * 1. 校验 prompt 非空
   * 2. 校验 API Key 已配置
   * 3. 图生图模式校验参考图
   * 4. 校验参数范围（尺寸 / 数量 / 步数 / CFG / 去噪强度 / 种子）
   * 5. 调用 generate
   * 6. 成功写入历史 + Toast；失败时 error 由 useEffect 监听并显示
   */
  const handleGenerate = useCallback(async () => {
    if (!request.prompt.trim()) {
      show('请输入提示词', 'error')
      return
    }
    if (!hasApiKey()) {
      show('请先在设置中配置 API Key', 'error')
      setSettingsOpen(true)
      return
    }
    if (request.mode === 'img2img' && !request.referenceImage) {
      show('请上传参考图', 'error')
      return
    }

    // 尺寸校验：宽高应在 256-2048 之间
    const { width, height } = request.size
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width < 256 ||
      width > 2048 ||
      height < 256 ||
      height > 2048
    ) {
      show('参数错误：尺寸宽高应在 256-2048 之间', 'error')
      return
    }

    // 生成数量校验：1 - paramMeta.maxCount
    const maxCount = paramMeta.maxCount
    if (
      !Number.isInteger(request.count) ||
      request.count < 1 ||
      request.count > maxCount
    ) {
      show(`参数错误：生成数量应在 1-${maxCount} 之间`, 'error')
      return
    }

    // 采样步数校验（若 paramMeta.supportsSteps 且 request.steps 存在）：1-50
    if (paramMeta.supportsSteps && request.steps != null) {
      if (
        !Number.isFinite(request.steps) ||
        request.steps < 1 ||
        request.steps > 50
      ) {
        show('参数错误：采样步数应在 1-50 之间', 'error')
        return
      }
    }

    // CFG Scale 校验（若 paramMeta.supportsCfgScale 且 request.cfgScale 存在）：1-30
    if (paramMeta.supportsCfgScale && request.cfgScale != null) {
      if (
        !Number.isFinite(request.cfgScale) ||
        request.cfgScale < 1 ||
        request.cfgScale > 30
      ) {
        show('参数错误：CFG Scale 应在 1-30 之间', 'error')
        return
      }
    }

    // denoisingStrength 校验（若 mode='img2img' 且存在）：0-1
    if (request.mode === 'img2img' && request.denoisingStrength != null) {
      if (
        !Number.isFinite(request.denoisingStrength) ||
        request.denoisingStrength < 0 ||
        request.denoisingStrength > 1
      ) {
        show('参数错误：去噪强度应在 0-1 之间', 'error')
        return
      }
    }

    // Seed 校验（若存在）：非负整数
    if (request.seed != null) {
      if (!Number.isInteger(request.seed) || request.seed < 0) {
        show('参数错误：种子应为非负整数', 'error')
        return
      }
    }

    const result = await generate(request)
    if (result) {
      addHistory(createHistoryItemFromResult(request, result))
      show(`生成成功，共 ${result.images.length} 张图片`, 'success')
    }
  }, [request, hasApiKey, generate, addHistory, show, paramMeta])

  /** 部分字段更新 */
  const handleRequestChange = useCallback((patch: Partial<GenerateRequest>) => {
    setRequest((prev) => ({ ...prev, ...patch }))
  }, [])

  /** 提示词字段更新 */
  const handlePromptChange = useCallback(
    (field: 'prompt' | 'negativePrompt', value: string) => {
      setRequest((prev) => ({ ...prev, [field]: value }))
    },
    [],
  )

  /** 生成模式切换 */
  const handleModeChange = useCallback((mode: GenerateMode) => {
    setRequest((prev) => ({ ...prev, mode }))
  }, [])

  /** 历史记录复用：加载历史参数到当前 request，并滚动到顶部 */
  const handleReuse = useCallback(
    (item: HistoryItem) => {
      const r = item.request
      setRequest({
        mode: r.mode,
        prompt: r.prompt,
        negativePrompt: r.negativePrompt ?? '',
        size: { ...r.size },
        count: r.count,
        style: r.style,
        steps: r.steps,
        cfgScale: r.cfgScale,
        seed: r.seed,
        referenceImage: r.referenceImage,
        denoisingStrength: r.denoisingStrength ?? 0.75,
      })
      show('已加载历史参数', 'info')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [show],
  )

  /** 删除历史记录 */
  const handleDelete = useCallback(
    (id: string) => {
      removeHistory(id)
      show('已删除', 'success')
    },
    [removeHistory, show],
  )

  /** 清空历史记录 */
  const handleClear = useCallback(() => {
    clearHistory()
    show('已清空历史', 'success')
  }, [clearHistory, show])

  /** 历史记录选中（HistoryPanel 内部已有详情弹窗，此处无需额外处理） */
  const handleSelect = useCallback((_item: HistoryItem) => {
    // no-op
  }, [])

  /** 重试：重置状态后重新生成 */
  const handleRetry = useCallback(() => {
    reset()
    void handleGenerate()
  }, [reset, handleGenerate])

  /** 输入区扩展内容：ModeSwitch + ImageUpload + ParamPanel（桌面/平板显示在左栏，移动端显示在抽屉） */
  const renderInputExtras = () => (
    <div className="space-y-4">
      <ModeSwitch
        mode={request.mode}
        onChange={handleModeChange}
        img2imgAvailable={paramMeta.supportsImg2Img}
      />
      {request.mode === 'img2img' && paramMeta.supportsImg2Img && (
        <ImageUpload
          value={request.referenceImage}
          onChange={(base64) => handleRequestChange({ referenceImage: base64 })}
        />
      )}
      <ParamPanel
        request={request}
        onChange={handleRequestChange}
        paramMeta={paramMeta}
      />
    </div>
  )

  /** 生成按钮：isLoading 时显示 spinner 与"生成中..."，否则显示"生成" */
  const renderGenerateButton = () => (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={isLoading || !request.prompt.trim()}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-400"
    >
      {isLoading ? (
        <>
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            aria-hidden="true"
          />
          生成中...
        </>
      ) : (
        '生成'
      )}
    </button>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* 顶部标题栏 */}
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">
            Orbis 图片生成工具
          </h1>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-gray-600 sm:inline">
              {provider.displayName}
            </span>
            {/* 移动端参数按钮：打开抽屉 */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="打开参数面板"
              className="flex h-9 items-center gap-1 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 md:hidden"
            >
              <SlidersIcon />
              参数
            </button>
            {/* 设置按钮 */}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="打开设置"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <GearIcon />
            </button>
          </div>
        </header>

        {/* 三栏响应式布局：移动端单栏，平板两栏（输入区占左侧两行），桌面三栏 */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12">
          {/* 左栏：输入区（PromptPanel 始终显示，扩展内容仅 md+ 显示） */}
          <div className="md:row-span-2 lg:row-span-1 lg:col-span-4">
            <div className="rounded-lg bg-white p-4 shadow">
              <div className="space-y-4">
                <PromptPanel
                  prompt={request.prompt}
                  negativePrompt={request.negativePrompt ?? ''}
                  onChange={handlePromptChange}
                  showNegative={paramMeta.supportsNegativePrompt}
                />
                {/* 扩展内容：md+ 显示在左栏，移动端通过抽屉查看 */}
                <div className="hidden md:block">{renderInputExtras()}</div>
              </div>
            </div>
          </div>

          {/* 中栏：生成按钮 + ResultPanel */}
          <div className="flex flex-col gap-4 lg:col-span-5">
            {renderGenerateButton()}
            <div className="flex-1 rounded-lg bg-white p-4 shadow">
              <div className="min-h-[400px] md:min-h-[500px]">
                <ResultPanel
                  isLoading={isLoading}
                  error={error}
                  result={lastResult}
                  onRetry={handleRetry}
                />
              </div>
            </div>
          </div>

          {/* 右栏：历史记录（移动端可折叠） */}
          <div className="lg:col-span-3">
            <div className="rounded-lg bg-white p-4 shadow">
              {/* 移动端折叠按钮 */}
              <button
                type="button"
                onClick={() => setHistoryCollapsed((v) => !v)}
                aria-expanded={!historyCollapsed}
                className="flex w-full items-center justify-between md:hidden"
              >
                <span className="text-sm font-medium text-gray-700">
                  历史记录 ({history.length})
                </span>
                <span
                  className={`transition-transform ${
                    historyCollapsed ? '' : 'rotate-180'
                  }`}
                >
                  <ChevronDownIcon />
                </span>
              </button>
              {/* HistoryPanel：md+ 始终显示，移动端按折叠状态显示 */}
              <div
                className={`${
                  historyCollapsed ? 'hidden md:block' : 'mt-3 block md:mt-0'
                }`}
              >
                <HistoryPanel
                  history={history}
                  onSelect={handleSelect}
                  onReuse={handleReuse}
                  onDelete={handleDelete}
                  onClear={handleClear}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 移动端参数抽屉：从右侧滑入 */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="参数面板"
        >
          {/* 遮罩 */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
          />
          {/* 抽屉面板 */}
          <div className="absolute right-0 top-0 flex h-full w-80 max-w-[80vw] flex-col bg-white shadow-xl">
            {/* 抽屉头部 */}
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h2 className="text-sm font-medium text-gray-800">参数面板</h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="关闭参数面板"
                className="flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                <CloseIcon />
              </button>
            </div>
            {/* 抽屉内容（可滚动） */}
            <div className="flex-1 overflow-auto p-4">
              {renderInputExtras()}
            </div>
          </div>
        </div>
      )}

      {/* 设置弹窗 */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Toast 全局通知 */}
      <Toast toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

export default App
