# Testes executados — V5

- Node verificou sintaxe do JavaScript.
- Python compilou os arquivos da API.
- FastAPI importou e inicializou sem dados bancários ou WhatsApp.
- HTTP GET /health retornou 200 em localhost e via Tailscale HTTPS.
- Endpoint /api/profile sem autenticação recusado com HTTP 401.
- Perfil de motorista de teste salvo com criptografia e progresso retornado corretamente.
- Dados de CPF protegidos e documentos bloqueados até homologação.
- Tentativa de motorista de consultar rotas administrativas recusada com HTTP 403.
- Receita/despesa manual lançada e resultado parcial atualizado.
- Consultor interno interpretou uma despesa e respondeu sobre resultado; histórico salvo.
- Backup criptografado restaurado em teste com integridade SQLite verificada.
- Serviço e timer agendado ativos no systemd.

Não foram executados: fluxo visual completo em navegador com usuários finais, testes de carga para 1000+ usuários, pentest, restauração em outra VPS, configuração de domínio público, aprovação jurídica para documentação real. Banco e WhatsApp foram excluídos por solicitação.

8 testes de WAHA bridge: permissão, proteção da URL, configuração cifrada, estado parado, QR simulado, reset e nenhum envio. Integração real ainda não configurada.

V5.1 Socioeconomico: 7 testes de preenchimento por etapas, persistencia, 38 campos, autorizacao assistida e revogacao. Regressao: 7 testes de distribuicao e 8 de WAHA, sem alteracao de dados reais.

V5.2: nove testes de liberação após autorização, gravação criptografada, CNH em sandbox, privacidade por usuário, assistência do gestor, revogação e compatibilidade.

Etapa 2: 8 testes de API com SQLite isolado, 6 renderizações simuladas (gestor e motorista), e reexecução das suítes anteriores.

Etapa 3 — segurança: TOTP e recuperação de uso único com testes de login real em banco isolado; verificação de backup criptografado restaurado num banco temporário; timer de monitoramento local a cada 15 min; repetição das suítes prévias. Publicação definitiva depende de domínio, backup externo, LGPD e pentest independente.

Agente financeiro V1: 13 testes isolados de classificação, consentimento, confirmação sem duplicação, media mock, chave redigida e tendências; 9 testes assinados de WAHA/webhook/vínculo; 3 cenários simulados de UI. Mídias não foram processadas com provedor real e o webhook continua desligado.

DeepSeek Flash: 6 testes de provedor simulado, URL, identificador do modelo, formato JSON, autorizacao separada de texto, audio sem endpoint e nao exposicao de segredo. Testes autenticados com chave real ainda pendentes.

Whisper Base local: modelo offline armazenado em models/whisper/base.pt (excluido do Git); worker whisper_local_worker.py (decodificacao FFmpeg em memoria), teste deploy/test_whisper_local.py para MIME, bloqueio de concorrencia e erros seguros. A transcricao de voz sintetica em portugues e exercitada antes de declarar a integracao operante.

Liberação do agente no portal: 8 testes isolados de status/opt-in/pausa/isolamento/confirmacao, 3 testes simulados de painel. DeepSeek validado com cupom inteiramente ficticio de R$27,50. WhatsApp e Pix mantidos desligados.

Página pública inicial e acesso unificado: 7 verificações em deploy/test_public_landing_ui.js (home, login de motorista, gestor, convite, demonstração, convite por URL e perfil), HTML + JS válidos e regressões existentes. Homologação visual em celular ainda recomendada.

Identidade NOVAGENTE nos créditos: rodapé público e painel interno usam apenas a assinatura visual SISTEMA NOVAGENTE · 2026 · V7; retiradas expressões de iniciativa/projeto e menções em títulos, sem mudar permissões, versão de backend ou cabeçalhos CSRF. Suite: deploy/test_branding_footer_v7.js.

Acesso temporário de teste: gestão recuperada com script oficial e troca inicial obrigatória; motorista novo expira em sete dias, sem dados e permissões herdados. Sete verificações isoladas de login, isolamento, perfil e expiração aprovadas. Verificação automática com senhas reais bloqueada pela proteção de credenciais da ferramenta.

Porteiro financeiro e quotas diárias: 20 análises de texto com IA por motorista/dia, 5 fotos, 5 áudios e reserva de 3 gráficos futuros. Testes: deploy/test_finance_scope_limits.py, deploy/test_deepseek_flash.py e deploy/test_finance_agent_waha.py; sem WhatsApp automático. Respostas fora do escopo e registros financeiros simples não chamam DeepSeek.

