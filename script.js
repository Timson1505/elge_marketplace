/* ============ STATE ============ */
const state = {
  user: null,
  profile: null,
  products: [],
  categories: [],
  banners: [],
  category: "Баары",
  query: "",
  cart: JSON.parse(localStorage.getItem("elge_cart") || "[]"),
  currentProductId: null,
  currentImageIndex: 0,
  slideIndex: 0,
  timer: null,
  currentOrderId: null
};

const $ = s => document.querySelector(s);
const money = v => `${Number(v).toLocaleString("ky-KG")} сом`;

/* ============ MAPPERS ============ */
function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    oldPrice: row.old_price ? Number(row.old_price) : null,
    rating: Number(row.rating || 5),
    category: row.category,
    icon: row.icon || "📦",
    description: row.description || "",
    images: (row.images && row.images.length) ? row.images : ["images/placeholder.png"],
    sellerId: row.seller_id
  };
}

/* ============ CATEGORIES ============ */
function renderCategories() {
  const all = [{ name: "Баары", icon: "◉" }, ...state.categories];
  $("#categoryList").innerHTML = all.map(c => `
    <button class="category-button ${state.category === c.name ? "active" : ""}"
            type="button" data-category="${c.name}">
      <span aria-hidden="true">${c.icon}</span>
      <span>${c.name}</span>
    </button>`).join("");
}

/* ============ PRODUCTS ============ */
function getFilteredProducts() {
  const q = state.query.trim().toLocaleLowerCase("ky");
  return state.products.filter(p => {
    const catMatch = state.category === "Баары" || p.category === state.category;
    const text = `${p.name} ${p.category} ${p.description}`.toLocaleLowerCase("ky");
    return catMatch && (!q || text.includes(q));
  });
}

function renderProducts() {
  const list = getFilteredProducts();
  $("#productsTitle").textContent = state.category === "Баары" ? "Жаңы товарлар" : state.category;
  $("#resultCount").textContent = `${list.length} товар`;

  $("#productsGrid").innerHTML = list.map(p => `
    <article class="product-card" data-product-id="${p.id}" tabindex="0" role="button">
      <div class="product-image-wrap">
        <img class="product-image" src="${p.images[0]}" alt="${p.name}" loading="lazy">
        ${p.oldPrice && p.oldPrice > p.price
          ? `<span class="discount-badge">-${Math.round((1 - p.price / p.oldPrice) * 100)}%</span>` : ""}
      </div>
      <div class="product-body">
        <span class="category-badge">${p.category}</span>
        <h3 class="product-title">${p.name}</h3>
        <div class="product-meta">
          <span class="rating">★ ${p.rating}</span>
          <div class="price-box">
            <span class="old-price">${money(p.oldPrice || p.price)}</span>
            <span class="price">${money(p.price)}</span>
          </div>
        </div>
        <button class="add-button" type="button" data-add-id="${p.id}">Себетке кошуу</button>
      </div>
    </article>`).join("");

  $("#emptyState").classList.toggle("hidden", list.length !== 0);
}

/* ============ BANNERS ============ */
function renderBanners() {
  $("#slides").innerHTML = state.banners.map((b, i) => `
    <div class="slide" aria-hidden="${i !== state.slideIndex}">
      <div class="slide-content">
        <span class="eyebrow" style="color:#f5d37e">ELGE сунуштайт</span>
        <h2>${b.title}</h2>
        <p>${b.text}</p>
        <button class="slide-button" type="button" data-banner-index="${i}">${b.button}</button>
      </div>
    </div>`).join("");

  $("#sliderDots").innerHTML = state.banners.map((_, i) => `
    <button class="slider-dot ${i === state.slideIndex ? "active" : ""}"
            type="button" data-slide="${i}" aria-label="${i + 1}-баннер"></button>`).join("");

  updateSlider();
}

