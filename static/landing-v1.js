'use strict';
/* NOVAGENTE — página pública de entrada única para motorista e gestor.
   O tipo de conta e as permissões são verificados no servidor após o login.
   Nunca confiar na opção "administrador" escolhida na página pública. */
const ngLandingExamples = {
 fuel:{
  input:'“Gastei R$ 85 de combustível hoje.”',
  reply:'Identifiquei uma despesa com combustível. Esse tipo de gasto pode ser parte do seu trabalho. Vamos acompanhar quanto ele representa no mês?',
  category:'Combustível',amount:'R$ 85,00'
 },
 market:{
  input:'“Comprei R$ 142 no supermercado.”',
  reply:'Encontrei uma compra de supermercado. Ela pode reunir itens essenciais e opcionais. Quer separar os produtos para entender melhor suas despesas?',
  category:'Supermercado',amount:'R$ 142,00'
 },
 income:{
  input:'“Hoje ganhei R$ 260 nas corridas da Uber.”',
  reply:'Parece uma receita de corridas. Posso sugerir esse valor como ganho do dia e depois ajudar você a comparar com as despesas de trabalho.',
  category:'Ganhos com corridas',amount:'R$ 260,00'
 }
};
let ngLandingLastFocus=null;
let ngLandingAuthRole='driver';
let ngLandingAuthMode='login';

function ngLandingApplyExample(name){
 const data=ngLandingExamples[name];
 if(!data)return;
 const input=document.getElementById('ngExampleInput');
 const reply=document.getElementById('ngExampleReply');
 const category=document.getElementById('ngExampleCategory');
 const amount=document.getElementById('ngExampleAmount');
 if(!input||!reply||!category||!amount)return;
 input.textContent=data.input;reply.textContent=data.reply;
 category.textContent=data.category;amount.textContent=data.amount;
 document.querySelectorAll('.ng-demo-choice').forEach(btn=>{
  const selected=btn.dataset.ngExample===name;
  btn.classList.toggle('ng-is-active',selected);
  btn.setAttribute('aria-pressed',String(selected));
 });
}

function ngLandingOpenAuth(mode='login',role='driver'){
 const overlay=document.getElementById('ng-auth-modal');
 if(!overlay)return;
 ngLandingLastFocus=document.activeElement;
 ngLandingAuthRole=role==='admin'?'admin':'driver';
 ngLandingAuthMode=mode==='enroll'?'enroll':'login';
 overlay.hidden=false;
 document.body.classList.add('ng-dialog-open');
 const administrative=ngLandingAuthRole==='admin';
 document.getElementById('ng-auth-eyebrow').textContent=
  administrative?'ACESSO RESTRITO / GESTÃO':'SEU ACESSO AO CLUBE';
 document.getElementById('ng-auth-title').textContent=
  administrative?'Bem-vindo à gestão do Clube.':ngLandingAuthMode==='enroll'?'Seu Clube começa aqui.':'Que bom ter você aqui.';
 document.getElementById('ng-auth-intro').textContent=administrative?
  'Acesse com sua conta administrativa. O sistema verificará suas permissões e abrirá o painel correto.':
  ngLandingAuthMode==='enroll'?'Preencha seu convite individual para solicitar sua conta de motorista.':
  'Entre com sua conta individual para abrir seu painel e conversar com o agente.';
 const tabs=document.getElementById('ng-auth-tabs');
 tabs.hidden=administrative;
 if(ngLandingAuthMode==='enroll'&&administrative)ngLandingAuthMode='login';
 ngLandingPaintLogin(ngLandingAuthMode);
}

function ngLandingPaintLogin(mode){
 ngLandingAuthMode=mode;
 const title=document.getElementById('ng-auth-title');
 const intro=document.getElementById('ng-auth-intro');
 if(ngLandingAuthRole!=='admin'){
  title.textContent=mode==='enroll'?'Seu Clube começa aqui.':'Que bom ter você aqui.';
  intro.textContent=mode==='enroll'?'Com seu convite individual, faça o cadastro e aguarde aprovação do gestor.':
   'Entre com sua conta individual para abrir seu painel financeiro.';
 }
 document.querySelectorAll('.ng-dialog-tab').forEach(btn=>{
  const selected=btn.dataset.ngMode===mode;
  btn.classList.toggle('ng-active',selected);
  btn.setAttribute('aria-selected',String(selected));
 });
 // Preserve the existing and audited login/enrollment flow and its server-side role checks.
 paintLogin(mode);
 const el=document.querySelector('#ng-auth-modal #authform input:not([type=hidden])');
 if(el)el.focus({preventScroll:true});
}

function ngLandingCloseAuth(){
 const overlay=document.getElementById('ng-auth-modal');
 if(!overlay||overlay.hidden)return;
 overlay.hidden=true;
 document.body.classList.remove('ng-dialog-open');
 if(ngLandingLastFocus&&typeof ngLandingLastFocus.focus==='function')
  ngLandingLastFocus.focus({preventScroll:true});
}

function ngLandingHandleClick(e){
 const close=e.target.closest('[data-ng-close]');
 if(close){ngLandingCloseAuth();return;}
 const example=e.target.closest('[data-ng-example]');
 if(example){ngLandingApplyExample(example.dataset.ngExample);return;}
 const auth=e.target.closest('[data-ng-auth]');
 if(auth){
  e.preventDefault();
  ngLandingOpenAuth(auth.dataset.ngAuth,auth.dataset.ngRole);
  return;
 }
 const mode=e.target.closest('[data-ng-mode]');
 if(mode){ngLandingPaintLogin(mode.dataset.ngMode);return;}
}

function ngLandingPublic(mode='home'){
 user=null;
 document.body.classList.remove('ng-dialog-open');
 const template=document.getElementById('landing-public-template');
 if(!template){
  // Safe fallback if a cache is temporarily serving the previous index.
  document.getElementById('app').textContent='O Clube do Motorista está carregando. Atualize esta página.';
  return;
 }
 const app=document.getElementById('app');
 app.innerHTML=template.innerHTML;
 app.onclick=ngLandingHandleClick;
 const year=document.getElementById('ng-year');
 if(year)year.textContent=String(new Date().getFullYear());
 ngLandingApplyExample('fuel');
 const invite=new URLSearchParams(window.location.search).get('convite');
 if(invite){ngLandingOpenAuth('enroll','driver');return;}
 if(mode==='login'||mode==='admin'||mode==='enroll'){
  ngLandingOpenAuth(mode==='enroll'?'enroll':'login',mode==='admin'?'admin':'driver');
 }
}

document.addEventListener('keydown',e=>{
 const modal=document.getElementById('ng-auth-modal');
 if(!modal||modal.hidden)return;
 if(e.key==='Escape'){e.preventDefault();ngLandingCloseAuth();return;}
 if(e.key==='Tab'){
  const eligible=[...modal.querySelectorAll('button:not([disabled]):not([hidden]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')]
   .filter(el=>el.getClientRects().length>0);
  if(!eligible.length)return;
  const first=eligible[0],last=eligible[eligible.length-1];
  if(e.shiftKey&&document.activeElement===first){last.focus();e.preventDefault();}
  else if(!e.shiftKey&&document.activeElement===last){first.focus();e.preventDefault();}
 }
});

const ngLandingOriginalBootstrap=bootstrap;
bootstrap=async function(){
 try{return await ngLandingOriginalBootstrap();}
 finally{
  if(user)document.body.classList.remove('ng-dialog-open');
 }
};
// The original login() is used only by the unauthenticated bootstrap and logout.
// No second authentication endpoint or new account type is created.
login=ngLandingPublic;
