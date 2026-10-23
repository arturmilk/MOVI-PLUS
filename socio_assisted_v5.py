"""Assisted socio-economic registration: explicit driver opt-in required."""
from fastapi import APIRouter,Depends,HTTPException
from app import db,admin,profile,save_profile,consent,validate_value,audit,now,MAP,progress
from schema import ALL,SENSITIVE
router=APIRouter()
ALLOWED={f[0] for f in ALL if not f[5] and f[2]!="file"}
IDENTITY={f[0] for f in ALL if f[5] and f[2]!="file"}

def permitted(c,uid):
 driver=c.execute("SELECT id,name,status FROM users WHERE id=? AND role='driver'",(uid,)).fetchone()
 if not driver:raise HTTPException(404,"Motorista não encontrado")
 cc=consent(c,uid)
 if not bool(cc["insights"]) or not bool(cc["assisted_entry"]):
  raise HTTPException(403,"O motorista precisa autorizar análise e preenchimento assistido na aba Autorizações.")
 return driver

@router.get("/api/admin/assisted-profile/{uid}")
def read_assisted(uid:int,u=Depends(admin)):
 with db() as c:
  person=permitted(c,uid)
  values=profile(c,uid)
  can_identity=bool(consent(c,uid)["identity_collection"])
  allowed=ALLOWED | (IDENTITY if can_identity else set())
  return {"driver":{"id":person["id"],"name":person["name"]},
          "answers":{k:v for k,v in values.items() if k in allowed},
          "progress":progress(values,can_identity),"allowed_fields":sorted(allowed),
          "identity_collection_enabled":can_identity,
          "notice":"Dados de identificação somente com autorização adicional expressa do motorista."}

@router.put("/api/admin/assisted-profile/{uid}")
def update_assisted(uid:int,data:dict,u=Depends(admin)):
 if not isinstance(data,dict) or not 1<=len(data)<=len(ALLOWED|IDENTITY):
  raise HTTPException(422,"Informe uma ou mais respostas.")
 with db() as c:
  permitted(c,uid)
  can_identity=bool(consent(c,uid)["identity_collection"])
  allowed=ALLOWED | (IDENTITY if can_identity else set())
  if any(k not in allowed for k in data):
   raise HTTPException(403,"Campo de identificação exige autorização específica do motorista.")
  patch={}
  for k,v in data.items():
   try:patch[k]=validate_value(k,v,can_identity)
   except HTTPException as e:raise HTTPException(e.status_code,MAP[k][1]+": "+str(e.detail))
  values=profile(c,uid);values.update(patch)
  save_profile(c,uid,values)
  audit(c,u["id"],"profile:assisted_updated","participante interno "+str(uid)+"; "+str(len(patch))+" campos")
  c.commit()
  return {"ok":True,"saved_fields":len(patch),"progress":progress(values,can_identity)}
