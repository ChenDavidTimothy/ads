export function formatSceneLabel(
  displayName: string,
  type: 'scene' | 'frame',
  objectCount: number
): string {
  const icon = type === 'scene' ? '🎬' : '📸';
  const noun = objectCount === 1 ? 'object' : 'objects';
  return `${icon} ${displayName} (${objectCount} ${noun})`;
}

export function reconcileLayerOrder(
  currentObjectIds: string[],
  savedOrder: string[] | undefined
): string[] {
  const saved = Array.isArray(savedOrder) ? savedOrder : [];
  const savedSet = new Set(saved);
  const preserved = saved.filter((id) => currentObjectIds.includes(id));
  const newOnes = currentObjectIds.filter((id) => !savedSet.has(id));
  // New objects go to the end (front of stack)
  return [...preserved, ...newOnes];
}
