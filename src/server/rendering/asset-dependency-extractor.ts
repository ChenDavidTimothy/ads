// src/server/rendering/asset-dependency-extractor.ts
import type { ScenePartition } from "@/server/animation-processing/scene/scene-partitioner";
import type { ImageProperties } from "@/shared/types/scene";

export interface AssetDependency {
  assetId: string;
  usageCount: number;
  requiredInScenes: string[];
}

export function extractAssetDependencies(
  partitions: ScenePartition[],
): AssetDependency[] {
  const dependencies = new Map<string, AssetDependency>();

  for (const partition of partitions) {
    const sceneId = partition.sceneNode.data.identifier.id;

    for (const obj of partition.objects) {
      if (obj.type === "image") {
        const props = obj.properties as ImageProperties;

        if (props.assetId) {
          const existing = dependencies.get(props.assetId);
          if (existing) {
            existing.usageCount++;
            existing.requiredInScenes.push(sceneId);
          } else {
            dependencies.set(props.assetId, {
              assetId: props.assetId,
              usageCount: 1,
              requiredInScenes: [sceneId],
            });
          }
        }
      }
    }
  }

  return Array.from(dependencies.values());
}

export function getUniqueAssetIds(dependencies: AssetDependency[]): string[] {
  return dependencies.map((dep) => dep.assetId);
}
