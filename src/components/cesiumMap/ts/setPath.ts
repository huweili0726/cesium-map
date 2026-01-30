/**
 * 轨迹设置模块
 * 
 * 提供在Cesium地图上设置无人机轨迹的功能
 * 
 * @author huweili
 * @email czxyhuweili@163.com
 * @version 1.0.0
 * @date 2025-12-29
 */
import * as Cesium from 'cesium'
import { useMapStore } from '@/stores/modules/mapStore'

export function setPath() {
  // 获取地图store实例
  const mapStore = useMapStore()

  /**
   * 创建无人机轨迹
   * @param pointId 无人机ID
   * @param startPosition 初始位置
   * @returns 轨迹数据
   */
  const setDroneTrail = (options: {
    pointId: string,
    startPosition: Cesium.Cartesian3
  }) => {
    const map = mapStore.getMap()
    if (!map) return

    const { pointId, startPosition } = options
    const trailId = `${pointId}_trail`

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
      name: `无人机轨迹：${pointId}`,
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
   * @param options 配置选项
   * @param options.pointId 点ID
   * @param options.visible 是否显示
   */
  const toggleDroneTrail = (options: { 
    pointId: string, 
    visible: boolean 
  }) => {
    const { pointId, visible } = options
    const trailId = `${pointId}_trail`
    const trailData = mapStore.getDroneTrail(trailId)

    if (trailData && trailData.entity) {
      trailData.entity.show = visible
      trailData.isVisible = visible
    }
  }

  return {
    setDroneTrail,
    clearDroneTrail,
    toggleDroneTrail
  }
}