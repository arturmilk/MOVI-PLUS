"""Deterministic, zero-token conversational helpers for a consented driver WhatsApp pilot.

No private context leaves the app. Monetary reporting uses confirmed SQLite transactions only.
"""
import hashlib,datetime,re,unicodedata

MONTHS=("janeiro","fevereiro","março","abril","maio","junho","julho",
        "agosto","setembro","outubro","novembro","dezembro")

def plain(value):
 s=unicodedata.normalize("NFKD",str(value).casefold())
 return "".join(c for c in s if not unicodedata.combining(c)).strip()

def say(seed,*variants):
 return variants[int(hashlib.sha256(str(seed).encode()).hexdigest()[:12],16)%len(variants)]

# A natural reply is accepted only if it is an entire short affirmative message
# AND there is a fresh, explicitly delivered proposal in the linked WhatsApp chat.
# Never match substrings within a sentence or infer consent from financial context.
YES_ALIASES=frozenset((
 "ok","okay","blza","blz","beleza","sim","s","ss","isso","isso mesmo",
 "isso ai","isso aí","confirma","confirmar","confirmo","confirme","confimar",
 "confrimar","falow","falou","top","ta bom","tá bom","ta certo","tá certo",
 "legal","certo","certinho","fechou","combinado","perfeito","otimo","ótimo",
 "pode","pode confirmar","pode salvar","pode registrar","pode anotar",
 "anota","registra","salva","aprovado","pode ser sim","show","show de bola",
 "pode lancar","pode lançar","ta correto","tá correto"
))
NO_ALIASES=frozenset(("descartar","descarta","cancelar","cancela","cancela isso","pode cancelar"))
UNCERTAIN_ALIASES=frozenset((
 "acho que sim","acho que e","acho que é","talvez","pode ser",
 "nao sei","não sei","sei la","sei lá","mais ou menos","marca","não tenho certeza",
 "nao tenho certeza","acho","hmm","hum","sera","será"
))
NEGATIVE_ALIASES=frozenset(("nao","não","n","negativo","errado","nao ta certo","não tá certo"))

def clean_reply(text):
 s=plain(text)
 # Only strip outside punctuation, never embedded price/words.
 s=re.sub(r"^[\s.,!?;:¡¿*_()\[\]{}-]+|[\s.,!?;:¡¿*_()\[\]{}-]+$","",s)
 return re.sub(r"\s+"," ",s).strip()

YES_NORMALIZED=frozenset(plain(x) for x in YES_ALIASES)
NO_NORMALIZED=frozenset(plain(x) for x in NO_ALIASES)
UNCERTAIN_NORMALIZED=frozenset(plain(x) for x in UNCERTAIN_ALIASES)
NEGATIVE_NORMALIZED=frozenset(plain(x) for x in NEGATIVE_ALIASES)

def command(text):
 s=clean_reply(text)
 if str(text).strip() in ("👍","✅","👌"):return ("CONFIRMAR",None)
 explicit=re.fullmatch(r"(confirmar|confimar|confrimar|confirma|confirmo|"
  r"descartar|descarta|cancelar|cancela)\s+#?([1-9][0-9]{0,9})",s)
 if explicit:
  verb="DESCARTAR" if explicit.group(1) in NO_NORMALIZED else "CONFIRMAR"
  return verb,int(explicit.group(2))
 if s in YES_NORMALIZED:return ("CONFIRMAR",None)
 if s in NO_NORMALIZED:return ("DESCARTAR",None)
 return None

def is_uncertain(text):
 s=clean_reply(text)
 return s in UNCERTAIN_NORMALIZED or s in NEGATIVE_NORMALIZED

def is_negative(text):
 return clean_reply(text) in NEGATIVE_NORMALIZED

def looks_like_command(text):
 s=plain(text)
 return bool(re.fullmatch(r"(?:confirma\w*|confima\w*|descart\w*|cancel\w*)\s*[!.]?",s))

