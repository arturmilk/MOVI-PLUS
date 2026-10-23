# NOVAGENTE — Clube do Motorista V5

Versão segura interna, sem integração bancária e sem WhatsApp.

## Funções implementadas
- Login individual, hash scrypt, cookie seguro, troca de senha inicial obrigatória.
- Convite único de 48 horas, aprovação de cadastro e controle de papéis.
- As 23 perguntas socioeconômicas do formulário original e 15 complementares.
- Cadastro progressivo, entrevista guiada e dados criptografados no banco.
- Lançamentos manuais de ganhos e despesas e projeções com ressalvas.
- Consultor financeiro interno por regras, histórico de mensagens criptografado.
- Dashboard do gestor, filtros autorizados, exportação CSV sem dados identificadores protegidos.
- Autorizações de análises, campanhas, compartilhamento e documentos independentes.
- Campanhas internas, exportação individual, exclusão solicitada e auditoria.
- Upload e leitura de CNH implementados, mas desligados em ambiente ainda não homologado.
- Serviço systemd ativo e backup diário local cifrado.

## Instalação atual
Pasta: /srv/clube-motorista-v3/financeiro-secure-v5
Serviço: novagente-clube-motorista-v5.service
Servidor: 127.0.0.1:8891
Acesso HTTPS privado Tailscale: https://srv1767127.tail508f09.ts.net:8454/
Agendamento backup: novagente-clube-motorista-v5-backup.timer

## Segurança e administração
O administrador gestor é criado pelo comando python manage.py init-admin. Sua senha inicial é gerada e deve ser trocada no primeiro login. O comando python manage.py reset-admin redefine a senha por acesso à VPS.

Os arquivos data/.encryption-key e .backup-master-key são SEGREDOS e nunca devem ir para o GitHub. Guarde cópia da chave de backup em um cofre separado. O backup local de 14 dias não substitui cópia externa.

## Limites e pré-requisitos para o público
Sem saldo bancário, API de banco, cobrança, transferências Pix e WhatsApp. Os valores são sempre declarações do usuário, não conciliação efetiva.

Para abrir cadastro com CPF/RG/CNH reais: homologação LGPD, política de privacidade e contratos revisados, endereço público HTTPS definido, MFA administrativa, segurança de borda, backup externo, monitoramento e teste de intrusão. Até isso ocorrer, mantenha CLUBE_ENABLE_SENSITIVE=0.

O sistema de conversa é local baseado em regras, não é um modelo de IA generativa nem substitui consultoria financeira profissional.

## Reinício e diagnóstico
Reinício: sudo systemctl restart novagente-clube-motorista-v5.service
Saúde: curl http://127.0.0.1:8891/health
Backup manual: python backup.py (a partir da pasta do sistema)


## Distribuição gráfica (painel novo)

A aba **Distribuição gráfica** está disponível após login para o gestor e para o motorista, com planejamentos individuais distintos. Inclui gráficos circulares de percentuais por destino, comparação do previsto com o valor informado manualmente como enviado, diagrama radial por categoria e tabela detalhada com CSV. Os percentuais e categorias são editáveis (2 a 8 categorias; soma obrigatória 100%). A prévia ilustrativa de R$ 100 mil e R$ 72,5 mil informados não é dado real; o painel inicial não marca valores enviados automaticamente. Permite impressão e exportação PDF pelo navegador.

API autenticada: `GET /api/distribution-plan`, `PUT /api/distribution-plan`, `DELETE /api/distribution-plan`. Planejamentos são criptografados por usuário, auditados, incluídos no banco SQLite existente e cobertos pelo backup diário. **Nenhuma transferência é feita e nenhum valor marcado como enviado é verificado em banco.** O módulo não depende de WhatsApp nem de API bancária.


## WhatsApp: caminho de emparelhamento pronto (WAHA)

A nova aba administrativa **WhatsApp · Conexão** prepara uma sessão WAHA exclusiva, sem ativar o envio/recebimento de mensagens.
O administrador informa a URL WAHA, nome da sessão e chave de API. A chave fica criptografada no banco, não aparece depois de salva.
Ao clicar, é possível: verificar a instância, criar a sessão em estado STOPPED, iniciar e consultar QR temporário. Cada ação depende de clique explícito.
Não foi criada nem emparelhada nenhuma sessão real. Não foram configurados webhooks nem realizados disparos.
Para continuar: informar endereço WAHA alcançável pela VPS e a respectiva API key. Recomendado: localhost com encaminhamento de porta seguro ou URL HTTPS/Tailscale. A sessão não pode se chamar default/main nem reutilizar sessão de outro projeto.
API somente administração: GET/PUT/DELETE /api/admin/whatsapp-bridge e POST /api/admin/whatsapp-bridge/check, /create, /start, /qr.
Antes de mensagens reais: identificação dos motoristas, opt-in explícito, opt-out, autenticação de webhook, privacidade, regras de envio e homologação. Pix inalterado.
Referência: https://waha.devlike.pro/docs/how-to/sessions/

## Cadastro socioeconômico V5.1 — correção de preenchimento

O formulário original de 23 perguntas e as 15 questões complementares permanece integral no sistema. O cadastro agora é exibido em cinco etapas: Trabalho e renda; Bancos e situação financeira; Veículo e renovação; Metas e despesas; Identificação e documentos. O motorista pode salvar cada etapa e continuar depois, e a interface indica exatamente qual campo deve ser corrigido em caso de resposta inválida.

Campos identificadores protegidos continuam bloqueados na prévia pública (nome completo, CPF, RG, nascimento, email, endereço, WhatsApp, placa e arquivo CNH). Eles só poderão receber dados reais após homologação jurídica e de segurança. O progresso no piloto considera apenas campos habilitados.

**Ajuda do gestor sem infringir a privacidade:** o motorista deve autorizar separadamente, na aba Autorizações, tanto a análise socioeconômica quanto o preenchimento assistido (ambos desativados por padrão). A partir daí o administrador usa Motoristas → Detalhar → Preencher cadastro autorizado, podendo registrar somente respostas não protegidas. A revogação bloqueia imediatamente os endpoints de edição assistida. Nenhuma autorização foi concedida automaticamente.

Arquivos adicionados: static/socio-progress-v5.js e socio_assisted_v5.py; teste isolado deploy/test_socio_progress.py. Os testes de distribuição e WAHA existentes também foram executados após a alteração.

## Liberação de identificação por autorização individual (V5.2)

