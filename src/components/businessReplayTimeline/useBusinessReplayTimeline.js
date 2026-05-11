import { reactive, watch, onUnmounted } from 'vue'
import { useMapStore } from '@/stores/modules/mapStore'

export function useBusinessReplayTimeline() {
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

  return {
    timeline,
    formatTimelineTime,
    onTimelineInput,
    onTimelineChange
  }
}
