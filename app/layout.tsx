import "./globals.css";

export const metadata = {
  title: "Thea's Food",
  description: "Track Thea's food journey",
  applicationName: "Thea's Food",
  appleWebApp: {
    capable: true,
    title: "Thea's Food",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/apple-touch-icon.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
