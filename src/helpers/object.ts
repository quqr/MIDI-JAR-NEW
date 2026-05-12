type ObjectType = Record<string, unknown>;

export const isObject = (obj: unknown): obj is ObjectType =>
  !!obj && typeof obj === "object" && obj.constructor === Object;

export const deepClone = (obj: unknown) => {
  let cloneObj;
  try {
    cloneObj = JSON.parse(JSON.stringify(obj));
  } catch (err) {
    cloneObj = isObject(obj) ? { ...obj } : cloneObj;
  }
  return cloneObj;
};

export function mergeDeep<T extends ObjectType, S extends ObjectType>(
  target: T,
  source: S,
  isMergingArrays = false,
): T | S {
  const t = deepClone(target);

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
          t[key] = t[key].concat(sourceValue.slice(targetValue.length));
      } else {
        t[key] = sourceValue;
      }
    else if (isObject(targetValue) && isObject(sourceValue))
      t[key] = mergeDeep({ ...targetValue }, sourceValue, isMergingArrays);
    else t[key] = sourceValue;
  });

  return t;
}

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
