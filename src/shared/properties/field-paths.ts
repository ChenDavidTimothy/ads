// Central mapping from editor-local keys to resolver field paths

export type EditorKind = "canvas" | "typography" | "media" | "timeline";

const CANVAS_MAP: Record<string, string> = {
  "position.x": "Canvas.position.x",
  "position.y": "Canvas.position.y",
  "scale.x": "Canvas.scale.x",
  "scale.y": "Canvas.scale.y",
  rotation: "Canvas.rotation",
  opacity: "Canvas.opacity",
  fillColor: "Canvas.fillColor",
  strokeColor: "Canvas.strokeColor",
  strokeWidth: "Canvas.strokeWidth",
};

const TYPOGRAPHY_MAP: Record<string, string> = {
  content: "Typography.content",
  fontSize: "Typography.fontSize",
  fontFamily: "Typography.fontFamily",
  fontWeight: "Typography.fontWeight",
  fontStyle: "Typography.fontStyle",
  fillColor: "Typography.fillColor",
  strokeColor: "Typography.strokeColor",
  strokeWidth: "Typography.strokeWidth",
};

const MEDIA_MAP: Record<string, string> = {
  imageAssetId: "Media.imageAssetId",
  cropX: "Media.cropX",
  cropY: "Media.cropY",
  cropWidth: "Media.cropWidth",
  cropHeight: "Media.cropHeight",
  displayWidth: "Media.displayWidth",
  displayHeight: "Media.displayHeight",
};

const TIMELINE_MAP: Record<string, string> = {
  // Animation tracks - these map to the field paths used in batch overrides
  "move.from.x": "Timeline.move.from.x",
  "move.from.y": "Timeline.move.from.y",
  "move.to.x": "Timeline.move.to.x",
  "move.to.y": "Timeline.move.to.y",
  "rotate.from": "Timeline.rotate.from",
  "rotate.to": "Timeline.rotate.to",
  "scale.from.x": "Timeline.scale.from.x",
  "scale.from.y": "Timeline.scale.from.y",
  "scale.to.x": "Timeline.scale.to.x",
  "scale.to.y": "Timeline.scale.to.y",
  "fade.from": "Timeline.fade.from",
  "fade.to": "Timeline.fade.to",
  "color.from": "Timeline.color.from",
  "color.to": "Timeline.color.to",
  // Slide transform
  "slide.orientationDeg": "Timeline.slide.orientationDeg",
  "slide.velocity": "Timeline.slide.velocity",
};

export function getResolverFieldPath(
  editor: EditorKind,
  key: string,
): string | undefined {
  switch (editor) {
    case "canvas":
      return CANVAS_MAP[key];
    case "typography":
      return TYPOGRAPHY_MAP[key];
    case "media":
      return MEDIA_MAP[key];
    case "timeline":
      return TIMELINE_MAP[key];
    default:
      return undefined;
  }
}
