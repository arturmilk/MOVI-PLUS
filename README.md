# MOVI+

**MOVI+ — Agente financeiro para motoristas de aplicativo**

Esta pasta `MOVI-PLUS` contém um espelho organizado do sistema NOVAGENTE Clube do Motorista V5, preparado para um **repositório privado** no GitHub.

**Origem conferida:** `/srv/clube-motorista-v3/financeiro-secure-v5/`, commit `e04cb6e`. **Atenção:** esta pasta de preparação ainda NÃO é o repositório remoto do GitHub. A publicação depende de criar o repositório e executar o push.

## Documentação

- [Mapa de arquitetura e pastas](docs/arquitetura/ORGANOGRAMA.md)
- [Índice de capturas de tela](docs/prints/INDICE-PRINTS.md)
- [Guia de domínio e implantação](docs/publicacao/DOMINIO-E-DEPLOY.md)
- [Arquivos proibidos no Git](docs/publicacao/SEGURANCA.md)
- [Documentação técnica original](README_CLUBE_V5_ORIGINAL.md)
- [Testes originais](TESTES_CLUBE_V5_ORIGINAL.md)

## Pastas

- `static/`: site, landing page e interfaces de gestor/motorista
- `deploy/`: serviços, testes de regressão e scripts de implantação
- `finance_agent_*.py`: inteligência financeira, WhatsApp, IA e relatórios
- `app.py`: backend FastAPI, autenticação e dados
- `docs/`: arquitetura, prints e implantação

**Não confunda:** a identidade MOVI+ neste pacote não significa que todas as referências internas legadas a Clube do Motorista foram renomeadas. Não alterar os caminhos da instalação em produção automaticamente.

- [Diagrama visual da arquitetura](docs/arquitetura/ARQUITETURA-VISUAL.svg) — SVG e WebP otimizados.
