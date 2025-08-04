"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-md bg-gray-700 border px-3 py-2 text-white text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors",
          error 
            ? "border-red-500 focus:ring-red-500" 
            : "border-gray-600 focus:ring-blue-500",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";