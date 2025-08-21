// src/components/editor/flow/components/VideoPreview.tsx
interface Props {
  videoUrl: string | null;
}

export function VideoPreview({ videoUrl }: Props) {
  if (!videoUrl) return null;
  return (
    <div className="absolute bottom-4 right-4 w-80">
      <video src={videoUrl} controls autoPlay loop className="w-full rounded-md border border-gray-600">
        Your browser does not support the video tag.
      </video>
    </div>
  );
}


