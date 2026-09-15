// dashboard.js
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
  pendingImages: []   // URL уже загруженных картинок
};

const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const money = v => `${Number(v).toLocaleString("ky-KG")} сом`;

/* ================= ИНИЦИАЛИЗАЦИЯ ================= */
(async function init() {
  const session = await getSession();
  if (!session) { location.href = "index.html"; return; }

  state.user = session.user;
  state.profile = await getProfile(state.user.id);

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
})();

/* ================= ТАБЫ ================= */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    $("#tabProducts").classList.toggle("hidden", tab !== "products");
    $("#tabOrders").classList.toggle("hidden",   tab !== "orders");
  });
});

/* ================= КАТЕГОРИИ В СЕЛЕКТЕ ================= */
function renderCategorySelect() {
  const sel = $("#catSelect");
  sel.innerHTML = `<option value="">— тандаңыз —</option>` +
    state.categories.map(c =>
      `<option value="${c.name}">${c.icon || "📦"} ${c.name}</option>`
    ).join("");
}

/* ================= МОИ ТОВАРЫ ================= */
async function loadMyProducts() {
  const { data, error } = await sb
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) { console.error(error); return; }

  // админ — все товары, продавец — только свои
  state.myProducts = (state.profile.role === "admin")
    ? data
    : data.filter(p => p.seller_id === state.user.id);

  renderMyProducts();
}

function renderMyProducts() {
  $("#count").textContent = state.myProducts.length;

  if (!state.myProducts.length) {
    $("#dashList").innerHTML = `
      <p style="color:#6d7885">Азырынча товар жок. Форма аркылуу кошуңуз.</p>`;
    return;
  }

  $("#dashList").innerHTML = state.myProducts.map(p => `
    <div class="dash-item">
      <img src="${(p.images && p.images[0]) || 'elge_icon.png'}" alt="${p.name}">
      <div>
        <h4>${p.name}</h4>
        <p>${p.category} · ${money(p.price)}
           ${p.is_active === false ? " · <b style='color:#a23d3d'>өчүрүлгөн</b>" : ""}</p>
      </div>
      <div class="dash-actions">
        <button class="btn-edit" data-edit="${p.id}">✏️ Оңдоо</button>
        <button class="btn-del"  data-del="${p.id}">🗑 Өчүрүү</button>
      </div>
    </div>
  `).join("");
}

/* ================= ФОРМА ТОВАРА ================= */
$("#productForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  const err = $("#formErr");
  err.textContent = "";

  // собираем картинки: pending + fallback URL'ы
  const fallback = ($("#imagesUrlFallback").value || "")
    .split("\n").map(s => s.trim()).filter(Boolean);

  const images = [...state.pendingImages, ...fallback];

  if (!images.length) {
    err.textContent = "Жок дегенде бир сүрөт кошуңуз";
    return;
  }

  const payload = {
    name:        f.name.value.trim(),
    price:       Number(f.price.value),
    old_price:   f.old_price.value ? Number(f.old_price.value) : null,
    category:    f.category.value,
    rating:      Number(f.rating.value || 5),
    description: f.description.value.trim(),
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

/* ================= РЕДАКТИРОВАНИЕ ================= */
document.addEventListener("click", async e => {
  const edit = e.target.closest("[data-edit]");
  if (edit) {
    const p = state.myProducts.find(x => String(x.id) === edit.dataset.edit);
    if (!p) return;

    const f = $("#productForm");
    state.editingId = p.id;
    state.pendingImages = [...(p.images || [])];

    f.id.value        = p.id;
    f.name.value      = p.name;
    f.price.value     = p.price;
    f.old_price.value = p.old_price || "";
    f.category.value  = p.category;
    f.rating.value    = p.rating || 5;
    f.description.value = p.description || "";

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
    // ✳ Явно проверяем сессию — на случай истёкшего JWT
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
      console.error("[ELGE dashboard] fetchOrders error:", error);
      listEl.innerHTML = `<p style="color:#a23d3d">
        Буюртманы жүктөө катасы: ${error.message}
        ${error.hint ? `<br><small>${error.hint}</small>` : ""}
      </p>`;
      return;
    }

    state.orders = data || [];

    // ✳ Диагностика в консоль — видно, что реально вернул сервер
    console.log("[ELGE dashboard] orders fetched:", state.orders);

    renderOrders();
  } catch (e) {
    console.error("[ELGE dashboard] loadOrders exception:", e);
    listEl.innerHTML = `<p style="color:#a23d3d">
      Күтүлбөгөн ката: ${e.message || e}
    </p>`;
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

/* ====== Обновление каждые 20 сек ====== */
 setInterval(() => {
    if (!$("#tabOrders").classList.contains("hidden")) loadOrders();
  }, 20000);

document.addEventListener("change", async e => {
  const sel = e.target.closest("[data-status-order]");
  if (!sel) return;
  const id = sel.dataset.statusOrder;
  try {
    await updateOrderStatus(id, sel.value);
    showToast("Статус жаңыртылды ✅");
    await loadOrders();
  } catch (ex) {
    alert("Ката: " + ex.message);
  }
});

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
