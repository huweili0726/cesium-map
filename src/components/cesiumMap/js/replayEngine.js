/**
 * 自定义轨迹回放引擎
 *
 * ReplayEngine 负责时间推进和播放状态；TrackBuffer 负责轨迹数据缓存和插值；
 * CesiumRendererAdapter 只负责把当前回放状态渲染到 Cesium。
 */
import * as Cesium from 'cesium'
import { useMapStore } from '@/stores/modules/mapStore'
import { setPath } from '@/components/cesiumMap/js/setPath'
import { setPoint } from '@/components/cesiumMap/js/setPoint'
import { movePathConfig } from '@/components/cesiumMap/js/movePath'
import { ClickHandler } from '@/components/cesiumMap/js/bindClickHandler'

const DEFAULT_FRAME_INTERVAL = 1000 / 30
const MIN_TRAIL_DISTANCE = 1

/**
 * 业务回放主时钟
 *
 * 全局只需要一个，通常在 CesiumMap 初始化时创建。
 * 它只负责用 requestAnimationFrame 产生统一的业务帧，不依赖 Cesium Clock。
 */
export class BusinessReplayClock {
  constructor(options = {}) {
    this.frameInterval = options.frameInterval || DEFAULT_FRAME_INTERVAL
    this.subscribers = new Set()
    this.isRunning = false
    this.rafId = null
    this.lastFrameTime = 0
    this.accumulator = 0
  }

  start() {
    if (this.isRunning) {
      return
    }

    this.isRunning = true
    this.lastFrameTime = performance.now()
    this.rafId = window.requestAnimationFrame((time) => this.tick(time))
  }

  stop() {
    this.isRunning = false
    if (this.rafId) {
      window.cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.lastFrameTime = 0
    this.accumulator = 0
  }

  subscribe(callback) {
    this.subscribers.add(callback)
    this.start()
    return () => this.unsubscribe(callback)
  }

  unsubscribe(callback) {
    this.subscribers.delete(callback)
    if (!this.subscribers.size) {
      this.stop()
    }
  }

  tick(now) {
    if (!this.isRunning) {
      return
    }

    const delta = now - this.lastFrameTime
    this.lastFrameTime = now
    this.accumulator += delta

    if (this.accumulator >= this.frameInterval) {
      const frameDelta = this.accumulator
      this.accumulator = 0
      this.subscribers.forEach(callback => callback({ now, delta: frameDelta }))
    }

    this.rafId = window.requestAnimationFrame((time) => this.tick(time))
  }

  destroy() {
    this.stop()
    this.subscribers.clear()
  }
}

export class TrackBuffer {
  constructor(trackData = []) {
    this.points = []
    this.timestampSet = new Set()
    this.append(trackData)
  }

  append(trackData = []) {
    if (!Array.isArray(trackData)) {
      return 0
    }

    const newPoints = trackData
      .filter(point => point && Number.isFinite(point.timestamp) && !this.timestampSet.has(point.timestamp))
      .map(point => ({ ...point }))
      .sort((a, b) => a.timestamp - b.timestamp)

    newPoints.forEach(point => {
      this.timestampSet.add(point.timestamp)
      this.points.push(point)
    })

    this.points.sort((a, b) => a.timestamp - b.timestamp)
    return newPoints.length
  }

  get length() {
    return this.points.length
  }

  getFirstPoint() {
    return this.points[0] || null
  }

  getLastPoint() {
    return this.points[this.points.length - 1] || null
  }

  getStateAt(timestamp) {
    if (!this.points.length) {
      return null
    }

    if (timestamp <= this.points[0].timestamp) {
      return { ...this.points[0] }
    }

    const lastPoint = this.points[this.points.length - 1]
    if (timestamp >= lastPoint.timestamp) {
      return { ...lastPoint }
    }

    let left = 0
    let right = this.points.length - 1

    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const midTimestamp = this.points[mid].timestamp

      if (midTimestamp === timestamp) {
        return { ...this.points[mid] }
      }

      if (midTimestamp < timestamp) {
        left = mid + 1
      } else {
        right = mid - 1
      }
    }

    const prev = this.points[right]
    const next = this.points[left]
    if (!prev || !next) {
      return prev ? { ...prev } : { ...next }
    }

    const ratio = (timestamp - prev.timestamp) / (next.timestamp - prev.timestamp)
    return {
      ...prev,
      lng: prev.lng + (next.lng - prev.lng) * ratio,
      lat: prev.lat + (next.lat - prev.lat) * ratio,
      height: (prev.height || 0) + ((next.height || 0) - (prev.height || 0)) * ratio,
      heading: this.interpolateOptionalValue(prev.heading, next.heading, ratio),
      pitch: this.interpolateOptionalValue(prev.pitch, next.pitch, ratio),
      timestamp
    }
  }

