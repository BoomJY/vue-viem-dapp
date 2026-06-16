// 把 viem / 钱包抛出的各种错误,翻译成一句人话。
//
// viem 的错误都继承自 BaseError,可以用 error.walk() 沿着 cause 链
// 找到我们关心的具体错误类型:
//   - UserRejectedRequestError       用户在钱包里点了「拒绝」
//   - ContractFunctionRevertError    合约 require/revert(可能带自定义错误或 reason)
//   - InsufficientFundsError         余额不足以支付 gas
//   - ContractFunctionExecutionError 执行层失败的外壳
//
// 这样 UI 不用直接展示一长串底层堆栈,而是给用户可读的提示。
import {
  BaseError,
  ContractFunctionRevertedError,
  ContractFunctionExecutionError,
  InsufficientFundsError,
  UserRejectedRequestError,
} from 'viem'

/**
 * 将任意 unknown 错误转换为对用户友好的中文提示。
 * @param err catch 到的错误对象
 * @returns 一句可直接显示在 UI 上的文案
 */
export function formatError(err: unknown): string {
  // 1) viem 错误:沿 cause 链精确匹配
  if (err instanceof BaseError) {
    // 用户主动拒绝签名
    const rejected = err.walk((e) => e instanceof UserRejectedRequestError)
    if (rejected) {
      return '你在钱包中取消了操作。'
    }

    // 合约 revert:优先展示自定义错误名或 revert reason
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError)
    if (revert instanceof ContractFunctionRevertedError) {
      // 自定义 error(如 error InsufficientBalance())
      if (revert.data?.errorName) {
        const args = revert.data.args?.length
          ? `(${revert.data.args.map(String).join(', ')})`
          : ''
        return `交易被合约拒绝:${revert.data.errorName}${args}`
      }
      // 字符串 reason(如 require(x, "ERC20: ..."))
      if (revert.reason) {
        return `交易被合约拒绝:${revert.reason}`
      }
      return '交易被合约拒绝(revert),但未提供具体原因。'
    }

    // gas 费不足
    const insufficient = err.walk((e) => e instanceof InsufficientFundsError)
    if (insufficient) {
      return '账户 ETH 余额不足以支付 gas 费用。'
    }

    // 其它合约执行错误:用 viem 整理好的 shortMessage
    const execErr = err.walk((e) => e instanceof ContractFunctionExecutionError)
    if (execErr instanceof ContractFunctionExecutionError) {
      return `合约调用失败:${execErr.shortMessage}`
    }

    // 兜底:viem 的 shortMessage 通常已经比较友好
    return err.shortMessage || err.message
  }

  // 2) 普通 Error
  if (err instanceof Error) {
    return err.message
  }

  // 3) 其它(字符串 / 未知)
  return String(err)
}
