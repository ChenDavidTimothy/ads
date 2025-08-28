"use client";

import { DropdownSelect } from "./DropdownSelect";
import { FormField } from "../form-fields";
import { cn } from "@/lib/utils";

interface DropdownFieldProps {
  label: React.ReactNode;
  value: string | undefined;
  onChange: (value: string) => void;
  options: Array<{
    value: string;
    label: string;
    icon?: React.ReactNode;
    hint?: React.ReactNode;
    disabled?: boolean;
  }>;
  required?: boolean;
  error?: string;
  className?: string;
  bindAdornment?: React.ReactNode;
  inputClassName?: string;
  disabled?: boolean;
  variant?: "default" | "glass" | "minimal";
  placeholder?: string;
}

export function DropdownField({
  label,
  value,
  onChange,
  options,
  required = true,
  error,
  className,
  bindAdornment,
  inputClassName,
  disabled,
  variant = "default",
  placeholder,
}: DropdownFieldProps) {
  return (
    <FormField
      label={label}
      required={required}
      error={error}
      className={className}
    >
      <div className="relative">
        <DropdownSelect
          value={value}
          onChange={onChange}
          options={options}
          disabled={disabled}
          className={cn(bindAdornment ? "pr-9" : undefined, inputClassName)}
          variant={variant}
          placeholder={placeholder}
        />
        {bindAdornment && (
          <div className="absolute top-1/2 right-2 z-20 -translate-y-1/2">
            {bindAdornment}
          </div>
        )}
        {disabled && (
          <div className="absolute inset-0 z-10 rounded-[var(--radius-sm)] bg-[var(--surface-3)]" />
        )}
      </div>
    </FormField>
  );
}
