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
    <span className="node-port-indicator node-port-indicator--icon" aria-hidden="true">
      {icon}
    </span>
  ) : badge ? (
    <span className="node-port-indicator node-port-indicator--badge" aria-hidden="true">
      {badge}
    </span>
  ) : (
    <span className="node-port-indicator node-port-indicator--dot" aria-hidden="true" />
  );

  return (
    <div
      ref={onRef}
      className={cn(
        'port-badge node-port-badge group focus-visible:outline-none',
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
      selected={selected}
      onDoubleClick={onDoubleClick}
      className={cn(
        'node-card group relative isolate min-w-[var(--node-min-width)] overflow-hidden p-0',
        selected && 'node-card--selected',
        className
      )}
    >
      <div className="node-card__halo" aria-hidden="true" />
      <div className="node-card__sheen" aria-hidden="true" />

      <div className="node-card__content" style={{ gridTemplateColumns }}>
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

        {hasInputs && (
          <div className="node-port-column node-port-column--input">
            {inputs.map((port) => (
              <div key={port.id} className="node-port-slot node-port-slot--input">
                <PortBadge side="input" config={port} onRef={noop} />
              </div>
            ))}
          </div>
        )}

        <div className="node-core">
          <div className="node-core__glare" aria-hidden="true" />

          <div className="node-core__inner">
            <div className="flex flex-col gap-[var(--space-2)]">
              <div className="flex items-start justify-between gap-[var(--space-3)]">
                <div className="flex min-w-0 items-start gap-[var(--space-2)]">
                  <div
                    className={cn(
                      'node-core__icon-swatch flex h-9 w-9 shrink-0 items-center justify-center text-[var(--text-primary)]',
                      iconClassName
                    )}
                  >
                    <span className="relative z-[1] flex h-5 w-5 items-center justify-center">{icon}</span>
                  </div>
                  <div className="min-w-0">
                    <div
                      className="truncate text-sm font-semibold tracking-tight text-[var(--text-primary)]"
                      title={title}
                    >
                      {title}
                    </div>
                    {subtitle ? (
                      <div
                        className="mt-[2px] text-xs font-medium text-[var(--text-secondary)]/85"
                        style={TITLE_LINE_CLAMP_STYLE}
                        title={subtitle}
                      >
                        {subtitle}
                      </div>
                    ) : null}
                  </div>
                </div>
                {headerAccessory ? (
                  <div className="shrink-0 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
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
              <div className="node-core__footer mt-auto text-[11px] font-medium text-[var(--text-tertiary)]">
                {footer}
              </div>
            ) : null}
          </div>
        </div>

        {hasOutputs && (
          <div className="node-port-column node-port-column--output">
            {outputs.map((port) => (
              <div key={port.id} className="node-port-slot node-port-slot--output">
                <PortBadge side="output" config={port} onRef={noop} />
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
