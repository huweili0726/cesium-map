import { getDroneTrack } from '@/api/replay'
import { TrackBuffer, ReplayEngine, CesiumRendererAdapter } from '@/components/cesiumMap/js/replayEngine'

const REPLAY_CONFIG = {
  DRONE_ID: 'AWHZTR9S2603CC005196',
  CHUNK_DURATION: 60 * 1000,
  REPLAY_SPEED: 1,
  LOOP: false
}

const convertToTimestamp = (dateTimeStr) => {
  if (!dateTimeStr) {
    return NaN
  }

  try {
    const match = dateTimeStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/)
    if (!match) {
      return NaN
    }
    const [, year, month, day, hour, minute, second] = match.map(Number)

    if (year < 1970 || month < 1 || month > 12 || day < 1 || day > 31 ||
        hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
      return NaN
    }

    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
    return date.getTime()
  } catch {
    return NaN
  }
}

const getTrackList = (res) => {
  if (Array.isArray(res)) {
    return res
  }

  if (Array.isArray(res?.data)) {
    return res.data
  }

  if (Array.isArray(res?.data?.list)) {
    return res.data.list
  }

  if (Array.isArray(res?.list)) {
    return res.list
  }

  return []
}

export const validateTimeInput = (startTimeStr, endTimeStr) => {
  if (!startTimeStr || !endTimeStr) {
    alert('请输入开始时间和结束时间')
    return null
  }

  const startTime = convertToTimestamp(startTimeStr)
  const endTime = convertToTimestamp(endTimeStr)

  if (isNaN(startTime) || isNaN(endTime)) {
    alert('时间格式不正确，请使用 yyyy-MM-dd HH:mm:ss 格式')
    return null
  }

  if (startTime >= endTime) {
    alert('开始时间必须早于结束时间')
    return null
  }

  return { startTime, endTime }
}

export const queryTrackChunk = async(startTime, endTime) => {
  const chunkEndTime = Math.min(startTime + REPLAY_CONFIG.CHUNK_DURATION, endTime)
  const res = await getDroneTrack({
    droneId: REPLAY_CONFIG.DRONE_ID,
    startTime,
    endTime: chunkEndTime
  })
  return getTrackList(res)
}

export const createReplayEngine = (trackData, startTime, endTime) => {
  const trackBuffer = new TrackBuffer(trackData)
  const renderer = new CesiumRendererAdapter({
    droneId: 'drone_replay_time_range',
    baseUrl: process.env.BASE_URL,
    trackBuffer
  })

  const engine = new ReplayEngine({
    trackBuffer,
    renderer,
    startTime,
    endTime,
    speed: REPLAY_CONFIG.REPLAY_SPEED,
    loop: REPLAY_CONFIG.LOOP
  })

  return engine.init() ? engine : null
}

export const cleanupReplayResources = (preloadOff, engine) => {
  if (preloadOff) {
    preloadOff()
  }
  if (engine) {
    engine.destroy()
  }
}

export class TrackPreloader {
  constructor(engine, startTime, endTime) {
    this.engine = engine
    this.endTime = endTime
    this.nextChunkStartTime = startTime + REPLAY_CONFIG.CHUNK_DURATION
    this.loadingNextChunk = false
    this.loadedChunks = new Set([startTime])
  }

  async loadNextChunk() {
    if (!this.canLoadNextChunk()) return

    this.loadingNextChunk = true
    const currentChunkStartTime = this.nextChunkStartTime

    try {
      const trackData = await queryTrackChunk(currentChunkStartTime, this.endTime)
      if (trackData.length > 0) {
        this.engine.appendData(trackData)
      }
      this.loadedChunks.add(currentChunkStartTime)
      this.nextChunkStartTime = currentChunkStartTime + REPLAY_CONFIG.CHUNK_DURATION
    } catch (error) {
      console.error('预加载下一段无人机轨迹失败:', error)
    } finally {
      this.loadingNextChunk = false
    }
  }

  canLoadNextChunk() {
    return !this.loadingNextChunk &&
           this.nextChunkStartTime < this.endTime &&
           !this.loadedChunks.has(this.nextChunkStartTime)
  }

  getNextChunkStartTime() {
    return this.nextChunkStartTime
  }

  isAllLoaded() {
    return this.nextChunkStartTime >= this.endTime
  }
}

export { REPLAY_CONFIG }

export default {
  validateTimeInput,
  queryTrackChunk,
  createReplayEngine,
  cleanupReplayResources,
  TrackPreloader,
  REPLAY_CONFIG
}