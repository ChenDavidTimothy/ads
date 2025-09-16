import { describe, it, expect } from "vitest";
import { executeMediaNode } from "../media-handler";
import {
  createExecutionContext,
  setNodeOutput,
} from "../../../execution-context";
import type { ReactFlowEdge, ReactFlowNode } from "../../../types/graph";
import type { MediaNodeData, SceneNodeData } from "@/shared/types/nodes";
import type { SceneObject, ImageProperties } from "@/shared/types/scene";
import {
  partitionByBatchKey,
  buildAnimationSceneFromPartition,
} from "@/server/animation-processing/scene/scene-partitioner";
import { namespacePartitionForBatch } from "@/server/animation-processing/flow-transformers";
import type { AssetCacheManager } from "@/server/rendering/asset-cache-manager";

describe("media executor batch overrides", () => {
  it("emits per-batch asset overrides and resolves them during scene build", async () => {
    const context = createExecutionContext();

    const imageObject: SceneObject = {
      id: "img_alpha",
      type: "image",
      properties: {} as ImageProperties,
      initialPosition: { x: 0, y: 0 },
      initialRotation: 0,
      initialScale: { x: 1, y: 1 },
      initialOpacity: 1,
      batch: true,
      batchKeys: ["batch1", "batch2"],
    };

    setNodeOutput(
      context,
      "imageNode",
      "output",
      "object_stream",
      [imageObject],
      {
        perObjectAssignments: {},
        perObjectTimeCursor: { [imageObject.id]: 0 },
      },
    );

    const mediaNode: ReactFlowNode<MediaNodeData> = {
      id: "mediaNode",
      type: "media",
      position: { x: 0, y: 0 },
      data: {
        identifier: {
          id: "mediaNode",
          type: "media",
          displayName: "Media Node",
          createdAt: 0,
          sequence: 1,
        },
        lineage: { parentNodes: [], childNodes: [], flowPath: [] },
        imageAssetId: "",
        cropX: 0,
        cropY: 0,
        cropWidth: 0,
        cropHeight: 0,
        displayWidth: 0,
        displayHeight: 0,
        batchOverridesByField: {
          "Media.imageAssetId": {
            __default_object__: {
              batch1: "asset-1",
              batch2: "asset-2",
            },
          },
        },
      },
    };

    const edges: ReactFlowEdge[] = [
      {
        id: "edge-1",
        source: "imageNode",
        target: "mediaNode",
        sourceHandle: "output",
        targetHandle: "input",
      },
    ];

    await executeMediaNode(mediaNode, context, edges);

    const mediaOutput = context.nodeOutputs.get("mediaNode.output");
    expect(mediaOutput).toBeDefined();

    const metadata = mediaOutput?.metadata as
      | {
          perObjectBatchOverrides?: Record<
            string,
            Record<string, Record<string, unknown>>
          >;
          perObjectBoundFields?: Record<string, string[]>;
        }
      | undefined;

    expect(metadata?.perObjectBatchOverrides).toBeDefined();
    expect(
      metadata?.perObjectBatchOverrides?.[imageObject.id]?.[
        "Media.imageAssetId"
      ],
    ).toEqual({
      batch1: "asset-1",
      batch2: "asset-2",
    });

    const sceneNode: ReactFlowNode<SceneNodeData> = {
      id: "sceneNode",
      type: "scene",
      position: { x: 0, y: 0 },
      data: {
        identifier: {
          id: "sceneNode",
          type: "scene",
          displayName: "Scene",
          createdAt: 0,
          sequence: 1,
        },
        lineage: { parentNodes: [], childNodes: [], flowPath: [] },
        width: 1920,
        height: 1080,
        fps: 30,
        duration: 1,
        backgroundColor: "#000000",
        videoPreset: "default",
        videoCrf: 18,
      },
    };

    const basePartition = {
      sceneNode,
      objects: mediaOutput?.data as SceneObject[],
      animations: [],
      batchOverrides: metadata?.perObjectBatchOverrides,
      boundFieldsByObject: metadata?.perObjectBoundFields,
    };

    const subPartitions = partitionByBatchKey(basePartition);
    expect(subPartitions).toHaveLength(2);

    const fakeAssetCache = {
      getAsset: (assetId: string) => ({
        assetId,
        localPath: `/tmp/${assetId}.png`,
        contentHash: "hash",
        size: 1,
        contentType: "image/png",
        width: 100,
        height: 100,
        verified: true,
      }),
    } as unknown as AssetCacheManager;

    for (const sub of subPartitions) {
      const namespaced = namespacePartitionForBatch(sub, sub.batchKey);
      const scene = await buildAnimationSceneFromPartition(
        namespaced,
        fakeAssetCache,
      );
      expect(scene.objects).toHaveLength(1);
      const firstObject = scene.objects[0];
      expect(firstObject).toBeDefined();
      const props = firstObject!.properties as Record<string, unknown>;
      const expectedAsset = sub.batchKey === "batch1" ? "asset-1" : "asset-2";
      expect(props.assetId).toBe(expectedAsset);
      expect(props.imageUrl).toBe(`/tmp/${expectedAsset}.png`);
    }
  });
});
