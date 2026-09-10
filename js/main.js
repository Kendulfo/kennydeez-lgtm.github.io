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

  /* ------------------------------- Component showcase marquee (AIA study) */
  var demos = [
    '<div class="demo"><span class="demo__btn demo__btn--primary">Get Started</span><span class="demo__label">Primary Button</span></div>',
    '<div class="demo"><span class="demo__btn demo__btn--secondary">Learn More</span><span class="demo__label">Secondary Button</span></div>',
    '<div class="demo"><input class="demo__input" placeholder="you@email.com" disabled><span class="demo__label">Input Field</span></div>',
    '<div class="demo"><span class="chip">New Feature</span><span class="demo__label">Badge Component</span></div>',
    '<div class="demo" style="align-items:flex-start"><strong style="font-size:13px">Card Title</strong><span style="font-size:12px;color:var(--muted-fg)">Card description text here</span><span class="demo__label">Card Component</span></div>',
    '<div class="demo"><span class="demo__switch"></span><span class="demo__label">Toggle Switch</span></div>',
    '<div class="demo"><span class="demo__bar"><i></i></span><span class="demo__label">Progress Bar — 75%</span></div>',
    '<div class="demo"><span class="demo__avatar">KD</span><span class="demo__label">Avatar</span></div>',
    '<div class="demo"><span class="demo__btn demo__btn--destruct">Delete</span><span class="demo__label">Destructive Button</span></div>',
    '<div class="demo"><span class="demo__btn demo__btn--outline">Cancel</span><span class="demo__label">Outline Button</span></div>'
  ].join('');

  var marquee = document.getElementById('marquee');
  if (marquee) {
    // Duplicated once so the -50% translate loops seamlessly.
    marquee.innerHTML =
      '<div class="marquee__row">' + demos + '</div>' +
      '<div class="marquee__row" aria-hidden="true">' + demos + '</div>';
  }

  /* --------------------------------------------------------- Contact form */
  // Posts to FormSubmit, which relays the message to the address in the form's
  // action. Without JS the plain form POST still works — it just navigates away.
  var contactForm = document.getElementById('contact-form');
  if (contactForm) {
    var cfStatus = document.getElementById('cf-status');
    var cfSubmit = document.getElementById('cf-submit');

    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!contactForm.checkValidity()) { contactForm.reportValidity(); return; }

      cfStatus.className = 'form__status';
      cfStatus.textContent = 'Sending…';
      contactForm.classList.add('is-sending');
      cfSubmit.disabled = true;

      // Same endpoint, /ajax/ prefix — returns JSON instead of redirecting.
      var endpoint = contactForm.action.replace('formsubmit.co/', 'formsubmit.co/ajax/');

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(contactForm)
      })
        .then(function (r) {
          return r.json().catch(function () { return {}; });
        })
        .then(function (data) {
          var ok = data && (data.success === true || data.success === 'true');
          if (!ok) throw new Error((data && data.message) || 'Send failed');
          contactForm.reset();
          cfStatus.className = 'form__status is-ok';
          cfStatus.textContent = 'Thanks — your message is on its way.';
        })
        .catch(function () {
          cfStatus.className = 'form__status is-error';
          cfStatus.textContent = 'Could not send. Please email kendulfo@gmail.com directly.';
        })
        .then(function () {
          contactForm.classList.remove('is-sending');
          cfSubmit.disabled = false;
        });
    });
  }

  /* ------------------------------------------------------------------ Boot */
  setCollapsed(localStorage.getItem('sidebar') === 'collapsed');
  routeFromHash();
  revealAll(document);
  updateActiveNav();
})();
