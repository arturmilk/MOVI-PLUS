"""NOVAGENTE admin MFA: RFC 6238 TOTP + one-time recovery codes.

Optional until enrolled by administrator: never lock out an existing account
on installation. Admin must set up and confirm authenticator personally.
"""
import base64,hashlib,hmac,json,secrets,struct,time
from collections import defaultdict
from urllib.parse import quote
from fastapi import APIRouter,Depends,HTTPException,Request
from app import db,admin,cipher,enc,dec,now,stamp,password_ok,audit,sha

router=APIRouter()
STEP=30
ISSUER="NOVAGENTE Clube do Motorista"
_verify_attempts=defaultdict(list)
def guard_attempt(uid,purpose):
 key=(uid,purpose)
 t=time.monotonic()
 _verify_attempts[key]=[x for x in _verify_attempts[key] if t-x<900]
 if len(_verify_attempts[key])>=8:
  raise HTTPException(429,"Muitas tentativas. Aguarde 15 minutos.")
 _verify_attempts[key].append(t)
def clear_attempts(uid,purpose):
 _verify_attempts.pop((uid,purpose),None)

def init_table(c):
 c.execute("""CREATE TABLE IF NOT EXISTS admin_mfa(
 uid INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 enabled INTEGER NOT NULL DEFAULT 0,
 secret BLOB,
 pending_secret BLOB,
 pending_expires INTEGER,
 recovery_hashes BLOB,
 last_step INTEGER NOT NULL DEFAULT -1,
 enrolled_at TEXT
 )""")
 c.commit()

with db() as c:init_table(c)

def pin(secret,counter):
 raw=base64.b32decode(secret,casefold=True)
 digest=hmac.new(raw,struct.pack(">Q",counter),hashlib.sha1).digest()
 ix=digest[-1]&15
 return f"{(struct.unpack('>I',digest[ix:ix+4])[0]&0x7fffffff)%1000000:06d}"

def verify(secret,code,last=-1):
 if not isinstance(code,str) or len(code)!=6 or not code.isascii() or not code.isdecimal():return None
 current=int(time.time())//STEP
 for counter in (current,current-1,current+1):
  if counter>last and hmac.compare_digest(pin(secret,counter),code):
   return counter
 return None

def read(c,uid):
 return c.execute("SELECT * FROM admin_mfa WHERE uid=?",(uid,)).fetchone()

def enabled(c,uid):
 r=read(c,uid)
 return bool(r and r["enabled"])

def verify_login(c,uid,code):
 """Verify and consume TOTP time-step or single-use recovery code, transactionally."""
 r=read(c,uid)
 if not r or not r["enabled"]:return True
 if not isinstance(code,str) or not code or len(code)>70:return False
 # Transaction lock ensures two concurrent submissions cannot reuse same code.
 c.execute("BEGIN IMMEDIATE")
 r=read(c,uid)
 if not r or not r["enabled"]:return False
 shared=dec(r["secret"])
 index=verify(shared,code,r["last_step"])
 if index is not None:
  c.execute("UPDATE admin_mfa SET last_step=? WHERE uid=?",(index,uid))
  return True
 try:hashes=dec(r["recovery_hashes"])
 except Exception:return False
 fingerprint=hashlib.sha256(code.strip().encode()).hexdigest()
 for i,digest in enumerate(hashes):
  if hmac.compare_digest(fingerprint,digest):
   remaining=hashes[:i]+hashes[i+1:]
   c.execute("UPDATE admin_mfa SET recovery_hashes=? WHERE uid=?",(enc(remaining),uid))
   return True
 return False

@router.get("/api/security/mfa")
def status(u=Depends(admin)):
 with db() as c:
  r=read(c,u["id"])
  return {"enabled":bool(r and r["enabled"]),
   "pending":bool(r and r["pending_expires"] and r["pending_expires"]>stamp() and not r["enabled"]),
   "recovery_codes_remaining":len(dec(r["recovery_hashes"])) if r and r["enabled"] and r["recovery_hashes"] else 0,
   "notice":"A autenticação em duas etapas é ativada somente depois da confirmação no aplicativo autenticador."}

