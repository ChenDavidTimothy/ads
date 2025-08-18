// src/hooks/use-notifications.ts
"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";

export type NotificationType = 'info' | 'warning' | 'error' | 'success';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // Use a ref to maintain a counter across re-renders
  const notificationCounter = React.useRef(0);

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    // Use incremental counter for guaranteed uniqueness and better performance
    const id = `toast-${++notificationCounter.current}`;
    
    // Prevent counter overflow (unlikely but safe)
    if (notificationCounter.current > Number.MAX_SAFE_INTEGER - 1000) {
      notificationCounter.current = 0;
    }
    
    // Validate notification data
    if (!notification.title || typeof notification.title !== 'string') {
      console.warn('Invalid notification title:', notification.title);
      return;
    }
    
    const newNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration ?? (notification.persistent ? 0 : 5000),
    };

    setNotifications(prev => {
      // Limit to maximum 50 notifications to prevent memory issues
      const maxNotifications = 50;
      const newNotifications = [...prev, newNotification];
      
      if (newNotifications.length > maxNotifications) {
        // Remove oldest notifications, keeping the most recent
        return newNotifications.slice(-maxNotifications);
      }
      
      return newNotifications;
    });

    if ((newNotification.duration ?? 0) > 0) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, newNotification.duration ?? 0);
    }
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      addNotification, 
      removeNotification, 
      clearAll 
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }

  const { addNotification } = context;

  const toast = {
    success: (title: string, message?: string) => 
      addNotification({ type: 'success', title, message }),
    error: (title: string, message?: string) => 
      addNotification({ type: 'error', title, message }),
    warning: (title: string, message?: string) => 
      addNotification({ type: 'warning', title, message }),
    info: (title: string, message?: string) => 
      addNotification({ type: 'info', title, message }),
  };

  return { ...context, toast };
}