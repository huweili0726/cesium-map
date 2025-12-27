/**
 * 几何体管理模块
 * 
 * 提供在Cesium地图上创建、更新、移动和删除几何体实体的功能
 * 
 * @module GeometryManager
 * @author huweili
 * @email czxyhuweili@163.com
 * @version 1.0.0
 * @date 2025-12-27
 */
import * as Cesium from 'cesium'
import { useMapStore } from '@/stores/modules/mapStore'

export function geometryConfig() {

  // 获取地图store实例
  const mapStore = useMapStore()

  /**
   * 创建锥形波效果
   * @param options - 锥形波配置选项
   * @param options.id - 效果唯一标识符
   * @param options.positions - 位置数组 [lng, lat, height]
   * @param options.heading - 指向方向（弧度）
   * @param options.pitch - 俯仰角度（弧度）
   * @param options.length - 圆锥高
   * @param options.bottomRadius - 底部半径
   * @param options.thickness - 厚度
   * @param options.color - 颜色（默认 '#00FFFF'）
   */
  const conicalWave = (options: {
    id: string,
    positions: number[],
    heading: number,
    pitch: number,
    length: number,
    bottomRadius: number,
    thickness: number,
    color: string,
  }) => {
    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return null
    }

    // 检查是否已存在相同ID的效果
    if (mapStore.getGraphicMap(options.id)) {
      console.log(`id: ${options.id} 效果已存在`)
      return null
    }

    // 定义雷达材质属性类
    class RadarPrimitiveMaterialProperty implements Cesium.MaterialProperty {
      private _definitionChanged: Cesium.Event;
      private _color: Cesium.Color;
      private opts: {
        color: Cesium.Color;
        duration: number;
        time: number;
        repeat: number;
        offset: number;
        thickness: number;
      };

      constructor(options: {
        color: Cesium.Color;
        thickness: number;
      }) {
        this.opts = {
          color: Cesium.Color.RED,
          duration: 2000,
          time: new Date().getTime(),
          repeat: 30,
          offset: 0,
          thickness: 0.3,
          ...options,
        };
        this._definitionChanged = new Cesium.Event();
        this._color = this.opts.color;
      }

      get definitionChanged(): Cesium.Event {
        return this._definitionChanged;
      }

      get isConstant(): boolean {
        return false;
      }

      getType(): string {
        return "radarPrimitive";
      }

      getValue(time: Cesium.JulianDate, result?: any): any {
        if (!Cesium.defined(result)) {
          result = {};
        }
        
        result.color = this._color;
        
        result.time = ((new Date().getTime() - this.opts.time) % this.opts.duration) / this.opts.duration / 10;
        result.repeat = this.opts.repeat;
        result.offset = this.opts.offset;
        result.thickness = this.opts.thickness;
        
        return result;
      }

      equals(other: Cesium.MaterialProperty): boolean {
        return this === other;
      }
    }

    // 创建雷达材质属性的实现
    const createRadarMaterialProperty = (color: Cesium.Color = Cesium.Color.RED.withAlpha(0.7), thickness: number = 0.3) => {
      return new RadarPrimitiveMaterialProperty({ color, thickness });
    };

    // 注册雷达材质
    const registerRadarMaterial = () => {
      const material = Cesium.Material as any;
      if (!material.radarPrimitiveType) {
        material.radarPrimitiveType = "radarPrimitive";
        material.radarPrimitiveSource = `
          uniform vec4 color;
          uniform float time;
          uniform float repeat;
          uniform float offset;
          uniform float thickness;
          czm_material czm_getMaterial(czm_materialInput materialInput) {
            czm_material material = czm_getDefaultMaterial(materialInput);
            float sp = 1.0/repeat;
            vec2 st = materialInput.st;
            float dis = distance(st, vec2(0.5));
            float m = mod(dis + offset-time, sp);
            float a = step(sp*(1.0-thickness), m);
            material.diffuse = color.rgb;
            material.alpha = a * color.a;
            return material;
          }`;

        material._materialCache.addMaterial(
          material.radarPrimitiveType,
          {
            fabric: {
              type: material.radarPrimitiveType,
              uniforms: {
                color: new Cesium.Color(1.0, 0.0, 0.0, 0.5),
                time: 0,
                repeat: 30,
                offset: 0,
                thickness: 0.3,
              },
              source: material.radarPrimitiveSource,
            },
            translucent: function () {
              return true;
            },
          }
        );
      }
    };

    // 注册材质
    registerRadarMaterial();

    // 提取经纬度和高度
    const [lng, lat, height = 0] = options.positions;
    
    // 关键：直接使用经纬度作为圆锥体顶点的位置
    const vertexPosition = Cesium.Cartesian3.fromDegrees(lng, lat, height);
    
    // 使用用户设置的方向参数
    const heading = Cesium.Math.toRadians(options.heading);
    const pitch = Cesium.Math.toRadians(options.pitch);
    const roll = 0;
    
    // 创建HeadingPitchRoll对象，控制圆锥的朝向
    const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
    
    // 计算圆锥体的中心点位置
    const halfLength = options.length / 2;
    
    // 创建一个沿圆锥体轴线方向的向量
    const direction = Cesium.Cartesian3.UNIT_Z;
    
    // 创建变换矩阵
    const transform = Cesium.Transforms.headingPitchRollToFixedFrame(
      vertexPosition,
      hpr
    );
    
    // 将本地轴线向量转换为世界坐标系
    const worldDirection = Cesium.Matrix4.multiplyByPointAsVector(
      transform,
      direction,
      new Cesium.Cartesian3()
    );
    
    // 归一化方向向量
    Cesium.Cartesian3.normalize(worldDirection, worldDirection);
    
    // 计算圆锥体的中心点
    const cylinderCenter = Cesium.Cartesian3.clone(vertexPosition);
    const offset = Cesium.Cartesian3.multiplyByScalar(worldDirection, halfLength, new Cesium.Cartesian3());
    Cesium.Cartesian3.subtract(cylinderCenter, offset, cylinderCenter);
    
    // 计算圆锥体的方向四元数
    const orientation = Cesium.Transforms.headingPitchRollQuaternion(
      vertexPosition,  // 原点
      hpr              // 方向
    );

    // 创建颜色对象
    const color = Cesium.Color.fromCssColorString(options.color || '#00FFFF');

    // 创建圆锥体实体
    const entity = map.entities.add({
      name: "Radar Cone",
      position: cylinderCenter,  // 圆锥体的中心点
      orientation: orientation,
      cylinder: {
        length: options.length,
        topRadius: 0,  // 顶部半径为0，形成圆锥顶点
        bottomRadius: options.bottomRadius,
        material: createRadarMaterialProperty(color.withAlpha(0.7), options.thickness),
      },
    });

    // 将实体添加到mapStore中进行管理
    mapStore.setGraphicMap(options.id, entity);

    return entity;
  }

  return {
    conicalWave,
  }
}
