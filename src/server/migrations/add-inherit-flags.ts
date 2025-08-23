// src/server/migrations/add-inherit-flags.ts

import type { Node } from "reactflow";
import type { NodeData, CanvasNodeData, TypographyNodeData, MediaNodeData } from "@/shared/types/nodes";

export function addInheritFlags(nodes: Node<NodeData>[]): Node<NodeData>[] {
	return nodes.map((n) => {
		if (!n?.data?.identifier?.type) return n;
		const type = n.data.identifier.type;
		if (type === "canvas") {
			const data = n.data as unknown as CanvasNodeData;
			return {
				...n,
				data: {
					...data,
					inherit: data.inherit ?? {
						position: { x: false, y: false },
						rotation: false,
						scale: { x: false, y: false },
						opacity: false,
						fillColor: false,
						strokeColor: false,
						strokeWidth: false,
					},
				},
			};
		}
		if (type === "typography") {
			const data = n.data as unknown as TypographyNodeData;
			return {
				...n,
				data: {
					...data,
					inherit: data.inherit ?? {
						content: false,
						fontFamily: false,
						fontSize: false,
						fontWeight: false,
						textAlign: false,
						lineHeight: false,
						letterSpacing: false,
						fontStyle: false,
						textBaseline: false,
						direction: false,
						fillColor: false,
						strokeColor: false,
						strokeWidth: false,
						shadowColor: false,
						shadowOffsetX: false,
						shadowOffsetY: false,
						shadowBlur: false,
						textOpacity: false,
					},
				},
			};
		}
		if (type === "media") {
			const data = n.data as unknown as MediaNodeData;
			return {
				...n,
				data: {
					...data,
					inherit: data.inherit ?? {
						imageAssetId: false,
						cropX: false,
						cropY: false,
						cropWidth: false,
						cropHeight: false,
						displayWidth: false,
						displayHeight: false,
					},
				},
			};
		}
		return n;
	});
}