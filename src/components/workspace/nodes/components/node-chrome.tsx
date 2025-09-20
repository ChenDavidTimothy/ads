'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  ComponentProps,
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from 'react';
import { Handle, Position } from 'reactflow';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { NodeDefinition } from '@/shared/types/definitions';

type NodePortSide = 'left' | 'right';

interface PortState {
  id: string;
  side: NodePortSide;
  preferredTop: number;
  height: number;
  update: (value: number) => void;
}

interface RegisterPortOptions {
  id: string;
  side: NodePortSide;
  preferredTop: number;
  update: (value: number) => void;
}

interface RegisterPortResult {
  unregister: () => void;
  reportSize: (height: number) => void;
}

interface NodeLayoutContextValue {
  registerPort: (options: RegisterPortOptions) => RegisterPortResult;
  getNodeHeight: () => number;
}

const NodeLayoutContext = createContext<NodeLayoutContextValue | null>(null);

const MIN_PORT_HEIGHT = 28;
const MIN_PORT_GAP = 12;
const EDGE_PADDING = 20;

export const NODE_PORT_MIN_HEIGHT = MIN_PORT_HEIGHT;
export const NODE_PORT_MIN_GAP = MIN_PORT_GAP;
export const NODE_PORT_EDGE_PADDING = EDGE_PADDING;

interface LayoutComputation {
  positions: Map<string, number>;
  requiredHeight: number;
}