O motorista pode liberar os campos de identificação pessoal **após optar explicitamente** pela nova finalidade **Cadastro de identificação pessoal** na aba Autorizações. O consentimento existe separadamente de marketing, análise comercial, consulta de documentos e preenchimento assistido. O valor inicial é falso, inclusive para usuários que já haviam autorizado outros tratamentos.

Com a autorização, o próprio motorista pode preencher nome, CPF, RG, nascimento, e-mail, endereço com CEP, WhatsApp e placa; a CNH pode ser anexada na aba Documentos (PDF, JPG ou PNG, máximo 8 MB, até 5 arquivos). O banco salva os dados pessoais em JSON criptografado, documentos são criptografados em arquivos privados.

O gestor só acessa a edição desses campos no painel de preenchimento assistido quando o motorista autoriza **análise socioeconômica + preenchimento assistido + cadastro de identificação pessoal**. A exportação comercial e a visão geral administrativa não incluem identificadores sensíveis. O acesso administrativo a documentos exige também a autorização separada de consulta documental.

A revogação do consentimento bloqueia novos envios e novas leituras administrativas dos dados protegidos, mas **não apaga automaticamente** o conteúdo já fornecido; o motorista pode solicitar exclusão na aba Autorizações. Essa etapa não equivale à homologação jurídica, a testes de segurança externos nem à publicação num domínio definitivo. Não utilizar documentos de clientes reais em larga escala antes dessas validações.

Verificações: deploy/test_identity_authorization.py com nove cenários, mais os testes existentes de cadastro, distribuição e WAHA. Nenhuma autorização existente foi alterada automaticamente.

## Etapa 2 — Painel gerencial, benefícios, campanhas e operação (implementada)

A etapa 2 foi integrada ao NOVAGENTE Clube do Motorista V5, sem pagamento bancário e sem envio ou leitura automática de mensagens no WhatsApp.

### Gestor
- **Gestão do Clube**: painel de totais de cadastros, ativos, pendentes, autorizações, entradas e saídas autodeclaradas, resultado parcial, indicadores mensais (seis meses), plataformas, preenchimento do cadastro, solicitações de benefícios, tarefas abertas e campanhas.
- **Relatório CSV**: exportação dos indicadores agregados para um mês, sem CPF ou dados individuais. Indicadores financeiros incluem apenas contas ativas com autorização de análise.
- **Benefícios**: cadastro de nome, descrição, pontos referenciais mínimos, estoque e estado ativo. Avaliação manual dos pedidos e controle de estoque das solicitações aprovadas; nenhuma recompensa automática.
- **Operação**: quadro de tarefas internas, prioridades, responsável, prazo e estados "A fazer", "Em andamento" e "Concluída".
- **Campanhas**: criar rascunhos/publicações visíveis somente dentro do sistema, com segmentação geral ou por plataforma, anexar uma mídia (PNG, JPG, GIF, WebP, MP4 ou MP3; até 8MB). Mídias cifradas, acesso autenticado; campanhas específicas de plataforma só aparecem mediante autorização de campanhas **e** análise. A aba também preserva a leitura de campanhas legadas.

### Motorista
- **Benefícios**: consulta da própria pontuação indicativa (até 60 pontos por percentual de cadastro preenchido e até 40 por dias distintos com registro financeiro nos últimos 90 dias), catálogo e solicitação de benefício com aprovação humana.
- **Novidades**: leitura apenas das campanhas autorizadas para seu perfil; sem mensagens externas.

**Importante:** a pontuação se baseia em registros autodeclarados e não em depósitos comprovados. O sistema não confirma pagamentos, não distribui recompensas automaticamente e não aciona Pix ou WhatsApp. Não usar a pontuação para decisões de crédito.

### Segurança e validação
- API administrativa protegida; conteúdo/mídias de campanhas filtrados pelas autorizações independentes.
- Comprovantes e movimentações financeiras reais são escopo da etapa 1/etapa 4, não da etapa 2.
- Mídias são salvas criptografadas em `data/program-media/`, com backup cifrado pelo serviço de backup da V5.
- Testes: `deploy/test_stage2.py` (8 testes de integração com banco isolado) e `deploy/test_stage2_ui.js` (6 cenários de renderização), além das suítes anteriores.
- Implantação local no serviço `novagente-clube-motorista-v5.service`. O domínio público da prévia continua temporário e a homologação de segurança/LGPD permanece pendente.

## Etapa 3 — Testes, segurança e publicação (base técnica concluída; homologação pendente)

**Implementado:**
- MFA administrativo TOTP, disponível em Conta, com configuração protegida por senha, confirmação inicial por código válido e oito códigos de recuperação de uso único. O recurso **não está ativado até o administrador concluir pessoalmente a configuração**. Após a ativação, os outros logins administrativos anteriores são revogados.
- Proteção contra reuso de código no mesmo intervalo e limitação de tentativas de configuração/confirmacão/desativação. O login só emite cookie autenticado depois de validar o segundo fator quando ativo.
- `healthcheck_stage3.py` e timer `novagente-clube-motorista-v5-health.timer`, executado a cada 15 minutos. Valida endpoint HTTP interno, integridade SQLite e existência de backup local recente (menos de 36h). Grava o estado sem dados pessoais em `data/operations-health.json`; falhas ficam registradas no journal local do systemd. **Não envia alertas externos.**
- Restauração de um backup criptografado em ambiente temporário, sem alterar o banco principal, com teste SQLite `integrity_check=ok`.
- Painel do gestor em Conta → Prontidão para publicação: mostra MFA, checagens e pendências externas explicitamente não homologadas.
- Testes automatizados existentes de cadastro, autorizações, WAHA (sem disparos), distribuição, operações e campanhas reexecutados após alterações; teste MFA isolado `deploy/test_stage3_mfa.py`.

**Ainda falta para domínio público definitivo:**
1. Usuário escolher e disponibilizar o domínio/subdomínio final. O link `.trycloudflare.com` é uma prévia temporária e não deve ser tratado como domínio permanente. Configurar túnel Cloudflare nomeado, DNS e certificado TLS do hostname escolhido, depois testar redirecionamentos e disponibilidade.
2. Definir uma conta ou destino seguro **fora da VPS** e os responsáveis pela guarda da chave mestra, então implantar e testar o backup off-site criptografado. O backup diário atual ainda está no próprio servidor.
3. O próprio administrador confirmar a ativação de MFA em Conta e guardar os códigos de recuperação, idealmente fora do mesmo computador.
4. Fazer homologação jurídica: política de privacidade, termos, finalidade, base legal LGPD, retenção, exclusão, papéis e aprovação da coleta de documentos e CPF. Não há parecer jurídico assinado no projeto.
5. Avaliação independente de segurança (incluindo pentest, análise de dependências e gestão de vulnerabilidades), testes reais de dispositivos/motoristas e ensaio de carga conforme capacidade esperada antes de convidar centenas/milhares de pessoas.

