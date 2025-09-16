import { z } from "zod";
import { protectedProcedure } from "@/server/api/trpc";
import { waitForRenderJobEvent } from "@/server/jobs/pg-events";
import { createServiceClient } from "@/utils/supabase/service";
import type { AnimationTRPCContext } from "../context";

const getRenderJobStatusInput = z.object({ jobId: z.string() });

export const getRenderJobStatusProcedure = protectedProcedure
  .input(getRenderJobStatusInput)
  .query(async ({ input, ctx }: { input: { jobId: string }; ctx: AnimationTRPCContext }) => {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("render_jobs")
      .select("status, output_url, error")
      .eq("id", input.jobId)
      .eq("user_id", ctx.user!.id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    let current = data;
    if (current?.status !== "completed" || !current?.output_url) {
      const notify = await waitForRenderJobEvent({
        jobId: input.jobId,
        timeoutMs: 25000,
      });
      if (notify && notify.status === "completed" && notify.publicUrl) {
        return {
          status: "completed",
          videoUrl: notify.publicUrl,
          error: null,
        } as const;
      }

      const { data: latest, error: latestError } = await supabase
        .from("render_jobs")
        .select("status, output_url, error")
        .eq("id", input.jobId)
        .eq("user_id", ctx.user!.id)
        .single();

      if (!latestError && latest) {
        current = latest;
      }
    }

    return {
      status: (current?.status as string) ?? "unknown",
      videoUrl: (current?.output_url as string) ?? null,
      error: (current?.error as string) ?? null,
    } as const;
  });
