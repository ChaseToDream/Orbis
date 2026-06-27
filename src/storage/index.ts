/**
 * 本地存储封装 (Storage)
 *
 * 统一封装浏览器 localStorage 的读写操作：
 * - 命名空间前缀：'orbis:'
 * - 所有操作均经过 try/catch，避免因隐私模式或配额超限导致抛错
 * - SSR 安全：在非浏览器环境（typeof window === 'undefined'）下安全降级
 * - 读取时自动 JSON 解析，写入时自动 JSON 序列化
 *
 * 约定：所有传入 get/set/remove/has 的 key 应为完整键名（已包含 'orbis:' 前缀），
 * 推荐统一使用 STORAGE_KEYS 常量以避免拼写错误。
 */

/** 命名空间前缀，所有由本模块管理的键均以此开头 */
const NAMESPACE_PREFIX = 'orbis:'

/**
 * 存储键常量集合
 *
 * 集中维护所有 localStorage 键名（已包含 'orbis:' 前缀），
 * 避免散落在各业务模块中产生拼写错误。
 */
export const STORAGE_KEYS = {
  /** 用户设置（提供商、API Key 等） */
  SETTINGS: `${NAMESPACE_PREFIX}settings`,
  /** 历史记录条目列表 */
  HISTORY: `${NAMESPACE_PREFIX}history`,
} as const

/**
 * 判断当前是否处于浏览器环境且 localStorage 可用。
 *
 * 在 SSR 或隐私模式下 localStorage 可能不可用，此函数用于做安全降级判断。
 *
 * @returns 是否可用 localStorage
 */
function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const testKey = `${NAMESPACE_PREFIX}__availability_test__`
    window.localStorage.setItem(testKey, '1')
    window.localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

/**
 * 读取并 JSON 解析指定键的值。
 *
 * - 若处于非浏览器环境或 localStorage 不可用，直接返回 fallback
 * - 若键不存在或 JSON 解析失败，返回 fallback
 * - 任何异常均被吞掉并返回 fallback，保证调用方零异常
 *
 * @param key - 完整存储键名（应包含 'orbis:' 前缀，推荐使用 STORAGE_KEYS 常量）
 * @param fallback - 读取失败时返回的默认值
 * @returns 解析后的值或 fallback
 */
export function get<T>(key: string, fallback: T): T {
  if (!isLocalStorageAvailable()) return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/**
 * 将值 JSON 序列化后写入 localStorage。
 *
 * - 捕获 QuotaExceededError、SecurityError 等异常，避免抛出中断业务
 * - 写入失败时仅打印警告，不抛错
 *
 * @param key - 完整存储键名（应包含 'orbis:' 前缀，推荐使用 STORAGE_KEYS 常量）
 * @param value - 任意可序列化的值
 */
export function set<T>(key: string, value: T): void {
  if (!isLocalStorageAvailable()) return
  try {
    const serialized = JSON.stringify(value)
    window.localStorage.setItem(key, serialized)
  } catch (err) {
    // 捕获 QuotaExceededError、SecurityError 等异常
    console.warn('[orbis:storage] 写入失败', key, err)
  }
}

/**
 * 删除单个存储键。
 *
 * 删除不存在的键不会抛错。
 *
 * @param key - 完整存储键名（应包含 'orbis:' 前缀，推荐使用 STORAGE_KEYS 常量）
 */
export function remove(key: string): void {
  if (!isLocalStorageAvailable()) return
  try {
    window.localStorage.removeItem(key)
  } catch (err) {
    console.warn('[orbis:storage] 删除失败', key, err)
  }
}

/**
 * 判断指定键是否存在。
 *
 * 仅判断键是否存在，不读取内容。在非浏览器环境下返回 false。
 *
 * @param key - 完整存储键名（应包含 'orbis:' 前缀，推荐使用 STORAGE_KEYS 常量）
 * @returns 键是否存在
 */
export function has(key: string): boolean {
  if (!isLocalStorageAvailable()) return false
  try {
    return window.localStorage.getItem(key) !== null
  } catch {
    return false
  }
}

/**
 * 清除所有命名空间下的键。
 *
 * 仅清除以 'orbis:' 开头的键，避免误删其它库或业务的数据。
 * 遍历过程中先收集待删除键再统一删除，防止删除过程中索引错乱。
 */
export function clearAll(): void {
  if (!isLocalStorageAvailable()) return
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && k.startsWith(NAMESPACE_PREFIX)) {
        keysToRemove.push(k)
      }
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k))
  } catch (err) {
    console.warn('[orbis:storage] 清除失败', err)
  }
}
