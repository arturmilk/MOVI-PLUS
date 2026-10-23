"""WAHA inbound adapter - opt-in and strong binding, DISABLED until pilot approval.

WAHA 'message' event via HMAC-SHA512 and fresh timestamp; no polling, no outgoing
messages, no automatic WAHA registration. Only linked, opted-in direct contacts.
"""
import hashlib,hmac,json,re,secrets,time
from fastapi import APIRouter,Depends,Request,HTTPException
from app import db,driver,admin,now,enc,dec,audit,sha
from finance_agent_v1 import options,config,add_proposal,image_analyze,speech_to_text,read_mime,interpret_transcribed_audio,deepseek_text
from finance_agent_core import classify_text
from finance_agent_limits_v1 import route,OUT_OF_SCOPE,WELCOME,FINANCE_QUERY,reserve,complete,refund
from finance_agent_conversation_v2 import report_intent,month_data,report_text,looks_like_command,outside_text,say,is_uncertain,is_negative
from whatsapp_bridge_v5 import config_get,waha

router=APIRouter()
CHAT=re.compile(r"^[1-9][0-9]{9,20}@(c\.us|lid)$")
CODE=re.compile(r"^VINCULAR\s+([A-Za-z0-9_-]{10,24})$",re.I)
ONBOARDING_MESSAGE = '👋 *Boas-vindas ao Clube do Motorista!* 🚗💚\n\nEu sou seu *copiloto financeiro*. Estou aqui pra te ajudar a entender quanto entra, quanto sai e a cuidar melhor dos seus objetivos. Sem planilha e sem complicação!\n\n*Como me manter atualizado?*\nSempre que ganhar ou gastar, me conte por aqui:\n⛽ “Abasteci R$ 80 de gasolina”\n🛒 “Gastei R$ 120 no supermercado”\n🚗 “Ganhei R$ 250 nas corridas”\n\nEu mostro o que entendi e você responde naturalmente: *ok*, *sim*, *blza*, *top*... Se não estiver certo, diga o que corrigir. Só salvo depois que você aprovar.\n\nQuer acompanhar seu mês? Peça *“me manda meu relatório”* e eu te envio o resumo e, se houver registros confirmados, um minigráfico aqui mesmo. Fotos e áudios também têm autorização por mensagem.\n\n*Vamos começar?* Me conta sua primeira entrada ou despesa! 😊'
FILE_PATH=re.compile(r"^/api/files/[A-Za-z0-9._@%+-]{1,200}$")

def init(c):
 c.executescript("""
 CREATE TABLE IF NOT EXISTS finance_agent_wa_config(
   id INTEGER PRIMARY KEY CHECK(id=1),key_blob BLOB NOT NULL,
   enabled INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS finance_agent_link_codes(
   hash TEXT PRIMARY KEY,uid INTEGER REFERENCES users(id) ON DELETE CASCADE,
   expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS finance_agent_wa_links(
   phone_hash TEXT PRIMARY KEY,uid INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
   encrypted_chat BLOB NOT NULL,linked_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS finance_agent_wa_events(
   event_hash TEXT PRIMARY KEY,uid INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
   handled_at TEXT NOT NULL);
 """)
 c.commit()

with db() as c:init(c)

def private_settings(c):
 x=c.execute("SELECT key_blob,enabled FROM finance_agent_wa_config WHERE id=1").fetchone()
 if not x:return None,False
 return dec(x["key_blob"])["key"],bool(x["enabled"])

def link_hash(chat):
 return sha("clube-finance-waha:"+chat)

def issue_code(c,uid):
 c.execute("DELETE FROM finance_agent_link_codes WHERE uid=? OR expires<?",(uid,int(time.time())))
 code=secrets.token_urlsafe(11)
 c.execute("INSERT INTO finance_agent_link_codes(hash,uid,expires) VALUES(?,?,?)",
     (sha(code.upper()),uid,int(time.time())+900))
 return code

@router.post("/api/finance-agent/whatsapp/link-code")
def driver_link_code(u=Depends(driver)):
 with db() as c:
  from finance_agent_pilot_v1 import permitted
  if not permitted(c,u["id"]):
   raise HTTPException(403,"O WhatsApp está disponível somente para a conta motorista do piloto.")
  if not options(c,u["id"])["enabled"]:
   raise HTTPException(403,"Autorize o agente financeiro para solicitar vínculo.")
  code=issue_code(c,u["id"])
  audit(c,u["id"],"finance_agent:link_code_created");c.commit()
 return {"code":code,"minutes":15,
  "instructions":"Depois da habilitação do WhatsApp pelo gestor, envie VINCULAR seguido deste código ao número dedicado do Clube."}

