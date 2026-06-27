/**
 * useGenerate Hook
 *
 * 封装图像生成的执行流程：
 * - 依赖 useSettings 获取当前 provider 与对应 config
 * - 调用前校验 API Key 与 provider 配置
 * - 调用对应 provider 的 generate 方法
 * - 维护 isLoading / error / lastResult 状态
 *
 * 错误归一化：
 * - ProviderError 优先使用其 message
 * - 普通 Error 使用其 message
 * - 其它未知错误返回兜底文案
 */

import { useCallback, useState } from 'react'
import { getProvider, ProviderError } from '../adapters'
import type { GenerateRequest, GenerateResult } from '../types'
import { useSettings } from './useSettings'

/** useGenerate 返回值 */
export interface UseGenerateReturn {
  /** 执行生成；失败时返回 null */
  generate: (request: GenerateRequest) => Promise<GenerateResult | null>
  /** 是否正在生成 */
  isLoading: boolean
  /** 最近一次错误信息（无错误时为 null） */
  error: string | null
  /** 最近一次成功结果（无结果时为 null） */
  lastResult: GenerateResult | null
  /** 重置状态：清空 error 与 lastResult，并将 isLoading 置为 false */
  reset: () => void
}

/**
 * 将任意错误归一化为可读字符串。
 *
 * @param err - 任意错误
 * @returns 友好的错误消息
 */
function toErrorMessage(err: unknown): string {
  if (err instanceof ProviderError) {
    return err.message || '生成失败'
  }
  if (err instanceof Error) {
    return err.message || '生成失败'
  }
  return '生成失败'
}

/**
 * useGenerate —— 管理图像生成流程的 Hook
 *
 * @returns 生成相关状态与操作方法
 */
export function useGenerate(): UseGenerateReturn {
  const { settings, currentProvider, hasApiKey } = useSettings()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<GenerateResult | null>(null)

  const generate = useCallback(
    async (request: GenerateRequest): Promise<GenerateResult | null> => {
      // 1. 校验 API Key 是否已配置
      if (!hasApiKey(currentProvider)) {
        setError('请先在设置中配置 API Key')
        return null
      }

      const config = settings.providers[currentProvider] ?? { apiKey: '' }
      const provider = getProvider(currentProvider)

      // 2. 校验 provider 配置
      const validation = provider.validateConfig(config)
      if (!validation.valid) {
        setError(validation.message || '当前提供商配置无效')
        return null
      }

      // 3. 调用 provider.generate
      setIsLoading(true)
      setError(null)
      try {
        const result = await provider.generate(request, config)
        setLastResult(result)
        return result
      } catch (err) {
        setError(toErrorMessage(err))
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [settings.providers, currentProvider, hasApiKey],
  )

  const reset = useCallback(() => {
    setIsLoading(false)
    setError(null)
    setLastResult(null)
  }, [])

  return {
    generate,
    isLoading,
    error,
    lastResult,
    reset,
  }
}
