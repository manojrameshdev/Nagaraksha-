import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://nagraksha.app'),
  title: {
    default: 'NagRaksha — Snakebite Emergency Response & Prevention',
    template: '%s · NagRaksha',
  },
  description:
    'One SOS, three responders in parallel. NagRaksha is a PWA-first emergency coordination platform for snakebites in India — antivenom-aware routing, AI myth-buster, snake photo ID and weather-based risk.',
  keywords: [
    'NagRaksha',
    'snakebite',
    'snake bite',
    'emergency response',
    'antivenom',
    'SOS',
    'India',
    'PWA',
    'first aid',
    'snake rescue',
  ],
  authors: [{ name: 'Team Nagathon', url: 'https://nagraksha.app' }],
  creator: 'Team Nagathon',
  manifest: '/manifest.webmanifest',
  applicationName: 'NagRaksha',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'NagRaksha',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    title: 'NagRaksha — Snakebite Emergency Response',
    description:
      'One SOS, three responders in parallel. Antivenom-aware routing for snakebites in India.',
    url: 'https://nagraksha.app',
    siteName: 'NagRaksha',
    images: [{ url: '/logo.svg', width: 30, height: 30, alt: 'NagRaksha' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NagRaksha — Snakebite Emergency Response',
    description:
      'One SOS, three responders in parallel. Antivenom-aware routing for snakebites in India.',
    images: ['/logo.svg'],
  },
};

export const viewport: Viewport = {
  themeColor: '#0A1812',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  maximumScale: 5,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})});}`,
          }}
        />
      </body>
    </html>
  );
}
