// src/app/layout.tsx
import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "@/trpc/react";
import { NotificationProvider } from "@/hooks/use-notifications";
import { ToastContainer } from "@/components/ui/toast";
import { ThemeProvider } from "@/components/theme/theme-provider";

export const metadata: Metadata = {
  title: {
    default: "GraphBatch - No-Code Video Animation Platform",
    template: "%s | GraphBatch"
  },
  description: "Create stunning, data-driven video advertisements without coding. GraphBatch empowers business professionals with an intuitive visual programming interface for animation creation.",
  keywords: [
    "video animation",
    "no-code animation",
    "visual programming",
    "video advertisements", 
    "marketing videos",
    "business automation",
    "data-driven videos",
    "node-based editor"
  ],
  authors: [{ name: "GraphBatch Team" }],
  creator: "GraphBatch",
  publisher: "GraphBatch",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "GraphBatch - No-Code Video Animation Platform",
    description: "Create stunning, data-driven video advertisements without coding. GraphBatch empowers business professionals with an intuitive visual programming interface.",
    siteName: "GraphBatch",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "GraphBatch - No-Code Video Animation Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GraphBatch - No-Code Video Animation Platform",
    description: "Create stunning, data-driven video advertisements without coding.",
    images: ["/og-image.png"],
    creator: "@graphbatch",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_VERIFICATION_ID,
    yandex: process.env.YANDEX_VERIFICATION_ID,
  },
  category: "technology",
  classification: "Business Software",
  other: {
    "application-name": "GraphBatch",
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "GraphBatch",
    "msapplication-TileColor": "#6d28d9",
    "theme-color": "#6d28d9",
  },
  icons: [
    { rel: "icon", url: "/favicon.ico" },
    { rel: "icon", url: "/icon.png", type: "image/png" },
    { rel: "apple-touch-icon", url: "/apple-touch-icon.png" },
    { rel: "manifest", url: "/manifest.json" },
  ],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
  preload: true,
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`} data-theme="dark">
      <head>
        {/* Preconnect to improve performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Security headers */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="Referrer-Policy" content="strict-origin-when-cross-origin" />
        <meta httpEquiv="Permissions-Policy" content="camera=(), microphone=(), geolocation=()" />
        
        {/* Viewport for responsive design */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        
        {/* Progressive Web App */}
        <meta name="application-name" content="GraphBatch" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="GraphBatch" />
        <meta name="msapplication-TileColor" content="#6d28d9" />
        <meta name="theme-color" content="#6d28d9" />
      </head>
      <body className="bg-[var(--surface-0)] text-[var(--text-primary)] antialiased">
        <NotificationProvider>
          <TRPCReactProvider>
            <ThemeProvider>
              {children}
              <ToastContainer />
            </ThemeProvider>
          </TRPCReactProvider>
        </NotificationProvider>
        
        {/* Analytics and monitoring scripts would go here */}
        {process.env.NODE_ENV === 'production' && (
          <>
            {/* Google Analytics */}
            {process.env.NEXT_PUBLIC_GA_ID && (
              <>
                <script
                  async
                  src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
                />
                <script
                  dangerouslySetInnerHTML={{
                    __html: `
                      window.dataLayer = window.dataLayer || [];
                      function gtag(){dataLayer.push(arguments);}
                      gtag('js', new Date());
                      gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}', {
                        page_title: document.title,
                        page_location: window.location.href,
                      });
                    `,
                  }}
                />
              </>
            )}
            
            {/* Hotjar or other monitoring tools */}
            {process.env.NEXT_PUBLIC_HOTJAR_ID && (
              <script
                dangerouslySetInnerHTML={{
                  __html: `
                    (function(h,o,t,j,a,r){
                        h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
                        h._hjSettings={hjid:${process.env.NEXT_PUBLIC_HOTJAR_ID},hjsv:6};
                        a=o.getElementsByTagName('head')[0];
                        r=o.createElement('script');r.async=1;
                        r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
                        a.appendChild(r);
                    })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
                  `,
                }}
              />
            )}
          </>
        )}
      </body>
    </html>
  );
}