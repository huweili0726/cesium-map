/**
 * 业务回放时间轴组合式函数
 * 
 * 这个函数负责管理回放时间轴的状态和交互逻辑，包括：
 * 1. 监听活跃的回放引擎状态变化
 * 2. 同步时间轴显示状态（当前时间、进度、播放状态）
 * 3. 处理用户拖动时间轴滑块的交互
 * 4. 协调播放状态与滑块拖动的交互（拖动时暂停，松开后恢复）
 */

// 导入Vue响应式API
import { reactive, watch, onUnmounted } from 'vue'
// 导入状态管理
import { useMapStore } from '@/stores/modules/mapStore'

/**
 * 创建业务回放时间轴的组合式函数
 * @returns {Object} 时间轴状态和方法
 */
export function useBusinessReplayTimeline() {
  // 获取地图状态管理
  const mapStore = useMapStore()

  // 订阅取消函数引用（用于组件销毁时清理）
  let unwatchActiveReplayEngine = null  // 监听活跃引擎变化的取消函数
  let unsubscribeReplayState = null     // 取消订阅回放状态的函数
  let wasPlayingBeforeTimelineDrag = false  // 记录拖动前是否正在播放

  /**
   * 时间轴响应式状态对象
   * 包含时间轴显示和交互所需的所有状态
   */
  const timeline = reactive({
    visible: false,      // 时间轴是否显示
    startTime: 0,        // 回放开始时间戳（毫秒）
    endTime: 0,          // 回放结束时间戳（毫秒）
    currentTime: 0,      // 当前回放时间戳（毫秒）
    progress: 0,         // 当前进度（0-1）
    isPlaying: false,    // 是否正在播放
    dragging: false      // 是否正在拖动滑块
  })

  /**
   * 格式化时间戳为年月日时分秒格式
   * @param {number} timestamp 时间戳（毫秒）
   * @returns {string} 格式化后的时间字符串，如 "2024-01-15 12:34:56"
   */
  const formatTimelineTime = (timestamp) => {
    // 如果时间戳无效，返回占位符
    if (!timestamp) return '----/--/-- --:--:--'
    // 转换为Date对象
    const date = new Date(timestamp)
    // 补零函数：小于10的数字前面补0
    const pad = (value) => String(value).padStart(2, '0')
    // 格式化为 "YYYY-MM-DD HH:MM:SS"
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  }

  /**
   * 更新时间轴状态
   * @param {Object|null} state 回放引擎状态对象
   */
  const updateTimelineState = (state) => {
    // 如果状态为空，隐藏时间轴
    if (!state) {
      timeline.visible = false
      return
    }

    // 更新时间轴状态
    timeline.visible = true              // 显示时间轴
    timeline.startTime = state.startTime // 设置开始时间
    timeline.endTime = state.endTime     // 设置结束时间
    
    // 只有在非拖动状态下才更新当前时间（避免用户拖动时被覆盖）
    if (!timeline.dragging) {
      timeline.currentTime = state.currentTime
    }
    
    timeline.progress = state.progress   // 更新进度
    timeline.isPlaying = state.isPlaying // 更新播放状态
  }

  /**
   * 绑定活跃的回放引擎
   * @param {ReplayEngine|null} engine 回放引擎实例
   */
  const bindActiveReplayEngine = (engine) => {
    // 如果已有订阅，先取消订阅
    if (unsubscribeReplayState) {
      unsubscribeReplayState()
      unsubscribeReplayState = null
    }

    // 如果没有引擎，重置时间轴状态
    if (!engine) {
      updateTimelineState(null)
      return
    }

    // 订阅引擎的状态变化事件
    // 当引擎状态改变时，自动更新时间轴显示
    unsubscribeReplayState = engine.onStateChange(updateTimelineState)
  }

  /**
   * 时间轴滑块输入事件处理（拖动过程中持续触发）
   * @param {Event} event 输入事件
   */
  const onTimelineInput = (event) => {
    // 获取当前活跃的回放引擎
    const engine = mapStore.getActiveReplayEngine()
    if (!engine) return

    // 首次拖动时的处理
    if (!timeline.dragging) {
      timeline.dragging = true  // 标记为拖动状态
      // 记录拖动前的播放状态
      wasPlayingBeforeTimelineDrag = engine.isPlaying
      // 如果正在播放，暂停播放（避免拖动时画面跳动）
      if (engine.isPlaying) {
        engine.pause()
      }
    }

    // 获取用户拖动到的目标时间
    const targetTime = Number(event.target.value)
    // 更新时间轴当前时间
    timeline.currentTime = targetTime
    
    // 计算并打印当前时间点和剩余时间
    const remainingMs = timeline.endTime - targetTime  // 剩余毫秒数
    const remainingSeconds = Math.ceil(remainingMs / 1000)  // 转换为秒（向上取整）
    console.log(`当前时间点: ${formatTimelineTime(targetTime)}`, `距离结束时间剩余: ${remainingSeconds} 秒`)
    
    // 计算新的进度
    timeline.progress = timeline.endTime > timeline.startTime 
      ? (targetTime - timeline.startTime) / (timeline.endTime - timeline.startTime) 
      : 0
    // 通知引擎跳转到目标时间
    engine.seekToTime(targetTime)
  }

  /**
   * 时间轴滑块变化事件处理（拖动结束时触发）
   */
  const onTimelineChange = () => {
    // 获取当前活跃的回放引擎
    const engine = mapStore.getActiveReplayEngine()
    // 标记拖动结束
    timeline.dragging = false

    // 如果拖动前正在播放，恢复播放
    if (engine && wasPlayingBeforeTimelineDrag) {
      engine.continue()
    }

    // 重置记录状态
    wasPlayingBeforeTimelineDrag = false
  }

  /**
   * 监听活跃回放引擎的变化
   * 当活跃引擎改变时，自动重新绑定事件
   */
  unwatchActiveReplayEngine = watch(
    () => mapStore.activeReplayEngine,  // 监听的数据源
    (engine) => bindActiveReplayEngine(engine),  // 变化时的处理函数
    { immediate: true }  // 立即执行一次（初始化时绑定）
  )

  /**
   * 组件卸载时清理资源
   */
  onUnmounted(() => {
    // 取消订阅回放状态
    if (unsubscribeReplayState) {
      unsubscribeReplayState()
      unsubscribeReplayState = null
    }

    // 取消监听活跃引擎变化
    if (unwatchActiveReplayEngine) {
      unwatchActiveReplayEngine()
      unwatchActiveReplayEngine = null
    }
  })

  /**
   * 返回时间轴状态和方法，供组件使用
   */
  return {
    timeline,              // 时间轴响应式状态
    formatTimelineTime,    // 时间格式化函数
    onTimelineInput,       // 滑块输入事件处理
    onTimelineChange       // 滑块变化事件处理
  }
}