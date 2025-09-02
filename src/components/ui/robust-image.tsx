"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import type { ImageProps } from "next/image";
import { cn } from "@/lib/utils";
import { ImageOff } from "lucide-react";

export type RobustImageVariant = "thumbnail" | "avatar" | "preview" | "asset";

export interface RobustImageProps
  extends Omit<
    ImageProps,
    | "src"
    | "alt"
    | "width"
    | "height"
    | "onError"
    | "onLoadingComplete"
    | "priority"
    | "fill"
    | "className"
  > {
  src: string;
  alt: string;
  className?: string;
  variant?: RobustImageVariant;
  width?: number;
  height?: number;
  showLoadingState?: boolean;
  fallbackText?: string;
  initials?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  onLoadingComplete?: (img: HTMLImageElement) => void;
  priority?: boolean;
  fill?: boolean;
}

const BLUR_DATA_URLS = {
  thumbnail:
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRjNGNEY2Ii8+PC9zdmc+",
  avatar:
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIyMCIgZmlsbD0iI0YzQzRDNEiLz48L3N2Zz4=",
  preview:
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRjNGNEY2Ii8+PC9zdmc+",
  asset:
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRjNGNEY2Ii8+PC9zdmc+",
} as const;

function getDefaultDimensions(variant: RobustImageVariant): {
  width: number;
  height: number;
} {
  switch (variant) {
    case "thumbnail":
      return { width: 200, height: 200 };
    case "avatar":
      return { width: 40, height: 40 };
    case "preview":
      return { width: 800, height: 600 };
    case "asset":
      return { width: 48, height: 48 };
    default:
      return { width: 200, height: 200 };
  }
}

function renderFallback(
  variant: RobustImageVariant,
  fallbackText?: string,
  initials?: string,
  className?: string,
) {
  const baseClasses = "flex items-center justify-center bg-[var(--surface-2)]";

  switch (variant) {
    case "avatar":
      if (initials) {
        return (
          <div
            className={cn(
              baseClasses,
              "bg-[var(--accent-primary)] text-xs font-medium text-[var(--text-on-accent)]",
              className,
            )}
          >
            {initials}
          </div>
        );
      }
      return (
        <div className={cn(baseClasses, className)}>
          <ImageOff size={16} className="text-[var(--text-tertiary)]" />
        </div>
      );

    case "preview":
      return (
        <div
          className={cn(
            baseClasses,
            "flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border-primary)]",
            className,
          )}
        >
          <ImageOff size={24} className="text-[var(--text-tertiary)]" />
          <span className="text-xs text-[var(--text-tertiary)]">
            {fallbackText ?? "Failed to load image"}
          </span>
        </div>
      );

    default:
      return (
        <div className={cn(baseClasses, className)}>
          <ImageOff size={16} className="text-[var(--text-tertiary)]" />
        </div>
      );
  }
}

export function RobustImage({
  src,
  alt,
  className,
  variant = "thumbnail",
  width,
  height,
  showLoadingState = true,
  fallbackText,
  initials,
  onError,
  onLoadingComplete,
  priority = false,
  fill = false,
  ...props
}: RobustImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      setHasError(true);
      setIsLoading(false);
      console.warn(`[RobustImage] Failed to load ${variant}: ${src}`);
      onError?.(e);
    },
    [src, variant, onError],
  );

  const handleLoadingComplete = useCallback(
    (img: HTMLImageElement) => {
      setIsLoading(false);
      setHasError(false);
      onLoadingComplete?.(img);
    },
    [onLoadingComplete],
  );

  // Use provided dimensions or defaults
  const dimensions =
    width && height ? { width, height } : getDefaultDimensions(variant);

  if (hasError) {
    return renderFallback(variant, fallbackText, initials, className);
  }

  const imageElement = (
    <Image
      src={src}
      alt={alt}
      width={fill ? undefined : dimensions.width}
      height={fill ? undefined : dimensions.height}
      fill={fill}
      className={cn(
        className,
        showLoadingState && isLoading ? "opacity-0" : "opacity-100",
        "transition-opacity duration-200",
      )}
      onError={handleError}
      onLoadingComplete={handleLoadingComplete}
      priority={priority}
      placeholder="blur"
      blurDataURL={BLUR_DATA_URLS[variant]}
      {...props}
    />
  );

  if (showLoadingState && isLoading) {
    return (
      <div className="relative">
        {variant === "avatar" ? (
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center rounded-full bg-[var(--surface-2)]",
              className,
            )}
          >
            <div className="h-4 w-4 animate-pulse rounded-full bg-[var(--text-tertiary)]" />
          </div>
        ) : (
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center bg-[var(--surface-2)]",
              className,
            )}
          >
            <div className="h-4 w-4 animate-pulse rounded-full bg-[var(--text-tertiary)]" />
          </div>
        )}
        {imageElement}
      </div>
    );
  }

  return imageElement;
}
