'use strict';
/* Socioeconomico V5.1 - etapas independentes, progresso e erros por campo. */
const SOCIO_STAGES=[
 {title:'Trabalho e renda',desc:'Atividade como motorista, renda e rotina de trabalho.',
  keys:['gross_income','other_job','platform','since','team','weekly_hours','weekly_days','daily_km','daily_revenue','daily_fuel','uses_other_apps']},
 {title:'Bancos e situação financeira',desc:'Relação com instituições, capital próprio e situação de crédito declarada.',
  keys:['banks','main_bank','bid_resources','bid_cash','cpf_bank_restriction','cpf_store_restriction','other_debts']},
 {title:'Veículo e renovação',desc:'Situação do veículo, interesse na troca e programa Move Brasil.',
  keys:['vehicle_finance','move_brasil','car_model_interest','vehicle_type','vehicle_installment','vehicle_outstanding','car_change_horizon','monthly_maintenance']},
 {title:'Metas e despesas',desc:'Organização financeira e objetivos para os próximos meses.',
  keys:['household_expenses','monthly_saving_goal','monthly_income_goal']},
 {title:'Identificação e documentos',desc:'Campos originais que exigem uma etapa de segurança e tratamento de dados.',
  keys:['full_name','cpf','rg','birth_date','email','address_cep','whatsapp','vehicle_plate','cnh_upload']}
];
let socioStepIndex=0;
let socioAdminStepIndex=0;
let socioIdentityGranted=false;
function socioFieldList(index){return SOCIO_STAGES[index].keys.map(k=>fields.find(f=>f.key===k)).filter(Boolean)}
function socioStepNavigation(active){
 return '<div class="socio-step-nav" role="tablist" aria-label="Etapas do cadastro">'+
 SOCIO_STAGES.map((stage,index)=>'<button type="button" role="tab" aria-selected="'+(active===index)+'" data-socio-step="'+index+'" class="socio-step-btn '+(active===index?'on':'')+'"><b>'+(index+1)+'</b><span>'+safe(stage.title)+'</span></button>').join('')+'</div>';
}
function boolProtected(f){return !!(f.protected && !socioIdentityGranted);}
function socioStepFormHtml(index,answers,adminMode=false){
 const stage=SOCIO_STAGES[index],list=socioFieldList(index);
 const accessible=list.map(f=>({...f,protected:boolProtected(f)}));
 const locked=accessible.filter(f=>f.protected&&!sensitive);
 const available=accessible.filter(f=>f.type!=='file'&&(!f.protected || sensitive));
 let html='<div class="socio-section-head"><div class="eyebrow">ETAPA '+(index+1)+' DE '+SOCIO_STAGES.length+'</div>'+
 '<h3>'+safe(stage.title)+'</h3><p class="muted">'+safe(stage.desc)+'</p></div>'+
 '<form id="socioStageForm"><div class="fields">'+accessible.map(f=>inputFor(f,answers)).join('')+'</div>'+
 (locked.length?'<div class="notice warn"><b>'+locked.length+' campo(s) aguardando autorização para identificação.</b> '+(adminMode?'O motorista precisa autorizar o uso de seus dados pessoais em Autorizações.':'Acesse Autorizações, marque a opção de cadastro de identificação e salve para liberar os campos.')+'</div>':'')+
 (!adminMode && index===4 && socioIdentityGranted?'<div class="notice"><b>Identificação autorizada.</b> Os campos de texto estão disponíveis. Para enviar a CNH, use a aba Documentos após salvar suas respostas.</div>':'')+
 '<div class="socio-footer"><span class="muted">'+available.length+' campo(s) preenchível(eis) nesta etapa.</span><div class="row">'+
 (index>0?'<button type="button" id="socioPrev" class="btn-lite">← Voltar</button>':'')+
 '<button type="submit" name="action" value="save" class="btn-lite">Salvar etapa</button>'+
 '<button type="submit" name="action" value="next" class="btn">'+(index<SOCIO_STAGES.length-1?'Salvar e continuar →':'Finalizar cadastro')+'</button>'+
 '</div></div></form>';
 return html;
}
function socioStageNote(active,p){
 return '<div class="socio-progress-overview">'+
 '<div><strong>'+p.progress.percent+'%</strong><span>Do cadastro disponível</span></div>'+
 '<div class="socio-progress-main"><div class="progress"><b style="width:'+p.progress.percent+'%"></b></div><p class="muted">'+p.progress.completed+' de '+p.progress.total+' respostas disponíveis preenchidas. Os dados pessoais protegidos não contam como pendência no piloto.</p></div>'+
 '</div>';
}
function socioAttach(formId,active,adminUid){
 const form=document.getElementById(formId);if(!form)return;
 const isAdmin=adminUid!==null&&adminUid!==undefined;
 let modified=false,submitting=false;
 form.addEventListener('input',()=>{modified=true});
 form.addEventListener('change',()=>{modified=true});
 async function save(toStep){
  if(submitting)return;
  submitting=true;
  const buttons=[...form.querySelectorAll('button')];
  buttons.forEach(b=>b.disabled=true);
  try{
   const arr=socioFieldList(active).map(f=>({...f,protected:boolProtected(f)})),payload=fieldsData(form,arr);
   if(Object.keys(payload).length>0){
    const path=isAdmin?'admin/assisted-profile/'+adminUid:'profile';
    await request(path,payload,'PUT');
    msg('Etapa salva com sucesso.');
   }else msg('Os campos desta etapa estão protegidos. Nenhuma informação pessoal foi enviada.');
   if(isAdmin)socioAdminStepIndex=toStep;else socioStepIndex=toStep;
   if(isAdmin)await socioAdminEdit(adminUid);else await formSocioNew();
  }catch(err){
   msg(err.message);
   const notice=document.getElementById('socioFormError');
   if(notice){notice.textContent=err.message;notice.style.display='block'}
  }finally{buttons.forEach(b=>b.disabled=false);submitting=false}
 }
 form.onsubmit=async e=>{
  e.preventDefault();
  const desired=e.submitter?.value==='next'?Math.min(active+1,SOCIO_STAGES.length-1):active;
  if(e.submitter?.value==='next'&&active===SOCIO_STAGES.length-1)msg('Cadastro revisado. Os documentos continuam protegidos.');
  await save(desired);
 };
 document.querySelectorAll('[data-socio-step]').forEach(btn=>{
  btn.onclick=async()=>{
   const idx=Number(btn.dataset.socioStep);
   if(idx===active)return;
   if(modified)await save(idx);
   else{
    if(isAdmin){socioAdminStepIndex=idx;await socioAdminEdit(adminUid)}
    else{socioStepIndex=idx;await formSocioNew()}
   }
  };
 });
 const prev=document.getElementById('socioPrev');
 if(prev)prev.onclick=async()=>{if(modified)await save(Math.max(0,active-1));else{
  if(isAdmin){socioAdminStepIndex=active-1;await socioAdminEdit(adminUid)}
  else{socioStepIndex=active-1;await formSocioNew()}
 }};
}
async function formSocioNew(){
 if(!fields.length)fields=(await request('schema')).fields;
 const p=await request('profile');
 socioIdentityGranted=!!p.identity_collection_enabled;
 const active=socioStepIndex,step=SOCIO_STAGES[active];
 document.getElementById('body').innerHTML=heading('Cadastro socioeconômico','As 23 perguntas originais e as 15 complementares, organizadas para preencher por partes.')+
 socioStageNote(active,p)+socioStepNavigation(active)+
 '<section class="card socio-step-card">'+socioStepFormHtml(active,p.answers)+
 '<div class="notice warn" style="display:none" id="socioFormError"></div></section>'+
 '<div class="notice">Pode salvar uma etapa e continuar depois. As respostas já salvas aparecem novamente quando você retorna. '+(socioIdentityGranted?'Após a autorização individual, você pode preencher os dados de identificação e enviar CNH na aba Documentos.':'Para liberar os campos protegidos, conceda a autorização específica em Autorizações.')+'</div>'+(!socioIdentityGranted&&active===4?'<button type="button" class="btn" id="socioGoConsent">Autorizar o cadastro de identificação</button>':'');
 socioAttach('socioStageForm',active,null);
 const go=document.getElementById('socioGoConsent');
 if(go)go.onclick=()=>{tab='consents';render()};
}
form=formSocioNew;

async function socioAdminEdit(uid){
 try{
  const p=await request('admin/assisted-profile/'+uid);
  socioIdentityGranted=!!p.identity_collection_enabled;
  if(!fields.length)fields=(await request('schema')).fields;
  const active=socioAdminStepIndex,div=document.getElementById('driverDetails');
  if(!div)return;
  div.innerHTML='<div class="row"><h3>Preenchimento assistido · '+safe(p.driver.name)+'</h3><button type="button" class="btn-lite" id="socioAdminBack">← Voltar</button></div>'+
   '<div class="notice">O motorista autorizou o preenchimento assistido. Os identificadores só serão editáveis se houver também autorização específica de cadastro de dados pessoais. O envio da CNH é feito pelo próprio motorista em Documentos.</div>'+
   socioStageNote(active,p)+socioStepNavigation(active)+
   '<div class="socio-step-card">'+socioStepFormHtml(active,p.answers,true)+'</div>'+
   '<div class="notice warn" style="display:none" id="socioFormError"></div>';
  document.getElementById('socioAdminBack').onclick=()=>adminDrivers();
  socioAttach('socioStageForm',active,uid);
 }catch(err){msg(err.message)}
}
