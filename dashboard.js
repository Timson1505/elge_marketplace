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
        Заказдарды жүктөө катасы: ${error.message}
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
    $("#ordersList").innerHTML = `<p style="color:#6d7885">Заказдар жок.</p>`;
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