@router.post("/api/security/mfa/setup")
def setup(data:dict,u=Depends(admin)):
 guard_attempt(u["id"],"setup")
 pwd=data.get("password")
 if not isinstance(pwd,str) or len(pwd)>200:raise HTTPException(422,"Senha atual inválida.")
 with db() as c:
  row=c.execute("SELECT phash,username FROM users WHERE id=?",(u["id"],)).fetchone()
  if not row or not password_ok(pwd,row["phash"]):raise HTTPException(403,"Senha atual incorreta.")
  if enabled(c,u["id"]):raise HTTPException(409,"Segundo fator já está ativo.")
  secret=base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")
  # No external QR generation: user can type secret into an authenticator.
  c.execute("INSERT INTO admin_mfa(uid,enabled,pending_secret,pending_expires) VALUES(?,0,?,?) "
   "ON CONFLICT(uid) DO UPDATE SET pending_secret=excluded.pending_secret,pending_expires=excluded.pending_expires",
   (u["id"],enc(secret),stamp()+600))
  audit(c,u["id"],"security:mfa_pending");c.commit()
  clear_attempts(u["id"],"setup")
  label=quote(ISSUER+":"+row["username"],safe="")
  uri="otpauth://totp/"+label+"?secret="+secret+"&issuer="+quote(ISSUER,safe="")+"&algorithm=SHA1&digits=6&period=30"
  return {"setup_key":secret,"otpauth_uri":uri,"expires_in_seconds":600,
          "message":"Cadastre a chave no aplicativo autenticador. O MFA só será ativado após digitar o primeiro código."}

@router.post("/api/security/mfa/confirm")
def confirm(data:dict,req:Request,u=Depends(admin)):
 guard_attempt(u["id"],"confirm")
 code=data.get("code","")
 with db() as c:
  r=read(c,u["id"])
  if not r or r["enabled"] or not r["pending_secret"] or not r["pending_expires"] or r["pending_expires"]<stamp():
   raise HTTPException(409,"Inicie a configuração do segundo fator novamente.")
  secret=dec(r["pending_secret"])
  step=verify(secret,code)
  if step is None:raise HTTPException(422,"Código incorreto ou expirado. Verifique o relógio do celular.")
  codes=[secrets.token_urlsafe(12) for _ in range(8)]
  c.execute("UPDATE admin_mfa SET enabled=1,secret=?,pending_secret=NULL,pending_expires=NULL,"
   "recovery_hashes=?,last_step=?,enrolled_at=? WHERE uid=?",
   (enc(secret),enc([hashlib.sha256(v.encode()).hexdigest() for v in codes]),step,now(),u["id"]))
  # Revoke other pre-MFA admin sessions; keep the session used to activate it.
  c.execute("DELETE FROM sessions WHERE uid=? AND hash<>?",(u["id"],sha(req.cookies.get("clube_session",""))))
  audit(c,u["id"],"security:mfa_enabled");c.commit()
  clear_attempts(u["id"],"confirm")
  return {"ok":True,"enabled":True,"recovery_codes":codes,
    "message":"Guarde os códigos de recuperação fora deste computador. Cada código funciona uma única vez."}

@router.post("/api/security/mfa/disable")
def disable(data:dict,u=Depends(admin)):
 guard_attempt(u["id"],"disable")
 pwd=data.get("password","")
 code=data.get("code","")
 with db() as c:
  row=c.execute("SELECT phash FROM users WHERE id=?",(u["id"],)).fetchone()
  if not row or not isinstance(pwd,str) or not password_ok(pwd,row["phash"]):
   raise HTTPException(403,"Senha incorreta.")
  if not enabled(c,u["id"]):raise HTTPException(409,"Segundo fator não está ativo.")
  if not verify_login(c,u["id"],code):
   raise HTTPException(403,"Código de autenticação inválido.")
  c.execute("DELETE FROM admin_mfa WHERE uid=?",(u["id"],))
  audit(c,u["id"],"security:mfa_disabled");c.commit()
  clear_attempts(u["id"],"disable")
 return {"ok":True,"enabled":False}


@router.get("/api/security/readiness")
def readiness(u=Depends(admin)):
 from pathlib import Path
 import json
 from app import DATA
 location=DATA/"operations-health.json"
 info={}
 if location.is_file():
  try:info=json.loads(location.read_text(encoding="utf-8"))
  except (OSError,ValueError):info={}
 with db() as c:
  mfa_active=enabled(c,u["id"])
 return {
  "admin_mfa_active":mfa_active,
  "local_checks":{k:info.get(k) for k in (
   "checked_at_utc","status","app_healthy","database_ok","backup_fresh","backup_age_hours")},
  "external_backup_verified":False,
  "custom_domain_verified":False,
  "privacy_legal_approved":False,
  "external_security_assessment_completed":False,
  "production_launch_approved":False,
  "notice":"Checklist de homologação: o monitor e backup locais não substituem réplica externa, domínio permanente e aprovação jurídica."
 }
