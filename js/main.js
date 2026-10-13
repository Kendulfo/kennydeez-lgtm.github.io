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

  // Consulted by the lightbox, the story rails and the scroll effects, so it
  // lives here rather than inside whichever one happened to need it first.
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

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

    // Instant, not smooth. html carries scroll-behavior: smooth so anchor links
    // glide, but that turned opening a case study into a long animated scroll up
    // through a page the reader has not read yet — and every reveal passed
    // through the viewport on the way, so arriving at the top there was nothing
    // left to fade in.
    //
    // It has to be the behavior option. Setting scroll-behavior: auto inline
    // around the call does nothing: the scroll resolves its behaviour after the
    // property has been put back, so it still glides. Measured both.
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch (err) {
      window.scrollTo(0, 0);   // old engines reject the unknown enum value
    }

    revealAll(target);
    syncVideos(target);
    armShots();
    syncRails(target);
    paintScroll();
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

  // Nothing waits longer than six steps, so no element is more than 330ms
  // behind the first. A group arriving at once would otherwise leave the last
  // one hanging most of a second after the first, which stops reading as one
  // movement and starts reading as a queue. Six rather than five because at
  // five the last three items of the About column shared a beat.
  var MAX_STAGGER = 6;

  // Which things move like blocks rather than like text. Matched here rather
  // than tagged in the markup, so the rule lives in one place.
  var BLOCKISH = '.card, figure, .shot, .cs__hero-img, .portrait, .showcase-grid,' +
                 ' .results, .steps, .rail, .credits, .personas, .testimonial,' +
                 ' .cafe-open, .figma-embed, dl, img, video';

  var io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (entries) {
      // Entries that cross together arrive in one callback, which is exactly
      // the set that should cascade. Counting per callback means an element
      // reaching the screen alone is index 0 and starts immediately.
      var seen = new Map();

      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        var el = entry.target;
        // The section is the group, not the parent. Grouping by parent split
        // About's copy from its stat cards — two columns of one thought, each
        // restarting its own count and arriving on top of each other.
        var group = el.closest('section, .view') || document.body;
        var n = seen.get(group) || 0;
        seen.set(group, n + 1);

        el.style.setProperty('--i', Math.min(n, MAX_STAGGER));
        el.classList.add('is-visible');
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
  }

  // Case studies carried no reveal at all — open one and every section was
  // simply already there. Marking them here rather than by hand keeps sixty-odd
  // sections out of the markup and the rule in one place.
  //
  // Body paragraphs are deliberately left out. Fading in every paragraph of a
  // long read is what makes a portfolio feel slow to actually read; the
  // structure around them is what benefits from arriving.
  function markCaseStudies(scope) {
    var sections = (scope || document).querySelectorAll('.prose > section');
    for (var i = 0; i < sections.length; i++) {
      var kids = sections[i].children;
      for (var k = 0; k < kids.length; k++) {
        var el = kids[k];
        if (el.tagName === 'P' || el.classList.contains('reveal')) continue;
        el.classList.add('reveal');
      }
    }
    var heroes = (scope || document).querySelectorAll('.cs__hero-img, .cs__meta');
    for (var h = 0; h < heroes.length; h++) heroes[h].classList.add('reveal');
  }

  function markBlocks(scope) {
    var els = (scope || document).querySelectorAll('.reveal');
    for (var i = 0; i < els.length; i++) {
      if (els[i].matches(BLOCKISH)) els[i].classList.add('reveal--block');
    }
  }

  function revealAll(scope) {
    markCaseStudies(scope);
    markBlocks(scope);
    var els = (scope || document).querySelectorAll('.reveal:not(.is-visible)');
    for (var i = 0; i < els.length; i++) {
      if (io) io.observe(els[i]);
      else els[i].classList.add('is-visible');
    }
  }

  // IntersectionObserver samples; it does not track. Jump far enough in one go
  // — an anchor link, a scrollbar drag, End — and an element can pass through
  // the viewport between two samples and never be reported, leaving it
  // invisible for good. This sweeps up anything the scroll has already gone
  // past. It runs when scrolling stops rather than per frame, because the only
  // elements it can help are ones nobody is looking at.
  function catchUpReveals() {
    if (!io) return;
    var els = document.querySelectorAll('.reveal:not(.is-visible)');
    for (var i = 0; i < els.length; i++) {
      if (els[i].getBoundingClientRect().bottom < 0) {
        els[i].classList.add('is-visible');
        io.unobserve(els[i]);
      }
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


  function shotSrc(el) {
    var m = /url\((['"]?)(.*?)\1\)/.exec(getComputedStyle(el).backgroundImage);
    return m ? m[2] : '';
  }

  // Storyboard beats are list items with a heading rather than figures with a
  // caption, so without the fallback they open captionless and announce
  // themselves as "Enlarge: image".
  function shotCaption(el) {
    var parent = el.parentNode;
    if (!parent) return '';
    var cap = parent.querySelector('figcaption') || parent.querySelector('.sb__kicker');
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
    if (!rect || reduced.matches) return;
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
    if (back && back.width && !reduced.matches) {
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
    }, reduced.matches ? 0 : 260);
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

  /* -------------------------------------------------------- Story rails */
  // The storyboards read left to right. Dragging and the scrollbar come free;
  // these are the arrows, and the part that knows when there is nothing left
  // to page to.

  function railStep(rail) {
    var card = rail.querySelector('.sb__beat');
    if (!card) return rail.clientWidth;
    var gap = parseFloat(getComputedStyle(rail).columnGap) || 0;
    return card.getBoundingClientRect().width + gap;
  }

  function syncRail(rail) {
    var wrap = rail.parentNode;
    var max = rail.scrollWidth - rail.clientWidth;
    var prev = wrap.querySelector('.rail__btn--prev');
    var next = wrap.querySelector('.rail__btn--next');
    // A couple of pixels of slack: sub-pixel widths never land on the end exactly.
    if (prev) prev.disabled = rail.scrollLeft <= 2;
    if (next) next.disabled = rail.scrollLeft >= max - 2;
    wrap.classList.toggle('is-scrollable', max > 2);
  }

  // A hidden view measures zero, so arrow state cannot be settled at boot —
  // showView re-syncs whatever it has just revealed.
  function syncRails(scope) {
    var rails = (scope || document).querySelectorAll('.sb');
    for (var i = 0; i < rails.length; i++) syncRail(rails[i]);
  }

  function armRails() {
    var rails = document.querySelectorAll('.sb');

    function wire(rail) {
      // Where the arrows are steering to, or null when the reader is driving.
      // Without it a second click lands while the first smooth scroll is still
      // running, measures the position it happens to be passing through, and
      // asks for roughly where it was already going — so holding the arrow down
      // advances one card instead of nine.
      var want = null;
      var settle;

      // Snap also settles after the last scroll event, so syncing on the event
      // alone reads a mid-flight position and leaves Next enabled at the end of
      // the story. The trailing call is the one that sees where it landed.
      rail.addEventListener('scroll', function () {
        syncRail(rail);
        clearTimeout(settle);
        settle = setTimeout(function () {
          want = null;
          syncRail(rail);
        }, 140);
      }, { passive: true });

      var btns = rail.parentNode.querySelectorAll('.rail__btn');
      for (var b = 0; b < btns.length; b++) {
        btns[b].addEventListener('click', function (e) {
          var dir = e.currentTarget.classList.contains('rail__btn--next') ? 1 : -1;
          var max = rail.scrollWidth - rail.clientWidth;
          var from = want === null ? rail.scrollLeft : want;
          want = Math.max(0, Math.min(max, from + dir * railStep(rail)));
          rail.scrollTo({ left: want, behavior: reduced.matches ? 'auto' : 'smooth' });
        });
      }
    }

    for (var i = 0; i < rails.length; i++) wire(rails[i]);
    window.addEventListener('resize', function () { syncRails(document); });
  }

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
    frame.title = name.replace(/-+/g, ' ').trim() + ' in Figma';
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

  /* ------------------------------------------------- Brew: platform CTA */
  // Web Bluetooth is what decides the route. Chrome on Android and desktop has
  // it; iOS does not at all, so an iPhone needs Bluefy before a Dot can connect.
  // Both links are already in the markup — this only picks which one leads.
  function brewCta() {
    var cta = document.querySelector('[data-brew-cta]');
    if (!cta) return;
    var note   = cta.querySelector('[data-brew-note]');
    var open   = cta.querySelector('[data-brew-open]');
    var bluefy = cta.querySelector('[data-brew-bluefy]');
    if (!note || !open || !bluefy) return;

    var ua = navigator.userAgent || '';
    // iPadOS reports as Mac, so the touch check is what separates it from a desktop
    var isIOS = /iPad|iPhone|iPod/.test(ua) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var isAndroid = /Android/.test(ua);
    var hasBle = typeof navigator.bluetooth !== 'undefined';

    function lead(el) { el.className = 'btn btn--primary'; }
    function follow(el) { el.className = 'btn btn--outline'; }

    if (isIOS) {
      cta.setAttribute('data-state', 'ios');
      // the App Store link is the one that unblocks them, so it goes first
      bluefy.parentNode.insertBefore(bluefy, open);
      lead(bluefy); follow(open);
      note.textContent = 'You are on iOS, where Safari cannot reach Bluetooth at all. ' +
        'Install Bluefy, then open the app inside it to connect your Dot. ' +
        'Tapping through here gives you the timer version.';
    } else if (hasBle) {
      cta.setAttribute('data-state', 'ready');
      bluefy.hidden = true;
      note.textContent = isAndroid
        ? 'You are on Android, so this browser talks to the Dot directly — open it and hit Connect.'
        : 'This browser supports Web Bluetooth, so you can connect a Dot directly — open it and hit Connect.';
    } else {
      cta.setAttribute('data-state', 'nobt');
      note.textContent = 'This browser cannot reach Bluetooth, so you will get the timer version. ' +
        'Chrome on Android or desktop connects to a Dot directly; on an iPhone, use Bluefy.';
    }
  }

  /* ------------------------------------------------- Scroll-driven effects */
  // Two effects share one scroll loop: the hero's layers drifting against each
  // other, and the statement under it lighting word by word while pinned.

  // How much of the pinned scroll is spent lighting words. The remainder is a
  // beat where the finished sentence sits still before the page releases —
  // without it the last word lights at the exact moment the text starts
  // leaving, and the completed sentence is never actually seen.
  var LIGHT_THROUGH = 0.97;

  // Rebuilding the sentence one element per word is done here rather than in
  // the markup: nobody should hand-wrap forty words, and with JS off the
  // sentence stays a sentence.
  function splitWords(el) {
    var words = el.textContent.trim().split(/\s+/);
    var out = [];
    el.textContent = '';
    for (var i = 0; i < words.length; i++) {
      var w = document.createElement('w');
      w.textContent = words[i];
      el.appendChild(w);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
      out.push(w);
    }
    return out;
  }

  var says = [].slice.call(document.querySelectorAll('[data-say]')).map(function (el) {
    return { el: el, pin: el.closest('.say-pin'), words: splitWords(el) };
  });

  var fadeLayers = [].slice.call(document.querySelectorAll('[data-fade]'));

  function paintSay(s) {
    // A hidden view measures zero and every word would read as lit. Same trap
    // as the story rails.
    if (!s.pin || !s.pin.offsetParent) return;

    var travel = s.pin.offsetHeight - window.innerHeight;
    if (travel <= 0 || reduced.matches) {           // unpinned: show it whole
      for (var k = 0; k < s.words.length; k++) {
        s.words[k].style.color = '';
        s.words[k].style.opacity = '';
      }
      return;
    }

    // The section's travel past the top of the viewport IS the progress:
    // offsetHeight - innerHeight is exactly how far it stays stuck.
    var p = (-s.pin.getBoundingClientRect().top / travel) / LIGHT_THROUGH;
    p = Math.max(0, Math.min(1, p));

    // The +6/-3 gives a soft leading edge instead of a hard wipe.
    var lead = p * (s.words.length + 6) - 3;
    for (var i = 0; i < s.words.length; i++) {
      var t = Math.max(0, Math.min(1, lead - i));
      s.words[i].style.color = t > 0.5 ? 'var(--fg)' : 'var(--say-dim)';
      s.words[i].style.opacity = 0.35 + t * 0.65;
    }
  }

  // The hero used to drift its layers at different speeds. The headline moved
  // down while the buttons underneath it did not, so on the way out the
  // descenders of "Designer." sat across "View Work". It fades instead —
  // depth without two things occupying the same place.
  // Fading from the moment the reader scrolls, over half a viewport. Keying it
  // to the hero's own top crossing the screen edge meant nothing happened for
  // the first couple of hundred pixels and the rest was spent off-screen — a
  // fade nobody was around to see.
  var FADE_OVER = 0.5;

  function paintFade() {
    var vh = window.innerHeight;
    for (var i = 0; i < fadeLayers.length; i++) {
      var el = fadeLayers[i];
      if (!el.offsetParent) continue;

      // The section's resting offset in the document, not its live position,
      // so the hero need not be the first thing on the page.
      var sec = el.closest('.section') || el;
      var start = sec.getBoundingClientRect().top + window.scrollY;

      var p = (window.scrollY - start) / (vh * FADE_OVER);
      el.style.opacity = 1 - Math.max(0, Math.min(1, p));
    }
  }

  function paintScroll() {
    if (!reduced.matches) paintFade();
    for (var i = 0; i < says.length; i++) paintSay(says[i]);
  }

  var scrollTicking = false;
  var revealSettle;
  function onScrollEffects() {
    clearTimeout(revealSettle);
    revealSettle = setTimeout(catchUpReveals, 160);

    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(function () {
      paintScroll();
      scrollTicking = false;
    });
  }

  // Armed unconditionally: even with no statement and no fade on a page, the
  // reveal catch-up rides on this listener and is needed everywhere. The
  // painters loop over empty lists and cost nothing.
  function armScrollEffects() {
    window.addEventListener('scroll', onScrollEffects, { passive: true });
    window.addEventListener('resize', onScrollEffects);
    paintScroll();
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
  armRails();
  syncRails(document);
  armScrollEffects();
  brewCta();
  updateActiveNav();
})();
