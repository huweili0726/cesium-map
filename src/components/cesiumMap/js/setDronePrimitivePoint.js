/**
 * 无人机 Primitive 点位设置模块
 *
 * 使用 BillboardCollection 以 Primitive 方式在 Cesium 地图上展示无人机图片点位。
 */
import * as Cesium from 'cesium'
import { useMapStore } from '@/stores/modules/mapStore'

export function setDronePrimitivePoint(baseUrl) {
  const mapStore = useMapStore()

  /**
   * 设置无人机图片点位【Primitive】
   * @param options 配置选项
   * @param options.id 点位唯一标识
   * @param options.lng 经度
   * @param options.lat 纬度
   * @param options.height 高度（可选，默认0）
   * @param options.width 图片宽度（可选，默认30）
   * @param options.heightSize 图片高度（可选，默认30）
   * @param options.imageUrl 图片地址（可选，默认使用 /images/drone.png）
   * @returns 创建的无人机点位对象
   */
  const setDronePrimitivePointByImg = (options) => {
    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return null
    }

    if (mapStore.hasGraphicMap(options.id)) {
      console.warn(`点位已存在，ID: ${options.id}`)
      return mapStore.getGraphicMap(options.id)
    }

    const position = Cesium.Cartesian3.fromDegrees(
      options.lng,
      options.lat,
      options.height || 0
    )

    const billboardCollection = new Cesium.BillboardCollection({
      scene: map.scene,
      blendOption: Cesium.BlendOption.OPAQUE_AND_TRANSLUCENT,
    })

    const billboard = billboardCollection.add({
      id: options.id,
      position,
      image: options.imageUrl || `${baseUrl}/images/drone.png`,
      width: options.width || 30,
      height: options.heightSize || 30,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      show: true,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    })

    map.scene.primitives.add(billboardCollection)

    const dronePrimitive = {
      id: options.id,
      name: `无人机${options.id}`,
      targetLng: options.lng,
      targetLat: options.lat,
      targetHeight: options.height || 0,
      position,
      billboardCollection,
      billboard,
      info: {
        lng: options.lng,
        lat: options.lat,
        height: options.height || 0,
        heading: options.heading || 0,
      },
      destroy: () => {
        if (!billboardCollection.isDestroyed()) {
          map.scene.primitives.remove(billboardCollection)
          billboardCollection.destroy()
        }
      },
    }

    mapStore.setGraphicMap(options.id, dronePrimitive)
    return dronePrimitive
  }

  return {
    setDronePrimitivePointByImg,
  }
}
