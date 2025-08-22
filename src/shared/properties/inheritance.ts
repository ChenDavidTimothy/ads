// src/shared/properties/inheritance.ts

import type { PerObjectAssignments } from "./assignments";
import type { Point2D } from "@/shared/types/core";

export type Axis2D = "x" | "y";

export interface DefaultScopeInputs<T> {
	// Node-level default values (already merged with registry defaults)
	nodeDefaults: Partial<T>;
	// Node-level variable bindings map (key -> value resolved)
	nodeBoundValues?: Partial<T>;
	// Default inherit booleans per property (and per-axis if Point2D)
	inherit?: Record<string, unknown>;
}

export interface PerObjectScopeInputs<T> {
	objectId: string;
	perObjectAssignments?: PerObjectAssignments;
	// Per-object variable binding values (resolved) for this object
	perObjectBoundValues?: Partial<T>;
}

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null;
}

function getInheritFlag(
	inherit: Record<string, unknown> | undefined,
	key: string,
	subKey?: Axis2D,
): boolean {
	if (!inherit) return false;
	const val = inherit[key];
	if (subKey && isRecord(val)) {
		return Boolean(val[subKey]);
	}
	return Boolean(val);
}

export function buildSparseOverrides<T extends Record<string, unknown>>(
	keys: Array<keyof T>,
	defaultScope: DefaultScopeInputs<T>,
	perObjectScope?: PerObjectScopeInputs<T>,
): Partial<T> {
	const result: Partial<T> = {};
	const { nodeDefaults, nodeBoundValues, inherit } = defaultScope;

	for (const key of keys) {
		const k = String(key);

		// Per-object precedence: binding -> manual
		const poBound = perObjectScope?.perObjectBoundValues?.[k as keyof T];
		if (poBound !== undefined) {
			(result as Record<string, unknown>)[k] = poBound;
			continue;
		}

		const assignment = perObjectScope?.perObjectAssignments?.[
			perObjectScope.objectId
		]?.initial as Record<string, unknown> | undefined;
		if (assignment && k in assignment && assignment[k] !== undefined) {
			(result as Record<string, unknown>)[k] = assignment[k];
			continue;
		}

		// Default-scope: if inherit flag is set for this key, omit it completely
		if (getInheritFlag(inherit as Record<string, unknown> | undefined, k)) {
			continue; // inherit upstream
		}

		// Otherwise Default binding -> Default manual
		const nodeBound = nodeBoundValues?.[k as keyof T];
		if (nodeBound !== undefined) {
			(result as Record<string, unknown>)[k] = nodeBound;
			continue;
		}

		const nodeVal = nodeDefaults[k as keyof T];
		if (nodeVal !== undefined) {
			(result as Record<string, unknown>)[k] = nodeVal;
		}
	}
	return result;
}

// Specialized helper for Point2D properties with per-axis inherit flags
export function buildSparsePoint2DOverride(
	key: string,
	defaultScope: DefaultScopeInputs<Record<string, Point2D | number | string>>,
	perObjectScope?: PerObjectScopeInputs<Record<string, Point2D | number | string>>,
): Partial<Record<string, Point2D>> {
	const out: Partial<Record<string, Point2D>> = {};
	const inheritObj = defaultScope.inherit as Record<string, unknown> | undefined;

	// Resolve bound and assignment per-axis first
	const poAssign = perObjectScope?.perObjectAssignments?.[
		perObjectScope.objectId
	]?.initial as Record<string, unknown> | undefined;
	const poBoundX = perObjectScope?.perObjectBoundValues?.[`${key}.x`];
	const poBoundY = perObjectScope?.perObjectBoundValues?.[`${key}.y`];

	let x: number | undefined;
	let y: number | undefined;

	if (poBoundX !== undefined) x = poBoundX as number;
	else if (poAssign && isRecord(poAssign[key]) && (poAssign[key] as Record<string, unknown>).x !== undefined) {
		x = (poAssign[key] as Record<string, unknown>).x as number;
	}

	if (poBoundY !== undefined) y = poBoundY as number;
	else if (poAssign && isRecord(poAssign[key]) && (poAssign[key] as Record<string, unknown>).y !== undefined) {
		y = (poAssign[key] as Record<string, unknown>).y as number;
	}

	// If per-object provided either axis, include those
	if (x !== undefined || y !== undefined) {
		out[key] = {
			x: x ?? (defaultScope.nodeDefaults[key] as Point2D | undefined)?.x ?? 0,
			y: y ?? (defaultScope.nodeDefaults[key] as Point2D | undefined)?.y ?? 0,
		};
		return out;
	}

	// Default inherit check per-axis
	const inhX = getInheritFlag(inheritObj, key, "x");
	const inhY = getInheritFlag(inheritObj, key, "y");

	const nodeBoundX = defaultScope.nodeBoundValues?.[`${key}.x` as keyof typeof defaultScope.nodeBoundValues];
	const nodeBoundY = defaultScope.nodeBoundValues?.[`${key}.y` as keyof typeof defaultScope.nodeBoundValues];

	const nodeDef = defaultScope.nodeDefaults[key] as Point2D | undefined;

	const finalX = inhX
		? undefined
		: (nodeBoundX as number | undefined) ?? nodeDef?.x;
	const finalY = inhY
		? undefined
		: (nodeBoundY as number | undefined) ?? nodeDef?.y;

	if (finalX !== undefined || finalY !== undefined) {
		out[key] = {
			x: finalX ?? nodeDef?.x ?? 0,
			y: finalY ?? nodeDef?.y ?? 0,
		};
	}

	return out;
}