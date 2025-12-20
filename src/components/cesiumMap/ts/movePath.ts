import * as Cesium from 'cesium'
import { useMapStore } from '@/stores/modules/mapStore'
import { setPath } from '@/components/cesiumMap/ts/setPath'

export function movePath() {
  // 获取地图store实例
  const mapStore = useMapStore()
  const {
    setDroneTrail,
  } = setPath()

  /**
   * 移动无人机轨迹
   * @param droneId 无人机ID
   * @param newPosition 新位置
   * @returns 轨迹数据
   */
  const moveDroneTrail = (droneId: string, newPosition: Cesium.Cartesian3) => {
    // 获取地图实例
    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return null
    }

    const trailId = `${droneId}_trail`
    const trailData = mapStore.getDroneTrail(trailId)

    if (!trailData) {
      console.warn(`轨迹 ${trailId} 不存在，创建新的轨迹`)
      return setDroneTrail(droneId, newPosition)
    }

    const currentTime = map.clock.currentTime

    // 检查是否需要添加新点（避免重复添加相同位置的点）
    const lastPoint = trailData.positions[trailData.positions.length - 1]

    if (lastPoint) {
      const distance = Cesium.Cartesian3.distance(lastPoint.position, newPosition)

      // 只有当距离超过一定阈值时才添加新点（优化性能）
      const MIN_DISTANCE = 1.0 // 1米阈值
      if (distance > MIN_DISTANCE) { 
        // 添加新的轨迹点，包含位置和时间戳
        trailData.positions.push({ position: newPosition.clone(), timestamp: currentTime })
        trailData.lastUpdateTime = currentTime

        // 清理旧轨迹点，只保留最近指定时间的轨迹
        let TEN_SECONDS = mapStore.getTrailTime()
        
        // 只有当TEN_SECONDS不等于-1时，才清理旧轨迹点
        if (TEN_SECONDS !== -1) {
          const cutoffTime = Cesium.JulianDate.addSeconds(currentTime, -TEN_SECONDS, new Cesium.JulianDate()) // TEN_SECONDS秒前的时间
          trailData.positions = trailData.positions.filter((point: { position: Cesium.Cartesian3; timestamp: Cesium.JulianDate }) =>
            Cesium.JulianDate.compare(point.timestamp, cutoffTime) >= 0 
          )
        } else {
          // 当TEN_SECONDS === -1时，不清理旧轨迹点，无限时长保留轨迹
        }
      }
    } else {
      // 如果轨迹为空，添加第一个点，包含位置和时间戳
      trailData.positions.push({ position: newPosition.clone(), timestamp: currentTime })
      trailData.lastUpdateTime = currentTime
    }

    return trailData;
  }

  return {
    moveDroneTrail
  }
}