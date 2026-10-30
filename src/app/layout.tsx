import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import Script from "next/script";
import { INTRO_SCRIPT } from "@/components/intro/intro-script";
import { InstallProvider } from "@/components/pwa/InstallProvider";
import { INSTALL_CAPTURE_SCRIPT } from "@/components/pwa/install-store";
import { THEME_COLORS, THEME_SCRIPT } from "@/components/theme/theme";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "@/lib/seo/site";
import "./globals.css";

const instrument = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: "%s · ORBIT" },
  description: SITE_DESCRIPTION,
  keywords: [
    "career events", "student networking", "careers fair", "graduate events", "society events",
    "university socials", "employer talks", "event tickets", "UK students", "ORBIT",
  ],
  applicationName: "ORBIT",
  openGraph: {
    type: "website",
    siteName: "ORBIT",
    locale: "en_GB",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
  appleWebApp: { capable: true, title: "ORBIT", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Android: the keyboard resizes the page, so a chat's sticky composer stays above it.
  interactiveWidget: "resizes-content",
};

// Registered from an inline script so it runs before hydration (scanners such as
// PWABuilder look for a service worker on load). Production only; dev stays SW-free.
const SW_REGISTER = `if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(function (e) { console.error('Service worker registration failed', e); }); }`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${instrument.variable} h-full antialiased`}>
      <head>
        {/* Plain inline scripts in <head> run while the HTML is parsed, before first paint
            (next/script beforeInteractive only runs once the Next runtime has loaded). */}
        {/* Sets data-theme from localStorage / the OS. */}
        <script id="theme-init" dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* Opening animation: decides and covers the page, then plays once per session. */}
        <script id="orbit-intro" dangerouslySetInnerHTML={{ __html: INTRO_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <InstallProvider>{children}</InstallProvider>
        {/* Captures beforeinstallprompt before React hydrates; separate from the service worker script. */}
        <Script id="install-capture" strategy="beforeInteractive">
          {INSTALL_CAPTURE_SCRIPT}
        </Script>
        {process.env.NODE_ENV === "production" && (
          <Script id="sw-register" strategy="beforeInteractive">
            {SW_REGISTER}
          </Script>
        )}
      </body>
    </html>
  );
}
