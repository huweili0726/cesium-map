import * as Cesium from 'cesium'
import { useMapStore } from '@/stores/modules/mapStore'
import { setPath } from '@/components/cesiumMap/ts/setPath'
import { setPoint } from '@/components/cesiumMap/ts/setPoint'

export function setReplay(baseUrl: string) {
  // 获取地图store实例
  const mapStore = useMapStore()
  const {
    setDroneTrail,
    clearDroneTrail
  } = setPath()
  const {
    setDronePointByGlb
  } = setPoint(baseUrl)

  /**
   * 无人机轨迹回放配置接口
   */
  interface ReplayPoint {
    lng: number;      // 经度
    lat: number;      // 纬度
    height?: number;  // 高度（可选）
    timestamp: number; // 时间戳（秒级）
  }

  /**
   * 无人机轨迹回放函数
   * @param options 回放配置
   * @param options.droneId 无人机ID
   * @param options.replayData 回放数据数组
   * @param options.speed 回放速度（可选，默认1.0）
   * @param options.loop 是否循环回放（可选，默认false）
   * @returns 回放控制器对象
   */
  const replayDronePath = (options: {
    droneId: string;
    replayData: ReplayPoint[];
    speed?: number;
    loop?: boolean;
    startTime?: number;
    endTime?: number;
  }) => {
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
    const sortedData = [...options.replayData].sort((a, b) => a.timestamp - b.timestamp)

    // 创建回放控制器
    // 添加一个标志记录是否已调用过play函数
    let hasPlayed = false
    
    let replayController: any = {
      isPlaying: false, // 是否正在播放
      speed: options.speed || 1.0, // 回放速度（1.0表示正常速度）
      loop: options.loop || false, // 是否循环回放
      pause: () => pauseReplay(), // 暂停回放（仅播放中可用）
      play: () => playReplay(), // 播放回放（从头开始）
      continue: () => continueReplay(), // 继续回放（从当前位置恢复，仅暂停后可用）
      stop: () => stopReplay(), // 停止回放（随时可用）
      seek: (time: number) => seekReplay(time), // 跳转回放时间（随时可用）
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
        heading: 0
      })
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
      trailData = setDroneTrail(options.droneId, firstCartesian)
    }

    // 清空现有轨迹点
    trailData.positions = []
    
    // 转换回放数据为Cesium坐标并添加到轨迹
    const cartesianPositions = sortedData.map(point => {
      const cartesian = Cesium.Cartesian3.fromDegrees(
        point.lng,
        point.lat,
        point.height || 0
      )
      const timestamp = Cesium.JulianDate.fromDate(new Date(point.timestamp * 1000))
      
      // 添加到轨迹
      trailData.positions.push({ position: cartesian.clone(), timestamp })
      
      return { cartesian, timestamp }
    })

    // 更新轨迹最后更新时间
    trailData.lastUpdateTime = cartesianPositions[cartesianPositions.length - 1].timestamp

    // 创建位置属性用于插值
    const positionProperty = new Cesium.SampledPositionProperty()
    positionProperty.setInterpolationOptions({
      interpolationAlgorithm: Cesium.HermitePolynomialApproximation, // 使用埃尔米特多项式插值
      interpolationDegree: 2 // 插值次数，2表示二阶埃尔米特插值
    })

    // 添加采样点到位置属性
    cartesianPositions.forEach(pos => {
      positionProperty.addSample(pos.timestamp, pos.cartesian)
    })

    // 更新无人机实体的位置属性
    if (droneEntity && droneEntity.entity) {
      droneEntity.entity.position = positionProperty
      droneEntity.positionProperty = positionProperty
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
    const seekReplay = (time: number) => {
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
    replayController.tickHandler = (clock: Cesium.Clock) => {
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

  // 回放时钟配置
  const configureClock = (startTime: number, endTime: number, speed: number, loop: boolean) => {
    let map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return
    }
    map.clock.startTime = Cesium.JulianDate.fromDate(new Date(startTime * 1000))
    map.clock.stopTime = Cesium.JulianDate.fromDate(new Date(endTime * 1000))
    map.clock.currentTime = Cesium.JulianDate.fromDate(new Date(startTime * 1000))
    map.clock.multiplier = speed
    map.clock.clockRange = loop ? Cesium.ClockRange.LOOP_STOP : Cesium.ClockRange.CLAMPED
    map.clock.shouldAnimate = true
  }

  return {
    configureClock,
    replayDronePath
  }
}