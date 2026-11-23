/*
 * Portfolio interactions.
 *
 * The project sheet follows Apple's fluid-interface rules:
 *  - it is driven by a spring (damping ratio + response), never a fixed-duration tween;
 *  - every animation starts from the current on-screen value, so it can be grabbed mid-flight;
 *  - dragging tracks the pointer 1:1, rubber-bands past the top, and on release hands the
 *    finger's velocity to the spring and projects momentum to decide open vs. dismiss.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Lets :active (press feedback) fire on touch-down in iOS Safari.
  document.addEventListener('touchstart', function () {}, { passive: true });

  /* ------------------------------------------------------------------
     Navigation: show the edge only when content is under the bar,
     and mark the section you are in (wayfinding).
     ------------------------------------------------------------------ */
  var nav = document.getElementById('nav');
  function onScroll() { nav.classList.toggle('scrolled', window.scrollY > 2); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var navLinks = Array.prototype.slice.call(document.querySelectorAll('[data-section]'));
  var visible = {};
  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting; });
      var current = null;
      navLinks.forEach(function (a) { if (visible[a.dataset.section]) current = a; });
      navLinks.forEach(function (a) {
        if (a === current) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    navLinks.forEach(function (a) {
      var s = document.getElementById(a.dataset.section);
      if (s) spy.observe(s);
    });
  }

  /* ------------------------------------------------------------------
     Reveal on scroll
     ------------------------------------------------------------------ */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
    Array.prototype.forEach.call(reveals, function (el) { io.observe(el); });
  } else {
    Array.prototype.forEach.call(reveals, function (el) { el.classList.add('in'); });
  }

  /* ------------------------------------------------------------------
     Spring, in Apple's designer-friendly terms.
     dampingRatio: 1 = no overshoot, < 1 = bounce.
     response: seconds to (roughly) reach the target. Not a duration.
     ------------------------------------------------------------------ */
  function Spring() {
    this.value = 0;
    this.velocity = 0;   // px/s
    this.target = 0;
    this.configure(1, 0.4);
  }
  Spring.prototype.configure = function (dampingRatio, response) {
    var omega = (2 * Math.PI) / response;
    this.stiffness = omega * omega;                 // unit mass
    this.damping = 2 * dampingRatio * omega;        // = 4πζ / response
  };
  Spring.prototype.step = function (dt) {
    var force = -this.stiffness * (this.value - this.target) - this.damping * this.velocity;
    this.velocity += force * dt;                    // semi-implicit Euler: stable at small dt
    this.value += this.velocity * dt;
  };
  Spring.prototype.settled = function () {
    return Math.abs(this.velocity) < 3 && Math.abs(this.value - this.target) < 0.4;
  };

  // Apple's momentum projection (from the Designing Fluid Interfaces sample code).
  function project(velocity, decelerationRate) {
    var d = decelerationRate || 0.998;
    return (velocity / 1000) * d / (1 - d);
  }

  // Progressive resistance past a boundary instead of a hard stop.
  function rubberband(overshoot, dimension) {
    var c = 0.55;
    return (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));
  }

  /* ------------------------------------------------------------------
     Project sheet
     ------------------------------------------------------------------ */
  var page = document.getElementById('page');
  var sheet = document.getElementById('sheet');
  var scrim = document.getElementById('scrim');
  var handle = document.getElementById('sheet-handle');
  var body = document.getElementById('sheet-body');
  var titleEl = document.getElementById('sheet-title');
  var eyebrowEl = document.getElementById('sheet-eyebrow');
  var closeBtn = document.getElementById('sheet-close');

  var spring = new Spring();
  var closedY = 800;        // translateY that puts the sheet fully off-screen
  var raf = 0;
  var lastTime = 0;
  var trigger = null;       // element to return focus to
  var historyPushed = false;
  var drag = null;

  function isOpenish() { return !sheet.hidden && spring.target === 0; }

  function measure() {
    closedY = sheet.offsetHeight + 24;
  }

  function render(y) {
    sheet.style.transform = 'translate3d(0,' + y.toFixed(2) + 'px,0)';
    var p = Math.max(0, Math.min(1, 1 - y / closedY));   // 0 closed → 1 open
    scrim.style.opacity = p.toFixed(3);
    if (!reduceMotion.matches) {
      // Dim to focus: the page steps back as the sheet comes forward.
      page.style.transform = 'scale(' + (1 - 0.03 * p).toFixed(4) + ')';
    }
  }

  function tick(now) {
    var dt = Math.min((now - lastTime) / 1000, 1 / 30);
    lastTime = now;
    var h = 1 / 240;
    while (dt > 0) {
      var s = Math.min(h, dt);
      spring.step(s);
      dt -= s;
    }
    if (spring.settled()) {
      spring.value = spring.target;
      spring.velocity = 0;
      render(spring.value);
      raf = 0;
      if (spring.target !== 0) finishClose();
      return;
    }
    render(spring.value);
    raf = requestAnimationFrame(tick);
  }

  function run() {
    if (raf) return;
    lastTime = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function halt() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function fade(el, from, to, done) {
    if (el.animate) {
      var a = el.animate([{ opacity: from }, { opacity: to }], { duration: 200, easing: 'ease' });
      if (done) a.onfinish = done;
    } else if (done) {
      done();
    }
  }

  function open(id, from) {
    var tpl = document.getElementById('t-' + id);
    if (!tpl) return false;

    trigger = from || trigger;
    eyebrowEl.textContent = tpl.getAttribute('data-eyebrow') || '';
    titleEl.textContent = tpl.getAttribute('data-title') || '';
    body.replaceChildren(tpl.content.cloneNode(true));
    body.scrollTop = 0;
    handle.classList.remove('edge');

    var wasClosed = sheet.hidden;
    if (wasClosed) {
      // Push the page back around the middle of what you are looking at.
      page.style.transformOrigin = '50% ' + (window.scrollY + window.innerHeight / 2) + 'px';
      root.classList.add('sheet-open');
      page.inert = true;
      scrim.hidden = false;
      sheet.hidden = false;
      measure();
      spring.value = closedY;
      spring.velocity = 0;
      if (!historyPushed) {
        history.pushState({ sheet: id }, '');
        historyPushed = true;
      }
    } else {
      measure();
    }

    spring.target = 0;
    if (reduceMotion.matches) {
      // Reduced motion: a cross-fade instead of a slide.
      halt();
      spring.value = 0;
      spring.velocity = 0;
      render(0);
      if (wasClosed) { fade(sheet, 0, 1); fade(scrim, 0, 1); }
    } else {
      spring.configure(1, 0.42);   // no momentum behind a tap, so no bounce
      run();                       // continues from the current value if it was closing
    }

    titleEl.focus({ preventScroll: true });
    return true;
  }

  function close() {
    if (sheet.hidden || spring.target !== 0) return;
    measure();
    spring.target = closedY;
    if (reduceMotion.matches) {
      halt();
      fade(sheet, 1, 0, finishClose);
      fade(scrim, 1, 0);
    } else {
      spring.configure(1, 0.36);
      run();
    }
  }

  // Close from the UI (button, scrim, Esc): also drop the history entry we added,
  // so the Back button never reopens a sheet you already closed.
  function requestClose() {
    close();
    if (historyPushed) {
      historyPushed = false;
      history.back();
    }
  }

  function finishClose() {
    halt();
    sheet.hidden = true;
    scrim.hidden = true;
    sheet.style.transform = '';
    scrim.style.opacity = '';
    page.style.transform = '';
    page.style.transformOrigin = '';
    page.inert = false;
    root.classList.remove('sheet-open');
    body.replaceChildren();
    if (trigger && document.contains(trigger)) trigger.focus({ preventScroll: true });
    trigger = null;
  }

  // Back button / Android back gesture closes the sheet.
  window.addEventListener('popstate', function () {
    if (isOpenish()) {
      historyPushed = false;
      close();
    }
  });

  // Tiles and game cards open the sheet. Modified clicks keep their normal behaviour
  // (open the GitHub link in a new tab), so you stay in control.
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-sheet]');
    if (!t || e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (open(t.getAttribute('data-sheet'), t)) e.preventDefault();
  });

  scrim.addEventListener('click', requestClose);
  closeBtn.addEventListener('click', requestClose);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpenish()) {
      e.preventDefault();
      requestClose();
    }
  });

  // Scroll edge effect inside the sheet: a hairline only once content slides under the header.
  body.addEventListener('scroll', function () {
    handle.classList.toggle('edge', body.scrollTop > 0);
  }, { passive: true });

  window.addEventListener('resize', function () {
    if (sheet.hidden) return;
    var wasClosing = spring.target !== 0;
    measure();
    if (wasClosing) spring.target = closedY;
    else if (!raf) render(spring.value);
  });

  /* ---------- Drag to dismiss ---------- */

  function sampleVelocity(samples) {
    // px/s over the last ~80 ms; zero if the finger has been resting.
    var last = samples[samples.length - 1];
    if (performance.now() - last.t > 60) return 0;
    var first = last;
    for (var i = samples.length - 1; i >= 0; i--) {
      if (last.t - samples[i].t > 80) break;
      first = samples[i];
    }
    var dt = (last.t - first.t) / 1000;
    return dt > 0 ? (last.y - first.y) / dt : 0;
  }

  handle.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || e.target.closest('button, a') || sheet.hidden) return;
    // Grab it wherever it is, even mid-animation: freeze at the on-screen value.
    halt();
    drag = {
      id: e.pointerId,
      startY: e.clientY,
      startValue: spring.value,
      active: false,
      samples: [{ y: e.clientY, t: performance.now() }]
    };
    spring.velocity = 0;
    try { handle.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
  });

  handle.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dy = e.clientY - drag.startY;
    if (!drag.active) {
      if (Math.abs(dy) < 6) return;      // a little hysteresis separates taps from drags
      drag.active = true;
      drag.startY = e.clientY;           // start tracking from here, so nothing jumps
      dy = 0;
    }
    var y = drag.startValue + dy;
    if (y < 0) y = -rubberband(-y, window.innerHeight);
    spring.value = y;
    render(y);
    var now = performance.now();
    drag.samples.push({ y: e.clientY, t: now });
    while (drag.samples.length > 2 && now - drag.samples[0].t > 120) drag.samples.shift();
  });

  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag;
    drag = null;
    if (!d.active) {
      if (spring.value !== spring.target) run();  // a tap: carry on where it was going
      return;
    }

    var v = e.type === 'pointercancel' ? 0 : sampleVelocity(d.samples);
    var projected = spring.value + project(v);
    spring.velocity = v;                          // velocity hand-off: no seam at release

    if (projected > closedY * 0.45) {
      spring.target = closedY;
      if (historyPushed) { historyPushed = false; history.back(); }
      if (reduceMotion.matches) {
        fade(sheet, 1, 0, finishClose);
        fade(scrim, 1, 0);
        return;
      }
      spring.configure(1, 0.34);
    } else {
      spring.target = 0;
      if (!historyPushed) { history.pushState({ sheet: true }, ''); historyPushed = true; }
      // A flick carried momentum, so a touch of bounce feels right. A slow drag settles flat.
      spring.configure(Math.abs(v) > 250 ? 0.8 : 1, 0.3);
    }
    run();
  }
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
})();


