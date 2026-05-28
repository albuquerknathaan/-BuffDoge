import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// ══════════════════════════════════════════════════════
//  STORAGE
// ══════════════════════════════════════════════════════
const KEYS = { vendas:"ironlabs_sales_v1", meta:"ironlabs_meta_v1", estoque:"ironlabs_estoque_v1", followups:"ironlabs_followups_v1" };
const save = (k,d) => { try { localStorage.setItem(k, JSON.stringify(d)); } catch {} };
const load = (k,def=[]) => { try { const r=localStorage.getItem(k); return r?JSON.parse(r):def; } catch { return def; } };

// ══════════════════════════════════════════════════════
//  BACKUP — exporta/importa JSON para nunca perder dados
// ══════════════════════════════════════════════════════
function exportarBackup(vendas) {
  const data = { vendas, exportado: new Date().toISOString(), versao: "ironlabs_v2" };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `ironlabs_backup_${new Date().toLocaleDateString("pt-BR").replace(/\//g,"-")}.json`;
  a.click(); URL.revokeObjectURL(url);
}

function importarBackup(file, onSuccess, onError) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      // Aceita tanto formato novo {vendas:[]} quanto array direto
      const lista = Array.isArray(data) ? data : (data.vendas || []);
      if (!Array.isArray(lista)) throw new Error("Formato inválido");
      onSuccess(lista);
    } catch(err) { onError(err.message); }
  };
  reader.readAsText(file);
}

// Recupera vendas tentando TODAS as chaves já usadas em versões anteriores
function loadVendas() {
  const ALL_KEYS = ["ironlabs_sales_v1","ironlabs_pedidos2","ironlabs_pedidos","il_v3","ironlabs_v4","ironlabs_ecosystem_sales"];
  let best = [];
  for (const k of ALL_KEYS) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > best.length) best = parsed;
    } catch {}
  }
  if (best.length > 0) { try { localStorage.setItem("ironlabs_sales_v1", JSON.stringify(best)); } catch {} }
  return best;
}
// Recupera vendas tentando TODAS as chaves já usadas em versões anteriores

// ══════════════════════════════════════════════════════
//  CATÁLOGO
// ══════════════════════════════════════════════════════
const CAT = [
  {code:"TS-E",    nome:"Testosterona Enantato"},
  {code:"TS-C",    nome:"Testosterona Cipionato"},
  {code:"TS-P",    nome:"Testosterona Propionato"},
  {code:"SUS",     nome:"Sustanon / Durateston"},
  {code:"DC-N",    nome:"Deca Nandrolona"},
  {code:"NPP",     nome:"Nandrolona Fenilprop."},
  {code:"TB-A",    nome:"Trembolona Acetato"},
  {code:"MS-P",    nome:"Masteron Drostanolona"},
  {code:"BD-U",    nome:"Boldenona Equipoise"},
  {code:"OXA",     nome:"Oxandrolona Anavar"},
  {code:"DBL",     nome:"Dianabol Metandrost."},
  {code:"CLEN",    nome:"Clembuterol"},
  {code:"HMG",     nome:"Hemogenin Oximetalona"},
  {code:"COSM",    nome:"Cosmeticos"},
  {code:"TG",      nome:"T.G"},
  {code:"PROV",    nome:"Proviron"},
  {code:"STAN",    nome:"Stanozolol"},
  {code:"GHK-CU",  nome:"GHK-CU 10mg"},
  {code:"TB500",   nome:"TB-500 10mg"},
  {code:"HGHFRAG", nome:"HGH Frag 176-191 10mg"},
  {code:"AOD",     nome:"AOD 9604 10mg"},
  {code:"SS31",    nome:"SS31 10mg"},
  {code:"MOTSC",   nome:"MOTS-C 10mg"},
  {code:"KPV",     nome:"KPV 10mg"},
  {code:"BPC157",  nome:"BPC 157 10mg"},
  {code:"BPC+TB",  nome:"BPC157 e TB500"},
];

// ══════════════════════════════════════════════════════
//  PRECIFICACAO
// ══════════════════════════════════════════════════════
const ESP = {
  TG:       {custo:537.50, venda:900},
  "GHK-CU": {custo:200, venda:600},
  TB500:    {custo:200, venda:400},
  HGHFRAG:  {custo:200, venda:400},
  AOD:      {custo:200, venda:400},
  SS31:     {custo:200, venda:400},
  MOTSC:    {custo:200, venda:400},
  KPV:      {custo:200, venda:500},
  BPC157:   {custo:200, venda:400},
  "BPC+TB": {custo:400, venda:450},
};
const C0 = 31.07;

function getCodes(s) {
  if (!s) return [];
  return s.split(" + ").map(p => p.trim().split(" - ")[0].trim().toUpperCase()).filter(Boolean);
}
const isEsp   = s => { const c=getCodes(s); return c.length>0&&c.every(x=>ESP[x]); };
const espKey  = s => getCodes(s)[0]||"";
const getP    = (q,s) => isEsp(s)?ESP[espKey(s)].venda:q>=1500?60:q>=1000?65:q>=500?70:110;
const getC    = s => isEsp(s)?ESP[espKey(s)].custo:C0;
const getFx   = (q,s) => isEsp(s)?{l:"ESPECIAL",c:"#C084FC"}:q>=1500?{l:"PREMIUM",c:"#D4AF37"}:q>=1000?{l:"PADRAO",c:"#34D399"}:q>=500?{l:"ENTRADA",c:"#60A5FA"}:{l:"VAREJO",c:"#F97316"};
const cv      = (q,s) => { const p=getP(q,s),c=getC(s),r=p*q,ct=c*q,l=r-ct,m=r>0?(l/r)*100:0; return {preco:p,custo:c,receita:r,custoTotal:ct,lucro:l,margem:m}; };
const cpM     = items => {
  let r=0,ct=0,l=0,q=0;
  items.forEach(({val,qtd})=>{ const c=cv(Number(qtd)||0,val); r+=c.receita;ct+=c.custoTotal;l+=c.lucro;q+=Number(qtd)||0; });
  return {receita:r,custoTotal:ct,lucro:l,qtdTotal:q,margem:r>0?(l/r)*100:0};
};

