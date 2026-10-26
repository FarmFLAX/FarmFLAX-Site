// Shared code for every page: product data, cart, header and footer.
(function () {
  var C = window.FF_CONFIG;

  // ---------- Product data (read from products/products.csv) ----------
  function parseCSV(text) {
    var rows = [], row = [], cell = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        if (row.some(function (c) { return c.trim() !== ""; })) rows.push(row);
        row = [];
      } else cell += ch;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    var head = rows.shift().map(function (h) { return h.trim(); });
    return rows.map(function (r) {
      var o = {};
      head.forEach(function (h, j) { o[h] = (r[j] || "").trim(); });
      return o;
    });
  }

  var productsPromise = null;
  function loadProducts() {
    if (!productsPromise) {
      productsPromise = fetch(FF.root + "products/products.csv", { cache: "no-cache" })
        .then(function (r) { if (!r.ok) throw new Error("products.csv not found"); return r.text(); })
        .then(function (t) {
          return parseCSV(t).map(function (p) {
            return {
              id: p.id, name: p.name, category: p.category,
              weight: Number(p.weight_g) || 0, price: Number(p.price) || 0, mrp: Number(p.mrp) || 0,
              inStock: /^(yes|y|true|1)$/i.test(p.in_stock),
              images: (p.images || "1.jpg").split("|").map(function (f) { return FF.root + "products/images/" + p.id + "/" + f.trim(); }),
              short: p.short, description: p.description
            };
          });
        });
    }
    return productsPromise;
  }

  // ---------- Cart (kept in this browser) ----------
  var KEY = "ff-cart-v1";
  function readCart() {
    try { var c = JSON.parse(localStorage.getItem(KEY) || "{}"); return c && typeof c === "object" ? c : {}; }
    catch (e) { return memCart; }
  }
  var memCart = {};
  function writeCart(c) {
    memCart = c;
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { /* private mode: keep in memory */ }
    updateBadge();
    document.dispatchEvent(new CustomEvent("ff:cart"));
  }
  function addToCart(id, qty) {
    var c = readCart(); c[id] = Math.min(20, (c[id] || 0) + (qty || 1)); writeCart(c);
  }
  function setQty(id, qty) {
    var c = readCart(); if (qty <= 0) delete c[id]; else c[id] = Math.min(20, qty); writeCart(c);
  }
  function clearCart() { writeCart({}); }
  function cartCount() {
    var c = readCart(); return Object.keys(c).reduce(function (s, k) { return s + c[k]; }, 0);
  }
  function cartLines(products) {
    var c = readCart(), byId = {};
    products.forEach(function (p) { byId[p.id] = p; });
    return Object.keys(c).filter(function (id) { return byId[id]; }).map(function (id) {
      var p = byId[id]; return { product: p, qty: c[id], total: p.price * c[id] };
    });
  }
  function totals(lines) {
    var sub = lines.reduce(function (s, l) { return s + l.total; }, 0);
    var ship = sub === 0 || sub >= C.freeShippingAbove ? 0 : C.shippingFee;
    return { subtotal: sub, shipping: ship, total: sub + ship };
  }

  // ---------- Helpers ----------
  function money(n) { return "₹" + Number(n).toLocaleString("en-IN"); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function waLink(text) { return "https://wa.me/" + C.whatsapp + "?text=" + encodeURIComponent(text); }
  function toast(msg) {
    var t = document.getElementById("ff-toast");
    if (!t) { t = document.createElement("div"); t.id = "ff-toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }
  function updateBadge() {
    var b = document.getElementById("ff-cart-count"); if (!b) return;
    var n = cartCount(); b.textContent = n; b.hidden = n === 0;
  }

  // ---------- Header and footer ----------
  function header() {
    var r = FF.root;
    return (C.preview ? '<div class="preview-bar">Preview site: prices and photos are samples. Orders are not live yet.</div>' : "") +
      '<header class="site-head"><div class="wrap head-row">' +
      '<a class="logo" href="' + r + 'index.html" aria-label="' + esc(C.brand) + ' home"><img src="' + r + 'assets/img/logo.svg" alt="" width="34" height="34"><span><b class="farm">Farm</b><b class="flax">FLAX</b></span></a>' +
      '<nav class="nav" aria-label="Main"><a href="' + r + 'index.html#shop">Shop</a><a href="' + r + 'index.html#why">Why FarmFLAX</a><a href="' + r + 'policies/contact.html">Contact</a></nav>' +
      '<a class="cart-link" href="' + r + 'cart.html">Cart <span id="ff-cart-count" class="badge" hidden>0</span></a>' +
      "</div></header>";
  }
  function footer() {
    var r = FF.root;
    return '<footer class="site-foot"><div class="wrap foot-grid">' +
      '<div><div class="logo foot-logo"><b class="farm">Farm</b><b class="flax">FLAX</b></div><p class="muted">' + esc(C.tagline) + '</p></div>' +
      '<div><h3>Help</h3><a href="' + r + 'policies/shipping.html">Shipping</a><a href="' + r + 'policies/refund.html">Returns and refunds</a><a href="' + r + 'policies/contact.html">Contact us</a></div>' +
      '<div><h3>Legal</h3><a href="' + r + 'policies/terms.html">Terms</a><a href="' + r + 'policies/privacy.html">Privacy</a></div>' +
      '<div><h3>Talk to us</h3><a href="' + waLink("Hi FarmFLAX, I have a question.") + '" target="_blank" rel="noopener">WhatsApp ' + esc(C.phoneDisplay) + '</a><span class="muted">' + esc(C.email) + "</span></div>" +
      '</div><div class="wrap fine muted">© ' + new Date().getFullYear() + " " + esc(C.legalName) + " · GSTIN " + esc(C.gstin) + " · FSSAI " + esc(C.fssai) + "</div></footer>";
  }

  var FF = window.FF = {
    root: document.documentElement.getAttribute("data-root") || "",
    loadProducts: loadProducts, addToCart: addToCart, setQty: setQty, clearCart: clearCart,
    readCart: readCart, cartLines: cartLines, totals: totals,
    money: money, esc: esc, waLink: waLink, toast: toast
  };

  document.addEventListener("DOMContentLoaded", function () {
    var h = document.getElementById("ff-header"), f = document.getElementById("ff-footer");
    if (h) h.outerHTML = header();
    if (f) f.outerHTML = footer();
    updateBadge();
  });
})();
