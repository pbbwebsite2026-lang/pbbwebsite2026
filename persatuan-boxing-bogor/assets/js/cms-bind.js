/* Persatuan Boxing Bogor — pengikat teks CMS: mengisi elemen [data-cms] dari data/content.json */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const flat = s => String(s).replace(/\s+/g, ' ').trim();
  const squash = s => String(s).replace(/\s+/g, '');
  let site = {};

  async function load() {
    try {
      let d = null;
      if (new URLSearchParams(location.search).get('draft') === '1') {
        const raw = localStorage.getItem('pbogor_cms_draft');
        if (raw) d = JSON.parse(raw);
      }
      if (!d) { const r = await fetch('/data/content.json', { cache: 'no-store' }); if (r.ok) d = await r.json(); }
      return (d && d.site) || {};
    } catch (e) { return {}; }
  }

  function bind() {
    document.querySelectorAll('[data-cms]').forEach(el => {
      const v = site[el.getAttribute('data-cms')];
      if (typeof v !== 'string' || !v.trim()) return;
      if (el.hasAttribute('data-cms-ticker')) {
        const items = v.split('\n').map(x => x.trim()).filter(Boolean);
        const cur = Array.from(new Set(Array.from(el.querySelectorAll('span')).map(x => x.textContent.trim())));
        if (items.join('|') !== cur.join('|')) el.innerHTML = items.concat(items).map(t => '<span>' + esc(t) + '</span><b>✳</b>').join('');
      } else if (el.hasAttribute('data-cms-lines')) {
        const L = v.split('|').map(x => x.trim());
        if (squash(el.textContent) !== squash(L.join(''))) {
          const em = L.length > 2 ? 1 : L.length - 1;
          el.innerHTML = L.map((l, i) => (L.length > 1 && i === em) ? '<em>' + esc(l) + '</em>' : esc(l)).join('<br>');
        }
      } else if (el.hasAttribute('data-cms-node')) {
        const tn = Array.from(el.childNodes).find(n => n.nodeType === 3 && n.nodeValue.trim());
        if (tn && flat(tn.nodeValue) !== flat(v)) tn.nodeValue = v + ' ';
      } else if (flat(el.textContent) !== flat(v)) {
        el.textContent = v;
      }
    });
  }

  window.PBBSiteReady = load().then(s => { site = s; bind(); return s; });
  window.PBBBind = bind;
  try { if (window.barba && window.barba.hooks) window.barba.hooks.afterEnter(bind); } catch (e) { /* navigasi biasa tetap jalan */ }
})();
