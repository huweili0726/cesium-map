/**
 * 几何体管理模块
 * 
 * 提供在Cesium地图上创建、更新、移动和删除几何体实体的功能
 * 
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
   * @param {Object} options - 锥形波配置选项
   * @param {string} options.id - 效果唯一标识符
   * @param {number[]} options.positions - 位置数组 [lng, lat, height]
   * @param {number} options.heading - 指向方向（弧度）
   * @param {number} options.pitch - 俯仰角度（弧度）
   * @param {number} options.length - 圆锥高
   * @param {number} options.bottomRadius - 底部半径
   * @param {number} options.thickness - 厚度
   * @param {string} options.color - 颜色（默认 '#00FFFF'）
   * @returns {Cesium.Entity|null} 创建的锥形波实体，若创建失败则返回null
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

    // 提取经纬度和高度
    const [lng, lat, height = 0] = options.positions;
    
    // 关键：直接使用经纬度作为圆锥体顶点的位置
    const vertexPosition = Cesium.Cartesian3.fromDegrees(lng, lat, height);
    
    // 使用用户设置的方向参数，将度数转换为弧度
    const heading = Cesium.Math.toRadians(options.heading);
    const pitch = Cesium.Math.toRadians(options.pitch);
    const roll = 0;
    
    // 创建HeadingPitchRoll对象，控制圆锥的朝向
    const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);

    // 将本地轴线向量转换为世界坐标系
    const worldDirection = Cesium.Matrix4.multiplyByPointAsVector(
      // 创建变换矩阵
      Cesium.Transforms.headingPitchRollToFixedFrame(
        vertexPosition,
        hpr
      ),
      Cesium.Cartesian3.UNIT_Z, // 创建一个沿圆锥体轴线方向的向量
      new Cesium.Cartesian3() 
    );
    
    // 归一化方向向量
    Cesium.Cartesian3.normalize(worldDirection, worldDirection);
    
    // 计算圆锥体的中心点
    // 从顶点位置沿着圆锥体轴线反方向移动halfLength
    const halfLength = options.length / 2;
    const cylinderCenter = Cesium.Cartesian3.clone(vertexPosition);
    const offset = Cesium.Cartesian3.multiplyByScalar(worldDirection, halfLength, new Cesium.Cartesian3());
    Cesium.Cartesian3.subtract(cylinderCenter, offset, cylinderCenter);

    // 创建圆锥体Primitive
    // 1. 使用headingPitchRollToFixedFrame创建正确的模型矩阵
    // 这个方法会创建一个以vertexPosition为原点，应用hpr旋转的变换矩阵
    const modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(vertexPosition, hpr);
    
    // 2. 创建一个平移矩阵，将圆锥体沿着Z轴负方向移动一半长度
    // 因为CylinderGeometry默认中心在原点，所以需要将圆锥体平移，使其顶点位于变换原点
    const translationMatrix = Cesium.Matrix4.fromTranslation(new Cesium.Cartesian3(0, 0, -options.length / 2));
    
    // 3. 将平移矩阵与模型矩阵相乘
    Cesium.Matrix4.multiply(modelMatrix, translationMatrix, modelMatrix);
    
    const primitive = new Cesium.Primitive({
      geometryInstances: new Cesium.GeometryInstance({
        geometry: new Cesium.CylinderGeometry({
          length: options.length,
          topRadius: 0,  // 顶部半径为0，形成圆锥顶点
          bottomRadius: options.bottomRadius
        })
        // 不再单独给modelMatrix，用Primitive级统一矩阵
      }),
      appearance: new Cesium.MaterialAppearance({
        material: new Cesium.Material({
          fabric: {
            uniforms: {
              color: Cesium.Color.fromCssColorString(options.color || '#00FFFF').withAlpha(0.7),
              duration: 6000,
              repeat: 30,
              offset: 0,
              thickness: options.thickness || 0.3
            },
            source: `
              uniform vec4 color;
              uniform float duration;
              uniform float repeat;
              uniform float offset;
              uniform float thickness;
              
              czm_material czm_getMaterial(czm_materialInput materialInput) {
                czm_material material = czm_getDefaultMaterial(materialInput);
                float sp = 1.0/repeat;
                vec2 st = materialInput.st;
                float dis = distance(st, vec2(0.5));
                
                // 使用czm_frameNumber作为时间变量，不需要手动更新
                // 调整动画速度计算方式，使其在不同duration值下都能正常播放
                float time = mod((czm_frameNumber / 60.0) / (duration / 1000.0), 1.0);
                
                float m = mod(dis + offset - time, sp);
                float a = step(sp*(1.0-thickness), m);
                material.diffuse = color.rgb;
                material.alpha = a * color.a;
                return material;
              }
            `
          },
          translucent: true
        }),
        translucent: true
      }),
      modelMatrix,  // 关键：挂在primitive上
      asynchronous: false
    });

    // 只需要挂原始参数，用于后面计算
    (primitive as any)._originalOptions = { ...options };

    // 将primitive添加到mapStore中进行管理
    mapStore.setGraphicMap(options.id, primitive);

    // 添加primitive到场景
    map.scene.primitives.add(primitive);

    return primitive;
  }

  /**
   * 更新圆锥体高度 / 位置
   * @param options
   *        id        圆锥体唯一标识
   *        length    新的高度（米）（可选）
   *        positions 新的 [lng, lat, height]（可选）
   * @returns boolean  成功 true / 失败 false
   */
  const updateConeLengthOrPosition = (options: {
    id: string;
    length?: number;
    positions?: [number, number, number];
  }): boolean => {
    const { id, length, positions } = options;
    const map = mapStore.getMap();
    if (!map) {
      console.error('地图实例不存在');
      return false;
    }

    if(length === undefined && positions === undefined) {
      console.error('更新圆锥体高度 / 位置：必须提供高度或位置');
      return false;
    }

    const oldPrimitive = mapStore.getGraphicMap(id);
    if (!oldPrimitive) {
      console.error(`id: ${id} 圆锥体不存在`);
      return false;
    }

    try {
      /* 1. 备份旧参数，并应用新值 */
      const opts = { ...(oldPrimitive as any)._originalOptions };
      
      // 只在提供新值时才更新
      if (length !== undefined) {
        opts.length = length;
      }
      if (positions !== undefined) {
        opts.positions = positions;
      }

      /* 2. 计算顶点世界坐标 */
      const [lng, lat, height = 0] = opts.positions;
      const vertexPos = Cesium.Cartesian3.fromDegrees(lng, lat, height);

      /* 3. 计算模型矩阵（与创建时完全一致） */
      const hpr = new Cesium.HeadingPitchRoll(
        Cesium.Math.toRadians(opts.heading),
        Cesium.Math.toRadians(opts.pitch),
        0
      );
      const modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(vertexPos, hpr);
      const trans = Cesium.Matrix4.fromTranslation(
        new Cesium.Cartesian3(0, 0, -opts.length / 2)
      );
      Cesium.Matrix4.multiply(modelMatrix, trans, modelMatrix);

      /* 4. 新建 primitive（geometry 仅 length/bottomRadius 可能变化） */
      const newPrimitive = new Cesium.Primitive({
        geometryInstances: new Cesium.GeometryInstance({
          geometry: new Cesium.CylinderGeometry({
            length: opts.length,
            topRadius: 0,
            bottomRadius: opts.bottomRadius
          })
        }),
        appearance: oldPrimitive.appearance, // 材质复用
        modelMatrix,
        asynchronous: false
      });

      /* 5. 缓存参数并替换场景对象 */
      (newPrimitive as any)._originalOptions = opts;
      map.scene.primitives.remove(oldPrimitive); // 场景会负责 destroy
      map.scene.primitives.add(newPrimitive);
      mapStore.setGraphicMap(id, newPrimitive);

      console.log(
        `id: ${id} 圆锥体已更新 -> 高度:${opts.length}m, 位置:[${lng}, ${lat}, ${height}]`
      );
      return true;
    } catch (e) {
      console.error(`更新圆锥体失败:`, e);
      return false;
    }
  };

  /**
   * 更新圆锥体姿态
   * @param {Object} options 更新配置参数
   * @param {string} options.id - 圆锥体ID
   * @param {number} options.heading - 新的指向方向（度）
   * @param {number} options.pitch - 新的俯仰角度（度）
   * @returns {boolean} 更新成功返回true，否则返回false
   */
  const updateConePose = (options: { 
    id: string, 
    heading?: number,
    pitch?: number,
  }) => {
    const { id, heading, pitch } = options;

    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return false
    }

    // 获取已创建的圆锥体
    const primitive = mapStore.getGraphicMap(id)
    if (!primitive) {
      console.error(`id: ${id} 圆锥体不存在`)
      return false
    }

    try {

      const primitive = mapStore.getGraphicMap(id);
      if (!primitive) return false;

      const opts = (primitive as any)._originalOptions;
      const [lng, lat, height = 0] = opts.positions;
      const vertexPos = Cesium.Cartesian3.fromDegrees(lng, lat, height);

      const hpr = new Cesium.HeadingPitchRoll(
        Cesium.Math.toRadians(heading),
        Cesium.Math.toRadians(pitch),
        0
      );

      // 计算新矩阵
      const M = Cesium.Transforms.headingPitchRollToFixedFrame(vertexPos, hpr);
      const T = Cesium.Matrix4.fromTranslation(
        new Cesium.Cartesian3(0, 0, -opts.length / 2)
      );
      Cesium.Matrix4.multiply(M, T, M);

      // ✅ 直接赋值——立即生效，无需重建
      primitive.modelMatrix = M;

      // 缓存
      opts.heading = heading;
      opts.pitch = pitch;
      mapStore.setGraphicMap(id, primitive);
      console.log(`id: ${id} 圆锥体姿态已更新`);
      return true;
    } catch (error) {
      console.error(`更新圆锥体姿态失败:`, error);
      return false;
    }
  }

  /**
   * 创建四棱锥波效果
   * @param {string} options.id - 效果唯一标识符
   * @param {number[]} options.positions - 四棱锥顶点位置 [经度, 纬度, 高度]
   * @param {number} options.heading - 水平方位角（度）
   * @param {number} options.pitch - 俯仰角（度）
   * @param {number} options.height - 四棱锥高度（米）
   * @param {number} options.horizontalAngle - 水平展开角度（度）
   * @param {number} options.verticalAngle - 垂直展开角度（度）
   * @param {string} options.color - 颜色（默认 '#00FFFF'）
   * @returns {Cesium.Primitive|null} 创建的四棱锥波实体，若创建失败则返回null
   */
  const rectangularPyramidWave = (options: {
    id: string,
    positions: number[],
    heading: number,
    pitch: number,
    height: number,
    horizontalAngle: number,
    verticalAngle: number,
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

    // 提取经纬度和高度
    const [lng, lat, height = 0] = options.positions;
    
    // 关键：直接使用经纬度作为四棱锥顶点的位置
    const worldVertexPosition = Cesium.Cartesian3.fromDegrees(lng, lat, height);
    
    // 使用用户设置的方向参数，将度数转换为弧度
    const heading = Cesium.Math.toRadians(options.heading);
    const pitch = Cesium.Math.toRadians(options.pitch);
    const roll = 0;
    
    // 创建HeadingPitchRoll对象，控制四棱锥的朝向
    const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);

    // 创建四棱锥Primitive
    // 1. 使用headingPitchRollToFixedFrame创建正确的模型矩阵
    // 这个方法会创建一个以worldVertexPosition为原点，应用hpr旋转的变换矩阵
    const modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(worldVertexPosition, hpr);
    
    // 2. 创建平移矩阵，将四棱锥向下平移高度的一半
    // 这样可以确保四棱锥的底部位于指定的高度位置
    const translation = Cesium.Matrix4.fromTranslation(
      new Cesium.Cartesian3(0, 0, -options.height / 2)
    );
    Cesium.Matrix4.multiply(modelMatrix, translation, modelMatrix);
    
    // 计算四棱锥的底部宽度（基于水平角度）
    const horizontalAngleRad = Cesium.Math.toRadians(options.horizontalAngle);
    const bottomWidth = options.height * Math.tan(horizontalAngleRad);
    
    // 增强立体感的实现
    // 1. 使用更高级的材质和光照效果
    // 2. 添加边缘线框增强轮廓
    // 3. 使用颜色渐变增强深度感

    // 创建主颜色
    const baseColor = Cesium.Color.fromCssColorString(options.color || '#00FFFF');
    
    // 创建四棱锥主体，使用MaterialAppearance
    const primitive = new Cesium.Primitive({
      geometryInstances: new Cesium.GeometryInstance({
        geometry: new Cesium.CylinderGeometry({
          length: options.height,
          topRadius: 0,
          bottomRadius: bottomWidth / 2,
          slices: 4 // 4边形底部
        })
      }),
      appearance: new Cesium.MaterialAppearance({
        material: Cesium.Material.fromType('Color', {
          color: baseColor.withAlpha(0.8) // 主颜色，带透明度
        }),
        closed: true
      }),
      modelMatrix,
      asynchronous: false
    });

    // 只需要挂原始参数，用于后面计算
    (primitive as any)._originalOptions = { ...options };

    // 将primitive添加到mapStore中进行管理
    mapStore.setGraphicMap(options.id, primitive);

    // 添加primitive到场景
    map.scene.primitives.add(primitive);

    return primitive;
  }

  /**
   * 更新四棱锥特效的朝向
   * @param {Object} options 更新配置参数
   * @param {string} options.id - 四棱锥ID
   * @param {number} options.heading - 新的水平方位角（度）
   * @param {number} options.pitch - 新的垂直方位角（度）
   * @returns {boolean} 更新成功返回true，否则返回false
   */
  const updateRectangularPyramidWavePose = (options: {
    id: string, 
    heading?: number,
    pitch?: number,
  }) => {
    const { id, heading, pitch } = options;

    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return false
    }

    // 获取已创建的四棱锥
    const primitive = mapStore.getGraphicMap(id)
    if (!primitive) {
      console.error(`id: ${id} 四棱锥体不存在`)
      return false
    }

    try {
      const primitive = mapStore.getGraphicMap(id);
      if (!primitive) return false;

      const opts = (primitive as any)._originalOptions;
      const [lng, lat, height = 0] = opts.positions;
      const vertexPos = Cesium.Cartesian3.fromDegrees(lng, lat, height);

      const hpr = new Cesium.HeadingPitchRoll(
        Cesium.Math.toRadians(heading),
        Cesium.Math.toRadians(pitch),
        0
      );

      // 计算新矩阵
      const M = Cesium.Transforms.headingPitchRollToFixedFrame(vertexPos, hpr);
      const T = Cesium.Matrix4.fromTranslation(
        new Cesium.Cartesian3(0, 0, -opts.height / 2)
      );
      Cesium.Matrix4.multiply(M, T, M);

      primitive.modelMatrix = M;

      console.log(`id: ${id} 四棱锥姿态已更新`);
      return true;
    } catch (error) {
      console.error(`更新四棱锥姿态失败:`, error);
      return false;
    }
  }
  
  /**
   * 更新四棱锥特效的高度、位置
   * @param {Object} options 更新配置参数
   * @param {string} options.id - 四棱锥ID
   * @param {number} options.height - 新的高度（米）（可选）
   * @param {number} options.positions - 新的位置（经度、纬度、高度）（可选）
   * @returns {boolean} 更新成功返回true，否则返回false
   */
  const updateRectangularPyramidLengthOrPosition = (options: {
    id: string, 
    height?: number,
    positions?: [number, number, number];
  }): boolean => {
    const { id, height, positions } = options;
    const map = mapStore.getMap();
    if (!map) {
      console.error('地图实例不存在');
      return false;
    }

    if(height === undefined && positions === undefined) {
      console.error('更新四棱锥体高度 / 位置：必须提供高度或位置');
      return false;
    }

    const oldPrimitive = mapStore.getGraphicMap(id);
    if (!oldPrimitive) {
      console.error(`id: ${id} 四棱锥体不存在`);
      return false;
    }

    try {
      /* 1. 备份旧参数，并应用新值 */
      const opts = { ...(oldPrimitive as any)._originalOptions };
      
      // 只在提供新值时才更新
      if (height !== undefined) {
        opts.height = height;
      }
      if (positions !== undefined) {
        opts.positions = positions;
      }

      /* 2. 计算顶点世界坐标 */
      // 确保始终从opts.positions获取坐标（可能是原始值或新值）
      const [lng, lat, height_val = 0] = opts.positions;
      const vertexPos = Cesium.Cartesian3.fromDegrees(lng, lat, height_val);

      /* 3. 计算模型矩阵（与创建时完全一致） */
      const hpr = new Cesium.HeadingPitchRoll(
        Cesium.Math.toRadians(opts.heading),
        Cesium.Math.toRadians(opts.pitch),
        0
      );
      const modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(vertexPos, hpr);
      
      // 4. 创建平移矩阵，将四棱锥向下平移高度的一半
      // 这样可以确保四棱锥的底部位于指定的高度位置
      const translation = Cesium.Matrix4.fromTranslation(
        new Cesium.Cartesian3(0, 0, -opts.height / 2)
      );
      Cesium.Matrix4.multiply(modelMatrix, translation, modelMatrix);

      /* 5. 根据角度计算四棱锥的底部尺寸 */
      const horizontalAngleRad = Cesium.Math.toRadians(opts.horizontalAngle);

      // 计算底部尺寸
      const bottomWidth = opts.height * Math.tan(horizontalAngleRad);
      
      /* 6. 新建四棱锥主体primitive，使用MaterialAppearance */
       const newPrimitive = new Cesium.Primitive({
         geometryInstances: new Cesium.GeometryInstance({
           geometry: new Cesium.CylinderGeometry({
              length: opts.height,
              topRadius: 0,
              bottomRadius: bottomWidth / 2,
              slices: 4 // 4边形底部
            })
         }),
         appearance: new Cesium.MaterialAppearance({
           material: Cesium.Material.fromType('Color', {
             color: Cesium.Color.fromCssColorString(opts.color || '#00FFFF').withAlpha(0.8) // 主颜色，带透明度
           }),
           closed: true
         }),
         modelMatrix,
         asynchronous: false
       });

      (newPrimitive as any)._originalOptions = opts;
      map.scene.primitives.remove(oldPrimitive); // 场景会负责 destroy
      map.scene.primitives.add(newPrimitive);
      mapStore.setGraphicMap(id, newPrimitive);

      console.log(
        `id: ${id} 四棱锥体已更新 -> 高度:${opts.height}m, 位置:[${lng}, ${lat}, ${height_val}]`
      );
      return true;
    } catch (e) {
      console.error(`更新四棱锥体失败:`, e);
      return false;
    }
  }

  return {
    conicalWave,
    updateConeLengthOrPosition,
    updateConePose,
    rectangularPyramidWave,
    updateRectangularPyramidWavePose,
    updateRectangularPyramidLengthOrPosition,
  }
}
