import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import GlobalHeader from "./components/GlobalHeader";
import GlobalFooter from "./components/GlobalFooter";
import ServiceWorkerRegistrar from "./components/ServiceWorkerRegistrar";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "WIAL — World Institute for Action Learning",
  description:
    "Global platform for Action Learning coach certification, chapter management, and coach directory.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="flex min-h-screen flex-col bg-white text-wial-gray-900">
        <AuthProvider>
          <ServiceWorkerRegistrar />
          <GlobalHeader />
          <main className="flex-1">{children}</main>
          <GlobalFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
