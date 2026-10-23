"""Cria ou redefine a senha do admin principal por comando explícito no servidor."""
import sys,secrets,hashlib
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import app
def main():
 if len(sys.argv)<2 or sys.argv[1] not in ("init-admin","reset-admin"):
  print("Uso: manage.py init-admin | reset-admin");return 2
 username="gestor"
 secret=secrets.token_urlsafe(24)+"9a"
 with app.db() as c:
  old=c.execute("SELECT id,role FROM users WHERE username=?",(username,)).fetchone()
  if sys.argv[1]=="init-admin":
   if old:raise SystemExit("Conta já existente; use reset-admin")
   c.execute("INSERT INTO users(username,phash,role,status,name,created_at,must_change) VALUES(?,?,?,?,?,?,1)",
    (username,app.password_hash(secret),"admin","active","Gestão NOVAGENTE",app.now()))
  else:
   if not old or old["role"]!="admin":raise SystemExit("Administrador inexistente")
   c.execute("UPDATE users SET phash=?,must_change=1 WHERE id=?",(app.password_hash(secret),old["id"]))
   c.execute("DELETE FROM sessions WHERE uid=?",(old["id"],))
  c.commit()
 print("CONTA: "+username)
 print("SENHA-INICIAL (mostrada uma única vez): "+secret)
 print("TROQUE A SENHA AO PRIMEIRO ACESSO")
 return 0
if __name__=="__main__":raise SystemExit(main())
