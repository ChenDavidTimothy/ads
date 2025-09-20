'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Handle, Position } from 'reactflow';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const PORT_ZONE_GAP = 12;
const MIN_ZONE_WIDTH = 48;
const MAX_ZONE_WIDTH = 176;

export type NodePortBadgeTone =
  | 'neutral'
  | 'accent'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info';

const BADGE_TONE_CLASSES: Record<NodePortBadgeTone, string> = {
  neutral:
    'bg-[var(--surface-2)]/80 text-[var(--text-secondary)] border border-[var(--border-primary)]',
  accent: 'bg-[var(--accent-primary)] text-white',
  success: 'bg-[var(--success-500)] text-white',
  danger: 'bg-[var(--danger-500)] text-white',
  warning: 'bg-[var(--warning-500)] text-[var(--surface-0)]',
  info: 'bg-[var(--accent-secondary)] text-white',
};

export interface NodePortDisplay {
  id: string;
  label: string;
  description?: string;
  badge?: string;
  badgeTone?: NodePortBadgeTone;
  icon?: React.ReactNode;
  handleClassName?: string;
}

export interface NodeLayoutProps {
  title: string;
  subtitle?: string;
  titleTooltip?: string;
  icon?: React.ReactNode;
  iconBackgroundClass?: string;
  iconForegroundClass?: string;
  tag?: string;
  tagTone?: NodePortBadgeTone;
  headerAside?: React.ReactNode;
  inputs: NodePortDisplay[];
  outputs: NodePortDisplay[];
  selected?: boolean;
  className?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  accentHandleClass?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onDoubleClick?: React.MouseEventHandler<HTMLDivElement>;
}

interface LayoutMetrics {
  leftZone: number;
  rightZone: number;
  inputTops: number[];
  outputTops: number[];
}

const INITIAL_METRICS: LayoutMetrics = {
  leftZone: 0,
  rightZone: 0,
  inputTops: [],
  outputTops: [],
};

const deriveHandleClass = (token?: string) => {
  if (!token) return undefined;
  return token
    .split(' ')
    .filter(Boolean)
    .map((part) =>
      part.startsWith('bg-') || part.startsWith('bg[') ? `!${part}` : part
    )
    .join(' ');
};

const nearlyEqual = (a: number, b: number) => Math.abs(a - b) < 0.5;

const arraysEqual = (a: number[], b: number[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (!nearlyEqual(a[i] ?? 0, b[i] ?? 0)) return false;
  }
  return true;
};

function ensureRefLength(ref: React.MutableRefObject<(HTMLDivElement | null)[]>, length: number) {
  if (ref.current.length === length) return;
  const next: (HTMLDivElement | null)[] = [];
  for (let i = 0; i < length; i += 1) {
    next.push(ref.current[i] ?? null);
  }
  ref.current = next;
}

