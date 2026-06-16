// viem 客户端工厂。
//
// - publicClient:无需钱包,负责所有「读」操作(余额、合约 view、等待回执)。
//   走自定义 RPC 或链默认公共 RPC。
// - walletClient:需要注入式钱包(MetaMask),负责所有「写」操作(签名、发交易)。
//   只有用户连接钱包后才创建。
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { activeChain, rpcUrl } from './index'

// 全局单例 publicClient:整个应用共享一个读客户端即可。
// transport 优先用用户配置的 RPC,否则回退到 http()(viem 会用链内置 RPC)。
export const publicClient: PublicClient = createPublicClient({
  chain: activeChain,
  transport: rpcUrl ? http(rpcUrl) : http(),
})

/**
 * 基于注入式钱包创建 walletClient。
 * 调用前必须确保 window.ethereum 存在(由 useWallet 负责检测)。
 */
export function createInjectedWalletClient(): WalletClient {
  if (!window.ethereum) {
    throw new Error('未检测到注入式钱包(window.ethereum)')
  }
  return createWalletClient({
    chain: activeChain,
    transport: custom(window.ethereum),
  })
}
