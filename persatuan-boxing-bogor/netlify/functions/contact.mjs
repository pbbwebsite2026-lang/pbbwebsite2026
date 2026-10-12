const reply=(statusCode,body)=>({statusCode,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'},body:JSON.stringify(body)});
const attempts=new Map();
function sameOrigin(event){const origin=event.headers?.origin;if(!origin)return true;const host=event.headers?.host||event.headers?.['x-forwarded-host'];try{return new URL(origin).host===host}catch{return false}}
export async function handler(event){
 if(event.httpMethod!=='POST')return reply(405,{error:'Metode tidak didukung.'});
 if(!sameOrigin(event))return reply(403,{error:'Asal permintaan tidak diizinkan.'});
 if(event.body&&Buffer.byteLength(event.body,'utf8')>20000)return reply(413,{error:'Pesan terlalu besar.'});
 const ip=event.headers?.['x-nf-client-connection-ip']||'unknown';const now=Date.now();const current=attempts.get(ip)||{count:0,until:0};if(current.until>now)return reply(429,{error:'Terlalu banyak permintaan. Coba lagi beberapa menit.'});
 let x;try{x=JSON.parse(event.body||'{}')}catch{return reply(400,{error:'Format permintaan tidak valid.'})}
 if(String(x.website||'').trim())return reply(200,{ok:true,message:'Permintaan berhasil diteruskan.'});
 const name=String(x.name||'').trim(),contact=String(x.contact||'').trim(),message=String(x.message||'').trim();
 if(!name||!contact||name.length>100||contact.length>160||message.length>1500)return reply(400,{error:'Mohon periksa nama, kontak, dan pesan Anda.'});
 if(!process.env.CONTACT_WEBHOOK_URL)return reply(503,{error:'Formulir belum dihubungkan ke layanan penerima. Silakan hubungi pengelola melalui kontak resmi yang tersedia.'});
 let url;try{url=new URL(process.env.CONTACT_WEBHOOK_URL);if(url.protocol!=='https:')throw Error()}catch{return reply(503,{error:'Konfigurasi layanan formulir tidak valid.'})}
 current.count++;if(current.count>=8){current.until=now+10*60*1000;current.count=0}attempts.set(ip,current);
 try{const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,contact,message,experience:String(x.experience||'').slice(0,80),goal:String(x.goal||'').slice(0,100),receivedAt:new Date().toISOString()}),signal:AbortSignal.timeout(8000)});if(!r.ok)return reply(502,{error:'Pesan belum berhasil dikirim. Coba lagi nanti.'});return reply(200,{ok:true,message:'Permintaan berhasil diteruskan.'})}catch{return reply(502,{error:'Layanan penerima tidak dapat dihubungi. Coba lagi nanti.'})}
}
