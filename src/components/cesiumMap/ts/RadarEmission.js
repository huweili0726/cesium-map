import * as Cesium from "cesium";

// 定义雷达材质属性
class RadarPrimitiveMaterialProperty {
  constructor(options = {}) {
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
    this._color = undefined;
    this._colorSubscription = undefined;
    this.color = this.opts.color;
    this.duration = this.opts.duration;
    this._time = this.opts.time;
  }

  get isConstant() {
    return false;
  }

  get definitionChanged() {
    return this._definitionChanged;
  }

  getType() {
    return "radarPrimitive";
  }

  getValue(time, result) {
    if (!Cesium.defined(result)) {
      result = {};
    }
    result.color = Cesium.Property.getValueOrClonedDefault(
      this._color,
      time,
      Cesium.Color.WHITE,
      result.color
    );
    result.time =
      ((new Date().getTime() - this._time) % this.duration) /
      this.duration /
      10;
    result.repeat = this.opts.repeat;
    result.offset = this.opts.offset;
    result.thickness = this.opts.thickness;
    return result;
  }

  equals(other) {
    return (
      this === other ||
      (other instanceof RadarPrimitiveMaterialProperty &&
        Cesium.Property.equals(this._color, other._color))
    );
  }
}

Object.defineProperties(RadarPrimitiveMaterialProperty.prototype, {
  color: Cesium.createPropertyDescriptor("color"),
});

class RadarEmission {
  constructor(viewer, options = {}) {
    this.viewer = viewer;
    this.options = {
      position: [114, 35, 0], // 经度、纬度、高度
      heading: 135,
      color: Cesium.Color.CORAL,
      length: 500000,
      bottomRadius: 50000,
      thickness: 0.1,
      pitch: 0, // 俯仰角度：-30度（向上倾斜）
      ...options,
    };
    this.init();
  }

  init() {
    // 注册雷达材质
    this._registerRadarMaterial();
    // 创建雷达实体
    this.createRadarCone();
  }

  _registerRadarMaterial() {
    if (!Cesium.Material.radarPrimitiveType) {
      Cesium.Material.radarPrimitiveType = "radarPrimitive";
      Cesium.Material.radarPrimitiveSource = `
        uniform vec4 color;
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

      Cesium.Material._materialCache.addMaterial(
        Cesium.Material.radarPrimitiveType,
        {
          fabric: {
            type: Cesium.Material.radarPrimitiveType,
            uniforms: {
              color: new Cesium.Color(1.0, 0.0, 0.0, 0.5),
              time: 0,
              repeat: 30,
              offset: 0,
              thickness: 0.3,
            },
            source: Cesium.Material.radarPrimitiveSource,
          },
          translucent: function () {
            return true;
          },
        }
      );
    }
  }

  createRadarCone() {
    // 提取经纬度和高度
    const [lng, lat, height] = this.options.position;
    
    // 关键：直接使用经纬度作为圆锥体顶点的位置
    const vertexPosition = Cesium.Cartesian3.fromDegrees(lng, lat, 0);
    
    // 使用用户在mapControls.vue中设置的方向参数
    const heading = Cesium.Math.toRadians(this.options.heading);
    // 注意：这里我们需要调整pitch的处理方式
    // 为了让圆锥体的顶点在红点位置，我们需要：
    // 1. 保持heading不变
    // 2. 将pitch角度反转，让圆锥体向正确方向延伸
    const originalPitch = Cesium.Math.toRadians(this.options.pitch);
    // 反转pitch角度，确保圆锥体向正确方向延伸
    const pitch = -originalPitch;
    const roll = 0;
    
    // 创建HeadingPitchRoll对象，控制圆锥的朝向
    const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
    
    // 创建变换矩阵，用于将本地坐标转换为世界坐标
    const transform = Cesium.Transforms.headingPitchRollToFixedFrame(
      vertexPosition,
      hpr
    );
    
    // 创建一个沿圆锥体轴线方向的单位向量
    // 在圆锥体的本地坐标系中，y轴是其轴线方向
    const localAxis = new Cesium.Cartesian3(0, 1, 0);  // 使用1表示圆锥体向正y轴方向延伸
    
    // 将本地轴线向量转换为世界坐标系
    const worldAxis = Cesium.Matrix4.multiplyByPointAsVector(
      transform,
      localAxis,
      new Cesium.Cartesian3()
    );
    
    // 归一化方向向量
    Cesium.Cartesian3.normalize(worldAxis, worldAxis);
    
    // 计算圆锥体的中心点位置
    // 由于Cesium的圆柱体是从中心点向前后延伸的，所以我们需要：
    // 1. 从顶点位置沿着圆锥体轴线反方向移动长度的一半
    // 2. 这样圆锥体的顶点就会刚好位于红点位置
    const halfLength = this.options.length / 2;
    const cylinderCenter = Cesium.Cartesian3.clone(vertexPosition);
    Cesium.Cartesian3.multiplyByScalar(worldAxis, halfLength, worldAxis);
    Cesium.Cartesian3.subtract(cylinderCenter, worldAxis, cylinderCenter);  // 使用subtract而不是add
    
    // 计算圆锥体的方向四元数
    const orientation = Cesium.Transforms.headingPitchRollQuaternion(
      cylinderCenter,
      hpr
    );

    this.entity = this.viewer.entities.add({
      name: "Radar Cone",
      position: cylinderCenter,  // 圆锥体的中心点
      orientation: orientation,
      cylinder: {
        length: this.options.length,
        topRadius: 0,  // 顶部半径为0，形成圆锥顶点
        bottomRadius: this.options.bottomRadius,
        material: new RadarPrimitiveMaterialProperty({
          color: this.options.color,
          thickness: this.options.thickness,
        }),
      },
      // 添加一个红色点标记顶点位置，方便调试
      point: {
        pixelSize: 10,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        position: vertexPosition,  // 红点位置即圆锥体的顶点
      },
    });

    return this.entity;
  }

  // 销毁实体
  destroy() {
    if (this.entity) {
      this.viewer.entities.remove(this.entity);
      this.entity = null;
    }
  }

  // 定位到实体
  zoomTo() {
    if (this.entity) {
      this.viewer.zoomTo(this.entity);
    }
  }
}

export default RadarEmission;
