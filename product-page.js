/* ELGE dedicated, shareable product page */
const SITE_URL = "https://timson1505.github.io/elge_marketplace/";
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const moneyP = value => Number(value || 0).toLocaleString("ky-KG") + " сом";
const canonicalProductUrl = p => SITE_URL + "product.html?id=" + encodeURIComponent(p.id);
const setMeta = (selector, attr, value) => {
  let el = document.querySelector(selector);
  if (!el) { el = document.createElement("meta"); if (selector.startsWith('meta[property=')) el.setAttribute("property", selector.match(/\[property="([^"]+)/)[1]); else el.setAttribute("name", selector.match(/\[name="([^"]+)/)[1]); document.head.appendChild(el); }
  el.setAttribute(attr, value);
};
function applyProductSeo(p) {
  const url = canonicalProductUrl(p);
  const title = (p.seo_title || (p.name + " — ELGE маркетплейси")).slice(0, 65);
  const desc = (p.meta_description || p.description || (p.name + " товарын ELGE маркетплейсинен көрүңүз.")).replace(/\s+/g," ").slice(0,155);
  document.title = title;
  setMeta('meta[name="description"]', "content", desc);
  setMeta('meta[property="og:title"]', "content", title);
  setMeta('meta[property="og:description"]', "content", desc);
  setMeta('meta[property="og:url"]', "content", url);
  setMeta('meta[property="og:image"]', "content", p.images?.[0] || SITE_URL + "elge_icon.png");
  setMeta('meta[property="og:type"]', "content", "product");
  setMeta('meta[name="twitter:card"]', "content", "summary_large_image");
  let canonical = document.querySelector('link[rel="canonical"]');
  canonical.href = url;
  const schema = {
    "@context":"https://schema.org","@type":"Product","name":p.name,
    "description":desc,"image":p.images || [],
    "sku":String(p.id),"url":url,
    "category":p.category,
    "offers":{"@type":"Offer","url":url,"priceCurrency":"KGS","price":Number(p.price).toFixed(2),"availability":"https://schema.org/InStock","itemCondition":"https://schema.org/NewCondition"}
  };
  let ld = document.getElementById("productJsonLd");
  if (!ld) { ld=document.createElement("script"); ld.id="productJsonLd"; ld.type="application/ld+json"; document.head.appendChild(ld); }
  ld.textContent = JSON.stringify(schema);
}
function addPdpToCart(p) {
  const cart = JSON.parse(localStorage.getItem("elge_cart") || "[]");
  const item = cart.find(x => String(x.id) === String(p.id));
  if (item) item.quantity = Number(item.quantity || 0) + 1;
  else cart.push({id:p.id,quantity:1});
  localStorage.setItem("elge_cart",JSON.stringify(cart));
  const status=document.getElementById("pdpStatus");
  if(status) status.textContent="Себетке кошулду. Буюртма берүү үчүн башкы бетке өтүп, себетти ачыңыз.";
}
async function initProductPage() {
  document.getElementById("year").textContent = new Date().getFullYear();
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const slug = params.get("slug");
  const content = document.getElementById("productContent");
  if (!id && !slug) { content.innerHTML='<section class="pdp-notfound"><h1>Товар тандалган жок</h1><p>Каталогдон товарды тандаңыз.</p><a href="index.html">Каталогго өтүү</a></section>'; return; }
  let query = sb.from("products").select("id,name,price,old_price,rating,category,description,images,slug,seo_title,meta_description,is_promoted,promoted_until,is_active").eq("is_active",true);
  query = id ? query.eq("id",id) : query.eq("slug",slug);
  const {data:p,error} = await query.maybeSingle();
  if(error || !p) { content.innerHTML='<section class="pdp-notfound"><h1>Товар табылган жок</h1><p>Товар өчүрүлгөн же шилтеме эски болушу мүмкүн.</p><a href="index.html">Башкы бетке кайтуу</a></section>'; return; }
  applyProductSeo(p);
  document.getElementById("crumbCategory").textContent=p.category || "Товар";
  const images = Array.isArray(p.images) && p.images.length ? p.images : ["elge_icon.png"];
  const promoted = p.is_promoted && (!p.promoted_until || new Date(p.promoted_until)>new Date());
  content.innerHTML = `
    <article class="pdp-card">
      <section>
        <img class="pdp-image" id="pdpMainImage" src="${esc(images[0])}" alt="${esc(p.name)}">
        <div class="pdp-thumbs">${images.map((src,i)=>`<button type="button" data-pdp-image="${i}" aria-label="Сүрөт ${i+1}"><img src="${esc(src)}" alt="${esc(p.name)} — сүрөт ${i+1}"></button>`).join("")}</div>
      </section>
      <section>
        <p class="pdp-category">${esc(p.category || "Товар")}</p>
        ${promoted?'<span class="pdp-promoted">ELGE сунуштайт</span>':""}
        <h1>${esc(p.name)}</h1>
        <p>★ ${esc(p.rating || 5)} / 5</p>
        <p class="pdp-price">${moneyP(p.price)} ${p.old_price && Number(p.old_price)>Number(p.price)?'<del style="font-size:16px;color:#7a8490">'+moneyP(p.old_price)+'</del>':""}</p>
        <div class="pdp-desc">${esc(p.description || "Товар тууралуу маалымат жакында кошулат.")}</div>
        <div class="pdp-actions"><button class="primary-button" id="pdpAdd" type="button">Себетке кошуу</button><button class="pdp-share" id="pdpShare" type="button">Бөлүшүү ↗</button><a class="pdp-share" href="index.html">Башка товарлар</a></div>
        <p id="pdpStatus" class="pdp-status" aria-live="polite"></p>
      </section>
    </article>`;
  content.querySelectorAll("[data-pdp-image]").forEach(btn=>btn.addEventListener("click",()=>{document.getElementById("pdpMainImage").src=images[Number(btn.dataset.pdpImage)];}));
  document.getElementById("pdpAdd").addEventListener("click",()=>addPdpToCart(p));
  document.getElementById("pdpShare").addEventListener("click",async()=>{
    const url=canonicalProductUrl(p);
    try { if(navigator.share) await navigator.share({title:p.name,text:(p.description||"").slice(0,180),url}); else {await navigator.clipboard.writeText(url);document.getElementById("pdpStatus").textContent="Товардын шилтемеси көчүрүлдү.";}}
    catch(e) { if(e.name!=="AbortError") {prompt("Товар шилтемесин көчүрүңүз:",url);} }
  });
}
initProductPage().catch(e=>{console.error("[ELGE product page]",e);document.getElementById("productContent").innerHTML='<p>Товарды жүктөөдө ката чыкты. Кийинчерээк кайра аракет кылыңыз.</p>';});
