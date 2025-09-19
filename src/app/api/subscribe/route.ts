import { NextResponse } from 'next/server';

interface SubscribeRequest {
  email: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SubscribeRequest;
    const email = body.email?.toString().trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 });
    }

    const payload = {
      email,
      subscribedAt: new Date().toISOString(),
      source: 'landing-page',
    } satisfies Record<string, unknown>;

    if (process.env.NEWSLETTER_WEBHOOK_URL) {
      try {
        const response = await fetch(process.env.NEWSLETTER_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Webhook responded with ${response.status}`);
        }
      } catch (error) {
        console.error('Failed to forward newsletter subscription', error);
        return NextResponse.json(
          {
            error:
              'Unable to notify the team right now. Please email hello@variota.com to subscribe.',
          },
          { status: 502 }
        );
      }
    } else {
      // TODO: Connect to marketing automation platform when available.
      console.info('Newsletter subscription received', payload);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error while processing newsletter subscription', error);
    return NextResponse.json(
      { error: 'Unexpected error. Please try again later.' },
      { status: 500 }
    );
  }
}
