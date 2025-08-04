"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, selected, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-gray-800 border-2 rounded-lg transition-colors",
          selected ? "border-blue-500" : "border-gray-600",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-4 pb-2", className)} {...props} />
  )
);

CardHeader.displayName = "CardHeader";

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-4 pt-0", className)} {...props} />
  )
);

CardContent.displayName = "CardContent";