/**
 * 自定义轨迹回放引擎模块
 * 
 * 这个文件包含四个核心类，共同实现无人机轨迹回放功能：
 * 1. BusinessReplayClock - 全局业务时钟，负责产生统一的时间帧
 * 2. TrackBuffer - 轨迹数据缓存器，负责数据存储和插值计算
 * 3. CesiumRendererAdapter - Cesium渲染适配器，负责3D渲染
 * 4. ReplayEngine - 回放引擎主控制器，协调所有模块
 */

// 导入Cesium地图库
import * as Cesium from 'cesium'
// 导入状态管理store
import { useMapStore } from '@/stores/modules/mapStore'
// 导入轨迹相关工具函数
import { setPath } from '@/components/cesiumMap/js/setPath'
import { setPoint } from '@/components/cesiumMap/js/setPoint'
import { movePathConfig } from '@/components/cesiumMap/js/movePath'
import { ClickHandler } from '@/components/cesiumMap/js/bindClickHandler'

// 默认帧间隔：每秒30帧，约33毫秒
const DEFAULT_FRAME_INTERVAL = 1000 / 30
// 轨迹点之间的最小距离（米），小于这个距离不更新轨迹
const MIN_TRAIL_DISTANCE = 1

/**
 * 业务回放主时钟类
 * 
 * 这是一个全局单例时钟，不依赖Cesium的Clock，使用浏览器的requestAnimationFrame实现。
 * 作用：以固定帧率产生时间脉冲，驱动所有回放引擎同步更新。
 * 
 * 设计思想：
 * - 全局只需要一个实例，避免多个时钟导致不同步
 * - 使用发布-订阅模式，多个回放引擎可以订阅同一个时钟
 * - 自动管理生命周期：没有订阅者时自动停止
 */
export class BusinessReplayClock {
  /**
   * 构造函数
   * @param {Object} options 配置选项
   * @param {number} options.frameInterval 帧间隔（毫秒），默认33ms(30fps)
   */
  constructor(options = {}) {
    // 帧间隔时间（毫秒）
    this.frameInterval = options.frameInterval || DEFAULT_FRAME_INTERVAL
    // 订阅者集合，存储所有注册的回调函数
    this.subscribers = new Set()
    // 是否正在运行
    this.isRunning = false
    // requestAnimationFrame的ID，用于取消
    this.rafId = null
    // 上一帧的时间戳
    this.lastFrameTime = 0
    // 时间累加器，用于实现固定帧率
    this.accumulator = 0
  }

  /**
   * 启动时钟
   */
  start() {
    // 如果已经在运行，直接返回
    if (this.isRunning) {
      return
    }

    this.isRunning = true
    // 记录当前时间作为起始点
    this.lastFrameTime = performance.now()
    // 开始循环调用tick
    this.rafId = window.requestAnimationFrame((time) => this.tick(time))
  }

  /**
   * 停止时钟
   */
  stop() {
    this.isRunning = false
    // 取消requestAnimationFrame
    if (this.rafId) {
      window.cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    // 重置状态
    this.lastFrameTime = 0
    this.accumulator = 0
  }

  /**
   * 订阅时钟事件
   * @param {Function} callback 每帧触发的回调函数，接收 {now, delta} 参数
   * @returns {Function} 取消订阅的函数
   */
  subscribe(callback) {
    // 添加到订阅者集合
    this.subscribers.add(callback)
    // 如果还没运行，自动启动
    this.start()
    // 返回取消订阅的函数
    return () => this.unsubscribe(callback)
  }

  /**
   * 取消订阅
   * @param {Function} callback 要取消的回调函数
   */
  unsubscribe(callback) {
    // 从订阅者集合中移除
    this.subscribers.delete(callback)
    // 如果没有订阅者了，自动停止时钟
    if (!this.subscribers.size) {
      this.stop()
    }
  }

  /**
   * 时钟滴答函数，每帧被调用
   * @param {number} now 当前时间戳（毫秒）
   */
  tick(now) {
    // 如果已经停止，直接返回
    if (!this.isRunning) {
      return
    }

    // 计算距离上一帧的时间差
    const delta = now - this.lastFrameTime
    // 更新上一帧时间
    this.lastFrameTime = now
    // 累加时间
    this.accumulator += delta

    // 当累加的时间超过帧间隔时，触发所有订阅者
    if (this.accumulator >= this.frameInterval) {
      const frameDelta = this.accumulator
      this.accumulator = 0
      // 通知所有订阅者
      this.subscribers.forEach(callback => callback({ now, delta: frameDelta }))
    }

    // 继续下一帧
    this.rafId = window.requestAnimationFrame((time) => this.tick(time))
  }

  /**
   * 销毁时钟，清理资源
   */
  destroy() {
    this.stop()
    this.subscribers.clear()
  }
}

/**
 * 轨迹数据缓存器类
 * 
 * 负责存储轨迹点数据，并提供根据时间戳获取插值状态的能力。
 * 核心功能：
 * - 去重存储轨迹点
 * - 按时间戳排序
 * - 根据时间戳插值计算中间状态
 */
export class TrackBuffer {
  /**
   * 构造函数
   * @param {Array} trackData 轨迹数据数组，每个点包含：lng, lat, height, timestamp, heading, pitch
   */
  constructor(trackData = []) {
    // 存储所有轨迹点
    this.points = []
    // 用于去重的时间戳集合
    this.timestampSet = new Set()
    // 初始化时追加数据
    this.append(trackData)
  }

