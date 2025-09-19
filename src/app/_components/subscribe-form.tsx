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

export function SubscribeForm() {
  const [status, setStatus] = useState<FormStatus>({ type: 'idle', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = (formData.get('email') as string)?.trim();

    if (!email) {
      setStatus({ type: 'error', message: 'Please enter a valid email address.' });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({ error: 'Unable to subscribe right now.' }))) as ApiError;
        throw new Error(errorData.error ?? 'Unable to subscribe right now.');
      }

      setStatus({
        type: 'success',
        message: 'Subscribed. We’ll keep you posted on product updates.',
      });
      form.reset();
    } catch (error) {
      setStatus({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Something went wrong. Try again or email hello@variota.com.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          id="subscribe-email"
          name="email"
          type="email"
          placeholder="you@retailco.com"
          required
          aria-label="Email address"
          autoComplete="email"
        />
        <Button
          type="submit"
          variant="secondary"
          size="md"
          disabled={isSubmitting}
          className="sm:w-auto"
        >
          {isSubmitting ? 'Sending…' : 'Subscribe'}
        </Button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={`text-xs ${
          status.type === 'success'
            ? 'text-[var(--accent-success)]'
            : status.type === 'error'
              ? 'text-[var(--danger-500)]'
              : 'text-[var(--text-tertiary)]'
        }`}
      >
        {status.message || 'Monthly updates. No spam. You can unsubscribe anytime.'}
      </p>
    </form>
  );
}
