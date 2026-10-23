'use strict';
/* Etapa 3: TOTP de administrador ativado por escolha do titular. */
const oldStage3Settings=settings;
settings=async function(){
 await oldStage3Settings();
 if(!user||user.role!=='admin'||user.must_change)return;
 const root=document.getElementById('body');if(!root)return;
 const pane=document.createElement('section');pane.id='mfaPane';pane.className='card s3-mfa-card';
 pane.innerHTML='<h3>Segurança do administrador · 2 etapas</h3><p class="muted">Proteja seu painel com um aplicativo autenticador, como Google Authenticator, Microsoft Authenticator ou outro compatível com TOTP. A ativação é opcional até a sua confirmação.</p>'+
 '<div id="s3MfaBody"><div class="notice">Carregando situação do segundo fator...</div></div>';
 root.appendChild(pane);
 const ready=document.createElement('section');ready.className='card s3-readiness';
 ready.innerHTML='<h3>Prontidão para publicação definitiva</h3><div id="s3Readiness">Verificando...</div>';
 root.appendChild(ready);
 await Promise.all([stage3MfaReload(),stage3Readiness()]);
};
async function stage3MfaReload(){
 let status;
 try{status=await request('security/mfa')}
 catch(err){document.getElementById('s3MfaBody').innerHTML='<div class="notice warn">'+safe(err.message)+'</div>';return}
 if(status.enabled){
  document.getElementById('s3MfaBody').innerHTML='<div class="notice"><b>Segundo fator ativado.</b> Nos próximos logins de administrador será obrigatório digitar o código do aplicativo autenticador, ou um código de recuperação. Códigos de recuperação restantes: <b>'+status.recovery_codes_remaining+'</b>.</div>'+
  '<details><summary>Desativar autenticação em duas etapas</summary><form class="stack" id="s3MfaDisable">'+
  '<div><label>Senha atual</label><input type="password" autocomplete="current-password" name="password" required></div>'+
  '<div><label>Código do aplicativo ou recuperação</label><input name="code" autocomplete="one-time-code" required></div>'+
  '<button type="submit" class="btn-lite btn-red">Desativar proteção</button></form></details>';
  const f=document.getElementById('s3MfaDisable');
  f.onsubmit=async e=>{e.preventDefault();if(!confirm('Desativar o segundo fator desta conta?'))return;
   let data=new FormData(f);
   try{await request('security/mfa/disable',{password:data.get('password'),code:String(data.get('code')).trim()});msg('Segundo fator desativado');await stage3MfaReload()}catch(err){msg(err.message)}
  };
 }else{
  document.getElementById('s3MfaBody').innerHTML='<div class="notice warn"><b>Segundo fator ainda não ativado.</b> Para usar o cadastro com dados pessoais em produção, recomendamos ativá-lo antes de convidar mais motoristas.</div>'+
  '<form id="s3MfaSetup" class="stack"><div><label>Confirme sua senha atual para iniciar</label><input type="password" name="password" autocomplete="current-password" required></div>'+
  '<button type="submit" class="btn">Configurar autenticador</button></form><div id="s3MfaSecret"></div>';
  const f=document.getElementById('s3MfaSetup');
  f.onsubmit=async e=>{
   e.preventDefault();
   const b=f.querySelector('[type=submit]');b.disabled=true;
   try{
    let d=await request('security/mfa/setup',{password:new FormData(f).get('password')});
    f.reset();
    document.getElementById('s3MfaSecret').innerHTML='<div class="s3-setup"><b>1. Adicione a chave no aplicativo autenticador</b>'+
     '<p class="muted">Escolha adicionar uma conta por chave manual. Tipo: baseada em horário (TOTP), seis dígitos. Esta chave vence para a configuração em dez minutos.</p>'+
     '<div><label>Chave de configuração — não compartilhe</label><input id="s3SetupKey" readonly autocomplete="off" value="'+safe(d.setup_key)+'"></div>'+
     '<b>2. Digite o código gerado pelo aplicativo</b>'+
     '<form id="s3MfaConfirm" class="stack"><input name="code" maxlength="6" minlength="6" pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code" placeholder="6 dígitos" required>'+
     '<button type="submit" class="btn">Confirmar e ativar a proteção</button></form></div>';
    document.getElementById('s3MfaConfirm').onsubmit=async ev=>{
     ev.preventDefault();
     const f2=ev.currentTarget,b2=f2.querySelector('button');b2.disabled=true;
     try{
      let result=await request('security/mfa/confirm',{code:new FormData(f2).get('code')});
      const recovery=result.recovery_codes.join('\n');
      // Codes only displayed once, not stored in localStorage.
      document.getElementById('s3MfaBody').innerHTML='<div class="notice"><b>Autenticação em duas etapas ativada!</b> Guarde estes oito códigos de recuperação em local privado. Eles não serão exibidos novamente.</div>'+
       '<textarea id="s3RecoveryCodes" readonly rows="9"></textarea><button type="button" id="s3CopyCodes" class="btn-lite">Copiar códigos de recuperação</button>'+
       '<div class="notice warn">Não envie os códigos por WhatsApp e não os guarde junto da senha da conta.</div>';
      document.getElementById('s3RecoveryCodes').value=recovery;
      document.getElementById('s3CopyCodes').onclick=async()=>{
       try{await navigator.clipboard.writeText(document.getElementById('s3RecoveryCodes').value);msg('Códigos copiados')}catch(err){msg('Selecione e copie os códigos manualmente')}
      };
      msg('Autenticação em duas etapas ativada.');
     }catch(err){msg(err.message);b2.disabled=false}
    };
   }catch(err){msg(err.message);b.disabled=false}
  };
 }
}

async function stage3Readiness(){
 const element=document.getElementById('s3Readiness');if(!element)return;
 try{
  const status=await request('security/readiness');
  const checks=[
   ['Aplicação, banco e backup local',status.local_checks.status==='healthy'],
   ['Autenticação em duas etapas do gestor',status.admin_mfa_active],
   ['Cópia de backup em outra infraestrutura',status.external_backup_verified],
   ['Domínio HTTPS definitivo',status.custom_domain_verified],
   ['Validação jurídica e política de privacidade',status.privacy_legal_approved],
   ['Avaliação independente de segurança',status.external_security_assessment_completed]
  ];
  element.innerHTML='<div class="s3-readiness-grid">'+checks.map(([label,ok])=>
   '<div class="s3-check-row"><span class="'+(ok?'s3-ok':'s3-pending')+'">'+(ok?'✓':'Pendente')+'</span><strong>'+safe(label)+'</strong></div>').join('')+'</div>'+
   '<p class="muted">Última verificação local: '+safe(status.local_checks.checked_at_utc||'Ainda não executada')+'. '+
   'Backup local mais recente: '+safe(status.local_checks.backup_age_hours??'indisponível')+' hora(s) atrás.</p>'+
   '<div class="notice warn">O sistema está disponível para testes controlados, mas ainda não foi homologado para lançamento público com dados pessoais reais em larga escala.</div>';
 }catch(err){element.textContent='Não foi possível consultar os critérios: '+err.message}
}
