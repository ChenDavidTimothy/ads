"use client";

import { useState, useEffect } from "react";
import { Input } from "./input";
import { Select } from "./select";
import { cn } from "@/lib/utils";

interface FormFieldProps {
	label: React.ReactNode;
	required?: boolean;
	error?: string;
	className?: string;
	labelRight?: React.ReactNode;
	children: React.ReactNode;
}

export function FormField({ 
	label, 
	error, 
	className, 
	labelRight,
	children 
}: FormFieldProps) {
	return (
		<div className={cn("space-y-1", className)}>
			<label className="block">
				<div className="flex items-center justify-between text-sm font-medium text-[var(--text-secondary)]">
					<span className="truncate">{label}</span>
					{labelRight && (
						<div className="flex items-center gap-[var(--space-1)] ml-[var(--space-2)] shrink-0">
							{labelRight}
						</div>
					)}
				</div>
			</label>
			{children}
			{error && (
				<div className="text-xs text-[var(--danger-500)]">{error}</div>
			)}
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
	disabled
}: NumberFieldProps) {
	const [inputValue, setInputValue] = useState(value === undefined ? "" : value.toString());
	const [internalError, setInternalError] = useState<string>("");

	// Sync with external value changes
	useEffect(() => {
		setInputValue(value === undefined ? "" : value.toString());
	}, [value]);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.value;
		setInputValue(newValue);
		
		if (newValue === "") {
			if (required) {
				setInternalError("This field is required");
			} else {
				setInternalError("");
			}
			// Don't call onChange for empty values
			return;
		}
		
		const numValue = Number(newValue);
		
		if (isNaN(numValue)) {
			setInternalError("Please enter a valid number");
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
		
		setInternalError("");
		onChange(numValue);
	};

	const handleBlur = () => {
		if (inputValue === "") {
			if (defaultValue !== undefined) {
				setInputValue(defaultValue.toString());
				onChange(defaultValue);
				setInternalError("");
			} else if (required) {
				// Keep the error state for required fields
				return;
			} else {
				// For non-required fields without default, use 0
				setInputValue("0");
				onChange(0);
				setInternalError("");
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
					<div className="absolute right-2 top-1/2 -translate-y-1/2 z-20">
						{bindAdornment}
					</div>
				)}
				{disabled && (
					<div className="absolute inset-0 bg-[var(--surface-3)] rounded-[var(--radius-sm)] z-10" />
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
	disabled
}: ColorFieldProps) {
	return (
		<FormField label={label} required={required} error={error} className={className}>
			<div className="relative">
				<Input
					type="color"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					error={!!error}
					className={cn("h-12", bindAdornment ? 'pr-9' : '', inputClassName)}
					disabled={disabled}
				/>
				{bindAdornment && (
					<div className="absolute right-2 top-1/2 -translate-y-1/2 z-20">
						{bindAdornment}
					</div>
				)}
				{disabled && (
					<div className="absolute inset-0 bg-[var(--surface-3)] rounded-[var(--radius-sm)] z-10" />
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
	disabled
}: SelectFieldProps) {
	return (
		<FormField label={label} required={required} error={error} className={className}>
			<div className="relative">
				<Select
					value={value}
					onChange={(e) => onChange(e.target.value)}
					className={cn(bindAdornment ? 'pr-9' : undefined, inputClassName)}
					disabled={disabled}
				>
					{options.map(option => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</Select>
				{bindAdornment && (
					<div className="absolute right-2 top-1/2 -translate-y-1/2 z-20">
						{bindAdornment}
					</div>
				)}
				{disabled && (
					<div className="absolute inset-0 bg-[var(--surface-3)] rounded-[var(--radius-sm)] z-10" />
				)}
			</div>
		</FormField>
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
	disabled
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
					<div className="absolute right-2 top-1/2 -translate-y-1/2 z-20">
						{bindAdornment}
					</div>
				)}
				{disabled && (
					<div className="absolute inset-0 bg-[var(--surface-3)] rounded-[var(--radius-sm)] z-10" />
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
	showLabels = true
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
					className="w-full"
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

export function BooleanField({
	label,
	value,
	onChange,
	className
}: BooleanFieldProps) {
	return (
		<FormField label="" className={className}>
			<div className="flex items-center gap-[var(--space-2)]">
				<input
					type="checkbox"
					checked={value}
					onChange={(e) => onChange(e.target.checked)}
					className="rounded"
				/>
				<label className="text-sm text-[var(--text-secondary)]">{label}</label>
			</div>
		</FormField>
	);
}