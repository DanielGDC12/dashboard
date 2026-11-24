import type { Metadata } from "next";
// Self-hosted fonts (no Google Fonts request at build or runtime).
import "@fontsource/assistant/400.css";
import "@fontsource/assistant/600.css";
import "@fontsource/assistant/700.css";
import "@fontsource/assistant/800.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Painel de Entregas · Mantiqueira em Casa",
  description: "Onde e quando os ovos chegam.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
