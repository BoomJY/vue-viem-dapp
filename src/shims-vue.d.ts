// .vue 单文件组件的 TypeScript 模块声明。
// vue-tsc 编译时会用 Volar 解析真实类型;此 shim 供编辑器/纯 tsc 场景兜底。
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
