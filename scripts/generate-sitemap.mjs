import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
const root = new URL("../", import.meta.url);
const read = async p => readFile(new URL(p, root), "utf8");
const source = await read("supabase.js");
const api = source.match(/SUPABASE_URL\s*=\s*"([^"]+)"/)?.[1];
const key = source.match(/SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/)?.[1];
if (!api || !key) throw new Error("Missing public Supabase URL/key in supabase.js");
const site = (process.env.SITE_URL || "https://timson1505.github.io/elge_marketplace/").replace(/\/$/,"") + "/";
const headers = { apikey:key, Authorization:"Bearer "+key };
async function get(table,select,order="") {
 const res=await fetch(api+"/rest/v1/"+table+"?select="+encodeURIComponent(select)+(order?"&order="+encodeURIComponent(order):""),{headers});
 if(!res.ok) throw new Error(table+" query failed: "+res.status+" "+await res.text());
 return res.json();
}
const products=await get("products","id,name,price,old_price,rating,category,description,images,slug,seo_title,meta_description,is_active,is_promoted,promoted_until,created_at","id.asc");
const categories=await get("categories","id,name,icon,sort_order","sort_order.asc");
const active=products.filter(p=>p.is_active);
const esc=s=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
const slugify=s=>String(s??"category").toLowerCase().trim().replace(/[^a-z0-9а-яё]+/gi,"-").replace(/^-|-$/g,"");
const productUrl=p=>site+"products/"+encodeURIComponent(p.slug||slugify(p.name)+"-"+p.id)+"/";
const categoryUrl=c=>site+"categories/"+encodeURIComponent(slugify(c.name))+"/";
const jsonLd=o=>JSON.stringify(o).replace(/</g,"\\u003c");
const page=(title,description,url,image,body,schema,type="product")=>'<!doctype html><html lang="ky"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><meta name="description" content="'+esc(description)+'"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="'+esc(url)+'"><link rel="icon" href="'+site+'favicon.png"><meta property="og:site_name" content="ELGE"><meta property="og:type" content="'+type+'"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(description)+'"><meta property="og:url" content="'+esc(url)+'"><meta property="og:image" content="'+esc(image||site+"elge_icon.png")+'"><meta name="twitter:card" content="summary_large_image"><link rel="stylesheet" href="'+site+'style.css"><style>.seo-wrap{max-width:1080px;margin:28px auto;padding:0 16px}.seo-card{display:grid;grid-template-columns:1fr 1fr;gap:26px;padding:22px;background:#fff;border:1px solid #e4e9ec;border-radius:18px}.seo-card img{width:100%;max-height:560px;object-fit:contain;border-radius:12px;background:#f6f8f8}.seo-price{font-size:28px;font-weight:900;color:#087f5b}.seo-desc{white-space:pre-line;line-height:1.75}.seo-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.seo-tile{color:inherit;text-decoration:none;border:1px solid #e4e9ec;border-radius:14px;overflow:hidden;background:white}.seo-tile img{width:100%;aspect-ratio:1;object-fit:cover}.seo-tile div{padding:10px}.seo-tile h2{font-size:15px}.seo-button{display:inline-block;border-radius:9px;padding:11px 15px;background:#087f5b;color:white;text-decoration:none;font-weight:800}@media(max-width:700px){.seo-card{grid-template-columns:1fr}.seo-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}</style></head><body><header class="navbar"><div class="container nav-inner"><a class="logo" href="'+site+'">EL<span class="logo1">GE</span></a><a class="cart-button" href="'+site+'">← Башкы бет</a></div></header><main class="seo-wrap">'+body+'</main><footer class="footer"><div class="container footer-bottom">© ELGE маркетплейси</div></footer><script type="application/ld+json">'+jsonLd(schema)+'</script></body></html>';
// Only this generated directory is replaced on every run.
await rm(new URL("../products/",import.meta.url),{recursive:true,force:true});
await rm(new URL("../categories/",import.meta.url),{recursive:true,force:true});
await mkdir(new URL("../products/",import.meta.url),{recursive:true});
await mkdir(new URL("../categories/",import.meta.url),{recursive:true});
const sitemapUrls=[{loc:site,lastmod:new Date().toISOString().slice(0,10)}];
for(const p of active){
 const slug=p.slug||slugify(p.name)+"-"+p.id, url=productUrl(p), title=p.seo_title||p.name+" — ELGE маркетплейси";
 const description=(p.meta_description||p.description||p.name).replace(/\s+/g," ").slice(0,155);
 const image=p.images?.[0]||site+"elge_icon.png";
 const body='<nav><a href="'+site+'">Башкы бет</a> / <a href="'+categoryUrl({name:p.category})+'">'+esc(p.category)+'</a></nav><article class="seo-card"><div><img src="'+esc(image)+'" alt="'+esc(p.name)+'"></div><div><p>'+esc(p.category)+'</p><h1>'+esc(p.name)+'</h1><p class="seo-price">'+Number(p.price).toLocaleString("ky-KG")+' сом</p><p class="seo-desc">'+esc(p.description||"Товар тууралуу маалымат жакында кошулат.")+'</p><p><a class="seo-button" href="'+site+'product.html?id='+encodeURIComponent(p.id)+'">Себетке кошуу жана буюртма берүү</a></p><p><a href="'+site+'">ELGE каталогунда башка товарларды көрүү</a></p></div></article>';
 const schema={"@context":"https://schema.org","@type":"Product","name":p.name,"description":description,"image":p.images||[],"sku":String(p.id),"url":url,"category":p.category,"offers":{"@type":"Offer","url":url,"priceCurrency":"KGS","price":Number(p.price).toFixed(2),"availability":"https://schema.org/InStock","itemCondition":"https://schema.org/NewCondition"}};
 const dir=new URL("../products/"+slug+"/",import.meta.url);await mkdir(dir,{recursive:true});
 await writeFile(new URL("index.html",dir),page(title,description,url,image,body,schema));
 sitemapUrls.push({loc:url});
}
for(const c of categories){
 const slug=slugify(c.name),url=categoryUrl(c),items=active.filter(p=>p.category===c.name);
 const description=c.name+" категориясындагы товарларды ELGE маркетплейсинен көрүңүз.";
 const body='<nav><a href="'+site+'">Башкы бет</a> / '+esc(c.name)+'</nav><h1>'+esc(c.name)+' — товарлар</h1><p>'+esc(description)+'</p><div class="seo-grid">'+items.map(p=>'<a class="seo-tile" href="'+productUrl(p)+'"><img loading="lazy" src="'+esc(p.images?.[0]||site+"elge_icon.png")+'" alt="'+esc(p.name)+'"><div><h2>'+esc(p.name)+'</h2><p>'+Number(p.price).toLocaleString("ky-KG")+' сом</p></div></a>').join("")+'</div>';
 const schema={"@context":"https://schema.org","@type":"CollectionPage","name":c.name+" — ELGE","description":description,"url":url,"mainEntity":{"@type":"ItemList","itemListElement":items.map((p,i)=>({"@type":"ListItem","position":i+1,"url":productUrl(p),"name":p.name}))}};
 await mkdir(new URL("../categories/"+slug+"/",import.meta.url),{recursive:true});
 await writeFile(new URL("index.html",new URL("../categories/"+slug+"/",import.meta.url)),page(c.name+" — товарлар | ELGE",description,url,items[0]?.images?.[0],body,schema,"website"));
 sitemapUrls.push({loc:url});
}
const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+sitemapUrls.map(x=>'  <url><loc>'+esc(x.loc)+'</loc>'+(x.lastmod?'<lastmod>'+x.lastmod+'</lastmod>':'')+'<changefreq>weekly</changefreq><priority>'+(x.loc===site?'1.0':'0.7')+'</priority></url>').join("\n")+'\n</urlset>\n';
await writeFile(new URL("../sitemap.xml",import.meta.url),xml);
console.log("Generated "+active.length+" product pages, "+categories.length+" category pages, and sitemap entries.");
