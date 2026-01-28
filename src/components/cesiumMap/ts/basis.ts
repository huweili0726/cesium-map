/**
 * 地图基本操作模块
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
   * 处理地图上的鼠标事件，包括点击、拖动、缩放等
   */
  const mouseController = (map: any) => {
    // 添加右键点击事件监听
    map.screenSpaceEventHandler.setInputAction((click: any) => {
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

  return {
    mouseController
  }
}