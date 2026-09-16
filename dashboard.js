/* =========================================================
   ELGE — Кабинет (seller / admin)
========================================================= */

const state = {
  user: null,
  profile: null,
  categories: [],
  myProducts: [],
  orders: [],
  editingId: null,
  pendingImages: []
};

const $  = s => document.querySelector(s);
const money = v => `${Number(v).toLocaleString("ky-KG")} сом`;

const DEBUG = true;
const log = (...a) => DEBUG && console.log("[ELGE dash]", ...a);

/* ================= ИНИЦИАЛИЗАЦИЯ ================= */
(async function init() {
  try {
    const session = await getSession();
    if (!session) { location.href = "index.html"; return; }

    state.user = session.user;
    state.profile = await getProfile(state.user.id);
    log("profile:", state.profile);

    if (!state.profile || !["seller","admin"].includes(state.profile.role)) {
      alert("Бул бетке кирүү укугуңуз жок");
      location.href = "index.html";
      return;
    }

    $("#whoami").textContent =
      `${state.profile.full_name || state.user.email} · ${state.profile.role}`;

    state.categories = await fetchCategories();
    renderCategorySelect();

    await loadMyProducts();
    await loadOrders();
    log("init complete");
  } catch (e) {
    console.error("[ELGE dash] init error:", e);
  }
})();

  initSellersTab();

/* ================= ТАБЫ ================= */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    $("#tabProducts").classList.toggle("hidden", tab !== "products");
    $("#tabOrders").classList.toggle("hidden",   tab !== "orders");
    if (tab === "orders") loadOrders();  // ← сразу обновляем при переходе
  });
});

/* ================= КАТЕГОРИИ ================= */
function renderCategorySelect() {
  const sel = $("#catSelect");
  if (!sel) return;
  sel.innerHTML = `<option value="">— тандаңыз —</option>` +
    state.categories.map(c =>
      `<option value="${c.name}">${c.icon || "📦"} ${c.name}</option>`
    ).join("");
}

/* ================= МОИ ТОВАРЫ ================= */
async function loadMyProducts() {
  const listEl = $("#dashList");
  try {
    const { data, error } = await sb
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[ELGE dash] loadMyProducts error:", error);
      listEl.innerHTML =
        `<p style="color:#a23d3d">Товарларды жүктөө катасы: ${error.message}</p>`;
      return;
    }

    log("products fetched:", data?.length);
    const all = data || [];
    state.myProducts = (state.profile.role === "admin")
      ? all
      : all.filter(p => p.seller_id === state.user.id);

    log("myProducts:", state.myProducts.length, state.myProducts);
    renderMyProducts();
  } catch (e) {
    console.error("[ELGE dash] loadMyProducts exception:", e);
    listEl.innerHTML = `<p style="color:#a23d3d">Күтүлбөгөн ката: ${e.message || e}</p>`;
  }
}

function renderMyProducts() {
  $("#count").textContent = state.myProducts.length;

  if (!state.myProducts.length) {
    $("#dashList").innerHTML =
      `<p style="color:#6d7885">Азырынча товар жок. Форма аркылуу кошуңуз.</p>`;
    return;
  }

  $("#dashList").innerHTML = state.myProducts.map(p => {
    const img = (p.images && p.images[0]) || "elge_icon.png";
    return `
      <div class="dash-item">
        <img src="${img}" alt="${p.name}">
        <div>
          <h4>${p.name}</h4>
          <p>${p.category} · ${money(p.price)}
             ${p.is_active === false ? " · <b style='color:#a23d3d'>өчүрүлгөн</b>" : ""}</p>
        </div>
        <div class="dash-actions">
          <button class="btn-edit" data-edit="${p.id}">✏️ Оңдоо</button>
          <button class="btn-del"  data-del="${p.id}">🗑 Өчүрүү</button>
        </div>
      </div>`;
  }).join("");
}

