'use strict';
/* NOVAGENTE · gráficos referenciais. Não faz transferências financeiras. */
const DIST_COLORS=['#fa8b77','#ba95d4','#75a9e5','#ffb58e','#aeb4c2','#81cfc3','#dca8a0','#d5bf78'];
const DIST_SAMPLE=[
 {name:'Operação',percentage:40,reported_sent:30000},
 {name:'Comissão',percentage:25,reported_sent:17500},
 {name:'Reserva',percentage:20,reported_sent:15000},
 {name:'Marketing',percentage:10,reported_sent:8000},
 {name:'Taxas',percentage:5,reported_sent:2000}
];
const distMoney=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
let distPlan=null,distSaved=null,distMode='example',distEditing=false;
const distSafe=typeof safe==='function'?safe:v=>String(v??'');

am.splice(1,0,['distribution','Distribuição gráfica']);
dm.splice(1,0,['distribution','Distribuição gráfica']);
const distOldRender=render;
render=async function(){
 if(!user||tab!=='distribution')return distOldRender();
 nav();
 try{await distPage()}catch(e){$('#body').innerHTML='<div class="card">Não foi possível carregar a distribuição: '+distSafe(e.message)+'</div>'}
};
function distCleanAmount(v){
 let n=Number(String(v||0).replace(',','.'));
 return Math.round(n*100);
}
function distPreview(payload){
 let totalCents=distCleanAmount(payload.total);
 if(!Number.isSafeInteger(totalCents)||totalCents<0||totalCents>1e10)throw Error('Informe um total válido, de até R$ 100 milhões.');
 if(!payload.rows||payload.rows.length<2||payload.rows.length>8)throw Error('Informe entre 2 e 8 categorias.');
 let basic=payload.rows.map((r,i)=>{
  let name=String(r.name||'').trim(),basis=Math.round(Number(r.percentage)*100),sent=distCleanAmount(r.reported_sent);
  if(name.length<2||name.length>40)throw Error('Cada categoria deve ter nome de 2 a 40 caracteres.');
  if(!Number.isInteger(basis)||basis<0||basis>10000)throw Error('Percentual inválido em '+name);
  if(!Number.isSafeInteger(sent)||sent<0)throw Error('Valor informado inválido em '+name);
  return {name,basis,sent,index:i};
 });
 if(new Set(basic.map(r=>r.name.toLowerCase())).size!==basic.length)throw Error('Use nomes diferentes para cada categoria.');
 if(basic.reduce((sum,r)=>sum+r.basis,0)!==10000)throw Error('A soma dos percentuais deve ser exatamente 100%.');
 let floors=basic.map(r=>Math.floor(totalCents*r.basis/10000));
 let rest=totalCents-floors.reduce((a,b)=>a+b,0);
 let order=basic.map(r=>({...r,fraction:totalCents*r.basis%10000})).sort((a,b)=>b.fraction-a.fraction||a.index-b.index);
 for(let i=0;i<rest;i++)floors[order[i].index]++;
 let rows=basic.map((r,i)=>{
  if(r.sent>floors[i])throw Error('Valor informado como enviado supera o previsto para '+r.name);
  return {name:r.name,percentage:r.basis/100,planned:floors[i]/100,reported_sent:r.sent/100,pending:(floors[i]-r.sent)/100};
 });
 let sent=basic.reduce((sum,r)=>sum+r.sent,0);
 return {total:totalCents/100,reported_sent:sent/100,pending:(totalCents-sent)/100,
  reported_percentage:totalCents?Math.round(sent*10000/totalCents)/100:0,rows};
}
function distFromApi(data){return {total:data.total,rows:data.rows.map(r=>({name:r.name,percentage:r.percentage,reported_sent:r.reported_sent}))};}
function distSample(){return {total:100000,rows:DIST_SAMPLE.map(r=>({...r}))};}
function distChartCards(d){
 return '<div class="dist-metrics">'+
 ['Total planejado','Informado como enviado','Ainda por destinar'].map((t,i)=>
  '<div class="dist-metric dist-metric-'+i+'"><span class="dist-metric-icon">'+(['◈','↗','◷'][i])+'</span><div><span>'+t+'</span><strong>'+distMoney([d.total,d.reported_sent,d.pending][i])+'</strong></div></div>').join('')+
 '</div>';
}
function distDonut(d){
 const gradient=d.rows.map((r,i)=>{
   let before=d.rows.slice(0,i).reduce((a,v)=>a+v.percentage,0),after=before+r.percentage;
   return DIST_COLORS[i]+' '+before+'% '+after+'%';
 }).join(',');
 let rows=d.rows.map((r,i)=>'<div class="dist-legend-row"><span class="dist-color" style="background:'+DIST_COLORS[i]+'"></span><span>'+distSafe(r.name)+'</span><b>'+r.percentage.toLocaleString('pt-BR')+'%</b><em>'+distMoney(r.planned)+'</em></div>').join('');
 return '<section class="dist-panel"><h3>Percentual por destino</h3><p>Participação de cada categoria no valor total.</p><div class="dist-donut-split"><div class="dist-donut" role="img" aria-label="Percentual de distribuição por destino: '+distSafe(d.rows.map(r=>r.name+' '+r.percentage+'%').join(', '))+'" style="--dist-gradient:conic-gradient('+gradient+')"><div class="dist-donut-center"><strong>'+distMoney(d.total)+'</strong><small>Total planejado</small></div></div><div class="dist-legend">'+rows+'</div></div></section>';
}
function distCompare(d){
 let ratio=d.total?Math.min(100,d.reported_percentage):0;
 return '<section class="dist-panel"><h3>Previsto x informado</h3><p>Quanto foi planejado e quanto você marcou manualmente.</p>'+
 '<div class="dist-overlap"><div class="dist-circle dist-circle-a"><span>Planejado</span><strong>'+distMoney(d.total)+'</strong></div><div class="dist-circle dist-circle-b"><span>Informado</span><strong>'+distMoney(d.reported_sent)+'</strong></div><div class="dist-overlap-center">'+ratio.toLocaleString('pt-BR')+'%<small>informado</small></div></div>'+
 '<div class="dist-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+ratio+'"><div style="width:'+ratio+'%"></div></div>'+
 '<div class="dist-progress-desc"><b>'+ratio.toLocaleString('pt-BR')+'% do total</b><span>'+distMoney(d.pending)+' pendente</span></div>'+
 '</section>';
}
function distBubbles(d){
 let nodes=d.rows.map((r,i)=>{
  let size=68+Math.round(Math.sqrt(r.percentage/100)*90);
  return '<div class="dist-bubble dist-bubble-'+i+'" style="--bubble-color:'+DIST_COLORS[i]+';--bubble-size:'+size+'px" title="'+distSafe(r.name)+': '+r.percentage+'% - '+distMoney(r.reported_sent)+' informado"><strong>'+r.percentage.toLocaleString('pt-BR')+'%</strong><span>'+distMoney(r.reported_sent)+'</span></div>';
 }).join('');
 return '<section class="dist-panel"><h3>Composição por categoria</h3><p>Gráfico circular inspirado no modelo de referência.</p><div class="dist-orbit" aria-hidden="true"><div class="dist-orbit-ring"></div><div class="dist-orbit-center"><strong>'+distMoney(d.total)+'</strong><small>Total</small></div>'+nodes+'</div>'+
 '<div class="dist-orbit-caption">'+d.rows.map((r,i)=>'<span><i style="background:'+DIST_COLORS[i]+'"></i>'+distSafe(r.name)+'</span>').join('')+'</div></section>';
}
function distTable(d){
 return '<section class="dist-panel dist-table-panel"><div class="dist-table-head"><div><h3>Detalhamento</h3><p>Distribuição por categoria, percentual e valores.</p></div><button class="btn-lite" id="distCSV" type="button">Exportar CSV</button></div>'+
 '<div class="scroll"><table class="dist-table"><thead><tr><th>Categoria</th><th>Percentual</th><th>Previsto</th><th>Informado como enviado</th><th>Pendente</th></tr></thead><tbody>'+
 d.rows.map((r,i)=>'<tr><td><span class="dist-color" style="background:'+DIST_COLORS[i]+'"></span>'+distSafe(r.name)+'</td><td>'+r.percentage.toLocaleString('pt-BR')+'%</td><td>'+distMoney(r.planned)+'</td><td>'+distMoney(r.reported_sent)+'</td><td>'+distMoney(r.pending)+'</td></tr>').join('')+
 '</tbody><tfoot><tr><th>Total</th><th>100%</th><th>'+distMoney(d.total)+'</th><th>'+distMoney(d.reported_sent)+'</th><th>'+distMoney(d.pending)+'</th></tr></tfoot></table></div></section>';
}
function distControls(plan){
 return '<section class="dist-panel dist-editor"><div class="dist-editor-head"><div><h3>Editar distribuição</h3><p>Escolha o total, os percentuais e os valores informados manualmente.</p></div><div class="dist-smallflag">Simulação / planejamento</div></div>'+
 '<form id="distForm"><div class="dist-total-field"><label for="distTotal">Valor total a distribuir (R$)</label><input id="distTotal" name="total" type="number" inputmode="decimal" min="0" max="100000000" step="0.01" value="'+plan.total+'" required></div>'+
 '<div class="dist-input-table"><div class="dist-input-head"><span>Categoria</span><span>Percentual %</span><span>Informado como enviado (R$)</span><span></span></div><div id="distRows">'+
 plan.rows.map((r,i)=>distEditRow(r,i)).join('')+'</div></div>'+
 '<div class="dist-form-actions"><span id="distPctSum">Total: '+plan.rows.reduce((a,r)=>a+Number(r.percentage),0).toLocaleString('pt-BR')+'%</span><div class="dist-actions"><button class="btn-lite" id="distAdd" type="button">+ Categoria</button><button class="btn-lite" id="distPreview" type="button">Atualizar gráficos</button><button class="btn" type="submit">Salvar meu planejamento</button></div></div></form>'+
 '<p class="dist-info">“Informado como enviado” é um registro manual da pessoa. Não confirma transferência, Pix, depósito ou pagamento.</p></section>';
}
function distEditRow(r,i){
 return '<div class="dist-edit-row" data-dist-row="'+i+'"><input name="name" type="text" maxlength="40" minlength="2" aria-label="Nome da categoria" value="'+distSafe(r.name)+'" required>'+
 '<input name="percentage" type="number" min="0" max="100" step="0.01" aria-label="Percentual" value="'+r.percentage+'" required>'+
 '<input name="reported_sent" type="number" min="0" step="0.01" aria-label="Enviado informado manualmente" value="'+r.reported_sent+'" required>'+
 '<button class="dist-remove" type="button" data-dist-remove="'+i+'" aria-label="Remover categoria">×</button></div>';
}
function distFormData(){
 const form=$('#distForm'),items=[...form.querySelectorAll('.dist-edit-row')].map(n=>{
  return {name:n.querySelector('[name=name]').value.trim(),percentage:n.querySelector('[name=percentage]').value,
    reported_sent:n.querySelector('[name=reported_sent]').value};
 });
 return {total:form.querySelector('[name=total]').value,rows:items};
}
function distPlot(d){
 $('#distCards').innerHTML=distChartCards(d);
 $('#distCharts').innerHTML=distDonut(d)+distCompare(d)+distBubbles(d);
 $('#distTable').innerHTML=distTable(d);
 $('#distCSV').onclick=()=>distExport(d);
}
function distExport(d){
 const rows=[['Categoria','Percentual','Valor previsto','Enviado informado','Pendente'],
  ...d.rows.map(r=>[r.name,r.percentage,r.planned,r.reported_sent,r.pending]),
  ['TOTAL',100,d.total,d.reported_sent,d.pending]];
 const cell=v=>{let s=String(v??'');if(/^[=+@\-\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'};
 const csv='\ufeff'+rows.map(row=>row.map(cell).join(';')).join('\r\n');
 const file=new Blob([csv],{type:'text/csv;charset=utf-8'}),link=URL.createObjectURL(file),a=document.createElement('a');
 a.href=link;a.download='novagente_distribuicao_planejada.csv';a.click();setTimeout(()=>URL.revokeObjectURL(link),1200);
}
function distLabel(saved,mode){
 if(mode==='sample')return '<span class="dist-sample-tag">EXEMPLO ILUSTRATIVO · sem envios reais</span>';
 if(!saved)return '<span class="dist-sample-tag">MODELO INICIAL · não salvo</span>';
 return '<span class="dist-live-tag">PLANEJAMENTO SALVO · declaração manual</span>';
}
async function distPage(){
 let apiData=await request('distribution-plan');
 distSaved=distFromApi(apiData);
 distPlan=distSaved;
 distMode=apiData.saved?'saved':'example';
 let calculated=distPreview(distPlan);
 $('#body').innerHTML='<div class="dist-wrap">'+
 '<div class="dist-header"><div><div class="eyebrow">CLUBE DO MOTORISTA · PAINEL DE APRESENTAÇÃO</div><h2>Distribuição de Valores</h2><p class="muted">Percentuais, valores previstos, informados e pendentes em gráficos inspirados nos modelos circulares.</p></div><div class="dist-toolbar"><button type="button" class="btn-lite" id="distLoadSample">Ver exemplo</button><button type="button" class="btn-lite" id="distRestore">Meu plano</button><button type="button" class="btn-lite" id="distPrint">Imprimir / PDF</button></div></div>'+
 '<div class="dist-status" id="distStatus">'+distLabel(apiData.saved,distMode)+'</div>'+
 '<div id="distCards"></div><div id="distCharts" class="dist-charts"></div><div id="distTable"></div><div id="distEditor">'+distControls(distPlan)+'</div>'+
 '<div class="notice">Os valores informados como enviados são <b>declarações manuais</b>, não transações verificadas. O sistema não faz pagamentos nem envia mensagens. O gestor tem um plano de demonstração próprio; não vê automaticamente o plano dos motoristas.</div></div>';
 distPlot(calculated);
 function rebind(){
  $('#distForm').onsubmit=async e=>{
   e.preventDefault();
   try{
    let payload=distFormData(),d=distPreview(payload);
    if(distMode==='sample' && !confirm('Este é um EXEMPLO ilustrativo. Deseja salvar esses valores como declarações manuais no seu planejamento?'))return;
    let saved=await request('distribution-plan',payload,'PUT');
    distSaved=distFromApi(saved);distPlan=distSaved;distMode='saved';apiData.saved=true;distPlot(saved);
    $('#distStatus').innerHTML=distLabel(true,distMode);
    msg('Planejamento salvo. Nenhuma transferência foi realizada.');
   }catch(err){msg(err.message)}
  };
  $('#distPreview').onclick=()=>{
   try{distPlan=distFormData();distPlot(distPreview(distPlan));$('#distStatus').innerHTML='<span class="dist-sample-tag">PRÉVIA NÃO SALVA · simulação</span>';msg('Gráficos atualizados, sem alterar registros.')}
   catch(err){msg(err.message)}
  };
  $('#distAdd').onclick=()=>{
   let rows=$('#distRows');if(rows.children.length>=8)return msg('Limite de oito categorias.');
   rows.insertAdjacentHTML('beforeend',distEditRow({name:'Nova categoria',percentage:0,reported_sent:0},rows.children.length));
   distReindex();distSum();
  };
  $('#distRows').onclick=e=>{let b=e.target.closest('[data-dist-remove]');if(!b)return;if($('#distRows').children.length<=2)return msg('Mantenha pelo menos duas categorias.');b.closest('.dist-edit-row').remove();distReindex();distSum()};
  $('#distForm').addEventListener('input',distSum);
  distSum();
 }
 function distSum(){
  let values=[...$('#distRows').querySelectorAll('[name=percentage]')].map(el=>Number(el.value)||0);
  let sum=Math.round(values.reduce((a,b)=>a+b,0)*100)/100,el=$('#distPctSum');
  el.textContent='Total dos percentuais: '+sum.toLocaleString('pt-BR')+'%'+(sum===100?' ✓':' (ajuste para 100%)');
  el.classList.toggle('dist-error',sum!==100);
 }
 function distReindex(){
  [...$('#distRows').children].forEach((n,i)=>{n.dataset.distRow=i;n.querySelector('[data-dist-remove]').dataset.distRemove=i});
 }
 $('#distLoadSample').onclick=()=>{
  distPlan=distSample();distMode='sample';
  $('#distEditor').innerHTML=distControls(distPlan);rebind();distPlot(distPreview(distPlan));$('#distStatus').innerHTML=distLabel(false,'sample');
  msg('Exemplo visual carregado. Os valores são fictícios.');
 };
 $('#distRestore').onclick=()=>{
  distPlan=structuredClone(distSaved);distMode=apiData.saved?'saved':'example';
  $('#distEditor').innerHTML=distControls(distPlan);rebind();distPlot(distPreview(distPlan));$('#distStatus').innerHTML=distLabel(apiData.saved,distMode);
 };
 $('#distPrint').onclick=()=>window.print();
 rebind();
}
