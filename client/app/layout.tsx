// Root layout required by Next.js App Router.
// The actual <html> and <body> are rendered by [locale]/layout.tsx.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
