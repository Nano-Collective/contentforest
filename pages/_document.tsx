import { Head, Html, Main, NextScript } from "next/document";

const themeScript = `
  (function() {
    const theme = localStorage.getItem('theme');
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  })();
`;

export default function Document() {
  return (
    <Html lang="en" className="dark">
      <Head>
        <meta name="robots" content="noindex, nofollow" />
        <meta
          name="description"
          content="ContentForest — Nano Collective internal content tool."
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Lora:wght@400;500;600;700&family=Fira+Code:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body className="antialiased">
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: theme bootstrap
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