  /**
   * 追加轨迹数据
   * @param {Array} trackData 要追加的轨迹数据
   * @returns {number} 新增的点数
   */
  append(trackData = []) {
    // 检查是否为数组
    if (!Array.isArray(trackData)) {
      return 0
    }

    // 过滤有效数据：
    // 1. 点对象存在
    // 2. timestamp是有效数字
    // 3. 时间戳不在已有的集合中（去重）
    const newPoints = trackData
      .filter(point => point && Number.isFinite(point.timestamp) && !this.timestampSet.has(point.timestamp))
      // 深拷贝，避免原数据被修改
      .map(point => ({ ...point }))
      // 按时间戳排序
      .sort((a, b) => a.timestamp - b.timestamp)

    // 添加到缓存
    newPoints.forEach(point => {
      this.timestampSet.add(point.timestamp)
      this.points.push(point)
    })

    // 确保整体有序
    this.points.sort((a, b) => a.timestamp - b.timestamp)
    // 返回新增数量
    return newPoints.length
  }

  /**
   * 获取轨迹点数量
   * @returns {number} 点数
   */
  get length() {
    return this.points.length
  }

  /**
   * 获取第一个轨迹点
   * @returns {Object|null} 第一个点
   */
  getFirstPoint() {
    return this.points[0] || null
  }

  /**
   * 获取最后一个轨迹点
   * @returns {Object|null} 最后一个点
   */
  getLastPoint() {
    return this.points[this.points.length - 1] || null
  }

  /**
   * 根据时间戳获取插值后的状态
   * @param {number} timestamp 时间戳（毫秒）
   * @returns {Object|null} 插值后的状态对象
   */
  getStateAt(timestamp) {
    // 如果没有数据，返回null
    if (!this.points.length) {
      return null
    }

    // 如果时间戳早于第一个点，返回第一个点的状态
    if (timestamp <= this.points[0].timestamp) {
      return { ...this.points[0] }
    }

    // 如果时间戳晚于最后一个点，返回最后一个点的状态
    const lastPoint = this.points[this.points.length - 1]
    if (timestamp >= lastPoint.timestamp) {
      return { ...lastPoint }
    }

    // 使用二分查找找到时间戳所在的区间
    let left = 0
    let right = this.points.length - 1

    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const midTimestamp = this.points[mid].timestamp

      // 找到精确匹配
      if (midTimestamp === timestamp) {
        return { ...this.points[mid] }
      }

      // 调整查找范围
      if (midTimestamp < timestamp) {
        left = mid + 1
      } else {
        right = mid - 1
      }
    }

    // 找到相邻的两个点
    const prev = this.points[right]
    const next = this.points[left]
    
    // 边界检查
    if (!prev || !next) {
      return prev ? { ...prev } : { ...next }
    }

    // 计算插值比例：当前时间在两个点之间的位置
    const ratio = (timestamp - prev.timestamp) / (next.timestamp - prev.timestamp)
    