  interpolateOptionalValue(prevValue, nextValue, ratio) {
    if (!Number.isFinite(prevValue) || !Number.isFinite(nextValue)) {
      return Number.isFinite(prevValue) ? prevValue : nextValue
    }

    return prevValue + (nextValue - prevValue) * ratio
  }
}

export class CesiumRendererAdapter {
  constructor(options) {
    this.droneId = options.droneId
    this.baseUrl = options.baseUrl
    this.trackBuffer = options.trackBuffer
    this.mapStore = useMapStore()
    this.map = this.mapStore.getMap()
    this.lastTrailPosition = null
    this.droneEntity = null
    this.trailData = null

    const { setDronePointByGlb } = setPoint(this.baseUrl)
    const { setDroneTrail, clearDroneTrail } = setPath()
    const { moveDroneTrail } = movePathConfig()
    const { bindDroneClickHandler } = ClickHandler()

    this.setDronePointByGlb = setDronePointByGlb
    this.setDroneTrail = setDroneTrail
    this.clearDroneTrail = clearDroneTrail
    this.moveDroneTrail = moveDroneTrail
    this.bindDroneClickHandler = bindDroneClickHandler
  }

  init() {
    if (!this.map) {
      console.error('地图实例不存在')
      return false
    }

    const firstPoint = this.trackBuffer.getFirstPoint()
    if (!firstPoint) {
      console.error('回放数据为空')
      return false
    }

    this.droneEntity = this.mapStore.getGraphicMap(this.droneId)
    if (!this.droneEntity) {
      this.droneEntity = this.setDronePointByGlb({
        id: this.droneId,
        lng: firstPoint.lng,
        lat: firstPoint.lat,
        height: firstPoint.height || 0,
        heading: firstPoint.heading || 0,
        type: 'png'
      })

      if (this.droneEntity) {
        this.bindDroneClickHandler({ id: this.droneId, modelEntity: this.droneEntity })
      }
    }

    const firstPosition = this.toCartesian(firstPoint)
    const trailId = `${this.droneId}_trail`
    this.trailData = this.mapStore.getDroneTrail(trailId)

    if (!this.trailData) {
      this.trailData = this.setDroneTrail({
        pointId: this.droneId,
        startPosition: firstPosition
      })
    }

    if (this.trailData) {
      this.trailData.positions = [{ position: firstPosition.clone(), timestamp: this.toJulianDate(firstPoint.timestamp) }]
      this.trailData.lastUpdateTime = this.toJulianDate(firstPoint.timestamp)
    }

    this.lastTrailPosition = firstPosition.clone()
    this.render(firstPoint, { forceTrail: true })
    return true
  }

  render(state, options = {}) {
    if (!state || !this.droneEntity?.entity) {
      return
    }

    const position = this.toCartesian(state)
    this.droneEntity.entity.position = position

    if (Number.isFinite(state.heading) || Number.isFinite(state.pitch)) {
      this.droneEntity.entity.orientation = Cesium.Transforms.headingPitchRollQuaternion(
        position,
        new Cesium.HeadingPitchRoll(
          Cesium.Math.toRadians(Number(state.heading) || 0),
          Cesium.Math.toRadians(Number(state.pitch) || 0),
          0
        )
      )
    }

    this.updateTrail(position, state.timestamp, options.forceTrail)
  }

  updateTrail(position, timestamp, forceTrail = false) {
    if (!this.trailData?.entity) {
      return
    }

    if (!forceTrail && this.lastTrailPosition) {
      const distance = Cesium.Cartesian3.distance(this.lastTrailPosition, position)
      if (distance <= MIN_TRAIL_DISTANCE) {
        return
      }
    }

    const currentTime = this.toJulianDate(timestamp)
    const oldClockTime = this.map.clock.currentTime
    this.map.clock.currentTime = currentTime

    this.moveDroneTrail({
      pointId: this.droneId,
      newPosition: position
    })

    this.map.clock.currentTime = oldClockTime
    this.lastTrailPosition = position.clone()
  }

  seek(state) {
    if (!state) {
      return
    }

    const position = this.toCartesian(state)
    const currentTime = this.toJulianDate(state.timestamp)

    if (this.trailData) {
      this.trailData.positions = [{ position: position.clone(), timestamp: currentTime }]
      this.trailData.lastUpdateTime = currentTime
    }

    this.lastTrailPosition = position.clone()
    this.render(state, { forceTrail: true })
  }

  destroy() {
    this.clearDroneTrail(this.droneId)

    const droneEntity = this.mapStore.getGraphicMap(this.droneId)
    if (this.map && droneEntity?.entity) {
      this.map.entities.remove(droneEntity.entity)
      this.mapStore.graphicMap.delete(this.droneId)
    }
  }

