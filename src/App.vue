<script setup lang="ts">
// 根组件:页面骨架 + 子面板组合。
import { onMounted } from 'vue'
import WalletPanel from '@/components/WalletPanel.vue'
import TokenPanel from '@/components/TokenPanel.vue'
import { useWallet } from '@/composables/useWallet'
import { activeChain, tokenAddress, rpcUrl } from '@/config'

const { tryEagerConnect } = useWallet()

// 页面加载后尝试静默恢复已授权的钱包连接(不弹窗)。
onMounted(() => {
  void tryEagerConnect()
})
</script>

<template>
  <header style="margin-bottom: 20px">
    <h1>Vue3 + viem DApp 样板</h1>
    <p class="muted">
      连接钱包 · 查看 ETH / ERC-20 余额 · 转账 / 铸造 · 交易状态与 revert 友好提示
    </p>
  </header>

  <!-- 当前运行配置一览,便于核对 .env 是否生效 -->
  <section class="card">
    <h2>当前配置</h2>
    <div class="kv">
      <span class="k">目标链</span>
      <span class="v">{{ activeChain.name }}(#{{ activeChain.id }})</span>
    </div>
    <div class="kv">
      <span class="k">RPC</span>
      <span class="v">{{ rpcUrl ?? '链默认公共 RPC(可能限流)' }}</span>
    </div>
    <div class="kv">
      <span class="k">代币合约</span>
      <span class="v">{{ tokenAddress ?? '未配置(见 .env.example)' }}</span>
    </div>
  </section>

  <WalletPanel />
  <TokenPanel />

  <p class="footer">
    solidity-15天 · Day9 / 作品 #2 ·
    <span class="mono">simulateContract → writeContract → waitForTransactionReceipt</span>
  </p>
</template>
