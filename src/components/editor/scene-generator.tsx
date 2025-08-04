"use client";

import { useState } from "react";
import { api } from "@/trpc/react";

export function SceneGenerator() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const generateScene = api.animation.generateScene.useMutation({
    onSuccess: (data) => {
      setVideoUrl(data.videoUrl);
    },
    onError: (error) => {
      console.error("Scene generation failed:", error);
      alert(`Failed to generate scene: ${error.message}`);
    },
  });

  const generateExampleScene = () => {
    const exampleScene = {
      duration: 6,
      objects: [
        {
          id: "red-triangle",
          type: "triangle" as const,
          properties: {
            size: 80,
            color: "#ff4444",
            strokeColor: "#ffffff",
            strokeWidth: 3,
          },
          initialPosition: { x: 200, y: 400 },
          initialRotation: 0,
          initialScale: { x: 1, y: 1 },
          initialOpacity: 1,
        },
        {
          id: "blue-circle",
          type: "circle" as const,
          properties: {
            radius: 50,
            color: "#4444ff",
            strokeColor: "#ffffff",
            strokeWidth: 2,
          },
          initialPosition: { x: 200, y: 600 },
          initialRotation: 0,
          initialScale: { x: 1, y: 1 },
          initialOpacity: 1,
        },
      ],
      animations: [
        // Sequential execution: First animation container (0-3s)
        {
          objectId: "red-triangle",
          type: "move" as const,
          startTime: 0,
          duration: 3,
          easing: "easeInOut" as const,
          properties: {
            from: { x: 200, y: 400 },
            to: { x: 1600, y: 400 },
          },
        },
        {
          objectId: "red-triangle",
          type: "rotate" as const,
          startTime: 0,
          duration: 3,
          easing: "linear" as const,
          properties: {
            from: 0,
            to: 0,
            rotations: 2,
          },
        },
        // Second animation container (3-6s)
        {
          objectId: "blue-circle",
          type: "move" as const,
          startTime: 3,
          duration: 3,
          easing: "easeInOut" as const,
          properties: {
            from: { x: 200, y: 600 },
            to: { x: 1600, y: 600 },
          },
        },
        {
          objectId: "blue-circle",
          type: "scale" as const,
          startTime: 3,
          duration: 2,
          easing: "easeInOut" as const,
          properties: {
            from: 1,
            to: 1.8,
          },
        },
      ],
      background: {
        color: "#1a1a2e",
      },
    };

    setVideoUrl(null);
    generateScene.mutate({ scene: exampleScene });
  };

  const handleDownload = () => {
    if (videoUrl) {
      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = `scene_animation_${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="w-full max-w-2xl space-y-4">
      <h3 className="text-2xl font-bold text-center text-white">
        Animation Node Generator
      </h3>
      
      <div className="flex gap-3">
        <button
          onClick={generateExampleScene}
          disabled={generateScene.isPending}
          className="flex-1 rounded-md bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3 font-semibold text-white transition hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Generate Sequential Demo
        </button>
      </div>

      {generateScene.isPending && (
        <div className="text-center text-sm text-white/80">
          Generating animation sequence... This may take 15-45 seconds...
        </div>
      )}

      {videoUrl && (
        <div className="space-y-3 rounded-md bg-white/5 p-4">
          <div className="text-center text-sm text-green-400 font-medium">
            ✅ Animation sequence generated successfully!
          </div>
          
          <video
            src={videoUrl}
            controls
            autoPlay
            loop
            className="w-full rounded-md"
          >
            Your browser does not support the video tag.
          </video>
          
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="flex-1 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-green-700"
            >
              Download MP4
            </button>
            <button
              onClick={() => window.open(videoUrl, '_blank')}
              className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Open in New Tab
            </button>
          </div>
        </div>
      )}
    </div>
  );
}