// ══════════════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════════════
const BRL = v => Number(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const PCT = v => Number(v).toFixed(1)+"%";
const toDay = () => { const d=new Date(); return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`; };
const nxtNum = list => { const ns=list.map(p=>parseInt(p.num)||0); return String((ns.length?Math.max(...ns):0)+1).padStart(3,"0"); };
const parseDate = s => { if(!s)return null; const [d,m,y]=s.split("/"); return new Date(y,m-1,d); };
const daysDiff = s => { const d=parseDate(s); if(!d)return 999; return Math.floor((new Date()-d)/86400000); };

// Status colors
const STATUS_COLOR = {Pago:"#4ade80", Pendente:"#FDE047", Entregue:"#60A5FA"};

// ══════════════════════════════════════════════════════
//  LOGO SVG
// ══════════════════════════════════════════════════════
function Logo({size=48}) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{flexShrink:0}}>
      <defs>
        <linearGradient id="gld" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F5E070"/><stop offset="55%" stopColor="#D4AF37"/><stop offset="100%" stopColor="#8B6410"/>
        </linearGradient>
        <linearGradient id="gdk" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E8C840"/><stop offset="100%" stopColor="#7A5808"/>
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="94" fill="#0A0A0F" stroke="url(#gld)" strokeWidth="4"/>
      <circle cx="100" cy="100" r="86" fill="none" stroke="url(#gld)" strokeWidth="0.8" opacity="0.3"/>
      {[[32,152,-55],[24,132,-38],[20,110,-22],[23,89,-8],[31,70,5],[43,54,18],[58,42,30]].map(([x,y,r],i)=>
        <ellipse key={"a"+i} cx={x} cy={y} rx="7" ry="12" fill="url(#gdk)" opacity="0.9" transform={`rotate(${r},${x},${y})`}/>)}
      {[[168,152,55],[176,132,38],[180,110,22],[177,89,8],[169,70,-5],[157,54,-18],[142,42,-30]].map(([x,y,r],i)=>
        <ellipse key={"b"+i} cx={x} cy={y} rx="7" ry="12" fill="url(#gdk)" opacity="0.9" transform={`rotate(${r},${x},${y})`}/>)}
      <path d="M44,156 Q36,112 62,44" fill="none" stroke="url(#gld)" strokeWidth="2" opacity="0.5"/>
      <path d="M156,156 Q164,112 138,44" fill="none" stroke="url(#gld)" strokeWidth="2" opacity="0.5"/>
      <ellipse cx="100" cy="164" rx="12" ry="7" fill="url(#gld)" opacity="0.8"/>
      <path d="M88,22 C124,14 162,20 168,30 C152,33 134,38 116,44 C106,36 96,28 88,22Z" fill="url(#gld)"/>
      <path d="M88,22 C82,28 80,38 83,48 L116,44 C106,36 96,28 88,22Z" fill="#6A4A08" opacity="0.5"/>
      <path d="M84,48 C70,50 58,60 52,74 C46,86 47,102 52,114 C57,126 66,133 76,136 L76,152 L122,152 L122,132 C132,126 140,114 142,100 C145,82 137,62 124,52 C114,46 98,44 84,48Z" fill="url(#gld)"/>
      <path d="M84,48 C72,52 62,64 56,78 C50,92 51,108 57,120 L76,136 L76,152 L100,152 L100,48Z" fill="#5A3A06" opacity="0.4"/>
      <path d="M76,76 C86,70 100,68 110,72 L118,82 L118,108 C113,116 104,120 94,120 C84,120 76,114 72,106 C68,96 70,84 76,76Z" fill="#0A0A0F" opacity="0.92"/>
      <rect x="89" y="68" width="10" height="48" rx="5" fill="url(#gld)" opacity="0.9"/>
      <rect x="76" y="82" width="32" height="7" rx="3.5" fill="#0A0A0F" opacity="0.95"/>
      <path d="M118,106 C126,112 130,124 128,140 L122,152 L88,152 L88,128 C98,124 110,118 118,106Z" fill="url(#gld)"/>
      <rect x="70" y="148" width="58" height="10" rx="4" fill="url(#gld)"/>
    </svg>
  );
}

// ══════════════════════════════════════════════════════
//  SCANNER
// ══════════════════════════════════════════════════════
function Scanner({onDone}) {
  const ref=useRef(); const [img,setImg]=useState(null); const [st,setSt]=useState("idle"); const [msg,setMsg]=useState("");
  const process=async f=>{
    if(!f)return; setSt("scan"); setMsg(""); setPrev(null);
    const readF=file=>new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=()=>rej();r.readAsDataURL(file);});
    try {
      const url=await readF(f); setImg(url); setMsg("IA lendo...");
      const [h,b64]=url.split(","); const m=(h.match(/:(.*?);/)||[,"image/jpeg"])[1];
      const mt=["image/jpeg","image/png","image/gif","image/webp"].includes(m)?m:"image/jpeg";
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:[
          {type:"image",source:{type:"base64",media_type:mt,data:b64}},
          {type:"text",text:'Leia etiqueta Iron Labs. JSON puro: {"pedido":"","cliente":"","produto":"","qtd":"","data":""}'}
        ]}]})});
      const d=await res.json(); const t=d.content?.map(c=>c.text||"").join("").trim()||"";
      const j=t.startsWith("{")?t:(t.match(/\{[\s\S]*\}/)||["{}"])[0];
      const r=JSON.parse(j);
      if(r&&(r.cliente||r.produto||r.qtd)){setSt("ok");setMsg("Lida!");onDone(r);} else {setSt("err");setMsg("Nao reconheceu - preencha manual");}
    } catch {setSt("err");setMsg("Erro ao processar foto");}
  };
  const setPrev=v=>setImg(v);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      <div onClick={()=>st!=="scan"&&ref.current?.click()} style={{border:`2px dashed ${st==="ok"?"#4ade80":st==="err"?"#ef4444":"#D4AF3730"}`,borderRadius:12,cursor:"pointer",background:"#0d0b14",minHeight:img?undefined:80,position:"relative",overflow:"hidden"}}>
        <input ref={ref} type="file" accept="image/*,image/heic" style={{display:"none"}} onChange={e=>process(e.target.files?.[0])}/>
        {img?(<>
          <img src={img} alt="" style={{width:"100%",maxHeight:130,objectFit:"contain",padding:6,display:"block"}}/>
          {st==="scan"&&<div style={{position:"absolute",inset:0,background:"rgba(10,10,15,0.85)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{position:"absolute",width:"100%",height:2,background:"linear-gradient(90deg,transparent,#D4AF37,transparent)",animation:"scn 1.4s ease-in-out infinite"}}/>
            <span style={{fontSize:10,color:"#D4AF37",fontFamily:"monospace",letterSpacing:3,zIndex:1}}>ESCANEANDO...</span>
          </div>}
        </>):(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"18px 16px",gap:6}}>
            <div style={{fontSize:26}}>📷</div>
            <div style={{fontSize:10,fontWeight:800,color:"#D4AF37",letterSpacing:2,fontFamily:"monospace"}}>ESCANEAR ETIQUETA</div>
            <div style={{fontSize:9,color:"#ffffff40",fontFamily:"monospace"}}>CAMERA · GALERIA</div>
          </div>
        )}
      </div>
      {msg&&<div style={{fontSize:10,fontFamily:"monospace",padding:"6px 10px",borderRadius:7,background:st==="ok"?"#4ade8015":"#ef444415",color:st==="ok"?"#4ade80":"#ef4444"}}>{msg}</div>}
      {img&&st!=="scan"&&<button onClick={()=>{setImg(null);setSt("idle");setMsg("");}} style={{background:"none",border:"1px solid #ffffff10",borderRadius:7,padding:6,color:"#ffffff40",fontSize:9,cursor:"pointer",fontFamily:"monospace"}}>📷 NOVA FOTO</button>}
      <style>{`@keyframes scn{0%{top:5%}50%{top:90%}100%{top:5%}}`}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════
//  COMPONENTES UI
// ══════════════════════════════════════════════════════
const CT = ({active,payload,label})=>active&&payload?.length?(<div style={{background:"#1a1628",border:"1px solid #D4AF3330",borderRadius:8,padding:"8px 12px"}}><div style={{fontSize:8,color:"#D4AF3788",fontFamily:"monospace",marginBottom:3}}>{label}</div>{payload.map(p=><div key={p.name} style={{fontSize:11,color:p.color||"#D4AF37",fontFamily:"monospace",fontWeight:700}}>{BRL(p.value)}</div>)}</div>):null;

function KPI({label,value,sub,color="#D4AF37",small}) {
  return (
    <div style={{background:"linear-gradient(145deg,#141220,#0e0c1a)",border:`1px solid ${color}22`,borderRadius:14,padding:"12px 14px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-10,right:-10,width:50,height:50,background:`radial-gradient(circle,${color}14,transparent)`,borderRadius:"50%"}}/>
      <div style={{fontSize:8,letterSpacing:3,color:color+"88",fontFamily:"monospace",marginBottom:4}}>{label}</div>
      <div style={{fontSize:small?18:20,fontWeight:900,color,fontFamily:"monospace",lineHeight:1}}>{value}</div>
      {sub&&<div style={{fontSize:9,color:"#ffffff40",fontFamily:"monospace",marginTop:3}}>{sub}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════
//  APP PRINCIPAL
// ══════════════════════════════════════════════════════
export default function IronLabs() {
  const [vendas,   setVendas]   = useState([]);
  const [meta,     setMeta]     = useState({mensal:0,periodo:"mensal"});
  const [estoque,  setEstoque]  = useState({}); // {code: qtdMinima}
  const [followups,setFollowups]= useState([]); // [{cliente, data, obs}]
  const [tab,      setTab]      = useState("central");
  const [subTab,   setSubTab]   = useState(""); // for nested views
  const [form,     setForm]     = useState({cliente:"",telefone:"",data:toDay(),obs:"",pagamento:"PIX"});
  const [prods,    setProds]    = useState([]);
  const [autoNum,  setAutoNum]  = useState("001");
  const [fMsg,     setFMsg]     = useState({t:"",ok:true});
  const [saved,    setSaved]    = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [filtroPeriodo,  setFiltroPeriodo]  = useState("tudo"); // semana|mes|tudo
  const [showEstoque,    setShowEstoque]    = useState(false);
  const [editMetaVal,    setEditMetaVal]    = useState("");
  const [showMeta,       setShowMeta]       = useState(false);
  const [newFollowup,    setNewFollowup]    = useState({cliente:"",data:toDay(),obs:""});
  const [showBackup,     setShowBackup]     = useState(false);
  const [backupMsg,      setBackupMsg]      = useState("");
  const importRef = useRef();

  // ── LOAD ────────────────────────────────────────────
  useEffect(()=>{
    const v=loadVendas(); setVendas(v); setAutoNum(nxtNum(v));
    setMeta(load(KEYS.meta,{mensal:0,periodo:"mensal"}));
    setEstoque(load(KEYS.estoque,{}));
    setFollowups(load(KEYS.followups,[]));
  },[]);

  useEffect(()=>{ if(vendas.length){save(KEYS.vendas,vendas);setSaved(true);setTimeout(()=>setSaved(false),2000);} },[vendas]);

  // ── FILTRO PERIODO ──────────────────────────────────
  const vendasFiltradas = vendas.filter(v=>{
    if(filtroPeriodo==="tudo") return true;
    const dias = daysDiff(v.data);
    if(filtroPeriodo==="semana") return dias<=7;
    if(filtroPeriodo==="mes")    return dias<=30;
    return true;
  });

  // ── METRICAS ────────────────────────────────────────
  const calcVendaTotals = v => {
    if(v.itens?.length>0) return cpM(v.itens);
    return cv(Number(v.qtd),v.produto||"");
  };

  const totais = vendasFiltradas.reduce((a,v)=>{
    const c=calcVendaTotals(v); return {r:a.r+c.receita,c:a.c+c.custoTotal,l:a.l+c.lucro,q:a.q+(c.qtdTotal||Number(v.qtd))};
  },{r:0,c:0,l:0,q:0});
  const margem = totais.r>0?(totais.l/totais.r)*100:0;

  // Fluxo de caixa: separar pago vs pendente
  const totalPago = vendasFiltradas.reduce((a,v)=>{
    if((v.status||"Pago")==="Pendente") return a;
    return a + calcVendaTotals(v).receita;
  },0);
  const totalPendente = vendasFiltradas.reduce((a,v)=>{
    if((v.status||"Pago")!=="Pendente") return a;
    return a + calcVendaTotals(v).receita;
  },0);

  // Pagamentos breakdown
  const pgMap = vendas.reduce((a,v)=>{ const pg=v.pagamento||"PIX"; a[pg]=(a[pg]||0)+calcVendaTotals(v).receita; return a; },{});

  // Meta progress
  const metaPct = meta.mensal>0 ? Math.min(100,(totais.r/meta.mensal)*100) : 0;

  // Clientes
  const cliMap = vendas.reduce((a,v)=>{
    const c=calcVendaTotals(v); if(!a[v.cliente])a[v.cliente]={lucro:0,receita:0,qtd:0,pedidos:0,datas:[],status:[],telefone:""};
    a[v.cliente].lucro+=c.lucro; a[v.cliente].receita+=c.receita;
    a[v.cliente].qtd+=(c.qtdTotal||Number(v.qtd)); a[v.cliente].pedidos+=1;
    a[v.cliente].datas.push(v.data); a[v.cliente].status.push(v.status||"Pago");
    if(v.telefone) a[v.cliente].telefone=v.telefone;
    return a;
  },{});
  const rankCli = Object.entries(cliMap).sort((a,b)=>b[1].lucro-a[1].lucro);

  // Clientes inativos (sem compra > 30 dias)
  const inativos = rankCli.filter(([,d])=>{
    const ultData = d.datas.sort().reverse()[0]; return daysDiff(ultData)>30;
  });

  // Estoque — calcula saidas por produto
  const saidaMap = vendas.reduce((a,v)=>{
    const itens = v.itens?.length>0 ? v.itens : [{val:v.produto||"",qtd:Number(v.qtd)}];
    itens.forEach(({val,qtd})=>{ const code=getCodes(val)[0]||""; if(code){a[code]=(a[code]||0)+Number(qtd);} });
    return a;
  },{});

  // Alertas de estoque
  const alertasEstoque = Object.entries(estoque).filter(([code,min])=>(saidaMap[code]||0)>=min*0.8);

  // Timeline mensal
  const monthMap = vendas.reduce((a,v)=>{
    const c=calcVendaTotals(v); const [,m,y]=(v.data||"01/01/2025").split("/");
    const key=`${m}/${y}`; if(!a[key])a[key]={r:0,l:0}; a[key].r+=c.receita; a[key].l+=c.lucro; return a;
  },{});
  const timeline = Object.entries(monthMap).sort((a,b)=>{ const [ma,ya]=a[0].split("/"), [mb,yb]=b[0].split("/"); return new Date(ya,ma-1)-new Date(yb,mb-1); }).map(([d,v])=>({d,r:v.r,l:v.l}));

  // Prods ranking
  const prodMap = vendas.reduce((a,v)=>{
    const itens=v.itens?.length>0?v.itens:[{val:v.produto||"",qtd:Number(v.qtd)}];
    itens.forEach(({val,qtd})=>{ const code=getCodes(val)[0]||"val"; if(!a[code])a[code]={qtd:0,lucro:0}; const c=cv(Number(qtd),val); a[code].qtd+=Number(qtd);a[code].lucro+=c.lucro; });
    return a;
  },{});
  const rankProds = Object.entries(prodMap).sort((a,b)=>b[1].lucro-a[1].lucro).slice(0,8);

  const pieData = rankCli.slice(0,5).map(([n,d],i)=>({name:n.split(" ")[0],value:Math.round(d.lucro),color:["#D4AF37","#60A5FA","#4ade80","#C084FC","#F97316"][i]}));

  // ── FORM ────────────────────────────────────────────
  const setF=(k,v)=>{setForm(p=>({...p,[k]:v}));setFMsg({t:"",ok:true});};
  const toggleProd=val=>{setProds(p=>{const e=p.find(x=>x.val===val);return e?p.filter(x=>x.val!==val):[...p,{val,qtd:1}];});};
  const updQtd=(val,q)=>setProds(p=>p.map(x=>x.val===val?{...x,qtd:Math.max(1,Number(q)||1)}:x));

  const handleScan=data=>{
    setForm(p=>({...p,cliente:data.cliente||p.cliente,data:data.data||p.data}));
    if(data.produto){
      const codes=data.produto.split(/[+,\s]+/).map(s=>s.trim()).filter(Boolean);
      const m=codes.map(c=>{const f=CAT.find(p=>p.code.toUpperCase()===c.toUpperCase());return{val:f?`${f.code} - ${f.nome}`:c,qtd:1};});
      if(m.length)setProds(m);
    }
    setFMsg({t:"Etiqueta importada!",ok:true});setTimeout(()=>setFMsg({t:"",ok:true}),3000);
  };

  const registrar=()=>{
    const miss=[]; if(!form.cliente.trim())miss.push("Cliente"); if(!form.data.trim())miss.push("Data"); if(!prods.length)miss.push("Produto");
    if(miss.length){setFMsg({t:"Faltando: "+miss.join(", "),ok:false});setTimeout(()=>setFMsg({t:"",ok:true}),5000);return;}
    const multi=cpM(prods);
    const nova={id:Date.now(),num:autoNum,cliente:form.cliente.trim(),telefone:form.telefone.trim(),qtd:multi.qtdTotal,data:form.data.trim(),produto:prods.map(p=>p.val).join(" + "),itens:prods.map(p=>({val:p.val,qtd:p.qtd})),status:"Pago",pagamento:form.pagamento,obs:form.obs,valorPago:multi.receita};
    const upd=[nova,...vendas]; setVendas(upd); save(KEYS.vendas,upd);
    setAutoNum(nxtNum(upd)); setForm({cliente:"",telefone:"",data:toDay(),obs:"",pagamento:"PIX"}); setProds([]);
    setFMsg({t:`Venda #${nova.num} registrada! Lucro: ${BRL(multi.lucro)}`,ok:true}); setTimeout(()=>setFMsg({t:"",ok:true}),5000);
  };

  const excluir=id=>{const u=vendas.filter(v=>v.id!==id);setVendas(u);save(KEYS.vendas,u);};
  const updStatus=(id,status)=>{const u=vendas.map(v=>v.id===id?{...v,status}:v);setVendas(u);save(KEYS.vendas,u);};

  // Follow-ups
  const addFollowup=()=>{
    if(!newFollowup.cliente)return;
    const upd=[...followups,{...newFollowup,id:Date.now()}];setFollowups(upd);save(KEYS.followups,upd);
    setNewFollowup({cliente:"",data:toDay(),obs:""});
  };
  const delFollowup=id=>{const u=followups.filter(f=>f.id!==id);setFollowups(u);save(KEYS.followups,u);};

  // Estoque min
  const updEstoque=(code,val)=>{const upd={...estoque,[code]:Number(val)||0};setEstoque(upd);save(KEYS.estoque,upd);};

  // Live preview
  const lp = prods.length>0&&prods.some(p=>p.qtd>0)?cpM(prods):null;

  // ── ESTILOS ──────────────────────────────────────────
  const sf = {background:"linear-gradient(145deg,#141220,#0f0d1a)",border:"1px solid #ffffff0e",borderRadius:14,overflow:"hidden"};
  const sh = (c="#D4AF37")=>({padding:"10px 16px",borderBottom:"1px solid #ffffff07",background:`linear-gradient(90deg,${c}0e,transparent)`,display:"flex",alignItems:"center",gap:8});
  const dot= c=>({width:6,height:6,background:c,borderRadius:1,transform:"rotate(45deg)",flexShrink:0});
  const lbl= {fontSize:9,letterSpacing:3,fontFamily:"monospace",textTransform:"uppercase"};
  const inp= {width:"100%",background:"#0A0A0F",border:"1px solid #ffffff15",borderRadius:9,padding:"9px 12px",color:"#f0e8d0",fontSize:13,fontFamily:"Georgia,serif",outline:"none",boxSizing:"border-box"};
  const btnG={background:"linear-gradient(135deg,#B8840C,#D4AF37,#EDD050)",border:"none",borderRadius:10,padding:"12px",width:"100%",fontSize:11,fontWeight:900,letterSpacing:3,color:"#0A0A0F",cursor:"pointer",fontFamily:"monospace"};
  const tabB=id=>({flex:1,padding:"9px 4px",borderRadius:7,border:"none",cursor:"pointer",fontFamily:"monospace",fontSize:9,letterSpacing:2,fontWeight:800,background:tab===id?"linear-gradient(135deg,#B8840C,#D4AF37,#EDD050)":"rgba(212,175,55,0.04)",color:tab===id?"#0A0A0F":"#D4AF3550",borderTop:tab!==id?"1px solid #D4AF3718":"none"});

  const TABS=[{id:"central",l:"CENTRAL"},{id:"vendas",l:"VENDAS"},{id:"gestao",l:"GESTAO"}];

  // Followups vencidos hoje ou passados
  const followupsAlerta = followups.filter(f=>daysDiff(f.data)>=0);

  return (
    <div style={{minHeight:"100vh",background:"#0A0A0F",color:"#f0e8d0",fontFamily:"Georgia,serif"}}>

      {/* HEADER */}
      <div style={{background:"linear-gradient(180deg,#111020,#0A0A0F)",borderBottom:"1px solid #D4AF3720",position:"sticky",top:0,zIndex:50}}>
        <div style={{padding:"10px 14px 0",display:"flex",alignItems:"center",gap:10}}>
          <Logo size={46}/>
          <div style={{flex:1}}>
            <div style={{display:"flex",gap:3,alignItems:"baseline"}}>
              <span style={{fontSize:20,fontWeight:900,letterSpacing:4,color:"#D4AF37",fontFamily:"Georgia,serif"}}>IRON</span>
              <span style={{fontSize:20,fontWeight:900,letterSpacing:4,color:"#CC1111",fontFamily:"Georgia,serif"}}>LABS</span>
            </div>
            <div style={{fontSize:7,letterSpacing:4,color:"#D4AF3758",fontFamily:"monospace",marginTop:1}}>PHARMACEUTICAL · COMMAND CENTER</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
            <div style={{background:"#D4AF3715",border:"1px solid #D4AF3730",borderRadius:10,padding:"4px 10px",textAlign:"center"}}>
              <div style={{fontSize:7,letterSpacing:2,color:"#D4AF3370",fontFamily:"monospace"}}>VENDAS</div>
              <div style={{fontSize:16,fontWeight:900,color:"#D4AF37",fontFamily:"monospace",lineHeight:1}}>{vendas.length}</div>
            </div>
            {/* Alertas badge */}
            {(alertasEstoque.length>0||followupsAlerta.length>0||inativos.length>0)&&(
              <div style={{background:"#ef444420",border:"1px solid #ef444440",borderRadius:20,padding:"2px 8px",fontSize:8,color:"#ef4444",fontFamily:"monospace",letterSpacing:1}}>
                {alertasEstoque.length+followupsAlerta.length+inativos.length} ALERTAS
              </div>
            )}
            <div style={{fontSize:8,fontFamily:"monospace",color:saved?"#4ade80":"#ffffff25"}}>{saved?"✓ SALVO":"● SYNC"}</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",padding:"5px 14px 0",gap:6}}>
          <div style={{flex:1,height:1,background:"linear-gradient(90deg,transparent,#D4AF3728)"}}/>
          <div style={{width:5,height:5,background:"#D4AF37",transform:"rotate(45deg)"}}/>
          <div style={{flex:1,height:1,background:"linear-gradient(90deg,#D4AF3728,transparent)"}}/>
        </div>
        <div style={{display:"flex",padding:"8px 10px 10px",gap:5}}>
          {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={tabB(t.id)}>{t.l}</button>)}
        </div>
      </div>

      <div style={{maxWidth:640,margin:"0 auto",padding:"14px 12px 60px"}}>

{/* ═══════════════════════════════════════════════════════
    CENTRAL
═══════════════════════════════════════════════════════ */}
{tab==="central"&&(
  <div style={{display:"flex",flexDirection:"column",gap:14}}>

    {/* Filtro período + Backup */}
    <div style={{display:"flex",gap:5}}>
      {[["tudo","TUDO"],["mes","MES"],["semana","SEMANA"]].map(([v,l])=>(
        <button key={v} onClick={()=>setFiltroPeriodo(v)} style={{flex:1,padding:"7px 4px",borderRadius:8,border:"none",cursor:"pointer",fontFamily:"monospace",fontSize:9,letterSpacing:2,fontWeight:800,background:filtroPeriodo===v?"#D4AF3725":"transparent",color:filtroPeriodo===v?"#D4AF37":"#ffffff30",borderBottom:`2px solid ${filtroPeriodo===v?"#D4AF37":"transparent"}`}}>{l}</button>
      ))}
      <button onClick={()=>setShowBackup(p=>!p)} style={{padding:"7px 10px",borderRadius:8,border:"1px solid #D4AF3740",cursor:"pointer",fontFamily:"monospace",fontSize:9,fontWeight:800,background:showBackup?"#D4AF3720":"transparent",color:"#D4AF37"}}>💾</button>
    </div>

    {/* PAINEL DE BACKUP */}
    {showBackup&&(
      <div style={{background:"linear-gradient(135deg,#1a1228,#0f0a1a)",border:"1px solid #D4AF3730",borderRadius:12,padding:14,display:"flex",flexDirection:"column",gap:10}}>
        <div style={{fontSize:9,letterSpacing:3,color:"#D4AF37",fontFamily:"monospace",fontWeight:800}}>💾 BACKUP DE DADOS</div>
        <div style={{fontSize:10,color:"#ffffff50",fontFamily:"monospace",lineHeight:1.6}}>
          Exporte seus dados para nunca perder. Importe quando precisar restaurar.
        </div>

        {/* Export */}
        <button onClick={()=>{ exportarBackup(vendas); setBackupMsg("✅ Backup exportado!"); setTimeout(()=>setBackupMsg(""),3000); }}
          style={{background:"linear-gradient(135deg,#B8840C,#D4AF37)",border:"none",borderRadius:9,padding:"11px",fontSize:11,fontWeight:900,letterSpacing:2,color:"#0A0A0F",cursor:"pointer",fontFamily:"monospace"}}>
          ⬇️ EXPORTAR BACKUP ({vendas.length} pedidos)
        </button>

        {/* Import */}
        <div>
          <input ref={importRef} type="file" accept=".json" style={{display:"none"}}
            onChange={e=>{
              const file=e.target.files?.[0]; if(!file)return;
              importarBackup(file,
                lista=>{
                  const merged=[...lista,...vendas.filter(v=>!lista.find(l=>l.id===v.id))].sort((a,b)=>(b.id||0)-(a.id||0));
                  setVendas(merged); save(KEYS.vendas,merged); setAutoNum(nxtNum(merged));
                  setBackupMsg("✅ "+lista.length+" pedidos importados!"); setTimeout(()=>setBackupMsg(""),4000);
                },
                err=>{ setBackupMsg("❌ Erro: "+err); setTimeout(()=>setBackupMsg(""),4000); }
              );
              e.target.value="";
            }}/>
          <button onClick={()=>importRef.current?.click()}
            style={{width:"100%",background:"transparent",border:"1px solid #D4AF3740",borderRadius:9,padding:"11px",fontSize:11,fontWeight:900,letterSpacing:2,color:"#D4AF37",cursor:"pointer",fontFamily:"monospace"}}>
            ⬆️ IMPORTAR BACKUP (.json)
          </button>
        </div>

        {backupMsg&&<div style={{fontSize:10,fontFamily:"monospace",padding:"7px 10px",borderRadius:7,background:backupMsg.startsWith("✅")?"#4ade8015":"#ef444415",color:backupMsg.startsWith("✅")?"#4ade80":"#ef4444"}}>{backupMsg}</div>}

        <div style={{fontSize:9,color:"#ffffff25",fontFamily:"monospace",lineHeight:1.7}}>
          Dica: exporte um backup depois de cada sessão de cadastro. Quando o sistema atualizar, importe o arquivo para restaurar todos os dados.
        </div>
      </div>
    )}

    {/* KPIs */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <KPI label="LUCRO" value={BRL(totais.l)} sub={PCT(margem)+" margem"} color="#4ade80"/>
      <KPI label="RECEITA" value={BRL(totais.r)} sub={totais.q+" unidades"} color="#D4AF37"/>
      <KPI label="NO CAIXA" value={BRL(totalPago)} sub="pedidos pagos/entregues" color="#34D399" small/>
      <KPI label="A RECEBER" value={BRL(totalPendente)} sub={vendasFiltradas.filter(v=>(v.status||"Pago")==="Pendente").length+" pendentes"} color={totalPendente>0?"#FDE047":"#ffffff30"} small/>
    </div>

    {/* Pagamentos breakdown */}
    {Object.keys(pgMap).length>0&&(
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {Object.entries(pgMap).map(([pg,val])=>(
          <div key={pg} style={{flex:1,minWidth:80,background:"#ffffff05",border:"1px solid #ffffff0a",borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
            <div style={{fontSize:14,marginBottom:2}}>{pg==="PIX"?"⚡":pg==="Dinheiro"?"💵":pg==="Transferencia"?"🏦":"💳"}</div>
            <div style={{fontSize:9,color:"#ffffff40",fontFamily:"monospace",marginBottom:2}}>{pg}</div>
            <div style={{fontSize:11,fontWeight:800,color:"#D4AF37",fontFamily:"monospace"}}>{BRL(val)}</div>
          </div>
        ))}
      </div>
    )}

    {/* META DE FATURAMENTO */}
    <div style={sf}>
      <div style={{...sh(),justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={dot("#D4AF37")}/>
          <span style={{...lbl,color:"#D4AF37"}}>META DE FATURAMENTO</span>
        </div>
        <button onClick={()=>setShowMeta(p=>!p)} style={{background:"none",border:"1px solid #D4AF3740",borderRadius:6,padding:"3px 8px",color:"#D4AF37",fontSize:9,cursor:"pointer",fontFamily:"monospace"}}>EDITAR</button>
      </div>
      <div style={{padding:"14px 16px"}}>
        {showMeta&&(
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <input type="number" value={editMetaVal} onChange={e=>setEditMetaVal(e.target.value)} placeholder="Meta mensal em R$" style={{...inp,flex:1,fontSize:12}}/>
            <button onClick={()=>{const m={...meta,mensal:Number(editMetaVal)||0};setMeta(m);save(KEYS.meta,m);setShowMeta(false);}} style={{...btnG,width:"auto",padding:"9px 14px",fontSize:10}}>OK</button>
          </div>
        )}
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,alignItems:"baseline"}}>
          <span style={{fontSize:11,color:"#ffffff60",fontFamily:"monospace"}}>
            {meta.mensal>0?BRL(meta.mensal):"Sem meta definida"}
          </span>
          <span style={{fontSize:18,fontWeight:900,color:metaPct>=100?"#4ade80":metaPct>=70?"#D4AF37":"#f87171",fontFamily:"monospace"}}>
            {meta.mensal>0?PCT(metaPct):"—"}
          </span>
        </div>
        {meta.mensal>0&&(
          <>
            <div style={{height:8,borderRadius:4,background:"#ffffff0a",overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:4,width:`${metaPct}%`,transition:"width 0.6s",background:metaPct>=100?"linear-gradient(90deg,#34D399,#4ade80)":metaPct>=70?"linear-gradient(90deg,#C8960C,#D4AF37)":"linear-gradient(90deg,#991b1b,#f87171)"}}/>
            </div>
            <div style={{fontSize:9,color:"#ffffff35",fontFamily:"monospace",marginTop:6}}>
              Faltam {BRL(Math.max(0,meta.mensal-totais.r))} para a meta
            </div>
          </>
        )}
      </div>
    </div>

    {/* ALERTAS */}
    {(alertasEstoque.length>0||followupsAlerta.length>0||inativos.length>0)&&(
      <div style={{...sf,border:"1px solid #ef444430"}}>
        <div style={sh("#ef4444")}>
          <div style={dot("#ef4444")}/>
          <span style={{...lbl,color:"#ef4444"}}>ALERTAS ATIVOS</span>
          <span style={{marginLeft:"auto",fontSize:12,color:"#ef4444",fontWeight:800}}>{alertasEstoque.length+followupsAlerta.length+inativos.length}</span>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:0}}>
          {alertasEstoque.map(([code,min])=>(
            <div key={code} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 16px",borderBottom:"1px solid #ffffff06"}}>
              <span style={{fontSize:16}}>⚠️</span>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:"#f0e8d0",fontWeight:700}}>Estoque baixo: {code}</div>
                <div style={{fontSize:9,color:"#ffffff40",fontFamily:"monospace"}}>{saidaMap[code]||0} saidas · minimo definido: {min}</div>
              </div>
              <span style={{fontSize:9,color:"#FDE047",fontFamily:"monospace",background:"#FDE04720",padding:"2px 8px",borderRadius:10}}>REPOR</span>
            </div>
          ))}
          {followupsAlerta.map(f=>(
            <div key={f.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 16px",borderBottom:"1px solid #ffffff06"}}>
              <span style={{fontSize:16}}>📞</span>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:"#f0e8d0",fontWeight:700}}>Follow-up: {f.cliente}</div>
                <div style={{fontSize:9,color:"#ffffff40",fontFamily:"monospace"}}>{f.obs||"Sem observacao"} · {f.data}</div>
              </div>
              <button onClick={()=>delFollowup(f.id)} style={{background:"none",border:"1px solid #4ade8030",borderRadius:6,padding:"2px 8px",color:"#4ade80",fontSize:9,cursor:"pointer",fontFamily:"monospace"}}>FEITO</button>
            </div>
          ))}
          {inativos.map(([nome,d])=>(
            <div key={nome} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 16px",borderBottom:"1px solid #ffffff06"}}>
              <span style={{fontSize:16}}>🔴</span>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:"#f0e8d0",fontWeight:700}}>Cliente inativo: {nome}</div>
                <div style={{fontSize:9,color:"#ffffff40",fontFamily:"monospace"}}>
                  Ultima compra ha {daysDiff(d.datas.sort().reverse()[0])} dias · {d.pedidos} pedidos historico
                </div>
              </div>
              <span style={{fontSize:9,color:"#f87171",fontFamily:"monospace",background:"#f8717120",padding:"2px 8px",borderRadius:10}}>+30d</span>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* CRESCIMENTO MENSAL */}
    {timeline.length>=2&&(
      <div style={sf}>
        <div style={sh()}>
          <div style={dot("#D4AF37")}/>
          <span style={{...lbl,color:"#D4AF37"}}>CRESCIMENTO MENSAL</span>
        </div>
        <div style={{padding:"12px 6px 6px"}}>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={timeline} margin={{top:0,bottom:0,left:0,right:0}}>
              <XAxis dataKey="d" tick={{fontSize:8,fill:"#ffffff30",fontFamily:"monospace"}} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip content={<CT/>}/>
              <Line type="monotone" dataKey="r" name="Receita" stroke="#D4AF37" strokeWidth={2} dot={{r:3,fill:"#D4AF37"}}/>
              <Line type="monotone" dataKey="l" name="Lucro" stroke="#4ade80" strokeWidth={2} dot={{r:3,fill:"#4ade80"}}/>
            </LineChart>
          </ResponsiveContainer>
          <div style={{display:"flex",gap:14,justifyContent:"center",marginTop:4}}>
            {[{c:"#D4AF37",l:"Receita"},{c:"#4ade80",l:"Lucro"}].map(x=>(
              <div key={x.l} style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:12,height:2,background:x.c,borderRadius:1}}/>
                <span style={{fontSize:8,color:"#ffffff40",fontFamily:"monospace"}}>{x.l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}

    {/* RANKING CLIENTES CLICAVEL */}
    {rankCli.length>0&&(
      <div style={sf}>
        <div style={{...sh("#4ade80"),justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={dot("#4ade80")}/>
            <span style={{...lbl,color:"#4ade80"}}>CLIENTES · LUCRO</span>
          </div>
          <span style={{fontSize:8,color:"#ffffff25",fontFamily:"monospace"}}>TOQUE PARA DETALHES</span>
        </div>
        <div style={{display:"flex",gap:0,padding:"12px 14px"}}>
          {pieData.length>=2&&(
            <div style={{width:80,flexShrink:0}}>
              <ResponsiveContainer width={80} height={80}>
                <PieChart>
                  <Pie data={pieData} cx={38} cy={38} innerRadius={20} outerRadius={36} dataKey="value" strokeWidth={0}>
                    {pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={{flex:1,display:"flex",flexDirection:"column",gap:5,paddingLeft:8}}>
            {rankCli.slice(0,6).map(([nome,d],i)=>(
              <div key={nome} onClick={()=>setSelectedClient(selectedClient===nome?null:nome)}
                style={{cursor:"pointer",borderRadius:8,padding:"5px 7px",transition:"background 0.2s",
                  background:selectedClient===nome?"#4ade8012":"transparent",
                  border:selectedClient===nome?"1px solid #4ade8030":"1px solid transparent"}}>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <div style={{width:3,height:22,borderRadius:2,background:pieData[i]?.color||"#D4AF37",flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:11,fontWeight:700,color:selectedClient===nome?"#4ade80":"#f0e8d0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"60%"}}>{nome}</span>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        <span style={{fontSize:11,fontWeight:800,color:"#4ade80",fontFamily:"monospace"}}>{BRL(d.lucro)}</span>
                        <span style={{fontSize:9,color:"#ffffff30",transform:selectedClient===nome?"rotate(180deg)":"none",transition:"transform 0.2s"}}>▾</span>
                      </div>
                    </div>
                    <div style={{fontSize:8,color:"#ffffff30",fontFamily:"monospace"}}>
                      {d.pedidos} pedido{d.pedidos>1?"s":""} · {daysDiff(d.datas.sort().reverse()[0])}d atras
                    </div>
                  </div>
                </div>
                {/* DETALHE EXPANDIDO */}
                {selectedClient===nome&&(()=>{
                  const cv2=vendas.filter(v=>v.cliente===nome);
                  return (
                    <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #4ade8018"}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>
                        {[{l:"RECEITA",v:BRL(d.receita),c:"#D4AF37"},{l:"CUSTO",v:BRL(d.receita-d.lucro),c:"#f87171"},{l:"LUCRO",v:BRL(d.lucro),c:"#4ade80"}].map(x=>(
                          <div key={x.l} style={{textAlign:"center",background:"#ffffff05",borderRadius:8,padding:"6px 4px"}}>
                            <div style={{fontSize:7,letterSpacing:2,color:"#ffffff30",fontFamily:"monospace"}}>{x.l}</div>
                            <div style={{fontSize:10,fontWeight:800,color:x.c,fontFamily:"monospace"}}>{x.v}</div>
                          </div>
                        ))}
                      </div>
                      {d.telefone&&(
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,padding:"6px 10px",background:"#25D36615",border:"1px solid #25D36630",borderRadius:8}}>
                          <span style={{fontSize:11}}>📱</span>
                          <span style={{fontSize:11,color:"#25D366",fontFamily:"monospace"}}>{d.telefone}</span>
                          <a href={"https://wa.me/55"+d.telefone.replace(/\D/g,"")} target="_blank" rel="noreferrer"
                            style={{marginLeft:"auto",background:"#25D36625",border:"1px solid #25D36640",borderRadius:6,padding:"3px 10px",color:"#25D366",fontSize:9,fontFamily:"monospace",textDecoration:"none",fontWeight:800}}>
                            WHATSAPP
                          </a>
                        </div>
                      )}
                      {cv2.map(v=>{
                        const tc=calcVendaTotals(v);
                        const itens=v.itens?.length>0?v.itens:[{val:v.produto||"",qtd:Number(v.qtd)}];
                        return (
                          <div key={v.id} style={{background:"rgba(255,255,255,0.03)",border:"1px solid #ffffff08",borderRadius:8,padding:"8px 10px",marginBottom:6}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                              <span style={{fontSize:10,fontWeight:700,color:"#D4AF37",fontFamily:"monospace"}}>#{v.num}</span>
                              <span style={{fontSize:9,color:"#ffffff40",fontFamily:"monospace"}}>{v.data}</span>
                              {v.pagamento&&<span style={{fontSize:8,fontFamily:"monospace",background:"#D4AF3715",color:"#D4AF3788",padding:"1px 5px",borderRadius:4}}>{v.pagamento}</span>}
                              <span style={{fontSize:9,padding:"2px 7px",borderRadius:10,fontFamily:"monospace",fontWeight:700,background:(STATUS_COLOR[v.status||"Pago"]||"#4ade80")+"20",color:STATUS_COLOR[v.status||"Pago"]||"#4ade80"}}>{v.status||"Pago"}</span>
                              <span style={{fontSize:10,fontWeight:800,color:"#4ade80",fontFamily:"monospace"}}>{BRL(tc.lucro)}</span>
                            </div>
                            {itens.map((item,ii)=>{
                              const code=item.val.split(" - ")[0];
                              const ic=cv(Number(item.qtd),item.val);
                              return (
                                <div key={ii} style={{display:"flex",alignItems:"center",gap:6,padding:"2px 0",borderBottom:ii<itens.length-1?"1px solid #ffffff05":"none"}}>
                                  <span style={{fontSize:9,fontWeight:800,color:getFx(Number(item.qtd),item.val).c,fontFamily:"monospace",minWidth:46}}>{code}</span>
                                  <span style={{fontSize:9,color:"#ffffff35",flex:1}}>{item.qtd}un × {BRL(ic.preco)}</span>
                                  <span style={{fontSize:9,fontWeight:700,color:"#4ade80",fontFamily:"monospace"}}>{BRL(ic.lucro)}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      </div>
    )}

    {/* PRODUTOS */}
    {rankProds.length>0&&(
      <div style={sf}>
        <div style={sh("#C084FC")}>
          <div style={dot("#C084FC")}/>
          <span style={{...lbl,color:"#C084FC"}}>PRODUTOS MAIS LUCRATIVOS</span>
        </div>
        <div style={{padding:"8px 14px 14px"}}>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={rankProds.map(([c,d])=>({code:c,lucro:Math.round(d.lucro)}))} layout="vertical" margin={{top:0,bottom:0,left:0,right:8}}>
              <XAxis type="number" hide/>
              <YAxis type="category" dataKey="code" tick={{fontSize:9,fill:"#C084FC88",fontFamily:"monospace"}} axisLine={false} tickLine={false} width={38}/>
              <Tooltip content={<CT/>}/>
              <Bar dataKey="lucro" name="Lucro" fill="#C084FC" radius={[0,4,4,0]} opacity={0.75}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    )}

  </div>
)}

{/* ═══════════════════════════════════════════════════════
    VENDAS
═══════════════════════════════════════════════════════ */}
{tab==="vendas"&&(
  <div style={{display:"flex",flexDirection:"column",gap:14}}>

    {/* Scanner */}
    <div style={sf}>
      <div style={sh()}><div style={dot("#D4AF37")}/><span style={{...lbl,color:"#D4AF37"}}>ESCANEAR ETIQUETA</span></div>
      <div style={{padding:14}}><Scanner onDone={handleScan}/></div>
    </div>

    {/* Form */}
    <div style={sf}>
      <div style={{...sh("#ffffff40"),justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><div style={dot("#ffffff28")}/><span style={{...lbl,color:"#ffffff40"}}>REGISTRAR VENDA</span></div>
        {fMsg.t&&<span style={{fontSize:10,fontFamily:"monospace",color:fMsg.ok?"#4ade80":"#FDE047"}}>{fMsg.t}</span>}
      </div>
      <div style={{padding:14,display:"flex",flexDirection:"column",gap:12}}>

        {/* Pedido + Data */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div>
            <div style={{...lbl,color:"#D4AF3366",marginBottom:5}}>PEDIDO No</div>
            <div style={{background:"#D4AF3710",border:"1px solid #D4AF3730",borderRadius:9,padding:"10px 12px",display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:14,fontWeight:900,color:"#D4AF37",fontFamily:"monospace"}}>#{autoNum}</span>
              <span style={{fontSize:8,color:"#D4AF3760",fontFamily:"monospace",letterSpacing:2}}>AUTO</span>
            </div>
          </div>
          <div>
            <div style={{...lbl,color:"#ffffff35",marginBottom:5}}>DATA</div>
            <div style={{position:"relative"}}>
              <input value={form.data} onChange={e=>setF("data",e.target.value)} style={inp} placeholder="DD/MM/AAAA"/>
              {form.data===toDay()&&<span style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",fontSize:7,color:"#4ade80",fontFamily:"monospace",background:"#4ade8015",padding:"2px 6px",borderRadius:4}}>HOJE</span>}
            </div>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div>
            <div style={{...lbl,color:"#ffffff35",marginBottom:5}}>CLIENTE</div>
            <input value={form.cliente} onChange={e=>setF("cliente",e.target.value)} style={inp} placeholder="Nome do cliente"/>
          </div>
          <div>
            <div style={{...lbl,color:"#60A5FA88",marginBottom:5}}>TELEFONE / WHATSAPP</div>
            <div style={{position:"relative"}}>
              <input value={form.telefone} onChange={e=>setF("telefone",e.target.value)} style={{...inp,paddingLeft:28}} placeholder="(11) 99999-9999"/>
              <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",fontSize:13}}>📱</span>
            </div>
          </div>
        </div>

        {/* Pagamento + Obs */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div>
            <div style={{...lbl,color:"#ffffff35",marginBottom:5}}>FORMA DE PAGAMENTO</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {["PIX","Dinheiro","Transferencia","Cartao"].map(pg=>(
                <button key={pg} onClick={()=>setF("pagamento",pg)}
                  style={{flex:1,minWidth:0,padding:"7px 4px",borderRadius:8,border:"none",cursor:"pointer",
                    fontFamily:"monospace",fontSize:8,letterSpacing:1,fontWeight:800,transition:"all 0.15s",
                    background:form.pagamento===pg?"linear-gradient(135deg,#B8840C,#D4AF37)":"rgba(255,255,255,0.04)",
                    color:form.pagamento===pg?"#0A0A0F":"#ffffff40"}}>
                  {pg==="PIX"?"⚡":pg==="Dinheiro"?"💵":pg==="Transferencia"?"🏦":"💳"} {pg}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{...lbl,color:"#ffffff35",marginBottom:5}}>OBSERVACAO</div>
            <input value={form.obs} onChange={e=>setF("obs",e.target.value)} style={inp} placeholder="Obs do pedido..."/>
          </div>
        </div>

        {/* Produtos */}
        <div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <div style={{...lbl,color:"#ffffff35"}}>PRODUTO(S)</div>
            {prods.length>0&&<span style={{fontSize:9,color:"#D4AF37",fontFamily:"monospace"}}>{prods.length} selecionado{prods.length>1?"s":""}</span>}
          </div>
          {prods.length>0&&(
            <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:10}}>
              {prods.map(p=>{
                const code=p.val.split(" - ")[0]; const pc=cv(Number(p.qtd)||1,p.val); const pf=getFx(Number(p.qtd)||1,p.val);
                return (
                  <div key={p.val} style={{display:"flex",alignItems:"center",gap:8,background:"#D4AF3710",border:"1px solid #D4AF3730",borderRadius:10,padding:"7px 10px"}}>
                    <span style={{fontSize:10,fontWeight:800,color:"#D4AF37",fontFamily:"monospace",minWidth:48}}>{code}</span>
                    <div style={{display:"flex",alignItems:"center",gap:4}}>
                      <button onClick={()=>updQtd(p.val,(Number(p.qtd)||1)-1)} style={{width:22,height:22,borderRadius:5,border:"1px solid #D4AF3440",background:"#D4AF3415",color:"#D4AF37",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                      <input type="number" value={p.qtd} min="1" onChange={e=>updQtd(p.val,e.target.value)} style={{width:36,textAlign:"center",background:"#0A0A0F",border:"1px solid #D4AF3440",borderRadius:5,color:"#f0e8d0",fontSize:12,fontFamily:"monospace",fontWeight:700,padding:"2px 4px"}}/>
                      <button onClick={()=>updQtd(p.val,(Number(p.qtd)||1)+1)} style={{width:22,height:22,borderRadius:5,border:"1px solid #D4AF3440",background:"#D4AF3415",color:"#D4AF37",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                    </div>
                    <div style={{flex:1,textAlign:"right"}}>
                      <span style={{fontSize:10,fontWeight:800,color:"#4ade80",fontFamily:"monospace"}}>{BRL(pc.lucro)}</span>
                      <span style={{fontSize:8,color:pf.c,fontFamily:"monospace",marginLeft:4}}>{pf.l}</span>
                    </div>
                    <button onClick={()=>toggleProd(p.val)} style={{background:"none",border:"none",color:"#ffffff30",cursor:"pointer",fontSize:14,padding:"0 2px"}}>×</button>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,maxHeight:190,overflowY:"auto"}}>
            {CAT.map(pr=>{
              const val=`${pr.code} - ${pr.nome}`, on=prods.some(x=>x.val===val);
              return (
                <button key={pr.code} onClick={()=>toggleProd(val)} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 10px",borderRadius:7,cursor:"pointer",textAlign:"left",background:on?"linear-gradient(90deg,#D4AF3718,#D4AF3708)":"rgba(255,255,255,0.02)",border:`1px solid ${on?"#D4AF3740":"#ffffff09"}`,transition:"all 0.15s"}}>
                  <span style={{fontSize:10,fontWeight:800,color:on?"#D4AF37":"#ffffff30",fontFamily:"monospace",minWidth:34,textAlign:"center"}}>{pr.code}</span>
                  <span style={{fontSize:9,color:on?"#d4cfc4":"#ffffff25",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{pr.nome.split("·")[0].trim()}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Preview */}
        {lp&&(
          <div style={{background:"linear-gradient(135deg,#0d1a0f,#0a120c)",border:"1px solid #4ade8022",borderRadius:12,padding:14}}>
            <div style={{fontSize:8,letterSpacing:3,color:"#4ade8070",fontFamily:"monospace",marginBottom:10}}>TOTAL DO PEDIDO · {prods.length} produto{prods.length>1?"s":""}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,textAlign:"center"}}>
              {[{l:"RECEITA",v:BRL(lp.receita),c:"#D4AF37"},{l:"CUSTO",v:BRL(lp.custoTotal),c:"#f87171"},{l:"LUCRO",v:BRL(lp.lucro),c:"#4ade80",sub:PCT(lp.margem)}].map(x=>(
                <div key={x.l}>
                  <div style={{fontSize:8,letterSpacing:2,color:"#ffffff28",fontFamily:"monospace",marginBottom:4}}>{x.l}</div>
                  <div style={{fontSize:13,fontWeight:800,color:x.c,fontFamily:"monospace",lineHeight:1}}>{x.v}</div>
                  {x.sub&&<div style={{fontSize:9,color:"#4ade8066",fontFamily:"monospace",marginTop:3}}>{x.sub}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={registrar} style={btnG}>+ REGISTRAR VENDA</button>
      </div>
    </div>

    {/* Historico */}
    {vendas.length>0&&(
      <div style={sf}>
        <div style={{...sh(),justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}><div style={dot("#D4AF37")}/><span style={{...lbl,color:"#ffffff40"}}>HISTORICO ({vendas.length})</span></div>
          <span style={{fontSize:11,fontWeight:800,color:"#4ade80",fontFamily:"monospace"}}>{BRL(totais.l)}</span>
        </div>
        {vendas.map(v=>{
          const tc=calcVendaTotals(v); const sf2=getFx(Number(v.qtd),v.produto||"");
          return (
            <div key={v.id} style={{padding:"11px 16px",borderBottom:"1px solid #ffffff04"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:10,fontWeight:700,color:"#D4AF37",fontFamily:"monospace",width:32,flexShrink:0}}>#{v.num}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#f0e8d0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.cliente}</div>
                  <div style={{fontSize:9,color:"#ffffff30",fontFamily:"monospace",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.produto} · {v.data}</div>
                  <div style={{display:"flex",gap:6,marginTop:2,flexWrap:"wrap"}}>
                    {v.pagamento&&<span style={{fontSize:8,color:"#ffffff40",fontFamily:"monospace",background:"#ffffff08",padding:"1px 6px",borderRadius:4}}>{v.pagamento==="PIX"?"⚡":v.pagamento==="Dinheiro"?"💵":v.pagamento==="Transferencia"?"🏦":"💳"} {v.pagamento}</span>}
                    {v.telefone&&<span style={{fontSize:8,color:"#60A5FA88",fontFamily:"monospace"}}>📱 {v.telefone}</span>}
                    {v.obs&&<span style={{fontSize:8,color:"#D4AF3778",fontFamily:"monospace"}}>{v.obs}</span>}
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:11,fontWeight:800,color:"#4ade80",fontFamily:"monospace"}}>{BRL(tc.lucro)}</div>
                  <div style={{fontSize:8,color:"#4ade8055",fontFamily:"monospace"}}>{PCT(tc.margem)}</div>
                </div>
                <button onClick={()=>excluir(v.id)} style={{background:"none",border:"none",color:"#ffffff14",cursor:"pointer",fontSize:14,padding:"0 4px"}}
                  onMouseEnter={e=>e.currentTarget.style.color="#ef4444"} onMouseLeave={e=>e.currentTarget.style.color="#ffffff14"}>✕</button>
              </div>
              {/* Status selector */}
              <div style={{display:"flex",gap:5,marginTop:7,marginLeft:42}}>
                {["Pago","Pendente","Entregue"].map(s=>(
                  <button key={s} onClick={()=>updStatus(v.id,s)} style={{fontSize:8,padding:"3px 9px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:"monospace",fontWeight:700,background:(v.status||"Pago")===s?(STATUS_COLOR[s]||"#4ade80")+"25":"rgba(255,255,255,0.04)",color:(v.status||"Pago")===s?STATUS_COLOR[s]||"#4ade80":"#ffffff30",borderBottom:`1.5px solid ${(v.status||"Pago")===s?STATUS_COLOR[s]||"#4ade80":"transparent"}`}}>{s}</button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
)}

{/* ═══════════════════════════════════════════════════════
    GESTAO
═══════════════════════════════════════════════════════ */}
{tab==="gestao"&&(
  <div style={{display:"flex",flexDirection:"column",gap:14}}>

    {/* Sub tabs */}
    <div style={{display:"flex",gap:5}}>
      {[["","ESTOQUE"],["followup","FOLLOW-UP"],["relatorio","RELATORIO"]].map(([v,l])=>(
        <button key={v} onClick={()=>setSubTab(v)} style={{flex:1,padding:"8px 4px",borderRadius:8,border:"none",cursor:"pointer",fontFamily:"monospace",fontSize:8,letterSpacing:2,fontWeight:800,background:subTab===v?"#D4AF3722":"transparent",color:subTab===v?"#D4AF37":"#ffffff30",borderBottom:`2px solid ${subTab===v?"#D4AF37":"transparent"}`}}>{l}</button>
      ))}
    </div>

    {/* ESTOQUE MINIMO */}
    {subTab===""&&(
      <div style={sf}>
        <div style={sh()}>
          <div style={dot("#D4AF37")}/>
          <span style={{...lbl,color:"#D4AF37"}}>CONTROLE DE ESTOQUE MINIMO</span>
        </div>
        <div style={{padding:14}}>
          <div style={{fontSize:10,color:"#ffffff40",fontFamily:"monospace",marginBottom:12,lineHeight:1.6}}>
            Defina a quantidade minima de saidas antes de receber alerta de reposicao. O sistema monitora automaticamente.
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:400,overflowY:"auto"}}>
            {CAT.map(pr=>{
              const saidas=saidaMap[pr.code]||0; const min=estoque[pr.code]||0;
              const alerta=min>0&&saidas>=min*0.8;
              return (
                <div key={pr.code} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:9,background:alerta?"#ef444410":"rgba(255,255,255,0.02)",border:`1px solid ${alerta?"#ef444430":"#ffffff08"}`}}>
                  <span style={{fontSize:9,fontWeight:800,color:alerta?"#ef4444":"#D4AF37",fontFamily:"monospace",minWidth:46}}>{pr.code}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:10,color:"#f0e8d0"}}>{pr.nome}</div>
                    <div style={{fontSize:8,color:"#ffffff35",fontFamily:"monospace"}}>{saidas} saidas registradas</div>
                  </div>
                  {alerta&&<span style={{fontSize:8,color:"#ef4444",fontFamily:"monospace",background:"#ef444418",padding:"2px 6px",borderRadius:6}}>REPOR</span>}
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <input type="number" value={min||""} placeholder="Min" min="0"
                      onChange={e=>updEstoque(pr.code,e.target.value)}
                      style={{width:48,background:"#0A0A0F",border:"1px solid #D4AF3430",borderRadius:6,color:"#D4AF37",fontSize:11,fontFamily:"monospace",textAlign:"center",padding:"4px"}}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    )}

    {/* FOLLOW-UP */}
    {subTab==="followup"&&(
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={sf}>
          <div style={sh("#60A5FA")}><div style={dot("#60A5FA")}/><span style={{...lbl,color:"#60A5FA"}}>NOVO FOLLOW-UP</span></div>
          <div style={{padding:14,display:"flex",flexDirection:"column",gap:10}}>
            <div>
              <div style={{...lbl,color:"#ffffff35",marginBottom:5}}>CLIENTE</div>
              <input value={newFollowup.cliente} onChange={e=>setNewFollowup(p=>({...p,cliente:e.target.value}))} style={inp} placeholder="Nome do cliente"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <div style={{...lbl,color:"#ffffff35",marginBottom:5}}>DATA LEMBRETE</div>
                <input value={newFollowup.data} onChange={e=>setNewFollowup(p=>({...p,data:e.target.value}))} style={inp} placeholder="DD/MM/AAAA"/>
              </div>
              <div>
                <div style={{...lbl,color:"#ffffff35",marginBottom:5}}>OBSERVACAO</div>
                <input value={newFollowup.obs} onChange={e=>setNewFollowup(p=>({...p,obs:e.target.value}))} style={inp} placeholder="Motivo..."/>
              </div>
            </div>
            <button onClick={addFollowup} style={btnG}>+ ADICIONAR LEMBRETE</button>
          </div>
        </div>
        {followups.length>0&&(
          <div style={sf}>
            <div style={sh("#60A5FA")}><div style={dot("#60A5FA")}/><span style={{...lbl,color:"#60A5FA"}}>LEMBRETES ({followups.length})</span></div>
            {[...followups].sort((a,b)=>(parseDate(a.data)||0)-(parseDate(b.data)||0)).map(f=>{
              const dias=daysDiff(f.data); const vencido=dias>=0;
              return (
                <div key={f.id} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 16px",borderBottom:"1px solid #ffffff05"}}>
                  <span style={{fontSize:18}}>{vencido?"🔔":"⏳"}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#f0e8d0"}}>{f.cliente}</div>
                    <div style={{fontSize:9,color:"#ffffff40",fontFamily:"monospace"}}>{f.data}{f.obs?" · "+f.obs:""}</div>
                    {vencido&&<div style={{fontSize:8,color:"#ef4444",fontFamily:"monospace",marginTop:2}}>VENCIDO ha {dias} dias</div>}
                  </div>
                  <div style={{display:"flex",gap:4}}>
                {f.telefone&&<a href={"https://wa.me/55"+f.telefone.replace(/\D/g,"")} target="_blank" rel="noreferrer" style={{background:"none",border:"1px solid #25D36630",borderRadius:6,padding:"3px 7px",color:"#25D366",fontSize:9,cursor:"pointer",fontFamily:"monospace",textDecoration:"none"}}>WA</a>}
                <button onClick={()=>delFollowup(f.id)} style={{background:"none",border:"1px solid #4ade8030",borderRadius:6,padding:"3px 8px",color:"#4ade80",fontSize:9,cursor:"pointer",fontFamily:"monospace"}}>FEITO</button>
              </div>
                </div>
              );
            })}
          </div>
        )}
        {/* Clientes inativos */}
        {inativos.length>0&&(
          <div style={sf}>
            <div style={sh("#f87171")}><div style={dot("#f87171")}/><span style={{...lbl,color:"#f87171"}}>CLIENTES INATIVOS +30 DIAS</span></div>
            {inativos.map(([nome,d])=>{
              const ult=d.datas.sort().reverse()[0];
              return (
                <div key={nome} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 16px",borderBottom:"1px solid #ffffff05"}}>
                  <span style={{fontSize:18}}>🔴</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#f0e8d0"}}>{nome}</div>
                    <div style={{fontSize:9,color:"#ffffff40",fontFamily:"monospace"}}>Ultima compra: {ult} · {daysDiff(ult)} dias · {d.pedidos} pedidos · {BRL(d.lucro)} lucro total</div>
                  </div>
                  <button onClick={()=>setNewFollowup({cliente:nome,data:toDay(),obs:"Reativacao"})} style={{background:"none",border:"1px solid #60A5FA30",borderRadius:6,padding:"3px 8px",color:"#60A5FA",fontSize:9,cursor:"pointer",fontFamily:"monospace"}}
                    onTouchStart={()=>setTab("gestao")||setSubTab("followup")}>FOLLOW-UP</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    )}

    {/* RELATORIO */}
    {subTab==="relatorio"&&(
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={sf}>
          <div style={sh("#34D399")}><div style={dot("#34D399")}/><span style={{...lbl,color:"#34D399"}}>RELATORIO POR PERIODO</span></div>
          <div style={{padding:14}}>
            <div style={{display:"flex",gap:5,marginBottom:14}}>
              {[["semana","SEMANA"],["mes","MES"],["tudo","TOTAL"]].map(([v,l])=>(
                <button key={v} onClick={()=>setFiltroPeriodo(v)} style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",fontFamily:"monospace",fontSize:9,letterSpacing:2,fontWeight:800,background:filtroPeriodo===v?"#34D39922":"transparent",color:filtroPeriodo===v?"#34D399":"#ffffff30",borderBottom:`2px solid ${filtroPeriodo===v?"#34D399":"transparent"}`}}>{l}</button>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
              {[{l:"RECEITA",v:BRL(totais.r),c:"#D4AF37"},{l:"LUCRO",v:BRL(totais.l),c:"#4ade80"},{l:"CUSTO",v:BRL(totais.c),c:"#f87171"},{l:"MARGEM",v:PCT(margem),c:"#C084FC"},{l:"PEDIDOS",v:vendasFiltradas.length,c:"#60A5FA"},{l:"UNIDADES",v:totais.q,c:"#FDE047"}].map(x=>(
                <div key={x.l} style={{background:"#ffffff04",border:"1px solid #ffffff08",borderRadius:10,padding:"10px 12px"}}>
                  <div style={{fontSize:8,letterSpacing:2,color:x.c+"88",fontFamily:"monospace",marginBottom:4}}>{x.l}</div>
                  <div style={{fontSize:16,fontWeight:900,color:x.c,fontFamily:"monospace"}}>{x.v}</div>
                </div>
              ))}
            </div>
            {/* Status breakdown */}
            <div style={{marginBottom:14}}>
              <div style={{...lbl,color:"#ffffff35",marginBottom:8}}>STATUS DOS PEDIDOS</div>
              {["Pago","Pendente","Entregue"].map(s=>{
                const count=vendasFiltradas.filter(v=>(v.status||"Pago")===s).length;
                const pct=vendasFiltradas.length>0?(count/vendasFiltradas.length)*100:0;
                return (
                  <div key={s} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                    <span style={{fontSize:10,color:STATUS_COLOR[s],fontFamily:"monospace",fontWeight:700,minWidth:56}}>{s}</span>
                    <div style={{flex:1,height:5,borderRadius:3,background:"#ffffff08"}}>
                      <div style={{height:"100%",borderRadius:3,background:STATUS_COLOR[s],width:`${pct}%`,transition:"width 0.5s"}}/>
                    </div>
                    <span style={{fontSize:10,color:"#ffffff40",fontFamily:"monospace",minWidth:20,textAlign:"right"}}>{count}</span>
                  </div>
                );
              })}
            </div>
            {/* Top clientes do periodo */}
            {rankCli.length>0&&(
              <>
                <div style={{...lbl,color:"#ffffff35",marginBottom:8}}>TOP CLIENTES DO PERIODO</div>
                {rankCli.slice(0,5).map(([nome,d],i)=>(
                  <div key={nome} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <span style={{fontSize:9,color:"#ffffff30",fontFamily:"monospace",width:14}}>{i+1}</span>
                    <span style={{flex:1,fontSize:11,color:"#f0e8d0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nome}</span>
                    <span style={{fontSize:11,fontWeight:800,color:"#4ade80",fontFamily:"monospace"}}>{BRL(d.lucro)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    )}

  </div>
)}

      </div>
      <style>{`@keyframes scn{0%{top:5%}50%{top:90%}100%{top:5%}} *{box-sizing:border-box} ::-webkit-scrollbar{width:2px} ::-webkit-scrollbar-thumb{background:#D4AF3328;border-radius:2px} input[type=number]::-webkit-outer-spin-button,input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}`}</style>
    </div>
  );
}
