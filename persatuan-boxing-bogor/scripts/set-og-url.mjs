// Saat build di Netlify, ubah og:image relatif menjadi URL absolut memakai domain situs (env URL).
// Tanpa env URL (build lokal) skrip ini tidak mengubah apa pun.
import { readdir, readFile, writeFile } from 'node:fs/promises';
const base = String(process.env.URL || '').replace(/\/+$/, '');
if (!/^https:\/\/[a-z0-9.-]+$/i.test(base)) { console.log('set-og-url: env URL tidak ada, dilewati.'); process.exit(0); }
let n = 0;
for (const f of (await readdir('.')).filter(x => x.endsWith('.html'))) {
  const h = await readFile(f, 'utf8');
  const out = h.replace('content="assets/img/og-pbb.jpg"', `content="${base}/assets/img/og-pbb.jpg"`);
  if (out !== h) { await writeFile(f, out); n++; }
}
const pages = ['index','about','programs','coaches','schedule','competitions','gallery','contact'];
await writeFile('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p => `  <url><loc>${base}/${p === 'index' ? '' : p + '.html'}</loc></url>`).join('\n')}\n</urlset>\n`);
await writeFile('robots.txt', `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${base}/sitemap.xml\n`);
console.log(`set-og-url: ${n} halaman memakai ${base}`);
