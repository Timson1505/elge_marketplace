// supabase.js
const SUPABASE_URL      = "https://dtgspwsxwslntlayqcbe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0Z3Nwd3N4d3NsbnRsYXlxY2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMzM3MzAsImV4cCI6MjEwNDcwOTczMH0.5-2duMCZzKJmCytNMOe-lWR1byxTmsLwOZTdjFG4Yt0";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---------- AUTH ---------- */
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
  const { data } = await sb.auth.getSession();
  return data.session;
}

async function getProfile(userId) {
  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) return null;
  return data;
}

/* ---------- DATA ---------- */
async function fetchProducts() {
  const { data, error } = await sb
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

async function fetchCategories() {
  const { data, error } = await sb
    .from("categories").select("*").order("sort_order");
  if (error) throw error;
  return data;
}

async function fetchBanners() {
  const { data, error } = await sb
    .from("banners").select("*")
    .eq("is_active", true).order("sort_order");
  if (error) throw error;
  return data;
}

/* ---------- ORDERS ---------- */
async function createOrder({ userId, customerName, customerPhone, notes, items, total }) {
  const { data: order, error } = await sb.from("orders").insert({
    user_id: userId, customer_name: customerName,
    customer_phone: customerPhone, notes, total
  }).select().single();
  if (error) throw error;

  const rows = items.map(it => ({
    order_id: order.id,
    product_id: it.id,
    product_name: it.name,
    price: it.price,
    quantity: it.quantity
  }));
  const { error: e2 } = await sb.from("order_items").insert(rows);
  if (e2) throw e2;
  return order;
}