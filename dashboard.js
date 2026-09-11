let me = null, myProfile = null;
let editingId = null;

const $ = s => document.querySelector(s);

/* ---------- INIT ---------- */
(async function init() {
  const session = await getSession();
  if (!session) { location.href = "index.html"; return; }
  me = session.user;
  myProfile = await getProfile(me.id);

  if (!myProfile || !["seller","admin"].includes(myProfile.role)) {
    alert("Бул бетке кирүү укугуңуз жок");
    location.href = "index.html";
    return;
  }

  $("#whoami").textContent = `${myProfile.full_name || me.email} · ${myProfile.role}`;

  await loadCategories();
  await loadMyProducts();
  await loadOrders();
})();

/* ---------- TABS ---------- */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    $("#tabProducts").classList.toggle("hidden", tab !== "products");
    $("#tabOrders").classList.toggle("hidden", tab !== "orders");
  });
});

/* ---------- CATEGORIES ---------- */
async function loadCategories() {
  const cats = await fetchCategories();
  $("#catSelect").innerHTML = cats.map(c =>
    `<option value="${c.name}">${c.name}</option>`).join("");
}

/* ---------- MY PRODUCTS ---------- */
async function loadMyProducts() {
  let q = sb.from("products").select("*").order("created_at", { ascending: false });
  if (myProfile.role === "seller") q = q.eq("seller_id", me.id);

  const { data, error } = await q;
  if (error) { console.error(error); return; }

  $("#count").textContent = data.length;
  $("#dashList").innerHTML = data.map(p => `
    <div class="dash-item">
      <img src="${(p.images && p.images[0]) || 'images/placeholder.png'}" alt="">
      <div>
        <h4>${p.name}</h4>
        <p>${p.category} · ${p.price} сом ${p.is_active ? "" : "· (өчүк)"}</p>
      </div>
      <div class="dash-actions">
        <button class="btn-edit" data-edit="${p.id}">Оңдоо</button>
        <button class="btn-del"  data-del="${p.id}">Өчүрүү</button>
      </div>
    </div>
  `).join("");
}

/* ---------- ORDERS ---------- */
function statusLabel(s) {
  return ({
    new: "Жаңы",
    confirmed: "Ырасталды",
    paid: "Төлөндү",
    delivered: "Жеткирилди",
    cancelled: "Жокко чыгарылды"
  })[s] || s;
}

async function loadOrders() {
  const { data, error } = await sb
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });

  if (error) { console.error(error); return; }

  $("#ordersCount").textContent = data.length;

  if (!data.length) {
    $("#ordersList").innerHTML = `<p style="color:#6d7885">Азырынча заказ жок.</p>`;
    return;
  }

  $("#ordersList").innerHTML = data.map(o => `
    <div class="order-card">
      <div class="order-head">
        <strong>Заказ №${o.id}</strong>
        <span class="order-status status-${o.status}">${statusLabel(o.status)}</span>
      </div>
      <p style="margin:4px 0"><strong>${o.customer_name || "—"}</strong> · ${o.customer_phone || ""}</p>
      <p style="margin:4px 0; color:#6d7885; font-size:13px">${new Date(o.created_at).toLocaleString("ky-KG")}</p>
      ${o.notes ? `<p style="margin:4px 0; white-space:pre-line; font-size:13px">${o.notes}</p>` : ""}
      <ul>
        ${(o.order_items || []).map(i =>
          `<li>${i.product_name} × ${i.quantity} — ${i.price} сом</li>`).join("")}
      </ul>
      <div class="order-total">Жалпы: ${o.total} сом</div>

      ${myProfile.role === "admin" ? `
        <div style="margin-top:10px">
          <select data-order-status="${o.id}">
            ${["new","confirmed","paid","delivered","cancelled"].map(s =>
              `<option value="${s}" ${o.status === s ? "selected" : ""}>${statusLabel(s)}</option>`
            ).join("")}
          </select>
        </div>
      ` : ""}
    </div>
  `).join("");
}

document.addEventListener("change", async e => {
  const sel = e.target.closest("[data-order-status]");
  if (!sel) return;
  try {
    await updateOrderStatus(Number(sel.dataset.orderStatus), sel.value);
    await loadOrders();
  } catch (ex) {
    alert("Ката: " + ex.message);
  }
});

/* ---------- IMAGE UPLOAD ---------- */
// Массив уже загруженных URL (то, что пойдёт в product.images)
let uploadedImages = [];

const pickBtn = document.getElementById("pickImagesBtn");
const fileInput = document.getElementById("imageFile");
const uploadStatus = document.getElementById("uploadStatus");
const imagePreview = document.getElementById("imagePreview");
const imagesField = document.getElementById("imagesField");
const imagesUrlFallback = document.getElementById("imagesUrlFallback");

pickBtn?.addEventListener("click", () => fileInput.click());

fileInput?.addEventListener("change", async e => {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  uploadStatus.textContent = `Жүктөлүүдө: 0 / ${files.length}...`;
  let done = 0;

  for (const file of files) {
    try {
      const url = await uploadProductImage(file);
      uploadedImages.push(url);
      renderImagePreview();
      done++;
      uploadStatus.textContent = `Жүктөлдү: ${done} / ${files.length}`;
    } catch (err) {
      console.error(err);
      uploadStatus.textContent = `Ката: ${err.message}`;
    }
  }

  fileInput.value = ""; // сбрасываем input, чтобы можно было выбрать тот же файл снова
  if (done === files.length) {
    setTimeout(() => uploadStatus.textContent = "", 2500);
  }
});