**Não liberar dados pessoais reais em escala nem anunciar "publicação homologada" até os itens acima estarem concluídos.** O estágio 3 entrega controles básicos e testes, não certifica o sistema.


## Agente financeiro multimodal V1 — preparação segura (texto funcional; áudio/foto sob configuração)

A aba **Agente financeiro** foi adicionada à experiência do motorista, com cadastro de **cinco autorizações independentes** e revogáveis: uso do agente, processamento remoto de texto no DeepSeek, processamento de fotos pelo DeepSeek e de voz pelo Whisper local com texto enviado ao DeepSeek, análise de tendências e ofertas futuras. Todas começam desativadas. A opção de ofertas não publica anúncios nem fornece dados a terceiros.

**Textos** podem ser analisados localmente por regras em português. A primeira leitura vira uma **proposta criptografada**, com valor, categoria, natureza e pergunta de validação. O motorista pode editar tipo de movimentação, data, valor, categoria e observação antes de **confirmar e salvar**; também pode descartar. O sistema grava em `transactions` somente após a confirmação, protegendo contra confirmações duplicadas.

A categorização inicial inclui combustível, supermercado, farmácia, manutenção do veículo, alimentação fora, transporte, casa e contas, educação e lazer/compras pessoais. As categorias podem ser mistas ou dependentes do contexto. **Nenhum gasto é tratado automaticamente como desnecessário** e nunca se recomenda cortar medicamentos necessários.

**Áudios e imagens:** a API está pronta para transcrição de MP3, WAV, M4A e OGG (convertido em memória com ffmpeg), e leitura de JPG, PNG ou WebP por modelos multimodais. Os arquivos são processados em memória e **não são armazenados** pelo Clube. O modelo pode receber os arquivos apenas com autorização multimodal do motorista e depois que o gestor cadastrar uma chave específica do projeto em Conta → Agente financeiro. A chave fica criptografada e nunca é devolvida na API. **A chave DeepSeek cadastrada no ambiente foi validada em 21/10/2026, e o modelo aceitou uma interpretação de frase financeira fictícia. Nenhum documento real de motorista foi enviado nessa validação.** O modelo pode errar; validação é obrigatória. Transcrições por voz passam por interpretação semântica conservadora para números falados por extenso, com fallback que pede confirmação quando houver dúvida. Há limite preventivo de 100 sugestões por motorista/dia e 150 pendentes.

**Tendências financeiras:** somente mediante autorização de análise individual, em cima dos lançamentos manuais/confirmados do próprio motorista. Dicas educativas por categoria e comparação com mês anterior. Não há cruzamento de perfis, consulta bancária, score de crédito, diagnóstico médico ou oferta automatizada.

**WAHA:** adaptador de entrada criado com HMAC-SHA512, janela de timestamp de 5 minutos, deduplicação, rejeição de grupos, ignorar mensagens próprias, vínculo do telefone por código temporário emitido por motorista autenticado e mídias buscadas apenas da instância WAHA dedicada. A confirmação de lançamentos continua no portal, não pela mensagem. **O webhook continua DESATIVADO e NÃO FOI cadastrado na WAHA nem ativado no canal real**. Não são lidas conversas históricas, não há envio de respostas pelo WhatsApp ou disparo de campanhas. Para ativar futuramente: domínio estável HTTPS, configurar callback HMAC na sessão dedicada, habilitar download controlado de mídia na WAHA, chave do provedor de IA, consentimentos e confirmação do motorista e testes com telefones de laboratório.

**Privacidade e exclusão:** exportação dos dados individuais passou a conter consentimentos e sugestões de leitura do agente; sem mídia original, senhas ou chaves. Remoção da conta remove sugestões, ligações e consentimentos por chaves estrangeiras. Registros já confirmados entram no financeiro individual autodeclarado.

Arquivos: `finance_agent_core.py`, `finance_agent_v1.py`, `finance_agent_waha_v1.py`, `static/finance-agent-v1.js`.
Testes isolados: `deploy/test_finance_agent.py` e `deploy/test_finance_agent_waha.py`, com `deploy/test_finance_agent_ui.js`.


## DeepSeek V4.1 Flash - migracao de provedor