interface LayoutPortInput {
  id: string;
  preferredTop: number;
  height: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function computePortLayout(
  ports: LayoutPortInput[],
  containerHeight: number,
  {
    minGap = MIN_PORT_GAP,
    edgePadding = EDGE_PADDING,
    minHeight = MIN_PORT_HEIGHT,
  }: { minGap?: number; edgePadding?: number; minHeight?: number } = {}
): LayoutComputation {
  if (ports.length === 0) {
    return { positions: new Map(), requiredHeight: 0 };
  }

  const normalizedPorts = ports
    .map((port) => ({
      id: port.id,
      preferredTop: clamp(port.preferredTop, 0, 1),
      height: Math.max(port.height, minHeight),
    }))
    .sort((a, b) => a.preferredTop - b.preferredTop);

  const requiredHeight = normalizedPorts.reduce((acc, port, index) => {
    const gap = index === 0 ? 0 : minGap;
    return acc + port.height + gap;
  }, edgePadding * 2);

  const layoutHeight = Math.max(containerHeight, requiredHeight);

  const positions = new Map<string, number>();
  const halfHeights: number[] = normalizedPorts.map((port) => port.height / 2);
  const minCenters: number[] = halfHeights.map((half) => edgePadding + half);
  const maxCenters: number[] = halfHeights.map((half) => layoutHeight - edgePadding - half);
  const centers: number[] = normalizedPorts.map((port, index) => {
    const ideal = port.preferredTop * layoutHeight;
    // TypeScript doesn't know arrays have same length, so we use non-null assertion
    const minCenter = minCenters[index]!;
    const maxCenter = maxCenters[index]!;
    return clamp(ideal, minCenter, maxCenter);
  });

  // Forward pass - enforce minimum spacing moving downward
  for (let index = 1; index < centers.length; index += 1) {
    const minAllowed = centers[index - 1]! + halfHeights[index - 1]! + halfHeights[index]! + minGap;
    if (centers[index]! < minAllowed) {
      centers[index] = Math.min(minAllowed, maxCenters[index]!);
    }
  }

  // Backward pass - ensure we respect bottom boundary and pull items upward if needed
  for (let index = centers.length - 2; index >= 0; index -= 1) {
    const maxAllowed = centers[index + 1]! - halfHeights[index + 1]! - halfHeights[index]! - minGap;
    if (centers[index]! > maxAllowed) {
      centers[index] = Math.max(maxAllowed, minCenters[index]!);
    }
  }

  // Final forward normalization to ensure constraints remain satisfied
  for (let index = 1; index < centers.length; index += 1) {
    const minAllowed = centers[index - 1]! + halfHeights[index - 1]! + halfHeights[index]! + minGap;
    if (centers[index]! < minAllowed) {
      centers[index] = minAllowed;
    }
    centers[index] = clamp(centers[index]!, minCenters[index]!, maxCenters[index]!);
  }

  normalizedPorts.forEach((port, index) => {
    positions.set(port.id, centers[index]!);
  });

  return { positions, requiredHeight };
}

// Map node categories to shared visual styling so every node renders with the same
// icon tint, handle color, and port badge treatment.
type NodeCategory = NodeDefinition['execution']['category'];

const CATEGORY_VISUALS: Record<
  NodeCategory,
  {
    iconBg: string;
    handle: string;
    badge: string;
    label: string;
  }
> = {
  animation: {
    iconBg: 'bg-[var(--node-animation)]',
    handle: '!bg-[var(--node-animation)]',
    badge:
      'border border-[rgba(139,92,246,0.45)] bg-[rgba(139,92,246,0.16)] text-[var(--text-primary)]',
    label: 'Animation',
  },
  logic: {
    iconBg: 'bg-[var(--node-logic)]',
    handle: '!bg-[var(--node-logic)]',
    badge:
      'border border-[rgba(59,130,246,0.45)] bg-[rgba(59,130,246,0.16)] text-[var(--text-primary)]',
    label: 'Logic Control',
  },
  geometry: {
    iconBg: 'bg-[var(--node-geometry)]',
    handle: '!bg-[var(--node-geometry)]',
    badge:
      'border border-[rgba(244,114,182,0.45)] bg-[rgba(244,114,182,0.18)] text-[var(--text-primary)]',
    label: 'Shape Source',
  },
  text: {
    iconBg: 'bg-[var(--node-text)]',
    handle: '!bg-[var(--node-text)]',
    badge:
      'border border-[rgba(16,185,129,0.45)] bg-[rgba(16,185,129,0.18)] text-[var(--text-primary)]',
    label: 'Text',
  },
  data: {
    iconBg: 'bg-[var(--node-data)]',
    handle: '!bg-[var(--node-data)]',
    badge:
      'border border-[rgba(34,211,238,0.45)] bg-[rgba(34,211,238,0.16)] text-[var(--text-primary)]',
    label: 'Data',
  },
  timing: {
    iconBg: 'bg-[var(--node-data)]',
    handle: '!bg-[var(--node-data)]',
    badge:
      'border border-[rgba(34,211,238,0.45)] bg-[rgba(34,211,238,0.16)] text-[var(--text-primary)]',
    label: 'Timing',
  },
  image: {
    iconBg: 'bg-[var(--node-image)]',
    handle: '!bg-[var(--node-image)]',
    badge:
      'border border-[rgba(234,179,8,0.45)] bg-[rgba(234,179,8,0.18)] text-[var(--text-primary)]',
    label: 'Media',
  },
  input: {
    iconBg: 'bg-[var(--node-data)]',
    handle: '!bg-[var(--node-data)]',
    badge:
      'border border-[rgba(148,163,184,0.45)] bg-[rgba(148,163,184,0.18)] text-[var(--text-primary)]',
    label: 'Input',
  },
  output: {
    iconBg: 'bg-[var(--node-output)]',
    handle: '!bg-[var(--node-output)]',
    badge:
      'border border-[rgba(167,139,250,0.45)] bg-[rgba(167,139,250,0.18)] text-[var(--text-primary)]',
    label: 'Output',
  },
};

const DEFAULT_VISUAL = CATEGORY_VISUALS.logic;

export function getNodeCategoryVisuals(category?: NodeCategory) {
  return CATEGORY_VISUALS[category ?? 'logic'] ?? DEFAULT_VISUAL;
}

export function getNodeCategoryLabel(category?: NodeCategory) {
  return (CATEGORY_VISUALS[category ?? 'logic'] ?? DEFAULT_VISUAL).label;
}

interface NodeCardProps extends ComponentProps<typeof Card> {
  selected?: boolean;
  children: ReactNode;
}

export function NodeCard({ selected, className, children, style, ...props }: NodeCardProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [ports, setPorts] = useState<Map<string, PortState>>(new Map());
  const previousPositionsRef = useRef<Map<string, number>>(new Map());
  const [cardHeight, setCardHeight] = useState(0);
  const [portDrivenMinHeight, setPortDrivenMinHeight] = useState(0);

  const registerPort = useCallback(
    ({ id, side, preferredTop, update }: RegisterPortOptions): RegisterPortResult => {
      setPorts((previous) => {
        const next = new Map(previous);
        const existing = next.get(id);
        next.set(id, {
          id,
          side,
          preferredTop,
          update,
          height: existing?.height ?? MIN_PORT_HEIGHT,
        });
        return next;
      });

      return {
        unregister: () => {
          previousPositionsRef.current.delete(id);
          setPorts((previous) => {
            if (!previous.has(id)) return previous;
            const next = new Map(previous);
            next.delete(id);
            return next;
          });
        },
        reportSize: (height: number) => {
          setPorts((previous) => {
            const existing = previous.get(id);
            if (!existing) return previous;
            const normalizedHeight = Math.max(height, MIN_PORT_HEIGHT);
            if (Math.abs(existing.height - normalizedHeight) < 0.5) {
              return previous;
            }
            const next = new Map(previous);
            next.set(id, { ...existing, height: normalizedHeight });
            return next;
          });
        },
      };
    },
    []
  );

  useLayoutEffect(() => {
    const element = rootRef.current;
    if (!element) return;

    const measure = () => {
      const nextHeight = element.getBoundingClientRect().height;
      setCardHeight((previous) => (Math.abs(previous - nextHeight) < 0.5 ? previous : nextHeight));
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => {
        window.removeEventListener('resize', measure);
      };
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const nextHeight =
        entry?.borderBoxSize?.[0]?.blockSize ??
        entry?.contentRect?.height ??
        element.getBoundingClientRect().height;

      setCardHeight((previous) => (Math.abs(previous - nextHeight) < 0.5 ? previous : nextHeight));
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  const portsBySide = useMemo(() => {
    const left: PortState[] = [];
    const right: PortState[] = [];

    ports.forEach((port) => {
      if (port.side === 'left') {
        left.push(port);
      } else {
        right.push(port);
      }
    });

    return { left, right };
  }, [ports]);

  useLayoutEffect(() => {
    const applyLayout = (portGroup: PortState[]) => {
      const { positions, requiredHeight } = computePortLayout(
        portGroup.map((port) => ({
          id: port.id,
          preferredTop: port.preferredTop,
          height: port.height,
        })),
        cardHeight
      );

      return { positions, requiredHeight };
    };

    const leftResult = applyLayout(portsBySide.left);
    const rightResult = applyLayout(portsBySide.right);

    const nextRequiredHeight = Math.max(leftResult.requiredHeight, rightResult.requiredHeight, 0);

    setPortDrivenMinHeight((previous) => {
      if (Math.abs(previous - nextRequiredHeight) < 0.5) {
        return previous;
      }
      return nextRequiredHeight;
    });

    const maybeUpdatePort = (port: PortState, center?: number) => {
      if (typeof center !== 'number' || Number.isNaN(center)) return;
      const previousCenter = previousPositionsRef.current.get(port.id);
      if (previousCenter !== undefined && Math.abs(previousCenter - center) < 0.5) {
        return;
      }
      previousPositionsRef.current.set(port.id, center);
      port.update(center);
    };

    portsBySide.left.forEach((port) => {
      maybeUpdatePort(port, leftResult.positions.get(port.id));
    });
    portsBySide.right.forEach((port) => {
      maybeUpdatePort(port, rightResult.positions.get(port.id));
    });
  }, [portsBySide, cardHeight]);

  const cardStyle = useMemo(() => {
    const baseStyle: CSSProperties = { ...(style ?? {}) };
    if (portDrivenMinHeight > 0) {
      const inlineValue = baseStyle.minHeight;
      let inlineNumeric: number | undefined;
      if (typeof inlineValue === 'number') {
        inlineNumeric = inlineValue;
      } else if (typeof inlineValue === 'string') {
        const parsed = Number.parseFloat(inlineValue);
        inlineNumeric = Number.isNaN(parsed) ? undefined : parsed;
      }
      const finalMinHeight = Math.max(portDrivenMinHeight, inlineNumeric ?? 0);
      baseStyle.minHeight = `${finalMinHeight}px`;
    }
    return baseStyle;
  }, [style, portDrivenMinHeight]);

  const contextValue = useMemo<NodeLayoutContextValue>(
    () => ({
      registerPort,
      getNodeHeight: () => rootRef.current?.getBoundingClientRect().height ?? 0,
    }),
    [registerPort]
  );

  return (
    <NodeLayoutContext.Provider value={contextValue}>
      <Card
        ref={rootRef}
        selected={selected}
        data-node-card-root
        className={cn(
          'relative w-auto max-w-[28rem] min-w-[18rem] px-[var(--space-5)] py-[var(--space-4)]',
          'flex flex-col gap-[var(--space-3)]',
          'shadow-[0_12px_28px_rgba(0,0,0,0.45)]',
          className
        )}
        style={cardStyle}
        {...props}
      >
        {children}
      </Card>
    </NodeLayoutContext.Provider>
  );
}

interface NodeHeaderProps {
  icon: ReactNode;
  title: string;
  accentClassName: string;
  subtitle?: string;
  meta?: ReactNode;
}

export function NodeHeader({ icon, title, accentClassName, subtitle, meta }: NodeHeaderProps) {
  return (
    <div className="flex items-start gap-[var(--space-2)]">
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--text-primary)] shadow-[0_0_0_1px_rgba(255,255,255,0.08)]',
          accentClassName
        )}
        aria-hidden="true"
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="truncate text-sm leading-tight font-semibold text-[var(--text-primary)]"
          title={title}
        >
          {title}
        </div>
        {subtitle ? (
          <div className="text-[10px] tracking-[0.18em] text-[var(--text-tertiary)] uppercase">
            {subtitle}
          </div>
        ) : null}
      </div>
      {meta ? (
        <div className="ml-auto shrink-0 text-xs text-[var(--text-secondary)]">{meta}</div>
      ) : null}
    </div>
  );
}

