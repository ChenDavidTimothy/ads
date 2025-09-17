export function getValueType(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return `array[${value.length}]`;
  if (typeof value === 'object') return 'object';
  return typeof value;
}

export function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '[Complex Object]';
    }
  }
  return `[${typeof value}]`;
}

export function getDataSize(value: unknown): string {
  if (value === null || value === undefined) return '0 bytes';

  try {
    const str = JSON.stringify(value);
    const bytes = new Blob([str]).size;

    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  } catch {
    return 'unknown size';
  }
}

export function isComplexObject(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  if (Array.isArray(value)) return value.length > 10;

  try {
    const keys = Object.keys(value);
    return keys.length > 5;
  } catch {
    return false;
  }
}

export function hasNestedData(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;

  try {
    if (Array.isArray(value)) {
      return value.some((item) => typeof item === 'object' && item !== null);
    }

    const values = Object.values(value);
    return values.some((val) => typeof val === 'object' && val !== null);
  } catch {
    return false;
  }
}
