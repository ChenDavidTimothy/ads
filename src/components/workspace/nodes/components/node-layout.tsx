'use client';

import { useMemo, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { Handle, Position } from 'reactflow';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const PORT_ZONE_WIDTH = 120; // Fixed width for all port zones
const HANDLE_BASE_CLASS = 'h-3 w-3 !border-2 !border-[var(--text-primary)]';
const TITLE_LINE_CLAMP_STYLE: CSSProperties = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  overflow: 'hidden',
};

// No-op function for unused refs in static layout
const noop = () => {
  // Intentionally empty - static layout doesn't need refs
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
  const shouldRenderBadge =
    displayBadge !== undefined && displayBadge !== null && displayBadge !== '';
  return (
    <div
      ref={onRef}
      className={cn(
        'flex min-h-[26px] max-w-full min-w-0 items-center gap-[var(--space-1)] rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-[var(--space-2)] py-[var(--space-1)] text-xs text-[var(--text-primary)] shadow-[0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-[2px]',
        side === 'input' ? 'justify-end text-right' : 'justify-start text-left',
        badgeClassName
      )}
      title={tooltip ?? label}
    >
      {shouldRenderBadge && (
        <span
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-3)] text-[10px] font-medium text-[var(--text-tertiary)]',
            side === 'input' ? 'order-first' : 'order-none'
          )}
        >
          {displayBadge}
        </span>
      )}
      <span
        className={cn(
          'max-w-full text-xs leading-snug text-[var(--text-primary)]',
          side === 'input' ? 'text-right' : 'text-left',
          labelClassName
        )}
        style={lineClampStyle}
      >
        {label}
      </span>
    </div>
  );
}

// Layout is now static - removed dynamic state

// Removed unused utility functions - layout is now static

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
}: NodeLayoutProps) {
  // Static layout - no refs or state needed

  const hasInputs = inputs.length > 0;
  const hasOutputs = outputs.length > 0;

  // No complex signatures needed - layout is static

  // Static layout calculation - fixed width for all cases
  const gridTemplateColumns = useMemo(() => {
    const columns: string[] = [];
    if (hasInputs) columns.push(`${PORT_ZONE_WIDTH}px`);
    columns.push('minmax(0, 1fr)');
    if (hasOutputs) columns.push(`${PORT_ZONE_WIDTH}px`);
    return columns.join(' ');
  }, [hasInputs, hasOutputs]);

  // Simple handle positioning for common port counts
  const handleLeftTop = (index: number) => {
    if (!hasInputs) return '50%';
    const totalPorts = inputs.length;

    // Simple positioning for common cases
    if (totalPorts === 1) return '50%';
    if (totalPorts === 2) return index === 0 ? '33%' : '67%';
    if (totalPorts === 3) return index === 0 ? '25%' : index === 1 ? '50%' : '75%';

    // Fallback for more ports
    return `${((index + 1) / (totalPorts + 1)) * 100}%`;
  };

  const handleRightTop = (index: number) => {
    if (!hasOutputs) return '50%';
    const totalPorts = outputs.length;

    // Simple positioning for common cases
    if (totalPorts === 1) return '50%';
    if (totalPorts === 2) return index === 0 ? '33%' : '67%';
    if (totalPorts === 3) return index === 0 ? '25%' : index === 1 ? '50%' : '75%';

    // Fallback for more ports
    return `${((index + 1) / (totalPorts + 1)) * 100}%`;
  };

  return (
    <Card
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

      <div className="grid items-stretch gap-x-[var(--space-3)]" style={{ gridTemplateColumns }}>
        {hasInputs && (
          <div className="flex h-full min-h-[80px] flex-col justify-evenly gap-[var(--space-2)] pr-[var(--space-1)]">
            {inputs.map((port) => (
              <div key={port.id} className="flex w-full justify-end">
                <PortBadge side="input" config={port} onRef={noop} />
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
                    iconClassName
                  )}
                >
                  {icon}
                </div>
                <div className="min-w-0">
                  <div
                    className="truncate text-sm font-semibold text-[var(--text-primary)]"
                    title={title}
                  >
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
                <div className="shrink-0 text-xs text-[var(--text-tertiary)]">
                  {headerAccessory}
                </div>
              ) : null}
            </div>
          </div>

          {children ? (
            <div className="flex flex-col gap-[var(--space-2)] text-xs text-[var(--text-secondary)]">
              {children}
            </div>
          ) : null}

          {footer ? (
            <div className="mt-auto text-xs text-[var(--text-tertiary)]">{footer}</div>
          ) : null}
        </div>

        {hasOutputs && (
          <div className="flex h-full min-h-[80px] flex-col justify-evenly gap-[var(--space-2)] pl-[var(--space-1)]">
            {outputs.map((port) => (
              <div key={port.id} className="flex w-full justify-start">
                <PortBadge side="output" config={port} onRef={noop} />
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
