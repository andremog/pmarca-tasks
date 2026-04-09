import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "pmarca tasks",
  description: "Personal productivity — the Pmarca way",
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