def report_intent(text):
 s=plain(text)
 if re.search(r"\b\d+(?:[.,]\d+)?\s*(?:reais|real)\b|r\s*\$\s*\d+",s):
  return False
 if re.search(r"\b(?:gastei|paguei|recebi|abasteci|comprei|ganhei|faturei)\b",s):
  if not re.search(r"\b(?:quanto|onde|mostra|mostre|resumo|relatorio|grafico|balanco|historico|me manda|me mostra)\b",s):
   return False
 return bool(re.search(
  r"\b(?:relatorio|grafico|resumo|balanco|extrato|historico|onde|quanto|gastei|"
  r"gastos|gasto|despesas|entradas|saldo|meu mes|me mostra|me manda|mostre|mostra|"
  r"como estao meus gastos|onde foi meu dinheiro|meu dinheiro)\b",s)
  and re.search(r"\b(?:gastei|gastos|gasto|despesas|receitas|entradas|"
                r"dinheiro|financeiro|contas|mes|investimentos|investimento|"
                r"resumo|relatorio|grafico|balanco|extrato|saldo|onde|quanto)\b",s))

def money(cents):
 return "R$ "+f"{int(cents)/100:,.2f}".replace(",","_").replace(".",",").replace("_",".")

def month_data(c,uid,at=None):
 from zoneinfo import ZoneInfo
 at=at or datetime.datetime.now(ZoneInfo("America/Porto_Velho"))
 month=at.strftime("%Y-%m")
 rows=c.execute(
  "SELECT kind,category,SUM(amount_cents) as total FROM transactions "
  "WHERE uid=? AND substr(entry_date,1,7)=? "
  "AND kind IN ('income','expense') GROUP BY kind,category",
  (uid,month)).fetchall()
 income=sum(int(r["total"]) for r in rows if r["kind"]=="income")
 expense=sum(int(r["total"]) for r in rows if r["kind"]=="expense")
 cats=sorted([(r["category"],int(r["total"])) for r in rows if r["kind"]=="expense"],
  key=lambda x:-x[1])
 # Aggregate *confirmed* income without changing older ledger records.
 income_labels={"APLICATIVO":0,"OUTROS":0}
 app_sources={}
 for entry in c.execute(
   "SELECT category,note,amount_cents FROM transactions "
   "WHERE uid=? AND kind='income' AND substr(entry_date,1,7)=?",(uid,month)):
  category=entry["category"]
  tag="APLICATIVO" if category in ("APLICATIVO","Corridas","Corridas Uber","Corridas 99") else "OUTROS"
  amount=int(entry["amount_cents"])
  income_labels[tag]+=amount
  if tag=="APLICATIVO":
   note=str(entry["note"] or "")
   source=re.match(r"^Origem: (Uber|99|inDrive|Urbano Norte|iFood|Rappi|Loggi) \| ",note)
   origin=(source.group(1) if source else
     "Uber" if category=="Corridas Uber" else
     "99" if category=="Corridas 99" else "Não informado")
   app_sources[origin]=app_sources.get(origin,0)+amount
 pending=c.execute("SELECT COUNT(*) FROM finance_agent_proposals "
    "WHERE uid=? AND status='pending'",(uid,)).fetchone()[0]
 return {"month":month,"label":f"{MONTHS[at.month-1].capitalize()}/{at.year}",
         "income":income,"expense":expense,"balance":income-expense,"categories":cats,
         "income_labels":income_labels,"app_sources":app_sources,
         "pending":pending,"has_data":bool(rows)}

