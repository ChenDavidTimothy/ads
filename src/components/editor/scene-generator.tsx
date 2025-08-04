"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
        <Button
          onClick={generateExampleScene}
          disabled={generateScene.isPending}
          className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          size="lg"
        >
          Generate Sequential Demo
        </Button>
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
            <Button
              onClick={handleDownload}
              variant="success"
              className="flex-1"
            >
              Download MP4
            </Button>
            <Button
              onClick={() => window.open(videoUrl, '_blank')}
              variant="primary"
              className="flex-1"
            >
              Open in New Tab
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}