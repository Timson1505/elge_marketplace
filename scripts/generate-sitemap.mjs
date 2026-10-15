import { readFile, writeFile } from "node:fs/promises";
const source = await readFile(new URL("../supabase.js", import.meta.url), "utf8");
const url = source.match(/SUPABASE_URL\s*=\s*"([^"]+)"/)?.[1];
const key = source.match(/SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/)?.[1];
if (!url || !key) throw new Error("Could not read Supabase public URL/key from supabase.js");
const site = (process.env.SITE_URL || "https://timson1505.github.io/elge_marketplace/").replace(/\/$/,"") + "/";
const response = await fetch(url + "/rest/v1/products?select=id,updated_at:created_at&is_active=eq.true&order=id.asc", {headers:{apikey:key,Authorization:"Bearer "+key}});
if (!response.ok) throw new Error("Supabase product query failed: " + response.status + " " + await response.text());
const products = await response.json();
const urls = [{loc:site,lastmod:new Date().toISOString().slice(0,10)},...products.map(p=>({loc:site+"product.html?id="+encodeURIComponent(p.id)}))];
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
 urls.map(item=>'  <url><loc>'+escapeXml(item.loc)+'</loc>'+(item.lastmod?'<lastmod>'+item.lastmod+'</lastmod>':'')+'<changefreq>weekly</changefreq><priority>'+(item.loc===site?'1.0':'0.7')+'</priority></url>').join("\n") +
 '\n</urlset>\n';
await writeFile(new URL("../sitemap.xml",import.meta.url),xml);
console.log("Generated sitemap with "+products.length+" active product URLs.");
function escapeXml(value){return value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");}
