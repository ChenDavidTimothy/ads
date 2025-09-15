// Shared utility helpers for animation executors
export function deepClone<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}

export function toDisplayString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  )
    return String(value);
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

export const numberCoerce = (
  value: unknown,
): { ok: boolean; value?: number; warn?: string } => {
  if (typeof value === "number" && Number.isFinite(value))
    return { ok: true, value };
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return { ok: true, value: parsed };
  }
  return { ok: false, warn: `Expected number, got ${typeof value}` };
};

export const stringCoerce = (
  value: unknown,
): { ok: boolean; value?: string; warn?: string } => {
  if (typeof value === "string") return { ok: true, value };
  return { ok: false, warn: `Expected string, got ${typeof value}` };
};
