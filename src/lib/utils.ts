import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Debounce function to limit how often a function can be called
 * @param func The function to debounce
 * @param wait The delay in milliseconds
 * @returns A debounced version of the function
 */
// FIX: Replace 'any' with proper generic types
export function debounce<TArgs extends readonly unknown[], TReturn>(
  func: (...args: TArgs) => TReturn,
  wait: number
): (...args: TArgs) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  // FIX: Use TArgs type instead of Parameters<T> with any
  return (...args: TArgs) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    // FIX: Ensure proper type safety by explicitly typing the callback
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}