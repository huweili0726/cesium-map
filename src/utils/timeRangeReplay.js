import { getDroneTrack } from '@/api/replay'
import { TrackBuffer, ReplayEngine, CesiumRendererAdapter } from '@/components/cesiumMap/js/replayEngine'

/**
 * 回放配置常量
 * @constant
 * @type {Object}
 * @property {string} DRONE_ID - 无人机ID（固定值）
 * @property {number} CHUNK_DURATION - 分段查询时长（毫秒），默认1分钟
 * @property {number} REPLAY_SPEED - 回放速度倍数
 * @property {boolean} LOOP - 是否循环播放
 */
const REPLAY_CONFIG = {
  DRONE_ID: 'AWHZTR9S2603CC005196',
  CHUNK_DURATION: 60 * 1000,
  REPLAY_SPEED: 1,
  LOOP: false
}

/**
 * 将 datetime-local 格式字符串转换为毫秒级时间戳
 * 
 * @param {string} dateTimeStr - 输入的时间字符串，格式为 "YYYY-MM-DDTHH:MM:SS"
 * @returns {number} 返回毫秒级时间戳，无效输入返回 NaN
 */
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

/**
 * 从 API 响应中提取轨迹数据列表
 * 
 * 支持多种响应格式：
 * - 直接返回数组
 * - { data: [...] }
 * - { data: { list: [...] } }
 * - { list: [...] }
 * 
 * @param {any} res - API 响应数据
 * @returns {Array} 轨迹数据列表，无数据时返回空数组
 */
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

/**
 * 验证时间输入并转换为时间戳
 * 
 * @param {string} startTimeStr - 开始时间字符串
 * @param {string} endTimeStr - 结束时间字符串
 * @returns {{ startTime: number, endTime: number } | null} 验证成功返回时间戳对象，失败返回 null
 */
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

/**
 * 分段查询无人机轨迹数据
 * 
 * 每次查询一个时间段（默认1分钟）的数据，避免一次性加载过多数据。
 * 
 * @param {number} startTime - 查询起始时间戳（毫秒）
 * @param {number} endTime - 查询结束时间戳（毫秒）
 * @returns {Promise<Array>} 轨迹点列表
 */
export const queryTrackChunk = async(startTime, endTime) => {
  const chunkEndTime = Math.min(startTime + REPLAY_CONFIG.CHUNK_DURATION, endTime)
  const res = await getDroneTrack({
    droneId: REPLAY_CONFIG.DRONE_ID,
    startTime,
    endTime: chunkEndTime
  })
  return getTrackList(res)
}

/**
 * 创建并初始化回放引擎
 * 
 * 创建 TrackBuffer、CesiumRendererAdapter 和 ReplayEngine 实例，
 * 并初始化回放引擎。
 * 
 * @param {Array} trackData - 初始轨迹数据
 * @param {number} startTime - 回放开始时间戳
 * @param {number} endTime - 回放结束时间戳
 * @returns {ReplayEngine | null} 回放引擎实例，初始化失败返回 null
 */
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

/**
 * 清理回放相关资源
 * 
 * 移除预加载监听器并销毁回放引擎实例，避免内存泄漏。
 * 
 * @param {Function | null} preloadOff - 预加载监听器的取消函数
 * @param {ReplayEngine | null} engine - 回放引擎实例
 */
export const cleanupReplayResources = (preloadOff, engine) => {
  if (preloadOff) {
    preloadOff()
  }
  if (engine) {
    engine.destroy()
  }
}

/**
 * 轨迹预加载管理器
 * 
 * 负责在回放过程中动态加载后续轨迹数据，实现平滑的分段回放体验。
 */
export class TrackPreloader {
  /**
   * 构造函数
   * @param {ReplayEngine} engine - 回放引擎实例
   * @param {number} startTime - 回放开始时间戳
   * @param {number} endTime - 回放结束时间戳
   */
  constructor(engine, startTime, endTime) {
    this.engine = engine
    this.endTime = endTime
    this.nextChunkStartTime = startTime + REPLAY_CONFIG.CHUNK_DURATION
    this.loadingNextChunk = false
    this.loadedChunks = new Set([startTime])
  }

  /**
   * 加载下一段轨迹数据
   * 
   * 检查前置条件后，异步查询并追加轨迹数据到引擎。
   */
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

  /**
   * 检查是否可以加载下一段数据
   * 
   * @returns {boolean} 是否满足加载条件
   */
  canLoadNextChunk() {
    return !this.loadingNextChunk &&
           this.nextChunkStartTime < this.endTime &&
           !this.loadedChunks.has(this.nextChunkStartTime)
  }

  /**
   * 获取下一个分段的开始时间
   * 
   * @returns {number} 下一个分段的开始时间戳
   */
  getNextChunkStartTime() {
    return this.nextChunkStartTime
  }

  /**
   * 检查是否所有分段都已加载完成
   * 
   * @returns {boolean} 是否全部加载完成
   */
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