@router.get("/api/finance-agent/whatsapp/link-status")
def driver_link_status(u=Depends(driver)):
 with db() as c:
  r=c.execute("SELECT linked_at FROM finance_agent_wa_links WHERE uid=?",(u["id"],)).fetchone()
  _,enabled=private_settings(c)
  from finance_agent_pilot_v1 import permitted
  pilot_allowed=permitted(c,u["id"])
  code=c.execute("SELECT MAX(expires) AS expires FROM finance_agent_link_codes WHERE uid=? AND expires>?",
    (u["id"],int(time.time()))).fetchone()
  expires=int(code["expires"]) if code and code["expires"] else 0
  minutes_remaining=max(0,(expires-int(time.time())+59)//60) if expires else 0
 return {"linked":bool(r),"linked_at":r["linked_at"] if r else None,"webhook_enabled":enabled,
         "pilot_allowed":pilot_allowed,"code_active":bool(expires),
         "code_minutes_remaining":minutes_remaining,
         "messages_sent":bool(r and enabled and pilot_allowed)}

@router.get("/api/finance-agent/whatsapp/session-status")
def driver_waha_session_status(u=Depends(driver)):
 """Read-only pairing status for the one authorized pilot driver, never admin secrets."""
 from whatsapp_bridge_v5 import config_get,waha,extract_status
 from finance_agent_pilot_v1 import permitted
 with db() as c:
  if not permitted(c,u["id"]):
   raise HTTPException(403,"A consulta da conexão WAHA é exclusiva do motorista do piloto.")
  cfg,_=config_get(c)
  linked=bool(c.execute("SELECT 1 FROM finance_agent_wa_links WHERE uid=?",(u["id"],)).fetchone())
  _,inbound=private_settings(c)
 if not cfg:
  return {"eligible":True,"connected":False,"status":"NAO_CONFIGURADA",
          "linked":linked,"pilot_receiving":inbound,
          "next_step":"A instância WAHA precisa ser configurada pelo gestor."}
 try:
  response,code=waha(cfg,"GET","/api/sessions/"+cfg["session"])
  info=response.json() if code!=404 else {}
  result=extract_status(info) if code!=404 else {"status":"NAO_CRIADA","connected":False}
  paired_id=(info.get("me") or {}).get("id") if isinstance(info.get("me"),dict) else None
  club_number=paired_id.removesuffix("@c.us") if isinstance(paired_id,str) and re.fullmatch(r"[1-9][0-9]{9,15}@c\.us",paired_id) else None
 except (HTTPException,ValueError):
  result={"status":"TEMPORARIAMENTE_INDISPONIVEL","connected":False}
  club_number=None
 return {"eligible":True,"connected":bool(result["connected"]),
         "club_whatsapp_number":club_number,
         "status":result["status"],"linked":linked,
         "pilot_receiving":inbound,
         "next_step":("Seu número já está vinculado para o piloto." if linked else
           "WhatsApp do Clube pareado. Agora gere seu código e vincule seu número."
           if result["connected"] else
           "Aguarde a reconexão do WhatsApp do Clube e verifique novamente.")}

@router.delete("/api/finance-agent/whatsapp/link")
def unlink(u=Depends(driver)):
 with db() as c:
  c.execute("DELETE FROM finance_agent_wa_links WHERE uid=?",(u["id"],))
  c.execute("DELETE FROM finance_agent_link_codes WHERE uid=?",(u["id"],))
  audit(c,u["id"],"finance_agent:whatsapp_unlinked");c.commit()
 return {"ok":True}

@router.get("/api/admin/finance-agent/whatsapp")
def admin_status(u=Depends(admin)):
 with db() as c:
  key,enabled=private_settings(c)
  linked=c.execute("SELECT COUNT(*) FROM finance_agent_wa_links").fetchone()[0]
  from finance_agent_pilot_v1 import state as pilot_state
  owner,pilot_enabled=pilot_state(c)
  pilot_linked=bool(owner and c.execute("SELECT 1 FROM finance_agent_wa_links WHERE uid=?",(owner,)).fetchone())
 return {"enabled":enabled,"secret_set":bool(key),"linked_drivers":linked,
         "session":"clube-motorista","outgoing_messages":bool(pilot_enabled and pilot_linked),
         "pilot_armed":pilot_enabled,"pilot_linked":pilot_linked,
         "note":"Recepção HMAC exclusiva do piloto. A resposta só funciona para o telefone vinculado pelo código de uso único."}

@router.post("/api/admin/finance-agent/whatsapp/prepare")
def admin_prepare(u=Depends(admin)):
 with db() as c:
  key,enabled=private_settings(c)
  if enabled:raise HTTPException(409,"Desative a recepção antes de renovar a chave.")
  key=secrets.token_urlsafe(48)
  c.execute("INSERT INTO finance_agent_wa_config(id,key_blob,enabled,updated_at) VALUES(1,?,0,?) "
   "ON CONFLICT(id) DO UPDATE SET key_blob=excluded.key_blob,enabled=0,updated_at=excluded.updated_at",
   (enc({"key":key}),now()))
  audit(c,u["id"],"finance_agent:whatsapp_webhook_prepared");c.commit()
 return {"ok":True,"hmac_key":key,"not_enabled":True,
         "event":"message","custom_header":{"name":"X-Requested-With","value":"NOVAGENTE-V5"},
         "message":"Guarde esta chave e configure a WAHA somente depois de validar URL e segurança. Não é a X-Api-Key WAHA."}

@router.put("/api/admin/finance-agent/whatsapp/enabled")
def admin_toggle(data:dict,u=Depends(admin)):
 if set(data)!={"enabled"} or type(data["enabled"]) is not bool:
  raise HTTPException(422,"Informe enabled como verdadeiro/falso.")
 with db() as c:
  key,old=private_settings(c)
  if not key:raise HTTPException(409,"Prepare primeiro a chave HMAC.")
  if data["enabled"]:
   cfg,_=config_get(c)
   if not cfg or cfg["session"]!="clube-motorista":
    raise HTTPException(409,"A instância exclusiva clube-motorista deve estar configurada.")
  c.execute("UPDATE finance_agent_wa_config SET enabled=?,updated_at=? WHERE id=1",
   (int(data["enabled"]),now()))
  audit(c,u["id"],"finance_agent:whatsapp_webhook_toggle",str(data["enabled"]));c.commit()
 return {"enabled":data["enabled"],"outgoing_messages":False}

def media_blob(waha_cfg,media):
 """Never fetch media URL's host: use only its path on the known localhost WAHA instance."""
 if not isinstance(media,dict) or not isinstance(media.get("url"),str):
  return None
 from urllib.parse import urlsplit
 try:path=urlsplit(media["url"]).path
 except ValueError:return None
 if not FILE_PATH.fullmatch(path) or ".." in path:return None
 r,code=waha(waha_cfg,"GET",path)
 if code!=200 or len(r.content)>7*1024*1024:return None
 return r.content

@router.post("/api/finance-agent/whatsapp/events")
async def waha_event(req:Request):
 body=await req.body()
 if not body or len(body)>180000:raise HTTPException(413,"Evento inválido.")
 sig=req.headers.get("X-Webhook-Hmac","")
 algo=req.headers.get("X-Webhook-Hmac-Algorithm","").lower()
 timestamp=req.headers.get("X-Webhook-Timestamp","")
 if algo!="sha512" or not isinstance(sig,str) or not re.fullmatch(r"[a-fA-F0-9]{128}",sig):
  raise HTTPException(401,"Assinatura do webhook exigida.")
 try:
  millis=int(timestamp)
  if abs(int(time.time()*1000)-millis)>300000:raise ValueError()
 except ValueError:raise HTTPException(401,"Evento expirado ou sem timestamp.")
 with db() as c:
  key,enabled=private_settings(c)
  if not enabled or not key:raise HTTPException(503,"Recepção de WhatsApp não habilitada.")
  from finance_agent_pilot_v1 import state as pilot_state
  pilot_uid,pilot_enabled=pilot_state(c)
  if not pilot_enabled or not pilot_uid:
   return {"ignored":True,"reason":"pilot_not_armed","reply_sent":False}
  wanted=hmac.new(key.encode(),body,hashlib.sha512).hexdigest()
  if not hmac.compare_digest(wanted,sig.lower()):
   raise HTTPException(401,"Assinatura inválida.")
 try:msg=json.loads(body)
 except ValueError:raise HTTPException(422,"Formato inválido.")
 if not isinstance(msg,dict) or msg.get("event")!="message" or msg.get("session")!="clube-motorista":
  return {"ignored":True}
 payload=msg.get("payload")
 if not isinstance(payload,dict) or payload.get("fromMe") is not False:return {"ignored":True}
 chat=payload.get("from","")
 if not isinstance(chat,str) or not CHAT.fullmatch(chat):return {"ignored":True}
 with db() as c:
  raw=str(payload.get("body") or "").strip()[:1500]
  match=CODE.fullmatch(raw)
  if match:
   code_hash=sha(match.group(1).upper())
   row=c.execute("SELECT uid FROM finance_agent_link_codes WHERE hash=? AND expires>?",
    (code_hash,int(time.time()))).fetchone()
   if not row:return {"link":"invalid"}
   if row["uid"]!=pilot_uid or not options(c,row["uid"])["enabled"]:
    return {"ignored":True,"reason":"pilot_uid_only"}
   existing=c.execute("SELECT uid FROM finance_agent_wa_links WHERE phone_hash=?",(link_hash(chat),)).fetchone()
   if existing and existing["uid"]!=row["uid"]:return {"link":"already_assigned"}
   c.execute("DELETE FROM finance_agent_wa_links WHERE uid=? OR phone_hash=?",(row["uid"],link_hash(chat)))
   c.execute("INSERT INTO finance_agent_wa_links(uid,phone_hash,encrypted_chat,linked_at) VALUES(?,?,?,?)",
    (row["uid"],link_hash(chat),enc({"chat":chat}),now()))
   c.execute("DELETE FROM finance_agent_link_codes WHERE hash=?",(code_hash,))
   audit(c,row["uid"],"finance_agent:whatsapp_linked");c.commit()
   from finance_agent_pilot_v1 import send_once
   mid=str(payload.get("id") or "")
   sent=send_once(row["uid"],chat,mid,ONBOARDING_MESSAGE)
   return {"linked":True,"reply_sent":sent}
  owner=c.execute("SELECT uid FROM finance_agent_wa_links WHERE phone_hash=?",(link_hash(chat),)).fetchone()
  if not owner:return {"ignored":True,"reason":"not_linked"}
  uid=owner["uid"]
  if uid!=pilot_uid:return {"ignored":True,"reason":"only_one_pilot_account"}
  option=options(c,uid)
  if not option["enabled"]:return {"ignored":True,"reason":"no_consent"}
  mid=str(payload.get("id") or "")
  if not 8<=len(mid)<=300:return {"ignored":True}
  fingerprint=sha("finance_agent_event:"+mid)
  if c.execute("SELECT 1 FROM finance_agent_wa_events WHERE event_hash=?",(fingerprint,)).fetchone():
   return {"duplicate":True,"reply_sent":False}
  from finance_agent_pilot_v1 import (send_once,is_pilot_command,handle_command,
      proposed_message,remember_last,send_chart_once,forget_last,last_offer_for_clarification)
  if raw.strip().casefold() in ("ajuda","como funciona","início","inicio"):
   # The conversation moved on; a subsequent casual 'ok' must not confirm
   # a stale financial suggestion.
   forget_last(uid,chat)
   c.execute("INSERT INTO finance_agent_wa_events(event_hash,uid,handled_at) VALUES(?,?,?)",
    (fingerprint,uid,now()))
   c.commit()
   sent=send_once(uid,chat,mid,ONBOARDING_MESSAGE)
   return {"ok":True,"reason":"onboarding_help","reply_sent":sent,"model_called":False}
  # Media authorization is independent. An explicit command from the linked
  # driver modifies ONLY media_ai, never offers, trends, text_ai, or sharing.
  # Driver can revoke via the same private chat without opening the website.
  media_cmd=re.sub(r"\s+"," ",raw.casefold().translate(str.maketrans(
       "áàâãéêíóôõúç","aaaaeeiooouc"))).strip()
  if media_cmd in ("autorizar midia","ativar midia","revogar midia","desativar midia"):
   forget_last(uid,chat)
   grant=media_cmd in ("autorizar midia","ativar midia")
   change=c.execute("UPDATE finance_agent_consent SET media_ai=?,changed_at=? "
     "WHERE uid=? AND enabled=1",(int(grant),now(),uid))
   if not change.rowcount:
    return {"ignored":True,"reason":"no_active_finance_consent"}
   c.execute("INSERT INTO finance_agent_wa_events(event_hash,uid,handled_at) VALUES(?,?,?)",
     (fingerprint,uid,now()))
   audit(c,uid,"finance_agent:whatsapp_media_consent",
      "media_ai="+str(int(grant))+";source=verified_chat")
   c.commit()
   info=("✅ Autorização registrada! Agora posso interpretar fotos de comprovantes e áudios "
      "financeiros que você enviar. Fotos podem ser processadas por um serviço externo "
      "de IA; áudios são transcritos localmente e o texto pode ser analisado pela IA. "
      "Para cancelar a autorização quando quiser, escreva *REVOGAR MIDIA*. "
      "Reenvie a foto ou o áudio para começar." if grant else
      "✅ Autorização de fotos e áudios desativada! Suas mensagens financeiras por "
      "texto e os relatórios solicitados continuam disponíveis.")
   sent=send_once(uid,chat,mid,info)
   return {"ok":True,"reason":"media_permission_updated","media_ai":grant,
     "reply_sent":sent,"model_called":False}
  command=is_pilot_command(raw)
  if command:
   return handle_command(uid,chat,mid,command)
  if is_uncertain(raw):
   # Uncertain language, including 'marca', never posts a financial entry.
   recent=last_offer_for_clarification(uid,chat)
   if is_negative(raw):
    forget_last(uid,chat)
    text=("Tudo bem, não vou registrar essa sugestão. 🙂 Me diga o valor ou "
      "a categoria correta, ou mande uma nova despesa.")
   elif recent:
    candidate=recent["proposal"]
    from finance_agent_conversation_v2 import money
    amount=candidate.get("amount")
    category=str(candidate.get("category") or "categoria a conferir")
    text=("Só pra não anotar errado: você quis aprovar "
      +(money(round(float(amount)*100)) if amount else "o valor")
      +" em *"+category+"*? Se estiver certo, me confirma do seu jeito. "
      "Se não, diga o que precisa mudar. Ainda não registrei nada.")
   else:
    text=("Não vou registrar nada na dúvida. 🙂 Me mande o valor e o tipo de "
      "despesa ou ganho; eu te mostro para você conferir.")
   c.execute("INSERT INTO finance_agent_wa_events(event_hash,uid,handled_at) VALUES(?,?,?)",
     (fingerprint,uid,now()))
   audit(c,uid,"finance_agent:uncertain_confirmation","needs_review_no_ledger")
   c.commit()
   sent=send_once(uid,chat,mid,text)
   return {"ok":True,"reason":"uncertain_confirmation",
       "reply_sent":sent,"model_called":False}
  if looks_like_command(raw):
   reply=("Quase lá! 🙂 Para salvar a última sugestão, responda *confirmar*. "
     "Para cancelar, escreva *descartar*. Você também pode usar *CONFIRMAR + número*.")
   c.execute("INSERT INTO finance_agent_wa_events(event_hash,uid,handled_at) VALUES(?,?,?)",
       (fingerprint,uid,now()))
   c.commit()
   return {"ok":True,"reason":"confirmation_help",
     "reply_sent":send_once(uid,chat,mid,reply),"model_called":False}
  # Any new topic ends the context for a bare 'ok'. Explicit numbered
  # confirmations still work for an older pending entry.
  forget_last(uid,chat)
  if report_intent(raw):
   # A direct, authenticated request in the driver's OWN linked WhatsApp chat
   # authorizes a ONE-TIME summary response. Do not change stored "trends":
   # recurring/proactive analytics still require separate opt-in.
   # No offers, campaigns, marketing, data sharing or external AI calls.
   report=month_data(c,uid)
   text=report_text(report,mid)
   c.execute("INSERT INTO finance_agent_wa_events(event_hash,uid,handled_at) VALUES(?,?,?)",
      (fingerprint,uid,now()))
   audit(c,uid,"finance_agent:whatsapp_report_requested",
      "driver_direct_request:confirmed_only:one_time")
   c.commit()
   sent=send_once(uid,chat,mid,text)
   chart_sent=bool(sent and report["has_data"] and
     send_chart_once(uid,chat,mid,report))
   return {"ok":True,"reason":"financial_report","reply_sent":sent,
           "chart_sent":chart_sent,"model_called":False,
           "consent_scope":"request_only_no_preference_changes"}
  media=payload.get("media")
  has_media=bool(payload.get("hasMedia"))
  if not has_media:
   if not raw:return {"ignored":True}
   topic=route(raw)
   if topic!="record":
    # A future WAHA sender may use reply_text after outbound authorization.
    # HTTP webhook JSON is NOT a message automatically delivered by WAHA.
    message=(outside_text(mid,OUT_OF_SCOPE) if topic=="out_of_scope" else
       say(mid,WELCOME,"Oi! 👋 Quer registrar uma despesa, um ganho ou pedir seu resumo do mês?") if topic=="greeting"
       else say(mid,
         "Posso te mostrar seu dinheiro por aqui! 📊 Peça *me manda meu relatório* para receber seu resumo do mês. Também posso anotar um ganho ou despesa.",
         "Combinado! 💚 Me peça *relatório do mês* e eu te envio os registros confirmados aqui mesmo, sem precisar abrir o site."))
    c.execute("INSERT INTO finance_agent_wa_events(event_hash,uid,handled_at) VALUES(?,?,?)",
     (fingerprint,uid,now()))
    c.commit()
    sent=send_once(uid,chat,mid,message)
    return {"ok":True,"reason":topic,"reply_text":message,
     "reply_sent":sent,"model_called":False}
  else:
   if not option["media_ai"]:
    c.execute("INSERT INTO finance_agent_wa_events(event_hash,uid,handled_at) VALUES(?,?,?)",
     (fingerprint,uid,now()))
    c.commit()
    reply=("📷🎤 Posso ajudar com comprovantes e áudios também! Antes, preciso da sua "
      "autorização para analisar esse material. Fotos podem ser enviadas a um serviço "
      "externo de IA; áudios são transcritos localmente e o texto pode passar pela IA. "
      "Se estiver de acordo, responda *AUTORIZAR MIDIA*. Depois, reenvie o arquivo. "
      "Você pode cancelar quando quiser com *REVOGAR MIDIA*.")
    sent=send_once(uid,chat,mid,reply)
    return {"ok":True,"reason":"media_consent_required",
     "reply_sent":sent,"model_called":False}
   ai=config(c).get("api_key")
   if not ai:
    c.execute("INSERT INTO finance_agent_wa_events(event_hash,uid,handled_at) VALUES(?,?,?)",
      (fingerprint,uid,now()))
    c.commit()
    sent=send_once(uid,chat,mid,"Por enquanto não consegui ler esse arquivo. "
      "Você pode me mandar o gasto ou ganho por texto, como *Gastei R$ 80 de gasolina*.")
    return {"ok":True,"reason":"multimodal_provider_required",
      "reply_sent":sent,"model_called":False}
   cfg,_=config_get(c)
   if not cfg:return {"ignored":True,"reason":"WAHA_unconfigured"}
  provider_key=config(c).get("api_key") if option.get("text_ai") and not has_media else None
 # Do not keep the DB transaction open while making model/Whisper calls.
 ticket=None
 try:
  if not has_media:
   proposal=classify_text(raw)
   if proposal["status"]!="ready" and provider_key:
    if provider_key:
     ticket=reserve(uid,"text_ai")
     proposal=deepseek_text(provider_key,raw)
     proposal["analysis_method"]="DeepSeek V4.1 Flash"
   if ticket is None:proposal["analysis_method"]="regras locais"
  else:
   # Never use untrusted media hosts; always proxy only through known local WAHA.
   file=media_blob(cfg,media)
   if not file:return {"ignored":True,"reason":"media_unavailable"}
   try:mime=read_mime(file)
   except HTTPException:return {"ignored":True,"reason":"media_format_unsupported"}
   ticket=reserve(uid,"image" if mime.startswith("image/") else "audio")
   if mime.startswith("image/"):
    proposal=image_analyze(ai,file,mime,raw)
   else:
    import asyncio
    transcript=await asyncio.to_thread(speech_to_text,file,mime)
    proposal=interpret_transcribed_audio(ai,transcript)
  proposal["source"]="whatsapp"
  with db() as c:
   idx=add_proposal(c,uid,proposal)
   c.execute("INSERT INTO finance_agent_wa_events(event_hash,uid,handled_at) VALUES(?,?,?)",
      (fingerprint,uid,now()))
   audit(c,uid,"finance_agent:whatsapp_proposal",str(idx));c.commit()
  if ticket is not None:complete(ticket)
 except Exception:
  if ticket is not None:refund(ticket)
  raise

 sent=send_once(uid,chat,mid,proposed_message(proposal,idx,mid))
 if sent:remember_last(uid,chat,idx)
 return {"ok":True,"proposal_id":idx,"reply_sent":sent,
    "notice":"Confirmação aceita por número ou por comando curto, vinculada à última sugestão enviada."}
