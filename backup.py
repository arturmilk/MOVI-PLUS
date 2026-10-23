"""Backup diário local V5. Cópia consistente do SQLite + documentos criptografados + chave de dados.
O pacote completo recebe uma segunda camada de criptografia. Não substitui backup externo.
"""
from pathlib import Path
import sqlite3,tarfile,tempfile,datetime,os
from cryptography.fernet import Fernet
ROOT=Path(__file__).resolve().parent
DATA=ROOT/"data";OUT=ROOT/"backups"
OUT.mkdir(exist_ok=True,mode=0o700);os.chmod(OUT,0o700)
MASTER=ROOT/".backup-master-key"
if not MASTER.exists():MASTER.write_bytes(Fernet.generate_key());MASTER.chmod(0o600)
stamp=datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
with tempfile.TemporaryDirectory(prefix="clubebackup_") as tmp:
 tmp=Path(tmp)
 src=sqlite3.connect(str(DATA/"v5.sqlite3"))
 dest=sqlite3.connect(str(tmp/"database.sqlite3"))
 src.backup(dest);dest.close();src.close()
 tarpath=tmp/"archive.tar.gz"
 with tarfile.open(tarpath,"w:gz") as archive:
  archive.add(tmp/"database.sqlite3",arcname="database.sqlite3")
  archive.add(DATA/".encryption-key",arcname="encryption-key")
  docs=DATA/"documents"
  if docs.exists():
   for f in docs.iterdir():
    if f.is_file() and f.suffix==".bin":archive.add(f,arcname="documents/"+f.name)
  campaign_files=DATA/"program-media"
  if campaign_files.exists():
   for f in campaign_files.iterdir():
    if f.is_file() and f.suffix==".enc":archive.add(f,arcname="program-media/"+f.name)
 encrypted=Fernet(MASTER.read_bytes()).encrypt(tarpath.read_bytes())
 path=OUT/("clube-v5-"+stamp+".enc")
 path.write_bytes(encrypted);path.chmod(0o600)
 removed=0
 for old in OUT.glob("clube-v5-*.enc"):
  if old.stat().st_mtime < datetime.datetime.now().timestamp()-14*86400:
   old.unlink();removed+=1
 print("BACKUP_OK",path.name,"bytes",path.stat().st_size,"expirados",removed)
