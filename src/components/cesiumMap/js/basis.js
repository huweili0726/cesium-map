/**
 * 地图基本操作模块
 * 
 * 提供在Cesium地图上基本操作的功能，如设置地图中心点、添加鼠标事件控制器等
 * 支持在地图上添加鼠标事件控制器，如点击、拖动、缩放等
 * 
 * @author huweili
 * @email czxyhuweili@163.com
 * @version 1.0.0
 * @date 2026-01-28
 */
import * as Cesium from 'cesium'
import { useMapStore } from '@/stores/modules/mapStore'

export function basicConfig() {

  // 获取地图store实例
  const mapStore = useMapStore()

  /**
   * 鼠标事件控制器
   * 
   * 处理地图上的鼠标事件，包括点击、拖动、缩放等、
   * @param map - 地图实例
   */
  const mouseController = (map) => {
    // 添加右键点击事件监听
    map.screenSpaceEventHandler.setInputAction((click) => {
      // 获取点击位置的笛卡尔坐标
      const cartesian = map.camera.pickEllipsoid(click.position, map.scene.globe.ellipsoid);

      if (cartesian) {
        // 转换为经纬度
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const lng = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);
        const height = cartographic.height;

        console.log('点击位置:', {
          lng: Number(lng),
          lat: Number(lat),
          height: Number(height)
        });
      }
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    // 添加左键点击事件，用于隐藏弹窗
    map.screenSpaceEventHandler.setInputAction(() => {
      console.log('左键点击事件触发')
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  /**
   * 设置地图中心点
   * 
   * @param options - 包含地图中心点经纬度和高度的对象
   * @param options.lng - 地图中心点经度
   * @param options.lat - 地图中心点纬度
   * @param options.alt - 可选，地图中心点高度，默认0
   * @param options.map - 地图实例，可选，默认从store中获取
   */
  const setMapCenter = (options) => {
    const { lng, lat, alt: altitude, map: mapInstance } = options
    const map = mapInstance || mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return null
    }

    // 转换为笛卡尔坐标
    const cartesian = Cesium.Cartesian3.fromDegrees(lng, lat - 0.05, altitude || mapStore.getMapInfo('center')?.alt);
    // 设置相机位置
    map.camera.setView({
      destination: cartesian,
      orientation: {
        heading: Cesium.Math.toRadians(mapStore.getMapInfo('center')?.heading || 0),
        pitch: Cesium.Math.toRadians(mapStore.getMapInfo('center')?.pitch || 0),
        roll: Cesium.Math.toRadians(mapStore.getMapInfo('center')?.roll || 0)
      },
      duration: mapStore.getMapInfo('center')?.duration || 0
    });
  }

  return {
    mouseController,
    setMapCenter
  }
}