interface NodePortIndicatorProps {
  id: string;
  side: NodePortSide;
  top: string;
  type: 'source' | 'target';
  label: string;
  description?: string;
  handleClassName: string;
  badgeClassName?: string;
  accent?: NodeCategory;
  icon?: ReactNode;
  ariaLabel?: string;
  onHandleDoubleClick?: (event: ReactMouseEvent<HTMLDivElement>) => void;
}

const HANDLE_BASE_CLASS =
  'absolute z-[3] h-3 w-3 rounded-full !border-2 !border-[rgba(255,255,255,0.9)] shadow-[0_0_0_3px_rgba(0,0,0,0.4)]';

const BADGE_BASE_CLASS =
  'inline-flex min-w-0 flex-wrap items-center gap-[var(--space-1)] rounded-full px-[var(--space-2)] py-[var(--space-1)] text-[10px] font-semibold uppercase tracking-[0.08em] text-left';

const LABEL_BASE_CLASS =
  'pointer-events-none absolute z-[2] flex max-w-[var(--node-port-label-max,16rem)] -translate-y-1/2 flex-col gap-[var(--space-1)] leading-snug';

const PORT_LABEL_TEXT_CLASS =
  'min-w-0 whitespace-normal text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-primary)]';

const DESCRIPTION_TEXT_CLASS = 'text-[11px] font-medium text-[var(--text-secondary)]';

