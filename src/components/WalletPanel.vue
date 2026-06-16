<script setup lang="ts">
// 钱包面板:连接按钮、地址、ETH 余额、链状态。
import { useWallet } from '@/composables/useWallet'

const {
  account,
  ethBalanceFormatted,
  connecting,
  error,
  hasWallet,
  isConnected,
  isWrongNetwork,
  walletChainId,
  targetChain,
  connect,
  disconnect,
  switchToTargetChain,
  refreshEthBalance,
} = useWallet()

// 地址缩写:0x1234...abcd
function short(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}
</script>

<template>
  <section class="card">
    <h2>钱包</h2>

    <!-- 未安装钱包 -->
    <div v-if="!hasWallet" class="alert warn">
      未检测到 MetaMask。请先安装浏览器钱包扩展后刷新页面。
      <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">
        前往安装 →
      </a>
    </div>

    <!-- 已安装但未连接 -->
    <div v-else-if="!isConnected" class="row">
      <button :disabled="connecting" @click="connect">
        {{ connecting ? '连接中…' : '连接 MetaMask' }}
      </button>
      <span class="muted">连接后可查看余额并发起交易。</span>
    </div>

    <!-- 已连接 -->
    <template v-else>
      <div class="kv">
        <span class="k">地址</span>
        <span class="v" :title="account ?? ''">{{ account ? short(account) : '—' }}</span>
      </div>
      <div class="kv">
        <span class="k">ETH 余额</span>
        <span class="v">{{ ethBalanceFormatted }} {{ targetChain.nativeCurrency.symbol }}</span>
      </div>
      <div class="kv">
        <span class="k">目标网络</span>
        <span class="v">{{ targetChain.name }}(#{{ targetChain.id }})</span>
      </div>

      <!-- 网络不匹配提示 -->
      <div v-if="isWrongNetwork" class="alert warn" style="margin-top: 12px">
        当前钱包在链 #{{ walletChainId }},与目标网络不一致。
        <button class="secondary" style="margin-left: 8px" @click="switchToTargetChain">
          切换到 {{ targetChain.name }}
        </button>
      </div>

      <div class="row" style="margin-top: 14px">
        <button class="secondary" @click="refreshEthBalance">刷新余额</button>
        <button class="secondary" @click="disconnect">断开</button>
      </div>
    </template>

    <!-- 错误提示 -->
    <div v-if="error" class="alert danger" style="margin-top: 12px">
      {{ error }}
    </div>
  </section>
</template>
