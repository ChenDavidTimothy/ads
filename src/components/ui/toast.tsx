// src/components/ui/toast.tsx
"use client";

import { useNotifications, type Notification } from "@/hooks/use-notifications";
import { Button } from "./button";
import { cn } from "@/lib/utils";

const TOAST_STYLES = {
	success: "bg-[var(--surface-2)] border-[var(--success-600)] text-[var(--text-secondary)]",
	error: "bg-[var(--surface-2)] border-[var(--danger-600)] text-[var(--text-secondary)]",  
	warning: "bg-[var(--surface-2)] border-[var(--warning-600)] text-[var(--text-secondary)]",
	info: "bg-[var(--surface-2)] border-[var(--accent-600)] text-[var(--text-secondary)]",
} as const;

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
	return (
		<div
			className={cn(
				"flex items-start gap-3 p-4 rounded-[var(--radius-md)] border shadow-lg min-w-[300px] max-w-[500px]",
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
				className="flex-shrink-0 text-current hover:bg-[color:rgba(255,255,255,0.08)] h-6 w-6 p-0"
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