'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const elements=new Map(), el=x=>{if(!elements.has(x))elements.set(x,{
 innerHTML:'',className:'',onclick:null,disabled:false,
 insertAdjacentElement(where,n){this.added=n},appendChild(n){this.added=n},prepend(n){this.added=n},
 firstElementChild:{insertAdjacentElement(where,element){el('body').added=element}}
 });return elements.get(x)};
let role='admin',activeTab='agent-manage';
const state={
 'admin/finance-agent/release':{available:true,active_drivers:3,authorized_drivers:1,authorized_multimodal:1,
  proposals:{pending:2,confirmed:1},sources:{text:2,audio:1},deepseek_ready:true,whisper_ready:true},
 'admin/finance-agent/provider':{key_set:true},
 'finance-agent/release':{available:true,consent_needed:true,provider_ready:true}
};
const ctx={
 am:[['home','Inicio'],['drivers','Motoristas'],['settings','Conta']],
 user:{role:'admin',name:'QA'}, tab:'agent-manage',
 render:async()=>{},driverHome:async()=>{el('body').innerHTML='Painel existente'},
 nav:()=>{},request:async path=>{if(!(path in state))throw Error('Unexpected path '+path);return state[path]},
 heading:t=>t,safe:s=>String(s??'').replace(/[&<>]/g,''),stage2Cards:rows=>rows.map(r=>r[0]+':'+r[1]).join(','),
 stage2Bars:()=>'<div>grafico</div>',stage2Empty:s=>s||'Vazio',
 document:{getElementById:el,createElement:()=>({...el('NEW'),outerHTML:''})},msg:()=>{},confirm:()=>false,console
};
const exec=vm.createContext(ctx);
const api=vm.runInContext(fs.readFileSync('static/agent-release-v1.js','utf8')+
 '\n({releaseAdminScreen,driverHome,render})',exec);
(async()=>{
 await api.releaseAdminScreen();
 assert(el('body').innerHTML.includes('Agente liberado para os motoristas'));
 assert(el('body').innerHTML.includes('WhatsApp automático'));
 assert(el('body').innerHTML.includes('Pausar agente'));
 assert(typeof el('agentReleaseToggle').onclick==='function');
 console.log('Admin monitor and pause controls: PASS');
 ctx.user={role:'driver',name:'QA'};ctx.tab='home';
 await api.driverHome();
 assert(el('body').innerHTML.includes('Painel existente'));
 assert(el('body').added.innerHTML.includes('Conhecer e ativar meu agente'));
 console.log('Motorist homepage has opt-in CTA and preserves existing financial dashboard: PASS');
 state['finance-agent/release']={available:false,consent_needed:true};
 await api.driverHome();
 assert(el('body').added.innerHTML.includes('Temporariamente pausado'));
 assert(el('body').added.innerHTML.includes('disabled'));
 console.log('Paused agent clearly not launchable: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});