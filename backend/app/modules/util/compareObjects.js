function compareObjects(obj1, obj2, keyForMatch = 'source_id', ignoreKeys = []) {
  // Handle primitive values or completely different types
  if (Object.is(obj1, obj2)) return {};

  if (
    typeof obj1 !== 'object' ||
    typeof obj2 !== 'object' ||
    obj1 === null ||
    obj2 === null
  ) {
    return {
      newValue: obj1 !== undefined ? obj1 : {},
      oldValue: obj2 !== undefined ? obj2 : {}
    };
  }

  // Handle arrays
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length === 0 && obj2.length === 0) return {}; // both arrays empty then no diff

    const diffArray = [];
    const obj1Map = new Map();
    const obj2Map = new Map();

    for (const item of obj1) {
      if (item && item[keyForMatch] !== undefined) {
        obj1Map.set(item[keyForMatch], item);
      }
    }

    for (const item of obj2) {
      if (item && item[keyForMatch] !== undefined) {
        obj2Map.set(item[keyForMatch], item);
      }
    }

    const allKeys = new Set([...obj1Map.keys(), ...obj2Map.keys()]);

    for (const key of allKeys) {
      const val1 = obj1Map.get(key);
      const val2 = obj2Map.get(key);

      let itemDiff;
      if (val1 === undefined) {
        itemDiff = {
          newValue: {},
          oldValue: val2
        };
      } else if (val2 === undefined) {
        itemDiff = {
          newValue: val1,
          oldValue: {}
        };
      } else {
        itemDiff = compareObjects(val1, val2, keyForMatch, ignoreKeys);
      }

      if (Object.keys(itemDiff).length > 0) {
        diffArray.push({
          [keyForMatch]: key,
          diff: itemDiff
        });
      }
    }

    return diffArray.length > 0 ? diffArray : {};
  }

  // Handle objects
  const diff = {};
  const keys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

  for (const key of keys) {
    if (ignoreKeys.includes(key)) continue; // skip ignored keys

    const valDiff = compareObjects(obj1[key], obj2[key], keyForMatch, ignoreKeys);
    if (Object.keys(valDiff).length > 0) {
      diff[key] = valDiff;
    }
  }

  return Object.keys(diff).length > 0
    ? { newValue: buildNewValue(diff), oldValue: buildOldValue(diff) }
    : {};
}

function buildNewValue(diff) {
  const result = {};
  for (const key in diff) {
    if ('newValue' in diff[key]) {
      result[key] = diff[key].newValue;
    }
  }
  return result;
}

function buildOldValue(diff) {
  const result = {};
  for (const key in diff) {
    if ('oldValue' in diff[key]) {
      result[key] = diff[key].oldValue;
    }
  }
  return result;
}

module.exports = compareObjects;
