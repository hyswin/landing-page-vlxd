/* Vững Xây – pháo hoa khi di chuột vào thẻ sản phẩm (#san-pham article).
 * Mỗi thẻ một kiểu, theo thứ tự thẻ:
 *   1 Xi măng  → hoa cúc (nổ tròn, rơi nhẹ)
 *   2 Gạch     → vòng tròn đôi
 *   3 Thép     → tia lửa hàn (cành liễu, đuôi dài)
 *   4 Cát đá   → đài phun cát
 *   5 Mái      → 3 quả bắn liên tiếp, nổ tách đôi
 *   6 Hoàn thiện → ngôi sao nhiều màu sơn
 * Không cần thư viện. Tắt tự động khi người xem bật "giảm chuyển động".
 */
(function () {
  'use strict';
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var COOLDOWN = 900; // ms giữa 2 lần bắn trên cùng 1 thẻ
  var COLORS = {
    brand: ['#b0441c', '#e5a21a', '#d9622b', '#f2c14e'],
    brick: ['#b0441c', '#d9714a', '#8a3214'],
    steel: ['#ffffff', '#ffe08a', '#ffb547', '#9fb7c9'],
    sand:  ['#d9b26a', '#c49a52', '#a8884f', '#8a8378', '#e8cf9a'],
    roof:  ['#2e4a5e', '#5f86a3', '#e5a21a', '#b0441c'],
    paint: ['#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#3a86ff', '#8338ec']
  };

  var cv, ctx, dpr = 1, parts = [], running = false;
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function setup() {
    if (cv) return;
    cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:9999';
    document.body.appendChild(cv);
    ctx = cv.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* Hạt dùng tọa độ trang (page) để không lệch khi cuộn. */
  function add(o) {
    var p = {
      x: o.x, y: o.y, vx: o.vx || 0, vy: o.vy || 0,
      g: o.g == null ? 0.06 : o.g, drag: o.drag == null ? 0.96 : o.drag,
      life: 0, max: o.max || 60, size: o.size || 2.4, color: o.color || '#b0441c',
      trail: o.trail || 0, hist: [], flicker: !!o.flicker, square: !!o.square,
      onEnd: o.onEnd || null, onTick: o.onTick || null, rocket: !!o.rocket
    };
    parts.push(p);
    if (!running) { running = true; requestAnimationFrame(loop); }
    return p;
  }

  function loop() {
    var sx = window.scrollX, sy = window.scrollY;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      if (p.trail) { p.hist.push(p.x, p.y); if (p.hist.length > p.trail * 2) p.hist.splice(0, 2); }
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g;
      p.x += p.vx; p.y += p.vy; p.life++;
      if (p.onTick) p.onTick(p);
      var t = p.life / p.max, a = p.rocket ? 1 : Math.max(0, 1 - t * t);
      if (p.flicker && Math.random() < 0.3) a *= 0.3;
      ctx.globalAlpha = a;
      if (p.hist.length > 2) {
        ctx.strokeStyle = p.color; ctx.lineWidth = p.size * 0.7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.hist[0] - sx, p.hist[1] - sy);
        for (var k = 2; k < p.hist.length; k += 2) ctx.lineTo(p.hist[k] - sx, p.hist[k + 1] - sy);
        ctx.lineTo(p.x - sx, p.y - sy); ctx.stroke();
      }
      ctx.fillStyle = p.color;
      if (p.square) ctx.fillRect(p.x - sx - p.size / 2, p.y - sy - p.size / 2, p.size, p.size);
      else { ctx.beginPath(); ctx.arc(p.x - sx, p.y - sy, p.size, 0, 6.2832); ctx.fill(); }
      if (p.life >= p.max) { parts.splice(i, 1); if (p.onEnd) p.onEnd(p); }
    }
    ctx.globalAlpha = 1;
    if (parts.length) requestAnimationFrame(loop); else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  /* Quả pháo bay từ (x0,y0) lên (x1,y1) rồi gọi burst(x,y). */
  function rocket(x0, y0, x1, y1, color, burst) {
    var g = 0.45, h = Math.max(20, y0 - y1);
    var vy = -Math.sqrt(2 * g * h), frames = Math.round(-vy / g);
    add({ x: x0, y: y0, vx: (x1 - x0) / frames, vy: vy, g: g, drag: 1, max: frames,
      size: 2.2, color: color, trail: 6, rocket: true,
      onEnd: function (p) { burst(p.x, p.y); } });
  }

  /* ---------- 6 kiểu nổ ---------- */
  function peony(x, y) {
    for (var i = 0; i < 80; i++) {
      var a = Math.random() * 6.2832, s = rnd(1.5, 5.5);
      add({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.05, drag: 0.955,
        max: rnd(45, 70), size: rnd(1.8, 3), color: pick(COLORS.brand), trail: 3 });
    }
  }

  function rings(x, y) {
    [[5.2, 44, COLORS.brick[0]], [3.2, 30, COLORS.brick[1]], [1.6, 16, COLORS.brick[2]]].forEach(function (r) {
      for (var i = 0; i < r[1]; i++) {
        var a = i / r[1] * 6.2832;
        add({ x: x, y: y, vx: Math.cos(a) * r[0], vy: Math.sin(a) * r[0], g: 0.02, drag: 0.95,
          max: 60, size: 2.6, color: r[2], square: true });
      }
    });
  }

  function willow(x, y) {
    for (var i = 0; i < 90; i++) {
      var a = Math.random() * 6.2832, s = rnd(1, 6.5);
      add({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, g: 0.11, drag: 0.965,
        max: rnd(50, 85), size: rnd(1, 1.8), color: pick(COLORS.steel), trail: 10, flicker: true });
    }
  }

  function fountain(x, y) {
    var n = 0;
    (function spray() {
      for (var i = 0; i < 9; i++) {
        var a = -Math.PI / 2 + rnd(-0.45, 0.45), s = rnd(5, 9);
        add({ x: x + rnd(-6, 6), y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.22, drag: 0.985,
          max: rnd(55, 80), size: rnd(2, 3.4), color: pick(COLORS.sand), square: true });
      }
      if (++n < 22) setTimeout(spray, 30);
    })();
  }

  function crossette(x, y) {
    for (var i = 0; i < 26; i++) {
      var a = i / 26 * 6.2832, s = rnd(3, 4.2), c = pick(COLORS.roof);
      add({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.04, drag: 0.95,
        max: 26, size: 2.4, color: c, trail: 4,
        onEnd: function (p) {
          for (var k = 0; k < 2; k++) {
            var b = Math.atan2(p.vy, p.vx) + (k ? 0.9 : -0.9);
            add({ x: p.x, y: p.y, vx: Math.cos(b) * 2.4, vy: Math.sin(b) * 2.4, g: 0.05, drag: 0.95,
              max: 30, size: 1.8, color: p.color, trail: 3 });
          }
        } });
    }
  }

  function star(x, y) {
    var pts = [], R = 5.5, r = 2.3, rot = Math.random() * 6.2832;
    for (var v = 0; v < 10; v++) {
      var ang = rot + v * Math.PI / 5, rad = v % 2 ? r : R;
      pts.push([Math.cos(ang) * rad, Math.sin(ang) * rad]);
    }
    var per = 9;
    for (var e = 0; e < 10; e++) {
      var A = pts[e], B = pts[(e + 1) % 10], col = COLORS.paint[(e >> 1) % COLORS.paint.length];
      for (var j = 0; j < per; j++) {
        var t = j / per;
        add({ x: x, y: y, vx: A[0] + (B[0] - A[0]) * t, vy: A[1] + (B[1] - A[1]) * t, g: 0.015, drag: 0.95,
          max: 65, size: 2.4, color: col });
      }
    }
    for (var i = 0; i < 20; i++) { // vài hạt sơn bắn tung tóe ở giữa
      var a = Math.random() * 6.2832, s = rnd(0.5, 2);
      add({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.04, drag: 0.95,
        max: rnd(40, 60), size: rnd(1.5, 3.5), color: pick(COLORS.paint) });
    }
  }

  /* ---------- gắn vào từng thẻ ---------- */
  var SHOWS = [
    function (b) { rocket(b.cx, b.bottom, b.cx, b.top + b.h * 0.3, '#e5a21a', peony); },
    function (b) { rocket(b.cx, b.bottom, b.cx, b.top + b.h * 0.3, '#b0441c', rings); },
    function (b) { rocket(b.cx, b.bottom, b.cx, b.top + b.h * 0.25, '#ffe08a', willow); },
    function (b) { fountain(b.cx, b.top + b.h * 0.55); },
    function (b) {
      [[-0.28, 0.35, 0], [0, 0.15, 260], [0.28, 0.32, 520]].forEach(function (s, i) {
        setTimeout(function () {
          var x = b.cx + s[0] * b.w;
          rocket(x, b.bottom, x, b.top + b.h * s[1], COLORS.roof[i % 4], crossette);
        }, s[2]);
      });
    },
    function (b) { rocket(b.cx, b.bottom, b.cx, b.top + b.h * 0.3, '#3a86ff', star); }
  ];

  var last = new WeakMap(), current = null;
  function fire(card) {
    var list = Array.prototype.slice.call(document.querySelectorAll('#san-pham article'));
    var idx = card.hasAttribute('data-phao-hoa') ? +card.getAttribute('data-phao-hoa') : list.indexOf(card);
    var show = SHOWS[((idx % SHOWS.length) + SHOWS.length) % SHOWS.length];
    var now = Date.now();
    if (now - (last.get(card) || 0) < COOLDOWN) return;
    last.set(card, now);
    setup();
    var r = card.getBoundingClientRect(), sx = window.scrollX, sy = window.scrollY;
    show({ cx: r.left + sx + r.width / 2, top: r.top + sy, bottom: r.bottom + sy, w: r.width, h: r.height });
  }

  document.addEventListener('mouseover', function (e) {
    var card = e.target.closest && e.target.closest('#san-pham article');
    if (card && card !== current) { current = card; fire(card); }
  });
  document.addEventListener('mouseout', function (e) {
    if (current && !(e.relatedTarget && current.contains(e.relatedTarget))) current = null;
  });
})();
