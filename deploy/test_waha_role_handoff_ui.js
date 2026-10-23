'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('static/whatsapp-bridge-v5.js','utf8');
let renderCount=0, messages=[];
const body={innerHTML:''};
let browserIdentity={role:'admin',name:'Gestor aberto em outra aba'};
let backendIdentity={role:'driver',name:'Motorista na sessão atual'};
const ctx={
 user:browserIdentity,tab:'whatsapp',
 am:[['home','Painel']],render:async()=>{renderCount++},
 request:async path=>{
  if(path==='me')return {user:backendIdentity};
  if(path==='admin/whatsapp-bridge')throw Error('Acesso restrito');
  throw Error('Unexpected '+path);
 },
 nav:()=>{},login:()=>{},heading:t=>t,
 $:p=>p==='#body'?body:null,
 safe:x=>String(x??''),msg:t=>messages.push(t),
 console
};
const vmctx=vm.createContext(ctx);
const methods=vm.runInContext(source+'\n({render,whatsappFixAccountSwitch})',vmctx);
(async()=>{
 await methods.render();
 assert(ctx.user.role==='driver' && ctx.tab==='finance-agent');
 assert(renderCount===1);
 assert(messages.some(x=>x.includes('sessão atual é de motorista')));
 assert(!body.innerHTML.includes('Acesso restrito'));
 console.log('01 Stale admin panel detects actual driver session and redirects to agent: PASS');

 ctx.user={role:'admin'};ctx.tab='whatsapp';backendIdentity={role:'admin'};
 renderCount=0;messages.length=0;
 await methods.render();
 assert(body.innerHTML.includes('Acesso restrito'));
 assert(renderCount===0 && ctx.user.role==='admin');
 console.log('02 Real administrative access denial never bypassed: PASS');

 ctx.user={role:'admin'};ctx.tab='whatsapp';backendIdentity=null;
 renderCount=0;messages.length=0;
 await methods.render();
 assert(ctx.user===null&&ctx.tab==='home');
 assert(messages.some(x=>x.includes('sessão terminou')));
 console.log('03 Ended session resets navigation without privileged access: PASS');
 console.log('3/3 stale role handoff tests passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
