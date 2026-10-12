(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined';
  const hasBarba = typeof window.barba !== 'undefined';
  let activeScene = null;
  let lastScrollY = window.scrollY;
  let scrollVelocity = 0;
  let scrollFrame = 0;
  const $ = (root, selector) => root.querySelector(selector);
  let lenisInstance = null;
  let lenisFrame = 0;
  let cursorBound = false;

  function initSmoothScroll() {
    if (reduced || !window.Lenis || lenisInstance) return;
    try {
      lenisInstance = new window.Lenis({ duration: 1.05, smoothWheel: true, wheelMultiplier: .9, touchMultiplier: 1.05, anchors: true });
      lenisInstance.on('scroll', () => { if (window.ScrollTrigger) window.ScrollTrigger.update(); });
      if (window.gsap && window.gsap.ticker) {
        const tick = time => { if (lenisInstance) lenisInstance.raf(time * 1000); };
        lenisFrame = 1;
        window.gsap.ticker.add(tick);
        window.gsap.ticker.lagSmoothing(0);
        lenisInstance.__pbbTick = tick;
      } else {
        const raf = time => { if (!lenisInstance) return; lenisInstance.raf(time); requestAnimationFrame(raf); };
        requestAnimationFrame(raf);
      }
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    } catch (error) {
      lenisInstance = null;
      console.warn('Smooth scrolling unavailable; native scrolling remains active.', error);
    }
  }

  function initCustomCursor() {
    if (cursorBound) return;
    cursorBound = true;
    if (reduced || !window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    const orb = document.createElement('div');
    orb.className = 'cursor-orb'; orb.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span'); orb.append(label); document.body.append(orb);
    document.body.classList.add('has-custom-cursor');
    let raf = 0, x = -100, y = -100;
    document.addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse') return;
      x = event.clientX; y = event.clientY;
      if (!raf) raf = requestAnimationFrame(() => { orb.style.transform = `translate3d(${x - 9}px,${y - 9}px,0)`; orb.classList.add('is-visible'); raf = 0; });
    }, { passive: true });
    document.addEventListener('pointerover', event => {
      const target = event.target.closest('a,button,[data-cursor-label],.gallery-item,.coach-card');
      if (!target) { orb.classList.remove('is-active'); label.textContent = ''; return; }
      const raw = target.dataset.cursorLabel || (target.matches('.gallery-item') ? 'LIHAT' : target.matches('.coach-card') ? 'PROFIL' : target.matches('.nav-cta') ? 'DAFTAR' : target.matches('button') ? 'KLIK' : 'BUKA');
      label.textContent = String(raw).slice(0, 16).toUpperCase(); orb.classList.add('is-active');
    }, { passive: true });
    document.addEventListener('pointerout', event => {
      if (event.target.closest('a,button,[data-cursor-label],.gallery-item,.coach-card')) { orb.classList.remove('is-active'); label.textContent = ''; }
    }, { passive: true });
  }

  function initCommon(container = document) {
    container.querySelectorAll('.year').forEach(el => el.textContent = new Date().getFullYear());
    const toggle = $(container, '.menu-toggle');
    const nav = $(container, '.nav');
    if (toggle && nav && !toggle.dataset.bound) {
      toggle.dataset.bound = '1';
      toggle.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(open));
        nav.classList.toggle('open', open);
      });
      nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
        toggle.setAttribute('aria-expanded', 'false'); nav.classList.remove('open');
      }));
    }

    if (hasGSAP && !reduced) {
      if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
      container.querySelectorAll('.reveal').forEach(el => {
        if (el.dataset.revealBound) return;
        el.dataset.revealBound = '1';
        gsap.fromTo(el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: .75, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
      });
      const heroTitle = $(container, '.hero h1, .page-hero h1, .contact-copy h1');
      if (heroTitle && !heroTitle.dataset.heroBound && (heroTitle.dataset.heroBound = '1')) gsap.fromTo(heroTitle, { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: .85, ease: 'power3.out', delay: .12 });
      container.querySelectorAll('.program-card').forEach(el => {
        if (el.dataset.cardBound) return;
        el.dataset.cardBound = '1';
        el.addEventListener('pointermove', e => {
          const r = el.getBoundingClientRect(), x = (e.clientX-r.left)/r.width-.5, y = (e.clientY-r.top)/r.height-.5;
          gsap.to(el, { rotateY: x*3, rotateX: y*-3, transformPerspective: 700, duration: .3, overwrite: true });
        });
        el.addEventListener('pointerleave', () => gsap.to(el, { rotateY: 0, rotateX: 0, duration: .4 }));
      });
      // Small, restrained interaction cues; avoid applying transforms to every pointer movement.
      container.querySelectorAll('.btn, .nav-cta, .line-link').forEach(el => {
        if (el.dataset.microBound) return;
        el.dataset.microBound = '1';
        el.addEventListener('pointermove', e => {
          if (e.pointerType !== 'mouse') return;
          const r = el.getBoundingClientRect();
          const x = (e.clientX - r.left) / Math.max(1, r.width) - .5;
          const y = (e.clientY - r.top) / Math.max(1, r.height) - .5;
          gsap.to(el, { x: x * 3, y: y * 2, duration: .22, ease: 'power2.out', overwrite: true });
        });
        el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: .3, ease: 'power2.out', overwrite: true }));
        el.addEventListener('pointerdown', () => gsap.to(el, { scale: .975, duration: .08, overwrite: true }));
        el.addEventListener('pointerup', () => gsap.to(el, { scale: 1, duration: .16, ease: 'back.out(2)', overwrite: true }));
        el.addEventListener('pointercancel', () => gsap.to(el, { x: 0, y: 0, scale: 1, duration: .2, overwrite: true }));
      });
      container.querySelectorAll('.coach-card').forEach((card, i) => {
        const title = $(card, '.coach-info h2');
        if (title && !card.dataset.parallaxReady) {
          card.dataset.parallaxReady = '1';
          card.style.setProperty('--coach-name', `"${title.textContent.replace(/["\\]/g, '')}"`);
          gsap.fromTo(card.querySelector('.coach-portrait'), { y: 16 }, { y: -8, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: .7 } });
          gsap.fromTo(title, { x: i % 2 ? 16 : -16 }, { x: i % 2 ? -16 : 16, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: .8 } });
        }
      });
      const ticker = $(container, '.ticker-track');
      if (ticker && !ticker.dataset.marqueeReady) {
        ticker.dataset.marqueeReady = '1';
        gsap.to(ticker, { xPercent: -15, duration: 18, repeat: -1, ease: 'none' });
      }
    } else {
      container.querySelectorAll('.reveal').forEach(el => { el.style.opacity = 1; el.style.transform = 'none'; });
    }

    const form = $(container, '#trial-form');
    if (form && !form.dataset.bound) {
      form.dataset.bound = '1';
      form.addEventListener('submit', async e => {
        e.preventDefault();
        // Lock synchronously: protects against rapid/double submit and scripted submit events.
        if (form.dataset.submitting === '1') return;
        if (!form.reportValidity()) return;
        form.dataset.submitting = '1';
        const data = new FormData(form), result = $(form, '.form-result'), button = $(form, '[type=submit]');
        if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
        if (result) { result.textContent = 'Mengirim permintaan…'; result.classList.add('visible'); }
        try {
          const response = await fetch('/.netlify/functions/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: data.get('name'), contact: data.get('contact'), experience: data.get('experience'), goal: data.get('goal'), message: data.get('message'), website: data.get('website') }) });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.error || 'Permintaan belum berhasil dikirim.');
          if (result) result.textContent = payload.message || 'Permintaan berhasil dikirim.';
          form.reset();
        } catch (error) { if (result) result.textContent = (error.message || 'Tidak dapat mengirim permintaan.') + ' Silakan kirim lewat tombol WhatsApp.'; }
        finally {
          delete form.dataset.submitting;
          if (button) { button.disabled = false; button.removeAttribute('aria-busy'); }
        }
      });
    }
  }

  // Barba hanya menukar kontainer; skrip khusus halaman tidak ikut berjalan, jadi daftar kompetisi dimuat/dirender ulang di sini.
  function initCompetitions() {
    if (!document.querySelector('#competitions')) return;
    if (window.PBBCompetitions) { window.PBBCompetitions.render(); return; }
    if (document.querySelector('script[data-pbb-competitions]')) return;
    const script = document.createElement('script');
    script.src = '/assets/js/competitions.js'; script.defer = true; script.dataset.pbbCompetitions = '1';
    document.head.append(script);
  }

  function initThree() {
    const host = document.querySelector('.hero-art');
    if (!host || reduced || host.dataset.scene !== 'glove' || host.dataset.threeReady) return;
    if (!window.THREE) {
      if (!host.dataset.threeLoading) {
        host.dataset.threeLoading = '1';
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.152.2/three.min.js';
        script.async = true;
        script.onload = () => { host.dataset.threeLoading = ''; initThree(); };
        script.onerror = () => { host.dataset.threeLoading = ''; console.warn('Three.js CDN unavailable; CSS glove fallback remains active.'); };
        document.head.append(script);
      }
      return;
    }
    host.dataset.threeReady = '1';
    let renderer = null;
    try {
      const THREE = window.THREE;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, Math.max(.1, host.clientWidth / host.clientHeight), .1, 100);
      camera.position.z = 6.5;
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
      renderer.setSize(host.clientWidth, host.clientHeight);
      renderer.domElement.setAttribute('aria-hidden', 'true');
      renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1';
      host.prepend(renderer.domElement);
      host.classList.add('webgl-ready');

      const glove = new THREE.Group(); scene.add(glove);
      const red = new THREE.MeshStandardMaterial({ color: 0xef432e, roughness: .42, metalness: .08 });
      const redDark = new THREE.MeshStandardMaterial({ color: 0x8d1c17, roughness: .62 });
      const seam = new THREE.MeshStandardMaterial({ color: 0xff8a75, roughness: .55 });
      const cuffMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c5, roughness: .75 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(.92, 28, 20), red);
      body.scale.set(.8, 1.05, .68); body.position.set(.05, .1, 0); glove.add(body);
      const palm = new THREE.Mesh(new THREE.SphereGeometry(.48, 22, 16), redDark);
      palm.scale.set(.72, .88, .8); palm.position.set(-.53, -.13, .04); glove.add(palm);
      const thumb = new THREE.Mesh(new THREE.SphereGeometry(.42, 20, 16), red);
      thumb.scale.set(.95, .68, .72); thumb.position.set(-.64, -.18, .25); thumb.rotation.z = -.55; glove.add(thumb);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(.43, .5, .66, 24), cuffMat);
      cuff.position.set(.08, -1.08, 0); cuff.rotation.z = -.08; glove.add(cuff);
      const cuffBand = new THREE.Mesh(new THREE.TorusGeometry(.46, .025, 6, 28), seam);
      cuffBand.position.set(.08, -.82, 0); cuffBand.rotation.x = Math.PI/2; glove.add(cuffBand);
      const keyLight = new THREE.DirectionalLight(0xffd4c5, 2.1); keyLight.position.set(-3, 4, 5); scene.add(keyLight);
      scene.add(new THREE.AmbientLight(0xffffff, .65));
      const ringGeo = new THREE.TorusGeometry(2.1, .009, 4, 100);
      const rings = [];
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: i === 1 ? 0xef432e : 0xf0eee6, transparent: true, opacity: i === 1 ? .55 : .17 }));
        ring.rotation.x = .8 + i * .45; ring.rotation.y = i * .7; scene.add(ring); rings.push(ring);
      }
      const pointGeo = new THREE.BufferGeometry(), count = 65, positions = new Float32Array(count * 3);
      for (let i=0;i<count;i++) { positions[i*3]=(Math.random()-.5)*6; positions[i*3+1]=(Math.random()-.5)*6; positions[i*3+2]=(Math.random()-.5)*1.2; }
      pointGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const points = new THREE.Points(pointGeo, new THREE.PointsMaterial({ color: 0xf0eee6, size: .022, transparent: true, opacity: .42 })); scene.add(points);
      let pointerX = 0, pointerY = 0, targetX = 0, targetY = 0, jab = 0, raf = 0, disposed = false;
      const onMove = e => {
        targetX = Math.max(-1.2, Math.min(1.2, ((e.clientX/window.innerWidth)-.5)*2.2));
        targetY = Math.max(-.8, Math.min(.8, -((e.clientY/window.innerHeight)-.5)*1.6));
        // Pointer motion steers the glove; a deliberate press creates the jab.
      };
      const onScroll = () => { const y=window.scrollY; scrollVelocity=Math.max(-24,Math.min(24,y-lastScrollY)); lastScrollY=y; if(!scrollFrame)scrollFrame=requestAnimationFrame(()=>{scrollVelocity*=.65;scrollFrame=0;}); };
      const resize = () => { if(disposed || !host.isConnected)return; camera.aspect=Math.max(.1,host.clientWidth/host.clientHeight);camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight); };
      const onPunch = e => { if (e.pointerType !== 'touch') jab = 1; };
      host.addEventListener('pointerdown', onPunch, { passive: true });
      window.addEventListener('pointermove', onMove, { passive: true }); window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', resize, { passive: true });
      const render = () => {
        if (disposed || !host.isConnected) return;
        pointerX += (targetX-pointerX)*.055; pointerY += (targetY-pointerY)*.055;
        const scrollKick = Math.max(-.35,Math.min(.35,scrollVelocity*.012));
        glove.position.set(pointerX*.34, pointerY*.32+Math.sin(performance.now()*.0015)*.045, .1);
        glove.rotation.y += ((pointerX*.38 + scrollKick)-glove.rotation.y)*.06;
        glove.rotation.x += ((pointerY*.28)-glove.rotation.x)*.06;
        glove.rotation.z += ((-pointerX*.12 + scrollKick*.25)-glove.rotation.z)*.05;
        glove.position.z += ((jab ? .65 : 0)-glove.position.z)*.24; if(glove.position.z>.5)jab*=.55;else jab=0;
        rings.forEach((ring,i)=>{ring.rotation.z+=.001+(i*.0003);ring.rotation.y+=.0007;}); points.rotation.z-=.00025;
        renderer.render(scene,camera); raf=requestAnimationFrame(render);
      };
      render();
      activeScene = { stop: () => { disposed=true;cancelAnimationFrame(raf);window.removeEventListener('pointermove',onMove);window.removeEventListener('scroll',onScroll);window.removeEventListener('resize',resize);host.removeEventListener('pointerdown',onPunch);renderer.dispose();ringGeo.dispose();pointGeo.dispose();body.geometry.dispose();palm.geometry.dispose();thumb.geometry.dispose();cuff.geometry.dispose();cuffBand.geometry.dispose();red.dispose();redDark.dispose();seam.dispose();cuffMat.dispose();host.classList.remove('webgl-ready');host.dataset.threeReady='';renderer.domElement.remove(); } };
    } catch (e) {
      // If GPU/context creation fails midway, restore the CSS glove instead of leaving a blank hero.
      if (renderer) { try { renderer.dispose(); } catch {} renderer.domElement?.remove(); }
      host.classList.remove('webgl-ready');
      host.dataset.threeReady = '';
      console.warn('Decorative WebGL scene unavailable; CSS visual remains active.', e);
    }
  }

  function initPrefetch() {
    const seen = new Set();
    const warm = e => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.origin !== location.origin || seen.has(a.href) || !/(\.html|\/)$/.test(a.pathname) || /^\/admin/.test(a.pathname)) return;
      seen.add(a.href); fetch(a.href, { credentials: 'same-origin' }).catch(() => {});
    };
    document.addEventListener('pointerover', warm, { passive: true });
    document.addEventListener('touchstart', warm, { passive: true });
  }

  // Konten CMS tiba setelah DOMContentLoaded: pasang ulang animasi agar baris hasil render tidak tetap tersembunyi.
  function revealFailsafe() {
    window.addEventListener('pbb:content', () => {
      const main = document.querySelector('[data-barba="container"]');
      if (main) { initCommon(main); if (window.ScrollTrigger) window.ScrollTrigger.refresh(); }
    });
    setTimeout(() => document.querySelectorAll('.reveal').forEach(el => {
      if (!el.dataset.revealBound && getComputedStyle(el).opacity === '0') { el.style.opacity = '1'; el.style.transform = 'none'; }
    }), 3500);
  }

  // Panggung hero: foto asli + tali ring berfisika pegas (bereaksi pada kursor dan scroll) + timer ronde 3 menit.
  function initHeroStage() {
    const host = document.querySelector('.hero-art[data-scene="stage"]');
    if (!host || host.dataset.stageReady) return;
    host.dataset.stageReady = '1';
    const photo = $(host, '.hero-photo'), svg = $(host, '.ropes'), timer = $(host, '#roundTimer');
    if (photo && hasGSAP && !reduced) gsap.from(photo, { clipPath: 'polygon(9% 0,9% 0,9% 100%,0 100%)', duration: 1.1, ease: 'power4.out', delay: .15 });
    if (timer) {
      let left = 180, round = 1;
      const fmt = () => `RONDE ${round} · ${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
      timer.textContent = fmt();
      if (!reduced) {
        const id = setInterval(() => {
          if (!timer.isConnected) { clearInterval(id); return; }
          if (--left < 0) { left = 180; round = round % 12 + 1; }
          timer.textContent = fmt();
        }, 1000);
      }
    }
    if (!svg) return;
    const paths = [...svg.querySelectorAll('path')], rest = [.3, .52, .74], s = paths.map(() => ({ y: 0, v: 0 }));
    let W = 0, H = 0, py = 0, near = false, raf = 0, lastY = window.scrollY, kick = 0;
    const draw = () => paths.forEach((p, i) => { const y0 = H * rest[i]; p.setAttribute('d', `M-20 ${y0}Q${W / 2} ${y0 + s[i].y * 2} ${W + 20} ${y0}`); });
    const size = () => {
      if (!host.isConnected) { window.removeEventListener('resize', size); return; }
      const r = host.getBoundingClientRect(); W = r.width; H = r.height; svg.setAttribute('viewBox', `0 0 ${W} ${H}`); draw();
    };
    const step = () => {
      raf = 0;
      if (!host.isConnected) return;
      let moving = false;
      s.forEach((o, i) => {
        const y0 = H * rest[i], t = near && Math.abs(py - y0) < 80 ? (py - y0) * .6 : kick * (i % 2 ? -1 : 1);
        o.v += (t - o.y) * .12; o.v *= .86; o.y += o.v;
        if (Math.abs(o.v) > .04 || Math.abs(o.y - t) > .15) moving = true;
      });
      kick *= .8; draw();
      if (moving || near) raf = requestAnimationFrame(step);
    };
    const wake = () => { if (!raf && !reduced) raf = requestAnimationFrame(step); };
    const onScroll = () => {
      if (!host.isConnected) { window.removeEventListener('scroll', onScroll); return; }
      kick = Math.max(-18, Math.min(18, (window.scrollY - lastY) * .4)); lastY = window.scrollY; wake();
    };
    host.addEventListener('pointermove', e => { py = e.clientY - host.getBoundingClientRect().top; near = true; wake(); }, { passive: true });
    host.addEventListener('pointerleave', () => { near = false; wake(); }, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', size, { passive: true });
    size();
  }

  function runLoader() {
    const loader = document.querySelector('.loader');
    if (!loader) return;
    let seen = false;
    try { seen = !!sessionStorage.getItem('pbb_loaded'); sessionStorage.setItem('pbb_loaded', '1'); } catch {}
    if (seen) { loader.remove(); return; }
    if (hasGSAP && !reduced) {
      gsap.timeline({ onComplete: () => { loader.style.display = 'none'; } })
        .to(loader.querySelector('.loader-line i'), { width: '100%', duration: .35, ease: 'power2.inOut' })
        .to(loader, { yPercent: -100, duration: .5, ease: 'power4.inOut' }, '+=0');
    } else loader.style.display = 'none';
  }

  function initTransitions() {
    if (!hasBarba || window.__pbbBarbaStarted) return;
    window.__pbbBarbaStarted = true;
    const curtain = document.createElement('div');
    curtain.className = 'transition-curtain'; curtain.setAttribute('aria-hidden', 'true'); document.body.append(curtain);
    barba.init({
      prevent: ({ el }) => {
        if (!el || el.hasAttribute('download') || el.target === '_blank' || el.origin !== window.location.origin || el.hasAttribute('data-no-transition') || /^\/(admin|\.netlify|data)(\/|$)/.test(el.pathname) || el.closest('[data-barba-prevent]')) return true;
        // Keep native in-page anchor navigation; Barba should only own document-to-document links.
        const target = new URL(el.href, window.location.href);
        const sameDocument = target.pathname === window.location.pathname && target.search === window.location.search;
        return sameDocument && !!target.hash;
      },
      // If Barba cannot fetch an internal destination, recover with a normal browser navigation.
      // This prevents a failed request from leaving the transition curtain covering the page.
      requestError(trigger, action, url) {
        if (action === 'click' && url && new URL(url, window.location.href).origin === window.location.origin) {
          window.location.assign(url);
          return false;
        }
        return true;
      },
      transitions: [{
        name: 'pbb-soft-crossfade',
        async leave(data) {
          document.body.setAttribute('aria-busy', 'true');
          if (reduced || !hasGSAP) { data.current.container.style.opacity = '0'; return; }
          await gsap.to(data.current.container, { opacity: 0, y: -8, duration: .22, ease: 'power1.in' });
        },
        async beforeEnter(data) {
          const doc = new DOMParser().parseFromString(data.next.html, 'text/html');
          if (doc.title) document.title = doc.title;
          const incoming = doc.querySelector('meta[name="description"]');
          const current = document.querySelector('meta[name="description"]');
          if (incoming && current) current.content = incoming.content;
          document.querySelectorAll('.site-header .nav a').forEach(a => a.classList.toggle('active', new URL(a.href).pathname === new URL(data.next.url.href).pathname));
        },
        async enter(data) {
          if (lenisInstance) lenisInstance.scrollTo(0, { immediate: true, force: true }); else window.scrollTo(0, 0);
          data.next.container.style.opacity = '0';
          if (hasGSAP && !reduced) await gsap.fromTo(data.next.container, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .4, ease: 'power2.out', clearProps: 'all' });
          else data.next.container.style.opacity = '1';
        },
        async after(data) {
          document.body.removeAttribute('aria-busy');
          if (activeScene) { activeScene.stop(); activeScene = null; }
          curtain.style.visibility = 'hidden'; if (window.gsap) window.gsap.set(curtain, { clearProps: 'transform,opacity' });
          document.querySelectorAll('.loader').forEach(el => el.remove());
          if (window.PBBContent && typeof window.PBBContent.render === 'function') await window.PBBContent.render();
          const main = document.querySelector('[data-barba="container"]');
          if (main) {
            initCommon(main);
            // Move keyboard/screen-reader context to the new page without causing a second scroll.
            if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
            if (typeof main.focus === 'function') main.focus({ preventScroll: true });
          }
          initHeroStage();
          initThree();
          initCompetitions();
          if (lenisInstance) lenisInstance.resize();
          if (window.ScrollTrigger) { ScrollTrigger.getAll().forEach(t => { if (!t.trigger || !t.trigger.isConnected) t.kill(); }); ScrollTrigger.refresh(); }
        }
      }]
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    runLoader();
    initCommon(document);
    initCustomCursor();
    initSmoothScroll();
    initHeroStage();
    initThree();
    initTransitions();
    initPrefetch();
    revealFailsafe();
  });
})();
