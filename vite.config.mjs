import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
const entry = path => fileURLToPath(new URL(path, import.meta.url));
const origin = process.env.SITE_ORIGIN || '';
if (origin && (new URL(origin).origin !== origin || new URL(origin).protocol !== 'https:')) throw new Error('SITE_ORIGIN must be your verified HTTPS origin, with no trailing slash.');
export default defineConfig({
  base: '/',
  plugins: [{
    name: 'qairos-site-metadata',
    transformIndexHtml(html) {
      if (!origin) html = html.replace(/<link rel="canonical"[^>]*>\s*/g, '').replace(/<meta property="og:url"[^>]*>\s*/g, '');
      return html.replaceAll('__QAIROS_SITE_ORIGIN__', origin);
    },
    async closeBundle() {
      const urls = origin ? [origin + '/', origin + '/app/'].map(url => '<url><loc>' + url.replaceAll('&', '&amp;') + '</loc></url>').join('') : '';
      await writeFile('dist/sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + '</urlset>');
      await writeFile('dist/robots.txt', 'User-agent: *\nAllow: /\n' + (origin ? 'Sitemap: ' + origin + '/sitemap.xml\n' : ''));
    }
  }],
  server: { host: '127.0.0.1', port: 5173, strictPort: true,
    proxy: { '/api': { target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8080', changeOrigin: false } } },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: { outDir: 'dist', rollupOptions: { input: { main: entry('./index.html'), 'app/index': entry('./app/index.html') } } }
});