/* ---------- Light / dark switch ----------
   Follows the system until the visitor picks a theme; the choice is kept in
   localStorage and applied before first paint by the inline script in <head>. */
(function () {
  var btn = document.getElementById('theme-toggle');
  if (!btn) return;
  var root = document.documentElement;
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  var metas = document.querySelectorAll('meta[name="theme-color"]');
  var sources = document.querySelectorAll('source[data-scheme]');

  function chosen() { return root.getAttribute('data-theme'); }
  function current() { return chosen() || (mq.matches ? 'dark' : 'light'); }

  function apply() {
    var t = current();
    btn.setAttribute('data-mode', t);
    btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', t === 'dark' ? '#000000' : '#f5f5f7');
    // <picture> sources pick their image with a media query, so steer them too.
    for (var j = 0; j < sources.length; j++) {
      var s = sources[j];
      if (!s.hasAttribute('data-media')) s.setAttribute('data-media', s.getAttribute('media'));
      s.setAttribute('media', chosen() ? (s.getAttribute('data-scheme') === t ? 'all' : 'not all') : s.getAttribute('data-media'));
    }
  }

  btn.addEventListener('click', function () {
    var t = current() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', t);
    try { localStorage.setItem('theme', t); } catch (e) {}
    apply();
  });
  if (mq.addEventListener) mq.addEventListener('change', apply);
  apply();
})();
