const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('static/security-stage3-v5.js','utf8');
const elements=new Map();
function node(id){if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'',onsubmit:null,onclick:null,appendChild:()=>{},querySelector:()=>({disabled:false})});return elements.get(id)}
const responses={
 'security/mfa':{enabled:false,pending:false,recovery_codes_remaining:0},
 'security/readiness':{admin_mfa_active:false,local_checks:{checked_at_utc:'2026-10-21T03:00:00',status:'healthy',backup_age_hours:1},external_backup_verified:false,custom_domain_verified:false,privacy_legal_approved:false,external_security_assessment_completed:false}
};
const globals={settings:async()=>{},user:{role:'admin'},document:{getElementById:node,createElement:()=>({className:'',id:'',innerHTML:'',appendChild:()=>{}})},
 request:async p=>{if(!responses[p])throw Error('Unexpected mock '+p);return responses[p]},
 safe:x=>String(x||''),console,confirm:()=>false,msg:()=>{},navigator:{clipboard:{writeText:async()=>{}}},
};
const context=vm.createContext(globals);
const api=vm.runInContext(source+'\n({stage3MfaReload,stage3Readiness})',context);
(async()=>{
 await api.stage3MfaReload();
 assert(node('s3MfaBody').innerHTML.includes('Configurar autenticador'));
 console.log('Admin MFA disabled renders explicit opt-in enrollment: PASS');
 await api.stage3Readiness();
 assert(node('s3Readiness').innerHTML.includes('Pendente'));
 assert(node('s3Readiness').innerHTML.includes('Aplicação, banco e backup local'));
 console.log('Readiness accurately shows completed and pending items: PASS');
 responses['security/mfa']={enabled:true,pending:false,recovery_codes_remaining:6};
 await api.stage3MfaReload();
 assert(node('s3MfaBody').innerHTML.includes('Segundo fator ativado'));
 console.log('Active MFA renders remaining recovery codes: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});