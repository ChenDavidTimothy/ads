"use client";

import { useState, useEffect } from "react";
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
	error, 
	className, 
	children 
}: FormFieldProps) {
	return (
		<div className={cn("space-y-1", className)}>
			<label className="block text-sm font-medium text-[var(--text-secondary)]">
				{label}
			</label>
			{children}
			{error && (
				<div className="text-xs text-[var(--danger-500)]">{error}</div>
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
	defaultValue?: number;
	className?: string;
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
	className
}: NumberFieldProps) {
	const [inputValue, setInputValue] = useState(value.toString());
	const [internalError, setInternalError] = useState<string>("");

	// Sync with external value changes
	useEffect(() => {
		setInputValue(value.toString());
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
			<Input
				type="number"
				value={inputValue}
				onChange={handleChange}
				onBlur={handleBlur}
				error={!!displayError}
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
	required = true,
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
	required = true,
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