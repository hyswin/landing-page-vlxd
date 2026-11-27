/* Vững Xây – phần tương tác: bảng tính giá (giỏ báo giá), giá sỉ theo khối lượng, máy tính vật tư.
 * Không cần thư viện. Sửa giá, mức sỉ và hệ số ở phần CẤU HÌNH bên dưới.
 */
(function () {
  'use strict';

  /* ================= CẤU HÌNH ================= */
  var ZALO = '0901234567';
  var FREE_SHIP = 5000000; // đơn từ mức này được miễn phí vận chuyển nội thành

  // tiers: [số lượng tối thiểu, % giảm]. Sửa theo chính sách giá sỉ thật của cửa hàng.
  var PRODUCTS = [
    { id: 'xm',   name: 'Xi măng PCB40',  spec: 'Bao 50 kg',              price: 92000,    unit: 'bao',  step: 10,  tiers: [[100, 0.02], [500, 0.04]] },
    { id: 'gach', name: 'Gạch ống 4 lỗ',  spec: '8×8×18 cm',              price: 1150,     unit: 'viên', step: 500, tiers: [[10000, 0.03], [30000, 0.05]] },
    { id: 'thep', name: 'Thép cây CB300', spec: 'Ø10 – Ø25, cây 11,7 m',  price: 15600000, unit: 'tấn',  step: 0.5, tiers: [[3, 0.02], [10, 0.035]] },
    { id: 'cat',  name: 'Cát xây tô',     spec: 'Đã sàng',                price: 380000,   unit: 'm³',   step: 1,   tiers: [[20, 0.03], [50, 0.05]] },
    { id: 'da',   name: 'Đá 1×2',         spec: 'Đổ bê tông',             price: 420000,   unit: 'm³',   step: 1,   tiers: [[20, 0.03], [50, 0.05]] },
    { id: 'ton',  name: 'Tôn lạnh',       spec: 'Dày 0,45 mm',            price: 98000,    unit: 'm',    step: 10,  tiers: [[200, 0.03], [500, 0.05]] }
  ];

  // Hệ số ước tính phần thô trên 1 m² sàn xây dựng (nhà phố liền kề, BTCT + tường gạch ống 10 cm).
  // Đây là hệ số kinh nghiệm sơ bộ — nên để thợ/kỹ thuật của cửa hàng kiểm và chỉnh lại.
  var COEF = { xm: 2.4, gach: 85, thep: 0.045, cat: 0.25, da: 0.21 };
  var FOUNDATION = 0.35;   // phần móng ≈ 35% diện tích một sàn
  var FREE_HOUSE = { gach: 1.3, cat: 1.1 }; // nhà riêng 4 mặt: nhiều tường hơn
  var ROOF_TON = 1.15;     // m tôn trên mỗi m² sàn mái (tính cả mái dốc, chồng mí)
  var WASTE = 1.05;        // hao hụt 5%
  /* ============================================ */

  var STORE_KEY = 'vx-gio-bao-gia';
  var qty = {};
  try { qty = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { qty = {}; }

  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function money(n) { return Math.round(n).toLocaleString('vi-VN') + ' ₫'; }
  function num(n) { return (Math.round(n * 100) / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 }); }
  function parseNum(v) { var n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) && n > 0 ? n : 0; }
  function prod(id) { for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i]; return null; }
  function tierOf(p, q) { var d = 0, lv = 0; p.tiers.forEach(function (t, i) { if (q >= t[0]) { d = t[1]; lv = i + 1; } }); return { d: d, lv: lv }; }
  function unitPrice(p, q) { return p.price * (1 - tierOf(p, q).d); }
  function nextTier(p, q) { for (var i = 0; i < p.tiers.length; i++) if (q < p.tiers[i][0]) return p.tiers[i]; return null; }
  function pct(d) { return (Math.round(d * 1000) / 10).toLocaleString('vi-VN') + '%'; }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(qty)); } catch (e) {} }

  /* ---------- styles ---------- */
  function injectStyle() {
    if ($('#vx-style')) return;
    var css = [
      '.vx-card{border:1px solid #cfc8bc;border-radius:4px;background:#faf8f4;box-sizing:border-box}',
      '.vx-table{width:100%;min-width:820px;border-collapse:collapse;text-align:left}',
      '.vx-table th{padding:16px;font-size:13px;line-height:16px;font-weight:700;letter-spacing:.06em;background:#efe9df}',
      '.vx-table td{padding:16px;border-top:1px solid #cfc8bc;vertical-align:middle}',
      '.vx-table tr.vx-on td{background:#ffffff}',
      '.vx-price{font-size:22px;line-height:28px;font-weight:700;white-space:nowrap}',
      '.vx-old{font-size:14px;line-height:20px;color:#5e5850;text-decoration:line-through;white-space:nowrap}',
      '.vx-hint{font-size:14px;line-height:20px;color:#5e5850}',
      '.vx-label{font-size:13px;line-height:16px;font-weight:700;letter-spacing:.06em}',
      '.vx-stepper{display:inline-flex;align-items:stretch;border:1px solid #5e5850;border-radius:2px;background:#fff;overflow:hidden}',
      '.vx-stepper button{width:44px;min-height:44px;border:0;background:#efe9df;font:inherit;font-size:20px;font-weight:700;color:#26221d;cursor:pointer}',
      '.vx-stepper button:hover{background:#cfc8bc}',
      '.vx-stepper input{width:96px;border:0;text-align:center;font:inherit;font-weight:700;color:#26221d;background:#fff;-moz-appearance:textfield;appearance:textfield}',
      '.vx-stepper input::-webkit-outer-spin-button,.vx-stepper input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}',
      '.vx-badge{display:inline-block;background:#e5a21a;color:#26221d;font-size:13px;line-height:16px;font-weight:700;letter-spacing:.06em;padding:4px 8px;border-radius:2px;white-space:nowrap}',
      '.vx-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:52px;padding:0 24px;border-radius:4px;font:inherit;font-weight:700;cursor:pointer;border:0;text-decoration:none;box-sizing:border-box}',
      '.vx-btn-primary{background:#b0441c;color:#fff}.vx-btn-primary:hover{background:#8a3214}',
      '.vx-btn-outline{background:transparent;color:#26221d;border:1px solid #26221d}.vx-btn-outline:hover{background:#efe9df}',
      '.vx-btn-text{background:transparent;color:#5e5850;padding:0 8px;min-height:44px;text-decoration:underline}.vx-btn-text:hover{color:#26221d}',
      '.vx-bar{height:8px;background:#efe9df;border-radius:2px;overflow:hidden}',
      '.vx-bar>span{display:block;height:100%;width:0;background:#b0441c;transition:width .3s}',
      '.vx-bar.vx-done>span{background:#2e4a5e}',
      '.vx-field{display:flex;flex-direction:column;gap:8px;font-size:14px;line-height:20px;font-weight:600}',
      '.vx-field input,.vx-field select{min-height:44px;padding:0 16px;border:1px solid #5e5850;border-radius:2px;background:#fff;font:inherit;font-size:16px;font-weight:400;color:#26221d;box-sizing:border-box}',
      '.vx-check{display:flex;gap:8px;align-items:center;font-size:14px;line-height:20px;min-height:44px;cursor:pointer}',
      '.vx-check input{width:20px;height:20px;margin:0;accent-color:#b0441c;flex:0 0 20px}',
      '.vx-res td{padding:12px 0;border-top:1px solid #cfc8bc;vertical-align:baseline}',
      '.vx-toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,16px);background:#26221d;color:#fff;padding:12px 16px;border-radius:4px;font-size:14px;line-height:20px;z-index:1000;opacity:0;transition:opacity .2s,transform .2s;max-width:calc(100vw - 32px);box-sizing:border-box;box-shadow:0 4px 16px rgba(0,0,0,.2)}',
      '.vx-toast.vx-show{opacity:1;transform:translate(-50%,0)}',
      '@media (max-width:640px){.vx-pad{padding:24px !important}}'
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'vx-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---------- toast / clipboard / form ---------- */
  var toastTimer;
  function toast(msg) {
    var t = $('#vx-toast');
    if (!t) { t = document.createElement('div'); t.id = 'vx-toast'; t.className = 'vx-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('vx-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('vx-show'); }, 3200);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (res, rej) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? res() : rej(); } catch (e) { rej(e); }
      document.body.removeChild(ta);
    });
  }

  function fillForm(text, role) {
    var ta = $('#bao-gia textarea');
    if (!ta) return;
    ta.value = text;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    var sel = $('#bao-gia select');
    if (sel && role != null) sel.selectedIndex = role;
    $('#bao-gia').scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () { var name = $('#bao-gia input[type="text"]'); if (name) name.focus({ preventScroll: true }); }, 700);
    toast('Đã điền danh sách vào form. Anh/chị chỉ cần để lại tên và số điện thoại.');
  }

  function listLines(q) {
    var lines = [], total = 0;
    PRODUCTS.forEach(function (p) {
      var n = q[p.id] || 0;
      if (!n) return;
      var line = unitPrice(p, n) * n;
      total += line;
      lines.push('- ' + num(n) + ' ' + p.unit + ' ' + p.name + ' (' + p.spec + ')');
    });
    return { lines: lines, total: total };
  }

  /* ---------- 1. Bảng tính giá (giỏ báo giá) ---------- */
  function tierHint(p, q) {
    var t = tierOf(p, q), nx = nextTier(p, q), h = '';
    if (t.lv) h += '<span class="vx-badge">GIÁ SỈ −' + pct(t.d) + '</span> ';
    if (nx) h += '<span class="vx-hint">Từ ' + num(nx[0]) + ' ' + p.unit + ': giảm ' + pct(nx[1]) + '</span>';
    return h;
  }

  function renderCart(root) {
    var rows = PRODUCTS.map(function (p) {
      return '<tr data-vx-row="' + p.id + '">' +
        '<td><div style="font-weight:600">' + p.name + '</div><div data-vx-tier style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center"></div></td>' +
        '<td class="vx-hint">' + p.spec + '</td>' +
        '<td style="text-align:right"><div class="vx-price" data-vx-unit></div><div class="vx-old" data-vx-old></div></td>' +
        '<td><div style="display:flex;align-items:center;gap:8px"><div class="vx-stepper">' +
          '<button type="button" data-vx-step="-1" aria-label="Giảm số lượng ' + p.name + '">−</button>' +
          '<input type="number" min="0" step="any" inputmode="decimal" placeholder="0" data-vx-qty aria-label="Số lượng ' + p.name + ' (' + p.unit + ')">' +
          '<button type="button" data-vx-step="1" aria-label="Tăng số lượng ' + p.name + '">+</button>' +
        '</div><span class="vx-hint">' + p.unit + '</span></div></td>' +
        '<td style="text-align:right;font-weight:700;white-space:nowrap" data-vx-line></td>' +
      '</tr>';
    }).join('');

    root.innerHTML =
      '<div data-vx-ready style="display:flex;flex-direction:column;gap:16px">' +
        '<div class="vx-card" style="overflow-x:auto">' +
          '<table class="vx-table"><thead><tr>' +
            '<th scope="col">SẢN PHẨM</th><th scope="col">QUY CÁCH</th><th scope="col" style="text-align:right">ĐƠN GIÁ</th>' +
            '<th scope="col">SỐ LƯỢNG CẦN MUA</th><th scope="col" style="text-align:right">THÀNH TIỀN</th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table>' +
        '</div>' +
        '<div class="vx-card vx-pad" style="padding:24px;display:flex;flex-wrap:wrap;gap:24px;align-items:center;justify-content:space-between;background:#ffffff">' +
          '<div style="flex:1 1 320px;min-width:0;display:flex;flex-direction:column;gap:8px">' +
            '<div style="font-weight:700" data-vx-shiptext></div>' +
            '<div class="vx-bar" data-vx-bar><span data-vx-shipbar></span></div>' +
            '<div class="vx-hint">Giá tạm tính theo bảng giá hôm nay, chưa gồm phí vận chuyển. Báo giá chính thức gửi qua Zalo.</div>' +
          '</div>' +
          '<div style="flex:0 1 auto;display:flex;flex-direction:column;gap:4px;align-items:flex-end;text-align:right">' +
            '<div class="vx-label" style="color:#5e5850">TẠM TÍNH <span data-vx-count></span></div>' +
            '<div style="font-size:32px;line-height:40px;font-weight:800;white-space:nowrap" data-vx-total>0 ₫</div>' +
            '<div class="vx-hint" data-vx-saved></div>' +
          '</div>' +
          '<div style="flex-basis:100%;display:flex;flex-wrap:wrap;gap:16px;justify-content:flex-end;align-items:center">' +
            '<button type="button" class="vx-btn vx-btn-text" data-vx-action="clear">Xóa hết</button>' +
            '<button type="button" class="vx-btn vx-btn-outline" data-vx-action="cart-zalo">' +
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>' +
              'Sao chép &amp; gửi Zalo</button>' +
            '<button type="button" class="vx-btn vx-btn-primary" data-vx-action="cart-form">Gửi danh sách để nhận báo giá' +
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></button>' +
          '</div>' +
        '</div>' +
      '</div>';

    $all('[data-vx-row]', root).forEach(function (tr) {
      var q = qty[tr.getAttribute('data-vx-row')];
      if (q) $('[data-vx-qty]', tr).value = q;
    });
    updateCart();
  }

  function updateCart() {
    var root = $('#vx-cart-root');
    if (!root || !$('[data-vx-ready]', root)) return;
    var total = 0, full = 0, count = 0;
    $all('[data-vx-row]', root).forEach(function (tr) {
      var p = prod(tr.getAttribute('data-vx-row'));
      var q = qty[p.id] || 0;
      var u = unitPrice(p, q);
      var t = tierOf(p, q);
      $('[data-vx-unit]', tr).textContent = money(u) + ' / ' + p.unit;
      $('[data-vx-old]', tr).textContent = t.lv ? money(p.price) + ' / ' + p.unit : '';
      $('[data-vx-tier]', tr).innerHTML = tierHint(p, q);
      $('[data-vx-line]', tr).textContent = q ? money(u * q) : '—';
      tr.classList.toggle('vx-on', q > 0);
      if (q) { total += u * q; full += p.price * q; count++; }
    });
    $('[data-vx-total]', root).textContent = money(total);
    $('[data-vx-count]', root).textContent = count ? '· ' + count + ' MẶT HÀNG' : '';
    $('[data-vx-saved]', root).textContent = full - total > 0 ? 'Đã giảm ' + money(full - total) + ' nhờ giá sỉ' : '';
    var bar = $('[data-vx-bar]', root), left = FREE_SHIP - total;
    $('[data-vx-shipbar]', root).style.width = Math.min(100, total / FREE_SHIP * 100) + '%';
    bar.classList.toggle('vx-done', left <= 0);
    $('[data-vx-shiptext]', root).textContent = !total
      ? 'Nhập số lượng để xem tạm tính. Đơn từ ' + money(FREE_SHIP) + ' được miễn phí vận chuyển nội thành.'
      : left > 0
        ? 'Còn ' + money(left) + ' nữa để được miễn phí vận chuyển nội thành.'
        : 'Đơn này được miễn phí vận chuyển nội thành.';
  }

  function setQty(id, v) {
    var p = prod(id);
    v = Math.max(0, Math.round(v * 100) / 100);
    if (v) qty[id] = v; else delete qty[id];
    save();
    var input = $('#vx-cart-root [data-vx-row="' + id + '"] [data-vx-qty]');
    if (input && document.activeElement !== input) input.value = v || '';
    updateCart();
    return p;
  }

  /* ---------- 2. Giá sỉ theo khối lượng ---------- */
  function renderTiers(root) {
    var rows = PRODUCTS.map(function (p) {
      var cells = p.tiers.map(function (t) {
        return '<td style="text-align:right"><div style="font-weight:700;white-space:nowrap">' + money(p.price * (1 - t[1])) + ' / ' + p.unit + '</div>' +
          '<div class="vx-hint" style="white-space:nowrap">từ ' + num(t[0]) + ' ' + p.unit + ' · −' + pct(t[1]) + '</div></td>';
      }).join('');
      return '<tr><td style="font-weight:600">' + p.name + '</td><td style="text-align:right;white-space:nowrap">' + money(p.price) + ' / ' + p.unit + '</td>' + cells + '</tr>';
    }).join('');
    root.innerHTML =
      '<div data-vx-ready style="display:flex;flex-direction:column;gap:16px;padding-top:24px">' +
        '<div style="display:flex;flex-direction:column;gap:8px;max-width:720px">' +
          '<span class="vx-label" style="color:#b0441c">GIÁ SỈ THEO KHỐI LƯỢNG · CHO NHÀ THẦU</span>' +
          '<h3 style="margin:0;font-size:22px;line-height:30px;font-weight:700">Mua càng nhiều, đơn giá càng giảm</h3>' +
          '<p style="margin:0;color:#5e5850">Bảng tính phía trên tự áp mức giá này khi đủ số lượng. Đơn lớn hơn mức 2 hoặc giao nhiều đợt: <a href="#bao-gia" style="font-weight:700">gửi dự toán để chốt giá riêng</a>.</p>' +
        '</div>' +
        '<div class="vx-card" style="overflow-x:auto">' +
          '<table class="vx-table" style="min-width:680px"><thead><tr>' +
            '<th scope="col">SẢN PHẨM</th><th scope="col" style="text-align:right">GIÁ LẺ</th><th scope="col" style="text-align:right">MỨC 1</th><th scope="col" style="text-align:right">MỨC 2</th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table>' +
        '</div>' +
      '</div>';
  }

  /* ---------- 3. Máy tính vật tư ---------- */
  var lastCalc = null;

  function renderCalc(root) {
    var opts = ''; for (var i = 1; i <= 6; i++) opts += '<option value="' + i + '"' + (i === 3 ? ' selected' : '') + '>' + i + ' tầng' + (i === 1 ? ' (nhà cấp 4 / trệt)' : '') + '</option>';
    root.innerHTML =
      '<div data-vx-ready style="display:flex;flex-wrap:wrap;gap:24px;align-items:stretch">' +
        '<div class="vx-card vx-pad" style="flex:1 1 340px;min-width:0;padding:40px;display:flex;flex-direction:column;gap:16px;background:#efe9df;border-color:#efe9df">' +
          '<h3 style="margin:0;font-size:22px;line-height:30px;font-weight:700">Thông tin căn nhà</h3>' +
          '<label class="vx-field">Diện tích một sàn (m²)<input type="number" min="1" step="any" inputmode="decimal" data-vx-calc="area" value="60"></label>' +
          '<label class="vx-field">Số tầng (kể cả tầng trệt)<select data-vx-calc="floors">' + opts + '</select></label>' +
          '<label class="vx-field">Kiểu nhà<select data-vx-calc="type"><option value="row">Nhà phố liền kề (có tường chung)</option><option value="free">Nhà riêng, 4 mặt thoáng</option></select></label>' +
          '<div style="display:flex;flex-direction:column">' +
            '<label class="vx-check"><input type="checkbox" data-vx-calc="fnd" checked>Tính cả phần móng</label>' +
            '<label class="vx-check"><input type="checkbox" data-vx-calc="roof">Lợp mái tôn</label>' +
            '<label class="vx-check"><input type="checkbox" data-vx-calc="waste" checked>Cộng 5% hao hụt</label>' +
          '</div>' +
        '</div>' +
        '<div class="vx-card vx-pad" style="flex:1 1 520px;min-width:0;padding:40px;display:flex;flex-direction:column;gap:16px;background:#ffffff">' +
          '<div style="display:flex;flex-direction:column;gap:4px">' +
            '<span class="vx-label" style="color:#5e5850">ƯỚC TÍNH VẬT TƯ PHẦN THÔ</span>' +
            '<div style="font-weight:700" data-vx-calc-sum></div>' +
          '</div>' +
          '<table class="vx-res" style="width:100%;border-collapse:collapse"><tbody data-vx-calc-rows></tbody></table>' +
          '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:8px;border-top:2px solid #26221d;padding-top:16px">' +
            '<span style="font-weight:700">Tạm tính</span>' +
            '<span style="font-size:32px;line-height:40px;font-weight:800;color:#b0441c;white-space:nowrap" data-vx-calc-total></span>' +
          '</div>' +
          '<p class="vx-hint" style="margin:0">Ước tính sơ bộ, sai số khoảng ±15%. Chúng tôi sẽ gọi lại để kiểm số lượng theo bản vẽ trước khi báo giá.</p>' +
          '<div style="display:flex;flex-wrap:wrap;gap:16px">' +
            '<button type="button" class="vx-btn vx-btn-primary" data-vx-action="calc-form">Gửi danh sách này để nhận báo giá</button>' +
            '<button type="button" class="vx-btn vx-btn-outline" data-vx-action="calc-cart">Chỉnh trong bảng giá</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    runCalc();
  }

  function ceilTo(n, step) { return Math.ceil(n / step - 1e-9) * step; }

  function runCalc() {
    var root = $('#vx-calc-root');
    if (!root || !$('[data-vx-ready]', root)) return;
    var v = function (k) { return $('[data-vx-calc="' + k + '"]', root); };
    var area = parseNum(v('area').value);
    var floors = parseInt(v('floors').value, 10) || 1;
    var free = v('type').value === 'free';
    var fnd = v('fnd').checked, roof = v('roof').checked, w = v('waste').checked ? WASTE : 1;

    var S = area * floors;
    var base = S + (fnd ? area * FOUNDATION : 0);
    var q = {
      xm: ceilTo(base * COEF.xm * w, 1),
      gach: ceilTo(S * COEF.gach * (free ? FREE_HOUSE.gach : 1) * w, 100),
      thep: ceilTo(base * COEF.thep * w, 0.1),
      cat: ceilTo(base * COEF.cat * (free ? FREE_HOUSE.cat : 1) * w, 0.5),
      da: ceilTo(base * COEF.da * w, 0.5),
      ton: roof ? ceilTo(area * ROOF_TON * w, 1) : 0
    };
    if (!area) q = { xm: 0, gach: 0, thep: 0, cat: 0, da: 0, ton: 0 };

    var total = 0, html = '';
    PRODUCTS.forEach(function (p) {
      var n = q[p.id];
      if (!n) return;
      var u = unitPrice(p, n), t = tierOf(p, n);
      total += u * n;
      html += '<tr><td><div style="font-weight:600">' + p.name + '</div><div class="vx-hint">' + money(u) + ' / ' + p.unit + (t.lv ? ' · <span class="vx-badge">GIÁ SỈ −' + pct(t.d) + '</span>' : '') + '</div></td>' +
        '<td style="text-align:right;font-weight:700;white-space:nowrap;padding-left:16px">' + num(n) + ' ' + p.unit + '</td>' +
        '<td style="text-align:right;white-space:nowrap;padding-left:16px">' + money(u * n) + '</td></tr>';
    });
    $('[data-vx-calc-rows]', root).innerHTML = html || '<tr><td class="vx-hint">Nhập diện tích một sàn để xem ước tính.</td></tr>';
    $('[data-vx-calc-total]', root).textContent = money(total);
    $('[data-vx-calc-sum]', root).textContent = area
      ? 'Nhà ' + floors + ' tầng · ' + num(area) + ' m²/sàn · tổng ' + num(S) + ' m² sàn'
      : 'Chưa có diện tích';
    lastCalc = {
      q: q, total: total,
      desc: 'nhà ' + floors + ' tầng, ' + num(area) + ' m²/sàn, ' + (free ? 'nhà riêng 4 mặt' : 'nhà phố liền kề') +
        (fnd ? ', có móng' : '') + (roof ? ', mái tôn' : '')
    };
  }

  /* ---------- events (delegation, an toàn khi trang render lại) ---------- */
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.matches && el.matches('#vx-cart-root [data-vx-qty]')) {
      var id = el.closest('[data-vx-row]').getAttribute('data-vx-row');
      setQty(id, parseNum(el.value));
    } else if (el.matches && el.matches('#vx-calc-root [data-vx-calc]')) {
      runCalc();
    }
  });
  document.addEventListener('change', function (e) {
    if (e.target.matches && e.target.matches('#vx-calc-root [data-vx-calc]')) runCalc();
  });

  document.addEventListener('click', function (e) {
    var stepBtn = e.target.closest && e.target.closest('#vx-cart-root [data-vx-step]');
    if (stepBtn) {
      var id = stepBtn.closest('[data-vx-row]').getAttribute('data-vx-row');
      var p = prod(id), dir = +stepBtn.getAttribute('data-vx-step');
      var cur = qty[id] || 0;
      var next = dir > 0 ? Math.floor(cur / p.step + 1e-9) * p.step + p.step : Math.ceil(cur / p.step - 1e-9) * p.step - p.step;
      var input = $('[data-vx-qty]', stepBtn.closest('[data-vx-row]'));
      setQty(id, next);
      input.value = qty[id] || '';
      return;
    }
    var act = e.target.closest && e.target.closest('[data-vx-action]');
    if (!act) return;
    var a = act.getAttribute('data-vx-action');

    if (a === 'clear') {
      qty = {}; save();
      $all('#vx-cart-root [data-vx-qty]').forEach(function (i) { i.value = ''; });
      updateCart();
    } else if (a === 'cart-form' || a === 'cart-zalo') {
      var l = listLines(qty);
      if (!l.lines.length) { toast('Anh/chị nhập số lượng ít nhất một mặt hàng trước nhé.'); return; }
      var text = 'Danh sách vật tư (tính trên web):\n' + l.lines.join('\n') + '\nTạm tính: ' + money(l.total) + ' (chưa gồm vận chuyển)';
      if (a === 'cart-form') fillForm(text, null);
      else copyText(text).then(function () {
        toast('Đã sao chép danh sách. Mở Zalo và dán vào khung chat để gửi.');
        window.open('https://zalo.me/' + ZALO, '_blank', 'noopener');
      }, function () { fillForm(text, null); });
    } else if (a === 'calc-form' || a === 'calc-cart') {
      if (!lastCalc || !lastCalc.total) { toast('Anh/chị nhập diện tích một sàn trước nhé.'); return; }
      if (a === 'calc-form') {
        var c = listLines(lastCalc.q);
        fillForm('Ước tính vật tư phần thô cho ' + lastCalc.desc + ':\n' + c.lines.join('\n') +
          '\nTạm tính: ' + money(c.total) + '\nNhờ cửa hàng kiểm lại số lượng giúp.', 0);
      } else {
        qty = {};
        PRODUCTS.forEach(function (p) { if (lastCalc.q[p.id]) qty[p.id] = lastCalc.q[p.id]; });
        save();
        $all('#vx-cart-root [data-vx-row]').forEach(function (tr) {
          $('[data-vx-qty]', tr).value = qty[tr.getAttribute('data-vx-row')] || '';
        });
        updateCart();
        $('#bang-gia').scrollIntoView({ behavior: 'smooth', block: 'start' });
        toast('Đã chuyển số lượng vào bảng giá. Anh/chị chỉnh thêm nếu cần.');
      }
    }
  });

  /* ---------- mount: chờ trang render xong, tự gắn lại nếu bị render lại ---------- */
  function ensure() {
    var any = false;
    var cart = $('#vx-cart-root'), tiers = $('#vx-tier-root'), calc = $('#vx-calc-root');
    if (cart || tiers || calc) injectStyle();
    if (cart && !$('[data-vx-ready]', cart)) { renderCart(cart); any = true; }
    if (tiers && !$('[data-vx-ready]', tiers)) { renderTiers(tiers); any = true; }
    if (calc && !$('[data-vx-ready]', calc)) { renderCalc(calc); any = true; }
    var st = $('#vx-static-table');
    if (st && cart && st.style.display !== 'none') st.style.display = 'none';
    return any;
  }
  setInterval(ensure, 500);
  if (document.readyState !== 'loading') ensure(); else document.addEventListener('DOMContentLoaded', ensure);
})();
