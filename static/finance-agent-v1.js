'use strict';
/* NOVAGENTE Agente Financeiro V1: preview antes de lançar, opt-in explícito. */
dm.splice(4,0,['finance-agent','Agente financeiro']);
const prevFinancialRender=render;
render=async function(){
 if(user && user.role==='driver' && tab==='finance-agent'){
  nav();
  try{await financeAgentScreen()}
  catch(err){document.getElementById('body').innerHTML='<section class="card"><h3>Falha ao abrir o agente</h3>'+safe(err.message)+'</section>'}
  return;
 }
 await prevFinancialRender();
};
const prevFinancialSettings=settings;
settings=async function(){
 await prevFinancialSettings();
 if(user&&user.role==='admin'&&!user.must_change)await financeAgentProviderSettings();
};
const agentCategoryNames=['Combustível','Supermercado','Farmácia','Manutenção do veículo','Alimentação fora','Transporte','Casa e contas','Educação','Lazer e compras pessoais','Outros / a confirmar','Outros','APLICATIVO','OUTROS','Corridas','Outras receitas'];
const financialEssence={trabalho:'Usado para trabalhar',essencial:'Essencial',opcional:'Opcional',misto:'Compra mista',a_confirmar:'Precisa confirmar',trabalho_ou_pessoal:'Trabalho ou pessoal?',essencial_ou_pessoal:'Essencial ou pessoal?',essencial_ou_opcional:'Depende do objetivo',variavel:'Variável',receita:'Receita'};
let agentLastSuggestion=null;
function moneyAgent(v){return v==null?'A confirmar':brl(v)}
function sanitizeRadioChoice(v){return !!v?'checked':''}
function agentSummaryCard(p){
 const items=p.items||[];
 return '<div class="card fin-agent-preview"><div class="eyebrow">LEITURA SUGERIDA — CONFIRME OS DADOS</div>'+
 '<div class="s2-metrics">'+[
 ['Valor encontrado',moneyAgent(p.amount)],['Categoria',p.category||'A confirmar'],['Natureza',financialEssence[p.nature]||p.nature||'A confirmar']
 ].map(([label,val])=>'<div class="s2-metric"><span class="s2-kicker">'+safe(label)+'</span><strong>'+safe(val)+'</strong></div>').join('')+'</div>'+
 (p.source==="audio"?'<div class="notice warn"><b>Audio transcrito automaticamente:</b> '+safe(p.summary||"Nao compreendido")+'. Confira especialmente o valor antes de registrar.</div>':'')+
 '<div class="notice">O agente pode errar, especialmente em fotos com vários itens ou audios com ruido. Você decide como registrar. Não é avaliação moral do gasto.</div>'+
 (items.length?'<h4>Itens encontrados na imagem</h4><div class="scroll"><table><thead><tr><th>Item</th><th>Valor</th><th>Natureza</th></tr></thead><tbody>'+
 items.map(x=>'<tr><td>'+safe(x.name)+'</td><td>'+safe(moneyAgent(x.amount))+'</td><td>'+safe(financialEssence[x.nature]||x.nature)+'</td></tr>').join('')+'</tbody></table></div>':'')+
 '<form id="finAgentConfirm" class="stack"><div class="fields">'+
 '<div><label>Entrada ou despesa</label><select name="kind"><option value="expense" '+(p.kind==='expense'?'selected':'')+'>Despesa</option><option value="income" '+(p.kind==='income'?'selected':'')+'>Entrada</option></select></div>'+
 '<div><label>Valor (R$)</label><input type="number" min="0.01" step="0.01" max="1000000" required name="amount" value="'+safe(p.amount??'')+'"></div>'+
 '<div><label>Categoria</label><select name="category">'+agentCategoryNames.map(x=>'<option value="'+safe(x)+'" '+(p.category===x?'selected':'')+'>'+safe(x)+'</option>').join('')+'</select></div>'+
 '<div><label>Data</label><input name="date" type="date" value="'+safe(p.date||new Date().toISOString().slice(0,10))+'"></div></div>'+
 '<div><label>Descrição opcional</label><textarea name="note" maxlength="200">'+safe(p.summary||'')+'</textarea></div>'+
 '<div class="row"><button class="btn" type="submit">Confirmar e registrar no meu financeiro</button>'+
 '<button type="button" class="btn-lite" id="finAgentDiscard">Descartar sugestão</button></div></form></div>';
}
function onPreview(result){
 agentLastSuggestion=result;
 const holder=document.getElementById('finAgentPreview');
 if(!holder)return;
 holder.innerHTML=agentSummaryCard(result.proposal);
 holder.scrollIntoView({behavior:'smooth',block:'start'});
 const form=document.getElementById('finAgentConfirm');
 form.onsubmit=async event=>{
  event.preventDefault();const f=new FormData(form),btn=form.querySelector('[type=submit]');btn.disabled=true;
  const payload={kind:f.get('kind'),amount:f.get('amount'),category:f.get('category'),
    note:f.get('note'),date:f.get('date')};
  try{
   await request('finance-agent/proposals/'+result.id+'/confirm',payload);
   agentLastSuggestion=null;msg('Despesa/entrada registrada após sua confirmação.');await financeAgentScreen();
  }catch(err){msg(err.message);btn.disabled=false}
 };
 document.getElementById('finAgentDiscard').onclick=async()=>{
  try{await request('finance-agent/proposals/'+result.id+'/discard',{});agentLastSuggestion=null;msg('Sugestão descartada');await financeAgentScreen()}
  catch(err){msg(err.message)}
 };
}
function consentRow(name,copy,checked){
 return '<label class="fin-agent-consent"><input type="checkbox" name="'+safe(name)+'" '+sanitizeRadioChoice(checked)+'><span>'+safe(copy)+'</span></label>';
}
async function financeAgentScreen(){
 const [c,list,link,release]=await Promise.all([request('finance-agent/consent'),request('finance-agent/proposals'),request('finance-agent/whatsapp/link-status'),request('finance-agent/release')]);
 const options=c.options;
 // One-contact pilot can see the paired WAHA session, without gaining admin access.
 let driverWhatsApp=null;
 if(link.pilot_allowed){
  try{driverWhatsApp=await request('finance-agent/whatsapp/session-status')}
  catch(err){driverWhatsApp={connected:false,status:'VERIFICAÇÃO INDISPONÍVEL'}}
 }
 let trends=null;
 if(options.enabled&&options.trends){
  try{trends=await request('finance-agent/insights')}catch(err){msg(err.message)}
 }
 const available=!!options.enabled && release.available;
 let limits=null;
 if(available){
  try{limits=await request('finance-agent/limits')}catch(err){/* optional limits display */}
 }
 const quotaHtml=limits?'<div class="fin-agent-quotas"><b>Seu uso hoje</b><div>'+
  [['IA de texto','text_ai'],['Áudios','audio'],['Fotos','image']].map(([label,key])=>
   '<span class="fin-agent-quotaitem">'+safe(label)+': <strong>'+
   safe(limits.remaining[key])+' de '+safe(limits.limits[key])+'</strong> disponíveis</span>').join('')+
  '</div><p>Registros simples, respostas fora do assunto e consultas no sistema não gastam franquia de IA. O limite renova à meia-noite de Porto Velho.</p></div>':'';
 document.getElementById('body').innerHTML=heading('Meu agente financeiro','Registre gastos por texto, foto ou áudio, confirme cada sugestão e acompanhe oportunidades de economia.')+
 '<div class="fin-agent-head"><div><b>Primeiro entenda, depois economize.</b><p>O agente não classifica um gasto como errado. Ele ajuda você a observar escolhas, separar trabalho e vida pessoal e decidir onde faz sentido economizar.</p></div><span class="s2-status '+(available?'s2-status-approved':'s2-status-pending')+'">'+(release.available?(available?'Ativado por você':'Aguardando autorização'):'Pausado pelo Clube')+'</span></div>'+quotaHtml+
 '<section class="card fin-agent-consent-box"><h3>Suas escolhas de privacidade</h3><p class="muted">As permissões são independentes, podem ser retiradas e começam desligadas. O modelo de IA só recebe mídias que você enviar voluntariamente.</p>'+
 '<form id="finAgentChoices" class="stack">'+
 consentRow('enabled','Quero usar o agente para analisar e organizar meus registros financeiros.',!!options.enabled)+
 consentRow('text_ai','Autorizo processar minhas mensagens de texto no DeepSeek para interpretacao financeira.',!!options.text_ai)+
 consentRow('media_ai','Autorizo a leitura das minhas fotos pelo DeepSeek e a transcricao de audios com Whisper na VPS; somente o texto transcrito seguira para interpretacao financeira pelo DeepSeek.',!!options.media_ai)+
 consentRow('trends','Autorizo o agente a analisar meus lançamentos para sugerir melhorias financeiras e acompanhar meus padrões de gastos.',!!options.trends)+
 consentRow('offers','Autorizo, futuramente, recomendações personalizadas de produtos e descontos com base nos meus dados; nenhuma oferta é ativada agora.',!!options.offers)+
 '<button class="btn-lite" type="submit">Salvar minhas autorizações</button></form></section>'+
 (available?
 '<section class="card fin-agent-message"><h3>Conte uma movimentação</h3><p class="muted">Ex.: “Gastei R$ 83 de combustível rodando na Uber” ou “Comprei R$ 140 no supermercado”.</p>'+
 '<form id="finAgentText" class="stack"><textarea name="text" maxlength="1500" rows="3" required placeholder="Digite o que recebeu ou gastou..."></textarea>'+
 '<p class="muted">Sou seu copiloto de finanças: outros assuntos recebem uma resposta curta, sem consumir IA.</p>'+
 '<button class="btn" type="submit">Analisar mensagem</button></form>'+
 '<div class="fin-agent-upload"><h4>Envie uma foto ou audio de movimentacao</h4>'+
 (options.media_ai?'<form id="finAgentMedia" class="row"><input type="file" name="file" accept="image/png,image/jpeg,image/webp,audio/ogg,audio/mpeg,audio/wav,audio/mp4" required>'+
 '<button class="btn-lite" type="submit">Interpretar arquivo</button></form>':
 '<div class="notice">Para analisar fotos ou audios, marque a autorizacao de processamento multimodal acima. Também é necessária uma chave de provedor configurada pelo gestor.</div>')+
 '<p class="muted">Fotos de notas e recibos ou audios de voz ate 7 MB. Whisper local transcreve audio de ate 90 segundos. Confira sempre a leitura. Não envie cartão bancário, senhas ou documentos pessoais.</p></div></section>'+
 '<div id="finAgentPreview"></div>':
 '<div class="notice warn">'+(release.available?'Para começar, autorize o uso do agente e salve suas escolhas.':'O agente está temporariamente pausado para manutenção. Seus registros anteriores permanecem disponíveis.')+'</div>')+
 (trends?'<section class="card"><h3>Meu dinheiro por categoria</h3><p class="muted">Movimentações manuais e confirmadas, sem acesso à conta bancária.</p>'+
 '<div class="s2-metrics">'+[['Gastos neste mês',moneyAgent(trends.total)],['Categorias registradas',Object.keys(trends.expenses).length]].map(([label,val])=>
 '<div class="s2-metric"><span class="s2-kicker">'+safe(label)+'</span><strong>'+safe(val)+'</strong></div>').join('')+'</div>'+
 '<div class="fin-agent-advice">'+trends.advice.map(a=>'<p>'+safe(a)+'</p>').join('')+'</div>'+
 '<div class="scroll"><table><tr><th>Categoria</th><th>Gasto no mês</th><th>Mês anterior</th></tr>'+
 Object.entries(trends.expenses).map(([k,v])=>'<tr><td>'+safe(k)+'</td><td>'+safe(moneyAgent(v))+'</td><td>'+safe(moneyAgent(trends.last_month[k]||0))+'</td></tr>').join('')+'</table></div></section>':'')+
 '<section class="card"><h3>Minhas sugestões e confirmações</h3>'+ (list.items.length?'<div class="scroll"><table><thead><tr><th>Origem</th><th>Resumo</th><th>Valor</th><th>Estado</th><th></th></tr></thead><tbody>'+
 list.items.map(x=>'<tr><td>'+safe(x.origin)+'</td><td>'+safe(x.proposal.category)+' · '+safe(x.proposal.summary).slice(0,70)+'</td><td>'+safe(moneyAgent(x.proposal.amount))+'</td><td>'+safe(x.status==='pending'?'Aguardando confirmação':x.status==='confirmed'?'Registrada':'Descartada')+'</td><td>'+(x.status==='pending'&&available?'<button type="button" class="btn-lite btn-sm" data-agent-resume="'+x.id+'">Revisar</button>':'')+'</td></tr>').join('')+'</tbody></table></div>':stage2Empty('Ainda não há sugestões.'))+'</section>'+
 '<section class="card fin-agent-whatsapp"><h3>Meu WhatsApp e o agente</h3>'+
 (link.pilot_allowed?'<div class="notice"><b>Conexão do WhatsApp do Clube:</b> '+
   (driverWhatsApp&&driverWhatsApp.connected?'✅ Pareado e conectado (WORKING)':
     'Aguardando conexão — '+safe(driverWhatsApp?driverWhatsApp.status:'verificação pendente'))+
   '<br><b>WhatsApp do Clube — DESTINO:</b> '+(driverWhatsApp&&driverWhatsApp.club_whatsapp_number?
      '<strong>+'+safe(driverWhatsApp.club_whatsapp_number)+'</strong>':'Confira o número da conta pareada no telefone')+
   '<br><b>Seu número de teste — REMETENTE:</b> '+(link.linked?'Vinculado':'Ainda não vinculado')+
   '<br><span class="muted">Envie a mensagem de VINCULAR de OUTRA conta WhatsApp PARA o número do Clube exibido acima. Se enviar pelo WhatsApp do Clube, a mensagem é ignorada.</span></div>'+
   '<button type="button" class="btn-lite btn-sm" id="finAgentCheckSession">Atualizar estado da conexão</button>':'')+
 (link.linked?'<div class="notice"><b>WhatsApp vinculado.</b> Você pode desligar o vínculo quando quiser. As sugestões recebidas continuam dependendo da sua confirmação.</div><button id="finAgentUnlink" class="btn-lite btn-red">Desvincular meu WhatsApp</button>':
 (link.webhook_enabled&&link.pilot_allowed)?'<div class="notice"><b>1. Gere seu código de vinculação.</b> '+
   (link.code_active?'Você já gerou um código, válido por aproximadamente '+safe(link.code_minutes_remaining)+' minutos. Se não o copiou, gere outro.':'Ainda não existe código de vínculo ativo para sua conta.')+
   '<br><b>2. Copie a mensagem completa</b> e envie de um <b>outro número de WhatsApp</b> PARA o número do Clube mostrado acima. Não envie a partir da própria conta pareada: mensagens enviadas pelo Clube são ignoradas para evitar respostas a si mesmo.'+
   '<br><b>3. Confira o vínculo</b> aqui depois de enviar. Não precisa escanear outro QR Code.</div>'+
   '<button type="button" id="finAgentMakeCode" class="btn-lite">1. Gerar novo código</button>'+
   '<button type="button" id="finAgentCheckLink" class="btn-lite">3. Já enviei: verificar vínculo</button>'+
   '<div id="finAgentCode" role="status" aria-live="polite"></div>':
 '<div class="notice warn">'+(link.webhook_enabled?'O piloto do WhatsApp está reservado a uma única conta de motorista autorizada. Continue usando o agente aqui no sistema.':'O WhatsApp do Clube está preparado, mas a recepção automática ainda não foi ativada.')+'</div>')+
 '<p class="muted">'+(link.messages_sent?'Piloto ativado para seu número vinculado. Para registrar no financeiro, responda CONFIRMAR seguido do número da sugestão.':'Nenhuma mensagem é enviada a números que não passaram pela vinculação individual. O agente não acessa outras conversas ou contatos.')+'</p></section>';
 document.getElementById('finAgentChoices').onsubmit=async event=>{
  event.preventDefault();let form=new FormData(event.target);
  const updated={enabled:form.has('enabled'),media_ai:form.has('media_ai'),
                trends:form.has('trends'),offers:form.has('offers'),text_ai:form.has('text_ai')};
  try{await request('finance-agent/consent',updated,'PUT');msg('Suas escolhas foram salvas');await financeAgentScreen()}
  catch(err){msg(err.message)}
 };
 let text=document.getElementById('finAgentText');
 if(text)text.onsubmit=async event=>{
  event.preventDefault();let btn=text.querySelector('[type=submit]');btn.disabled=true;
  try{let result=await request('finance-agent/text',{text:new FormData(text).get('text')});
   if(result.reply){
    agentLastSuggestion=null;
    const holder=document.getElementById('finAgentPreview');
    if(holder)holder.innerHTML='<section class="card fin-agent-reply" role="status"><b>Seu copiloto financeiro</b><p>'+safe(result.reply)+'</p><small>Resposta pronta · não consumiu IA nem registrou despesa</small></section>';
   }else{
    msg('Leitura gerada. Revise antes de salvar.');onPreview(result);
   }
  }catch(err){msg(err.message)}finally{btn.disabled=false}
 };
 let media=document.getElementById('finAgentMedia');
 if(media)media.onsubmit=async event=>{
  event.preventDefault();let btn=media.querySelector('[type=submit]');btn.disabled=true;
  try{let data=new FormData(media);let result=await fetch('/api/finance-agent/media',{
   method:'POST',credentials:'same-origin',headers:{'X-Requested-With':'NOVAGENTE-V5'},body:data});
   const response=await result.json();if(!result.ok)throw Error(response.detail||'Falha na leitura');
   msg('Leitura de mídia concluída, revise os detalhes.');onPreview(response);
  }catch(err){msg(err.message)}finally{btn.disabled=false}
 };
 const sessionRefresh=document.getElementById('finAgentCheckSession');
 if(sessionRefresh)sessionRefresh.onclick=async()=>{
  sessionRefresh.disabled=true;
  try{await financeAgentScreen();msg('Estado da conexão atualizado.')}
  catch(err){msg(err.message);sessionRefresh.disabled=false}
 };
 const checkLinkButton=document.getElementById('finAgentCheckLink');
 if(checkLinkButton)checkLinkButton.onclick=async()=>{
  checkLinkButton.disabled=true;
  try{
   const status=await request('finance-agent/whatsapp/link-status');
   if(status.linked){msg('WhatsApp vinculado!');await financeAgentScreen()}
   else{
    const feedback=document.getElementById('finAgentCode');
    if(feedback)feedback.innerHTML='<div class="notice warn"><b>Seu número ainda não foi vinculado.</b> '+
      (status.code_active?'Existe um código ativo. Verifique se enviou a mensagem completa de outro WhatsApp para o número do Clube.':'Nenhum código ativo. Clique em Gerar novo código e copie a mensagem completa.')+
      '</div>';
   }
  }catch(err){msg(err.message)}finally{checkLinkButton.disabled=false}
 };
 const linkButton=document.getElementById('finAgentMakeCode');
 if(linkButton)linkButton.onclick=async()=>{
  linkButton.disabled=true;
  const output=document.getElementById('finAgentCode');
  if(output)output.innerHTML='<div class="notice">Gerando código de teste...</div>';
  try{
   const r=await request('finance-agent/whatsapp/link-code',{});
   const message='VINCULAR '+r.code;
   if(output){
    output.innerHTML='<div class="notice"><b>✅ Código gerado!</b> Copie a mensagem abaixo e envie de OUTRO WhatsApp para o número pareado do Clube. O código vence em 15 minutos.'+
     '<input id="finAgentMessageToCopy" aria-label="Mensagem para vincular o WhatsApp" type="text" readonly value="'+safe(message)+'">'+
     '<button type="button" class="btn-lite" id="finAgentCopyMessage">2. Copiar mensagem</button>'+
     '<p class="muted">Não compartilhe este código publicamente. Depois de enviar, clique em “Já enviei: verificar vínculo”.</p></div>';
    const copy=document.getElementById('finAgentCopyMessage');
    copy.onclick=async()=>{
     try{await navigator.clipboard.writeText(message);msg('Mensagem copiada. Agora envie pelo outro WhatsApp.')}
     catch(err){
      const field=document.getElementById('finAgentMessageToCopy');
      if(field){field.focus();field.select()}
      msg('Selecione o texto e copie manualmente.');
     }
    };
   }
  }catch(err){
   if(output)output.innerHTML='<div class="notice warn"><b>Não consegui gerar o código:</b> '+safe(err.message)+'</div>';
   msg('Falha ao gerar o código');
  }finally{linkButton.disabled=false}
 };
 const unlinkButton=document.getElementById('finAgentUnlink');
 if(unlinkButton)unlinkButton.onclick=async()=>{
  if(!confirm('Desvincular seu WhatsApp deste cadastro?'))return;
  try{await request('finance-agent/whatsapp/link',undefined,'DELETE');msg('WhatsApp desvinculado');await financeAgentScreen()}
  catch(err){msg(err.message)}
 };
 document.querySelectorAll('[data-agent-resume]').forEach(el=>{
  el.onclick=()=>{let found=list.items.find(x=>String(x.id)===el.dataset.agentResume);
   if(found)onPreview({id:found.id,proposal:found.proposal})};
 });
}
async function financeAgentProviderSettings(){
 const [status,whats]=await Promise.all([request('admin/finance-agent/provider'),request('admin/finance-agent/whatsapp')]);
 const area=document.getElementById('body');
 if(!area)return;
 const container=document.createElement('section');
 container.className='card fin-agent-provider';
 container.innerHTML='<h3>Agente financeiro · DeepSeek Flash V4.1</h3>'+
 '<p class="muted">Até 20 análises difíceis de texto com IA por motorista/dia; 5 áudios e 5 fotos. Registros fáceis e mensagens fora do escopo não chamam IA. Para interpretar fotos e textos com DeepSeek, cadastre a chave de API do projeto. Audio usa Whisper instalado na propria VPS, sem outra API; DeepSeek interpreta somente o texto transcrito. Cada motorista deve autorizar o processamento multimodal antes de enviar seus arquivos.</p>'+
 '<div class="notice"><b>Modelos:</b> DeepSeek V4.1 Flash (texto/fotos) + Whisper Base local (audios).'+
 ' <b>Chave configurada:</b> '+(status.key_set?'Sim':'Não')+'.</div>'+
 '<div class="notice warn"><b>WAHA:</b> '+(whats.enabled?'Recepção com HMAC habilitada.':'Recepção ainda desativada.')+
 ' Piloto exclusivo: '+(whats.pilot_armed?'Preparado':'Desligado')+
 '. Número-piloto vinculado: '+(whats.pilot_linked?'Sim':'Ainda não')+
 '. Respostas automáticas: '+(whats.outgoing_messages?'Somente para o número autorizado':'Aguardando vinculação')+
 '. Nenhuma mensagem será enviada aos demais motoristas.</div>'+
 '<form class="stack" id="finAgentProviderForm"><div><label>Chave API do DeepSeek (privada)</label><input type="password" name="api_key" autocomplete="off" required placeholder="Cole a chave do projeto"></div>'+
 '<div class="row"><button type="submit" class="btn">Salvar chave criptografada</button>'+
 (status.key_set?'<button type="button" class="btn-lite" id="finAgentCheck">Testar API</button><button type="button" class="btn-lite btn-red" id="finAgentProviderRemove">Remover chave</button>':'')+'</div></form>';
 area.appendChild(container);
 const form=document.getElementById('finAgentProviderForm');
 form.onsubmit=async e=>{
  e.preventDefault();let key=new FormData(form).get('api_key');
  try{await request('admin/finance-agent/provider',{api_key:key},'PUT');msg('Chave DeepSeek salva criptografada');await settings()}
  catch(err){msg(err.message)}
 };
 let chk=document.getElementById('finAgentCheck');
 if(chk)chk.onclick=async()=>{
  chk.disabled=true;
  try{
   const result=await request('admin/finance-agent/provider/check',{});
   msg('DeepSeek conectado: '+result.model+(result.vision?' · imagens disponiveis':''));
  }catch(err){msg(err.message)}
  finally{chk.disabled=false}
 };
 let rem=document.getElementById('finAgentProviderRemove');
 if(rem)rem.onclick=async()=>{if(!confirm('Remover a chave de interpretação multimodal deste projeto?'))return;
  try{await request('admin/finance-agent/provider',undefined,'DELETE');msg('Chave removida');await settings()}
  catch(err){msg(err.message)}
 };
}
