import * as Cesium from 'cesium'

/**
 * 蓝色风格配置选项
 */
export interface BlueStyleOptions {
  enabled: boolean
  darkBase: { r: number; g: number; b: number }
  lightBlue: { r: number; g: number; b: number }
}

/**
 * 蓝色风格的瓦片提供者
 * 将原始地图瓦片转换为深蓝色风格，使道路和文字呈现亮蓝色
 */
export class BlueTileProvider extends Cesium.UrlTemplateImageryProvider {
  private blueStyle: BlueStyleOptions

  constructor(
    options: Cesium.UrlTemplateImageryProvider.ConstructorOptions,
    blueStyle?: BlueStyleOptions
  ) {
    super(options)
    this.blueStyle = blueStyle || {
      enabled: true,
      darkBase: { r: 9, g: 20, b: 46 },
      lightBlue: { r: 125, g: 165, b: 255 }
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
    const darkBase = this.blueStyle.darkBase
    const lightBlue = this.blueStyle.lightBlue

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
      data[i] = darkBase.r + (lightBlue.r - darkBase.r) * intensity
      data[i + 1] = darkBase.g + (lightBlue.g - darkBase.g) * intensity
      data[i + 2] = darkBase.b + (lightBlue.b - darkBase.b) * intensity
    }

    ctx.putImageData(imageData, 0, 0)
    return createImageBitmap(canvas)
  }
}
