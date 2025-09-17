'use client';

import { useState, useEffect } from 'react';
import { Input } from './input';
import { DropdownField as UIDropdownField } from './dropdown/DropdownField';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: React.ReactNode;
  required?: boolean;
  error?: string;
  className?: string;
  labelRight?: React.ReactNode;
  children: React.ReactNode;
}

export function FormField({ label, error, className, labelRight, children }: FormFieldProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <label className="block">
        <div className="flex items-center justify-between text-sm font-medium text-[var(--text-secondary)]">
          <span className="truncate">{label}</span>
          {labelRight && (
            <div className="ml-[var(--space-2)] flex shrink-0 items-center gap-[var(--space-1)]">
              {labelRight}
            </div>
          )}
        </div>
      </label>
      {children}
      {error && <div className="text-xs text-[var(--danger-500)]">{error}</div>}
    </div>
  );
}

interface NumberFieldProps {
  label: React.ReactNode;
  value: number | string | undefined;
  onChange: (value: number) => void;
  required?: boolean;
  error?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  className?: string;
  bindAdornment?: React.ReactNode;
  inputClassName?: string;
  disabled?: boolean;
}

export function NumberField({
  label,
  value,
  onChange,
  required = true,
  error: externalError,
  min,
  max,
  step,
  defaultValue,
  className,
  bindAdornment,
  inputClassName,
  disabled,
}: NumberFieldProps) {
  const [inputValue, setInputValue] = useState(value === undefined ? '' : value.toString());
  const [internalError, setInternalError] = useState<string>('');

  // Sync with external value changes
  useEffect(() => {
    setInputValue(value === undefined ? '' : value.toString());
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    if (newValue === '') {
      if (required) {
        setInternalError('This field is required');
      } else {
        setInternalError('');
      }
      // Don't call onChange for empty values
      return;
    }

    const numValue = Number(newValue);

    if (isNaN(numValue)) {
      setInternalError('Please enter a valid number');
      return;
    }

    if (min !== undefined && numValue < min) {
      setInternalError(`Value must be at least ${min}`);
      return;
    }

    if (max !== undefined && numValue > max) {
      setInternalError(`Value must be at most ${max}`);
      return;
    }

    setInternalError('');
    onChange(numValue);
  };

  const handleBlur = () => {
    if (inputValue === '') {
      if (defaultValue !== undefined) {
        setInputValue(defaultValue.toString());
        onChange(defaultValue);
        setInternalError('');
      } else if (required) {
        // Keep the error state for required fields
        return;
      } else {
        // For non-required fields without default, use 0
        setInputValue('0');
        onChange(0);
        setInternalError('');
      }
    }
  };

  const displayError = externalError ?? internalError;

  return (
    <FormField label={label} required={required} error={displayError} className={className}>
      <div className="relative">
        <Input
          type="number"
          value={inputValue}
          onChange={handleChange}
          onBlur={handleBlur}
          error={!!displayError}
          min={min}
          max={max}
          step={step}
          className={cn(bindAdornment ? 'pr-9' : undefined, inputClassName)}
          disabled={disabled}
        />
        {bindAdornment && (
          <div className="absolute top-1/2 right-2 z-20 -translate-y-1/2">{bindAdornment}</div>
        )}
        {disabled && (
          <div className="absolute inset-0 z-10 rounded-[var(--radius-sm)] bg-[var(--surface-3)]" />
        )}
      </div>
    </FormField>
  );
}

interface ColorFieldProps {
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  className?: string;
  bindAdornment?: React.ReactNode;
  inputClassName?: string;
  disabled?: boolean;
}

export function ColorField({
  label,
  value,
  onChange,
  required = true,
  error,
  className,
  bindAdornment,
  inputClassName,
  disabled,
}: ColorFieldProps) {
  return (
    <FormField label={label} required={required} error={error} className={className}>
      <div className="relative">
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          error={!!error}
          className={cn('h-12', bindAdornment ? 'pr-9' : '', inputClassName)}
          disabled={disabled}
        />
        {bindAdornment && (
          <div className="absolute top-1/2 right-2 z-20 -translate-y-1/2">{bindAdornment}</div>
        )}
        {disabled && (
          <div className="absolute inset-0 z-10 rounded-[var(--radius-sm)] bg-[var(--surface-3)]" />
        )}
      </div>
    </FormField>
  );
}

interface SelectFieldProps {
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  error?: string;
  className?: string;
  bindAdornment?: React.ReactNode;
  inputClassName?: string;
  disabled?: boolean;
  variant?: 'default' | 'glass' | 'minimal';
  placeholder?: string;
}

export function SelectField({
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
  variant = 'default',
  placeholder,
}: SelectFieldProps) {
  return (
    <UIDropdownField
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      required={required}
      error={error}
      className={className}
      bindAdornment={bindAdornment}
      inputClassName={inputClassName}
      disabled={disabled}
      variant={variant}
      placeholder={placeholder}
    />
  );
}

interface TextFieldProps {
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  className?: string;
  placeholder?: string;
  bindAdornment?: React.ReactNode;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
  inputClassName?: string;
  disabled?: boolean;
}

export function TextField({
  label,
  value,
  onChange,
  required = true,
  error,
  className,
  placeholder,
  bindAdornment,
  onKeyDown,
  autoFocus,
  inputClassName,
  disabled,
}: TextFieldProps) {
  return (
    <FormField label={label} required={required} error={error} className={className}>
      <div className="relative">
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onKeyDown={onKeyDown}
          autoFocus={autoFocus}
          error={!!error}
          className={cn(bindAdornment ? 'pr-9' : undefined, inputClassName)}
          disabled={disabled}
        />
        {bindAdornment && (
          <div className="absolute top-1/2 right-2 z-20 -translate-y-1/2">{bindAdornment}</div>
        )}
        {disabled && (
          <div className="absolute inset-0 z-10 rounded-[var(--radius-sm)] bg-[var(--surface-3)]" />
        )}
      </div>
    </FormField>
  );
}

interface RangeFieldProps {
  label: React.ReactNode;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  showValue?: boolean;
  showLabels?: boolean;
}

export function RangeField({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  className,
  showValue = true,
  showLabels = true,
}: RangeFieldProps) {
  return (
    <FormField label={label} className={className}>
      <div className="space-y-[var(--space-1)]">
        {showValue && (
          <div className="text-xs text-[var(--text-secondary)]">
            {label}: {value}
          </div>
        )}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full cursor-pointer"
        />
        {showLabels && (
          <div className="flex justify-between text-xs text-[var(--text-muted)]">
            <span>{min}</span>
            <span>{Math.round((min + max) / 2)}</span>
            <span>{max}</span>
          </div>
        )}
      </div>
    </FormField>
  );
}

interface BooleanFieldProps {
  label: React.ReactNode;
  value: boolean;
  onChange: (value: boolean) => void;
  className?: string;
}

export function BooleanField({ label, value, onChange, className }: BooleanFieldProps) {
  return (
    <FormField label="" className={className}>
      <div className="flex items-center gap-[var(--space-2)]">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="cursor-pointer rounded"
        />
        <label className="text-sm text-[var(--text-secondary)]">{label}</label>
      </div>
    </FormField>
  );
}

interface TextareaFieldProps {
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  className?: string;
  placeholder?: string;
  bindAdornment?: React.ReactNode;
  inputClassName?: string;
  disabled?: boolean;
  rows?: number;
}

export function TextareaField({
  label,
  value,
  onChange,
  required = true,
  error,
  className,
  placeholder,
  bindAdornment,
  inputClassName,
  disabled,
  rows = 3,
}: TextareaFieldProps) {
  return (
    <FormField label={label} required={required} error={error} className={className}>
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className={cn(
            // Base textarea styling - follows Input component pattern
            'text-refined w-full cursor-text text-[12px] text-[var(--text-primary)] transition-all',
            'duration-[var(--duration-fast)] ease-[var(--easing-standard)]',
            'placeholder:text-[var(--text-muted)]',
            'border border-[var(--border-primary)] bg-[var(--surface-2)]',
            'rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)]',
            'resize-vertical min-h-[60px]', // Allow vertical resize, min height
            error
              ? 'border-[var(--danger-500)] focus:ring-1 focus:ring-[var(--danger-500)] focus:outline-none'
              : 'focus:ring-1 focus:ring-[var(--ring-color)] focus:outline-none',
            disabled ? 'opacity-60' : undefined,
            bindAdornment ? 'pr-9' : undefined,
            inputClassName
          )}
        />
        {bindAdornment && <div className="absolute top-2 right-2 z-20">{bindAdornment}</div>}
        {disabled && (
          <div className="absolute inset-0 z-10 rounded-[var(--radius-sm)] bg-[var(--surface-3)]" />
        )}
      </div>
    </FormField>
  );
}
