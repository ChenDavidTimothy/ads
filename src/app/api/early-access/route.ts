import { NextResponse } from 'next/server';

const requiredFields = ['name', 'email', 'company', 'role', 'useCase', 'regions', 'skuRange'] as const;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const missing = requiredFields.filter((field) => {
      const value = (body?.[field] as string | undefined)?.toString().trim();
      return !value;
    });

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    const email = (body.email as string).toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 });
    }

    const payload = {
      ...body,
      email,
      submittedAt: new Date().toISOString(),
      source: 'landing-page',
    } satisfies Record<string, unknown>;

    if (process.env.EARLY_ACCESS_WEBHOOK_URL) {
      try {
        const response = await fetch(process.env.EARLY_ACCESS_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Webhook responded with ${response.status}`);
        }
      } catch (error) {
        console.error('Failed to forward early access request', error);
        return NextResponse.json(
          {
            error:
              'We captured your request but could not notify the team automatically. Please email hello@variota.com so we can follow up.',
          },
          { status: 502 }
        );
      }
    } else {
      // TODO: Connect to CRM or support tooling webhook when available.
      console.info('Early access request received', payload);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error while processing early access request', error);
    return NextResponse.json(
      {
        error: 'Unexpected error. Please try again or contact hello@variota.com.',
      },
      { status: 500 }
    );
  }
}
