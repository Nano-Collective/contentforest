import {Head, Html, Main, NextScript} from 'next/document';

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
				<link rel="icon" type="image/x-icon" href="/favicon.ico" />
				<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
				<link
					rel="icon"
					type="image/png"
					sizes="96x96"
					href="/favicon-96x96.png"
				/>
				<link
					rel="apple-touch-icon"
					sizes="180x180"
					href="/apple-touch-icon.png"
				/>
				<link rel="manifest" href="/site.webmanifest" />
				<meta name="theme-color" content="#0a0a0a" />
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
				<script dangerouslySetInnerHTML={{__html: themeScript}} />
				<Main />
				<NextScript />
			</body>
		</Html>
	);
}
