"""Deterministic stage3 operational health probe. No user data in status."""
import json,os,sqlite3,sys,time,urllib.error,urllib.request
from pathlib import Path
BASE=Path(__file__).resolve().parent
DB=BASE/"data"/"v5.sqlite3"
OUT=BASE/"data"/"operations-health.json"
BACKUPS=BASE/"backups"
result={"checked_at_utc":__import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(timespec="seconds"),
 "app_healthy":False,"database_ok":False,"backup_fresh":False,"backup_age_hours":None,"status":"warning"}
try:
 req=urllib.request.Request("http://127.0.0.1:8891/health")
 with urllib.request.urlopen(req,timeout=8) as resp:
  data=json.load(resp)
  result["app_healthy"]=resp.status==200 and data.get("ok") is True and str(data.get("version"))=="5.0"
except Exception as exc:result["app_error"]=type(exc).__name__
try:
 c=sqlite3.connect("file:"+str(DB)+"?mode=ro",uri=True,timeout=3)
 result["database_ok"]=c.execute("PRAGMA quick_check").fetchone()[0]=="ok"
 c.close()
except Exception as exc:result["db_error"]=type(exc).__name__
try:
 archives=list(BACKUPS.glob("clube-v5-*.enc"))
 if archives:
  newest=max(archives,key=lambda p:p.stat().st_mtime)
  elapsed=max(0,time.time()-newest.stat().st_mtime)
  result["backup_age_hours"]=round(elapsed/3600,1)
  result["backup_fresh"]=elapsed<36*3600
except Exception as exc:result["backup_error"]=type(exc).__name__
result["status"]="healthy" if all((result["app_healthy"],result["database_ok"],result["backup_fresh"])) else "warning"
tmp=OUT.with_suffix(".tmp")
tmp.write_text(json.dumps(result,ensure_ascii=False),encoding="utf-8")
tmp.chmod(0o600)
os.replace(tmp,OUT)
print("Clube V5 operations check:",result["status"],"app:",result["app_healthy"],"db:",result["database_ok"],"backup:",result["backup_fresh"],"age:",result["backup_age_hours"])
sys.exit(0 if result["status"]=="healthy" else 1)
