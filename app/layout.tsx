import "./globals.css";

export const metadata = {
  title: "Thea's Food Tracker",
  description: "Track Thea's food journey",
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
