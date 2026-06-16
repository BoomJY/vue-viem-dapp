// useWallet:钱包连接 + 账户/链状态管理。
//
// 设计要点:
//  - 模块级单例。所有组件 import 同一份响应式状态,连一次全局生效。
//  - 监听 accountsChanged / chainChanged,用户在 MetaMask 里切账户/切链时自动同步。
//  - 区分「目标链」(.env 配置)与「钱包当前链」,不一致时给出切换提示。
//  - 不持有私钥;一切签名都交给 MetaMask。
import { computed, readonly, ref } from 'vue'
import { formatEther, type Address } from 'viem'
import { publicClient, createInjectedWalletClient } from '@/config/clients'
import { activeChain } from '@/config'
import { formatError } from './useErrorMessage'

// ---- 模块级响应式状态(单例) ----
const account = ref<Address | null>(null) // 当前连接的地址
const walletChainId = ref<number | null>(null) // 钱包当前所在链
const ethBalance = ref<bigint | null>(null) // 原生币(ETH)余额,wei
const connecting = ref(false) // 是否正在连接
const error = ref<string | null>(null) // 最近一次错误提示

// 是否已经注册过钱包事件监听,避免重复绑定。
let listenersBound = false

/** 是否检测到注入式钱包 */
const hasWallet = computed(() => typeof window !== 'undefined' && !!window.ethereum)

/** 是否已连接 */
const isConnected = computed(() => account.value !== null)

/** 钱包当前链是否与目标链一致 */
const isWrongNetwork = computed(
  () => walletChainId.value !== null && walletChainId.value !== activeChain.id,
)

/** ETH 余额的可读字符串(保留 4 位小数) */
const ethBalanceFormatted = computed(() => {
  if (ethBalance.value === null) return '—'
  const full = formatEther(ethBalance.value)
  const n = Number(full)
  return Number.isFinite(n) ? n.toFixed(4) : full
})

/** 刷新当前账户的 ETH 余额 */
async function refreshEthBalance(): Promise<void> {
  if (!account.value) {
    ethBalance.value = null
    return
  }
  try {
    ethBalance.value = await publicClient.getBalance({ address: account.value })
  } catch (e) {
    // 余额读取失败不阻断主流程,仅记录。
    console.error('[useWallet] 读取 ETH 余额失败:', e)
    ethBalance.value = null
  }
}

// 读取钱包当前链 ID(eth_chainId 返回 0x 十六进制)。
async function readChainId(): Promise<void> {
  if (!window.ethereum) return
  const hex = (await window.ethereum.request({ method: 'eth_chainId' })) as string
  walletChainId.value = Number.parseInt(hex, 16)
}

// 处理账户变更:断开 / 切换。
function handleAccountsChanged(...args: unknown[]): void {
  const accounts = (args[0] as string[]) ?? []
  if (accounts.length === 0) {
    // 用户在钱包里断开了所有账户
    account.value = null
    ethBalance.value = null
  } else {
    account.value = accounts[0] as Address
    void refreshEthBalance()
  }
}

// 处理链变更。MetaMask 文档建议链切换后刷新页面;这里改为软刷新状态。
function handleChainChanged(...args: unknown[]): void {
  const hex = args[0] as string
  walletChainId.value = Number.parseInt(hex, 16)
  void refreshEthBalance()
}

// 绑定一次钱包事件监听。
function bindListeners(): void {
  if (listenersBound || !window.ethereum) return
  window.ethereum.on('accountsChanged', handleAccountsChanged)
  window.ethereum.on('chainChanged', handleChainChanged)
  listenersBound = true
}

/**
 * 连接钱包:请求授权账户,读取链与余额。
 */
async function connect(): Promise<void> {
  error.value = null
  if (!window.ethereum) {
    error.value = '未检测到 MetaMask,请先安装浏览器钱包扩展。'
    return
  }
  connecting.value = true
  try {
    const walletClient = createInjectedWalletClient()
    // requestAddresses 触发 MetaMask 授权弹窗(eth_requestAccounts)
    const accounts = await walletClient.requestAddresses()
    account.value = accounts[0] ?? null
    await readChainId()
    await refreshEthBalance()
    bindListeners()
  } catch (e) {
    error.value = formatError(e)
  } finally {
    connecting.value = false
  }
}

/**
 * 请求钱包切换到目标链(EIP-3326 wallet_switchEthereumChain)。
 * 若钱包里没有该链,会提示用户手动添加。
 */
async function switchToTargetChain(): Promise<void> {
  error.value = null
  if (!window.ethereum) return
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${activeChain.id.toString(16)}` }],
    })
    await readChainId()
    await refreshEthBalance()
  } catch (e) {
    // 4902 = 钱包中尚未添加该链
    const code = (e as { code?: number })?.code
    if (code === 4902) {
      error.value = `请在钱包中手动添加 ${activeChain.name}(链 ID ${activeChain.id})。`
    } else {
      error.value = formatError(e)
    }
  }
}

/**
 * 「断开」连接。注入式钱包没有真正的断开 API,
 * 这里只清空本地状态(用户下次需重新授权连接)。
 */
function disconnect(): void {
  account.value = null
  ethBalance.value = null
  error.value = null
}

/**
 * 尝试静默恢复连接(页面刷新后)。
 * 用 eth_accounts(不弹窗)读取已授权账户,有则恢复状态。
 */
async function tryEagerConnect(): Promise<void> {
  if (!window.ethereum) return
  try {
    const accounts = (await window.ethereum.request({
      method: 'eth_accounts',
    })) as string[]
    if (accounts.length > 0) {
      account.value = accounts[0] as Address
      await readChainId()
      await refreshEthBalance()
      bindListeners()
    }
  } catch (e) {
    console.error('[useWallet] eager connect 失败:', e)
  }
}

/**
 * 组合式函数入口。返回只读状态 + 操作方法。
 * 注意:状态是模块级单例,多次调用拿到的是同一份。
 */
export function useWallet() {
  return {
    // 只读状态
    account: readonly(account),
    walletChainId: readonly(walletChainId),
    ethBalance: readonly(ethBalance),
    ethBalanceFormatted,
    connecting: readonly(connecting),
    error: readonly(error),
    hasWallet,
    isConnected,
    isWrongNetwork,
    targetChain: activeChain,
    // 方法
    connect,
    disconnect,
    switchToTargetChain,
    refreshEthBalance,
    tryEagerConnect,
  }
}
