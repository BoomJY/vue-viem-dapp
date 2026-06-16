<script setup lang="ts">
// 交易状态展示组件:徽章 + 交易哈希链接 + 错误提示。
// 复用在转账 / mint 等所有写操作处。
import { computed } from 'vue'
import type { TxStatus } from '@/composables/useContract'
import { txExplorerUrl } from '@/config'

const props = defineProps<{
  status: TxStatus
  hash: string | null
  error: string | null
}>()

// 状态 → 中文文案
const label = computed(() => {
  switch (props.status) {
    case 'pending':
      return '交易处理中…'
    case 'confirmed':
      return '交易成功'
    case 'failed':
      return '交易失败'
    default:
      return '待发起'
  }
})

// 交易哈希对应的区块浏览器链接(可能为 undefined)
const explorerUrl = computed(() => (props.hash ? txExplorerUrl(props.hash) : undefined))

function short(h: string): string {
  return `${h.slice(0, 10)}…${h.slice(-8)}`
}
</script>

<template>
  <!-- idle 状态不展示任何东西 -->
  <div v-if="status !== 'idle'" style="margin-top: 14px">
    <span class="badge" :class="status">
      <span class="dot" />
      {{ label }}
    </span>

    <!-- 交易哈希 -->
    <div v-if="hash" class="kv" style="margin-top: 10px">
      <span class="k">交易哈希</span>
      <span class="v">
        <a v-if="explorerUrl" :href="explorerUrl" target="_blank" rel="noreferrer">
          {{ short(hash) }} ↗
        </a>
        <span v-else>{{ short(hash) }}</span>
      </span>
    </div>

    <!-- 失败原因(友好提示) -->
    <div v-if="status === 'failed' && error" class="alert danger" style="margin-top: 10px">
      {{ error }}
    </div>

    <!-- 成功提示 -->
    <div v-else-if="status === 'confirmed'" class="alert success" style="margin-top: 10px">
      交易已上链确认。
    </div>
  </div>
</template>