const LABEL_OFFSET = 'calc(var(--space-4) + 0.75rem)';

const LABEL_CLAMP_STYLE: CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

const DESCRIPTION_CLAMP_STYLE: CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

function normalizePreferredTop(value: string) {
  const raw = value?.trim?.() ?? '';
  if (raw.endsWith('%')) {
    const numeric = Number.parseFloat(raw.slice(0, -1));
    if (!Number.isNaN(numeric)) {
      return clamp(numeric / 100, 0, 1);
    }
  }
  const numeric = Number.parseFloat(raw);
  if (!Number.isNaN(numeric)) {
    if (numeric > 1) {
      return clamp(numeric / 100, 0, 1);
    }
    return clamp(numeric, 0, 1);
  }
  return 0.5;
}

export function NodePortIndicator({
  id,
  side,
  top,
  type,
  label,
  description,
  handleClassName,
  badgeClassName,
  accent,
  icon,
  ariaLabel,
  onHandleDoubleClick,
}: NodePortIndicatorProps) {
  const position = side === 'left' ? Position.Left : Position.Right;
  const alignmentClass = side === 'left' ? 'items-start text-left' : 'items-end text-right';
  const directionGlyph = icon ?? (
    <span aria-hidden="true" className="text-[0.65rem] leading-none">
      {side === 'left' ? '⟵' : '⟶'}
    </span>
  );
  const accentVisuals = getNodeCategoryVisuals(accent);
  const resolvedBadgeClass = badgeClassName ?? accentVisuals.badge;
  const layoutContext = useContext(NodeLayoutContext);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const [computedTop, setComputedTop] = useState<string>(top);

  useEffect(() => {
    setComputedTop(top);
  }, [top]);

  useLayoutEffect(() => {
    if (!layoutContext) return;

    const update = (value: number) => {
      const pixelValue = `${Math.round(value * 1000) / 1000}px`;
      setComputedTop((previous) => (previous === pixelValue ? previous : pixelValue));
    };

    const { unregister, reportSize } = layoutContext.registerPort({
      id,
      side,
      preferredTop: normalizePreferredTop(top),
      update,
    });

    const measure = () => {
      const element = labelRef.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      reportSize(rect.height);
    };

    measure();

    let animationFrame: number | null = null;
    animationFrame = window.requestAnimationFrame(measure);

    let cleanup: (() => void) | undefined;

    if (typeof ResizeObserver !== 'undefined' && labelRef.current) {
      const observer = new ResizeObserver(() => measure());
      observer.observe(labelRef.current);
      cleanup = () => observer.disconnect();
    } else {
      window.addEventListener('resize', measure);
      cleanup = () => {
        window.removeEventListener('resize', measure);
      };
    }

    return () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      cleanup?.();
      unregister();
    };
  }, [layoutContext, id, side, top]);

  const labelPosition: CSSProperties =
    side === 'left'
      ? { top: computedTop, left: LABEL_OFFSET }
      : { top: computedTop, right: LABEL_OFFSET };

  return (
    <>
      <Handle
        id={id}
        type={type}
        position={position}
        className={cn(HANDLE_BASE_CLASS, handleClassName)}
        style={{ top: computedTop }}
        aria-label={ariaLabel ?? `${type === 'target' ? 'Input' : 'Output'} • ${label}`}
        onDoubleClick={onHandleDoubleClick}
      />
      <div ref={labelRef} className={cn(LABEL_BASE_CLASS, alignmentClass)} style={labelPosition}>
        <span className={cn(BADGE_BASE_CLASS, resolvedBadgeClass)} title={label}>
          {directionGlyph}
          <span className={PORT_LABEL_TEXT_CLASS} style={LABEL_CLAMP_STYLE}>
            {label}
          </span>
        </span>
        {description ? (
          <span
            className={DESCRIPTION_TEXT_CLASS}
            style={DESCRIPTION_CLAMP_STYLE}
            title={description}
          >
            {description}
          </span>
        ) : null}
      </div>
    </>
  );
}
