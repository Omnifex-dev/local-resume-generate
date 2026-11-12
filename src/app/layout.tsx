import type { Metadata } from "next";
import { colorModeScript } from "@/lib/color-mode";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resume Generate",
  description: "Generate tailored resumes from job descriptions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // The script sets class="dark" (or not) before paint, so React must ignore that difference.
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: colorModeScript }} />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
