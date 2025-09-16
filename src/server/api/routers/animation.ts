import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { getNodeDefinition as fetchNodeDefinition, getNodesByCategory } from "@/shared/registry/registry-utils";
import { DEFAULT_SCENE_CONFIG } from "@/server/rendering/renderer";
import { debugToNodeProcedure } from "./animation/procedures/debug-to-node";
import { generateSceneProcedure } from "./animation/procedures/generate-scene";
import { generateImageProcedure } from "./animation/procedures/generate-image";
import { validateSceneProcedure } from "./animation/procedures/validate-scene";
import { getRenderJobStatusProcedure } from "./animation/procedures/get-render-job-status";

export const animationRouter = createTRPCRouter({
  debugToNode: debugToNodeProcedure,
  generateScene: generateSceneProcedure,
  generateImage: generateImageProcedure,
  validateScene: validateSceneProcedure,
  getNodeDefinitions: publicProcedure.query(() => {
    const geometryNodes = getNodesByCategory("geometry");
    const timingNodes = getNodesByCategory("timing");
    const logicNodes = getNodesByCategory("logic");
    const animationNodes = getNodesByCategory("animation");
    const outputNodes = getNodesByCategory("output");

    return {
      geometry: geometryNodes,
      timing: timingNodes,
      logic: logicNodes,
      animation: animationNodes,
      output: outputNodes,
    };
  }),
  getRenderJobStatus: getRenderJobStatusProcedure,
  getNodeDefinition: publicProcedure
    .input(z.object({ nodeType: z.string() }))
    .query(({ input }) => {
      const definition = fetchNodeDefinition(input.nodeType);
      if (!definition) {
        throw new Error(`Unknown node type: ${input.nodeType}`);
      }
      return definition;
    }),
  getDefaultSceneConfig: publicProcedure.query(() => {
    return DEFAULT_SCENE_CONFIG;
  }),
});
