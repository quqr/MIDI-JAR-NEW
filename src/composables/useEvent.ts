import { ref } from "vue";

/**
 * A utility to create a stable event handler that always references the latest callback.
 * Similar to React's useEvent but adapted for Vue 3 composition API.
 */
export function useEvent<T extends (...args: any[]) => any>(func: T): T {
  const refFn = ref(func);

  refFn.value = func;

  const stableFn = ((...args: Parameters<T>) => {
    return refFn.value(...args);
  }) as T;

  return stableFn;
}

export default useEvent;
