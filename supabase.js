```js
// supabase.js

const SUPABASE_URL      = "https://dtgspwsxwslntlayqcbe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0Z3Nwd3N4d3NsbnRsYXlxY2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMzM3MzAsImV4cCI6MjEwNDcwOTczMH0.5-2duMCZzKJmCytNMOe-lWR1byxTmsLwOZTdjFG4Yt0";

const sb = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


/* =========================================================
   AUTH
========================================================= */

async function signUp({ email, password, fullName, phone, role }) {
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone: phone,
        role: role
      }
    }
  });

  if (error) throw error;

  return data;
}


async function signIn({ email, password }) {
  const { data, error } =
    await sb.auth.signInWithPassword({
      email,
      password
    });

  if (error) throw error;

  return data;
}


async function signOut() {
  await sb.auth.signOut();

  localStorage.removeItem("elge_cart");

  location.reload();
}


async function getSession() {
  const { data, error } =
    await sb.auth.getSession();

  if (error) throw error;

  return data.session;
}


async function getProfile(userId) {
  const { data, error } =
    await sb
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

  if (error) {
    console.error("Ошибка получения профиля:", error);
    return null;
  }

  return data;
}


/* =========================================================
   PRODUCTS
========================================================= */

async function fetchProducts() {
  const { data, error } =
    await sb
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("created_at", {
        ascending: false
      });

  if (error) throw error;

  return data;
}


async function fetchCategories() {
  const { data, error } =
    await sb
      .from("categories")
      .select("*")
      .order("sort_order");

  if (error) throw error;

  return data;
}


async function fetchBanners() {
  const { data, error } =
    await sb
      .from("banners")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");

  if (error) throw error;

  return data;
}


/* =========================================================
   ORDERS
========================================================= */

async function createOrder({
  userId,
  customerName,
  customerPhone,
  notes,
  items,
  total
}) {

  console.log("Создание заказа:", {
    userId,
    customerName,
    customerPhone,
    notes,
    items,
    total
  });

  const { data, error } =
    await sb.rpc("create_order", {
      p_user_id: userId,
      p_customer_name: customerName,
      p_customer_phone: customerPhone,
      p_notes: notes,
      p_total: total,
      p_items: items
    });

  if (error) {
    console.error("Ошибка create_order:", error);
    throw error;
  }

  console.log("Заказ успешно создан:", data);

  return {
    id: data
  };
}


/* =========================================================
   UPDATE ORDER STATUS
========================================================= */

async function updateOrderStatus(orderId, status) {

  const { error } =
    await sb
      .from("orders")
      .update({
        status: status
      })
      .eq("id", orderId);

  if (error) {
    console.error(
      "Ошибка изменения статуса заказа:",
      error
    );

    throw error;
  }
}


/* =========================================================
   ADMIN — GET ORDERS
========================================================= */

async function fetchOrders() {

  const { data, error } =
    await sb
      .from("orders")
      .select(`
        *,
        order_items (*)
      `)
      .order("created_at", {
        ascending: false
      });

  if (error) {
    console.error(
      "Ошибка получения заказов:",
      error
    );

    throw error;
  }

  return data;
}
```
