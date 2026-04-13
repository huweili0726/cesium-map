import { createPinia } from 'pinia'

// 创建pinia实例
const pinia = createPinia()

// 导出pinia实例
export default pinia

// 导出所有store
export * from './modules/mapStore'