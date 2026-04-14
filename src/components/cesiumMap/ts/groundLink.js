/**
 * 地面连接线模块
 * 
 * 提供无人机与地面固定点之间的动态连接线功能
 * 
 * @author huweili
 * @email czxyhuweili@163.com
 * @version 1.0.0
 * @date 2026-04-14
 */
import * as Cesium from 'cesium'
import { useMapStore } from '@/stores/modules/mapStore'

/**
 * 地面连接线功能
 */
export function groundLinkConfig() {
  // 获取地图store实例
  const mapStore = useMapStore()

  /**
   * 为无人机创建与地面固定点的动态虚线连接
   * @param options 配置选项
   */
  const createGroundLink = (options) => {
    const { map, modelEntity, pointId } = options
    
    // 检查是否已存在连接线
    if (mapStore.hasGroundLink(pointId)) {
      console.log(`无人机${pointId}的地面连接线已存在，跳过创建`)
      return
    }
    
    // 地面固定点经纬度
    const GROUND_LINK_LNG = 117.229619
    const GROUND_LINK_LAT = 31.726288
    
    // 新建与地面固定点的动态白色虚线（实时连接无人机）
    const groundPosition = Cesium.Cartesian3.fromDegrees(GROUND_LINK_LNG, GROUND_LINK_LAT, 0)
    const groundLinkEntity = map.entities.add({
      id: `${pointId}-ground-link`,
      polyline: {
        // 使用 CallbackProperty 实现动态更新连接线位置
        // 每次 Cesium 渲染场景时都会调用此回调函数
        positions: new Cesium.CallbackProperty(() => {
          // 检查无人机实体和位置属性是否存在
          if (!modelEntity?.entity?.position) {
            // 如果不存在，返回固定点到自身的线段（避免错误）
            return [groundPosition, groundPosition]
          }
          
          // 获取无人机当前实时位置
          // map.clock.currentTime 确保获取的是当前时间点的位置
          const dronePosition = modelEntity.entity.position.getValue(map.clock.currentTime)
          
          // 检查获取的位置是否有效
          if (!dronePosition) {
            // 如果无效，返回固定点到自身的线段（避免错误）
            return [groundPosition, groundPosition]
          }
          
          // 返回无人机当前位置到地面固定点的线段
          // 这样连接线会随着无人机移动而实时更新
          return [dronePosition, groundPosition]
        }, false), // isConstant: false，告诉 Cesium 这个属性是动态变化的
        width: 2, // 线段宽度
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.WHITE, // 线段颜色
          dashLength: 12, // 虚线长度
          gapColor: Cesium.Color.WHITE.withAlpha(0.15), // 间隙颜色（半透明）
        }),
        clampToGround: false, // 不贴地，保持3D效果
        disableDepthTestDistance: Number.POSITIVE_INFINITY, // 始终显示在最前面，不受深度测试影响
      }
    })
    
    // 存储到 modelEntity 和 mapStore
    modelEntity.groundLinkEntity = groundLinkEntity
    mapStore.setGroundLink(pointId, groundLinkEntity)
  }

  /**
   * 清除无人机与地面固定点的连接线
   * @param options 配置选项
   */
  const clearGroundLink = (options) => {
    const { map, pointId } = options
    
    // 从 mapStore 获取连接线实体
    const groundLinkEntity = mapStore.getGroundLink(pointId)
    if (groundLinkEntity) {
      // 从地图中移除连接线
      map.entities.remove(groundLinkEntity)
      // 从 mapStore 中清除
      mapStore.clearGroundLink(pointId)
      console.log(`无人机${pointId}的地面连接线已清除`)
    }
  }

  /**
   * 控制无人机与地面固定点连线的显隐状态
   * @param options 配置选项
   */
  const toggleGroundLinkVisibility = (options) => {
    const { pointId, visible } = options
    
    // 从 mapStore 获取连接线实体
    const groundLinkEntity = mapStore.getGroundLink(pointId)
    if (groundLinkEntity) {
      groundLinkEntity.show = visible
      console.log(`无人机${pointId}的地面连接线已${visible ? '显示' : '隐藏'}`)
    }
  }

  return {
    createGroundLink,
    clearGroundLink,
    toggleGroundLinkVisibility
  }
}
