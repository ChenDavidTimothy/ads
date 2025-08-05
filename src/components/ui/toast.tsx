// src/components/ui/toast.tsx
"use client";

import { useNotifications, type Notification } from "@/hooks/use-notifications";
import { Button } from "./button";
import { cn } from "@/lib/utils";

const TOAST_STYLES = {
  success: "bg-green-800 border-green-600 text-green-100",
  error: "bg-red-800 border-red-600 text-red-100",  
  warning: "bg-yellow-800 border-yellow-600 text-yellow-100",
  info: "bg-blue-800 border-blue-600 text-blue-100",
};

const TOAST_ICONS = {
  success: "✓",
  error: "✕", 
  warning: "⚠",
  info: "ℹ",
};

interface ToastItemProps {
  notification: Notification;
  onRemove: (id: string) => void;
}

function ToastItem({ notification, onRemove }: ToastItemProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg border shadow-lg min-w-[300px] max-w-[500px]",
        TOAST_STYLES[notification.type]
      )}
    >
      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center font-bold">
        {TOAST_ICONS[notification.type]}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{notification.title}</div>
        {notification.message && (
          <div className="text-sm opacity-90 mt-1">{notification.message}</div>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(notification.id)}
        className="flex-shrink-0 text-current hover:bg-white/10 h-6 w-6 p-0"
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
    <div className="fixed top-4 right-4 z-50 space-y-2">
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