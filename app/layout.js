export const metadata = {
  title: "TextToVideo Converter Pro",
  description: "Converta texto em MP3 e MP4 rapidamente.",
};

import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}

