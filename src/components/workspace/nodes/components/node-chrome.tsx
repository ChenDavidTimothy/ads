'use client';

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

export function NodeCard({ selected, className, children, ...props }: NodeCardProps) {
  return (
    <Card
      selected={selected}
      className={cn(
        'relative min-w-[var(--node-min-width)] overflow-hidden px-[var(--space-5)] py-[var(--space-4)]',
        'flex flex-col gap-[var(--space-3)]',
        'shadow-[0_12px_28px_rgba(0,0,0,0.45)]',
        className
      )}
      {...props}
    >
      {children}
    </Card>
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
    <div className="flex items-start justify-between gap-[var(--space-2)]">
      <div className="flex min-w-0 items-start gap-[var(--space-2)]">
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--text-primary)] shadow-[0_0_0_1px_rgba(255,255,255,0.08)]',
            accentClassName
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm leading-tight font-semibold text-[var(--text-primary)]">
            {title}
          </div>
          {subtitle ? (
            <div className="text-[10px] tracking-[0.18em] text-[var(--text-tertiary)] uppercase">
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
      {meta ? <div className="shrink-0 text-xs text-[var(--text-secondary)]">{meta}</div> : null}
    </div>
  );
}

interface NodePortIndicatorProps {
  id: string;
  side: 'left' | 'right';
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
  'inline-flex items-center gap-[var(--space-1)] rounded-full px-[var(--space-2)] py-[var(--space-1)] text-[10px] font-semibold uppercase tracking-[0.08em]';

const LABEL_BASE_CLASS =
  'pointer-events-none absolute z-[2] flex max-w-[11.5rem] -translate-y-1/2 flex-col gap-[var(--space-1)] leading-tight';

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
  const labelPosition: CSSProperties =
    side === 'left'
      ? { top, left: 'calc(var(--space-4) + 1.35rem)' }
      : { top, right: 'calc(var(--space-4) + 1.35rem)' };
  const containerAlignment = side === 'left' ? 'items-start text-left' : 'items-end text-right';
  const directionGlyph = icon ?? (
    <span aria-hidden="true" className="text-[0.65rem] leading-none">
      {side === 'left' ? '⟵' : '⟶'}
    </span>
  );
  const accentVisuals = getNodeCategoryVisuals(accent);
  const resolvedBadgeClass = badgeClassName ?? accentVisuals.badge;

  return (
    <>
      <Handle
        id={id}
        type={type}
        position={position}
        className={cn(HANDLE_BASE_CLASS, handleClassName)}
        style={{ top }}
        aria-label={ariaLabel ?? `${type === 'target' ? 'Input' : 'Output'} • ${label}`}
        onDoubleClick={onHandleDoubleClick}
      />
      <div className={cn(LABEL_BASE_CLASS, containerAlignment)} style={labelPosition}>
        <span className={cn(BADGE_BASE_CLASS, resolvedBadgeClass)}>
          {directionGlyph}
          <span>{label}</span>
        </span>
        {description ? (
          <span className="text-[11px] font-medium text-[var(--text-secondary)]">
            {description}
          </span>
        ) : null}
      </div>
    </>
  );
}
