'use client';

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { Handle, Position } from 'reactflow';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const PORT_ZONE_MIN_WIDTH = 64;
const PORT_ZONE_MAX_WIDTH = 168;
const PORT_ZONE_PADDING = 12;
const HANDLE_BASE_CLASS = 'h-3 w-3 !border-2 !border-[var(--text-primary)]';
const TITLE_LINE_CLAMP_STYLE: CSSProperties = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  overflow: 'hidden',
};

export interface PortConfig {
  id: string;
  label: string;
  handleClassName: string;
  tooltip?: string;
  badge?: string;
  icon?: ReactNode;
  badgeClassName?: string;
  labelClassName?: string;
  handleProps?: HTMLAttributes<HTMLDivElement>;
}

interface NodeLayoutProps {
  selected: boolean;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  iconClassName: string;
  inputs: PortConfig[];
  outputs: PortConfig[];
  children?: ReactNode;
  footer?: ReactNode;
  onDoubleClick?: () => void;
  className?: string;
  headerAccessory?: ReactNode;
  measureDeps?: Array<string | number | boolean | null | undefined>;
}

interface PortBadgeProps {
  side: 'input' | 'output';
  config: PortConfig;
  onRef: (element: HTMLDivElement | null) => void;
}

const lineClampStyle: CSSProperties = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  overflow: 'hidden',
};

function PortBadge({ side, config, onRef }: PortBadgeProps) {
  const { badge, icon, label, tooltip, badgeClassName, labelClassName } = config;
  const displayBadge = icon ?? badge;
  const shouldRenderBadge = displayBadge !== undefined && displayBadge !== null && displayBadge !== '';
  return (
    <div
      ref={onRef}
      className={cn(
        'flex min-h-[26px] min-w-0 max-w-full items-center gap-[var(--space-1)] rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-[var(--space-2)] py-[var(--space-1)] text-xs text-[var(--text-primary)] shadow-[0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-[2px]',
        side === 'input' ? 'justify-end text-right' : 'justify-start text-left',
        badgeClassName,
      )}
      title={tooltip ?? label}
    >
      {shouldRenderBadge && (
        <span
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-3)] text-[10px] font-medium text-[var(--text-tertiary)]',
            side === 'input' ? 'order-first' : 'order-none',
          )}
        >
          {displayBadge}
        </span>
      )}
      <span
        className={cn(
          'max-w-full text-xs leading-snug text-[var(--text-primary)]',
          side === 'input' ? 'text-right' : 'text-left',
          labelClassName,
        )}
        style={lineClampStyle}
      >
        {label}
      </span>
    </div>
  );
}

interface LayoutState {
  leftWidth: number;
  rightWidth: number;
  leftPositions: number[];
  rightPositions: number[];
}

const INITIAL_LAYOUT: LayoutState = {
  leftWidth: 0,
  rightWidth: 0,
  leftPositions: [],
  rightPositions: [],
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function arraysClose(a: number[], b: number[], epsilon = 0.5) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > epsilon) return false;
  }
  return true;
}

