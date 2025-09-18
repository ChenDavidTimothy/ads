import type { ReactNode } from 'react';

interface InspectorLayoutProps {
  title: string;
  sidebar: ReactNode;
  content: ReactNode;
  properties: ReactNode;
  onBack: () => void;
  headerIcon?: ReactNode;
  propertiesTitle?: string;
  headerHeightClassName?: string;
}

export function InspectorLayout({
  title,
  sidebar,
  content,
  properties,
  onBack,
  headerIcon,
  propertiesTitle = 'Properties',
  headerHeightClassName = 'h-12',
}: InspectorLayoutProps) {
  return (
    <div className="flex h-full">
      <div className="w-[var(--sidebar-width)] border-r border-[var(--border-primary)] bg-[var(--surface-1)] p-[var(--space-3)]">
        <div className="space-y-[var(--space-3)]">{sidebar}</div>
      </div>

      <div className="flex flex-1 flex-col">
        <div
          className={`flex ${headerHeightClassName} items-center justify-between border-b border-[var(--border-primary)] bg-[var(--surface-1)]/60 px-[var(--space-4)]`}
        >
          <div className="flex items-center gap-3">
            {headerIcon}
            <div className="font-medium text-[var(--text-primary)]">{title}</div>
          </div>
          <button
            className="cursor-pointer text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            onClick={onBack}
          >
            Back to Workspace
          </button>
        </div>

        <div className="flex-1 p-[var(--space-4)]">{content}</div>
      </div>

      <div className="w-[var(--sidebar-width)] overflow-y-auto border-l border-[var(--border-primary)] bg-[var(--surface-1)] p-[var(--space-4)]">
        <h3 className="mb-[var(--space-4)] text-lg font-semibold text-[var(--text-primary)]">
          {propertiesTitle}
        </h3>
        {properties}
      </div>
    </div>
  );
}
