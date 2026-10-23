"""Planejamento visual de distribuição. Não envia dinheiro, não conversa com bancos/WhatsApp."""
import json,re
from decimal import Decimal,InvalidOperation,ROUND_DOWN,ROUND_HALF_UP
from fastapi import APIRouter,Depends,HTTPException
from app import db,auth,enc,dec,now,audit

router=APIRouter()
CATEGORIES_ADMIN=[
 {"name":"Operação","percentage":40,"reported_sent":0},
 {"name":"Comissão","percentage":25,"reported_sent":0},
 {"name":"Reserva","percentage":20,"reported_sent":0},
 {"name":"Marketing","percentage":10,"reported_sent":0},
 {"name":"Taxas","percentage":5,"reported_sent":0}
]
CATEGORIES_DRIVER=[
 {"name":"Combustível","percentage":35,"reported_sent":0},
 {"name":"Manutenção","percentage":15,"reported_sent":0},
 {"name":"Reserva","percentage":25,"reported_sent":0},
 {"name":"Troca do carro","percentage":20,"reported_sent":0},
 {"name":"Outros","percentage":5,"reported_sent":0}
]

def ensure_table(c):
 c.execute("""CREATE TABLE IF NOT EXISTS distribution_plans (
 uid INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 encrypted BLOB NOT NULL,
 updated_at TEXT NOT NULL
 )""")

def decimal_value(v, max_value, places=2):
 if isinstance(v,bool) or isinstance(v,(list,dict)) or v is None:
  raise HTTPException(422,"Número inválido")
 try:
  s=str(v).strip()
  if not re.fullmatch(r"\d{1,10}(?:[.,]\d{1,2})?",s):raise ValueError()
  d=Decimal(s.replace(",","."))
  if not d.is_finite() or d<0 or d>Decimal(str(max_value)):raise ValueError()
  return d.quantize(Decimal("0.01"),rounding=ROUND_HALF_UP)
 except (InvalidOperation,ValueError):raise HTTPException(422,"Valor ou percentual inválido")

def calc(body):
 if not isinstance(body,dict):raise HTTPException(422,"Plano inválido")
 total=decimal_value(body.get("total",0),100000000)
 rows=body.get("rows")
 if not isinstance(rows,list) or not 2<=len(rows)<=8:raise HTTPException(422,"Informe de 2 a 8 categorias.")
 out=[];used=set();basis_sum=0;total_cents=int(total*100)
 for i,r in enumerate(rows):
  if not isinstance(r,dict):raise HTTPException(422,"Categoria inválida.")
  name=str(r.get("name","")).strip()
  if not 2<=len(name)<=40 or any(ord(c)<32 for c in name):
   raise HTTPException(422,"Nome da categoria precisa ter de 2 a 40 caracteres.")
  if name.casefold() in used:raise HTTPException(422,"Categorias devem ter nomes diferentes.")
  used.add(name.casefold())
  pct=decimal_value(r.get("percentage"),100)
  basis=int(pct*100);basis_sum+=basis
  sent=decimal_value(r.get("reported_sent",0),100000000)
  out.append({"name":name,"percentage":float(pct),"reported_sent":float(sent),
    "_basis":basis,"_sent":int(sent*100)})
 if basis_sum!=10000:raise HTTPException(422,"A soma dos percentuais precisa ser exatamente 100%.")
 # Distribute every cent deterministically, including the largest remainders.
 floors=[];fractions=[]
 for index,r in enumerate(out):
  exact=total_cents*r["_basis"]
  floors.append(exact//10000)
  fractions.append((exact%10000,index))
 rem=total_cents-sum(floors)
 for fraction,index in sorted(fractions,key=lambda x:(-x[0],x[1]))[:rem]:
  floors[index]+=1
 result=[]
 for i,r in enumerate(out):
  if r["_sent"]>floors[i]:raise HTTPException(422,"O valor informado como enviado não pode exceder o previsto para "+r["name"]+".")
  result.append({"name":r["name"],"percentage":r["percentage"],
     "planned":floors[i]/100,"reported_sent":r["_sent"]/100,
     "pending":(floors[i]-r["_sent"])/100})
 reported=sum(r["_sent"] for r in out)
 return {"total":total_cents/100,"reported_sent":reported/100,"pending":(total_cents-reported)/100,
         "reported_percentage":round(reported/total_cents*100,2) if total_cents else 0,
         "rows":result, "no_bank_transactions":True,
         "notice":"Valores enviados são apenas informações lançadas manualmente. Nenhuma transferência ou conciliação bancária é realizada."}

def default(role):
 if role=="admin":return {"total":100000,"rows":CATEGORIES_ADMIN}
 return {"total":5000,"rows":CATEGORIES_DRIVER}

@router.get("/api/distribution-plan")
def get_distribution(u=Depends(auth)):
 with db() as c:
  ensure_table(c)
  r=c.execute("SELECT encrypted,updated_at FROM distribution_plans WHERE uid=?",(u["id"],)).fetchone()
  if r:
   payload=dec(r["encrypted"])
   saved=True;updated=r["updated_at"]
  else:
   payload=default(u["role"])
   saved=False;updated=None
  return {**calc(payload),"saved":saved,"updated_at":updated,
          "source":"manual" if saved else "exemplo", "scope":"individual"}

@router.put("/api/distribution-plan")
def save_distribution(payload:dict,u=Depends(auth)):
 result=calc(payload)
 values={"total":result["total"],"rows":[{"name":r["name"],"percentage":r["percentage"],
             "reported_sent":r["reported_sent"]} for r in result["rows"]]}
 with db() as c:
  ensure_table(c)
  c.execute("INSERT INTO distribution_plans(uid,encrypted,updated_at) VALUES(?,?,?) "
            "ON CONFLICT(uid) DO UPDATE SET encrypted=excluded.encrypted,updated_at=excluded.updated_at",
            (u["id"],enc(values),now()))
  audit(c,u["id"],"distribution:updated",str(len(values["rows"]))+" categorias")
  c.commit()
 return {**result,"saved":True,"source":"manual"}

@router.delete("/api/distribution-plan")
def clear_distribution(u=Depends(auth)):
 with db() as c:
  ensure_table(c)
  c.execute("DELETE FROM distribution_plans WHERE uid=?",(u["id"],))
  audit(c,u["id"],"distribution:reset","")
  c.commit()
 return {"ok":True,"note":"Planejamento excluído. Os demais registros não foram afetados."}
