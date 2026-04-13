import * as Cesium from 'cesium'

/**
 * 蓝色风格配置选项
 */
export interface custumMapColorStyleOptions {
  enabled: boolean
  MapBaseColor: { r: number; g: number; b: number }
  RoadLightColor: { r: number; g: number; b: number }
}

/**
 * 自定义地图颜色瓦片提供者
 * 将原始地图瓦片转换为自定义地图颜色风格
 */
export class customColorTileProvider extends Cesium.UrlTemplateImageryProvider {
  private custumMapColorStyle: custumMapColorStyleOptions

  constructor(
    options: Cesium.UrlTemplateImageryProvider.ConstructorOptions,
    custumMapColorStyle?: custumMapColorStyleOptions
  ) {
    super(options)
    this.custumMapColorStyle = custumMapColorStyle || {
      enabled: true,
      MapBaseColor: { r: 9, g: 20, b: 46 },
      RoadLightColor: { r: 125, g: 165, b: 255 }
    }
  }

  async requestImage(x: number, y: number, level: number): Promise<ImageBitmap> {
    const img = await super.requestImage(x, y, level) as CanvasImageSource

    const canvas = document.createElement('canvas')
    canvas.width = (img as any).width
    canvas.height = (img as any).height

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('无法获取 Canvas 2D 上下文')
    }

    ctx.drawImage(img, 0, 0)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    // 目标风格：深蓝暗色底图 + 亮蓝道路/文字（接近你第二张图）
    // 说明：将原始亮度做反相，再映射到蓝色梯度
    // 原图中"亮背景"会变成深蓝；"暗线条/文字"会变成亮蓝
    const MapBaseColor = this.custumMapColorStyle.MapBaseColor
    const RoadLightColor = this.custumMapColorStyle.RoadLightColor

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      // 感知亮度
      const luma = 0.299 * r + 0.587 * g + 0.114 * b

      // 反相强度：亮背景->低强度（更暗），暗元素->高强度（更亮）
      const inv = 1 - luma / 255
      const intensity = Math.pow(Math.max(0, Math.min(1, inv)), 1.15)

      // 映射到蓝色范围
      data[i] = MapBaseColor.r + (RoadLightColor.r - MapBaseColor.r) * intensity
      data[i + 1] = MapBaseColor.g + (RoadLightColor.g - MapBaseColor.g) * intensity
      data[i + 2] = MapBaseColor.b + (RoadLightColor.b - MapBaseColor.b) * intensity
    }

    ctx.putImageData(imageData, 0, 0)
    return createImageBitmap(canvas)
  }
}
