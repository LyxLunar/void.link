const root=document.documentElement,toast=document.querySelector(".toast");
const msg=t=>{if(!toast)return;toast.textContent=t;toast.classList.add("show");clearTimeout(window.tt);window.tt=setTimeout(()=>toast.classList.remove("show"),2400)};
window.addEventListener("load",()=>setTimeout(()=>document.querySelector("#loader")?.remove(),900));
window.addEventListener("scroll",()=>document.querySelector("header")?.classList.toggle("scrolled",scrollY>15),{passive:true});

const cur=document.querySelector(".cursor"),dot=document.querySelector(".cursor-dot");
if(cur&&dot){
 addEventListener("pointermove",e=>{dot.style.left=e.clientX+"px";dot.style.top=e.clientY+"px";cur.animate({left:e.clientX+"px",top:e.clientY+"px"},{duration:350,fill:"forwards"})});
 document.querySelectorAll("a,button,input").forEach(x=>{x.addEventListener("mouseenter",()=>{cur.style.width="44px";cur.style.height="44px"});x.addEventListener("mouseleave",()=>{cur.style.width="30px";cur.style.height="30px"})});
}
const card=document.querySelector("#demoCard");
card?.addEventListener("pointermove",e=>{const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;card.style.transform=`rotateY(${x*8}deg) rotateX(${-y*8}deg)`});
card?.addEventListener("pointerleave",()=>card.style.transform="");

const normalize=v=>v.trim().toLowerCase().replace(/[^a-z0-9._-]/g,"");
const claimForms=[...document.querySelectorAll(".claim")];
let selectedPlan="free";

async function claimHandle(form){
 const input=form.querySelector("input"), username=normalize(input.value);
 input.value=username;
 if(username.length<1)return msg("Handles can be 1–24 characters.");
 if(username.length>24)return msg("That handle is too long.");
 try{
   const res=await fetch("/api/handles",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,plan:selectedPlan})});
   const data=await res.json();
   if(!res.ok)throw new Error(data.error||"Could not claim that handle.");
   msg(`Claimed void.link/${data.username} ✦`);
   setAvailability(true,`@${data.username} is yours — ${data.plan} plan`);
   input.value=data.username;
   setTimeout(()=>{location.href=`/u/${encodeURIComponent(data.username)}`},700);
 }catch(err){msg(err.message||"The server is offline. Start the included Node server first.");}
}
claimForms.forEach(f=>f.addEventListener("submit",e=>{e.preventDefault();claimHandle(f)}));

const availability=document.querySelector("#availability");
function setAvailability(ok,text){if(!availability)return;availability.classList.toggle("ok",ok);availability.classList.toggle("bad",!ok);availability.querySelector("span:last-child").textContent=text}
let timer;
async function checkHandle(input){
 const username=normalize(input.value);
 if(!username){setAvailability(true,"Type a handle above to check availability.");return}
 if(username.length<1||username.length>24){setAvailability(false,"Use 1–24 letters, numbers, dots, underscores or hyphens.");return}
 try{
  const res=await fetch(`/api/handles/${encodeURIComponent(username)}`);
  const data=await res.json();
  setAvailability(data.available, data.available?`@${username} is available ✦`:`@${username} is already claimed.`);
 }catch{setAvailability(false,"Start the included server to enable live availability.");}
}
const handleInput=document.querySelector("#handleInput");
handleInput?.addEventListener("input",()=>{clearTimeout(timer);timer=setTimeout(()=>checkHandle(handleInput),220)});
document.querySelector("#finalHandleInput")?.addEventListener("input",e=>{if(handleInput)handleInput.value=e.target.value});

const colors={"#a66cff":"166,108,255","#4ea5ff":"78,165,255","#ff638d":"255,99,141","#8be34f":"139,227,79","#fff":"255,255,255"};
document.querySelectorAll(".swatches button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".swatches button").forEach(x=>x.classList.remove("active"));b.classList.add("active");const c=b.dataset.c||b.style.getPropertyValue("--c");root.style.setProperty("--a",c);root.style.setProperty("--rgb",colors[c]||"166,108,255");msg("Accent updated ✦")});
document.querySelector("#play")?.addEventListener("click",e=>{e.target.textContent=e.target.textContent==="❚❚"?"▶":"❚❚";msg(e.target.textContent==="▶"?"Paused demo":"Playing demo track")});
document.querySelectorAll(".style-buttons button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".style-buttons button").forEach(x=>x.classList.remove("active"));b.classList.add("active");msg(b.textContent+" style selected")});
document.querySelectorAll(".toggles i").forEach(t=>t.parentElement.addEventListener("click",()=>t.classList.toggle("on")));
document.querySelectorAll("details").forEach(d=>d.addEventListener("toggle",()=>{if(d.open)document.querySelectorAll("details").forEach(x=>{if(x!==d)x.open=false})}));

document.querySelectorAll(".plan-select").forEach(b=>b.addEventListener("click",()=>{
 selectedPlan=b.dataset.plan||"free";
  document.querySelectorAll(".plan-select").forEach(x=>x.classList.remove("chosen"));b.classList.add("chosen");
 document.querySelector("#claim")?.scrollIntoView({behavior:"smooth",block:"center"});
 msg(`${selectedPlan.toUpperCase()} selected — claim a handle to continue.`);
}));

async function loadStats(){
 try{
  const res=await fetch("/api/health"),data=await res.json();
  const s=document.querySelector("#serverStatus"),c=document.querySelector("#claimedCount");
  if(s)s.textContent="ONLINE";
  if(c)c.textContent=data.claimed;
  const meta=document.querySelector("#serverMeta");if(meta)meta.textContent=`API v${data.version} · ${data.storage}`;
 }catch{
  const s=document.querySelector("#serverStatus");if(s)s.textContent="DEMO / OFFLINE";
 }
}
loadStats();