Piloto WhatsApp exclusivo: sessão WORKING; HMAC configurado e validado localmente, relay bind 172.17.0.1:8892, UFW origem docker 172.17.0.6, apenas conta motorista de teste autorizada após código. Testes isolados de vínculo, resposta, CONFIRMAR exatamente uma vez, conta não autorizada, HMAC inválida, quotas e mensagem fora do escopo. Sem número vinculado nem envios reais no provisionamento.

Falha transitória de conexão WAHA: deploy/test_waha_connection_resilience.py confirma GET com uma repetição segura, POST sem repetição, recuperação e erro persistente. Administração mostra WORKING e desativa reemparelhamento.

Marcar todas as autorizações: teste isolado `deploy/test_consent_select_all_ui.js` com 7 cenários, inclusive estado parcial, separação do compartilhamento, remoção geral, confirmação da identidade e nenhum PUT antes de salvar. Regressões `deploy/test_identity_authorization.py` (9 cenários) preservadas.

Acesso restrito em tela WAHA após troca de conta: scripts deploy/test_waha_role_handoff.py e deploy/test_waha_role_handoff_ui.js validam redirecionamento para motorista, proibição de acesso administrativo, acesso somente leitura ao estado WORKING para o piloto e isolamento de contas.

Orientação de vinculação e código pendente: Finance agent UI distingue sem código/código ativo/número vinculado; link-status oferece apenas sinalizador e minutos sem revelar código. Verificações: deploy/test_finance_agent_ui.js, deploy/test_finance_agent_waha.py, deploy/test_waha_role_handoff.py, deploy/test_finance_scope_limits.py. Sem mensagens reais enviadas na preparação.

Vínculo enviado pelo próprio WhatsApp pareado: histórico WAHA mostrou comando correto com fromMe=true; manter bloqueio. Painel do piloto identifica número do Clube (destino) versus outra conta (remetente), e webhook aceita sender opaco @lid quando mensagem recebida, sem alterar HMAC/opt-in. Testes em deploy/test_finance_agent_waha.py, test_waha_role_handoff.py e test_finance_agent_ui.js.

Boas-vindas com AJUDA no WhatsApp: o teste deploy/test_finance_agent_waha.py confirma acolhimento, confirmação explícita antes de registrar, texto abaixo de 850 caracteres, retorno à palavra AJUDA sem IA, sem lançamento e sem mensagem duplicada. O envio real não foi acionado na mudança.

Conversação WhatsApp V2: regressões em deploy/test_finance_agent_waha.py para entrada do supermercado, confirmação por comando curto sem número, gasolina 90,00 por regra local, confimar, não duplicar após reenvio, negar relatório sem consentimento, resumo mensal categorizado de registros confirmados, JPEG local via WAHA simulado e limite de três gráficos/dia. Sem disparos reais durante QA.

Relatório solicitado no WhatsApp sem acesso ao site: deploy/test_finance_agent_waha.py prova que relatório mensal com dados confirmados e JPEG pode ser entregue após pedido direto do contato autorizado mesmo com trends desligado, sem alterar consentimento persistente, sem AI e mantendo GET /api/finance-agent/insights bloqueado. Também valida autorização/revogação expressa de mídia por comandos WhatsApp, sem modificar ofertas, tendências ou texto externo, e sem envio de mídia a IA antes da autorização.

Confirmação natural do motorista: testes em deploy/test_finance_agent_waha.py verificam respostas positivas simples como ok/blza/sim/isso/confirma/falow/top/tá bom/legal/s, variações com acentos e pontuação, rejeição de frases completas misturadas, espera de até 15 min pela última proposta efetivamente enviada no chat vinculado, dúvidas com marca/talvez/não sem lançamento, limpeza de contexto após mudar de assunto, falta de categoria sem salvamento e continuidade do comando explícito com ID. Sem chamadas à IA nem WAHA real durante QA.

Etiquetas de origem de entradas: deploy/test_finance_agent.py e deploy/test_finance_agent_waha.py verificam APLICATIVO para Uber/99/inDrive/Urbano Norte/corrida/passageiro/cliente, OUTROS para extra/gorjeta/avulso/particular, diferença R$ 99 vs app 99, confirmação contextual antes de persistir, origem no campo de observação e relatório por canal com retrocompatibilidade de categorias antigas. Sem modelos reais nem mensagens enviadas no teste.
