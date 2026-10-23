'use strict';
/* Liberação do agente no portal — não altera consentimentos, WAHA ou Pix. */
am.splice(2,0,['agent-manage','Agente financeiro']);
const releasePreviousRender=render;
render=async function(){
 if(user && user.role==='admin' && tab==='agent-manage'){
  nav();
  try{await releaseAdminScreen()}
  catch(err){const view=document.getElementById('body');if(view)view.innerHTML='<section class="card"><h3>Não foi possível abrir o painel do agente</h3><p>'+safe(err.message)+'</p></section>'}
  return;
 }
 return releasePreviousRender();
};
const releasePreviousDriverHome=driverHome;
driverHome=async function(){
 await releasePreviousDriverHome();
 if(!user||user.role!=='driver')return;
 try{
  const release=await request('finance-agent/release');
  const home=document.getElementById('body');
  if(!home||tab!=='home')return;
  const card=document.createElement('section');
  card.className='card agent-launch-card';
  card.innerHTML=
   '<div class="agent-launch-grid"><div>'+
   '<div class="eyebrow">CLUBE DO MOTORISTA · ASSISTENTE FINANCEIRO</div>'+
   '<h3>Converse com seu dinheiro. Entenda seus gastos.</h3>'+
   '<p>Conte quanto ganhou, mande a foto de um cupom ou um áudio. O agente sugere a categoria e ajuda a encontrar oportunidades de economia. Nada será salvo sem sua confirmação.</p>'+
   '<div class="row"><span class="s2-status '+(release.available?'s2-status-approved':'s2-status-pending')+'">'+
   (release.available?(release.consent_needed?'Disponível para ativação':'Seu agente está disponível'):'Temporariamente pausado')+
   '</span><span class="agent-launch-chip">Texto · Fotos · Áudio</span></div>'+
   '<div class="agent-launch-buttons"><button class="btn" id="agentOpenOnHome" type="button" '+(!release.available?'disabled':'')+'>'+
   (release.consent_needed?'Conhecer e ativar meu agente':'Abrir meu agente financeiro')+'</button></div></div>'+
   '<div class="agent-launch-symbol" aria-hidden="true">R$ <span>↗</span></div></div>';
  const marker=home.querySelector?home.querySelector('.grid'):null;
  if(marker)marker.insertAdjacentElement('beforebegin',card);
  else home.appendChild(card);
  const button=document.getElementById('agentOpenOnHome');
  if(button)button.onclick=()=>{tab='finance-agent';render()};
 }catch(err){/* Main financial dashboard must remain available even if optional rollout status fails. */}
};
async function releaseAdminScreen(){
 const [r,provider]=await Promise.all([
  request('admin/finance-agent/release'),request('admin/finance-agent/provider')
 ]);
 const element=document.getElementById('body');if(!element)return;
 const counters=[
  ['Motoristas ativos',r.active_drivers,'Contas aprovadas no Clube'],
  ['Autorizaram o agente',r.authorized_drivers,'Permissão individual concedida'],
  ['Autorizaram fotos e áudios',r.authorized_multimodal,'Permissão separada de mídia'],
  ['Aguardando confirmação',r.proposals.pending||0,'Sugestões, ainda não lançamentos'],
  ['Lançamentos confirmados',r.proposals.confirmed||0,'Confirmados pelo motorista'],
  ['Sugestões descartadas',r.proposals.discarded||0,'Sem impacto no financeiro']
 ];
 element.innerHTML=heading('Agente financeiro · Liberação','Disponibilize o agente dentro do Clube, acompanhe as autorizações e monitore o piloto.')+
 '<div class="agent-release-status '+(r.available?'agent-release-live':'agent-release-paused')+'"><div>'+
 '<div class="eyebrow">DISPONIBILIDADE NO PORTAL</div>'+
 '<h3>'+(r.available?'Agente liberado para os motoristas':'Agente pausado para manutenção')+'</h3>'+
 '<p>'+(r.available?'Motoristas ativos podem abrir o agente e decidir quais autorizações conceder. Nenhuma permissão é ativada automaticamente.':
 'O agente não aceitará novos lançamentos nem análises até ser reativado pelo gestor.')+'</p></div>'+
 '<button type="button" id="agentReleaseToggle" class="btn-lite '+(r.available?'btn-red':'')+'">'+
 (r.available?'Pausar agente':'Liberar agente no portal')+'</button></div>'+
 stage2Cards(counters)+
 '<div class="s2-dashboard-grid">'+
 '<section class="card"><h3>Recursos para o piloto</h3>'+
 '<div class="agent-release-feature"><span>Interpretar mensagens por texto</span><b>Disponível</b></div>'+
 '<div class="agent-release-feature"><span>DeepSeek V4.1 Flash (textos e fotos)</span><b>'+ (r.deepseek_ready?'Conectado':'A configurar')+'</b></div>'+
 '<div class="agent-release-feature"><span>Whisper local (transcrição de voz)</span><b>'+ (r.whisper_ready?'Disponível':'Indisponível')+'</b></div>'+
 '<div class="agent-release-feature"><span>Confirmação antes de registrar</span><b>Obrigatória</b></div>'+
 '<div class="agent-release-feature"><span>Ofertas personalizadas automáticas</span><b>Desligadas</b></div>'+
 '<div class="agent-release-feature"><span>WhatsApp automático</span><b>Desligado</b></div>'+
 '<div class="notice">O uso do agente não cria cobranças e não acessa contas bancárias. Os dados são separados por participante.</div></section>'+
 '<section class="card"><h3>Como o motorista começa</h3>'+
 '<div class="agent-release-steps"><p><b>1.</b> Entra com uma conta aprovada no Clube.</p>'+
 '<p><b>2.</b> Escolhe usar o agente e suas autorizações independentes.</p>'+
 '<p><b>3.</b> Informa uma movimentação por texto, áudio ou foto.</p>'+
 '<p><b>4.</b> Revisa e confirma a categoria e o valor.</p>'+
 '<p><b>5.</b> Acompanha seus gastos e recebe sugestões de economia quando autorizar.</p></div>'+
 '<button id="agentGoSettings" type="button" class="btn-lite">Ver configurações do DeepSeek</button>'+
 '</section></div>'+
 '<section class="card"><h3>Origem das sugestões</h3>'+
 (Object.keys(r.sources).length?stage2Bars(Object.entries(r.sources).map(([label,total])=>({label,total,shown:total})),'total'):
 stage2Empty('Nenhuma sugestão registrada ainda.'))+
 '<div class="notice warn">Disponibilização controlada: a análise de áudios precisa ser validada com gravações reais de teste, inclusive com ruído de trânsito. A liberação ao público em larga escala ainda depende da homologação jurídica e de segurança.</div></section>';
 const toggle=document.getElementById('agentReleaseToggle');
 toggle.onclick=async()=>{
  const next=!r.available;
  if(!confirm(next?'Liberar o agente no portal para motoristas ativos? As autorizações individuais continuarão necessárias.':
     'Pausar a análise de novas mensagens para todos os motoristas? Os registros anteriores serão preservados.'))return;
  toggle.disabled=true;
  try{
   await request('admin/finance-agent/release',{enabled:next},'PUT');
   msg(next?'Agente disponibilizado no portal.':'Agente pausado; registros preservados.');
   await releaseAdminScreen();
  }catch(err){msg(err.message);toggle.disabled=false}
 };
 document.getElementById('agentGoSettings').onclick=()=>{tab='settings';render()};
}
