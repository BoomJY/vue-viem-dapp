// useContract:ERC-20 合约读写。
//
// 读:用 publicClient.readContract / multicall 拉取 name/symbol/decimals/balanceOf。
// 写:严格走 viem 推荐的三段式 ——
//        simulateContract  → 先在节点上「干跑」,提前拿到 revert / 校验参数
//        writeContract     → 用 walletClient 真正发交易,拿到 txHash
//        waitForTransactionReceipt → 等待上链,根据 status 判断成功/失败
//
// 交易状态机:idle → pending → confirmed | failed
import { computed, readonly, ref } from 'vue'
import { formatUnits, parseUnits, type Address, type Hash } from 'viem'
import { publicClient, createInjectedWalletClient } from '@/config/clients'
import { tokenAddress, isTokenConfigured, activeChain } from '@/config'
import { erc20Abi } from '@/abi/erc20'
import { formatError } from './useErrorMessage'
import { useWallet } from './useWallet'

// 交易生命周期状态。
export type TxStatus = 'idle' | 'pending' | 'confirmed' | 'failed'

// 代币元数据。
interface TokenMeta {
  name: string
  symbol: string
  decimals: number
}

export function useContract() {
  const { account, refreshEthBalance } = useWallet()

  // ---- 代币只读状态 ----
  const meta = ref<TokenMeta | null>(null)
  const tokenBalance = ref<bigint | null>(null) // 原始 wei 余额
  const loadingMeta = ref(false)
  const loadingBalance = ref(false)

  // ---- 交易状态 ----
  const txStatus = ref<TxStatus>('idle')
  const txHash = ref<Hash | null>(null)
  const txError = ref<string | null>(null)

  /** 代币余额的可读字符串(按 decimals 换算) */
  const tokenBalanceFormatted = computed(() => {
    if (tokenBalance.value === null || !meta.value) return '—'
    const full = formatUnits(tokenBalance.value, meta.value.decimals)
    const n = Number(full)
    return Number.isFinite(n) ? n.toFixed(4) : full
  })

  /** 是否处于「发送中」(禁用按钮用) */
  const isSending = computed(() => txStatus.value === 'pending')

  // 内部:确保代币已配置且能拿到地址,否则抛错。
  function requireToken(): Address {
    if (!isTokenConfigured() || !tokenAddress) {
      throw new Error('尚未配置 ERC-20 合约地址,请在 .env 中填写 VITE_TOKEN_ADDRESS。')
    }
    return tokenAddress
  }

  /** 读取代币元数据(name/symbol/decimals),用 multicall 合并请求 */
  async function loadMeta(): Promise<void> {
    if (!isTokenConfigured()) return
    const address = requireToken()
    loadingMeta.value = true
    try {
      const results = await publicClient.multicall({
        contracts: [
          { address, abi: erc20Abi, functionName: 'name' },
          { address, abi: erc20Abi, functionName: 'symbol' },
          { address, abi: erc20Abi, functionName: 'decimals' },
        ],
        // 任一失败不抛整体异常,逐项判断。
        allowFailure: true,
      })
      const [nameRes, symbolRes, decimalsRes] = results
      meta.value = {
        name: nameRes.status === 'success' ? (nameRes.result as string) : '未知代币',
        symbol: symbolRes.status === 'success' ? (symbolRes.result as string) : '???',
        decimals:
          decimalsRes.status === 'success' ? Number(decimalsRes.result) : 18,
      }
    } catch (e) {
      console.error('[useContract] 读取代币元数据失败:', e)
      meta.value = null
    } finally {
      loadingMeta.value = false
    }
  }

  /** 读取当前账户的代币余额 */
  async function loadTokenBalance(): Promise<void> {
    if (!isTokenConfigured() || !account.value) {
      tokenBalance.value = null
      return
    }
    const address = requireToken()
    loadingBalance.value = true
    try {
      tokenBalance.value = (await publicClient.readContract({
        address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account.value],
      })) as bigint
    } catch (e) {
      console.error('[useContract] 读取代币余额失败:', e)
      tokenBalance.value = null
    } finally {
      loadingBalance.value = false
    }
  }

  /** 同时刷新元数据(若缺)与余额 */
  async function refreshAll(): Promise<void> {
    if (!meta.value) await loadMeta()
    await loadTokenBalance()
  }

  // 写操作通用收尾:成功后刷新余额。
  async function afterWriteSuccess(): Promise<void> {
    await Promise.all([loadTokenBalance(), refreshEthBalance()])
  }

  /**
   * 写操作核心:封装 simulate → write → waitForReceipt 三段式。
   * @param functionName 合约方法名
   * @param args 方法参数
   */
  async function runWrite(
    functionName: 'transfer' | 'mint',
    args: readonly unknown[],
  ): Promise<void> {
    txError.value = null
    txHash.value = null

    if (!account.value) {
      txError.value = '请先连接钱包。'
      return
    }
    let address: Address
    try {
      address = requireToken()
    } catch (e) {
      txError.value = formatError(e)
      return
    }

    txStatus.value = 'pending'
    try {
      // 1) 干跑:提前捕获 revert、校验参数,并由节点估算。
      const { request } = await publicClient.simulateContract({
        address,
        abi: erc20Abi,
        functionName,
        args: args as never,
        account: account.value,
        chain: activeChain,
      })

      // 2) 真正发交易(MetaMask 弹窗签名)。
      const walletClient = createInjectedWalletClient()
      const hash = await walletClient.writeContract(request)
      txHash.value = hash

      // 3) 等待上链回执。
      const receipt = await publicClient.waitForTransactionReceipt({ hash })

      if (receipt.status === 'success') {
        txStatus.value = 'confirmed'
        await afterWriteSuccess()
      } else {
        // status === 'reverted':交易上链但执行失败。
        txStatus.value = 'failed'
        txError.value = '交易已上链但执行失败(reverted)。'
      }
    } catch (e) {
      txStatus.value = 'failed'
      txError.value = formatError(e)
    }
  }

  /**
   * 转账代币。
   * @param to 收款地址
   * @param amount 数量(人类可读,如 "1.5"),内部按 decimals 转 wei
   */
  async function transfer(to: Address, amount: string): Promise<void> {
    const decimals = meta.value?.decimals ?? 18
    let value: bigint
    try {
      value = parseUnits(amount, decimals)
    } catch {
      txError.value = '转账数量格式不正确。'
      txStatus.value = 'failed'
      return
    }
    await runWrite('transfer', [to, value])
  }

  /**
   * 铸造代币(非标准,需合约支持公开 mint)。
   * @param to 接收地址
   * @param amount 数量(人类可读)
   */
  async function mint(to: Address, amount: string): Promise<void> {
    const decimals = meta.value?.decimals ?? 18
    let value: bigint
    try {
      value = parseUnits(amount, decimals)
    } catch {
      txError.value = '铸造数量格式不正确。'
      txStatus.value = 'failed'
      return
    }
    await runWrite('mint', [to, value])
  }

  /** 重置交易状态机回到 idle */
  function resetTx(): void {
    txStatus.value = 'idle'
    txHash.value = null
    txError.value = null
  }

  return {
    // 只读状态
    meta: readonly(meta),
    tokenBalance: readonly(tokenBalance),
    tokenBalanceFormatted,
    loadingMeta: readonly(loadingMeta),
    loadingBalance: readonly(loadingBalance),
    txStatus: readonly(txStatus),
    txHash: readonly(txHash),
    txError: readonly(txError),
    isSending,
    isConfigured: isTokenConfigured,
    // 方法
    loadMeta,
    loadTokenBalance,
    refreshAll,
    transfer,
    mint,
    resetTx,
  }
}
