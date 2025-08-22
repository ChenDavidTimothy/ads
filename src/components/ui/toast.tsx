// src/components/ui/toast.tsx
"use client";

import { useNotifications, type Notification } from "@/hooks/use-notifications";
import { Button } from "./button";
import { cn } from "@/lib/utils";

const TOAST_ICONS = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
} as const;

interface ToastItemProps {
  notification: Notification;
  onRemove: (id: string) => void;
}

function ToastItem({ notification, onRemove }: ToastItemProps) {
  const getToastStyle = (type: string) => {
    switch (type) {
      case "success":
        return {
          background: `
            linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, transparent 35%, rgba(34, 211, 238, 0.04) 100%),
            linear-gradient(145deg, rgba(16, 185, 129, 0.06), transparent),
            rgba(12, 12, 20, 0.88)
          `,
          borderColor: "rgba(16, 185, 129, 0.4)",
          backdropFilter: "blur(20px)",
          boxShadow:
            "0 4px 12px rgba(0, 0, 0, 0.4), 0 0 32px rgba(16, 185, 129, 0.06)",
        };
      case "error":
        return {
          background: `
            linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, transparent 35%, rgba(245, 158, 11, 0.04) 100%),
            linear-gradient(145deg, rgba(239, 68, 68, 0.06), transparent),
            rgba(12, 12, 20, 0.88)
          `,
          borderColor: "rgba(239, 68, 68, 0.4)",
          backdropFilter: "blur(20px)",
          boxShadow:
            "0 4px 12px rgba(0, 0, 0, 0.4), 0 0 32px rgba(239, 68, 68, 0.06)",
        };
      case "warning":
        return {
          background: `
            linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, transparent 35%, rgba(239, 68, 68, 0.04) 100%),
            linear-gradient(145deg, rgba(245, 158, 11, 0.06), transparent),
            rgba(12, 12, 20, 0.88)
          `,
          borderColor: "rgba(245, 158, 11, 0.4)",
          backdropFilter: "blur(20px)",
          boxShadow:
            "0 4px 12px rgba(0, 0, 0, 0.4), 0 0 32px rgba(245, 158, 11, 0.06)",
        };
      case "info":
      default:
        return {
          background: `
            linear-gradient(135deg, rgba(59, 130, 246, 0.18) 0%, transparent 35%, rgba(139, 92, 246, 0.04) 100%),
            linear-gradient(145deg, rgba(59, 130, 246, 0.06), transparent),
            rgba(12, 12, 20, 0.88)
          `,
          borderColor: "rgba(59, 130, 246, 0.4)",
          backdropFilter: "blur(20px)",
          boxShadow:
            "0 4px 12px rgba(0, 0, 0, 0.4), 0 0 32px rgba(59, 130, 246, 0.06)",
        };
    }
  };

  return (
    <div
      className={cn(
        "flex max-w-[500px] min-w-[300px] items-start gap-3 rounded-[var(--radius-md)] border p-[var(--space-4)]",
      )}
      style={getToastStyle(notification.type)}
    >
      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center font-bold">
        {TOAST_ICONS[notification.type]}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-[var(--text-primary)]">
          {notification.title}
        </div>
        {notification.message && (
          <div className="mt-1 text-sm text-[var(--text-secondary)] opacity-90">
            {notification.message}
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(notification.id)}
        className="h-6 w-6 flex-shrink-0 p-0 text-current hover:bg-[color:rgba(255,255,255,0.08)]"
        aria-label="Close"
      >
        ✕
      </Button>
    </div>
  );
}

export function ToastContainer() {
  const { notifications, removeNotification } = useNotifications();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-[var(--space-4)] right-[var(--space-4)] z-50 space-y-[var(--space-2)]">
      {notifications.map((notification) => (
        <ToastItem
          key={notification.id}
          notification={notification}
          onRemove={removeNotification}
        />
      ))}
    </div>
  );
}
