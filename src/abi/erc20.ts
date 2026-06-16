// ERC-20 最小可用 ABI(human-readable 形式)。
//
// viem 支持直接用「人类可读」的字符串数组定义 ABI,内部会用 parseAbi 解析。
// 这里只挑选 DApp 常用的读/写函数与事件,避免引入整份标准 ABI。
//
// 注意:`mint` 不是 ERC-20 标准的一部分,但绝大多数测试网代币 / 教学代币
// 都会暴露一个公开的 mint 方法。若你的合约没有 mint,删掉对应行即可,
// 不影响其它读写功能。
import { parseAbi } from 'viem'

export const erc20Abi = parseAbi([
  // --- 只读 ---
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  // --- 写入 ---
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  // 非标准:测试网代币常见的公开铸造方法
  'function mint(address to, uint256 amount)',
  // --- 事件 ---
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
] as const)

// 导出类型别名,便于在 composables 中复用。
export type Erc20Abi = typeof erc20Abi
