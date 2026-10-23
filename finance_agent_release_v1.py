"""Controlled release of NOVAGENTE finance agent in the internal driver portal.

Release flag never alters drivers' consent choices. WhatsApp and payments are separate.
"""
from fastapi import APIRouter,Depends,HTTPException
from app import db,auth,admin,audit,now
from finance_agent_v1 import options,config,whisper_ready

router=APIRouter()

def init_table(c):
 c.execute("""CREATE TABLE IF NOT EXISTS finance_agent_release(
   id INTEGER PRIMARY KEY CHECK(id=1),
   enabled INTEGER NOT NULL DEFAULT 1,
   updated_at TEXT NOT NULL,
   updated_by INTEGER
 )""")
 c.execute("INSERT OR IGNORE INTO finance_agent_release(id,enabled,updated_at) VALUES(1,1,?)",(now(),))
 c.commit()

with db() as _c:init_table(_c)

def released(c):
 r=c.execute("SELECT enabled FROM finance_agent_release WHERE id=1").fetchone()
 return bool(r and r["enabled"])

@router.get("/api/finance-agent/release")
def driver_release(u=Depends(auth)):
 with db() as c:
  active=released(c)
  allowed=options(c,u["id"]) if u["role"]=="driver" else None
  credential=bool(config(c).get("api_key"))
 return {"available":active,
  "consent_needed":u["role"]=="driver" and not bool(allowed["enabled"]),
  "provider_ready":credential,
  "local_audio_ready":whisper_ready(),
  "message_types":{"text":True,"image":credential,"audio":credential and whisper_ready()},
  "automatic_whatsapp":False,"payments":False,
  "notice":"O agente somente processa dados com a autorizacao do motorista e salva lancamentos apos a confirmacao."}

@router.get("/api/admin/finance-agent/release")
def admin_release(u=Depends(admin)):
 with db() as c:
  status=released(c)
  users=c.execute("SELECT COUNT(*) FROM users WHERE role='driver' AND status='active'").fetchone()[0]
  consented=c.execute("SELECT COUNT(*) FROM finance_agent_consent x JOIN users u ON u.id=x.uid "
   "WHERE u.role='driver' AND u.status='active' AND x.enabled=1").fetchone()[0]
  multimodal=c.execute("SELECT COUNT(*) FROM finance_agent_consent x JOIN users u ON u.id=x.uid "
   "WHERE u.role='driver' AND u.status='active' AND x.media_ai=1 AND x.enabled=1").fetchone()[0]
  proposals=c.execute("SELECT status,COUNT(*) n FROM finance_agent_proposals GROUP BY status").fetchall()
  origins=c.execute("SELECT origin,COUNT(*) n FROM finance_agent_proposals GROUP BY origin").fetchall()
  ready=bool(config(c).get("api_key"))
 return {"available":status,
  "active_drivers":users,"authorized_drivers":consented,"authorized_multimodal":multimodal,
  "proposals":{r["status"]:r["n"] for r in proposals},
  "sources":{r["origin"]:r["n"] for r in origins},
  "deepseek_ready":ready,"whisper_ready":whisper_ready(),
  "whatsapp_automatic":False,
  "offers_automatic":False,"bank_integration":False,
  "note":"Disponibilizar o agente no portal nao concede autorizacoes individuais nem liga o WhatsApp."}

@router.put("/api/admin/finance-agent/release")
def set_release(data:dict,u=Depends(admin)):
 if set(data)!={"enabled"} or type(data["enabled"]) is not bool:
  raise HTTPException(422,"Informe enabled como verdadeiro ou falso.")
 with db() as c:
  c.execute("UPDATE finance_agent_release SET enabled=?,updated_at=?,updated_by=? WHERE id=1",
    (int(data["enabled"]),now(),u["id"]))
  audit(c,u["id"],"finance_agent:release","portal_enabled="+str(data["enabled"]));c.commit()
 return {"ok":True,"available":data["enabled"],
   "individual_consents_unchanged":True,"whatsapp_automatic":False}