    // 线性插值计算中间状态
    return {
      ...prev,  // 继承前一个点的所有属性
      lng: prev.lng + (next.lng - prev.lng) * ratio,           // 经度插值
      lat: prev.lat + (next.lat - prev.lat) * ratio,           // 纬度插值
      height: (prev.height || 0) + ((next.height || 0) - (prev.height || 0)) * ratio,  // 高度插值
      heading: this.interpolateOptionalValue(prev.heading, next.heading, ratio),  // 航向插值
      pitch: this.interpolateOptionalValue(prev.pitch, next.pitch, ratio),        // 俯仰角插值
      timestamp  // 更新时间戳为当前查询时间
    }
  }

  /**
   * 可选值的插值函数（处理可能为undefined/null的值）
   * @param {number|undefined} prevValue 前一个值
   * @param {number|undefined} nextValue 后一个值
   * @param {number} ratio 插值比例（0-1）
   * @returns {number|undefined} 插值结果
   */
  interpolateOptionalValue(prevValue, nextValue, ratio) {
    // 如果任一值无效，返回有效的那个值
    if (!Number.isFinite(prevValue) || !Number.isFinite(nextValue)) {
      return Number.isFinite(prevValue) ? prevValue : nextValue
    }

    // 线性插值
    return prevValue + (nextValue - prevValue) * ratio
  }
}

/**
 * Cesium渲染适配器类
 * 
 * 负责将回放状态渲染到Cesium地图上，包括：
 * - 无人机模型的位置和姿态更新
 * - 轨迹线的绘制和更新
 * 
 * 这是一个适配器模式，将通用的回放状态转换为Cesium特定的渲染调用。
 */
export class CesiumRendererAdapter {
  /**
   * 构造函数
   * @param {Object} options 配置选项
   * @param {string} options.droneId 无人机ID
   * @param {string} options.baseUrl 模型资源基础路径
   * @param {TrackBuffer} options.trackBuffer 轨迹数据缓存器
   */
  constructor(options) {
    this.droneId = options.droneId
    this.baseUrl = options.baseUrl
    this.trackBuffer = options.trackBuffer
    // 获取状态管理
    this.mapStore = useMapStore()
    // 获取地图实例
    this.map = this.mapStore.getMap()
    // 上一次轨迹点位置（用于计算距离）
    this.lastTrailPosition = null
    // 无人机实体对象
    this.droneEntity = null
    // 轨迹数据
    this.trailData = null

    // 初始化各种工具函数
    const { setDronePointByGlb } = setPoint(this.baseUrl)
    const { setDroneTrail, clearDroneTrail } = setPath()
    const { moveDroneTrail } = movePathConfig()
    const { bindDroneClickHandler } = ClickHandler()

    // 保存到实例上
    this.setDronePointByGlb = setDronePointByGlb
    this.setDroneTrail = setDroneTrail
    this.clearDroneTrail = clearDroneTrail
    this.moveDroneTrail = moveDroneTrail
    this.bindDroneClickHandler = bindDroneClickHandler
  }

  /**
   * 初始化渲染器
   * @returns {boolean} 是否初始化成功
   */
  init() {
    // 检查地图是否存在
    if (!this.map) {
      console.error('地图实例不存在')
      return false
    }

    // 检查轨迹数据是否存在
    const firstPoint = this.trackBuffer.getFirstPoint()
    if (!firstPoint) {
      console.error('回放数据为空')
      return false
    }

    // 获取或创建无人机实体
    this.droneEntity = this.mapStore.getGraphicMap(this.droneId)
    if (!this.droneEntity) {
      // 创建无人机点
      this.droneEntity = this.setDronePointByGlb({
        id: this.droneId,
        lng: firstPoint.lng,
        lat: firstPoint.lat,
        height: firstPoint.height || 0,
        heading: firstPoint.heading || 0,
        type: 'png'
      })

      // 绑定点击事件处理器
      if (this.droneEntity) {
        this.bindDroneClickHandler({ id: this.droneId, modelEntity: this.droneEntity })
      }
    }

    // 获取或创建轨迹
    const firstPosition = this.toCartesian(firstPoint)
    const trailId = `${this.droneId}_trail`
    this.trailData = this.mapStore.getDroneTrail(trailId)

    if (!this.trailData) {
      this.trailData = this.setDroneTrail({
        pointId: this.droneId,
        startPosition: firstPosition
      })
    }

    // 初始化轨迹数据
    if (this.trailData) {
      this.trailData.positions = [{ position: firstPosition.clone(), timestamp: this.toJulianDate(firstPoint.timestamp) }]
      this.trailData.lastUpdateTime = this.toJulianDate(firstPoint.timestamp)
    }

    // 记录初始位置
    this.lastTrailPosition = firstPosition.clone()
    // 初始渲染
    this.render(firstPoint, { forceTrail: true })
    return true
  }

