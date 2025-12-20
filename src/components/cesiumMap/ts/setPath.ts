import * as Cesium from 'cesium'
import { useMapStore } from '@/stores/modules/mapStore'

export function setPath() {
  // 获取地图store实例
  const mapStore = useMapStore()

  /**
   * 创建无人机轨迹
   * @param droneId 无人机ID
   * @param startPosition 初始位置
   * @returns 轨迹数据
   */
  const setDroneTrail = (droneId: string, startPosition: Cesium.Cartesian3) => {
    const map = mapStore.getMap()
    if (!map) return

    const trailId = `${droneId}_trail`

    // 如果轨迹已存在，直接返回
    if (mapStore.hasDroneTrail(trailId)) {
      console.log(`轨迹 ${trailId} 已存在`)
      return mapStore.getDroneTrail(trailId)
    }

    // 轨迹实例
    let trailData: any = {
      entity: null, // 轨迹实体
      positions: [{ position: startPosition.clone(), timestamp: map.clock.currentTime }], // 轨迹位置数组，包含位置和时间戳
      lastUpdateTime: map.clock.currentTime, // 最后更新时间
      isVisible: true, // 是否可见
    }
    trailData.entity = map.entities.add({
      id: trailId,
      name: `无人机轨迹：${droneId}`,
      show: true,
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const trailData = mapStore.getDroneTrail(trailId)
          return trailData ? trailData.positions.map(point => point.position) : []
        }, false),
        width: 2,
        material: Cesium.Color.fromCssColorString('#fbff00ff'),
        arcType: Cesium.ArcType.NONE,// 直线连接 - 点与点之间用直线段连接
        clampToGround: false
      }
    })

    mapStore.setDroneTrail(trailId, trailData)
    console.log(`创建轨迹: ${trailId}, 初始位置数: 1`)
    return trailData;
  }

  /**
   * 清除无人机轨迹
   */
  const clearDroneTrail = (droneId: string) => {
    const trailId = `${droneId}_trail`
    const trailData = mapStore.getDroneTrail(trailId)

    if (trailData) {
      const map = mapStore.getMap()
      if (map && trailData.entity) {
        map.entities.remove(trailData.entity)
      }
      mapStore.clearDroneTrail(trailId)
      console.log(`已清除轨迹: ${trailId}`)
    }
  }

  /**
   * 显示/隐藏无人机轨迹
   */
  const toggleDroneTrail = (droneId: string, show: boolean) => {
    const trailId = `${droneId}_trail`
    const trailData = mapStore.getDroneTrail(trailId)

    if (trailData && trailData.entity) {
      trailData.entity.show = show
      trailData.isVisible = show
    }
  }

  return {
    setDroneTrail,
    clearDroneTrail,
    toggleDroneTrail
  }
}