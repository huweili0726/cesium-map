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
import { TrackBuffer, CesiumRendererAdapter, ReplayEngine } from '@/components/cesiumMap/js/replayEngine'

export function setReplay(baseUrl) {
  // 获取地图store实例
  const mapStore = useMapStore()

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
    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return null
    }

    if (!options.replayData || options.replayData.length < 2) {
      console.error('回放数据不足，至少需要2个点')
      return null
    }

    const sortedData = [...options.replayData].sort((a, b) => a.timestamp - b.timestamp)
    const trackBuffer = new TrackBuffer(sortedData)
    const renderer = new CesiumRendererAdapter({
      droneId: options.droneId,
      baseUrl,
      trackBuffer
    })
    const replayController = new ReplayEngine({
      trackBuffer,
      renderer,
      startTime: options.startTime || sortedData[0].timestamp,
      endTime: options.endTime || sortedData[sortedData.length - 1].timestamp,
      speed: options.speed || 1,
      loop: options.loop || false
    })

    if (!replayController.init()) {
      return null
    }

    mapStore.setActiveReplayEngine(replayController)

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
    // 兼容旧示例按钮：只同步 Cesium 展示时钟，不再作为业务回放主时钟
    map.clock.startTime = Cesium.JulianDate.fromDate(new Date(startTime))
    map.clock.stopTime = Cesium.JulianDate.fromDate(new Date(endTime))
    map.clock.currentTime = Cesium.JulianDate.fromDate(new Date(startTime))
    map.clock.multiplier = speed
    map.clock.clockRange = loop ? Cesium.ClockRange.LOOP_STOP : Cesium.ClockRange.CLAMPED
    map.clock.shouldAnimate = false
  }

  return {
    configureClock,
    replayDronePath
  }
}