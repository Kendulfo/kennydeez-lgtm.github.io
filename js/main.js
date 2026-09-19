/* ==========================================================================
   Kenneth Dulfo — Portfolio
   Vanilla JS: theming, view routing, nav state, scroll reveal.
   ========================================================================== */
(function () {
  'use strict';

  var app     = document.getElementById('app');
  var sidebar = document.getElementById('sidebar');
  var scrim   = document.getElementById('scrim');
  var root    = document.documentElement;

  /* ---------------------------------------------------------------- Theme */
  function syncThemeIcon() {
    var dark = root.classList.contains('dark');
    var sun  = document.querySelector('.ic--sun');
    var moon = document.querySelector('.ic--moon');
    if (sun)  sun.hidden  = dark;
    if (moon) moon.hidden = !dark;
  }

  function toggleTheme() {
    root.classList.toggle('dark');
    localStorage.setItem('theme', root.classList.contains('dark') ? 'dark' : 'light');
    syncThemeIcon();
  }

  syncThemeIcon();

  /* ----------------------------------------------------------- View router */

  // Case-study videos start when their view opens and stop when it closes, so
  // nothing plays behind a hidden view. Muted is not a preference here —
  // browsers refuse to autoplay video that has sound.
  function syncVideos(target) {
    var vids = document.querySelectorAll('.view video');
    for (var i = 0; i < vids.length; i++) {
      var vid = vids[i];
      if (target && target.contains(vid)) {
        vid.muted = true;
        var playing = vid.play();
        // A browser that still blocks it just leaves the poster and controls up.
        if (playing && playing.catch) playing.catch(function () {});
      } else {
        vid.pause();
        vid.currentTime = 0;
      }
    }
  }

  // Views that own a plain top-level hash instead of the #case/ prefix.
  var PLAIN_HASH = { 'contact-form': '#contact-form' };

  function hashFor(name) {
    if (name === 'home') return '#hero';
    return PLAIN_HASH[name] || ('#case/' + name);
  }

  // Views: 'home' | 'contact-form' | 'aia' | 'banking'
  function showView(name, push) {
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) views[i].hidden = true;

    var target = document.getElementById('view-' + name) || document.getElementById('view-home');
    target.hidden = false;

    var isCase = name !== 'home';
    document.body.classList.toggle('is-case-study', isCase);

    if (push !== false) {
      var hash = hashFor(name);
      if (location.hash !== hash) history.pushState({ view: name }, '', hash);
    }

    window.scrollTo(0, 0);
    revealAll(target);
    syncVideos(target);
    armShots();
    closeMenu();
  }

  function routeFromHash() {
    for (var key in PLAIN_HASH) {
      if (location.hash === PLAIN_HASH[key] && document.getElementById('view-' + key)) {
        showView(key, false);
        return;
      }
    }
    var m = /^#case\/(.+)$/.exec(location.hash);
    if (m && document.getElementById('view-' + m[1])) {
      showView(m[1], false);
    } else {
      showView('home', false);
    }
  }

  /* ------------------------------------------------------------- Sidebar */
  function openMenu()  { sidebar.classList.add('is-open');  scrim.classList.add('is-open'); }
  function closeMenu() { sidebar.classList.remove('is-open'); scrim.classList.remove('is-open'); }

  // Collapsed = narrow icons-only rail (desktop). Persisted between visits.
  function setCollapsed(collapsed) {
    app.classList.toggle('is-collapsed', collapsed);
    localStorage.setItem('sidebar', collapsed ? 'collapsed' : 'expanded');

    var btn = document.querySelector('[data-action="collapse"]');
    if (btn) {
      btn.setAttribute('aria-expanded', String(!collapsed));
      var label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    }

    // Only show hover tooltips when the labels are hidden.
    var tipped = document.querySelectorAll('[data-tip]');
    for (var i = 0; i < tipped.length; i++) {
      if (collapsed) tipped[i].setAttribute('title', tipped[i].getAttribute('data-tip'));
      else tipped[i].removeAttribute('title');
    }
  }

  /* ------------------------------------------------------- Global actions */
  document.addEventListener('click', function (e) {
    var shot = e.target.closest('.shot__img');
    if (shot) { openLightbox(shot); return; }

    var actionEl = e.target.closest('[data-action]');
    if (actionEl) {
      var action = actionEl.getAttribute('data-action');
      if (action === 'theme')      { toggleTheme(); return; }
      if (action === 'collapse') {
        setCollapsed(!app.classList.contains('is-collapsed'));
        return;
      }
      if (action === 'menu')       { openMenu(); return; }
      if (action === 'load-figma') { mountFigma(actionEl.closest('.figma-embed')); return; }
      if (action === 'close-menu') { closeMenu(); return; }
      if (action === 'back')       { showView('home'); return; }
    }

    // Project cards, next-project cards, and anything else that opens a view
    var viewEl = e.target.closest('[data-case], [data-view]');
    if (viewEl) {
      showView(viewEl.getAttribute('data-case') || viewEl.getAttribute('data-view'));
      return;
    }

    // In-page nav links: make sure we are on the home view first
    var link = e.target.closest('a[href^="#"]');
    if (link) {
      var id = link.getAttribute('href').slice(1);
      var section = document.getElementById(id);
      if (section) {
        e.preventDefault();
        if (document.getElementById('view-home').hidden) {
          showView('home', false);
          history.replaceState({ view: 'home' }, '', '#' + id);
        }
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        closeMenu();
      }
    }
  });

  window.addEventListener('popstate', routeFromHash);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });

  /* --------------------------------------------------------- Scroll reveal */
  var io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
  }

  function revealAll(scope) {
    var els = (scope || document).querySelectorAll('.reveal:not(.is-visible)');
    for (var i = 0; i < els.length; i++) {
      if (io) io.observe(els[i]);
      else els[i].classList.add('is-visible');
    }
  }

  /* ------------------------------------------------------------ Scrollspy */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('[data-nav]'));
  var sections = navLinks
    .map(function (l) { return document.getElementById(l.getAttribute('data-nav')); })
    .filter(Boolean);

  function updateActiveNav() {
    if (!document.getElementById('view-home') || document.getElementById('view-home').hidden) {
      navLinks.forEach(function (l) { l.classList.remove('is-active'); });
      return;
    }
    var pos = window.scrollY + window.innerHeight * 0.32;
    var current = sections[0];
    sections.forEach(function (s) { if (s.offsetTop <= pos) current = s; });
    navLinks.forEach(function (l) {
      l.classList.toggle('is-active', current && l.getAttribute('data-nav') === current.id);
    });
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { updateActiveNav(); ticking = false; });
  }, { passive: true });

  /* --------------------------------------------------------------- Lightbox */
  // Case-study shots are background-images on divs, not <img> tags, so the
  // lightbox reads the URL back off the computed style. Opening animates the
  // picture out from the tile that was clicked, which is why that tile's rect
  // is measured before anything is shown.

  var lb = null;          // the overlay, built on first use
  var lbImg, lbCap, lbText, lbCount;
  var lbShots = [];       // the tiles in the case study being browsed
  var lbIndex = 0;
  var lbOpener = null;    // focus goes back here on close
  var lbReduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  function shotSrc(el) {
    var m = /url\((['"]?)(.*?)\1\)/.exec(getComputedStyle(el).backgroundImage);
    return m ? m[2] : '';
  }

  function shotCaption(el) {
    var cap = el.parentNode && el.parentNode.querySelector('figcaption');
    return cap ? cap.textContent.trim() : '';
  }

  function buildLightbox() {
    lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.id = 'lightbox';
    lb.hidden = true;
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Image viewer');
    lb.innerHTML =
      '<button class="lightbox__btn lightbox__close" type="button" aria-label="Close">' +
        '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-close"/></svg></button>' +
      '<button class="lightbox__btn lightbox__prev" type="button" aria-label="Previous image">' +
        '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-chevron-left"/></svg></button>' +
      '<button class="lightbox__btn lightbox__next" type="button" aria-label="Next image">' +
        '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-chevron-right"/></svg></button>' +
      '<figure class="lightbox__stage">' +
        '<img class="lightbox__img" alt="">' +
        '<figcaption class="lightbox__cap">' +
          '<span class="lightbox__count"></span><span class="lightbox__text"></span>' +
        '</figcaption>' +
      '</figure>';
    document.body.appendChild(lb);

    lbImg   = lb.querySelector('.lightbox__img');
    lbCap   = lb.querySelector('.lightbox__cap');
    lbText  = lb.querySelector('.lightbox__text');
    lbCount = lb.querySelector('.lightbox__count');

    lb.querySelector('.lightbox__close').addEventListener('click', closeLightbox);
    lb.querySelector('.lightbox__prev').addEventListener('click', function () { stepLightbox(-1); });
    lb.querySelector('.lightbox__next').addEventListener('click', function () { stepLightbox(1); });

    // Clicking the backdrop dismisses; clicking the picture itself does not.
    lb.addEventListener('click', function (e) {
      if (e.target === lb || e.target.classList.contains('lightbox__stage')) closeLightbox();
    });
  }

  // Grow the picture out of the tile it came from. Called once the image has
  // laid out, so both the start and end rects are real.
  function zoomFrom(rect) {
    if (!rect || lbReduced.matches) return;
    var to = lbImg.getBoundingClientRect();
    if (!to.width || !to.height) return;

    lbImg.style.transition = 'none';
    lbImg.style.transform =
      'translate(' + (rect.left - to.left) + 'px,' + (rect.top - to.top) + 'px) ' +
      'scale(' + (rect.width / to.width) + ',' + (rect.height / to.height) + ')';
    lbImg.getBoundingClientRect();   // flush, so there is a start state to animate from
    lbImg.style.transition = 'transform 0.34s var(--ease)';
    lbImg.style.transform = 'none';
  }

  function renderShot(rect) {
    var el = lbShots[lbIndex];
    lbImg.src = shotSrc(el);
    lbImg.alt = shotCaption(el) || 'Case study image';
    lbText.textContent = shotCaption(el);
    lbCount.textContent = lbShots.length > 1 ? (lbIndex + 1) + ' / ' + lbShots.length : '';
    lbCap.hidden = !lbText.textContent && !lbCount.textContent;

    if (lbImg.complete && lbImg.naturalWidth) zoomFrom(rect);
    else lbImg.onload = function () { zoomFrom(rect); };
  }

  function openLightbox(el) {
    if (!lb) buildLightbox();

    // Paging stays inside the case study that was clicked, not the whole document.
    var scope = el.closest('.view') || document;
    lbShots = Array.prototype.slice.call(scope.querySelectorAll('.shot__img'));
    lbIndex = Math.max(0, lbShots.indexOf(el));
    lbOpener = el;

    lb.classList.toggle('is-solo', lbShots.length < 2);
    lb.hidden = false;
    lockScroll(true);
    renderShot(el.getBoundingClientRect());

    // one frame, so the backdrop fade has a start state
    requestAnimationFrame(function () { lb.classList.add('is-open'); });
    lb.querySelector('.lightbox__close').focus();
  }

  function stepLightbox(delta) {
    if (lbShots.length < 2) return;
    lbIndex = (lbIndex + delta + lbShots.length) % lbShots.length;
    lbImg.style.transition = 'none';
    lbImg.style.transform = 'none';
    renderShot(null);
    lbOpener = lbShots[lbIndex];
  }

  function closeLightbox() {
    if (!lb || lb.hidden) return;

    var back = lbOpener ? lbOpener.getBoundingClientRect() : null;
    lb.classList.remove('is-open');

    // Shrink back into the tile, as long as it still has a box to shrink into.
    if (back && back.width && !lbReduced.matches) {
      var from = lbImg.getBoundingClientRect();
      lbImg.style.transition = 'transform 0.26s var(--ease)';
      lbImg.style.transform =
        'translate(' + (back.left - from.left) + 'px,' + (back.top - from.top) + 'px) ' +
        'scale(' + (back.width / from.width) + ',' + (back.height / from.height) + ')';
    }

    window.setTimeout(function () {
      lb.hidden = true;
      lbImg.removeAttribute('src');
      lbImg.style.transition = 'none';
      lbImg.style.transform = 'none';
      lockScroll(false);
      // after the overlay is gone, so focus does not land behind a live dialog
      if (lbOpener && document.contains(lbOpener)) lbOpener.focus();
    }, lbReduced.matches ? 0 : 260);
  }

  // Holds the page still under the overlay. The padding stops the layout
  // jumping sideways when the scrollbar is taken away.
  function lockScroll(on) {
    if (on) {
      var gap = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.paddingRight = gap > 0 ? gap + 'px' : '';
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.paddingRight = '';
      document.body.style.overflow = '';
    }
  }

  // The tiles are divs, so the button role and keyboard focus are added here
  // rather than in the markup — with JS off there is nothing to open anyway.
  function armShots() {
    var shots = document.querySelectorAll('.shot__img:not([data-zoom])');
    for (var i = 0; i < shots.length; i++) {
      shots[i].setAttribute('data-zoom', 'true');
      shots[i].setAttribute('role', 'button');
      shots[i].setAttribute('tabindex', '0');
      shots[i].setAttribute('aria-label', 'Enlarge: ' + (shotCaption(shots[i]) || 'image'));
    }
  }

  // Capture phase, so Escape closes the lightbox without also closing the menu.
  document.addEventListener('keydown', function (e) {
    if (!lb || lb.hidden) return;
    if (e.key === 'Escape')     { e.stopPropagation(); closeLightbox(); }
    if (e.key === 'ArrowLeft')  stepLightbox(-1);
    if (e.key === 'ArrowRight') stepLightbox(1);
  }, true);

  document.addEventListener('keydown', function (e) {
    var shot = e.target.closest && e.target.closest('.shot__img');
    if (!shot) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(shot); }
  });

  /* ---------------------------------------------------------- Figma embed */
  // Built only when asked. Figma's viewer is heavy, so loading it for everyone
  // who scrolls past would cost far more than the section is worth.
  function mountFigma(wrap) {
    if (!wrap || wrap.getAttribute('data-loaded')) return;
    wrap.setAttribute('data-loaded', 'true');

    var key = wrap.getAttribute('data-figma-file');
    var name = wrap.getAttribute('data-figma-name') || 'file';
    var theme = root.classList.contains('dark') ? 'dark' : 'light';

    var frame = document.createElement('iframe');
    frame.src = 'https://embed.figma.com/design/' + key + '/' + name +
                '?embed-host=portfolio&page-selector=1&viewer=1&theme=' + theme;
    frame.title = 'Segstream Design System in Figma';
    frame.setAttribute('allow', 'fullscreen');
    frame.setAttribute('allowfullscreen', 'true');
    frame.setAttribute('loading', 'lazy');

    wrap.innerHTML = '';
    wrap.appendChild(frame);
  }

  /* --------------------------------------------------------- Contact form */
  var confirmSent = null;   // set below; invoked from Boot once routing has run
  // Posts to FormSubmit, which relays the message to the address in the form's
  // action. Without JS the plain form POST still works — it just navigates away.
  var contactForm = document.getElementById('contact-form');
  if (contactForm) {
    var cfStatus = document.getElementById('cf-status');
    var cfSubmit = document.getElementById('cf-submit');

    // The form posts natively so FormSubmit can serve its captcha challenge —
    // intercepting with fetch would only ever receive the challenge, not a send.
    contactForm.addEventListener('submit', function () {
      if (!contactForm.checkValidity()) return;   // let the browser show its own prompts

      cfStatus.className = 'form__status';
      cfStatus.textContent = 'Taking you to a quick human check…';
      contactForm.classList.add('is-sending');
      // deferred: disabling a submit button synchronously can cancel the post
      setTimeout(function () { cfSubmit.disabled = true; }, 0);
    });

    // FormSubmit sends people back to ?sent=1 once the captcha is cleared.
    // Called from Boot, after routing, so it isn't immediately overridden.
    confirmSent = function () {
      if (new URLSearchParams(location.search).get('sent') !== '1') return;
      showView('contact-form', false);
      cfStatus.className = 'form__status is-ok';
      cfStatus.textContent = 'Thanks — your message is on its way. I’ll reply by email.';
      // drop the flag so a refresh doesn't repeat the confirmation
      history.replaceState({}, '', location.pathname + '#contact-form');
    };
  }

  /* ------------------------------------------------------------------ Boot */
  // Stamped rather than hard-coded, so the footer can't quietly go stale again.
  var year = String(new Date().getFullYear());
  var stamps = document.querySelectorAll('[data-year]');
  for (var y = 0; y < stamps.length; y++) stamps[y].textContent = year;

  setCollapsed(localStorage.getItem('sidebar') === 'collapsed');
  routeFromHash();
  if (confirmSent) confirmSent();
  revealAll(document);
  armShots();
  updateActiveNav();
})();