/* ================= ФОРМА ТОВАРА ================= */
$("#productForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  const err = $("#formErr");
  err.textContent = "";

  const fallback = ($("#imagesUrlFallback").value || "")
    .split("\n").map(s => s.trim()).filter(Boolean);
  const images = [...state.pendingImages, ...fallback];

  if (!images.length) {
    err.textContent = "Жок дегенде бир сүрөт кошуңуз";
    return;
  }

  const payload = {
    name:        f.elements.name.value.trim(),
    price:       Number(f.elements.price.value),
    old_price:   f.elements.old_price.value ? Number(f.elements.old_price.value) : null,
    category:    f.elements.category.value,
    rating:      Number(f.elements.rating.value || 5),
    description: f.elements.description.value.trim(),
    images,
    is_active:   true
  };

  if (state.editingId) {
    const { error } = await sb.from("products")
      .update(payload).eq("id", state.editingId);
    if (error) { err.textContent = error.message; return; }
    showToast("Товар жаңыртылды ✅");
  } else {
    const { error } = await sb.from("products")
      .insert({ ...payload, seller_id: state.user.id });
    if (error) { err.textContent = error.message; return; }
    showToast("Товар кошулду ✅");
  }

  resetForm();
  await loadMyProducts();
});

/* ================= РЕДАКТИРОВАНИЕ / УДАЛЕНИЕ ================= */
document.addEventListener("click", async e => {
  const edit = e.target.closest("[data-edit]");
  if (edit) {
    const p = state.myProducts.find(x => String(x.id) === edit.dataset.edit);
    if (!p) return;

    const f = $("#productForm");
    state.editingId = p.id;
    state.pendingImages = [...(p.images || [])];

    f.elements.id.value          = p.id;
    f.elements.name.value        = p.name;
    f.elements.price.value       = p.price;
    f.elements.old_price.value   = p.old_price || "";
    f.elements.category.value    = p.category;
    f.elements.rating.value      = p.rating || 5;
    f.elements.description.value = p.description || "";

    renderImagePreview();
    $("#formTitle").textContent = "Товарды оңдоо";
    $("#saveBtn").textContent   = "Жаңыртуу";
    $("#cancelEdit").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  const del = e.target.closest("[data-del]");
  if (del) {
    if (!confirm("Товарды өчүрөсүзбү?")) return;
    const { error } = await sb.from("products").delete().eq("id", del.dataset.del);
    if (error) { alert(error.message); return; }
    showToast("Өчүрүлдү");
    await loadMyProducts();
  }
});

$("#cancelEdit").addEventListener("click", resetForm);

function resetForm() {
  state.editingId = null;
  state.pendingImages = [];
  $("#productForm").reset();
  $("#formTitle").textContent = "Жаңы товар кошуу";
  $("#saveBtn").textContent   = "Сактоо";
  $("#cancelEdit").classList.add("hidden");
  $("#imagePreview").innerHTML = "";
  $("#uploadStatus").textContent = "";
}

/* ================= ЗАГРУЗКА КАРТИНОК ================= */
$("#pickImagesBtn").addEventListener("click", () => $("#imageFile").click());

$("#imageFile").addEventListener("change", async e => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  $("#uploadStatus").textContent = `Жүктөлүүдө 0 / ${files.length}...`;

  for (let i = 0; i < files.length; i++) {
    try {
      const url = await uploadProductImage(files[i]);
      state.pendingImages.push(url);
      $("#uploadStatus").textContent = `Жүктөлүүдө ${i+1} / ${files.length}...`;
      renderImagePreview();
    } catch (ex) {
      console.error(ex);
      alert("Сүрөт жүктөө катасы: " + ex.message);
    }
  }

  $("#uploadStatus").textContent = `✅ ${files.length} сүрөт даяр`;
  e.target.value = "";
});

