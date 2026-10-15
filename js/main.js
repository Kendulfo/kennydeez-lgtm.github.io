/* ==========================================================================
   Kenneth Dulfo — Portfolio
   Vanilla JS: view routing, header state, scroll reveal and effects.
   ========================================================================== */
(function () {
  'use strict';

  var root    = document.documentElement;

  // Consulted by the lightbox, the story rails and the scroll effects, so it
  // lives here rather than inside whichever one happened to need it first.
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* --------------------------------------------------------------- Header */
  // Transparent over the hero, solid once the page moves. Reading down tucks
  // it away; any move back up brings it back.
  var nav = document.getElementById('site-nav');
  var lastY = window.scrollY;

  function paintNav() {
    if (!nav) return;
    var y = window.scrollY;
    nav.classList.toggle('is-solid', y > 24);
    var goingDown = y > lastY + 4;
    var goingUp = y < lastY - 4;
    if (y < 120 || goingUp) nav.classList.remove('is-tucked');
    else if (goingDown) nav.classList.add('is-tucked');
    if (goingDown || goingUp) lastY = y;
  }

  function setMenu(open) {
    if (!nav) return;
    nav.classList.toggle('is-open', open);
    var btn = nav.querySelector('[data-action="menu"]');
    if (btn) {
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? 'Close' : 'Menu';
    }
  }

  /* ------------------------------------------------------------ Card fan */
  // The three covers under the hero start stacked and fan out as the panel
  // rises into view. One custom property drives it; CSS does the geometry.
  var fan = document.querySelector('[data-fan]');

  function paintFan() {
    if (!fan || reduced.matches || !fan.offsetParent) return;
    var r = fan.getBoundingClientRect();
    var vh = window.innerHeight;
    // 0 while the fan sits at the bottom edge, 1 once its middle reaches the
    // middle of the screen.
    var p = (vh - r.top) / (vh / 2 + r.height / 2);
    p = Math.max(0, Math.min(1, p));
    var eased = 1 - Math.pow(1 - p, 3);
    fan.style.setProperty('--spread', (0.35 + eased * 0.65).toFixed(3));
  }

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

    setMenu(false);
    revealAll(target);
    syncVideos(target);
    armShots();
    syncRails(target);
    paintScroll();
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

  /* ------------------------------------------------------- Global actions */
  document.addEventListener('click', function (e) {
    var shot = e.target.closest('.shot__img');
    if (shot) { openLightbox(shot); return; }

    var actionEl = e.target.closest('[data-action]');
    if (actionEl) {
      var action = actionEl.getAttribute('data-action');
      if (action === 'menu')       { setMenu(!nav.classList.contains('is-open')); return; }
      if (action === 'load-figma') { mountFigma(actionEl.closest('.figma-embed')); return; }
      if (action === 'back')       { showView('home'); return; }
    }

    // Project cards, next-project cards, and anything else that opens a view
    var viewEl = e.target.closest('[data-case], [data-view]');
    if (viewEl) {
      // Some of these are real links (#case/aia) so they can be opened in a
      // new tab; here the router handles them instead of the hash change.
      e.preventDefault();
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
        setMenu(false);
        if (document.getElementById('view-home').hidden) {
          showView('home', false);
          history.replaceState({ view: 'home' }, '', '#' + id);
        }
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  window.addEventListener('popstate', routeFromHash);

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
        // Result figures arrive card by card, the way the About stats do,
        // rather than the whole grid fading in as one block.
        if (el.classList.contains('results')) {
          for (var r = 0; r < el.children.length; r++) el.children[r].classList.add('reveal');
          continue;
        }
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
    // Nothing is current while the reader is still above the first section.
    var current = null;
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

  /* --------------------------------------------------------- Media parallax */
  // Photographs drift inside their frames as those frames cross the screen.
  // The media overscans by 6% so there is room to move without a gap opening
  // at either edge.
  //
  // Only on photographs that fill their frame. The UI screenshots, the
  // storyboard panels and the letterboxed tiles are left alone: they are
  // aspect-matched or contain-fitted to their source, so drifting them either
  // crops the design you are meant to be looking at or shows the frame behind.
  var DRIFT       = 2.5;    // percent of its own height, each way
  var DRIFT_SCALE = 1.06;
  var DRIFT_BG    = 15;     // background-position percent, each way

  var DRIFT_ZOOM  = 5;      // percent of overscan gained across the crossing

  var driftImgs  = [];
  var driftBgs   = [];
  var driftZooms = [];

  /* ------------------------------------------------------------- Counters */
  // The figures count up to themselves when their card arrives. Each one keeps
  // whatever sits around the number — the "+" on "200+" — so the markup stays
  // the source of truth and nothing has to be restated in script.
  var COUNT_MS = 1100;

  function armCounters() {
    var nums = document.querySelectorAll('.stat__num, .result__num');
    if (!nums.length || !('IntersectionObserver' in window)) return;

    var seen = new WeakSet();

    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || seen.has(entry.target)) return;
        seen.add(entry.target);
        co.unobserve(entry.target);
        runCounter(entry.target);
      });
    }, { threshold: 0.4 });

    for (var i = 0; i < nums.length; i++) {
      var m = /^(\D*)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(nums[i].textContent.trim());
      if (!m) continue;                       // "Named", "Shipped" and friends
      // "24/7", "6→1" and "1st" read as nonsense halfway up, so they stay put.
      if (/\d/.test(m[3]) || /^(st|nd|rd|th)\b/i.test(m[3])) continue;
      nums[i].dataset.pre = m[1];
      nums[i].dataset.to = m[2].replace(/,/g, '');
      nums[i].dataset.dec = (m[2].split('.')[1] || '').length;
      nums[i].dataset.post = m[3];
      co.observe(nums[i]);
    }
  }

  function runCounter(el) {
    var to = parseFloat(el.dataset.to);
    var dec = parseInt(el.dataset.dec, 10) || 0;   // "4.8" counts in tenths
    var pre = el.dataset.pre || '';
    var post = el.dataset.post || '';

    if (reduced.matches) { el.textContent = pre + to.toFixed(dec) + post; return; }

    // Falls in behind its own card, which is already staggered by --i.
    var delay = (parseFloat(getComputedStyle(el.closest('.reveal') || el).getPropertyValue('--i')) || 0) * 55;
    var t0 = null;

    function step(now) {
      if (t0 === null) t0 = now;
      var t = Math.min(1, (now - t0) / COUNT_MS);
      // Decelerating, so it lands on the number rather than stopping dead.
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = pre + (to * eased).toFixed(dec) + post;
      if (t < 1) requestAnimationFrame(step);
    }

    el.textContent = pre + (0).toFixed(dec) + post;
    setTimeout(function () { requestAnimationFrame(step); }, delay);
  }

  function armDrift() {
    var imgs = document.querySelectorAll('.project__media img, .portrait img');
    for (var i = 0; i < imgs.length; i++) {
      driftImgs.push({ el: imgs[i], frame: imgs[i].parentElement });
    }
    driftBgs = [].slice.call(document.querySelectorAll('.cs__hero-img'));

    // Storyboard panels cannot slide: their role tag is flush against the top
    // edge with nothing above it, so any pan cuts it. They overscan from a
    // corner anchor instead, which moves the art against its frame without
    // ever moving the tag.
    driftZooms = [].slice.call(document.querySelectorAll('.sb__beat .shot__img'));
  }

  // 0 as the frame enters the bottom of the screen, 1 as it leaves the top.
  // null when it is nowhere near, or in a hidden view, which measures zero.
  function frameProgress(frame, vh) {
    var r = frame.getBoundingClientRect();
    if (!r.height || r.bottom < 0 || r.top > vh) return null;
    return (vh - r.top) / (vh + r.height);
  }

  function paintDrift() {
    if (reduced.matches) return;
    var vh = window.innerHeight;

    for (var i = 0; i < driftImgs.length; i++) {
      var p = frameProgress(driftImgs[i].frame, vh);
      if (p === null) continue;
      driftImgs[i].el.style.transform =
        'translateY(' + ((p - 0.5) * DRIFT * 2).toFixed(3) + '%) scale(' + DRIFT_SCALE + ')';
    }

    // The case-study covers are background images rather than elements, so
    // they pan their background instead of transforming. Where a cover happens
    // to match its frame's proportions there is nothing to pan and this does
    // nothing, which is the right answer rather than a gap.
    for (var j = 0; j < driftBgs.length; j++) {
      var q = frameProgress(driftBgs[j], vh);
      if (q === null) continue;
      driftBgs[j].style.backgroundPosition =
        'center ' + (50 + (q - 0.5) * DRIFT_BG * 2).toFixed(2) + '%';
    }

    for (var k = 0; k < driftZooms.length; k++) {
      var z = frameProgress(driftZooms[k], vh);
      if (z === null) continue;
      // Never exactly 100: a hairline of overscan keeps sub-pixel rounding
      // from showing the tile behind the art.
      driftZooms[k].style.backgroundSize = (101 + z * DRIFT_ZOOM).toFixed(2) + '% auto';
    }
  }

  function paintScroll() {
    paintNav();
    paintFan();
    paintDrift();
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

  // Armed unconditionally: the reveal catch-up rides on this listener and is
  // needed everywhere, and the painters return early where they have nothing
  // to do.
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

  routeFromHash();
  if (confirmSent) confirmSent();
  revealAll(document);
  armShots();
  armRails();
  syncRails(document);
  armDrift();
  armCounters();
  armScrollEffects();
  brewCta();
  updateActiveNav();
})();
