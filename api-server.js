// ===== STORM — serveur comptes / cadeaux / classement =====
const http = require('http');
const fs = require('fs');
const ADMIN_KEY = 'MUZZK37';
const FILE = process.env.DATA_FILE || '/tmp/storm-data.json';
let db = { users:{}, gifts:{}, scores:{}, paids:[], donors:{} };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(FILE,'utf8'))); } catch(e){}
let saveT=null;
function save(){ clearTimeout(saveT); saveT=setTimeout(()=>{ try{ fs.writeFileSync(FILE, JSON.stringify(db)); }catch(e){} }, 500); }
function send(res, code, obj){
  res.writeHead(code, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});
  res.end(JSON.stringify(obj));
}
function body(req){ return new Promise(r=>{ let d=''; req.on('data',c=>d+=c); req.on('end',()=>{ try{r(JSON.parse(d||'{}'));}catch(e){r({});} }); }); }
const server = http.createServer(async (req,res)=>{
  if(req.method==='OPTIONS') return send(res,200,{});
  const u = new URL(req.url, 'http://x');
  const path = u.pathname;
  if(path==='/') return send(res,200,{ok:true, msg:'Storm API OK'});
  if(path==='/register' && req.method==='POST'){
    const b=await body(req); const p=(b.pseudo||'').trim().toLowerCase();
    if(p.length<3) return send(res,200,{error:'short'});
    if(db.users[p]) return send(res,200,{error:'taken'});
    db.users[p]={ pw:b.pw||'', name:(b.pseudo||'').trim() }; save();
    return send(res,200,{ok:true});
  }
  if(path==='/login' && req.method==='POST'){
    const b=await body(req); const p=(b.pseudo||'').trim().toLowerCase();
    const u2=db.users[p]; if(!u2) return send(res,200,{error:'nouser'});
    if(u2.pw!==(b.pw||'')) return send(res,200,{error:'badpw'});
    return send(res,200,{ok:true,name:u2.name});
  }
  if(path==='/exists'){
    const p=(u.searchParams.get('pseudo')||'').trim().toLowerCase();
    return send(res,200,{exists:!!db.users[p]});
  }
  if(path==='/score' && req.method==='POST'){
    const b=await body(req); const name=(b.pseudo||'').trim(); if(!name) return send(res,200,{error:'noname'});
    const key=name.toLowerCase(); const cur=db.scores[key]||{name,wave:0,kills:0};
    cur.name=name;
    if((b.wave||0)>cur.wave) cur.wave=b.wave|0;
    if((b.kills||0)>cur.kills) cur.kills=b.kills|0;
    db.scores[key]=cur; save(); return send(res,200,{ok:true});
  }
  if(path==='/top'){
    const arr=Object.values(db.scores).sort((a,b)=>b.wave-a.wave||b.kills-a.kills).slice(0,30);
    return send(res,200,{top:arr});
  }
  if(path==='/gift' && req.method==='POST'){
    const b=await body(req);
    if((b.key||'')!==ADMIN_KEY) return send(res,200,{error:'auth'});
    const p=(b.pseudo||'').trim().toLowerCase(); if(!p) return send(res,200,{error:'nop'});
    if(!db.gifts[p]) db.gifts[p]=[];
    db.gifts[p].push(b.gift||{}); save(); return send(res,200,{ok:true});
  }
  if(path==='/gifts'){
    const p=(u.searchParams.get('pseudo')||'').trim().toLowerCase();
    const g=db.gifts[p]||[]; db.gifts[p]=[]; if(g.length)save();
    return send(res,200,{gifts:g});
  }
  if(path==='/paid' && req.method==='POST'){
    const b=await body(req);
    db.paids.push({ pseudo:(b.pseudo||'').trim(), method:b.method||'?', comment:(b.comment||'').slice(0,200), img:(b.img||'').slice(0,400000), t:Date.now() });
    if(db.paids.length>120) db.paids=db.paids.slice(-120);
    save(); return send(res,200,{ok:true});
  }
  if(path==='/paids'){
    if((u.searchParams.get('key')||'')!==ADMIN_KEY) return send(res,200,{error:'auth'});
    return send(res,200,{paids:db.paids.slice().reverse()});
  }
  if(path==='/paiddone' && req.method==='POST'){
    const b=await body(req); if((b.key||'')!==ADMIN_KEY) return send(res,200,{error:'auth'});
    db.paids=db.paids.filter(x=>!(x.pseudo===b.pseudo && x.t===b.t)); save();
    return send(res,200,{ok:true});
  }
  if(path==='/donate' && req.method==='POST'){
    const b=await body(req); if((b.key||'')!==ADMIN_KEY) return send(res,200,{error:'auth'});
    const name=(b.pseudo||'').trim(); if(!name) return send(res,200,{error:'nop'});
    const key=name.toLowerCase(); const cur=db.donors[key]||{name,total:0};
    cur.name=name; cur.total=Math.round((cur.total+(parseFloat(b.amount)||0))*100)/100;
    db.donors[key]=cur; save(); return send(res,200,{ok:true});
  }
  if(path==='/donors'){
    const arr=Object.values(db.donors).sort((a,b)=>b.total-a.total).slice(0,5);
    return send(res,200,{donors:arr});
  }
  if(path==='/vip' && req.method==='POST'){
    const b=await body(req); const name=(b.pseudo||'').trim(); const key=name.toLowerCase();
    if(!key) return send(res,200,{error:'nop'});
    db.vip = db.vip || { used:[] };
    if(db.vip.used.indexOf(key)>=0) return send(res,200,{error:'used'});
    if(db.vip.used.length>=4) return send(res,200,{error:'full'});
    db.vip.used.push(key); save();
    return send(res,200,{ok:true, left: 4-db.vip.used.length});
  }
  send(res,404,{error:'notfound'});
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>console.log('Storm API sur le port '+PORT));
