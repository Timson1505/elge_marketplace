// supabase.js
const SUPABASE_URL      = "https://dtgspwsxwslntlayqcbe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0Z3Nwd3N4d3NsbnRsYXlxY2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMzM3MzAsImV4cCI6MjEwNDcwOTczMH0.5-2duMCZzKJmCytNMOe-lWR1byxTmsLwOZTdjFG4Yt0";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ============ AUTH ============ */
async function signUp({ email, password, fullName, phone, role }) {
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { data: { full_name: fullName, phone, role } }
  });
  if (error) throw error;
  return data;
}

async function signIn({ email, password }) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  await sb.auth.signOut();
  localStorage.removeItem("elge_cart");
  location.reload();
}

async function getSession() {
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  return data.session;
}

async function getProfile(userId) {
  const { data, error } = await sb
    .from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) { console.error("getProfile:", error); return null; }

  if (!data) {
    const { data: u } = await sb.auth.getUser();
    const meta = u?.user?.user_metadata || {};
    const role = ["user","seller","admin"].includes(meta.role) ? meta.role : "user";
    const { data: inserted, error: insErr } = await sb
      .from("profiles")
      .insert({ id: userId, full_name: meta.full_name || "", phone: meta.phone || "", role })
      .select().maybeSingle();
    if (insErr) { console.error("insert profile:", insErr); return null; }
    return inserted;
  }
  return data;
}

/* ============ PRODUCTS ============ */
async function fetchProducts() {
  const { data, error } = await sb
    .from("products").select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

async function fetchCategories() {
  const { data, error } = await sb.from("categories").select("*").order("sort_order");
  if (error) throw error;
  return data;
}

async function fetchBanners() {
  const { data, error } = await sb
    .from("banners").select("*").eq("is_active", true).order("sort_order");
  if (error) throw error;
  return data;
}

/* ============ ORDERS ============ */
async function createOrder({ userId, customerName, customerPhone, notes, items, total }) {
  const { data, error } = await sb.rpc("create_order", {
    p_user_id:        userId,
    p_customer_name:  customerName,
    p_customer_phone: customerPhone,
    p_notes:          notes,
    p_total:          total,
    p_items:          items
  });
  if (error) { console.error("create_order:", error); throw error; }
  return { id: data };
}

async function updateOrderStatus(orderId, status) {
  const { error } = await sb.from("orders").update({ status }).eq("id", orderId);
  if (error) { console.error("updateOrderStatus:", error); throw error; }
}

async function fetchOrders() {
  const { data, error } = await sb
    .from("orders")
    .select(`*, order_items (*)`)
    .order("created_at", { ascending: false });
  if (error) { console.error("fetchOrders:", error); throw error; }
  return data;
}

/* ============ STORAGE — ЗАГРУЗКА КАРТИНОК ТОВАРА ============ */
async function uploadProductImage(file) {
  const { data: u } = await sb.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) throw new Error("Авторизация керек");

  // Безопасное имя + путь: {userId}/{timestamp}-{random}.ext
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const safe = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const path = `${uid}/${safe}`;

  const { error } = await sb.storage
    .from("products")
    .upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false });
  if (error) throw error;

  const { data } = sb.storage.from("products").getPublicUrl(path);
  return data.publicUrl;
}


async function fetchOrders() {
  const { data, error } = await sb
    .from("orders")
    .select(`
      *,
      order_items (
        *,
        product:product_id ( id, name, seller:seller_id ( full_name ) )
      )
    `)
    .order("created_at", { ascending: false });
  if (error) throw error;

  // Разворачиваем seller в плоское поле для удобства рендера
  return (data || []).map(o => ({
    ...o,
    order_items: (o.order_items || []).map(i => ({
      ...i,
      product_seller_name: i.product?.seller?.full_name || null
    }))
  }));
}