  /**
   * 渲染当前状态
   * @param {Object} state 当前状态（包含lng, lat, height, heading, pitch, timestamp）
   * @param {Object} options 选项
   * @param {boolean} options.forceTrail 是否强制更新轨迹
   */
  render(state, options = {}) {
    // 状态或实体不存在则返回
    if (!state || !this.droneEntity?.entity) {
      return
    }

    // 将经纬度高度转换为Cesium笛卡尔坐标
    const position = this.toCartesian(state)
    // 更新无人机位置
    this.droneEntity.entity.position = position

    // 如果有航向或俯仰角，更新朝向
    if (Number.isFinite(state.heading) || Number.isFinite(state.pitch)) {
      this.droneEntity.entity.orientation = Cesium.Transforms.headingPitchRollQuaternion(
        position,
        new Cesium.HeadingPitchRoll(
          Cesium.Math.toRadians(Number(state.heading) || 0),  // 航向（角度转弧度）
          Cesium.Math.toRadians(Number(state.pitch) || 0),    // 俯仰角（角度转弧度）
          0  // 滚转角固定为0
        )
      )
    }

    // 更新轨迹
    this.updateTrail(position, state.timestamp, options.forceTrail)
  }

  /**
   * 更新轨迹线
   * @param {Cesium.Cartesian3} position 当前位置
   * @param {number} timestamp 当前时间戳
   * @param {boolean} forceTrail 是否强制更新
   */
  updateTrail(position, timestamp, forceTrail = false) {
    // 轨迹数据不存在则返回
    if (!this.trailData?.entity) {
      return
    }

    // 如果不是强制更新，检查距离是否超过最小阈值
    if (!forceTrail && this.lastTrailPosition) {
      const distance = Cesium.Cartesian3.distance(this.lastTrailPosition, position)
      if (distance <= MIN_TRAIL_DISTANCE) {
        return  // 距离太近，不更新轨迹
      }
    }

    // 更新轨迹位置
    const currentTime = this.toJulianDate(timestamp)
    const oldClockTime = this.map.clock.currentTime
    // 临时修改Cesium时钟时间用于轨迹更新
    this.map.clock.currentTime = currentTime

    // 移动轨迹到新位置
    this.moveDroneTrail({
      pointId: this.droneId,
      newPosition: position
    })

    // 恢复原来的时钟时间
    this.map.clock.currentTime = oldClockTime
    // 记录当前位置作为下次比较的基准
    this.lastTrailPosition = position.clone()
  }

  /**
   * 跳转（seek）到指定状态
   * @param {Object} state 目标状态
   */
  seek(state) {
    if (!state) {
      return
    }

    // 转换坐标
    const position = this.toCartesian(state)
    const currentTime = this.toJulianDate(state.timestamp)

    // 重置轨迹
    if (this.trailData) {
      this.trailData.positions = [{ position: position.clone(), timestamp: currentTime }]
      this.trailData.lastUpdateTime = currentTime
    }

    // 更新最后轨迹位置
    this.lastTrailPosition = position.clone()
    // 强制渲染
    this.render(state, { forceTrail: true })
  }

  /**
   * 销毁渲染器，清理资源
   */
  destroy() {
    // 清除轨迹
    this.clearDroneTrail(this.droneId)

    // 移除无人机实体
    const droneEntity = this.mapStore.getGraphicMap(this.droneId)
    if (this.map && droneEntity?.entity) {
      this.map.entities.remove(droneEntity.entity)
      this.mapStore.graphicMap.delete(this.droneId)
    }
  }

  /**
   * 经纬度转笛卡尔坐标
   * @param {Object} point 包含lng, lat, height的点对象
   * @returns {Cesium.Cartesian3} 笛卡尔坐标
   */
  toCartesian(point) {
    return Cesium.Cartesian3.fromDegrees(point.lng, point.lat, point.height || 0)
  }

