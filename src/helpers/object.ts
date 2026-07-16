type ObjectType = Record<string, unknown>;

/**
 * 判断值是否为纯对象（通过字面量 {} 或 new Object() 创建）
 * @param obj - 待判断的值
 * @returns 是否为纯对象
 */
export const isObject = (obj: unknown): obj is ObjectType =>
  !!obj && typeof obj === "object" && obj.constructor === Object;

/**
 * 深拷贝对象，优先使用 structuredClone，失败时回退为浅拷贝
 * @param obj - 待拷贝的值
 * @returns 拷贝后的值
 */
export const deepClone = <T>(obj: T): T => {
  let cloneObj: T;
  try {
    cloneObj = structuredClone(obj);
  } catch (err) {
    cloneObj = isObject(obj) ? ({ ...obj } as T) : (undefined as unknown as T);
  }
  return cloneObj;
};

/**
 * 深度合并两个对象，支持嵌套对象和数组
 * @param target - 目标对象（会被深拷贝，不会被修改）
 * @param source - 源对象，其属性会覆盖目标对象
 * @param isMergingArrays - 是否逐元素合并数组；为 false 时源数组直接覆盖目标数组
 * @returns 合并后的新对象
 */
export function mergeDeep<T extends ObjectType, S extends ObjectType>(
  target: T,
  source: S,
  isMergingArrays = false,
): T | S {
  const t = deepClone(target) as ObjectType;

  if (!isObject(target) || !isObject(source)) return source;

  Object.keys(source).forEach((key) => {
    const targetValue = target[key];
    const sourceValue = source[key];

    if (Array.isArray(targetValue) && Array.isArray(sourceValue))
      if (isMergingArrays) {
        t[key] = targetValue.map((x, i) =>
          sourceValue.length <= i
            ? x
            : mergeDeep(x, sourceValue[i], isMergingArrays),
        );
        if (sourceValue.length > targetValue.length)
          t[key] = (t[key] as unknown[]).concat(
            sourceValue.slice(targetValue.length),
          );
      } else {
        t[key] = sourceValue;
      }
    else if (isObject(targetValue) && isObject(sourceValue))
      t[key] = mergeDeep({ ...targetValue }, sourceValue, isMergingArrays);
    else t[key] = sourceValue;
  });

  return t as T | S;
}

/**
 * 按点分隔路径设置对象深层属性，路径中不存在的中间属性会自动创建为空对象
 * @param obj - 目标对象
 * @param path - 属性路径，如 "a.b.c"
 * @param value - 要设置的值
 */
export function setValueByPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}
