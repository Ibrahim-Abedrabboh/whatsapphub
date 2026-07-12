import "./globals.css";

export const metadata = {
  title: "Opal Hotel Social Media Growth Hub",
  description: "Opal Hotel Social Media Growth Hub — The True Meaning of Luxury",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // suppressHydrationWarning on <html>: the pre-paint theme script sets
  // data-theme, which intentionally differs from the server markup.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Geist+Mono:wght@400;500&family=Cairo:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* Apply saved theme (global) + saved language (landing only) before
            paint to avoid a flash. Opal light + English are the defaults. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var d=document.documentElement;" +
              "if(localStorage.getItem('bc-theme')==='dark')d.dataset.theme='dark';" +
              "if(location.pathname==='/'&&localStorage.getItem('bc-lang')==='ar'){d.lang='ar';d.dir='rtl';}" +
              "}catch(e){}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
