import { readdir, readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

const required = [
  'index.html', 'competitions.html', 'programs.html', 'coaches.html', 'schedule.html', 'contact.html', 'gallery.html',
  'admin/index.html', 'admin/admin.js', 'admin/admin.css', 'admin/platform.html', 'admin/platform.js', 'admin/platform.css', 'assets/js/competitions.js', 'assets/js/app.js', 'assets/js/content.js',
  'assets/css/style.css', 'data/content.json', 'netlify/functions/cms-api.mjs',
  'netlify/functions/contact.mjs', 'tests/content.test.mjs', 'supabase/migrations/202610100001_organization_platform_foundation.sql', 'supabase/migrations/202610100002_integrity_hardening.sql', 'docs/PANDUAN-SUPABASE-DARI-NOL-ID.md'
];
let errors = 0;
const fail = message => { console.error(`FAIL: ${message}`); errors++; };
for (const file of required) {
  try { await access(file); } catch { fail(`missing required file: ${file}`); }
}
try { JSON.parse(await readFile('data/content.json', 'utf8')); }
catch { fail('data/content.json is invalid JSON'); }

const rootFiles = await readdir('.');
const pages = rootFiles.filter(file => file.endsWith('.html'));
for (const file of pages) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const target = match[1];
    if (!target || target.startsWith('#') || target.startsWith('//') || /^(https?:|mailto:|tel:|data:|javascript:)/i.test(target)) continue;
    const local = target.split(/[?#]/)[0];
    if (!local) continue;
    try { await access(resolve(dirname(file), local)); }
    catch { fail(`broken local asset/link in ${file}: ${target}`); }
  }
  if (!source.includes('class="skip-link" href="#main-content"')) fail(`${file} is missing skip navigation`);
  if (!source.includes('id="main-content"')) fail(`${file} is missing main content target`);
  if (!source.includes('aria-label="Navigasi utama"')) fail(`${file} is missing a named primary navigation`);
  if (!/<meta name="description" content="[^"]+">/.test(source)) fail(`${file} is missing a meta description`);
  if ((source.match(/<a\b/g) || []).length !== (source.match(/<\/a>/g) || []).length) fail(`${file} has unbalanced anchor tags`);
}
for (const file of ['admin/admin.js', 'admin/platform.js', 'assets/js/competitions.js', 'assets/js/app.js', 'assets/js/content.js', 'netlify/functions/cms-api.mjs', 'netlify/functions/contact.mjs', 'scripts/build-check.mjs', 'tests/content.test.mjs']) {
  try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); }
  catch { fail(`JavaScript syntax check failed: ${file}`); }
}
if (errors) {
  console.error(`Build check failed with ${errors} issue(s).`);
  process.exitCode = 1;
} else {
  console.log(`Structural check passed: ${pages.length} public pages, required files, JSON, local links, basic accessibility markers, and JavaScript syntax.`);
  console.log('Note: this is not a production bundle build or a substitute for browser, integration, or security testing.');
}