def report_text(data,seed):
 if not data["has_data"]:
  return ("📊 *Seu resumo de "+data["label"]+"*\n\n"
    "Ainda não encontrei ganhos ou despesas *confirmados* neste mês. "
    + (f"Você tem {data['pending']} sugestão(ões) aguardando confirmação. " if data["pending"] else
       "Me conte seu primeiro ganho ou gasto. ") +
    "\nAssim que você confirmar os lançamentos, preparo seu relatório por aqui. 😊")
 header=say(seed,
   "📊 *Olha só como está seu mês!*",
   "📊 *Seu dinheiro, bem explicadinho:*",
   "📊 *Preparei seu resumo financeiro:*")
 lines=[header,"*"+data["label"]+"*",
        f"💰 Entradas registradas: *{money(data['income'])}*",
        f"🧾 Despesas confirmadas: *{money(data['expense'])}*",
        f"📌 Diferença entre entradas e despesas: *{money(data['balance'])}*"]
 if data.get("income_labels") and data["income"]>0:
  labels=data["income_labels"]
  lines.append("🚗 Aplicativo: *"+money(labels.get("APLICATIVO",0))+
    "* | Outros: *"+money(labels.get("OUTROS",0))+"*")
  sources=data.get("app_sources") or {}
  named=[(name,amount) for name,amount in sorted(sources.items(),key=lambda x:-x[1])
     if name!="Não informado"]
  if named:
   lines.append("Origens: "+", ".join(f"{k} {money(v)}" for k,v in named[:2]))
 if data["categories"]:
  lines.append("\n*Onde você gastou:*")
  peak=max(v for _,v in data["categories"])
  for cat,value in data["categories"][:3]:
   blocks=max(1,round(value/peak*7))
   lines.append(f"{'▰'*blocks} {cat}: {money(value)}")
 if data["balance"]>=0:
  lines.append("\n💚 Pelos valores anotados, entrou pelo menos tanto quanto saiu. Continue registrando para enxergar sua evolução.")
 else:
  lines.append("\n💡 As despesas anotadas superaram as entradas. Vale revisar as maiores categorias, sem culpa.")
 if data["pending"]:
  lines.append(f"⏳ {data['pending']} sugestão(ões) aguardando sua confirmação não entram nesses totais.")
 lines.append("📍 Isso é um resumo dos seus registros, não o saldo do banco. Reservas e investimentos ainda não são acompanhados separadamente.")
 return "\n".join(lines)

def propose_text(proposal,pid,seed):
 kind=proposal.get("kind")
 amount=proposal.get("amount")
 category=proposal.get("category") or "a conferir"
 if kind in ("expense","income") and amount and proposal.get("status")=="ready":
  start=say(seed,
    "Anotei a informação para você conferir! ✍️",
    "Entendi, vamos organizar isso. ✨",
    "Boa! Só me confirma um detalhe. 🙂")
  kind_label="Despesa" if kind=="expense" else "Entrada"
  origin=proposal.get("merchant") if kind=="income" else None
  origin_text=f"\nOrigem: *{origin}*" if origin in (
    "Uber","99","inDrive","Urbano Norte","iFood","Rappi","Loggi","Extra","Particular") else ""
  return (f"{start}\n{kind_label}: *{money(round(float(amount)*100))}*\n"
   f"Etiqueta: *{category}*{origin_text}\n\n"
   "Está tudo certinho? Pode responder do seu jeito, como *ok*, *sim*, *blza* "
   "ou *top*. 🙂 Se algo estiver errado, me diga o que corrigir.\n"
   "Ainda não registrei nada.")
 return ("Só preciso entender melhor esse lançamento. 🙂\n"
  "Não identifiquei com segurança o valor ou a categoria. "
  "Me envie novamente com um pouco mais de detalhe, como *Gastei R$ 50 de gasolina* "
  "ou *Ganhei R$ 200 nas corridas*. Assim consigo te ajudar por aqui mesmo. "
  "Não registrei nada.")

def confirmed_text(proposal,seed):
 category=proposal["category"]
 amount=money(round(float(proposal["amount"])*100))
 return say(seed,
  f"✅ Feito! Registrei *{amount}* em *{category}*. Obrigado por manter seus dados em dia!",
  f"✅ Tudo certo: *{amount}* em *{category}* entrou no seu controle. Seguimos juntos!",
  f"✅ Prontinho! *{amount}* em *{category}* confirmado. Cada registro deixa seu mês mais claro.")

def discarded_text(seed):
 return say(seed,
  "Combinado! Descartei a sugestão. Nenhuma despesa foi registrada.",
  "Tudo certo, cancelei esse lançamento. Seu financeiro continua como estava.",
  "Feito! Essa sugestão foi descartada, sem mexer nos seus registros.")

def outside_text(seed,base):
 return say(seed,base,
  "😄 Posso te ajudar com dinheiro, corridas, gastos e metas. Para outros assuntos, vou ficar devendo! Quer registrar algo ou ver seu resumo?",
  "Meu volante é financeiro! 🚗 Posso anotar seus ganhos, organizar despesas ou mostrar como está o mês. Quer começar por onde?")
