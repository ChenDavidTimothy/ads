import type { NodePortDisplay, NodePortBadgeTone } from './node-layout';
import type { PortDefinition } from '@/shared/types/ports';

export interface PortOverride
  extends Partial<Omit<NodePortDisplay, 'id' | 'label' | 'badge' | 'badgeTone'>> {
  label?: string;
  badge?: string;
  badgeTone?: NodePortBadgeTone;
  description?: string;
}

export type PortOverrides = Record<string, PortOverride>;

export function buildPortDisplays(
  ports: PortDefinition[] | undefined,
  side: 'input' | 'output',
  overrides: PortOverrides = {}
): NodePortDisplay[] {
  if (!ports || ports.length === 0) return [];

  return ports.map((port) => {
    const override = overrides[port.id] ?? {};
    const defaultLabel = port.label.trim();
    const label = override.label ?? defaultLabel;

    return {
      id: port.id,
      label,
      description: override.description ?? label,
      badge: override.badge ?? (side === 'input' ? 'In' : 'Out'),
      badgeTone: override.badgeTone ?? (side === 'input' ? 'neutral' : 'accent'),
      icon: override.icon,
      handleClassName: override.handleClassName,
    } satisfies NodePortDisplay;
  });
}