function renderImagePreview() {
  $("#imagePreview").innerHTML = state.pendingImages.map((url, i) => `
    <div class="preview-item">
      <img src="${url}" alt="">
      <button class="preview-remove" data-rm-img="${i}" type="button">×</button>
    </div>
  `).join("");
}

document.addEventListener("click", e => {
  const rm = e.target.closest("[data-rm-img]");
  if (rm) {
    state.pendingImages.splice(Number(rm.dataset.rmImg), 1);
    renderImagePreview();
  }
});

/* ================= ЗАКАЗЫ ================= */
async function loadOrders() {
  const listEl = $("#ordersList");
  try {
    const { data: s } = await sb.auth.getSession();
    if (!s?.session) {
      listEl.innerHTML = `<p style="color:#a23d3d">Сессия бүттү. Кайра кириңиз.</p>`;
      return;
    }

    const { data, error } = await sb
      .from("orders")
      .select(`*, order_items (*)`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[ELGE dash] loadOrders error:", error);
      listEl.innerHTML = `<p style="color:#a23d3d">
        Буюртманы жүктөө катасы: ${error.message}
        ${error.hint ? `<br><small>${error.hint}</small>` : ""}
      </p>`;
      return;
    }

    state.orders = data || [];
    log("orders fetched:", state.orders.length);
    renderOrders();
  } catch (e) {
    console.error("[ELGE dash] loadOrders exception:", e);
    listEl.innerHTML = `<p style="color:#a23d3d">Күтүлбөгөн ката: ${e.message || e}</p>`;
  }
}

const STATUS_LABEL = {
  new:       "Жаңы",
  confirmed: "Ырасталды",
  paid:      "Төлөндү",
  delivered: "Жеткирилди",
  cancelled: "Жокко чыгарылды"
};

function renderOrders() {
  $("#ordersCount").textContent = state.orders.length;

  if (!state.orders.length) {
    $("#ordersList").innerHTML = `<p style="color:#6d7885">Буюртма жок.</p>`;
    return;
  }

  $("#ordersList").innerHTML = state.orders.map(o => `
    <div class="order-card">
      <div class="order-head">
        <strong>№${o.id} — ${o.customer_name || "—"}</strong>
        <span class="order-status status-${o.status}">${STATUS_LABEL[o.status] || o.status}</span>
      </div>
      <p style="font-size:13px; color:#6d7885; margin:2px 0">
        📞 ${o.customer_phone || "—"} · ${new Date(o.created_at).toLocaleString("ky-KG")}
      </p>
      ${o.notes ? `<p style="font-size:13px; margin:6px 0">${o.notes}</p>` : ""}
      <ul>
        ${(o.order_items || []).map(i =>
          `<li>${i.product_name} × ${i.quantity} — ${money(i.price * i.quantity)}</li>`
        ).join("") || "<li style='color:#a23d3d'>Позициялар көрүнбөйт</li>"}
      </ul>
      <div class="order-total">Жалпы: ${money(o.total)}</div>
      <div style="margin-top:10px">
        <select data-status-order="${o.id}">
          ${Object.entries(STATUS_LABEL).map(([v,l]) =>
            `<option value="${v}" ${o.status===v?"selected":""}>${l}</option>`
          ).join("")}
        </select>
      </div>
    </div>
  `).join("");
}

/* автообновление раз в 20 с, только если вкладка открыта */
setInterval(() => {
  const tab = $("#tabOrders");
  if (tab && !tab.classList.contains("hidden")) loadOrders();
}, 20000);

/* смена статуса */
document.addEventListener("change", async e => {
  const sel = e.target.closest("[data-status-order]");
  if (!sel) return;
  try {
    await updateOrderStatus(sel.dataset.statusOrder, sel.value);
    showToast("Статус жаңыртылды ✅");
    await loadOrders();
  } catch (ex) {
    alert("Ката: " + ex.message);
  }
});

