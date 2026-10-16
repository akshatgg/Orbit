import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import Script from "next/script";
import { InstallProvider } from "@/components/pwa/InstallProvider";
import { INSTALL_CAPTURE_SCRIPT } from "@/components/pwa/install-store";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "ORBIT", template: "%s · ORBIT" },
  description:
    "Explore opportunities — career, networking and social events picked for you.",
  applicationName: "ORBIT",
  appleWebApp: { capable: true, title: "ORBIT", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#06060a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Registered from an inline script so it runs before hydration (scanners such as
// PWABuilder look for a service worker on load). Production only; dev stays SW-free.
const SW_REGISTER = `if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(function (e) { console.error('Service worker registration failed', e); }); }`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${montserrat.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AmbientBackground />
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
