"""Deterministic financial classifier: conservative and confirmation-first.

Used for text fallback and as a validator for multimodal extraction. Does not infer
whether purchases are wasteful; mixed grocery and pharmacy baskets need item review.
"""
import re,unicodedata
from decimal import Decimal,InvalidOperation
from datetime import date

CATEGORIES=(
 ("Combustível",("gasolina","etanol","diesel","abastec","posto de gasolina","posto ","combustivel","gng","gnv"),"trabalho_ou_pessoal"),
 ("Supermercado",("supermercado","mercado","atacadao","atacarejo","hortifruti","feira","mercearia","alimentos","compras do mes","carrefour","assai"),"misto"),
 ("Farmácia",("farmacia","drogaria","remedio","medicamento","vitamina","paracetamol","dipirona"),"essencial_ou_pessoal"),
 ("Manutenção do veículo",("oficina","pneu","oleo do carro","troca de oleo","revisao","alinhamento","balanceamento","mecanico","manutencao","borracharia"),"trabalho"),
 ("Alimentação fora",("restaurante","lanchonete","ifood","pizza","lanche","hamburguer","cafe da manha","almocei","jantei"),"variavel"),
 ("Transporte",("estacionamento","pedagio","passagem","mototaxi","taxi"),"trabalho_ou_pessoal"),
 ("Casa e contas",("aluguel","energia","luz","agua","internet","condominio","gas de cozinha"),"essencial"),
 ("Educação",("escola","curso","faculdade","mensalidade escolar","material escolar"),"essencial_ou_opcional"),
 ("Lazer e compras pessoais",("cinema","bar ","cerveja","bebida","shopping","roupa","perfume","streaming","netflix","jogo","show ","festa"),"opcional"),
)
# APLICATIVO vs OUTROS are the standard labels for NEW income entries.
# Store the named app/extra source separately in the pending proposal.
INCOME_APPS=(
 ("Uber",r"\buber\b"),
 ("99",r"\b(?:da|na|no|pela|pelo|app|aplicativo|plataforma)\s+99\b|\b99\s+(?:pop|taxi|app|aplicativo)\b"),
 ("inDrive",r"\bindrive\b|\bin drive\b"),("Urbano Norte",r"\burbano norte\b"),
 ("iFood",r"\bifood\b"),("Rappi",r"\brappi\b"),("Loggi",r"\bloggi\b")
)
RIDE_HINT=re.compile(r"\b(?:corrida|corridas|passageiro|passageiros|"
 r"peguei\s+(?:um\s+|uma\s+)?cliente|peguei\s+(?:um\s+|uma\s+)?passageiro|"
 r"motorista de aplicativo|app de corrida|rodada do app)\b")
EXTRA_HINT=re.compile(r"\b(?:gorjeta|extra|extras|valor a mais|"
 r"pagamento adicional|a mais|renda extra|bonificacao|premio|premiacao|"
 r"bico|venda de|vendi|salario|comissao avulsa|presente|"
 r"reembolso|devolucao|emprestimo recebido)\b")
PRIVATE_HINT=re.compile(r"\b(?:particular|por fora|cliente direto|fora do aplicativo|fora do app)\b")
KEY_INCOME=("recebi","ganhei","faturei","rendi","corridas","corrida","passageiro",
 "passageiros","peguei um cliente","peguei cliente","peguei uma cliente",
 "ganho do dia","fiz de uber","fiz na 99","cliente pagou","me pagou",
 "vendi","gorjeta","valor a mais","renda extra")

KEY_EXPENSE=("gastei","paguei","comprei","abasteci","custo","custou","despesa","nota fiscal","cupom fiscal")
MONEY_RE=re.compile(r"(?:r\s*\$\s*|total\s*(?:r\$)?\s*|valor\s*(?:r\$)?\s*)(\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d{1,7}(?:[,.]\d{1,2})?)",re.I)
VERB_MONEY_RE=re.compile(r"\b(?:gastei|paguei|recebi|ganhei|comprei|abasteci|faturei|foi|custou)\s*(?:r\$)?\s*(\d{1,7}(?:[,.]\d{1,2})?)",re.I)
REALS_AMOUNT_RE=re.compile(r"\b(\d{1,7}(?:[,.]\d{1,2})?)\s*reais?\b",re.I)

