import type { Metadata, Viewport } from 'next';
import { Amiri, Aref_Ruqaa, Cairo, Noto_Naskh_Arabic } from 'next/font/google';
import './globals.css';

const amiri = Amiri({
  weight: ['400', '700'],
  subsets: ['arabic'],
  variable: '--font-amiri',
  display: 'swap',
});

const arefRuqaa = Aref_Ruqaa({
  weight: ['400', '700'],
  subsets: ['arabic'],
  variable: '--font-ruqaa',
  display: 'swap',
});

const cairo = Cairo({
  weight: ['400', '500', '600', '700', '800'],
  subsets: ['arabic'],
  variable: '--font-cairo',
  display: 'swap',
});

const notoNaskh = Noto_Naskh_Arabic({
  weight: ['400', '500', '600', '700'],
  subsets: ['arabic'],
  variable: '--font-naskh',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#101520',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: 'قصص الأنبياء وسيرة الرسول | رحلة مباركة في هدايات الوحي وسيرة خير الأنام ﷺ',
  description: 'تطبيق سحابي تفاعلي لقصص الأنبياء وسيرة الرسول ﷺ، بحلقات إيمانية وتأملات وتسجيلات صوتية مباشرة.',
  keywords: ['قصص الأنبياء', 'سيرة الرسول', 'السيرة النبوية', 'الأنبياء والرسل', 'سيرة خير الأنام', 'العصر الجاهلي'],
  authors: [{ name: 'محمد هاشم ضيف الله' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'قصص الأنبياء',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.svg',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'قصص الأنبياء وسيرة الرسول ﷺ',
    description: 'رحلة مباركة في قصص الأنبياء وسيرة خير الأنام ﷺ',
    type: 'website',
    locale: 'ar_AR',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={`${amiri.variable} ${arefRuqaa.variable} ${cairo.variable} ${notoNaskh.variable}`} data-theme="midnight" data-font="amiri">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="قصص الأنبياء" />
      </head>
      <body className={cairo.className}>
        {children}
        {/* PWA Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('PWA Service Worker registered with scope: ', reg.scope);
                  }).catch(function(err) {
                    console.log('PWA Service Worker registration failed: ', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
