"""Resource guard and offline topic router for the driver finance agent.

No AI calls for greetings, unsupported subjects, common financial registrations,
or financial-navigation questions. Fixed policy: text model calls 20/day;
images 5/day; audio 5/day. Charts 3/day when a chart renderer is introduced.
"""
import datetime,re,unicodedata
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from app import db,now

TZ=ZoneInfo("America/Porto_Velho")
LIMITS={"text_ai":20,"audio":5,"image":5,"chart":3}
OUT_OF_SCOPE=("😄 Sou seu copiloto financeiro! Meu trabalho é cuidar dos seus ganhos, "
 "gastos e metas. Posso registrar uma despesa, acompanhar suas entradas ou mostrar "
 "onde está indo seu dinheiro. Por onde começamos?")
WELCOME=("Olá! 👋 Sou seu copiloto financeiro. Me conte um ganho ou gasto, por exemplo: "
 "“Gastei R$ 80 com gasolina”. Também posso ajudar você a acompanhar suas metas.")
FINANCE_QUERY=("📊 Posso ajudar com seu resumo financeiro e suas metas. "
 "Na aba Agente financeiro, você pode autorizar a análise de tendências "
 "para ver seus gastos confirmados por categoria. "
 "Também posso anotar seu próximo ganho ou despesa.")
def plain(text):
 t=unicodedata.normalize("NFKD",str(text).casefold())
 return "".join(ch for ch in t if not unicodedata.combining(ch))
FINANCIAL=re.compile(
 r"\b(?:gastei|gasto|gastos|gastando|despesa|despesas|custo|custos|custou|paguei|pagar|pagamento|"
 r"abasteci|abastecer|gasolina|combustivel|etanol|diesel|gnv|posto|uber|corrida|corridas|"
 r"99|indrive|urbano norte|ifood|rappi|delivery|rodar|passageiro|passageiros|cliente|"
 r"peguei|gorjeta|extra|bonus|bonificacao|recebi|recebido|receber|ganhei|ganho|ganhos|faturei|faturamento|"
 r"renda|salario|rendimento|entrada|entradas|saldo|sobrou|sobra|economizar|economia|"
 r"dinheiro|reais|r\s*\$|mercado|supermercado|compras|comprei|farmacia|remedio|"
 r"medicamento|oficina|manutencao|oleo|pneu|aluguel|contas|boleto|luz|agua|"
 r"internet|restaurante|almoco|almoço|almocei|jantei|lanche|educacao|curso|fatura|divida|"
 r"parcela|parcelamento|investi|investimento|investimentos|reserva|poupanca|"
 r"guardei|guardar|meta|metas|objetivo|objetivos|sonho|carro|veiculo|seguro|"
 r"planejamento|orcamento|financeiro|financas|extrato|lucro|comissao|rendimentos)\b",re.I)
QUERY=re.compile(
 r"\b(?:onde|quanto|quais|qual|resumo|relatorio|relatorio|grafico|dashboard|extrato|"
 r"mostra|mostrar|mostre|consulta|consultar|como estou|situacao|evolucao|progresso|"
 r"acompanhar|compare|comparar)\b",re.I)
OFFTOPIC_REQUEST=re.compile(
 r"\b(?:piada|poema|historia engraçada|historia divertida|receita de bolo|"
 r"receita culinaria|placar|futebol|previsao do tempo|clima|noticias|novela|"
 r"filme|serie de tv|horoscopo|musica|letra de musica|traducao|traduza|"
 r"imagem de|desenho de|codigo python|codigo de programa)\b",re.I)
TRANSACTION=re.compile(
 r"\b(?:gastei|paguei|recebi|ganhei|faturei|comprei|abasteci|investi|"
 r"peguei|vendi|"
 r"guardei|renda|faturamento|despesa|ganhos)\b",re.I)
HELP_QUERY=re.compile(
 r"\b(?:quero|como faco|me ajuda|ajudar|posso|devo|dica|conselho|"
 r"preciso|pretendo|vale a pena|planejar)\b",re.I)