async function uploadProductImage(file) {
  // 1. Проверка размера и типа
  const MAX_MB = 5;
  if (file.size > MAX_MB * 1024 * 1024) {
    throw new Error(`${file.name} өтө чоң (макс ${MAX_MB}MB)`);
  }
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name} — сүрөт эмес`);
  }

  // 2. Формируем уникальное имя файла: sellerId/время-рандом.расширение
  const ext = file.name.split(".").pop().toLowerCase();
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${me.id}/${safeName}`;

  // 3. Загружаем в bucket product-images
  const { error: upErr } = await sb.storage
    .from("product-images")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type
    });
  if (upErr) throw upErr;

  // 4. Получаем публичный URL
  const { data: pub } = sb.storage
    .from("product-images")
    .getPublicUrl(path);
  return pub.publicUrl;
}

function renderImagePreview() {
  imagePreview.innerHTML = uploadedImages.map((url, i) => `
    <div class="preview-item">
      <img src="${url}" alt="">
      <button type="button" class="preview-remove" data-remove-img="${i}" title="Өчүрүү">×</button>
    </div>
  `).join("");
  imagesField.value = uploadedImages.join("\n");
}

imagePreview?.addEventListener("click", async e => {
  const btn = e.target.closest("[data-remove-img]");
  if (!btn) return;
  const idx = Number(btn.dataset.removeImg);
  const url = uploadedImages[idx];
  uploadedImages.splice(idx, 1);
  renderImagePreview();
  // Пытаемся удалить файл из Storage (не критично, если не получится)
  try {
    const path = url.split("/product-images/")[1];
    if (path) await sb.storage.from("product-images").remove([path]);
  } catch (_) {}
});

// Резервный ввод URL — синхронизируем с uploadedImages
imagesUrlFallback?.addEventListener("input", () => {
  const urls = imagesUrlFallback.value.split("\n").map(x => x.trim()).filter(Boolean);
  // Объединяем загруженные + вручную добавленные (без дублей)
  const combined = [...new Set([...uploadedImages, ...urls])];
  // Показываем только уникальные
  imagePreview.innerHTML = combined.map((url, i) => `
    <div class="preview-item">
      <img src="${url}" alt="">
      <button type="button" class="preview-remove" data-remove-img="${i}">×</button>
    </div>
  `).join("");
  imagesField.value = combined.join("\n");
});

/* ---------- SAVE PRODUCT ---------- */
$("#productForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  const err = $("#formErr");
  err.textContent = "";

  // Собираем изображения из загруженных + ручного поля
const fromField = (imagesField?.value || "").split("\n").map(x => x.trim()).filter(Boolean);
const fromFallback = (imagesUrlFallback?.value || "").split("\n").map(x => x.trim()).filter(Boolean);
const imagesRaw = [...new Set([...fromField, ...fromFallback])];

  const payload = {
    name: f.name.value.trim(),
    price: Number(f.price.value),
    old_price: f.old_price.value ? Number(f.old_price.value) : null,
    category: f.category.value,
    rating: f.rating.value ? Number(f.rating.value) : 5,
    description: f.description.value.trim(),
    images: imagesRaw,
    seller_id: me.id
  };

  try {
    if (editingId) {
      const { error } = await sb.from("products").update(payload).eq("id", editingId);
      if (error) throw error;
    } else {
      const { error } = await sb.from("products").insert(payload);
      if (error) throw error;
    }
    resetForm();
    await loadMyProducts();
  } catch (ex) {
    err.textContent = ex.message;
  }
});

/* ---------- EDIT / DELETE ---------- */
document.addEventListener("click", async e => {
  const ed = e.target.closest("[data-edit]");
  if (ed) {
    const id = Number(ed.dataset.edit);
    const { data: p } = await sb.from("products").select("*").eq("id", id).single();
    if (!p) return;
    editingId = id;
    const f = $("#productForm");
    f.id.value = p.id;
    f.name.value = p.name;
    f.price.value = p.price;
    f.old_price.value = p.old_price || "";
    f.category.value = p.category;
    f.rating.value = p.rating;
    f.images.value = (p.images || []).join("\n");
    f.description.value = p.description || "";
    $("#formTitle").textContent = "Товарды оңдоо";
    $("#saveBtn").textContent = "Жаңыртуу";
    $("#cancelEdit").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  const del = e.target.closest("[data-del]");
  if (del && confirm("Товарды өчүрөсүзбү?")) {
    const { error } = await sb.from("products").delete().eq("id", Number(del.dataset.del));
    if (error) alert(error.message);
    else await loadMyProducts();
  }
});

$("#cancelEdit").addEventListener("click", resetForm);

function resetForm() {
  editingId = null;
  $("#productForm").reset();
  $("#formTitle").textContent = "Жаңы товар кошуу";
  $("#saveBtn").textContent = "Сактоо";
  $("#cancelEdit").classList.add("hidden");
  $("#formErr").textContent = "";
}

$("#logoutBtn").addEventListener("click", signOut);
