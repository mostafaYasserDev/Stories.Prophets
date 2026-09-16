import type { Metadata } from 'next';
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

export const metadata: Metadata = {
  title: 'السيرة النبوية الشريفة | رحلة مباركة في سيرة خير الأنام ﷺ',
  description: 'تطبيق سحابي تفاعلي للسيرة النبوية الشريفة من المولد النبوي الشريف إلى الرفيق الأعلى ﷺ، بحلقات يومية وتأملات وتسجيلات صوتية مباشرة.',
  keywords: ['السيرة النبوية', 'النبي محمد', 'قصص الأنبياء', 'سيرة خير الأنام', 'العصر الجاهلي'],
  authors: [{ name: 'محمد هاشم ضيف الله' }],
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    title: 'السيرة النبوية الشريفة ﷺ',
    description: 'رحلة تفاعلية مباركة في سيرة خير الأنام ﷺ',
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
        <link rel="apple-touch-icon" href="/favicon.svg" />
      </head>
      <body className={cairo.className}>
        {children}
      </body>
    </html>
  );
}
