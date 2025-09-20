'use client';

import { useMemo, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { Handle, Position } from 'reactflow';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const PORT_ZONE_SIZE = 28; // Compact width for hoverable port zones
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

function PortBadge({ side, config, onRef }: PortBadgeProps) {
  const { badge, icon, label, tooltip } = config;

  const directionLabel = side === 'input' ? 'Input' : 'Output';
  const description = tooltip ?? label;
  const tooltipSections = [`${directionLabel} • ${label}`];

  if (description && description !== label) {
    tooltipSections.push(description);
  }

  const tooltipText = tooltipSections.join('\n');
  const accessibleLabel = tooltipSections.join('. ');

  const indicator = icon ? (
    <span
      className="pointer-events-none text-[var(--text-tertiary)] transition-colors duration-[var(--duration-fast)] group-hover:text-[var(--text-primary)]"
      aria-hidden="true"
    >
      {icon}
    </span>
  ) : badge ? (
    <span
      className="pointer-events-none inline-flex h-2 w-2 items-center justify-center rounded-full bg-[var(--surface-3)] text-[8px] font-semibold text-[var(--text-tertiary)] transition-colors duration-[var(--duration-fast)] group-hover:bg-[var(--accent-primary)] group-hover:text-[var(--text-primary)]"
      aria-hidden="true"
    >
      {badge}
    </span>
  ) : (
    <span
      className="pointer-events-none block h-2 w-2 rounded-full bg-[var(--text-tertiary)] transition-transform duration-[var(--duration-fast)] group-hover:scale-110 group-hover:bg-[var(--accent-primary)]"
      aria-hidden="true"
    />
  );

  return (
    <div
      ref={onRef}
      className={cn(
        'port-badge group text-[10px] font-medium focus-visible:outline-none',
        side === 'input' ? 'ml-auto' : 'mr-auto'
      )}
      data-direction={side}
      data-tooltip={tooltipText}
      aria-label={accessibleLabel}
      tabIndex={0}
    >
      {indicator}
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

  // Static layout calculation - compact width for port zones
  const gridTemplateColumns = useMemo(() => {
    const columns: string[] = [];
    if (hasInputs) columns.push(`${PORT_ZONE_SIZE}px`);
    columns.push('minmax(0, 1fr)');
    if (hasOutputs) columns.push(`${PORT_ZONE_SIZE}px`);
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
      variant="glass"
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
