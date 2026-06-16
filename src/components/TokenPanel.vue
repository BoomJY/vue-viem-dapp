<script setup lang="ts">
// 代币面板:展示 ERC-20 元数据 / 余额,并提供转账与 mint 表单。
// 把读(余额)和写(transfer/mint)的交互集中在一处,贴近真实 DApp。
import { onMounted, ref, watch } from 'vue'
import { isAddress, type Address } from 'viem'
import { useContract } from '@/composables/useContract'
import { useWallet } from '@/composables/useWallet'
import { tokenAddress, activeChain } from '@/config'
import TxStatusBadge from './TxStatusBadge.vue'

const { account, isConnected, isWrongNetwork } = useWallet()
const {
  meta,
  tokenBalanceFormatted,
  loadingBalance,
  txStatus,
  txHash,
  txError,
  isSending,
  isConfigured,
  refreshAll,
  loadTokenBalance,
  transfer,
  mint,
  resetTx,
} = useContract()

// 表单本地状态。
const mode = ref<'transfer' | 'mint'>('transfer')
const toAddress = ref('')
const amount = ref('')
const formError = ref<string | null>(null)

// 连接后、账户变化时拉取代币信息。
watch(
  () => account.value,
  (addr) => {
    if (addr && isConfigured()) void refreshAll()
  },
)

onMounted(() => {
  if (account.value && isConfigured()) void refreshAll()
})

// 校验并提交。
async function submit(): Promise<void> {
  formError.value = null
  resetTx()

  if (!toAddress.value || !isAddress(toAddress.value)) {
    formError.value = '请输入合法的接收地址(0x 开头,40 位十六进制)。'
    return
  }
  if (!amount.value || Number(amount.value) <= 0) {
    formError.value = '请输入大于 0 的数量。'
    return
  }

  const to = toAddress.value as Address
  if (mode.value === 'transfer') {
    await transfer(to, amount.value)
  } else {
    await mint(to, amount.value)
  }
}

// 便捷:把接收地址填成自己(常用于 mint 给自己)。
function fillSelf(): void {
  if (account.value) toAddress.value = account.value
}
</script>

<template>
  <section class="card">
    <h2>ERC-20 代币</h2>

    <!-- 未配置合约地址:物理条件提示 -->
    <div v-if="!isConfigured()" class="alert info">
      尚未配置代币合约地址。请在项目根目录的 <span class="mono">.env</span> 中填写
      <span class="mono">VITE_TOKEN_ADDRESS</span>(参见
      <span class="mono">.env.example</span>),然后重启 dev server。
    </div>

    <!-- 已配置但未连接钱包 -->
    <div v-else-if="!isConnected" class="alert info">
      连接钱包后即可查看代币余额并发起转账 / mint。
    </div>

    <!-- 主体 -->
    <template v-else>
      <!-- 代币信息 -->
      <div class="kv">
        <span class="k">代币</span>
        <span class="v">
          {{ meta ? `${meta.name}（${meta.symbol}）` : '加载中…' }}
        </span>
      </div>
      <div class="kv">
        <span class="k">合约地址</span>
        <span class="v" :title="tokenAddress ?? ''">{{ tokenAddress }}</span>
      </div>
      <div class="kv">
        <span class="k">我的余额</span>
        <span class="v">
          {{ loadingBalance ? '加载中…' : tokenBalanceFormatted }}
          {{ meta?.symbol ?? '' }}
        </span>
      </div>
      <div class="row" style="margin-top: 10px">
        <button class="secondary" @click="loadTokenBalance">刷新代币余额</button>
      </div>

      <!-- 网络不匹配时禁止写操作 -->
      <div v-if="isWrongNetwork" class="alert warn" style="margin-top: 16px">
        请先切换到 {{ activeChain.name }} 再发起交易(见上方钱包面板)。
      </div>

      <!-- 操作表单 -->
      <div v-else style="margin-top: 20px">
        <div class="row" style="margin-bottom: 14px">
          <button
            :class="mode === 'transfer' ? '' : 'secondary'"
            @click="mode = 'transfer'"
          >
            转账 Transfer
          </button>
          <button :class="mode === 'mint' ? '' : 'secondary'" @click="mode = 'mint'">
            铸造 Mint
          </button>
        </div>

        <div class="field">
          <label>{{ mode === 'transfer' ? '收款地址' : '接收地址' }}</label>
          <input v-model="toAddress" placeholder="0x..." spellcheck="false" />
          <div style="margin-top: 6px">
            <button class="secondary" style="padding: 4px 10px; font-size: 12px" @click="fillSelf">
              填入我的地址
            </button>
          </div>
        </div>

        <div class="field">
          <label>数量({{ meta?.symbol ?? 'TOKEN' }})</label>
          <input v-model="amount" placeholder="例如 1.5" inputmode="decimal" spellcheck="false" />
        </div>

        <button :disabled="isSending" @click="submit">
          {{ isSending ? '提交中…' : mode === 'transfer' ? '发起转账' : '发起铸造' }}
        </button>

        <p v-if="mode === 'mint'" class="muted" style="margin-top: 10px">
          说明:mint 非 ERC-20 标准方法,需合约暴露公开
          <span class="mono">mint(address,uint256)</span>。若合约无此方法或无权限,
          会以「交易被合约拒绝」的形式友好提示。
        </p>

        <!-- 表单校验错误 -->
        <div v-if="formError" class="alert danger" style="margin-top: 12px">
          {{ formError }}
        </div>

        <!-- 交易状态 -->
        <TxStatusBadge :status="txStatus" :hash="txHash" :error="txError" />
      </div>
    </template>
  </section>
</template>
