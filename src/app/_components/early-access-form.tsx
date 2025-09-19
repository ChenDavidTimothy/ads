'use client';

import { type FormEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface FormStatus {
  type: 'idle' | 'success' | 'error';
  message: string;
}

interface ApiError {
  error: string;
}

const useCaseOptions = [
  { value: 'weekly-promos', label: 'Weekly promos' },
  { value: 'marketplaces', label: 'Marketplaces' },
  { value: 'social', label: 'Social campaigns' },
  { value: 'in-store', label: 'In-store screens' },
  { value: 'other', label: 'Other' },
];

const skuRangeOptions = ['Under 500 SKUs', '500 – 2,000 SKUs', '2,000 – 5,000 SKUs', '5,000+ SKUs'];

export function EarlyAccessForm() {
  const [status, setStatus] = useState<FormStatus>({ type: 'idle', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const payload = {
      name: (formData.get('name') as string)?.trim(),
      email: (formData.get('email') as string)?.trim(),
      company: (formData.get('company') as string)?.trim(),
      role: (formData.get('role') as string)?.trim(),
      useCase: (formData.get('useCase') as string)?.trim(),
      regions: (formData.get('regions') as string)?.trim(),
      skuRange: (formData.get('skuRange') as string)?.trim(),
    };

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/early-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({ error: 'Unable to submit the form.' }))) as ApiError;
        throw new Error(errorData.error ?? 'Unable to submit the form.');
      }

      setStatus({
        type: 'success',
        message: 'Thank you—our team will be in touch within 2 business days.',
      });
      form.reset();
    } catch (error) {
      setStatus({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Something went wrong. Please try again or email hello@variota.com.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="name"
            className="text-xs font-medium tracking-wide text-[var(--text-tertiary)] uppercase"
          >
            Name
          </label>
          <Input id="name" name="name" placeholder="Ada Lovelace" required autoComplete="name" />
        </div>
        <div className="flex flex-col gap-2">
          <label
            htmlFor="email"
            className="text-xs font-medium tracking-wide text-[var(--text-tertiary)] uppercase"
          >
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="ada@retailco.com"
            required
            autoComplete="email"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label
            htmlFor="company"
            className="text-xs font-medium tracking-wide text-[var(--text-tertiary)] uppercase"
          >
            Company
          </label>
          <Input
            id="company"
            name="company"
            placeholder="RetailCo"
            required
            autoComplete="organization"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label
            htmlFor="role"
            className="text-xs font-medium tracking-wide text-[var(--text-tertiary)] uppercase"
          >
            Role
          </label>
          <Input
            id="role"
            name="role"
            placeholder="Head of Merchandising"
            required
            autoComplete="organization-title"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label
            htmlFor="useCase"
            className="text-xs font-medium tracking-wide text-[var(--text-tertiary)] uppercase"
          >
            Primary use case
          </label>
          <select
            id="useCase"
            name="useCase"
            required
            defaultValue=""
            className="glass-input w-full appearance-none rounded-[var(--radius-sm)] bg-transparent px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--text-primary)] focus:outline-none"
          >
            <option value="" disabled>
              Choose one
            </option>
            {useCaseOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
                className="bg-[var(--surface-1)] text-[var(--text-primary)]"
              >
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label
            htmlFor="skuRange"
            className="text-xs font-medium tracking-wide text-[var(--text-tertiary)] uppercase"
          >
            Approximate SKU range
          </label>
          <select
            id="skuRange"
            name="skuRange"
            required
            defaultValue=""
            className="glass-input w-full appearance-none rounded-[var(--radius-sm)] bg-transparent px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--text-primary)] focus:outline-none"
          >
            <option value="" disabled>
              Select a range
            </option>
            {skuRangeOptions.map((option) => (
              <option
                key={option}
                value={option}
                className="bg-[var(--surface-1)] text-[var(--text-primary)]"
              >
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="regions"
              className="text-xs font-medium tracking-wide text-[var(--text-tertiary)] uppercase"
            >
              Regions you operate in
            </label>
            <Input id="regions" name="regions" placeholder="North America, DACH, APAC" required />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={isSubmitting}
          className="sm:w-auto"
        >
          {isSubmitting ? 'Submitting…' : 'Request Early Access'}
        </Button>
        <span className="text-xs text-[var(--text-tertiary)]">
          Need help now? Email{' '}
          <a className="underline" href="mailto:hello@variota.com">
            hello@variota.com
          </a>
        </span>
      </div>

      <p
        role="status"
        aria-live="polite"
        className={`text-sm ${
          status.type === 'success'
            ? 'text-[var(--accent-success)]'
            : status.type === 'error'
              ? 'text-[var(--danger-500)]'
              : 'text-[var(--text-tertiary)]'
        }`}
      >
        {status.message}
      </p>
    </form>
  );
}
