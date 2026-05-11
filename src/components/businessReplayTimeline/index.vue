<template>
  <div v-if="timeline.visible" class="business-replay-timeline">
    <div class="timeline-header">
      <span class="timeline-title">业务回放时间轴</span>
      <div class="timeline-controls">
        <button 
          class="control-btn" 
          @mousedown="onRewindDown"
          @mouseup="onSeekUp"
          @mouseleave="onSeekUp"
          @touchstart.prevent="onRewindDown"
          @touchend.prevent="onSeekUp"
          title="快退（按住不放连续快退）"
        >
          <span class="control-icon">⏪</span>
        </button>
        <button class="control-btn play-btn" @click="togglePlay" :title="timeline.isPlaying ? '暂停' : '继续'">
          <span v-if="timeline.isPlaying" class="control-icon">⏸</span>
          <span v-else class="control-icon">▶</span>
        </button>
        <button 
          class="control-btn" 
          @mousedown="onFastForwardDown"
          @mouseup="onSeekUp"
          @mouseleave="onSeekUp"
          @touchstart.prevent="onFastForwardDown"
          @touchend.prevent="onSeekUp"
          title="快进（按住不放连续快进）"
        >
          <span class="control-icon">⏩</span>
        </button>
        <span class="timeline-time">{{ formatTimelineTime(timeline.currentTime) }}</span>
      </div>
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
import { useBusinessReplayTimeline } from './useBusinessReplayTimeline'

const {
  timeline,
  formatTimelineTime,
  onTimelineInput,
  onTimelineChange,
  togglePlay,
  onFastForwardDown,
  onRewindDown,
  onSeekUp
} = useBusinessReplayTimeline()
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

.timeline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}

.timeline-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.control-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(64, 196, 255, 0.5);
  border-radius: 6px;
  background: rgba(64, 196, 255, 0.1);
  color: #7ee7ff;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(64, 196, 255, 0.25);
    border-color: rgba(64, 196, 255, 0.8);
  }

  &:active {
    transform: scale(0.95);
  }
}

.control-icon {
  font-size: 14px;
  line-height: 1;
}

.play-btn {
  width: 34px;
  height: 34px;
  background: rgba(64, 196, 255, 0.2);
  border-color: rgba(64, 196, 255, 0.7);

  .control-icon {
    font-size: 16px;
  }

  &:hover {
    background: rgba(64, 196, 255, 0.35);
  }
}

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
