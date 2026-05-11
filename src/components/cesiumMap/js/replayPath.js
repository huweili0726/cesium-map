/**
 * 轨迹回放模块
 * 
 * 提供在Cesium地图上回放无人机轨迹的功能
 * 
 * @author huweili
 * @email czxyhuweili@163.com
 * @version 1.0.0
 * @date 2025-12-29
 */
import * as Cesium from 'cesium'
import { useMapStore } from '@/stores/modules/mapStore'
import { setPath } from '@/components/cesiumMap/js/setPath'
import { setPoint } from '@/components/cesiumMap/js/setPoint'
import { ClickHandler } from '@/components/cesiumMap/js/bindClickHandler'

export function setReplay(baseUrl) {
  // 获取地图store实例
  const mapStore = useMapStore()
  const {
    setDroneTrail,
    clearDroneTrail
  } = setPath()

  const {
    setDronePointByGlb
  } = setPoint(baseUrl)

  const {
    bindDroneClickHandler,
  } = ClickHandler()

  /**
   * 无人机轨迹回放函数
   * @param options 回放配置
   * @param options.droneId 无人机ID
   * @param options.replayData 回放数据数组
   * @param options.speed 回放速度（可选，默认1.0）
   * @param options.loop 是否循环回放（可选，默认false）
   * @returns 回放控制器对象
   */
  const replayDronePath = (options) => {
    // 获取地图实例
    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return null
    }

    // 验证回放数据
    if (!options.replayData || options.replayData.length < 2) {
      console.error('回放数据不足，至少需要2个点')
      return null
    }

    // 排序回放数据（按时间戳升序）
    let sortedData = [...options.replayData].sort((a, b) => a.timestamp - b.timestamp)
    let cartesianPositions = []

    // 创建位置属性用于插值
    const positionProperty = new Cesium.SampledPositionProperty()
    positionProperty.setInterpolationOptions({
      interpolationAlgorithm: Cesium.HermitePolynomialApproximation, // 使用埃尔米特多项式插值
      interpolationDegree: 2 // 插值次数，2表示二阶埃尔米特插值
    })

    // 创建回放控制器
    // 添加一个标志记录是否已调用过play函数
    let hasPlayed = false
    
    let replayController = {
      isPlaying: false, // 是否正在播放
      speed: options.speed || 1.0, // 回放速度（1.0表示正常速度）
      loop: options.loop || false, // 是否循环回放
      pause: () => pauseReplay(), // 暂停回放（仅播放中可用）
      play: () => playReplay(), // 播放回放（从头开始）
      continue: () => continueReplay(), // 继续回放（从当前位置恢复，仅暂停后可用）
      stop: () => stopReplay(), // 停止回放（随时可用）
      seek: (time) => seekReplay(time), // 跳转回放时间（随时可用）
      appendData: (replayData) => appendReplayData(replayData), // 追加回放数据
      destroy: () => destroyReplay() // 销毁回放控制器（仅play后可用）
    }

    // 初始化无人机模型（如果不存在）
    let droneEntity = mapStore.getGraphicMap(options.droneId)
    if (!droneEntity) {
      // 使用第一个点的位置创建无人机模型
      const firstPoint = sortedData[0]
      droneEntity = setDronePointByGlb({
        id: options.droneId,
        lng: firstPoint.lng,
        lat: firstPoint.lat,
        height: firstPoint.height || 0,
        heading: 0,
        type: 'png',
      })
      if (droneEntity) {
        bindDroneClickHandler({ id: options.droneId, modelEntity: droneEntity })
      }
    }

    // 创建/更新轨迹
    // 直接使用与原轨迹相同的ID，避免修改Entity的只读id属性
    const trailId = `${options.droneId}_trail`
    let trailData = mapStore.getDroneTrail(trailId)
    
    if (!trailData) {
      // 创建新轨迹
      const firstCartesian = Cesium.Cartesian3.fromDegrees(
        sortedData[0].lng,
        sortedData[0].lat,
        sortedData[0].height || 0
      )
      trailData = setDroneTrail({
        pointId: options.droneId,
        startPosition: firstCartesian
      })
    }

    // 清空现有轨迹点
    trailData.positions = []

    const addReplaySamples = (replayData) => {
      const existedTimestamps = new Set(
        cartesianPositions.map(pos => Cesium.JulianDate.toDate(pos.timestamp).getTime())
      )
      const newData = replayData
        .filter(point => point && !existedTimestamps.has(point.timestamp))
        .sort((a, b) => a.timestamp - b.timestamp)

      if (!newData.length) {
        return []
      }

      newData.forEach(point => {
        const cartesian = Cesium.Cartesian3.fromDegrees(
          point.lng,
          point.lat,
          point.height || 0
        )
        const timestamp = Cesium.JulianDate.fromDate(new Date(point.timestamp))

        sortedData.push(point)
        cartesianPositions.push({ cartesian, timestamp })
        trailData.positions.push({ position: cartesian.clone(), timestamp })
        positionProperty.addSample(timestamp, cartesian)
      })

      sortedData.sort((a, b) => a.timestamp - b.timestamp)
      cartesianPositions.sort((a, b) => Cesium.JulianDate.compare(a.timestamp, b.timestamp))
      trailData.positions.sort((a, b) => Cesium.JulianDate.compare(a.timestamp, b.timestamp))
      trailData.lastUpdateTime = cartesianPositions[cartesianPositions.length - 1].timestamp

      return newData
    }

    addReplaySamples(sortedData)

    // 更新无人机实体的位置属性
    if (droneEntity && droneEntity.entity) {
      droneEntity.entity.position = positionProperty
      droneEntity.positionProperty = positionProperty
    }

    const appendReplayData = (replayData) => {
      if (!Array.isArray(replayData) || replayData.length === 0) {
        return 0
      }

      const addedData = addReplaySamples(replayData)
      console.log(`无人机${options.droneId}追加回放数据数量: ${addedData.length}`)
      return addedData.length
    }

    // 播放函数
    const playReplay = () => {
      if (!replayController.isPlaying) {
        map.clock.shouldAnimate = true
        replayController.isPlaying = true
        hasPlayed = true // 设置已播放标志
        console.log(`无人机${options.droneId}开始回放`)
      }
    }

    // 继续函数
    const continueReplay = () => {
      if (!hasPlayed) {
        console.warn(`无人机${options.droneId}：请先调用play函数开始回放后再继续`)
        return
      }

      if (!replayController.isPlaying) {
        // 只需要恢复时钟动画和设置速度，不重置时钟时间
        map.clock.multiplier = replayController.speed
        map.clock.shouldAnimate = true
        replayController.isPlaying = true
        console.log(`无人机${options.droneId}继续回放`)
      }
    }

    // 暂停函数
    const pauseReplay = () => {
      if (!hasPlayed) {
        console.warn(`无人机${options.droneId}：请先调用play函数开始回放后再暂停`)
        return
      }

      if (replayController.isPlaying) {
        map.clock.shouldAnimate = false
        replayController.isPlaying = false
        console.log(`无人机${options.droneId}回放暂停`)
      }
    }

    // 停止函数
    const stopReplay = () => {
      if (!hasPlayed) {
        console.warn(`无人机${options.droneId}：请先调用play函数开始回放后再停止`)
        return
      }

      map.clock.shouldAnimate = false
      map.clock.currentTime = map.clock.startTime
      replayController.isPlaying = false
      
      // 重置无人机位置到起点
      if (droneEntity && droneEntity.entity) {
        droneEntity.entity.position = cartesianPositions[0].cartesian
      }
      
      console.log(`无人机${options.droneId}回放停止`)
    }

    // 跳转函数
    const seekReplay = (time) => {
      if (!hasPlayed) {
        console.warn(`无人机${options.droneId}：请先调用play函数开始回放后再跳转`)
        return
      }
      
      // time 为相对于起始时间的秒数
      const targetTime = Cesium.JulianDate.addSeconds(
        map.clock.startTime,
        time,
        new Cesium.JulianDate()
      )
      
      map.clock.currentTime = targetTime
      
      // 如果在播放状态，继续播放
      if (replayController.isPlaying) {
        map.clock.shouldAnimate = true
      }
      
      console.log(`无人机${options.droneId}回放跳转到${time}秒`)
    }

    // 销毁函数
    const destroyReplay = () => {
      if (!hasPlayed) {
        console.warn(`无人机${options.droneId}：请先调用play函数开始回放后再销毁`)
        return
      }
      
      // 停止回放状态
      replayController.isPlaying = false
      
      // 将时间恢复为北京时间
      const now = new Date()
      const chinaTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
      //直接设置currentTime确保生效
      map.clock.currentTime = Cesium.JulianDate.fromDate(chinaTime)
      
      // 配置时钟为实时模式：启用动画，设置为无限制范围
      map.clock.shouldAnimate = true
      map.clock.clockRange = Cesium.ClockRange.UNBOUNDED

      // 清除轨迹
      clearDroneTrail(options.droneId)
      
      // 清除无人机模型
      const droneEntity = mapStore.getGraphicMap(options.droneId)
      if (droneEntity && droneEntity.entity) {
        map.entities.remove(droneEntity.entity)
        mapStore.graphicMap.delete(options.droneId)
        console.log(`无人机模型${options.droneId}已清除`)
      }
      
      // 清除时钟事件
      if (replayController.tickHandler) {
        map.clock.onTick.removeEventListener(replayController.tickHandler)
      }
      
      console.log(`无人机${options.droneId}回放已销毁`)

      hasPlayed = false // 重置已播放标志
    }

    // 添加时钟事件监听（可选，用于自定义逻辑）
    replayController.tickHandler = (clock) => {
      if (!options.loop && map.clock.stopTime && Cesium.JulianDate.compare(clock.currentTime, map.clock.stopTime) >= 0) {
        replayController.isPlaying = false
        console.log(`回放结束`)

        map.clock.onTick.removeEventListener(replayController.tickHandler)
      }
    }
    
    map.clock.onTick.addEventListener(replayController.tickHandler)

    // 初始化时钟
    map.clock.shouldAnimate = false

    console.log(`无人机${options.droneId}回放准备就绪，数据点数量: ${sortedData.length}`)
    
    return replayController
  }

  /**
   * 配置回放时钟
   * @param options 
   * @param options.startTime 回放开始时间（秒）
   * @param options.endTime 回放结束时间（秒）
   * @param options.speed 回放速度（1为正常速度）
   * @param options.loop 是否循环回放
   * @returns 
   */
  const configureClock = (options) => {
    const { startTime, endTime, speed, loop } = options

    let map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return
    }
    map.clock.startTime = Cesium.JulianDate.fromDate(new Date(startTime))
    map.clock.stopTime = Cesium.JulianDate.fromDate(new Date(endTime))
    map.clock.currentTime = Cesium.JulianDate.fromDate(new Date(startTime))
    map.clock.multiplier = speed
    map.clock.clockRange = loop ? Cesium.ClockRange.LOOP_STOP : Cesium.ClockRange.CLAMPED
    map.clock.shouldAnimate = true
  }

  return {
    configureClock,
    replayDronePath
  }
}