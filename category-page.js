const CAT_SITE="https://timson1505.github.io/elge_marketplace/";
const catEsc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const catSlug=v=>String(v??"").toLowerCase().trim().replace(/[^a-z0-9а-яё]+/gi,"-").replace(/^-|-$/g,"");
async function initCategory(){
 const name=new URLSearchParams(location.search).get("name");
 const {data:cats,error:ce}=await sb.from("categories").select("name").order("sort_order");
 const category=(cats||[]).find(c=>c.name===name||catSlug(c.name)===name);
 const title=category?.name||name;
 if(!title){document.getElementById("catProducts").textContent="Категория тандалган жок.";return;}
 const {data:products,error}=await sb.from("products").select("id,name,price,category,description,images,slug,is_promoted,promoted_until").eq("is_active",true).eq("category",category?.name||title).order("created_at",{ascending:false});
 document.title=title+" — товарлар | ELGE";
 document.querySelector('meta[name="description"]').content=title+" категориясындагы товарларды ELGE маркетплейсинен карап чыгыңыз.";
 document.querySelector('meta[property="og:title"]').content=document.title;
 document.querySelector('meta[property="og:description"]').content=document.querySelector('meta[name="description"]').content;
 document.querySelector('link[rel="canonical"]').href=CAT_SITE+"category.html?name="+encodeURIComponent(title);
 document.getElementById("catTitle").textContent=title+" — товарлар";
 document.getElementById("catCrumb").textContent=title;
 const el=document.getElementById("catProducts");
 if(error){el.textContent="Маалыматты жүктөөдө ката чыкты.";return;}
 if(!products?.length){el.textContent="Бул категорияда азырынча товар жок.";return;}
 const active=products.filter(p=>p.is_promoted&&(!p.promoted_until||new Date(p.promoted_until)>new Date())).concat(products.filter(p=>!p.is_promoted|| (p.promoted_until&&new Date(p.promoted_until)<=new Date())));
 el.innerHTML=active.map(p=>'<a class="cat-card" href="product.html?id='+encodeURIComponent(p.id)+'"><img loading="lazy" src="'+catEsc(p.images?.[0]||"elge_icon.png")+'" alt="'+catEsc(p.name)+'"><div><h2>'+catEsc(p.name)+'</h2><p class="cat-desc">'+catEsc((p.description||"").slice(0,110))+'</p><p class="cat-price">'+Number(p.price).toLocaleString("ky-KG")+' сом</p></div></a>').join("");
 const schema={"@context":"https://schema.org","@type":"CollectionPage","name":document.title,"description":document.querySelector('meta[name="description"]').content,"url":location.href,"mainEntity":{"@type":"ItemList","itemListElement":active.map((p,i)=>({"@type":"ListItem","position":i+1,"url":CAT_SITE+"product.html?id="+encodeURIComponent(p.id),"name":p.name}))}};
 const ld=document.createElement("script");ld.type="application/ld+json";ld.textContent=JSON.stringify(schema);document.head.appendChild(ld);
}
initCategory();
