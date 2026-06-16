/// <reference types="vite/client" />

// Vite 环境变量类型声明。
// 只有以 VITE_ 前缀的变量会被注入到前端 import.meta.env。
interface ImportMetaEnv {
  /** 目标链 ID,十进制字符串,例如 Sepolia = "11155111" */
  readonly VITE_CHAIN_ID?: string
  /** 自定义 RPC URL(可选);为空时使用链默认公共 RPC */
  readonly VITE_RPC_URL?: string
  /** ERC-20 合约地址(0x...);未配置时 UI 给出提示 */
  readonly VITE_TOKEN_ADDRESS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// EIP-1193 注入式钱包(MetaMask 等)挂在 window.ethereum 上。
// 这里给出最小可用的类型,避免引入额外依赖。
interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>
  on(event: string, listener: (...args: unknown[]) => void): void
  removeListener(event: string, listener: (...args: unknown[]) => void): void
  isMetaMask?: boolean
}

interface Window {
  ethereum?: Eip1193Provider
}