  toCartesian(point) {
    return Cesium.Cartesian3.fromDegrees(point.lng, point.lat, point.height || 0)
  }

  toJulianDate(timestamp) {
    return Cesium.JulianDate.fromDate(new Date(timestamp))
  }
}

export class ReplayEngine {
  constructor(options) {
    this.trackBuffer = options.trackBuffer
    this.renderer = options.renderer
    this.startTime = options.startTime
    this.endTime = options.endTime
    this.speed = options.speed || 1
    this.loop = options.loop || false
    this.frameInterval = options.frameInterval || DEFAULT_FRAME_INTERVAL
    this.businessClock = options.businessClock || useMapStore().getReplayClock() || new BusinessReplayClock({ frameInterval: this.frameInterval })
    this.currentTime = this.startTime
    this.isPlaying = false
    this.hasPlayed = false
    this.unsubscribeClock = null
    this.onTickCallbacks = new Set()
    this.onStateChangeCallbacks = new Set()
    this.onEndCallbacks = new Set()
  }

  init() {
    const inited = this.renderer.init()
    if (inited) {
      this.seek(0)
    }
    return inited
  }

  play() {
    if (this.isPlaying) {
      return
    }

    this.isPlaying = true
    this.hasPlayed = true
    this.unsubscribeClock = this.businessClock.subscribe(({ delta }) => this.tick(delta))
    this.emitStateChange()
  }

  pause() {
    if (!this.hasPlayed || !this.isPlaying) {
      return
    }

    this.isPlaying = false
    this.unsubscribeBusinessClock()
    this.emitStateChange()
  }

  continue() {
    if (!this.hasPlayed || this.isPlaying) {
      return
    }

    this.play()
  }

  stop() {
    this.pause()
    this.seekToTime(this.startTime)
  }

  seek(offsetSeconds) {
    this.seekToTime(this.startTime + offsetSeconds * 1000)
  }

  seekToTime(timestamp) {
    const targetTime = Math.min(this.endTime, Math.max(this.startTime, timestamp))
    this.currentTime = targetTime
    this.renderer.seek(this.trackBuffer.getStateAt(this.currentTime))
    this.emitTick()
    this.emitStateChange()
  }

  getState() {
    return this.createStatePayload()
  }

  appendData(trackData) {
    return this.trackBuffer.append(trackData)
  }

  onTick(callback) {
    this.onTickCallbacks.add(callback)
    return () => this.onTickCallbacks.delete(callback)
  }

  onStateChange(callback) {
    this.onStateChangeCallbacks.add(callback)
    callback(this.createStatePayload())
    return () => this.onStateChangeCallbacks.delete(callback)
  }

  onEnd(callback) {
    this.onEndCallbacks.add(callback)
    return () => this.onEndCallbacks.delete(callback)
  }

  destroy() {
    this.unsubscribeBusinessClock()
    this.isPlaying = false
    this.renderer.destroy()
    this.onTickCallbacks.clear()
    this.onStateChangeCallbacks.clear()
    this.onEndCallbacks.clear()
  }

  tick(delta) {
    if (!this.isPlaying) {
      return
    }

    this.currentTime += delta * this.speed

    if (this.currentTime >= this.endTime) {
      if (this.loop) {
        this.currentTime = this.startTime
        this.renderer.seek(this.trackBuffer.getStateAt(this.currentTime))
      } else {
        this.currentTime = this.endTime
        this.isPlaying = false
        this.unsubscribeBusinessClock()
        this.emitStateChange()
      }
    }

    const state = this.trackBuffer.getStateAt(this.currentTime)
    this.renderer.render(state)
    this.emitTick()

    if (!this.isPlaying && this.currentTime >= this.endTime) {
      this.emitEnd()
    }
  }

  createStatePayload() {
    return {
      currentTime: this.currentTime,
      startTime: this.startTime,
      endTime: this.endTime,
      speed: this.speed,
      isPlaying: this.isPlaying,
      progress: this.endTime > this.startTime ? (this.currentTime - this.startTime) / (this.endTime - this.startTime) : 0
    }
  }

  emitTick() {
    const payload = this.createStatePayload()
    this.onTickCallbacks.forEach(callback => callback(payload))
    this.onStateChangeCallbacks.forEach(callback => callback(payload))
  }

  emitStateChange() {
    const payload = this.createStatePayload()
    this.onStateChangeCallbacks.forEach(callback => callback(payload))
  }

  emitEnd() {
    this.onEndCallbacks.forEach(callback => callback())
  }

  unsubscribeBusinessClock() {
    if (this.unsubscribeClock) {
      this.unsubscribeClock()
      this.unsubscribeClock = null
    }
  }
}