export function NodeLayout({
  title,
  subtitle,
  titleTooltip,
  icon,
  iconBackgroundClass,
  iconForegroundClass,
  tag,
  tagTone = 'neutral',
  headerAside,
  inputs,
  outputs,
  selected,
  className,
  children,
  footer,
  accentHandleClass,
  onClick,
    onDoubleClick,
  }: NodeLayoutProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const inputLabelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const outputLabelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [metrics, setMetrics] = useState<LayoutMetrics>(INITIAL_METRICS);

  ensureRefLength(inputLabelRefs, inputs.length);
  ensureRefLength(outputLabelRefs, outputs.length);

  const setInputRef = useCallback(
    (index: number) => (node: HTMLDivElement | null) => {
      inputLabelRefs.current[index] = node;
    },
    []
  );

  const setOutputRef = useCallback(
    (index: number) => (node: HTMLDivElement | null) => {
      outputLabelRefs.current[index] = node;
    },
    []
  );

  const defaultHandleClass = useMemo(() => {
    if (accentHandleClass) return accentHandleClass;
    return deriveHandleClass(iconBackgroundClass) ?? '!bg-[var(--accent-primary)]';
  }, [accentHandleClass, iconBackgroundClass]);

  const measureLayout = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;

    const cardRect = card.getBoundingClientRect();

    const computeZoneWidth = (refs: (HTMLDivElement | null)[]) => {
      if (!refs.length) return 0;
      const widths = refs.map((ref) => ref?.getBoundingClientRect().width ?? 0);
      const measured = Math.max(...widths, 0);
      const minimum = widths.length > 0 ? MIN_ZONE_WIDTH : 0;
      const desired = Math.max(measured, minimum);
      return Math.min(desired, MAX_ZONE_WIDTH);
    };

    const computeCenters = (refs: (HTMLDivElement | null)[]) => {
      if (!refs.length) return [] as number[];
      return refs.map((ref, index) => {
        if (!ref) {
          return ((index + 1) / (refs.length + 1)) * cardRect.height;
        }
        const rect = ref.getBoundingClientRect();
        return rect.top - cardRect.top + rect.height / 2;
      });
    };

    const leftZone = computeZoneWidth(inputLabelRefs.current);
    const rightZone = computeZoneWidth(outputLabelRefs.current);
    const inputCenters = computeCenters(inputLabelRefs.current);
    const outputCenters = computeCenters(outputLabelRefs.current);

    setMetrics((previous) => {
      if (
        nearlyEqual(previous.leftZone, leftZone) &&
        nearlyEqual(previous.rightZone, rightZone) &&
        arraysEqual(previous.inputTops, inputCenters) &&
        arraysEqual(previous.outputTops, outputCenters)
      ) {
        return previous;
      }

      return {
        leftZone,
        rightZone,
        inputTops: inputCenters,
        outputTops: outputCenters,
      };
    });
  }, []);

  const portsSignature = useMemo(() => {
    const serialize = (port: NodePortDisplay) =>
      [port.id, port.label, port.badge ?? '', port.badgeTone ?? '', port.icon ? '1' : '0'].join('::');
    const inputSignature = inputs.map(serialize).join('||');
    const outputSignature = outputs.map(serialize).join('||');
    return `${inputSignature}__${outputSignature}`;
  }, [inputs, outputs]);

  useLayoutEffect(() => {
    measureLayout();
  }, [measureLayout]);

  useEffect(() => {
    measureLayout();
  }, [measureLayout, portsSignature]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (typeof ResizeObserver === 'undefined') {
      const handleResize = () => {
        measureLayout();
      };
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }

    const card = cardRef.current;
    if (!card) return;

    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        measureLayout();
      });
    });

    observer.observe(card);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [measureLayout]);

  useEffect(() => {
    let cancelled = false;
    if (typeof document !== 'undefined' && 'fonts' in document) {
      void document.fonts.ready.then(() => {
        if (!cancelled) {
          measureLayout();
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [measureLayout]);

  const leftPadding = metrics.leftZone > 0 ? metrics.leftZone + PORT_ZONE_GAP : 0;
  const rightPadding = metrics.rightZone > 0 ? metrics.rightZone + PORT_ZONE_GAP : 0;

  const centerStyle: CSSProperties = {
    paddingTop: 'var(--card-padding)',
    paddingBottom: 'var(--card-padding)',
    paddingLeft: `calc(var(--card-padding) + ${leftPadding}px)`,
    paddingRight: `calc(var(--card-padding) + ${rightPadding}px)`,
  };

  const leftZoneStyle: CSSProperties = {
    top: 'var(--card-padding)',
    bottom: 'var(--card-padding)',
    left: 'var(--card-padding)',
    width: metrics.leftZone > 0 ? `${metrics.leftZone}px` : undefined,
  };

  const rightZoneStyle: CSSProperties = {
    top: 'var(--card-padding)',
    bottom: 'var(--card-padding)',
    right: 'var(--card-padding)',
    width: metrics.rightZone > 0 ? `${metrics.rightZone}px` : undefined,
  };

  const renderPortRow = (
    port: NodePortDisplay,
    index: number,
    side: 'input' | 'output',
    refSetter: (node: HTMLDivElement | null) => void
  ) => {
    const badgeTone = port.badgeTone ?? (side === 'input' ? 'neutral' : 'accent');
    const badge = port.badge ?? (side === 'input' ? 'In' : 'Out');
    const topPositions = side === 'input' ? metrics.inputTops : metrics.outputTops;
    const topValue = topPositions[index];

    return (
      <div
        key={port.id}
        ref={refSetter}
        className={cn(
          'node-port-row relative flex items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] border border-transparent px-[var(--space-2)] py-[var(--space-1)] text-xs transition-colors duration-[var(--duration-fast)] ease-[var(--easing-standard)] hover:border-[var(--border-primary)] hover:bg-[var(--surface-interactive)]/60',
          side === 'output' ? 'flex-row-reverse text-right' : 'text-left'
        )}
        style={{ maxWidth: `${MAX_ZONE_WIDTH}px` }}
        title={port.description ?? port.label}
      >
        <span
          className={cn(
            'inline-flex min-w-[2.5rem] items-center justify-center rounded-full px-[var(--space-2)] py-[var(--space-half)] text-[10px] font-semibold uppercase tracking-wide',
            BADGE_TONE_CLASSES[badgeTone]
          )}
        >
          {badge}
        </span>
        <span
          className={cn(
            'node-port-label flex min-w-0 items-start gap-[var(--space-1)] text-[var(--text-secondary)]',
            side === 'output' ? 'justify-end text-right' : 'justify-start'
          )}
        >
          {port.icon ? <span className="shrink-0 text-[var(--text-secondary)]">{port.icon}</span> : null}
          <span className="node-port-label-text leading-[1.2]">{port.label}</span>
        </span>
        <Handle
          type={side === 'input' ? 'target' : 'source'}
          position={side === 'input' ? Position.Left : Position.Right}
          id={port.id}
          className={cn(
            'node-port-handle h-3 w-3 !border-2 !border-[var(--text-primary)]',
            defaultHandleClass,
            port.handleClassName
          )}
          style={{
            top:
              typeof topValue === 'number'
                ? `${topValue}px`
                : `${((index + 1) / ((side === 'input' ? inputs : outputs).length + 1)) * 100}%`,
          }}
        />
      </div>
    );
  };

  return (
    <Card
      ref={cardRef}
      selected={selected}
      className={cn('relative min-w-[var(--node-min-width)] overflow-visible', className)}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="node-center-zone" style={centerStyle}>
        <div className="flex items-start justify-between gap-[var(--space-2)]">
          <div className="flex min-w-0 flex-1 items-start gap-[var(--space-2)]">
            {icon ? (
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)]',
                  iconBackgroundClass ?? 'bg-[var(--accent-primary)]/20'
                )}
              >
                <div className={cn('text-[var(--text-primary)]', iconForegroundClass)}>{icon}</div>
              </div>
            ) : null}
            <div className="min-w-0 flex-1 space-y-[var(--space-half)]">
              <div className="flex items-center gap-[var(--space-1)]">
                <span
                  className="truncate text-sm font-semibold text-[var(--text-primary)]"
                  title={titleTooltip ?? title}
                >
                  {title}
                </span>
                {tag ? (
                  <span
                    className={cn(
                      'node-header-tag inline-flex items-center rounded-full px-[var(--space-2)] py-[var(--space-half)] text-[10px] font-semibold uppercase tracking-wide',
                      BADGE_TONE_CLASSES[tagTone]
                    )}
                  >
                    {tag}
                  </span>
                ) : null}
              </div>
              {subtitle ? (
                <div className="node-subtitle text-xs text-[var(--text-secondary)]" title={subtitle}>
                  {subtitle}
                </div>
              ) : null}
            </div>
          </div>
          {headerAside ? (
            <div className="ml-[var(--space-2)] shrink-0 text-right text-xs text-[var(--text-tertiary)]">
              {headerAside}
            </div>
          ) : null}
        </div>

        {children ? (
          <div className="node-body space-y-[var(--space-2)] text-xs text-[var(--text-secondary)]">
            {children}
          </div>
        ) : null}

        {footer ? (
          <div className="node-footer pt-[var(--space-2)] text-[10px] text-[var(--text-tertiary)]">
            {footer}
          </div>
        ) : null}
      </div>

      {inputs.length > 0 ? (
        <div
          className="node-port-zone absolute flex flex-col gap-[var(--space-2)]"
          style={leftZoneStyle}
        >
          {inputs.map((port, index) =>
            renderPortRow(port, index, 'input', setInputRef(index))
          )}
        </div>
      ) : null}

      {outputs.length > 0 ? (
        <div
          className="node-port-zone absolute flex flex-col gap-[var(--space-2)]"
          style={rightZoneStyle}
        >
          {outputs.map((port, index) =>
            renderPortRow(port, index, 'output', setOutputRef(index))
          )}
        </div>
      ) : null}
    </Card>
  );
}