def plain(text):
 return ''.join(ch for ch in unicodedata.normalize("NFKD",str(text).lower()) if not unicodedata.combining(ch))

def money_value(token):
 try:
  s=str(token).strip()
  if "." in s and "," in s:s=s.replace(".","").replace(",",".")
  elif s.count(".")>1:s=s.replace(".","")
  elif "," in s:s=s.replace(",",".")
  elif "." in s and len(s.split(".")[-1])==3:s=s.replace(".","")
  v=Decimal(s)
  if not v.is_finite() or v<=0 or v>1000000:return None
  return float(v.quantize(Decimal(".01")))
 except (ValueError,InvalidOperation):return None

def income_label(text,previous=None):
 """Revenue label + grounded source. Never treat an unmentioned app as named."""
 normalized=plain(text)
 if EXTRA_HINT.search(normalized):return "OUTROS","Extra"
 if PRIVATE_HINT.search(normalized):return "OUTROS","Particular"
 for name,regex in INCOME_APPS:
  if re.search(regex,normalized):return "APLICATIVO",name
 if RIDE_HINT.search(normalized):return "APLICATIVO",None
 # A provider-generated category is not proof that the driver used an app.
 # Only words actually found in their message can label new income as APLICATIVO.
 return "OUTROS",None

def categorize(text):
 s=plain(text)
 for name,words,nature in CATEGORIES:
  if any(w in s for w in words):return name,nature
 return "Outros / a confirmar","a_confirmar"

def infer_nature(category,text):
 s=plain(text)
 if category=="Supermercado" and any(t in s for t in ("cerveja","cigarro","refrigerante","doce","bebida alcoolica","perfume")):
  return "misto"
 if category=="Farmácia" and any(t in s for t in ("perfume","maquiagem","cosmetico")):
  return "misto"
 if category=="Combustível":
  if any(w in s for w in ("corrida","uber","99","trabalho","rodar","delivery")):
   return "trabalho"
  return "trabalho_ou_pessoal"
 if category=="Lazer e compras pessoais":return "opcional"
 return next((nature for name,_,nature in CATEGORIES if name==category),"a_confirmar")

def classify_text(raw):
 if not isinstance(raw,str) or not 1<=len(raw.strip())<=1500:
  raise ValueError("Informe uma mensagem entre 1 e 1500 caracteres.")
 text=raw.strip()
 s=plain(text)
 matches=list(MONEY_RE.finditer(text))
 if not matches:matches=list(VERB_MONEY_RE.finditer(text))
 if not matches:matches=list(REALS_AMOUNT_RE.finditer(text))
 values=[money_value(m.group(1)) for m in matches]
 values=[v for v in values if v is not None]
 expense=any(x in s for x in KEY_EXPENSE)
 income=any(x in s for x in KEY_INCOME)
 kind="income" if income and not expense else "expense" if expense and not income else None
 cat,nature=categorize(text)
 if kind=="income":
  cat,origin=income_label(text)
  nature="receita"
 else:origin=None
 amount=values[0] if len(set(values))==1 and values else None
 # Short, complete expense statements such as "90,00 de gasolina".
 # Be conservative: a known expense category and a sole leading value are required.
 shorthand=re.fullmatch(
  r"\s*(\d{1,7}(?:[,.]\d{1,2})?)\s*(?:reais?|r\$)?\s*"
  r"(?:de|em|no|na|do|da)\s*"
  r"(?:gasolina|combustivel|etanol|diesel|mercado|supermercado|"
  r"farmacia|remedio|estacionamento|pedagio|restaurante|lanche)\s*[!.]?\s*",s)
 if shorthand and amount is None and kind is None and cat!="Outros / a confirmar":
  amount=money_value(shorthand.group(1))
  kind="expense"
 status="ready" if amount and kind and (kind=="income" or cat!="Outros / a confirmar") else "needs_review"
 question=(
  "Não consegui confirmar o valor. Qual foi o total em reais?"
  if amount is None else
  "Foi uma entrada ou uma despesa?"
  if kind is None else
  "Em qual categoria você colocaria esse gasto?"
  if cat=="Outros / a confirmar" and kind=="expense" else
  "Confirme se o valor, a categoria e o tipo de gasto estão corretos."
 )
 return {"kind":kind,"amount":amount,"category":cat,"nature":nature,
         "merchant":origin if kind=="income" else None,"date":None,"confidence":"moderada" if status=="ready" else "baixa",
         "status":status,"source":"text","summary":text[:350],
         "question":question,"items":[]}

