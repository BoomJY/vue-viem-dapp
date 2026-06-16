// 应用配置:把链 / RPC / 合约地址从环境变量读出来,集中校验。
//
// 物理条件(需要用户在 .env 中填写):
//   - VITE_CHAIN_ID    目标链 ID(默认 Sepolia = 11155111)
//   - VITE_RPC_URL     自定义 RPC(可选;留空用公共 RPC,但可能限流)
//   - VITE_TOKEN_ADDRESS  你部署/使用的 ERC-20 合约地址
//
// 未配置 TOKEN_ADDRESS 时,App 仍可连钱包、看 ETH 余额,
// 只是「代币余额 / 转账 / mint」区域会提示去 .env 填地址。
import { isAddress, type Address, type Chain } from 'viem'
import { mainnet, sepolia } from 'viem/chains'

// 支持的链白名单。需要更多链时在这里补充即可。
const SUPPORTED_CHAINS: Record<number, Chain> = {
  [mainnet.id]: mainnet,
  [sepolia.id]: sepolia,
}

// 读取链 ID,默认 Sepolia。
function resolveChainId(): number {
  const raw = import.meta.env.VITE_CHAIN_ID
  const parsed = raw ? Number(raw) : sepolia.id
  if (!Number.isInteger(parsed) || !(parsed in SUPPORTED_CHAINS)) {
    // 配置了不支持的链 ID 时,退回 Sepolia 并在控制台告警,避免直接崩溃。
    console.warn(
      `[config] 不支持的 VITE_CHAIN_ID="${raw}",已回退到 Sepolia(${sepolia.id})。` +
        `如需支持该链,请在 src/config/index.ts 的 SUPPORTED_CHAINS 中补充。`,
    )
    return sepolia.id
  }
  return parsed
}

const chainId = resolveChainId()

/** 当前目标链对象(viem Chain),供 publicClient / walletClient 使用 */
export const activeChain: Chain = SUPPORTED_CHAINS[chainId]!

/** 自定义 RPC(可选)。为空时上层用 activeChain 内置的公共 RPC。 */
export const rpcUrl: string | undefined = import.meta.env.VITE_RPC_URL || undefined

// 读取并校验代币地址。地址非法或缺失都视为「未配置」。
function resolveTokenAddress(): Address | undefined {
  const raw = import.meta.env.VITE_TOKEN_ADDRESS
  if (!raw) return undefined
  if (!isAddress(raw)) {
    console.warn(`[config] VITE_TOKEN_ADDRESS="${raw}" 不是合法地址,已忽略。`)
    return undefined
  }
  return raw
}

/** ERC-20 合约地址;为 undefined 表示用户尚未在 .env 中配置 */
export const tokenAddress: Address | undefined = resolveTokenAddress()

/** 代币是否已配置(UI 用来决定是否展示代币相关功能) */
export const isTokenConfigured = (): boolean => tokenAddress !== undefined

// 把链的区块浏览器地址抽出来,方便 UI 生成交易链接。
export const explorerBaseUrl: string | undefined =
  activeChain.blockExplorers?.default.url

/** 生成某笔交易在区块浏览器上的查看链接(无浏览器配置时返回 undefined) */
export function txExplorerUrl(hash: string): string | undefined {
  if (!explorerBaseUrl) return undefined
  return `${explorerBaseUrl}/tx/${hash}`
}
