'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const index=fs.readFileSync('static/index.html','utf8');
const content=index.match(/<template id="landing-public-template">([\s\S]*?)<\/template>/);
assert(content,'Missing public landing template.');
const classes=()=>{const set=new Set();return {
 add:v=>set.add(v),remove:v=>set.delete(v),toggle:(k,v)=>v?set.add(k):set.delete(k),
 contains:v=>set.has(v)
}};
const elements=new Map();
function element(id){
 if(!elements.has(id))elements.set(id,{id,hidden:true,innerHTML:'',textContent:'',classList:classes(),
  dataset:{},style:{},focus:()=>{},setAttribute:()=>{},onclick:null,
  set value(v){this._value=v},get value(){return this._value||''}});
 return elements.get(id);
}
let modeSeen=[],originalCalled=0,role='driver',rendered=null;
const tabs=[{dataset:{ngMode:'login'},classList:classes(),setAttribute(k,v){this[k]=v}},
 {dataset:{ngMode:'enroll'},classList:classes(),setAttribute(k,v){this[k]=v}}];
const examples=['fuel','market','income'].map(ngExample=>({dataset:{ngExample},classList:classes(),setAttribute(k,v){this[k]=v}}));
const state={user:null,role};
const ctx={
 document:{
  activeElement:{focus:()=>{}},body:{classList:classes()},
  getElementById:element,
  querySelectorAll:s=>s==='.ng-dialog-tab'?tabs:s==='.ng-demo-choice'?examples:[],
  querySelector:s=>s==='#ng-auth-modal #authform input:not([type=hidden])'?{focus:()=>{}}:null,
  addEventListener:()=>{}
 },
 window:{location:{search:''}},
 location:{search:''},
 URLSearchParams,Date,console,
 user:null,
 bootstrap:async function(){originalCalled++;ctx.user={role:role};rendered=role==='admin'?'gestor':'motorista';},
 paintLogin:m=>modeSeen.push(m)
};
const sandbox=vm.createContext(ctx);
const api=vm.runInContext(fs.readFileSync('static/landing-v1.js','utf8')+
 '\n({login,bootstrap,ngLandingApplyExample,ngLandingOpenAuth,ngLandingCloseAuth})',sandbox);
element('landing-public-template').innerHTML=content[1];
// 1: Land on unauthenticated public site.
api.login();
assert(element('app').innerHTML.includes('Você dirige o carro.'));
assert(element('app').innerHTML.includes('Acesso administrativo'));
assert(element('ng-auth-modal').hidden===true);
console.log('01 Public landing shown to unauthenticated visitors: PASS');
// 2: Driver login opens existing single backend flow.
api.ngLandingOpenAuth('login','driver');
assert(modeSeen.at(-1)==='login');
assert(element('ng-auth-modal').hidden===false);
assert(element('ng-auth-eyebrow').textContent.includes('CLUBE'));
console.log('02 Motorist login uses existing form: PASS');
// 3: Admin footer uses same login form and hides invite.
api.ngLandingOpenAuth('login','admin');
assert(modeSeen.at(-1)==='login');
assert(element('ng-auth-eyebrow').textContent.includes('GESTÃO'));
assert(element('ng-auth-tabs').hidden===true);
console.log('03 Administrative entry uses SAME login, with no role escalation: PASS');
// 4: Invitation preserves existing mode.
api.ngLandingOpenAuth('enroll','driver');
assert(modeSeen.at(-1)==='enroll');
assert(element('ng-auth-tabs').hidden===false);
console.log('04 Existing invitation enrolment reused: PASS');
// 5: Example financial demonstration never uses external API.
api.ngLandingApplyExample('market');
assert(element('ngExampleCategory').textContent==='Supermercado');
assert(element('ngExampleAmount').textContent==='R$ 142,00');
api.ngLandingApplyExample('income');
assert(element('ngExampleCategory').textContent==='Ganhos com corridas');
assert(element('ngExampleReply').textContent.includes('receita'));
console.log('05 Interactive finance examples and illustrative labels: PASS');
// 6: Direct invitation deep link opens enrolment.
ctx.window.location.search='?convite=example123';
api.login();
assert(modeSeen.at(-1)==='enroll');
assert(element('ng-auth-modal').hidden===false);
api.ngLandingCloseAuth();
assert(element('ng-auth-modal').hidden===true);
console.log('06 Invitation URL auto-opens existing enrollment and modal closes: PASS');
// 7: Role is determined by the authenticated bootstrap; not by public button.
(async()=>{
 role='admin';await api.bootstrap();
 assert(rendered==='gestor'&&ctx.user.role==='admin');
 assert(originalCalled===1);
 role='driver';await api.bootstrap();
 assert(rendered==='motorista'&&ctx.user.role==='driver');
 assert(originalCalled===2);
 console.log('07 Logged-in user gets corresponding role-based dashboard: PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
