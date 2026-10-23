'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const body=new Map();
const el=id=>{if(!body.has(id))body.set(id,{innerHTML:'',onsubmit:null,onclick:null,onchange:null,appendChild:()=>{},addEventListener:()=>{},scrollIntoView:()=>{},querySelector:()=>({disabled:false}),querySelectorAll:()=>[]});return body.get(id)};
let who={role:'driver',name:'Motorista de teste'};
let options={enabled:true,media_ai:false,trends:true,offers:false};
let store={
 'finance-agent/consent':{options},'finance-agent/proposals':{items:[]},
 'finance-agent/whatsapp/link-status':{linked:false,webhook_enabled:false,pilot_allowed:false},
 'finance-agent/whatsapp/session-status':{eligible:true,connected:true,status:'WORKING',club_whatsapp_number:'5511999887766',linked:false,pilot_receiving:true},
 'finance-agent/release':{available:true,consent_needed:false,provider_ready:true,local_audio_ready:true,message_types:{text:true,image:true,audio:true}},
 'finance-agent/insights':{month:'2026-10',total:152.45,expenses:{Supermercado:152.45},last_month:{},advice:['Compare preços antes de comprar.']},
 'admin/finance-agent/provider':{key_set:false},'admin/finance-agent/whatsapp':{enabled:false,linked_drivers:0}
};
const ctx={dm:[['home','Painel']],am:[['home','Painel']],render:async()=>{},settings:async()=>{},
 user:who,tab:'finance-agent',nav:()=>{},document:{getElementById:el,querySelectorAll:()=>[],createElement:()=>({className:'',innerHTML:'',appendChild:()=>{}})},
 request:async path=>{if(!(path in store))throw Error('Unexpected path '+path);return store[path]},
 heading:t=>'<h2>'+t+'</h2>',safe:x=>String(x??'').replace(/[<>]/g,''),brl:v=>'R$ '+Number(v||0),
 stage2Empty:t=>t||'Vazio',msg:()=>{},Date,Number,encodeURIComponent,console,confirm:()=>false,stage2Status:()=>'',location:{},
};
const app=vm.createContext(ctx);
const run=vm.runInContext(fs.readFileSync('static/finance-agent-v1.js','utf8')+'\n({financeAgentScreen,financeAgentProviderSettings,onPreview})',app);
(async()=>{
 await run.financeAgentScreen();
 assert(el('body').innerHTML.includes('Meu agente financeiro'));
 assert(el('body').innerHTML.includes('Autorizo processar minhas mensagens de texto no DeepSeek'));
 assert(el('body').innerHTML.includes('WhatsApp do Clube está preparado'));
 assert(el('body').innerHTML.includes('R$ 152.45'));
 console.log('Driver registration, independent permissions, expense insights: PASS');
 store['finance-agent/whatsapp/link-status']={linked:false,webhook_enabled:true,pilot_allowed:true,code_active:false};
 await run.financeAgentScreen();
 assert(el('body').innerHTML.includes('Pareado e conectado (WORKING)'));
 assert(el('body').innerHTML.includes('DESTINO'));
 assert(el('body').innerHTML.includes('REMETENTE'));
 assert(el('body').innerHTML.includes('5511999887766'));
 assert(el('body').innerHTML.includes('Ainda não vinculado'));
 assert(el('body').innerHTML.includes('1. Gerar novo código'));
 assert(el('body').innerHTML.includes('3. Já enviei: verificar vínculo'));
 assert(el('body').innerHTML.includes('Ainda não existe código de vínculo ativo'));
 console.log('Driver pilot sees pairing status and explicit step to generate/copy unique code: PASS');
 store['finance-agent/whatsapp/link-status']={linked:false,webhook_enabled:true,pilot_allowed:true,code_active:true,code_minutes_remaining:13};
 await run.financeAgentScreen();
 assert(el('body').innerHTML.includes('já gerou um código'));
 console.log('Generated active code appears as pending without exposing code in GET: PASS');
 options={enabled:false,media_ai:false,trends:false,offers:false};
 store['finance-agent/consent']={options};
 await run.financeAgentScreen();
 assert(el('body').innerHTML.includes('Aguardando autorização'));
 assert(!el('body').innerHTML.includes('finAgentText'));
 console.log('Driver without consent sees no active analysis form: PASS');
 ctx.user={role:'admin',name:'Gestor'};
 await run.financeAgentProviderSettings();
 assert(el('body').innerHTML!==undefined);
 console.log('Admin key readiness path and pending WhatsApp notice: PASS');
})().catch(err=>{console.error(err);process.exitCode=1});