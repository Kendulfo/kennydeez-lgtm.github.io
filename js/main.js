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
  setCollapsed(localStorage.getItem('sidebar') === 'collapsed');
  routeFromHash();
  if (confirmSent) confirmSent();
  revealAll(document);
  updateActiveNav();
})();
