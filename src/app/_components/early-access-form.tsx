'use client';

import { type FormEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelectField } from '@/components/ui/form-fields';

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

const skuRangeOptions = [
  { value: 'Under 500 SKUs', label: 'Under 500 SKUs' },
  { value: '500 – 2,000 SKUs', label: '500 – 2,000 SKUs' },
  { value: '2,000 – 5,000 SKUs', label: '2,000 – 5,000 SKUs' },
  { value: '5,000+ SKUs', label: '5,000+ SKUs' },
];

export function EarlyAccessForm() {
  const [status, setStatus] = useState<FormStatus>({ type: 'idle', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    role: '',
    useCase: '',
    regions: '',
    skuRange: '',
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      company: formData.company.trim(),
      role: formData.role.trim(),
      useCase: formData.useCase.trim(),
      regions: formData.regions.trim(),
      skuRange: formData.skuRange.trim(),
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
      setFormData({
        name: '',
        email: '',
        company: '',
        role: '',
        useCase: '',
        regions: '',
        skuRange: '',
      });
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
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Ada Lovelace"
            required
            autoComplete="name"
          />
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
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
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
            value={formData.company}
            onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
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
            value={formData.role}
            onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
            placeholder="Head of Merchandising"
            required
            autoComplete="organization-title"
          />
        </div>
        <div className="flex flex-col gap-2">
          <SelectField
            label="Primary use case"
            value={formData.useCase}
            onChange={(value) => setFormData(prev => ({ ...prev, useCase: value }))}
            options={useCaseOptions}
            placeholder="Choose one"
            variant="glass"
          />
        </div>
        <div className="flex flex-col gap-2">
          <SelectField
            label="Approximate SKU range"
            value={formData.skuRange}
            onChange={(value) => setFormData(prev => ({ ...prev, skuRange: value }))}
            options={skuRangeOptions}
            placeholder="Select a range"
            variant="glass"
          />
        </div>
        <div className="sm:col-span-2">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="regions"
              className="text-xs font-medium tracking-wide text-[var(--text-tertiary)] uppercase"
            >
              Regions you operate in
            </label>
            <Input
              id="regions"
              value={formData.regions}
              onChange={(e) => setFormData(prev => ({ ...prev, regions: e.target.value }))}
              placeholder="North America, DACH, APAC"
              required
            />
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
