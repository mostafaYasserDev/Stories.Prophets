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
  metadataBase: new URL('https://mostafayasserdev.github.io/Stories.Prophets/'),
  title: {
    default: 'قصص الأنبياء وسيرة الرسول ﷺ | رحلة مباركة في هدايات الوحي وسيرة خير الأنام',
    template: '%s | قصص الأنبياء وسيرة الرسول ﷺ',
  },
  description:
    'موسوعة إسلامية تفاعلية شاملة لقصص الأنبياء والمرسلين وسيرة النبي محمد ﷺ، مقالات موثقة بالمراجع، تسجيلات صوتية نقية، عِبر وفوائد إيمانية، وتطبيق يعمل بدون إنترنت.',
  keywords: [
    'قصص الأنبياء',
    'قصص الأنبياء كاملة',
    'سيرة الرسول',
    'سيرة الرسول محمد صلى الله عليه وسلم',
    'السيرة النبوية الشريفة',
    'الأنبياء والرسل',
    'هدايات الوحي',
    'معجزات الأنبياء',
    'حياة النبي محمد',
    'العصر الجاهلي قبل الإسلام',
    'صوتيات السيرة النبوية',
    'تأملات إيمانية',
    'عبر وفوائد من السيرة',
    'أحاديث نبوية شريفة',
    'مراجع السيرة النبوية',
    'تطبيق قصص الأنبياء',
    'محمد هاشم ضيف الله',
    'مصطفى ياسر',
  ],
  authors: [{ name: 'محمد هاشم ضيف الله' }],
  creator: 'محمد هاشم ضيف الله',
  publisher: 'مصطفى ياسر',
  applicationName: 'قصص الأنبياء وسيرة الرسول',
  category: 'Islamic Studies & Education',
  alternates: {
    canonical: 'https://mostafayasserdev.github.io/Stories.Prophets/',
  },
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
    title: 'قصص الأنبياء وسيرة الرسول ﷺ | رحلة إيمانية مباركة',
    description:
      'موسوعة إسلامية تفاعلية لقصص الأنبياء وسيرة خير الأنام ﷺ، تسجيلات صوتية نقية، عِبر وفوائد إيمانية، ومراجع موثقة تعمل بدون إنترنت.',
    url: 'https://mostafayasserdev.github.io/Stories.Prophets/',
    siteName: 'قصص الأنبياء وسيرة الرسول ﷺ',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'غلاف وشعار منصة قصص الأنبياء وسيرة الرسول ﷺ',
        type: 'image/png',
      },
    ],
    locale: 'ar_AR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'قصص الأنبياء وسيرة الرسول ﷺ',
    description:
      'موسوعة إسلامية تفاعلية شاملة لقصص الأنبياء وسيرة خير الأنام ﷺ بتسجيلات صوتية وعبر وتأملات.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

const jsonLdSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://mostafayasserdev.github.io/Stories.Prophets/#website',
      url: 'https://mostafayasserdev.github.io/Stories.Prophets/',
      name: 'قصص الأنبياء وسيرة الرسول ﷺ',
      alternateName: ['قصص الأنبياء', 'السيرة النبوية', 'Stories of the Prophets'],
      description:
        'موسوعة إسلامية تفاعلية شاملة لقصص الأنبياء والمرسلين وسيرة النبي محمد ﷺ، مقالات موثقة بالمراجع، تسجيلات صوتية نقية، وعِبر إيمانية.',
      inLanguage: 'ar',
      publisher: {
        '@type': 'Person',
        name: 'محمد هاشم ضيف الله',
        jobTitle: 'معد وكاتب المحتوى الإيماني',
      },
    },
    {
      '@type': 'CreativeWorkSeries',
      '@id': 'https://mostafayasserdev.github.io/Stories.Prophets/#series',
      name: 'قصص الأنبياء وسيرة الرسول ﷺ',
      headline: 'رحلة مباركة في هدايات الوحي وسيرة خير الأنام ﷺ',
      author: {
        '@type': 'Person',
        name: 'محمد هاشم ضيف الله',
      },
      genre: ['Islamic Studies', 'Prophetic Biography', 'Spiritual Reflections'],
      inLanguage: 'ar',
      isAccessibleForFree: true,
      image: 'https://mostafayasserdev.github.io/Stories.Prophets/og-image.png',
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://mostafayasserdev.github.io/Stories.Prophets/#breadcrumbs',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'الرئيسية',
          item: 'https://mostafayasserdev.github.io/Stories.Prophets/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'السلاسل الإيمانية',
          item: 'https://mostafayasserdev.github.io/Stories.Prophets/#series',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'الجزيرة العربية في العصر الجاهلي',
          item: 'https://mostafayasserdev.github.io/Stories.Prophets/',
        },
      ],
    },
  ],
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
        {/* Schema.org Structured Data (JSON-LD) for Search Engine Rich Snippets */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSchema) }}
        />
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