function updateSlider() {
  $("#slides").style.transform = `translateX(-${state.slideIndex * 100}%)`;
  document.querySelectorAll(".slide").forEach((s, i) =>
    s.setAttribute("aria-hidden", i !== state.slideIndex));
  document.querySelectorAll(".slider-dot").forEach((d, i) =>
    d.classList.toggle("active", i === state.slideIndex));
}
function nextSlide() { state.slideIndex = (state.slideIndex + 1) % state.banners.length; updateSlider(); }
function previousSlide() { state.slideIndex = (state.slideIndex - 1 + state.banners.length) % state.banners.length; updateSlider(); }
function startSlider() { clearInterval(state.timer); state.timer = setInterval(nextSlide, 4500); }

/* ============ PRODUCT MODAL ============ */
function openProduct(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return;
  state.currentProductId = id;
  state.currentImageIndex = 0;

  $("#modalCategory").textContent = p.category;
  $("#modalTitle").textContent = p.name;
  $("#modalRating").textContent = `★ ${p.rating} · Жогорку бааланган`;
  $("#modalPrice").textContent = money(p.price);
  $("#modalDescription").textContent = p.description;
  renderModalGallery();
  $("#productModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function renderModalGallery() {
  const p = state.products.find(x => x.id === state.currentProductId);
  if (!p) return;
  $("#modalMainImage").src = p.images[state.currentImageIndex];
  $("#modalThumbnails").innerHTML = p.images.map((src, i) => `
    <button class="thumbnail ${i === state.currentImageIndex ? "active" : ""}"
            type="button" data-image-index="${i}">
      <img src="${src}" alt="${p.name} ${i + 1}">
    </button>`).join("");
}
function closeProduct() {
  $("#productModal").classList.add("hidden");
  document.body.style.overflow = "";
}

/* ============ CART ============ */
function persistCart() {
  localStorage.setItem("elge_cart", JSON.stringify(state.cart));
}
function getCartTotal() {
  return state.cart.reduce((s, i) => {
    const p = state.products.find(x => x.id === i.id);
    return s + (p ? p.price * i.quantity : 0);
  }, 0);
}
function addToCart(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return;
  const item = state.cart.find(x => x.id === id);
  if (item) item.quantity += 1;
  else state.cart.push({ id, quantity: 1 });
  persistCart();
  renderCart();
  showToast(`${p.name} себетке кошулду`);
}
function changeQuantity(id, delta) {
  const item = state.cart.find(x => x.id === id);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) state.cart = state.cart.filter(x => x.id !== id);
  persistCart();
  renderCart();
}
function removeFromCart(id) {
  state.cart = state.cart.filter(x => x.id !== id);
  persistCart();
  renderCart();
}
function renderCart() {
  const totalCount = state.cart.reduce((s, i) => s + i.quantity, 0);
  const total = getCartTotal();

  $("#cartCount").textContent = totalCount;
  $("#cartTotal").textContent = money(total);
  $("#cartEmpty").classList.toggle("hidden", state.cart.length !== 0);

  $("#cartItems").innerHTML = state.cart.map(item => {
    const p = state.products.find(x => x.id === item.id);
    if (!p) return "";
    return `
      <div class="cart-row">
        <img src="${p.images[0]}" alt="${p.name}">
        <div>
          <h4>${p.name}</h4>
          <p>${money(p.price)} × ${item.quantity}</p>
          <div class="qty-controls">
            <button type="button" data-qty-id="${p.id}" data-delta="-1">−</button>
            <strong>${item.quantity}</strong>
            <button type="button" data-qty-id="${p.id}" data-delta="1">+</button>
          </div>
        </div>
        <button class="remove-item" type="button" data-remove-id="${p.id}">Өчүрүү</button>
      </div>`;
  }).join("");
}