  /**
   * 时间戳转JulianDate（Cesium使用的时间格式）
   * @param {number} timestamp 时间戳（毫秒）
   * @returns {Cesium.JulianDate} JulianDate对象
   */
  toJulianDate(timestamp) {
    return Cesium.JulianDate.fromDate(new Date(timestamp))
  }
}

/**
 * 回放引擎主控制器类
 * 
 * 这是整个回放系统的核心，负责协调：
 * - 时间推进（通过BusinessReplayClock）
 * - 状态计算（通过TrackBuffer插值）
 * - 渲染输出（通过CesiumRendererAdapter）
 * 
 * 提供完整的播放控制API：play, pause, stop, seek等
 */
export class ReplayEngine {
  /**
   * 构造函数
   * @param {Object} options 配置选项
   * @param {TrackBuffer} options.trackBuffer 轨迹数据缓存
   * @param {CesiumRendererAdapter} options.renderer 渲染适配器
   * @param {number} options.startTime 回放开始时间戳
   * @param {number} options.endTime 回放结束时间戳
   * @param {number} options.speed 回放速度（默认1）
   * @param {boolean} options.loop 是否循环播放（默认false）
   * @param {number} options.frameInterval 帧间隔（默认33ms）
   * @param {BusinessReplayClock} options.businessClock 业务时钟（可选，默认从store获取或新建）
   */
  constructor(options) {
    this.trackBuffer = options.trackBuffer
    this.renderer = options.renderer
    this.startTime = options.startTime
    this.endTime = options.endTime
    this.speed = options.speed || 1          // 回放速度倍率
    this.loop = options.loop || false        // 是否循环
    this.frameInterval = options.frameInterval || DEFAULT_FRAME_INTERVAL
    
    // 获取业务时钟：优先使用传入的，其次从store获取，最后新建
    this.businessClock = options.businessClock || useMapStore().getReplayClock() || new BusinessReplayClock({ frameInterval: this.frameInterval })
    
    this.currentTime = this.startTime        // 当前回放时间
    this.isPlaying = false                   // 是否正在播放
    this.hasPlayed = false                   // 是否播放过（用于区分首次播放和继续播放）
    this.unsubscribeClock = null             // 时钟取消订阅函数
    
    // 事件回调集合
    this.onTickCallbacks = new Set()         // 每帧回调
    this.onStateChangeCallbacks = new Set()  // 状态变化回调
    this.onEndCallbacks = new Set()          // 播放结束回调
  }

  /**
   * 初始化引擎
   * @returns {boolean} 是否初始化成功
   */
  init() {
    // 初始化渲染器
    const inited = this.renderer.init()
    if (inited) {
      // 跳转到开始位置
      this.seek(0)
    }
    return inited
  }

  /**
   * 开始播放
   */
  play() {
    // 如果正在播放，直接返回
    if (this.isPlaying) {
      return
    }

    this.isPlaying = true
    this.hasPlayed = true
    // 订阅时钟事件
    this.unsubscribeClock = this.businessClock.subscribe(({ delta }) => this.tick(delta))
    // 通知状态变化
    this.emitStateChange()
  }

  /**
   * 暂停播放
   */
  pause() {
    // 如果从未播放或已暂停，直接返回
    if (!this.hasPlayed || !this.isPlaying) {
      return
    }

    this.isPlaying = false
    // 取消时钟订阅
    this.unsubscribeBusinessClock()
    // 通知状态变化
    this.emitStateChange()
  }

  /**
   * 继续播放（从暂停状态恢复）
   */
  continue() {
    // 如果从未播放或正在播放，直接返回
    if (!this.hasPlayed || this.isPlaying) {
      return
    }

    this.play()
  }

  /**
   * 停止播放（暂停并回到开始位置）
   */
  stop() {
    this.pause()
    this.seekToTime(this.startTime)
  }

  /**
   * 相对于开始时间跳转
   * @param {number} offsetSeconds 偏移秒数
   */
  seek(offsetSeconds) {
    this.seekToTime(this.startTime + offsetSeconds * 1000)
  }

  /**
   * 跳转到指定时间戳
   * @param {number} timestamp 目标时间戳
   */
  seekToTime(timestamp) {
    // 限制在有效范围内
    const targetTime = Math.min(this.endTime, Math.max(this.startTime, timestamp))
    this.currentTime = targetTime
    // 渲染目标状态
    this.renderer.seek(this.trackBuffer.getStateAt(this.currentTime))
    // 触发事件
    this.emitTick()
    this.emitStateChange()
  }

