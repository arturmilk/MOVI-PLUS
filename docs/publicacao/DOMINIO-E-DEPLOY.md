# MOVI+ — Publicação futura no domínio

1. Criar no GitHub um repositório NOVO e **privado** chamado `MOVI-PLUS`, sem arquivos iniciais.
2. Vincular o projeto `/srv/clube-motorista-v3/MOVI-PLUS/` ao remoto e realizar o push.
3. Configurar um domínio e HTTPS permanente em Cloudflare, evitando URLs temporárias de `trycloudflare.com`.
4. Preparar servidor de homologação com Python/FastAPI, dependências de `requirements.txt`, WAHA e rede privada.
5. Armazenar chaves DeepSeek/WAHA/criptografia fora do Git, de preferência no cofre da VPS.
6. Preservar o banco real e documentos apenas em diretório privado, com backup criptografado testado.
7. Revisar LGPD/termos, permissões, acesso administrador e cookies antes de liberar usuários reais.
8. Testar `deploy/test_finance_agent.py`, `deploy/test_finance_agent_waha.py` e segurança antes do corte.
9. Validar HTTPS, DNS, login, piloto WhatsApp e restauração de backup, só então direcionar o domínio.

## Publicação com GitHub autenticado

```bash
cd /srv/clube-motorista-v3/MOVI-PLUS
git remote add origin https://github.com/tmbmartell/MOVI-PLUS.git
git push -u origin main
```

*Esses comandos requerem um repositório criado, uma credencial autorizada na VPS e revisão de segurança. Não foram executados nesta preparação.*

## Nota de produto

MOVI+ é a nova identidade escolhida. Os nomes de serviços e pacotes existentes ainda se referem ao Clube do Motorista: renomear tudo requer plano de migração separado.