GREETING=re.compile(r"^(?:oi+|ola+|opa+|bom dia|boa tarde|boa noite|e ai|tudo bem|hello|hey)[!?.\s]*$")
MONETARY=re.compile(r"(?:r\s*\$\s*\d|\b\d{1,7}(?:[,.]\d{1,2})?\s*(?:reais|real)\b)",re.I)
def route(text):
 raw=str(text).strip()
 if not raw:return "out_of_scope"
 s=plain(raw)
 if len(s)>1500:return "out_of_scope"
 if GREETING.fullmatch(s):return "greeting"
 if OFFTOPIC_REQUEST.search(s) and not TRANSACTION.search(s) and not MONETARY.search(s):
  return "out_of_scope"
 if not FINANCIAL.search(s):
  return "record" if MONETARY.search(s) else "out_of_scope"
 # Explicit "quanto/onde gastei" is a reporting request, not another expense.
 if re.match(r"^(?:quanto|onde|mostra|mostre|me mostra|qual|quais|resumo|como estou)\b",s) and not MONETARY.search(s):
  return "query"
 # Other financial planning questions, if not a transaction, use local guidance.
 if (QUERY.search(s) or HELP_QUERY.search(s)) and not TRANSACTION.search(s) and not MONETARY.search(s):
  return "query"
 return "record"

def init(c):
 c.execute("""CREATE TABLE IF NOT EXISTS finance_agent_usage(
 id INTEGER PRIMARY KEY,uid INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 day TEXT NOT NULL,kind TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('reserved','completed')),
 created_at TEXT NOT NULL)""")
 c.execute("CREATE INDEX IF NOT EXISTS ix_finance_agent_usage ON finance_agent_usage(uid,day,kind,status)")
 c.commit()
with db() as _c:init(_c)

def day():return datetime.datetime.now(TZ).date().isoformat()

def usage(c,uid):
 current=day()
 counts={r["kind"]:int(r["n"]) for r in c.execute(
  "SELECT kind,COUNT(*) n FROM finance_agent_usage WHERE uid=? AND day=? "
  "AND status IN ('reserved','completed') GROUP BY kind",(uid,current))}
 return {"timezone":"America/Porto_Velho","date":current,
         "limits":dict(LIMITS),"used":{k:counts.get(k,0) for k in LIMITS},
         "remaining":{k:max(0,v-counts.get(k,0)) for k,v in LIMITS.items()}}

def reserve(uid,kind):
 if kind not in LIMITS:raise ValueError("Unknown agent usage quota")
 # Short transactions make concurrency safe for simultaneous WhatsApp events.
 with db() as c:
  c.execute("BEGIN IMMEDIATE")
  # Clear abandoned reservations only (for example app restarted during a model call).
  cutoff=(datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(minutes=4)).isoformat(timespec="seconds")
  c.execute("DELETE FROM finance_agent_usage WHERE status='reserved' AND created_at<?",(cutoff,))
  current=day()
  n=c.execute("SELECT COUNT(*) FROM finance_agent_usage WHERE uid=? AND day=? AND kind=?",
      (uid,current,kind)).fetchone()[0]
  if n>=LIMITS[kind]:
   raise HTTPException(429,
    f"Você já usou as {LIMITS[kind]} análises de {kind_label(kind)} de hoje. "
    "Amanhã seu limite renova. Registrar ganhos e gastos simples continua disponível.")
  cursor=c.execute("INSERT INTO finance_agent_usage(uid,day,kind,status,created_at) VALUES(?,?,?,'reserved',?)",
     (uid,current,kind,now()))
  c.commit()
  return cursor.lastrowid

def complete(ticket):
 with db() as c:
  c.execute("UPDATE finance_agent_usage SET status='completed' WHERE id=? AND status='reserved'",(ticket,))
  c.commit()

def refund(ticket):
 with db() as c:
  c.execute("DELETE FROM finance_agent_usage WHERE id=? AND status='reserved'",(ticket,))
  c.commit()

def kind_label(kind):
 return {"text_ai":"texto com IA","audio":"áudio","image":"foto","chart":"gráfico"}[kind]
