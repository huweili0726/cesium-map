/**
 * object 相关工具函数
 */
export function objectUtils() {
  /**
   * 合并配置项（内部类型）
   */
  interface MergeOptions {
    /** 是否深度合并，默认 true */
    deep?: boolean;
    /** 是否覆盖目标对象已有属性，默认 true */
    overwrite?: boolean;
  }

  /**
   * 深度合并两个对象
   * @param target 目标对象（会被修改并返回）
   * @param source 源对象（合并到目标对象的数据源）
   * @param options 可选配置项
   * @returns 合并后的目标对象
   */
  const merge = <T extends Record<string, any>, S extends Record<string, any>>(
    target: T,
    source: S,
    options: MergeOptions = { deep: true, overwrite: true }
  ): T & S => {
    // 解构配置并设置默认值
    const { deep = true, overwrite = true } = options;

    // 边界值判断：源对象非对象/数组，直接返回目标对象
    if (source === null || typeof source !== 'object') {
      return target as T & S;
    }

    // 目标对象非对象/数组时，初始化为与源对象同类型
    if (target === null || typeof target !== 'object') {
      target = (Array.isArray(source) ? [] : {}) as T;
    }

    // 数组处理：按索引深度合并
    if (Array.isArray(source)) {
      const targetArr = target as unknown as any[];
      const sourceArr = source as any[];

      if (!deep) {
        return (overwrite ? source : target) as T & S;
      }

      sourceArr.forEach((item, index) => {
        if (targetArr[index] === undefined) {
          targetArr[index] = item;
        } else {
          targetArr[index] = merge(targetArr[index], item, { deep, overwrite });
        }
      });

      return target as T & S;
    }

    // 普通对象处理：递归合并属性
    const targetObj = target as Record<string, any>;
    const sourceObj = source as Record<string, any>;

    Object.keys(sourceObj).forEach((key) => {
      const sourceValue = sourceObj[key];
      const targetValue = targetObj[key];

      // 深度合并：嵌套对象递归处理
      if (deep && sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
        if (!targetValue || typeof targetValue !== 'object') {
          targetObj[key] = {};
        }
        merge(targetValue, sourceValue, { deep, overwrite });
      } else {
        // 非深度合并/基础类型：判断是否覆盖
        if (overwrite || targetValue === undefined) {
          targetObj[key] = sourceValue;
        }
      }
    });

    return target as T & S;
  };

  return {
    merge,
  };
}