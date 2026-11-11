import type { Metadata } from "next";
import localFont from "next/font/local";
import "@fontsource-variable/outfit";
import "./globals.css";
import { AppSidebar, MobileTopBar } from "@/components/app-sidebar";

// Brand heading face: Source Serif 4 Black (OFL), copied from ../assets/fonts
const sourceSerif = localFont({
  src: [
    { path: "./fonts/source-serif-4-latin-900-normal.woff2", weight: "900", style: "normal" },
    { path: "./fonts/source-serif-4-latin-900-italic.woff2", weight: "900", style: "italic" },
  ],
  variable: "--font-source-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "the clear code. — dashboard", template: "%s · the clear code." },
  description: "Content dashboard for @theclearcode",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={sourceSerif.variable}>
      <body>
        <div className="flex min-h-dvh">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <MobileTopBar />
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
