"use client";

import { Input } from "./input";
import { Select } from "./select";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

export function FormField({ 
  label, 
  required, 
  error, 
  className, 
  children 
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className="block text-sm font-medium text-gray-300">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
      {error && (
        <div className="text-xs text-red-400">{error}</div>
      )}
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number | string;
  onChange: (value: number) => void;
  required?: boolean;
  error?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export function NumberField({
  label,
  value,
  onChange,
  required,
  error,
  min,
  max,
  step,
  className
}: NumberFieldProps) {
  return (
    <FormField label={label} required={required} error={error} className={className}>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        error={!!error}
        min={min}
        max={max}
        step={step}
      />
    </FormField>
  );
}

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  className?: string;
}

export function ColorField({
  label,
  value,
  onChange,
  required,
  error,
  className
}: ColorFieldProps) {
  return (
    <FormField label={label} required={required} error={error} className={className}>
      <Input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={!!error}
        className="h-12"
      />
    </FormField>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  error?: string;
  className?: string;
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  required,
  error,
  className
}: SelectFieldProps) {
  return (
    <FormField label={label} required={required} error={error} className={className}>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </FormField>
  );
}