/* ============ CART DRAWER ============ */
function openCart() {
  $("#cartDrawer").classList.add("open");
  $("#cartDrawer").setAttribute("aria-hidden", "false");
  $("#cartBackdrop").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeCart() {
  $("#cartDrawer").classList.remove("open");
  $("#cartDrawer").setAttribute("aria-hidden", "true");
  $("#cartBackdrop").classList.add("hidden");
  document.body.style.overflow = "";
}

/* ============ CHECKOUT (QR) ============ */
$("#closeCheckout").addEventListener("click", closeCheckout);
$("#checkoutModal").addEventListener("click", e => { if (e.target === $("#checkoutModal")) closeCheckout(); });

$("#checkoutForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  const total = getCartTotal();

  // 1. Формируем позиции заказа
  const items = state.cart.map(i => {
    const p = state.products.find(x => x.id === i.id);
    return { id: p.id, name: p.name, price: p.price, quantity: i.quantity };
  });

  // 2. Данные покупателя (сохраняем, чтобы использовать и после закрытия формы)
  const orderData = {
    userId: state.user ? state.user.id : null,
    customerName: f.customer_name.value.trim(),
    customerPhone: f.customer_phone.value.trim(),
    notes: `Дарек: ${f.address.value.trim()}\n${f.note.value.trim()}`.trim(),
    items,
    total
  };

  // 3. Сразу переключаем на шаг QR — показываем сумму и код
  $("#payAmount").textContent = money(total);
  showCheckoutStep("pay");
  $("#checkoutModal").scrollTop = 0;

  // 4. Параллельно пробуем сохранить заказ в Supabase (не блокирует UI)
  state.currentOrderId = null;
  try {
    const order = await createOrder(orderData);
    state.currentOrderId = order.id;
    console.log("[ELGE] Заказ сохранён в Supabase:", order.id);
  } catch (ex) {
    // Не показываем ошибку пользователю — QR уже виден
    console.error("[ELGE] Ошибка сохранения заказа в Supabase:", ex);
    // Сохраняем локально, чтобы можно было передать данные админу
    const localId = "LOCAL-" + Date.now();
    state.currentOrderId = localId;
    try {
      const pending = JSON.parse(localStorage.getItem("elge_pending_orders") || "[]");
      pending.push({ ...orderData, localId, createdAt: new Date().toISOString() });
      localStorage.setItem("elge_pending_orders", JSON.stringify(pending));
    } catch (_) {}
  }
});

$("#markPaid").addEventListener("click", async () => {
  const ref = ($("#paymentRef")?.value || "").trim();
  if (state.currentOrderId && !String(state.currentOrderId).startsWith("LOCAL-")) {
    try {
      await updateOrderStatus(state.currentOrderId, "paid");
      console.log("[ELGE] Статус заказа обновлён на 'paid'");
    } catch (ex) {
      console.error("[ELGE] Не удалось обновить статус:", ex);
    }
  }

  // Прикрепляем комментарий с кодом оплаты к локальному заказу
  if (ref) {
    try {
      const pending = JSON.parse(localStorage.getItem("elge_pending_orders") || "[]");
      const idx = pending.findIndex(o => o.localId === state.currentOrderId);
      if (idx >= 0) { pending[idx].paymentRef = ref; localStorage.setItem("elge_pending_orders", JSON.stringify(pending)); }
    } catch (_) {}
  }

  $("#doneOrderId").textContent = state.currentOrderId || "—";
  showCheckoutStep("done");
});

$("#payLater").addEventListener("click", () => {
  $("#doneOrderId").textContent = state.currentOrderId || "—";
  showCheckoutStep("done");
});

$("#closeDone").addEventListener("click", finishOrder);

/* ============ TOAST ============ */
let toastTimer;
function showToast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2300);
}

