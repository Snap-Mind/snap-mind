/**
 * Represents a deeply partial version of a type T, where all nested properties are optional
 */
type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

/**
 * Deep merge two objects while preserving the original properties if they exist
 * @param target - The target object to merge into
 * @param source - The source object to merge from
 * @returns The merged object
 * @throws {Error} If target is null or not an object
 * @example
 * ```typescript
 * const target = {
 *   a: 1,
 *   b: { c: 2 }
 * };
 * const source = {
 *   b: { d: 3 },
 *   e: 4
 * };
 * const result = mergeDeep(target, source);
 * // result = {
 * //   a: 1,
 * //   b: { c: 2, d: 3 },
 * //   e: 4
 * // }
 * ```
 */
export function mergeDeep<T extends Record<string, any>>(target: T, source: DeepPartial<T>): T {
  // Validate inputs
  if (target === null || typeof target !== 'object') {
    throw new Error('Target must be an object');
  }

  if (source === null || typeof source !== 'object') {
    return target;
  }

  // Create a type-safe copy of the target
  const result: Record<string, any> = Array.isArray(target) ? [...target] : { ...target };

  // Iterate through source properties
  Object.keys(source).forEach((key) => {
    const sourceValue = source[key as keyof typeof source];
    const targetValue = target[key as keyof typeof target];

    // Skip undefined source values to maintain target values
    if (sourceValue === undefined) {
      return;
    }

    // Handle arrays - only add if target doesn't have the array
    if (Array.isArray(sourceValue)) {
      if (!Array.isArray(targetValue)) {
        result[key] = [...sourceValue];
      }
      return;
    }

    // Handle nested objects (excluding arrays)
    if (isPlainObject(sourceValue)) {
      if (isPlainObject(targetValue)) {
        // Recursively merge nested objects
        result[key] = mergeDeep(targetValue, sourceValue);
      } else if (targetValue === undefined) {
        // Create new object if target doesn't have one
        result[key] = mergeDeep({}, sourceValue);
      }
      return;
    }

    // Handle primitive values - only add if target doesn't have the key
    if (targetValue === undefined) {
      result[key] = sourceValue;
    }
  });

  return result as T;
}

/**
 * Type guard to check if a value is a plain object (not null, not array, just a regular object)
 */
function isPlainObject(value: unknown): value is Record<string, any> {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value);
}
