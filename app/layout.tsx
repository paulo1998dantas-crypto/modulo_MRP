import type { Metadata } from "next";
import "./globals.css";
import { PortalBackLink } from "./PortalBackLink";

export const metadata: Metadata = {
  title: "Módulo MRP II | JI Montadora",
  description: "Sequenciamento PCP com capacidade, calendário e Gantt.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <PortalBackLink />
        {children}
      </body>
    </html>
  );
}