/* ============ AUTH UI ============ */
function openAuth() {
  $("#authModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  updateAuthUI();
}
function closeAuth() {
  $("#authModal").classList.add("hidden");
  document.body.style.overflow = "";
}
function updateAuthUI() {
  const logged = !!state.user;

  $("#loginForm").classList.toggle("hidden", logged);
  $("#registerForm").classList.toggle("hidden", logged);
  $("#authProfile").classList.toggle("hidden", !logged);
  document.querySelectorAll(".auth-tab").forEach(t => t.classList.toggle("hidden", logged));

  // Кнопка навбара
  const label = $("#authLabel");
  if (label) label.textContent = logged
    ? (state.profile?.full_name || "Кабинет")
    : "Кирүү";

  if (logged) {
    $("#authHello").textContent = `Салам, ${state.profile?.full_name || state.user.email}!`;
    $("#authRole").textContent = `Роль: ${state.profile?.role || "user"}`;
    $("#dashLink").style.display =
      (state.profile?.role === "admin" || state.profile?.role === "seller")
        ? "inline-flex" : "none";
  }
}

/* ============ DATA LOAD ============ */
async function loadAll() {
  try {
    const [prod, cats, bans] = await Promise.all([
      fetchProducts(), fetchCategories(), fetchBanners()
    ]);
    state.products = prod.map(mapProduct);
    state.categories = cats;
    state.banners = bans;

    renderCategories();
    renderProducts();
    renderBanners();
    renderCart();
    startSlider();
  } catch (e) {
    console.error("Load error", e);
    showToast("Маалыматты жүктөө катасы");
  }
}

/* ============ EVENTS ============ */
document.addEventListener("click", e => {
  const add = e.target.closest("[data-add-id]");
  if (add) { e.stopPropagation(); addToCart(Number(add.dataset.addId)); return; }

  const card = e.target.closest("[data-product-id]");
  if (card) { openProduct(Number(card.dataset.productId)); return; }

  const cat = e.target.closest("[data-category]");
  if (cat) {
    state.category = cat.dataset.category;
    renderCategories(); renderProducts();
    $("#productsSection").scrollIntoView({ behavior: "smooth" });
    return;
  }

  const img = e.target.closest("[data-image-index]");
  if (img) { state.currentImageIndex = Number(img.dataset.imageIndex); renderModalGallery(); return; }

  const qty = e.target.closest("[data-qty-id]");
  if (qty) { changeQuantity(Number(qty.dataset.qtyId), Number(qty.dataset.delta)); return; }

  const rem = e.target.closest("[data-remove-id]");
  if (rem) { removeFromCart(Number(rem.dataset.removeId)); return; }

  const dot = e.target.closest("[data-slide]");
  if (dot) { state.slideIndex = Number(dot.dataset.slide); updateSlider(); startSlider(); return; }

  const tab = e.target.closest("[data-auth-tab]");
  if (tab) {
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const isLogin = tab.dataset.authTab === "login";
    $("#loginForm").classList.toggle("hidden", !isLogin);
    $("#registerForm").classList.toggle("hidden", isLogin);
    return;
  }
});

$("#searchInput").addEventListener("input", e => { state.query = e.target.value; renderProducts(); });

$("#allCategories").addEventListener("click", () => {
  state.category = "Баары";
  renderCategories(); renderProducts();
  $("#productsSection").scrollIntoView({ behavior: "smooth" });
});

$("#prevSlide").addEventListener("click", () => { previousSlide(); startSlider(); });
$("#nextSlide").addEventListener("click", () => { nextSlide(); startSlider(); });
$("#heroSlider").addEventListener("mouseenter", () => clearInterval(state.timer));
$("#heroSlider").addEventListener("mouseleave", startSlider);

/* PRODUCT MODAL */
$("#closeProductModal").addEventListener("click", closeProduct);
$("#productModal").addEventListener("click", e => { if (e.target === $("#productModal")) closeProduct(); });
$("#modalPrevImage").addEventListener("click", () => {
  const p = state.products.find(x => x.id === state.currentProductId);
  if (!p) return;
  state.currentImageIndex = (state.currentImageIndex - 1 + p.images.length) % p.images.length;
  renderModalGallery();
});
$("#modalNextImage").addEventListener("click", () => {
  const p = state.products.find(x => x.id === state.currentProductId);
  if (!p) return;
  state.currentImageIndex = (state.currentImageIndex + 1) % p.images.length;
  renderModalGallery();
});
$("#modalAddToCart").addEventListener("click", () => addToCart(state.currentProductId));

/* CART */
$("#openCart").addEventListener("click", openCart);
$("#closeCart").addEventListener("click", closeCart);
$("#cartBackdrop").addEventListener("click", closeCart);
$("#startCheckout").addEventListener("click", openCheckout);

/* CHECKOUT */
$("#closeCheckout").addEventListener("click", closeCheckout);
$("#checkoutModal").addEventListener("click", e => { if (e.target === $("#checkoutModal")) closeCheckout(); });

$("#checkoutForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;

  const items = state.cart.map(i => {
    const p = state.products.find(x => x.id === i.id);
    return { id: p.id, name: p.name, price: p.price, quantity: i.quantity };
  });
  const total = getCartTotal();
  const notes = `Дарек: ${f.address.value.trim()}\n${f.note.value.trim()}`.trim();

  try {
    const order = await createOrder({
      userId: state.user ? state.user.id : null,
      customerName: f.customer_name.value.trim(),
      customerPhone: f.customer_phone.value.trim(),
      notes,
      items, total
    });
    state.currentOrderId = order.id;
    $("#payAmount").textContent = money(total);
    showCheckoutStep("pay");
  } catch (ex) {
    console.error(ex);
    showToast("Ката: " + ex.message);
  }
});

