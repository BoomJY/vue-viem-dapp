# 04 · Vue3 + viem DApp 前端样板

> 🟢 **连真实合约即跑**:`.env.example` 已指向 Sepolia 上已部署的 StudioToken([`0x834a…3984`](https://sepolia.etherscan.io/address/0x834a5cE3a7b214369DbaFcc59757031c259C3984))。`cp .env.example .env && npm i && npm run dev` 即可连 MetaMask 演示读写。

一个**极简但完整**的去中心化应用(DApp)前端:连接 MetaMask、查看 ETH 与 ERC-20 余额、发起代币转账 / 铸造,并对交易状态(pending / confirmed / failed)和合约 revert 做**友好提示**。

技术栈纯手写,不依赖任何脚手架模板,也不引入 UI 库,适合作为接「DApp 全栈单」的核心前端样板。

---

## 这是什么 / 对应哪份计划

- **计划定位**:`solidity-15天补桥路线` · **Day 9** · **作品 #2**。
- **作用**:打通「前端 ↔ 链」的标准交互闭环,是后续做事件索引器(作品 #3)、AI 看板(45 天 MVP)等全栈项目的前端地基。
- **配套合约**:本仓库 `02-foundry-erc20-token` 可部署一个带公开 `mint` 的 ERC-20,与本前端直接对接。

### 技术栈

| 用途 | 选型 |
|---|---|
| 框架 | Vue 3(`<script setup lang="ts">`) |
| 构建 | Vite 5 |
| 语言 | TypeScript(strict 全开) |
| 链交互 | [viem](https://viem.sh/) 2.x(`publicClient` / `walletClient`) |
| 类型检查 | vue-tsc |

> 主场是 Vue,因此**刻意不使用** React / wagmi / ethers,直接用 viem 原语,链交互逻辑更透明、更可控,也更能体现对底层流程的理解。

---

## 功能清单

- ✅ **连接钱包**:检测 `window.ethereum`、请求授权、页面刷新后静默恢复连接(eager connect)。
- ✅ **监听账户 / 链切换**:在 MetaMask 里换账户或换网络,UI 自动同步。
- ✅ **网络校验**:钱包当前链与目标链(默认 Sepolia)不一致时,提示并支持一键切换(EIP-3326)。
- ✅ **余额展示**:原生币 ETH 余额 + 任意 ERC-20 的 `name / symbol / decimals / balanceOf`(用 `multicall` 合并读取)。
- ✅ **写操作**:代币 `transfer` 与 `mint`,严格走 viem 推荐的三段式。
- ✅ **交易状态机**:`idle → pending → confirmed | failed`,带交易哈希与区块浏览器链接。
- ✅ **revert 友好提示**:沿 viem 错误的 `cause` 链精确识别「用户拒绝 / 合约自定义错误 / revert reason / gas 不足」,翻译成中文人话。
- ✅ **无链也能跑**:不配置合约地址时,连钱包、看 ETH 余额照常工作;代币区域给出清晰的配置指引。

---

## 设计要点

### 1. 写操作三段式(本项目的核心)

所有写交易都封装在 `useContract.ts` 的 `runWrite()` 中,严格遵循 viem 的推荐流程:

```
simulateContract            // ① 节点上「干跑」:提前拿到 revert、校验参数、由节点估算
   ↓ request
writeContract               // ② walletClient 真正发交易(MetaMask 弹窗签名),拿到 txHash
   ↓ hash
waitForTransactionReceipt   // ③ 等待上链;根据 receipt.status 判断 success / reverted
```

好处:大量错误(参数非法、余额不足、合约 require 失败)在 `simulate` 阶段就被拦截,**用户不会白白花 gas 发一笔注定失败的交易**。

### 2. 读写客户端分离

- `publicClient`(`config/clients.ts`):全局单例,负责所有**读**(余额、`view` 调用、等回执),走 RPC,无需钱包。
- `walletClient`:仅在用户连接钱包后基于 `window.ethereum` 创建,负责所有**写**(签名、发交易)。

### 3. composables 单例状态

`useWallet.ts` 把账户 / 链 / 余额等响应式状态提到**模块级**,所有组件 `import` 同一份。连一次钱包,全应用生效,无需 props 层层透传或额外状态库。

### 4. 错误翻译集中化

`useErrorMessage.ts` 用 `BaseError.walk()` 沿 `cause` 链匹配具体错误类型:

| viem 错误类型 | 友好提示 |
|---|---|
| `UserRejectedRequestError` | 你在钱包中取消了操作 |
| `ContractFunctionRevertedError`(自定义 error) | 交易被合约拒绝:`ErrorName(args)` |
| `ContractFunctionRevertedError`(reason 字符串) | 交易被合约拒绝:`reason` |
| `InsufficientFundsError` | 账户 ETH 余额不足以支付 gas |
| 其它 | viem 整理好的 `shortMessage` |

### 5. 配置即物理条件

链 / RPC / 合约地址全部从 `.env` 读取并在 `config/index.ts` 集中校验;非法或缺失时**降级而非崩溃**(回退默认链、忽略非法地址并告警)。

---

## 目录结构

```
04-dapp-vue-viem/
├─ index.html                 # 入口 HTML
├─ vite.config.ts             # Vite 配置(含 @ → src 别名)
├─ tsconfig.json              # TS 配置(strict 全开)
├─ tsconfig.node.json         # 给 vite.config.ts 用的 TS 配置
├─ env.d.ts                   # import.meta.env 与 window.ethereum 类型声明
├─ .env.example               # 环境变量样例(物理条件)
└─ src/
   ├─ main.ts                 # 应用入口
   ├─ App.vue                 # 根组件:配置一览 + 面板组合
   ├─ style.css               # 极简全局样式(无 UI 库)
   ├─ abi/
   │  └─ erc20.ts             # ERC-20 最小 ABI(human-readable)
   ├─ config/
   │  ├─ index.ts             # 链 / RPC / 合约地址读取与校验
   │  └─ clients.ts           # publicClient / walletClient 工厂
   ├─ composables/
   │  ├─ useWallet.ts         # 连钱包、账户/链监听、ETH 余额
   │  ├─ useContract.ts       # ERC-20 读写、交易状态机
   │  └─ useErrorMessage.ts   # 错误 → 友好中文提示
   └─ components/
      ├─ WalletPanel.vue      # 钱包面板
      ├─ TokenPanel.vue       # 代币余额 + 转账/mint 表单
      └─ TxStatusBadge.vue    # 交易状态徽章(可复用)
```

---

## 如何 build / test / 运行

> 环境要求:Node ≥ 18(开发使用 Node v24 + npm 11)。

```bash
# 1) 安装依赖
npm install

# 2) 本地开发(默认 http://localhost:5173)
npm run dev

# 3) 仅类型检查(本项目的验证命令之一)
npm run typecheck      # 等价于 npx vue-tsc --noEmit

# 4) 生产构建(会先跑 vue-tsc 类型检查,再 vite build)
npm run build

# 5) 预览构建产物
npm run preview
```

### 验证命令与结果

本项目的「绿」标准是以下两条命令均无错误:

```bash
npm install
npm run build          # 内部:vue-tsc --noEmit && vite build  → 全过
npx vue-tsc --noEmit   # 无类型错误,退出码 0
```

实测输出(Node v24.15.0 / npm 11.12.1 / Windows）:

```
> dapp-vue-viem@0.1.0 build
> vue-tsc --noEmit && vite build

vite v5.4.21 building for production...
✓ 1207 modules transformed.
dist/index.html                   0.41 kB │ gzip:   0.29 kB
dist/assets/index-*.css           2.79 kB │ gzip:   1.12 kB
dist/assets/ccip-*.js             3.04 kB │ gzip:   1.39 kB
dist/assets/index-*.js          351.48 kB │ gzip: 115.00 kB
✓ built in 4.95s
```

> 说明:本样板的产出是「构建 + 类型检查」全绿,而非单元测试。链交互的真实行为需在配置真实 RPC / 合约 / 钱包后于浏览器中验证(见下「接真实数据」)。

---

## 部署 / 接真实数据需要你填什么(🚧 物理条件)

前端代码本身不含任何私钥或密钥。要让它连上真实链,你需要准备以下「物理条件」,复制 `.env.example` 为 `.env` 后填写:

| 变量 | 是否必填 | 说明 | 怎么拿 |
|---|---|---|---|
| `VITE_CHAIN_ID` | 否(默认 `11155111` Sepolia) | 目标链 ID(十进制)。主网填 `1` | — |
| `VITE_RPC_URL` | 建议填 | 自定义 RPC。留空用公共 RPC,**会限流** | 去 [Alchemy](https://www.alchemy.com/) 或 [Infura](https://www.infura.io/) 免费申请 |
| `VITE_TOKEN_ADDRESS` | 看代币功能 | 你的 ERC-20 合约地址(`0x...`) | 用本仓库 `02-foundry-erc20-token` 部署,或在 Sepolia 上找带公开 `mint` 的测试代币 |

此外还需要(浏览器侧,无法由代码代办):

1. 🚧 **安装 MetaMask** 浏览器扩展。
2. 🚧 **准备测试网 ETH**:从 [Sepolia faucet](https://sepoliafaucet.com/) 领取,用于支付 gas。
3. 🚧 在 MetaMask 中切换到目标网络(或用 App 内的「切换网络」按钮)。

> 关于 `mint`:它**不是** ERC-20 标准方法。本样板假设你的合约暴露了公开的 `mint(address,uint256)`(测试网代币常见)。若合约没有该方法或调用者无权限,交易会在 `simulate` 阶段被拦下,并以「交易被合约拒绝」的形式友好提示——这正是 revert 处理逻辑的体现。若你的合约无 mint,删掉 `src/abi/erc20.ts` 中对应那行即可,不影响其它功能。

### 静态部署

`npm run build` 产物在 `dist/`,是纯静态文件,可直接部署到 Vercel / Netlify / GitHub Pages / 任意静态托管。注意:`.env` 中的变量在**构建时**注入,换环境需重新构建。前端注入的值都是公开信息(链 ID、RPC URL、合约地址),**不要把任何私钥放进 `VITE_` 变量**。

---

## 安全与边界

- 本前端**从不接触私钥**,所有签名都交给 MetaMask。
- `.env` 已被 `.gitignore` 忽略,真实 RPC key 不会进版本库。
- 仅作为前端样板:未做合约层安全审计;合约安全相关请见知识库 `06-合约安全` 与本仓库 Foundry 项目的测试。
