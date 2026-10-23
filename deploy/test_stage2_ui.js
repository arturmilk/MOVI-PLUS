const fs=require('fs'),vm=require('vm'),assert=require('assert');
const js=fs.readFileSync('static/program-stage2-v5.js','utf8');
const nodes=new Map();
function node(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',value:'2026-10',onclick:null,onchange:null,onsubmit:null,querySelector:()=>({disabled:false}),addEventListener:()=>{}});return nodes.get(id)}
const admin={role:'admin',name:'Admin'};
let user=admin;
const mocked={
 'program/dashboard?month=2026-10':{month:'2026-10',drivers:3,active:3,pending:0,authorized:2,marketing_opt_in:1,income_declared:1000,expense_declared:300,net_declared:700,entry_count:5,
  platforms:{UBER:1,'99':1},progress:{'0–24%':1,'25–49%':0,'50–74%':1,'75–100%':0},
  months:[{month:'2026-09',income:600,expense:100},{month:'2026-10',income:1000,expense:300}],
  benefit_requests:2,open_tasks:1,campaigns_published:1,data_scope:'Somente dados autorizados'},
 'program/benefits':{items:[{id:1,title:'Lavagem de carro',description:'Válido sob aprovação',points_required:5,remaining:3,stock:3,active:1}],
  points:{total:40,profile:30,diary:10},claims:[]},
 'program/claims':{items:[{id:1,name:'Fulano',title:'Lavagem',status:'pending',points_at_request:40,created_at:'2026-10-20T12:00:00'}]},
 'program/tasks':{items:[{id:1,title:'Atender telefone',details:'Teste',owner:'Equipe',priority:'normal',status:'new',due_on:''}]},
 'program/campaigns':{items:[{id:1,title:'Benefício novo',body:'Descrição',status:'published',segment:'all',media_id:null}]},
 'campaigns':{items:[]}
};
const ctx={am:[['home','Painel']],dm:[['home','Painel']],render:async()=>{},tab:'home',user,
 nav:()=>{},request:async (path)=>{if(!(path in mocked))throw Error('Unknown mocked route '+path);return mocked[path]},
 $:node,document:{getElementById:node},heading:t=>'<h2>'+t+'</h2>',brl:n=>'R$ '+n,safe:s=>String(s).replace(/[<>]/g,''),
 bind:()=>{},confirm:()=>true,prompt:()=>null,alert:()=>{},msg:()=>{},Date,Math,Number,console,encodeURIComponent};
const context=vm.createContext(ctx);
const fn=vm.runInContext(js+'\n({stage2Dashboard,stage2Benefits,stage2Tasks,stage2Campaigns})',context);
(async()=>{
 await fn.stage2Dashboard('2026-10');assert(node('#body').innerHTML.includes('Receita mensal declarada'));
 assert(node('#body').innerHTML.includes('R$ 1000'));
 console.log('Dashboard mock rendering: PASS');
 await fn.stage2Benefits();assert(node('#body').innerHTML.includes('Lavagem de carro'));assert(node('#body').innerHTML.includes('Aprovar'));
 console.log('Admin benefits mock rendering: PASS');
 await fn.stage2Tasks();assert(node('#body').innerHTML.includes('Atender telefone'));
 console.log('Operations mock rendering: PASS');
 await fn.stage2Campaigns();assert(node('#body').innerHTML.includes('Benefício novo'));
 console.log('Admin campaigns mock rendering: PASS');
 context.user={role:'driver',name:'Teste'};
 await fn.stage2Benefits();assert(node('#body').innerHTML.includes('Seus pontos'));assert(node('#body').innerHTML.includes('Solicitar'));
 console.log('Driver benefits mock rendering: PASS');
 await fn.stage2Campaigns();assert(node('#body').innerHTML.includes('Novidades do Clube'));
 console.log('Driver campaigns mock rendering: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});