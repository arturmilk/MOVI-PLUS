'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('static/app.js','utf8');
const start=src.indexOf('async function consents(){');
const end=src.indexOf('\nasync function documents(){',start);
assert(start>=0&&end>start,'Consent screen source must exist');
const code=src.slice(start,end);
const names=['insights','marketing','sharing','documents','assisted_entry','identity_collection'];
let initial={insights:true,marketing:false,sharing:false,documents:false,assisted_entry:false,identity_collection:false};
let selected={},choiceEvents={},requests=[],renders=0,submit=null,approval=true;
const master={checked:false,indeterminate:false,onchange:null};
const clear={onclick:null};
const count={textContent:''};
const documentLike={getElementById:()=>{}};
const form={elements:{namedItem:name=>selected[name]}};
const body={_html:'',set innerHTML(html){
 this._html=html;
 for(const name of names){
  const r=new RegExp('<input type="checkbox" name="'+name+'" ([^>]*)>');
  const match=html.match(r);
  assert(match,'Missing individual consent checkbox '+name);
  selected[name]={checked:match[1].includes('checked'),addEventListener:(event,fn)=>{choiceEvents[name]=fn}};
 }
},get innerHTML(){return this._html}};
const dom={'#body':body,'#consentForm':form,'#consentAll':master,'#consentClear':clear,
 '#consentSelectedCount':count,'#downloadData':{},'#erase':{}};
const ctx={
 $:selector=>dom[selector],request:async(path,value,method)=>{
   if(path==='consents'&&method===undefined)return {choices:initial};
   requests.push({path,value,method});
   if(path==='schema')return {fields:[]};
   return {ok:true};
 },safe:s=>String(s),heading:()=>'<header>Privacidade e autorizações</header>',
 bind:(id,fn)=>{assert(id==='consentForm');submit=fn},
 confirm:()=>approval,msg:()=>{},render:async()=>{renders++},fields:[],console
};
const vmctx=vm.createContext(ctx);
const {consents}=vm.runInContext(code+'\n({consents})',vmctx);
const selection=()=>Object.fromEntries(names.map(n=>[n,selected[n].checked]));
const formData=()=>({has:n=>Boolean(selected[n]?.checked)});
(async()=>{
 await consents();
 assert(body.innerHTML.includes('Marcar todas as 6 autorizações'));
 assert(body.innerHTML.includes('compartilhamento adicional com parceiros'));
 assert(master.indeterminate&&!master.checked);
 assert(count.textContent.includes('1 de 6'));
 assert(requests.length===0);
 console.log('01 Mixed prior consent state shown, indeterminate select-all, no mutation: PASS');

 master.checked=true;master.onchange();
 assert(names.every(n=>selected[n].checked)&&master.checked&&!master.indeterminate);
 assert(count.textContent.includes('6 de 6'));
 assert(requests.length===0);
 console.log('02 Select all checks all six locally without saving any permission: PASS');

 selected.sharing.checked=false;choiceEvents.sharing();
 assert(!master.checked&&master.indeterminate);
 assert(count.textContent.includes('5 de 6'));
 console.log('03 Individual partner sharing can be revoked separately, master reflects mixed state: PASS');

 clear.onclick();
 assert(names.every(n=>!selected[n].checked)&&!master.checked&&!master.indeterminate);
 assert(count.textContent.includes('0 de 6'));
 console.log('04 Clear selection unchecks all locally: PASS');

 master.checked=true;master.onchange();
 approval=false;
 await submit(formData());
 assert(!requests.some(r=>r.path==='consents'&&r.method==='PUT'),'Confirmation cancelled; no consent saved');
 console.log('05 Identity confirmation cancelled; API receives no changes: PASS');

 approval=true;
 await submit(formData());
 const save=requests.filter(r=>r.path==='consents'&&r.method==='PUT');
 assert(save.length===1);
 assert(names.every(n=>save[0].value[n]===true));
 assert(renders===1);
 console.log('06 After explicit confirmation and Save, all six choices are persisted: PASS');

 initial=Object.fromEntries(names.map(n=>[n,true]));
 requests=[];await consents();
 assert(master.checked&&!master.indeterminate);
 assert(count.textContent.includes('6 de 6'));
 assert(requests.length===0);
 console.log('07 Existing all-selected consents remain selected and not rewritten automatically: PASS');
 console.log('7/7 explicit-consent select-all UI tests PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
