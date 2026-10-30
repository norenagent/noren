import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { RightRailProvider } from "@/lib/rightRail";
import { DemoBanner } from "./components/DemoBanner";
import { Shell } from "./components/Shell";
import StyledJsxRegistry from "./components/StyledJsxRegistry";
import "./globals.css";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

// Hanken Grotesk for display + body, JetBrains Mono for code only.
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-hanken",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-jetbrains",
});

export const viewport: Viewport = {
  themeColor: "#eaf5ec",
  colorScheme: "light",
};

export const metadata: Metadata = DEMO_MODE
  ? {
      title: "Noren · Sandbox",
      description:
        "Try a small rule-based assistant and see every step it takes signed, recorded and verifiable.",
    }
  : {
      title: "Noren · Control Panel",
      description:
        "Your local control panel for Noren. Send tasks, manage permissions, and check the activity log.",
    };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${hanken.variable} ${jetbrains.variable}`}>
      <body>
        <StyledJsxRegistry>
          <RightRailProvider>
            <DemoBanner />
            <Shell>{children}</Shell>
          </RightRailProvider>
        </StyledJsxRegistry>
      </body>
    </html>
  );
}
