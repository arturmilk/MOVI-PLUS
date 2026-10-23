# MOVI+ — Arquivos proibidos no Git

**Nunca versionar:** `data/` (SQLite, chaves, documentos e informações de motoristas), `waha_private/` (sessões), `backups/`, `models/`, `.venv/`, chaves, tokens, arquivos de ambiente ou prints com CPF/CNH.

Este pacote foi preparado com `git archive HEAD`, logo não copia arquivos não versionados nem os ignorados do sistema em produção.

Antes de cada publicação use `git status --ignored` e faça revisão do `git diff --cached`. Mantenha o repositório privado. Não entregue acesso ao servidor apenas com acesso ao GitHub.

As capturas que venham a ser adicionadas devem usar dados fictícios, ser marcadas como demonstração e não afirmar movimentação bancária real.