export function NodeLayout({
  selected,
  title,
  subtitle,
  icon,
  iconClassName,
  inputs,
  outputs,
  children,
  footer,
  onDoubleClick,
  className,
  headerAccessory,
  measureDeps,
}: NodeLayoutProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const leftBadgeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rightBadgeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const leftRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rightRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [layout, setLayout] = useState<LayoutState>(INITIAL_LAYOUT);

  const hasInputs = inputs.length > 0;
  const hasOutputs = outputs.length > 0;

  const measureKey = useMemo(() => {
    if (!measureDeps || measureDeps.length === 0) return '';
    return measureDeps.map((value) => `${value ?? ''}`).join('|');
  }, [measureDeps]);

  const inputSignature = useMemo(
    () => inputs.map((port) => `${port.id}:${port.label}`).join('|'),
    [inputs],
  );

  const outputSignature = useMemo(
    () => outputs.map((port) => `${port.id}:${port.label}`).join('|'),
    [outputs],
  );

  const updateLayout = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;

    const cardRect = card.getBoundingClientRect();

    let maxLeftWidth = 0;
    let maxRightWidth = 0;

    for (const port of inputs) {
      const badge = leftBadgeRefs.current[port.id];
      if (badge) {
        const width = badge.scrollWidth;
        if (width > maxLeftWidth) maxLeftWidth = width;
      }
    }

    for (const port of outputs) {
      const badge = rightBadgeRefs.current[port.id];
      if (badge) {
        const width = badge.scrollWidth;
        if (width > maxRightWidth) maxRightWidth = width;
      }
    }

    const leftWidth = hasInputs
      ? clamp(Math.ceil(maxLeftWidth) + PORT_ZONE_PADDING, PORT_ZONE_MIN_WIDTH, PORT_ZONE_MAX_WIDTH)
      : 0;
    const rightWidth = hasOutputs
      ? clamp(Math.ceil(maxRightWidth) + PORT_ZONE_PADDING, PORT_ZONE_MIN_WIDTH, PORT_ZONE_MAX_WIDTH)
      : 0;

    const leftPositions = inputs.map((port) => {
      const row = leftRowRefs.current[port.id];
      if (!row) return cardRect.height / 2;
      const rect = row.getBoundingClientRect();
      return rect.top - cardRect.top + rect.height / 2;
    });

    const rightPositions = outputs.map((port) => {
      const row = rightRowRefs.current[port.id];
      if (!row) return cardRect.height / 2;
      const rect = row.getBoundingClientRect();
      return rect.top - cardRect.top + rect.height / 2;
    });

    setLayout((prev) => {
      if (
        prev.leftWidth === leftWidth &&
        prev.rightWidth === rightWidth &&
        arraysClose(prev.leftPositions, leftPositions) &&
        arraysClose(prev.rightPositions, rightPositions)
      ) {
        return prev;
      }
      return {
        leftWidth,
        rightWidth,
        leftPositions,
        rightPositions,
      };
    });
  }, [hasInputs, hasOutputs, inputs, outputs]);

  useLayoutEffect(() => {
    let frame: number | null = null;
    const runMeasure = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        updateLayout();
        frame = null;
      });
    };

    runMeasure();

    if (cardRef.current && 'ResizeObserver' in window) {
      const observer = new ResizeObserver(() => {
        runMeasure();
      });
      observer.observe(cardRef.current);
      return () => {
        observer.disconnect();
        if (frame) cancelAnimationFrame(frame);
      };
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [updateLayout, inputSignature, outputSignature, measureKey, subtitle]);

  const gridTemplateColumns = useMemo(() => {
    const columns: string[] = [];
    if (hasInputs) columns.push(`${Math.max(layout.leftWidth, PORT_ZONE_MIN_WIDTH)}px`);
    columns.push('minmax(0, 1fr)');
    if (hasOutputs) columns.push(`${Math.max(layout.rightWidth, PORT_ZONE_MIN_WIDTH)}px`);
    return columns.join(' ');
  }, [hasInputs, hasOutputs, layout.leftWidth, layout.rightWidth]);

  const handleLeftTop = (index: number) => {
    if (!hasInputs || !layout.leftPositions.length) return '50%';
    return `${layout.leftPositions[index]}px`;
  };

  const handleRightTop = (index: number) => {
    if (!hasOutputs || !layout.rightPositions.length) return '50%';
    return `${layout.rightPositions[index]}px`;
  };

  return (
    <Card
      ref={cardRef}
      selected={selected}
      onDoubleClick={onDoubleClick}
      className={cn('min-w-[var(--node-min-width)] p-[var(--card-padding)]', className)}
    >
      {hasInputs &&
        inputs.map((port, index) => (
          <Handle
            key={port.id}
            type="target"
            position={Position.Left}
            id={port.id}
            className={cn(HANDLE_BASE_CLASS, port.handleClassName)}
            style={{ top: handleLeftTop(index), transform: 'translateY(-50%)' }}
            {...port.handleProps}
          />
        ))}

      {hasOutputs &&
        outputs.map((port, index) => (
          <Handle
            key={port.id}
            type="source"
            position={Position.Right}
            id={port.id}
            className={cn(HANDLE_BASE_CLASS, port.handleClassName)}
            style={{ top: handleRightTop(index), transform: 'translateY(-50%)' }}
            {...port.handleProps}
          />
        ))}

      <div
        className="grid items-stretch gap-x-[var(--space-3)]"
        style={{ gridTemplateColumns }}
      >
        {hasInputs && (
          <div className="flex h-full min-h-[80px] flex-col justify-evenly gap-[var(--space-2)] pr-[var(--space-1)]">
            {inputs.map((port) => (
              <div
                key={port.id}
                ref={(element) => {
                  if (element) {
                    leftRowRefs.current[port.id] = element;
                  } else {
                    delete leftRowRefs.current[port.id];
                  }
                }}
                className="flex w-full justify-end"
              >
                <PortBadge
                  side="input"
                  config={port}
                  onRef={(element) => {
                    if (element) {
                      leftBadgeRefs.current[port.id] = element;
                    } else {
                      delete leftBadgeRefs.current[port.id];
                    }
                  }}
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex min-h-[96px] flex-col gap-[var(--space-3)]">
          <div className="flex flex-col gap-[var(--space-2)]">
            <div className="flex items-start justify-between gap-[var(--space-3)]">
              <div className="flex min-w-0 items-start gap-[var(--space-2)]">
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-primary)]',
                    iconClassName,
                  )}
                >
                  {icon}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--text-primary)]" title={title}>
                    {title}
                  </div>
                  {subtitle ? (
                    <div
                      className="mt-[2px] text-xs text-[var(--text-secondary)]"
                      style={TITLE_LINE_CLAMP_STYLE}
                      title={subtitle}
                    >
                      {subtitle}
                    </div>
                  ) : null}
                </div>
              </div>
              {headerAccessory ? (
                <div className="shrink-0 text-xs text-[var(--text-tertiary)]">{headerAccessory}</div>
              ) : null}
            </div>
          </div>

          {children ? (
            <div className="flex flex-col gap-[var(--space-2)] text-xs text-[var(--text-secondary)]">
              {children}
            </div>
          ) : null}

          {footer ? <div className="mt-auto text-xs text-[var(--text-tertiary)]">{footer}</div> : null}
        </div>

        {hasOutputs && (
          <div className="flex h-full min-h-[80px] flex-col justify-evenly gap-[var(--space-2)] pl-[var(--space-1)]">
            {outputs.map((port) => (
              <div
                key={port.id}
                ref={(element) => {
                  if (element) {
                    rightRowRefs.current[port.id] = element;
                  } else {
                    delete rightRowRefs.current[port.id];
                  }
                }}
                className="flex w-full justify-start"
              >
                <PortBadge
                  side="output"
                  config={port}
                  onRef={(element) => {
                    if (element) {
                      rightBadgeRefs.current[port.id] = element;
                    } else {
                      delete rightBadgeRefs.current[port.id];
                    }
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
