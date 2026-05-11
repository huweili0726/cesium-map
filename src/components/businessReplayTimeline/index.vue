<template>
  <div v-if="timeline.visible" class="business-replay-timeline">
    <div class="timeline-header">
      <span class="timeline-title">业务回放时间轴</span>
      <span class="timeline-time">{{ formatTimelineTime(timeline.currentTime) }}</span>
    </div>
    <input
      class="timeline-slider"
      type="range"
      :min="timeline.startTime"
      :max="timeline.endTime"
      :step="1000"
      :value="timeline.currentTime"
      @input="onTimelineInput"
      @change="onTimelineChange"
    />
    <div class="timeline-footer">
      <span>{{ formatTimelineTime(timeline.startTime) }}</span>
      <span>{{ Math.round(timeline.progress * 100) }}%</span>
      <span>{{ formatTimelineTime(timeline.endTime) }}</span>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch, onUnmounted } from 'vue'
import { useMapStore } from '@/stores/modules/mapStore'

const mapStore = useMapStore()

let unwatchActiveReplayEngine = null
let unsubscribeReplayState = null
let wasPlayingBeforeTimelineDrag = false

const timeline = reactive({
  visible: false,
  startTime: 0,
  endTime: 0,
  currentTime: 0,
  progress: 0,
  isPlaying: false,
  dragging: false
})

const formatTimelineTime = (timestamp) => {
  if (!timestamp) return '--:--:--'
  const date = new Date(timestamp)
  const pad = (value) => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const updateTimelineState = (state) => {
  if (!state) {
    timeline.visible = false
    return
  }

  timeline.visible = true
  timeline.startTime = state.startTime
  timeline.endTime = state.endTime
  if (!timeline.dragging) {
    timeline.currentTime = state.currentTime
  }
  timeline.progress = state.progress
  timeline.isPlaying = state.isPlaying
}

const bindActiveReplayEngine = (engine) => {
  if (unsubscribeReplayState) {
    unsubscribeReplayState()
    unsubscribeReplayState = null
  }

  if (!engine) {
    updateTimelineState(null)
    return
  }

  unsubscribeReplayState = engine.onStateChange(updateTimelineState)
}

const onTimelineInput = (event) => {
  const engine = mapStore.getActiveReplayEngine()
  if (!engine) return

  if (!timeline.dragging) {
    timeline.dragging = true
    wasPlayingBeforeTimelineDrag = engine.isPlaying
    if (engine.isPlaying) {
      engine.pause()
    }
  }

  const targetTime = Number(event.target.value)
  timeline.currentTime = targetTime
  timeline.progress = timeline.endTime > timeline.startTime ? (targetTime - timeline.startTime) / (timeline.endTime - timeline.startTime) : 0
  engine.seekToTime(targetTime)
}

const onTimelineChange = () => {
  const engine = mapStore.getActiveReplayEngine()
  timeline.dragging = false

  if (engine && wasPlayingBeforeTimelineDrag) {
    engine.continue()
  }

  wasPlayingBeforeTimelineDrag = false
}

unwatchActiveReplayEngine = watch(
  () => mapStore.activeReplayEngine,
  (engine) => bindActiveReplayEngine(engine),
  { immediate: true }
)

onUnmounted(() => {
  if (unsubscribeReplayState) {
    unsubscribeReplayState()
    unsubscribeReplayState = null
  }

  if (unwatchActiveReplayEngine) {
    unwatchActiveReplayEngine()
    unwatchActiveReplayEngine = null
  }
})
</script>

<style scoped lang="less">
.business-replay-timeline {
  position: absolute;
  left: 50%;
  bottom: 24px;
  z-index: 10;
  width: min(720px, calc(100vw - 48px));
  padding: 14px 18px 12px;
  transform: translateX(-50%);
  border: 1px solid rgba(64, 196, 255, 0.35);
  border-radius: 14px;
  background: rgba(8, 18, 32, 0.86);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(10px);
  color: #e8f7ff;
}

.timeline-header,
.timeline-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}

.timeline-title {
  font-size: 14px;
  font-weight: 600;
  color: #7ee7ff;
}

.timeline-time {
  font-family: Consolas, Monaco, monospace;
  color: #ffffff;
}

.timeline-slider {
  width: 100%;
  margin: 10px 0 8px;
  accent-color: #28d7ff;
  cursor: pointer;
}

.timeline-footer {
  color: rgba(232, 247, 255, 0.72);
}
</style>
