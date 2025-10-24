 import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>HTML Poster Editor</title>
      </head>
      <body className="min-h-screen text-gray-900">
        {children}
      </body>
    </html>
  )
}
