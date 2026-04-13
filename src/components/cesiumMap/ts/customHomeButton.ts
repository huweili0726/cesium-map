/**
 * 自定义主页按钮功能
 * 
 * 提供自定义 Cesium 地图主页按钮的功能
 * 
 * @author huweili
 * @email czxyhuweili@163.com
 * @version 1.0.0
 * @date 2026-04-13
 */
import * as Cesium from 'cesium'

/**
 * 自定义主页按钮配置选项
 */
export interface CustomHomeButtonOptions {
  lng: number
  lat: number
  alt: number
  heading: number
  pitch: number
  roll: number
  duration: number
}

/**
 * 自定义主页按钮功能
 */
export function customHomeButton() {
  /**
   * 自定义主页按钮
   * @param map Cesium Viewer 实例
   * @param options 自定义配置选项
   */
  const setCustomHomeButton = (map: Cesium.Viewer, options: CustomHomeButtonOptions) => {
    if (map.homeButton) {
      // 保存原始的主页按钮功能
      const originalHomeButton = map.homeButton
      
      // 方法：直接替换 onclick 属性
      ;(originalHomeButton.container as HTMLElement).onclick = (e) => {
        e.stopPropagation() // 阻止事件冒泡
        e.preventDefault() // 阻止默认行为
        
        // 自定义主页视图：飞回到指定位置
        map.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            options.lng,
            options.lat,
            options.alt
          ),
          orientation: {
            heading: Cesium.Math.toRadians(options.heading),
            pitch: Cesium.Math.toRadians(options.pitch),
            roll: options.roll
          },
          duration: options.duration
        })
      }
      
      // 修改主页按钮的提示文本
      if ((originalHomeButton as any)._element) {
        (originalHomeButton as any)._element.title = '返回默认视图'
      }
    }
  }

  return {
    setCustomHomeButton
  }
}