/**
 * Represents a deeply partial version of a type T, where all nested properties are optional
 */
type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

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
export type PathSegment = string | number;
export type PathPattern = string | RegExp | ((_path: PathSegment[]) => boolean);

export interface MergeOptions {
  // If a path matches, keep target value when defined; if undefined in target, do not add from source (skip entirely)
  preservePaths?: PathPattern[];
  // If a path matches, always replace target with source (no deep merge)
  replacePaths?: PathPattern[];
}

export function mergeDeep<T extends Record<string, any>>(
  target: T,
  source: DeepPartial<T>,
  options?: MergeOptions,
  _path: PathSegment[] = []
): T {
  // Validate inputs
  if (target === null || typeof target !== 'object') {
    throw new Error('Target must be an object');
  }

  if (source === null || typeof source !== 'object') {
    return target;
  }

  // Create a type-safe copy of the target
  let result: Record<string, any>;
  if (Array.isArray(target)) {
    result = [...target];
  } else {
    result = { ...target };
  }

  // Iterate through source properties
  Object.keys(source).forEach((key) => {
    const sourceValue = source[key as keyof typeof source];
    const targetValue = target[key as keyof typeof target];
    const currentPath = _path.concat(key);

    // Skip undefined source values to maintain target values
    if (sourceValue === undefined) {
      return;
    }

    // Path-based strategies
    if (shouldReplace(currentPath, options)) {
      // Replace with a deep copy of source (to avoid external mutations)
      let newValue: any;
      if (isPlainObject(sourceValue)) {
        newValue = mergeDeep({}, sourceValue as any, options, currentPath);
      } else if (Array.isArray(sourceValue)) {
        newValue = [...(sourceValue as any[])];
      } else {
        newValue = sourceValue;
      }
      result[key] = newValue;
      return;
    }

    if (shouldPreserve(currentPath, options)) {
      if (targetValue !== undefined) {
        // Keep user's value entirely
        result[key] = targetValue as any;
      }
      // If user doesn't have this key, skip adding from source
      return;
    }

    // Handle arrays
    if (Array.isArray(sourceValue)) {
      if (Array.isArray(targetValue)) {
        // Only merge arrays of objects by `id`; otherwise, keep target array as-is
        if (isArrayOfIdObjects(targetValue) || isArrayOfIdObjects(sourceValue)) {
          result[key] = mergeArrayById(
            targetValue as Array<Record<string, any>>,
            sourceValue,
            options,
            currentPath
          );
        }
        // For non-id arrays, do nothing (preserve user's target array)
      } else {
        // Target not an array, adopt source array
        result[key] = [...sourceValue];
      }
      return;
    }

    // Handle nested objects (excluding arrays)
    if (isPlainObject(sourceValue)) {
      if (isPlainObject(targetValue)) {
        // Recursively merge nested objects
        result[key] = mergeDeep(targetValue, sourceValue, options, currentPath);
      } else if (targetValue === undefined) {
        // Create new object if target doesn't have one
        result[key] = mergeDeep({}, sourceValue, options, currentPath);
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
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Check if array consists of objects that have an 'id' property (string-like). Useful for providers/models.
 */
function isArrayOfIdObjects(arr: unknown): arr is Array<{ id: string }> {
  if (!Array.isArray(arr)) return false;
  if (arr.length === 0) return false;
  return arr.every(
    (item) => isPlainObject(item) && 'id' in item && typeof (item as any).id === 'string'
  );
}

/**
 * Merge arrays of objects by 'id' field. Target takes precedence; source adds new items and deep-fills missing fields.
 */
function mergeArrayById(
  targetArr: Array<Record<string, any>>,
  sourceArr: Array<Record<string, any>>,
  options?: MergeOptions,
  path: PathSegment[] = []
): Array<Record<string, any>> {
  // Build map from target to preserve target order and values
  const targetMap = new Map<string, Record<string, any>>();
  const targetOrder: string[] = [];
  for (const t of targetArr) {
    const tid = (t as any)?.id as string | undefined;
    if (typeof tid === 'string') {
      targetMap.set(tid, t);
      targetOrder.push(tid);
    }
  }

  // Collect new items (not in target) and merge duplicates from source by id
  const addedMap = new Map<string, Record<string, any>>();
  const addedOrder: string[] = [];

  for (const s of sourceArr) {
    const sid = (s as any)?.id as string | undefined;
    if (typeof sid !== 'string' || sid.length === 0) continue;

    if (targetMap.has(sid)) {
      // Deep merge into existing target item without overriding user-set values
      const merged = mergeDeep(targetMap.get(sid)!, s, options, path.concat(sid));
      targetMap.set(sid, merged);
    } else {
      if (addedMap.has(sid)) {
        addedMap.set(sid, mergeDeep(addedMap.get(sid)!, s, options, path.concat(sid)));
      } else {
        addedMap.set(sid, s);
        addedOrder.push(sid);
      }
    }
  }

  // Rebuild array: original target order first, then newly added items in source order
  const result: Array<Record<string, any>> = [];
  for (const id of targetOrder) {
    const item = targetMap.get(id);
    if (item) result.push(item);
  }
  for (const id of addedOrder) {
    const item = addedMap.get(id);
    if (item) result.push(item);
  }
  return result;
}

/**
 * Merge arrays of primitives by union: keep target items, append any new source items not already present.
 */
// Note: Primitive arrays are intentionally not merged; target values are preserved.

// Helpers for path pattern matching
function pathToString(path: PathSegment[]): string {
  return path.map((seg) => String(seg)).join('.');
}

function splitPattern(pattern: string): string[] {
  return pattern.split('.');
}

function matchStringPattern(path: PathSegment[], pattern: string): boolean {
  const segs = path;
  const pats = splitPattern(pattern);
  if (segs.length !== pats.length) return false;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const pat = pats[i];
    if (pat === '*' || pat === '[]') continue; // wildcard
    if (String(seg) !== pat) return false;
  }
  return true;
}

function matches(path: PathSegment[], matcher?: PathPattern): boolean {
  if (!matcher) return false;
  if (typeof matcher === 'string') return matchStringPattern(path, matcher);
  if (matcher instanceof RegExp) return matcher.test(pathToString(path));
  if (typeof matcher === 'function') return !!matcher(path);
  return false;
}

function anyMatch(path: PathSegment[], patterns?: PathPattern[]): boolean {
  if (!patterns || patterns.length === 0) return false;
  return patterns.some((p) => matches(path, p));
}

function shouldPreserve(path: PathSegment[], options?: MergeOptions): boolean {
  return anyMatch(path, options?.preservePaths);
}

function shouldReplace(path: PathSegment[], options?: MergeOptions): boolean {
  return anyMatch(path, options?.replacePaths);
}
