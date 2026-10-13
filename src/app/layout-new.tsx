import "./design-system.css";
import "./components.css";
import "./states.css";

export const metadata = {
  title: "WhatsApp Hub - Multi-Tenant WhatsApp Platform",
  description: "Self-hosted, multi-tenant WhatsApp messaging platform with Cloud API, templates, campaigns, and two-way inbox",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Cairo:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var d = document.documentElement;
                var lang = localStorage.getItem('wh-lang') || 'ar';
                d.lang = lang;
                d.dir = lang === 'ar' ? 'rtl' : 'ltr';
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
