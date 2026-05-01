import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
	reactStrictMode: true,
	distDir: 'dist',
	output: 'export',
	images: {
		unoptimized: true,
	},
	turbopack: {
		root: __dirname,
	},
};

export default nextConfig;