O modelo de IA para mensagens escritas e leitura de imagens e DeepSeek V4.1 Flash (model ID deepseek-flash, base https://api.deepseek.com). A analise remota de texto exige consentimento text_ai, distinto da autorizacao media_ai para imagens. Usuarios que nao habilitam text_ai continuam usando as regras financeiras locais. As sugestoes devem ser confirmadas antes de qualquer registro.

Audio: DeepSeek Flash nao tem endpoint de transcricao de voz. Audios OGG/Opus, MP3, WAV e M4A (maximo 7 MB e 90 segundos) sao convertidos em memoria e transcritos por Whisper Base multilingue local via processo Python separado. O texto transcrito segue ao DeepSeek Flash usando a MESMA chave de interpretacao financeira ja cadastrada. A midia bruta nao e enviada a DeepSeek e nao e persistida no sistema. Um unico audio e processado por vez, com limites de CPU/tempo e recusa caso o servidor esteja sem memoria suficiente. A leitura gera uma proposta a ser confirmada pelo motorista, nunca um lancamento automatico. O uso de imagens e audios requer autorizacao media_ai independente.

A chave DeepSeek deve ser adicionada exclusivamente pelo administrador em Conta - Agente financeiro, sem colocacao no repositorio, nas mensagens de log ou em arquivos sem criptografia. O administrador pode testar o acesso via botao Testar API. Foi executada a verificacao autenticada do acesso ao modelo deepseek-flash, incluindo a capacidade declarada de imagens, e uma inferencia textual sintetica. A leitura de uma nota fiscal real permanece pendente de teste controlado e autorizacao. Nunca registrar chaves privadas no repositorio.

A sessao WAHA e sua recepcao automatica continuam intactas e desabilitadas para mensagens do agente. Um audio de teste sintetico em portugues foi transcrito localmente em aproximadamente 15 segundos, mas a fidelidade da transcricao nao foi completa. Antes de uso em larga escala, avaliar a qualidade com diferentes sotaques e ruido de transito; a leitura de valores e a confirmacao humana sao obrigatorias.

## Liberação operacional do agente no portal (piloto controlado)

O agente financeiro NOVAGENTE foi disponibilizado para contas ativas de motorista dentro da V5, separado do WhatsApp e de Pix. A tela do motorista apresenta o destaque "Conhecer e ativar meu agente" no painel inicial e a aba "Agente financeiro". Cada autorização começa desativada e depende da escolha individual do participante.

O gestor tem a aba "Agente financeiro" com estado de disponibilidade, contagem agregada de adesões, consentimento para mídia, sugestões aguardando revisão, confirmadas e descartadas, origens dos registros, estado do DeepSeek Flash e do Whisper Base, e controle de pausa/retomada. O módulo finance_agent_release_v1.py começa disponível para motoristas ativos e nunca altera suas autorizações. Quando o agente é pausado, novos processamentos e confirmações ficam bloqueados, mas registros e consentimentos são preservados.

Um lançamento só entra no financeiro após ser confirmado pelo próprio motorista; nenhuma pontuação ou pagamento é inferido de uma sugestão não confirmada. Dados de motorista não ficam disponíveis neste painel agregado do gestor.

Modelos: DeepSeek Flash com credencial criptografada; cupom fictício de supermercado R$ 27,50 interpretado corretamente em teste com API real; Whisper Base local transcreveu áudio sintético, mas ainda apresentou erros de reconhecimento. Os valores devem ser revisados manualmente. Mensagens automáticas do WhatsApp, ofertas automáticas e serviços Pix não foram habilitados.

Antes de aumentar a escala: testar no celular com motoristas-piloto e ruído de trânsito, homologar privacidade e termos LGPD, ativar MFA, adotar domínio próprio e backup fora da VPS.

Arquivos principais: finance_agent_release_v1.py, static/agent-release-v1.js, deploy/test_agent_release.py, deploy/test_agent_release_ui.js.

## Porta única: apresentação pública e acesso por perfil (21/10/2026)

O endereço raiz do Clube mostra uma página pública para visitantes não autenticados, com explicação sobre ganhos registrados, gastos, metas e agente financeiro, exemplos interativos de combustível, supermercado e receita, uma representação ilustrativa do aplicativo e valores fictícios. Os exemplos não enviam dados ao servidor.

**Acesso unificado:** botões de motorista e link administrativo discreto no rodapé chamam o mesmo login da aplicação. O servidor verifica o papel da conta e abre o painel correto. Selecionar Acesso administrativo não concede privilégios. Permanecem os mecanismos de autenticação, TOTP de gestor quando ativado, convite individual, aprovação de motorista, sessões e alteração de senha.

**Fluxo do convite:** uma URL existente com query convite abre automaticamente o cadastro na janela de login. Após solicitação de cadastro, a página muda para o formulário de entrada. Conta já autenticada não vê a página pública, abrindo o painel direto.

**Acessibilidade:** HTML semântico, modais fecháveis por Escape, restauração do foco, navegação por teclado, CSS responsivo e preferência por movimento reduzido. Arquivos: static/index.html, static/landing-v1.css, static/landing-v1.js, adaptações em static/app.js. Inicialização espera DOMContentLoaded para todos os módulos deferidos terminarem de carregar.

**Piloto:** mantidos robots noindex,nofollow, porque o domínio próprio, homologação LGPD e backup externo ainda são pendências. A página não anuncia Pix nem WhatsApp automáticos como ativos. Nenhum login, senha ou conta nova foi criado.

Validação: node deploy/test_public_landing_ui.js verifica página pública, entrada de motorista e gestor sem alteração de permissão, convite, simulação, redirecionamento por perfil e teclas de navegação. É necessária conferência visual em celular real antes da divulgação em larga escala.

## Identidade e assinatura visual de créditos (21/10/2026)

O nome do produto é **CLUBE DO MOTORISTA**. A marca NOVAGENTE deve aparecer somente nos créditos inferiores, como **SISTEMA NOVAGENTE · 2026 · V7**. Removidas as expressões “Uma iniciativa NOVAGENTE” e “Um projeto NOVAGENTE” da capa. A assinatura aparece na parte inferior da página pública e no rodapé de ambos os painéis autenticados. Os cabeçalhos internos usam o nome do produto para que a marca NOVAGENTE não concorra visualmente com o Clube.

“V7” é **identificação gráfica dos créditos**, não mudança da versão de API FastAPI (`/health`: `5.0`). Rotas de login, perfis administrativos, permissões, tokens de proteção de origem (`NOVAGENTE-V5`), cadastro e banco não foram alterados.

Teste: `node deploy/test_branding_footer_v7.js` mais regressões de navegação, privacidade e autenticação.

## Recuperação do gestor e motorista de teste (21/10/2026)

- O acesso do administrador existente (gestor) foi recuperado pelo comando oficial manage.py reset-admin, que revoga sessões e exige nova senha no primeiro acesso. Senhas e tokens não são registrados no Git.
- Foi criada conta individual motorista, papel driver, ativa por sete dias, com cadastro e financeiro vazios e sem autorizações de marketing/IA automáticas. Senha inicial aleatória forte, criptograficamente hash scrypt. Nenhuma permissão administrativa é concedida.
- A tabela trial_driver_accounts registra vencimento para contas temporárias. O login e a autenticação das sessões existentes recusam acesso após vencer. O mecanismo não altera as contas reais.
- O fluxo de primeira entrada do gestor evita chamar as APIs administrativas extras antes da troca obrigatória, apresentando a opção de alterar senha.
- PIN numérico curto não foi ativado no gestor por risco de acesso indevido a dados financeiros e pessoais; a senha posterior escolhida deverá respeitar o mínimo do sistema de 14 caracteres com letras e números.
- Testes simulados da aplicação foram aprovados, incluindo expiração de sessão, isolamento do motorista e histórico vazio. Verificação automatizada com senhas reais foi bloqueada pela segurança da ferramenta. A prova final pelo navegador do usuário está pendente.

## Porteiro financeiro e orçamento diário de IA (21/10/2026)

O agente financeiro do Clube usa primeiro um roteador por regras (`finance_agent_limits_v1.py`), antes de chamar modelos externos. Ele identifica registros e consultas financeiras, saudações e pedidos fora do escopo. Para conversas fora do assunto, retorna uma mensagem pronta, não cria uma sugestão financeira e não gasta tokens do DeepSeek. Pedidos financeiros de consulta/planejamento recebem uma orientação local de navegação, sem interpretar texto como despesa.

**Limites por motorista por dia local de Porto Velho (America/Porto_Velho):** até 20 interpretações difíceis de texto COM IA, cinco análises de foto e cinco transcrições/interpretações de áudio. O limite de três gráficos por dia foi previsto como reserva para a futura geração de imagens e NÃO significa que a geração de gráficos pelo WhatsApp esteja publicada. Despesas e ganhos simples, entendidos pelas regras locais, não consomem a quota de IA; ainda obedecem às proteções existentes de até 100 propostas/dia e máximo de 150 propostas pendentes.

A quota de uso é registrada por motorista e modalidade no SQLite em `finance_agent_usage`. Reserva antes da chamada externa, controla concorrência por transação SQLite, marca como concluída depois da sugestão e reembolsa a reserva quando há falha. Reservas abandonadas há quatro minutos são eliminadas. O GET `/api/finance-agent/limits` retorna orçamento e saldo individual, sem dados de outros usuários. O piloto não possui ainda teto financeiro global mensal de API: avaliar custo real antes de escalar.

O WhatsApp assinado dispõe do mesmo filtro e dos limites. Para pedidos fora do escopo, o webhook pode produzir `reply_text` como texto sugerido para futura camada de envio. **O adaptador não envia mensagens por WhatsApp automaticamente e essa etapa continua desligada.** A resposta HTTP do webhook não é uma mensagem entregue ao telefone. Ativar saída somente após homologação de vínculo, autorização, domínio estável e controle contra disparos duplicados.

Texto padrão para fora do escopo: `😄 Sou seu copiloto financeiro! Meu trabalho é cuidar dos seus ganhos, gastos e metas. Posso registrar uma despesa, acompanhar suas entradas ou mostrar onde está indo seu dinheiro. Por onde começamos?`

Testes isolados: `deploy/test_finance_scope_limits.py` confirma 20 chamadas de IA/21ª bloqueada, 5 fotos e 5 áudios, fora de escopo, respostas gratuitas, consulta, devolução da quota em falhas, separação entre motoristas, sugestões sem lançamento automático e a reserva do gráfico futuro. `deploy/test_finance_agent_waha.py` confirma que o evento fora do escopo retorna texto pronto sem envio de mensagem.

## Piloto WhatsApp exclusivo: 1 número com prova por código (21/10/2026)

A sessão WAHA `clube-motorista` (CORE, WEBJS) foi configurada com webhook `message` assinado por HMAC-SHA512, com `X-Requested-With: NOVAGENTE-V5`. A conexão é **interna na VPS**: Docker `novagente-clube-motorista-waha` -> `172.17.0.1:8892` (`novagente-clube-motorista-waha-relay.service`, socat) -> aplicação `127.0.0.1:8891/api/finance-agent/whatsapp/events`. A porta 8892 está vinculada exclusivamente a `docker0`; a regra UFW autoriza somente a origem atual `172.17.0.6` ao destino `172.17.0.1:8892`. A chave de assinatura está cifrada no banco, não deve ser exibida nem publicada no Git. Alterar a regra UFW se o IP do contêiner mudar, depois de verificar a nova origem.

A tabela `finance_agent_wa_pilot` restringe a operação à conta de testes `motorista`, papel `driver`, já existente. Essa conta tem expiração e começa sem autorização do agente nem número vinculado. A recepção HMAC está armada exclusivamente para essa conta; eventos de qualquer outra conta ou remetente são ignorados. Outros números não recebem mensagens. Para criar vínculo, o motorista autorizado acessa a aba **Agente financeiro**, concede autorização de uso do agente e aciona **Gerar meu código de teste**. O código `VINCULAR ...` vale 15 minutos e precisa ser enviado pelo WhatsApp de teste à conta pareada do Clube. Somente após validar o código e vincular o identificador do chat, a saída automatizada fica disponível **exclusivamente para esse remetente**. Como o WhatsApp pareado é o número de destino, o remetente do teste precisa ser outra conta do WhatsApp; mensagens `fromMe` são ignoradas.

Fluxo do piloto: **mensagem financeira** -> filtro de tema e orçamento de IA -> sugestão criptografada ainda não registrada -> resposta com categoria, valor e `CONFIRMAR <id>` ou `DESCARTAR <id>` -> somente com confirmação explícita cria transação no livro financeiro e devolve confirmação. Mensagem incompleta pede revisão no sistema. Saudações e assuntos fora do escopo recebem mensagem pronta, sem DeepSeek. As mensagens automáticas são enviadas somente para o chat verificado, por `POST /api/sendText` do WAHA; nenhum grupo, contato não autorizado, divulgação ou campanha são alcançados. Há limite adicional de 60 tentativas de saída por dia e 12 por 10 minutos, sem novas tentativas automáticas para evitar duplicidade. Fotos e áudios continuam limitados a cinco cada, com os consentimentos separados. Não há cobrança nem transferências Pix.

**Status no momento da implantação:** WAHA WORKING, webhook configurado, relay ativo, assinatura real verificada com mensagem *inteiramente fictícia* e nenhum número vinculado ainda. O teste de resposta ponta a ponta no telefone **depende de a titular vincular seu número** e enviar o primeiro texto; não afirmar que já recebeu resposta por WhatsApp.

Para desativar imediatamente: no painel administrativo, `PUT /api/admin/finance-agent/whatsapp/pilot` com `{"enabled":false}` bloqueia saídas e processamento pelo piloto, ou desabilitar `/api/admin/finance-agent/whatsapp/enabled`. Como medida de infraestrutura, parar e desabilitar a unidade `novagente-clube-motorista-waha-relay.service` e remover a regra específica da UFW; reverter a configuração de webhook da sessão somente após avaliar os sistemas relacionados. O sistema regular no site continua utilizável.

Verificações: `deploy/test_finance_agent_waha.py`, `deploy/test_finance_scope_limits.py`, `deploy/test_finance_agent.py`. Nenhum envio real ocorreu na preparação.

## Recuperação de conexão WAHA após reconexão (21/10/2026)

A integração da sessão WAHA `clube-motorista` permaneceu configurada e WORKING, e o erro de comunicação informado pelo painel não foi reproduzido nos testes de leitura da sessão. Como o webhook foi atualizado recentemente e a sessão reiniciou, a hipótese principal é uma indisponibilidade transitória; isso não foi confirmado por logs detalhados. `whatsapp_bridge_v5.waha` passou a fazer no máximo duas tentativas apenas em leituras GET, com intervalo de 0,6 s, timeout de leitura de 12 s e texto de recuperação para o gestor. Nunca repetir POST/PUT/DELETE automaticamente, pois podem gerar operações duplicadas.

A tela administrativa `WhatsApp · Conexão` orienta a consultar **Verificar conexão e sessão** e, ao receber WORKING, desativa botões de Criar sessão, Iniciar e Mostrar QR, evitando despareamentos desnecessários. O quadro de mensagens agora informa o piloto controlado em vez de afirmar que toda mensageria está desativada. **O piloto continua restrito ao único motorista autorizado; nenhum telefone foi vinculado automaticamente.**

Teste: `deploy/test_waha_connection_resilience.py` simula erro transitório seguido de sucesso, não repetição de POST e erro persistente com mensagem compreensível. Os testes de webhook HMAC e outras regressões permanecem válidos. A verificação final será feita ao vivo na WAHA com as credenciais criptografadas já existentes, sem alterar a sessão.

## Seleção múltipla de autorizações (21/10/2026)

A área **Motorista → Autorizações** apresenta a caixa **Marcar todas as 6 autorizações** e o botão **Desmarcar todas**. O estado reflete os consentimentos existentes: marcada se todas estiverem marcadas, parcialmente marcada se algumas estiverem marcadas e desmarcada se nenhuma estiver. O motorista continua podendo ajustar individualmente qualquer permissão, inclusive ofertas e compartilhamento com parceiros; um aviso explícito alerta sobre essas finalidades. A escolha múltipla muda apenas a interface até o clique **Salvar escolhas**. O consentimento para coleta de identificação continua exigindo a confirmação existente antes da gravação. Nenhuma opção é concedida automaticamente. Backend e dados existentes não são modificados. Teste: `node deploy/test_consent_select_all_ui.js`.

## Correção de acesso restrito após alternar gestor e motorista (21/10/2026)

Diagnóstico: a sessão ativa do navegador era de **motorista**, enquanto uma aba ainda mostrava a tela administrativa **WhatsApp · Conexão**; a API negava corretamente o acesso com HTTP 403/Acesso restrito. A WAHA estava em estado **WORKING**; esse aviso não significava perda do pareamento.

A tela administrativa agora consulta a sessão atual em caso de erro de permissão. Quando identifica conta de motorista, atualiza a navegação e leva à aba **Agente financeiro**; se a sessão terminou, abre o login. Não altera regras de permissão nem libera as rotas /api/admin para motoristas.

A conta do motorista piloto dispõe de **GET /api/finance-agent/whatsapp/session-status**, endpoint somente leitura que consulta o estado da sessão WAHA e informa WORKING ou indisponível sem revelar número, URL interna ou chaves. Outros motoristas e o gestor não acessam essa rota. A área **Meu WhatsApp e o agente** exibe independentemente o estado do pareamento da WAHA e o estado do vínculo do número pessoal. A configuração e o QR permanecem exclusivos do gestor. O aviso incorreto “Apenas 1 motorista vinculado” foi corrigido para “Aguardando vínculo do motorista” quando o número ainda não foi vinculado.

Testes: deploy/test_waha_role_handoff.py (5 cenários de privacidade/status) e deploy/test_waha_role_handoff_ui.js (3 cenários de sessão), regressão do painel do agente e webhook. Nenhuma mensagem WhatsApp ou lançamento financeiro foi executado neste ajuste.

## Retorno de vínculo WhatsApp não concluído (21/10/2026)

Investigação após usuário informar que enviou ou tentou vincular WhatsApp e nada aconteceu: a WAHA estava WORKING e o piloto habilitado para a conta motorista, com opt-in do agente já concedido. O servidor não tinha nenhum registro em `finance_agent_link_codes`, `finance_agent_wa_links`, nem auditoria de `finance_agent:link_code_created`. Os registros de requisição HTTP também não continham chamadas à rota POST `/api/finance-agent/whatsapp/link-code`, embora houvesse navegação pela tela de WAHA do gestor. Portanto o código de vínculo nunca foi gerado pela ação autorizada do piloto; não é necessário refazer o QR.

A rota GET `/api/finance-agent/whatsapp/link-status` agora informa apenas `code_active` e `code_minutes_remaining` (sem expor o código). A área do motorista explica passo a passo como gerar, copiar e enviar `VINCULAR <código>` por **outro número de WhatsApp** que não seja a própria conta pareada ao Clube, pois eventos `fromMe` são ignorados. Há indicação de código pendente, botão de copiar mensagem, retorno de erro visível na página e botão para verificar se o número foi vinculado. Nenhum código foi criado administrativamente nem mostrado fora da sessão autenticada do motorista. A confirmação financeira, limites e consentimentos permanecem intactos.

Limitação: ainda não houve confirmação de entrega de uma mensagem verdadeira no WhatsApp; o status WORKING apenas confirma a sessão. Os testes das rotas de webhook são simulados e não significam entrega real.

## Diagnóstico: código enviado pelo próprio WhatsApp pareado (21/10/2026)

Após relato de que a mensagem de vinculação não gerava retorno, confirmou-se diretamente no histórico recente do WAHA CORE/WEBJS, sem copiar conteúdos ou identificadores pessoais para os logs do atendimento, que a mensagem final do chat pessoal continha o comando VINCULAR com código ainda válido, mas foi marcada como `fromMe=true`: ela foi enviada pela conta de WhatsApp pareada à sessão `clube-motorista`. O webhook deliberadamente rejeita eventos `fromMe=true` para evitar autorrespostas em loop; isso explica a ausência de vínculo e resposta. A WAHA continuava `WORKING`, o relay e o piloto ativos, e o código ativo já tinha sido gerado pela conta de teste. Não refazer o QR.

Correção de experiência: o endpoint somente leitura de status, disponível **apenas ao motorista único do piloto**, devolve o número de destino do Clube obtido do identificador verificado de sua sessão WAHA (formato dígitos extraído de `me.id@c.us`), sem devolver token, URL ou outras informações da sessão. O painel exibe claramente DESTINO WhatsApp do Clube e REMETENTE outro número WhatsApp. O link precisa ser enviado de uma conta diferente DA conta pareada, PARA o número pareado do Clube. O identificador de conversa `@lid`, quando fornecido pela WAHA WEBJS para mensagens recebidas de um contato privado, agora é aceito somente como identificador opaco do chat, sem interpretá-lo como número telefônico nem contornar a prova por código de uso único; todas as regras de assinatura HMAC, autorização do piloto, bloqueio de grupos e `fromMe` continuam.

Testes: `deploy/test_finance_agent_waha.py` verifica o descarte de código que parte do próprio Clube e a vinculação por `@lid` em simulação com envio externo substituído por mock. `deploy/test_waha_role_handoff.py` valida a restrição do número de destino ao piloto e `deploy/test_finance_agent_ui.js` valida o aviso visual. Não ocorreu envio real nesta atualização. O primeiro vínculo real depende do usuário enviar a mensagem de outra conta.

## Boas-vindas WhatsApp e ajuda sob demanda (21/10/2026)

O WhatsApp do Clube envia mensagem de boas-vindas depois da confirmação do código de vínculo, com tom acolhedor e sem menção a piloto exclusivo. Ela explica o copiloto financeiro, exemplos de abastecimento, supermercado e corridas, e que o usuário deve responder CONFIRMAR + número ou DESCARTAR + número para registrar ou descartar cada sugestão. O texto cabe no limite de 850 caracteres do envio.

A conta já vinculada pode enviar AJUDA, COMO FUNCIONA ou INÍCIO para receber novamente a orientação. A função não usa DeepSeek, não registra movimentação, não reenvia mensagens ao relançar o serviço e preserva assinatura HMAC, validação de chat, bloqueio de mensagens fromMe, proteção contra duplicatas, limites e isolamento por motorista. Os testes são simulados e não enviam WhatsApp real.

## Conversa financeira WhatsApp V2: confirmações humanas e relatório em JPEG (21/10/2026)

Corrigidos três problemas vistos no piloto: (1) 'confirmar' não era entendido sem identificador; (2) erro de digitação 'confimar' era tratado como conversa fora do escopo; (3) 'me manda onde gastei' virava uma proposta de gasto, em vez de consulta financeira.

Regras agora: CONFIRMAR, CONFIMAR, CONFIRMA, CONFIRMO e DESCARTAR (e variantes explícitas) valem para a última sugestão efetivamente enviada ao único chat autorizado nas últimas duas horas. O identificador da última sugestão é guardado por motorista e hash do chat; não pode confirmar outro motorista. CONFIRMAR <número> e DESCARTAR <número> continuam disponíveis para históricos antigos e seleção explícita. Quando não há uma última sugestão recente, o agente lista até três pendências de origem WhatsApp e pede seleção por número. Não interpreta 'sim' ou 'ok' isolados como autorização de lançamento. Sugestões pendentes, texto, foto ou áudio jamais são registradas sem confirmação explícita. Respostas são variadas por função determinística do ID do evento: classificação, confirmação, cancelamento, saudação e fora de escopo, sem invocar DeepSeek somente para variar tom.

Consultas como 'me manda onde gastei', 'quanto gastei', 'relatório do mês' e 'resumo financeiro' consultam somente transações já CONFIRMADAS do motorista e respeitam consentimento específico de análises de tendências. Incluem entradas declaradas, despesas por categoria, diferença parcial de caixa dos registros, avisos sobre dados faltantes e sugestões pendentes. Isso NÃO é extrato/saldo de conta bancária. Não atribuir números para investimentos/reservas nem para metas/sonhos que não foram registrados explicitamente; a versão atual ainda não modela investimentos de forma separada. Em conta sem registros confirmados no mês, a resposta explica que ainda não há dados e não gera imagem de barras artificiais.

Quando há dados confirmados e consentimento, um minigráfico JPEG de 900x705 é renderizado com ffmpeg e fontes locais, sem tokens IA nem serviços externos, e enviado por WAHA POST /api/sendImage com payload base64. Três gráficos por motorista/dia (teto já definido), 60 mensagens/dia e 12 por dez minutos. Mensagens e imagens possuem deduplicação de envio e são endereçadas exclusivamente à conversa previamente vinculada e consentida; o webhook permanece HMAC assinado, sem grupos/fromMe e não envia campanhas. Falhas na imagem não impedem um relatório textual já enviado. Nada é enviado retroativamente após a publicação.

Textos como '90,00 de gasolina' podem ser interpretados por regra estrita como proposta de despesa sem consumir modelo. O novo manual de boas-vindas ensina a resposta curta 'confirmar'. Testes: deploy/test_finance_agent_waha.py inclui transcrição sintética completa (supermercado, gasolina abreviada, confimar, confirmação sem duplicidade, consentimento e relatório com JPEG simulado). Regressões de segurança e limites continuam. O teste isolado com emissor WAHA simulado NÃO significa que o WhatsApp real já recebeu um relatório; testar com o número piloto após publicar.

## Relatórios sob demanda e autorização de mídia via WhatsApp (21/10/2026)

**Objetivo:** permitir que o motorista use somente a conversa do WhatsApp para pedir seu próprio relatório, registrar ganhos e despesas e, quando necessário, autorizar especificamente a leitura de fotos ou áudios. Não exigir que o usuário abra o painel para liberar um relatório que ele próprio solicitou.

**Relatórios em resposta à solicitação:** depois de verificar assinatura HMAC, mensagem privada, vínculo e ativação do agente, comandos como "me manda meu relatório" acionam uma consulta **única, limitada aos lançamentos confirmados do próprio motorista**, sem depender da preferência `trends`. O pedido explícito autoriza somente o envio daquele resumo para o mesmo chat já vinculado; a trilha de auditoria registra `driver_direct_request:confirmed_only:one_time`. A preferência persistente `trends` permanece inalterada e continua exigida para análises contínuas, proativas ou pela API `/api/finance-agent/insights`. Não acionar DeepSeek, habilitar ofertas, publicidade, cruzamento de dados, marketing ou compartilhamento de dados a terceiros para esse relatório. O JPEG segue o limite de três por dia e somente é gerado quando houver registros confirmados.

**Fotos e áudios:** quando `media_ai` estiver desativada, o WhatsApp responde com explicação clara de finalidade e fluxo, sem armazenar ou analisar a mídia recebida. O motorista pode enviar `AUTORIZAR MIDIA` (ou `AUTORIZAR MÍDIA`) para conceder apenas a permissão `media_ai`, ou `REVOGAR MIDIA` para retirá-la; esse consentimento é persistido por motorista, auditável e não toca `offers`, `trends`, `text_ai` ou compartilhamento. Após autorizar, é necessário reenviar a mídia. Fotos podem passar por um provedor externo de IA, áudio é transcrito localmente e seu texto pode ser processado por IA. Não habilitar silenciosamente esse processamento apenas por receber o arquivo. O serviço do provedor ainda precisa estar operacional.

**Didática:** boas-vindas e respostas a dúvidas financeiras orientam a solicitar o resumo pelo próprio chat. Uma proposta ambígua solicita que o motorista envie uma frase mais detalhada pelo WhatsApp, sem mandá-lo à tela de cadastro. Os registros continuam aguardando confirmação explícita. O piloto permanece limitado ao único chat vinculado; números novos ainda precisam passar pelo cadastro/vínculo inicial — esta mudança não representa liberação geral para usuários desconhecidos.

**Teste:** `deploy/test_finance_agent_waha.py` cobre geração de relatório com `trends=0`, não persistência dessa preferência, não disponibilização das análises automáticas na API, isolamento, consentimento específico de mídia concedido e revogado no WhatsApp e proteção contra duplicidade. Testes utilizam WAHA simulado e não enviam mensagens reais.

## Confirmação natural por WhatsApp — respostas livres e tratamento de dúvida (21/10/2026)

Após apresentar uma proposta de lançamento de ganho ou despesa, o agente não exige uma palavra-chave. O motorista pode responder com mensagens completas de aprovação, como `ok`, `blza`, `blz`, `beleza`, `sim`, `isso`, `isso mesmo`, `confirma`, `confimar`, `falow`, `top`, `tá bom`, `legal`, `s`, `fechou`, `certo`, `perfeito`, `pode`, `pode registrar` e sinais simples 👍/✅/👌. A normalização aceita maiúsculas, acentos e pontuação externa. Somente mensagens que consistam inteiramente em uma dessas confirmações são reconhecidas; expressões embutidas em outras frases (como 'ok gastei 40') não podem aprovar lançamentos por engano. Respostas variadas são processadas localmente, sem gastar tokens de IA.

O aceite curto funciona SOMENTE com a última sugestão que o agente realmente enviou ao WhatsApp individual vinculado, se ainda estiver pendente e tiver sido enviada nos últimos 15 minutos. O ID explícito `CONFIRMAR <número>` permanece disponível para registros antigos. Uma mudança de assunto (relatório, ajuda, novo gasto) apaga o contexto para o 'ok' genérico, sem apagar a sugestão pendente. Uma confirmação repetida não pode gerar lançamento duplicado. O chat continua vinculado a um único motorista e recebe somente eventos HMAC válidos; autorização do agente e limites permanecem ativos.

Em dúvida ou negativa, por exemplo `talvez`, `acho que sim`, `não sei`, `marca` ou `não`, o agente NÃO confirma lançamento: solicita confirmação ou correção e registra apenas um evento auditável de revisão. Uma negativa remove o contexto para a confirmação genérica subsequente, impedindo 's' posterior de salvar a proposta rejeitada. Sugestões sem valor ou categoria suficiente nunca são registradas e o agente pede detalhes pelo próprio chat, sem obrigar o acesso ao site. A mensagem da proposta agora diz 'Está tudo certinho? Pode responder do seu jeito...', oferecendo exemplos de modo não obrigatório.

Teste: `deploy/test_finance_agent_waha.py` valida aliases, pontuação, respostas ambíguas, assinatura de webhook, vínculo, duas confirmações naturais reais simuladas, prevenção de repetição, mudança de tópico, prazo de 15 minutos, proposta não registrada e separação de contas. Nenhuma mensagem real foi enviada durante os testes; o envio pelo WhatsApp real deve ser validado com o piloto vinculado.

## Etiquetas de origem das entradas: APLICATIVO e OUTROS (21/10/2026)

**Entradas novas** informadas por WhatsApp ou no agente financeiro são organizadas como **APLICATIVO** ou **OUTROS**. Corrida, corridas, passageiro, passageiros, 'peguei um cliente' e ganhos identificados de Uber, 99, inDrive, Urbano Norte, iFood, Rappi ou Loggi são APLICATIVO. Registros de gorjeta, valor a mais, extra, bônus, renda extra, venda avulsa ou cliente particular são OUTROS, inclusive quando o dinheiro extra veio de um aplicativo. Em uma entrada genérica 'recebi R$ 100' a etiqueta é OUTROS: o agente não adivinha qual plataforma pagou. A quantidade R$ 99 isolada não significa a plataforma 99 — sua origem só é reconhecida com contexto como 'da 99' ou 'app 99'. A referência a corrida ou passageiro sem nome de plataforma usa APLICATIVO, mas não atribui falsamente Uber ou 99.

No WhatsApp, a proposta mostra **Entrada**, **Etiqueta** e, quando informada, **Origem** (Uber, 99, inDrive, Urbano Norte etc.). Continua obrigatório o aceite expresso e contextual do próprio motorista; um valor ou categoria incompleta permanece sem registro. Após aprovação, a etiqueta é persistida na transação individual, e a origem explicitamente nomeada no relato é preservada na observação com formato 'Origem: Uber | ...'. A identificação do nome do aplicativo é feita por regras locais, sem gastar tokens para frases simples. Se o motorista escrever dois valores diferentes na mesma mensagem sem separá-los adequadamente, pedir revisão antes de lançar.

O relatório mensal por WhatsApp calcula entradas APLICATIVO e OUTROS a partir de movimentações confirmadas. Pode detalhar Uber, 99 e outras origens nomeadas quando houver evidência, sem inventar plataformas. Registros antigos com categorias 'Corridas', 'Corridas Uber', 'Corridas 99' e 'Outras receitas' continuam intocados no banco, mas entram nas somas compatíveis do relatório: Corridas/Corridas Uber/Corridas 99 em APLICATIVO e Outras receitas em OUTROS. O registro manual e a seleção na interface incluem as novas etiquetas, sem remover as opções antigas. A classificação de despesas mantém as categorias existentes.

Testes isolados: deploy/test_finance_agent.py cobre frases com corrida, cliente, passageiro, Uber, 99, inDrive, origem adicional, particular, frases sem valor e diferencia o valor R$ 99 da plataforma 99; deploy/test_finance_agent_waha.py confirma a classificação, as mensagens enviadas em simulação, as escolhas naturais, a gravação da origem após aceite e o relatório por canal, sem enviar WhatsApp real. Sem alteração retroativa em dados de motoristas.
