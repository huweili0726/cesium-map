/**
 * 半球体实体管理模块
 * 
 * 提供在Cesium地图上创建、更新、移动和删除半球体实体的功能
 * 支持自定义半球体的位置、半径、颜色等属性
 * 
 * @module HemisphereManager
 * @author huweili
 * @email czxyhuweili@163.com
 * @version 1.0.0
 * @date 2025-12-15
 */
import * as Cesium from 'cesium'
import { useMapStore } from '@/stores/modules/mapStore'

/**
 * 半球体实体管理配置函数
 * 初始化半球体管理模块，返回半球体操作相关方法
 * 
 * @returns {Object} 半球体操作方法集合
 */
export function hemisphereConfig() {

  // 获取地图store实例
  const mapStore = useMapStore()

  /**
   * 【创建并设置半球体实体】
   * 在指定位置创建一个半球体实体，支持自定义半径和颜色
   * 半球体默认紧贴地面（高度为0），并设置为半透明效果
   * 
   * @param {Object} options 半球体配置参数
   * @param {string} options.id 半球体唯一标识
   * @param {number[]} options.center 半球体中心经纬度坐标 [longitude, latitude]
   * @param {number} options.radius 半球体半径（米）
   * @param {string} options.color 半球体颜色（CSS颜色字符串）
   * @returns {Cesium.Entity|null} 创建的半球体实体，若创建失败则返回null
   */
  const setHemisphere = (options: { id: string, center: any[]; radius: number, color: string }) => {
    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return null
    }

    if (mapStore.getGraphicMap(`${options.id}`)) {
      console.log(`id: ${options.id} 半球体实体已存在`) 
      return null
    }

    // 经纬度转Cesium笛卡尔坐标（球心定位）
    // 确保球心的高度为0，紧贴地面
    const centerCartesian = Cesium.Cartesian3.fromDegrees(options.center[0], options.center[1], 0);

    // 使用Entity方式创建半球体（更稳定可靠）
    const hemisphereEntity = map.entities.add({
      position: centerCartesian,
      ellipsoid: {
        radii: new Cesium.Cartesian3(options.radius, options.radius, options.radius),
        material: Cesium.Color.fromCssColorString(options.color).withAlpha(0.4), // 设置半透明效果，0.5为透明度值（范围0-1）
        // 使用maximumCone和minimumCone创建半球
        maximumCone: 0, // 上半球（z轴正方向）
        minimumCone: Math.PI / 2 // 从z轴正方向到水平面（90度）
      }
    });

    // 将半球体缓存到 graphicMap 中，防止重复创建
    mapStore.setGraphicMap(`${options.id}`, hemisphereEntity);

    // 返回创建的半球体实体，方便调用者使用
    return hemisphereEntity;
  }

  /**
   * 【移动半球体实体位置】
   * 更新指定ID的半球体实体到新的经纬度位置
   * 
   * @param {Object} options 移动配置参数
   * @param {string} options.hemisphereId 半球体唯一标识
   * @param {number[]} options.center 新的中心经纬度坐标 [longitude, latitude]
   * @returns {null} 无返回值
   */
  const moveHemisphere = (options: { hemisphereId: string, center: any[] }) => {
    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return null
    }

    const hemisphereEntity = mapStore.getGraphicMap(`${options.hemisphereId}`)
    if (!hemisphereEntity) {
      console.error(`id: ${options.hemisphereId} 半球体实体不存在`)
      return null
    }

    // 更新半球体位置
    hemisphereEntity.position = Cesium.Cartesian3.fromDegrees(options.center[0], options.center[1], 0);
  }

  /**
   * 【更新半球体实体半径】
   * 修改指定ID的半球体实体的半径大小
   * 
   * @param {Object} options 更新配置参数
   * @param {string} options.hemisphereId 半球体唯一标识
   * @param {number} options.radius 新的半球体半径（米）
   * @returns {null} 无返回值
   */
  const updateHemisphere = (options: { hemisphereId: string, radius: number }) => {
    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return null
    }

    const hemisphereEntity = mapStore.getGraphicMap(`${options.hemisphereId}`)
    if (!hemisphereEntity) {
      console.error(`id: ${options.hemisphereId} 半球体实体不存在`)
      return null
    }

    // 更新半球体半径
    hemisphereEntity.ellipsoid.radii = new Cesium.Cartesian3(options.radius, options.radius, options.radius);
  }

  /**
   * 【删除半球体实体】
   * 移除指定ID的半球体实体，并从缓存中清除记录
   * 
   * @param {Object} options 删除配置参数
   * @param {string} options.hemisphereId 半球体唯一标识
   * @returns {null} 无返回值
   */
  const removeHemisphere = (options: { hemisphereId: string }) => {
    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return null
    }
    
    const hemisphereEntity = mapStore.getGraphicMap(`${options.hemisphereId}`)
    if (!hemisphereEntity) {
      console.error(`id: ${options.hemisphereId} 半球体实体不存在`)
      return null
    }

    // 删除半球体实体
    map.entities.remove(hemisphereEntity);
    // 从缓存中移除
    mapStore.removeGraphicMap(`${options.hemisphereId}`);
  }

  return {
    setHemisphere,
    updateHemisphere,
    removeHemisphere,
    moveHemisphere
  }
}