def validate_proposal(obj):
 if not isinstance(obj,dict):raise ValueError("Dados de leitura inválidos.")
 kind=obj.get("kind")
 if kind not in ("income","expense",None):kind=None
 amount=money_value(obj.get("amount")) if obj.get("amount") not in (None,"") else None
 category=str(obj.get("category") or "Outros / a confirmar")[:60]
 origin=None
 if kind=="income":
  category,origin=income_label(str(obj.get("summary") or ""),category)
  nature="receita"
 if kind=="expense" and category not in [x[0] for x in CATEGORIES] and category!="Outros / a confirmar":
  category="Outros / a confirmar"
 desc=str(obj.get("summary") or "")[:350]
 nature="receita" if kind=="income" else infer_nature(category,desc)
 items=obj.get("items") if isinstance(obj.get("items"),list) else []
 items=[{"name":str(x.get("name",""))[:55],
         "amount":money_value(x.get("amount")) if x.get("amount") is not None else None,
         "nature":str(x.get("nature","a_confirmar")) if x.get("nature") in ("essencial","opcional","misto","a_confirmar") else "a_confirmar"}
       for x in items[:30] if isinstance(x,dict)]
 day=obj.get("date")
 if day:
  try:day=date.fromisoformat(str(day)).isoformat()
  except ValueError:day=None
 is_ready=kind is not None and amount is not None and (kind=="income" or category!="Outros / a confirmar")
 return {"kind":kind,"amount":amount,"category":category,"nature":nature,
 "merchant":(origin if kind=="income" else str(obj.get("merchant") or "")[:90] or None),"date":day,
 "confidence":"moderada" if is_ready else "baixa","status":"ready" if is_ready else "needs_review",
 "source":str(obj.get("source") or "media")[:12],"summary":desc,"items":items,
 "question":"Confira o valor, o tipo e a categoria antes de salvar. Alguns itens podem exigir revisão."}

def tips(categories,amounts):
 """Show soft, optional guidance from *confirmed* records only."""
 notes=[]
 for cat,total in sorted(amounts.items(),key=lambda x:-x[1]):
  if cat in ("Lazer e compras pessoais","Alimentação fora") and total>0:
   notes.append(f"Você registrou R$ {total:.2f} em {cat.lower()}. Se quiser economizar, experimente definir um limite semanal para essa categoria.")
  if cat=="Combustível" and total>0:
   notes.append("O combustível tem peso importante no trabalho. Vale comparar postos e acompanhar quilômetros rodados para entender o custo por corrida.")
  if cat=="Supermercado" and total>0:
   notes.append("Planejar a lista de compras e comparar preços pode ajudar. Uma compra de supermercado pode incluir itens essenciais e opcionais.")
  if cat=="Farmácia" and total>0:
   notes.append("Na farmácia, evite cortar medicamentos necessários. Quando apropriado, peça orientação profissional sobre alternativas mais econômicas.")
 return notes[:4] or ["Registre mais dias para identificar padrões. O objetivo é organizar suas escolhas, sem julgar gastos isolados."]