$("#markPaid").addEventListener("click", async () => {
  if (state.currentOrderId) {
    try { await updateOrderStatus(state.currentOrderId, "paid"); }
    catch (ex) { console.error(ex); }
  }
  $("#doneOrderId").textContent = state.currentOrderId || "—";
  showCheckoutStep("done");
});

$("#payLater").addEventListener("click", () => {
  $("#doneOrderId").textContent = state.currentOrderId || "—";
  showCheckoutStep("done");
});

$("#closeDone").addEventListener("click", finishOrder);

/* AUTH */
$("#authButton").addEventListener("click", openAuth);
$("#closeAuth").addEventListener("click", closeAuth);
$("#authModal").addEventListener("click", e => { if (e.target === $("#authModal")) closeAuth(); });
$("#logoutBtn").addEventListener("click", signOut);

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  const err = f.querySelector("[data-error]");
  err.textContent = "";
  try {
    await signIn({ email: f.email.value.trim(), password: f.password.value });
    showToast("Кирдиңиз ✅");
    await refreshAuth();
    closeAuth();
  } catch (ex) { err.textContent = ex.message; }
});

$("#registerForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  const err = f.querySelector("[data-error]");
  err.textContent = "";
  try {
    await signUp({
      email: f.email.value.trim(),
      password: f.password.value,
      fullName: f.fullName.value.trim(),
      phone: f.phone.value.trim(),
      role: f.role.value
    });
    showToast("Каттоо ийгиликтүү ✅ Email-ди ырастаңыз");
    f.reset();
    await refreshAuth();
    closeAuth();
  } catch (ex) { err.textContent = ex.message; }
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if (!$("#productModal").classList.contains("hidden")) closeProduct();
    if ($("#cartDrawer").classList.contains("open")) closeCart();
    if (!$("#checkoutModal").classList.contains("hidden")) closeCheckout();
    if (!$("#authModal").classList.contains("hidden")) closeAuth();
  }
});

/* ============ AUTH STATE ============ */
async function refreshAuth() {
  const session = await getSession();
  state.user = session?.user || null;
  state.profile = state.user ? await getProfile(state.user.id) : null;
  updateAuthUI();
}

sb.auth.onAuthStateChange(async (_event, session) => {
  state.user = session?.user || null;
  state.profile = state.user ? await getProfile(state.user.id) : null;
  updateAuthUI();
});

/* ============ INIT ============ */
(async function init() {
  $("#year").textContent = new Date().getFullYear();
  await refreshAuth();
  await loadAll();
})();