/* кнопка "🔄 Жаңыртуу" */
const refreshBtn = $("#refreshOrders");
if (refreshBtn) {
  refreshBtn.addEventListener("click", () => {
    loadOrders();
    showToast("Жаңыртылды");
  });
}

/* ================= TOAST / LOGOUT ================= */
let toastTimer;
function showToast(msg) {
  const t = $("#toast");
  if (!t) { alert(msg); return; }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2300);
}

$("#logoutBtn").addEventListener("click", signOut);

/* ================= ВКЛАДКА «САТУУЧУЛАР» (только admin) ================= */
const sellersState = {
  list: [],
  query: "",
  role: "all"
};

function initSellersTab() {
  const btn = $("#tabSellersBtn");
  if (state.profile?.role === "admin") btn.classList.remove("hidden");
  else btn.classList.add("hidden");

  $("#refreshSellers").addEventListener("click", loadSellers);

  $("#sellersSearch").addEventListener("input", e => {
    sellersState.query = e.target.value.toLowerCase().trim();
    renderSellers();
  });

  $("#sellersRoleFilter").addEventListener("change", e => {
    sellersState.role = e.target.value;
    renderSellers();
  });
}

async function loadSellers() {
  const listEl = $("#sellersList");
  listEl.innerHTML = `<p style="color:#6d7885">Жүктөлүүдө...</p>`;

  try {
    const { data, error } = await sb.rpc("admin_get_sellers");
    if (error) throw error;

    sellersState.list = data || [];
    renderSellers();
  } catch (ex) {
    console.error("[ELGE] loadSellers:", ex);
    listEl.innerHTML = `<p style="color:#a23d3d">Ката: ${ex.message || ex}</p>`;
  }
}

function renderSellers() {
  const q = sellersState.query;
  const roleFilter = sellersState.role;

  const filtered = sellersState.list.filter(s => {
    if (roleFilter !== "all" && s.role !== roleFilter) return false;
    if (!q) return true;
    const text = `${s.full_name || ""} ${s.email || ""} ${s.phone || ""}`.toLowerCase();
    return text.includes(q);
  });

  $("#sellersCount").textContent = `(${filtered.length})`;
  $("#sellersEmpty").classList.toggle("hidden", filtered.length !== 0);

  $("#sellersList").innerHTML = filtered.map(s => {
    const initials = (s.full_name || s.email || "?")
      .split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
    const isAdmin = s.role === "admin";
    const agreed = !!s.agreement_at;
    const agreeLabel = isAdmin
      ? ""
      : `<span class="agree-badge ${agreed ? "ok" : "no"}">
           ${agreed ? "✓ Келишим кабыл алынган" : "⚠ Келишим кабыл алынбаган"}
         </span>`;

    return `
      <div class="seller-card ${isAdmin ? "role-admin" : ""}">
        <div class="seller-avatar">${initials}</div>
        <div class="seller-main">
          <h4>
            ${s.full_name || "—"}
            <span class="role-badge role-${s.role}">${s.role}</span>
            ${agreeLabel}
          </h4>
          <p class="seller-email">✉️ ${s.email || "—"}</p>
          <div class="seller-meta">
            <span>📞 ${s.phone || "—"}</span>
            <span>📅 ${new Date(s.created_at).toLocaleDateString("ky-KG")}</span>
            ${agreed ? `<span>📜 ${new Date(s.agreement_at).toLocaleDateString("ky-KG")}</span>` : ""}
          </div>
        </div>
        <div class="seller-stats">
          <div class="seller-stat">
            <span>Товарлар</span>
            <strong>${s.products_count}</strong>
          </div>
          <div class="seller-stat">
            <span>Заказдар</span>
            <strong>${s.orders_count}</strong>
          </div>
          <div class="seller-stat">
            <span>Сатуу</span>
            <strong>${money(s.total_sales)}</strong>
          </div>
        </div>
      </div>
    `;
  }).join("");
}