  /**
   * 获取当前状态
   * @returns {Object} 状态对象
   */
  getState() {
    return this.createStatePayload()
  }

  /**
   * 追加轨迹数据
   * @param {Array} trackData 新轨迹数据
   * @returns {number} 新增点数
   */
  appendData(trackData) {
    return this.trackBuffer.append(trackData)
  }

  /**
   * 订阅每帧事件
   * @param {Function} callback 回调函数
   * @returns {Function} 取消订阅函数
   */
  onTick(callback) {
    this.onTickCallbacks.add(callback)
    return () => this.onTickCallbacks.delete(callback)
  }

  /**
   * 订阅状态变化事件
   * @param {Function} callback 回调函数（立即调用一次）
   * @returns {Function} 取消订阅函数
   */
  onStateChange(callback) {
    this.onStateChangeCallbacks.add(callback)
    // 立即调用一次，同步当前状态
    callback(this.createStatePayload())
    return () => this.onStateChangeCallbacks.delete(callback)
  }

  /**
   * 订阅播放结束事件
   * @param {Function} callback 回调函数
   * @returns {Function} 取消订阅函数
   */
  onEnd(callback) {
    this.onEndCallbacks.add(callback)
    return () => this.onEndCallbacks.delete(callback)
  }

  /**
   * 销毁引擎，清理资源
   */
  destroy() {
    this.unsubscribeBusinessClock()
    this.isPlaying = false
    this.renderer.destroy()
    // 清空所有回调
    this.onTickCallbacks.clear()
    this.onStateChangeCallbacks.clear()
    this.onEndCallbacks.clear()
  }

  /**
   * 每帧更新函数（由BusinessReplayClock调用）
   * @param {number} delta 时间增量（毫秒）
   */
  tick(delta) {
    // 如果没有在播放，直接返回
    if (!this.isPlaying) {
      return
    }

    // 根据速度倍率更新当前时间
    this.currentTime += delta * this.speed

    // 检查是否到达结束时间
    if (this.currentTime >= this.endTime) {
      if (this.loop) {
        // 如果循环播放，回到开始
        this.currentTime = this.startTime
        this.renderer.seek(this.trackBuffer.getStateAt(this.currentTime))
      } else {
        // 否则停在结束位置
        this.currentTime = this.endTime
        this.isPlaying = false
        this.unsubscribeBusinessClock()
        this.emitStateChange()
      }
    }

    // 获取当前时间点的插值状态并渲染
    const state = this.trackBuffer.getStateAt(this.currentTime)
    this.renderer.render(state)
    // 触发每帧事件
    this.emitTick()

    // 如果播放结束且不是循环，触发结束事件
    if (!this.isPlaying && this.currentTime >= this.endTime) {
      this.emitEnd()
    }
  }

  /**
   * 创建状态数据对象（用于事件回调）
   * @returns {Object} 状态对象
   */
  createStatePayload() {
    return {
      currentTime: this.currentTime,           // 当前时间戳
      startTime: this.startTime,               // 开始时间戳
      endTime: this.endTime,                   // 结束时间戳
      speed: this.speed,                       // 播放速度
      isPlaying: this.isPlaying,               // 是否正在播放
      progress: this.endTime > this.startTime ? (this.currentTime - this.startTime) / (this.endTime - this.startTime) : 0  // 进度(0-1)
    }
  }

  /**
   * 触发每帧事件
   */
  emitTick() {
    const payload = this.createStatePayload()
    this.onTickCallbacks.forEach(callback => callback(payload))
    this.onStateChangeCallbacks.forEach(callback => callback(payload))
  }

  /**
   * 触发状态变化事件
   */
  emitStateChange() {
    const payload = this.createStatePayload()
    this.onStateChangeCallbacks.forEach(callback => callback(payload))
  }

  /**
   * 触发播放结束事件
   */
  emitEnd() {
    this.onEndCallbacks.forEach(callback => callback())
  }

  /**
   * 取消时钟订阅
   */
  unsubscribeBusinessClock() {
    if (this.unsubscribeClock) {
      this.unsubscribeClock()
      this.unsubscribeClock = null
    }
  }
}