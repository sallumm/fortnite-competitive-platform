# Prompt 24 — operação, custos e bloqueios

Fontes oficiais consultadas em 11/10/2026. Valores em USD, estimativas de plano sem câmbio/impostos, SMTP, domínio, backup externo ou IA. Não contratar automaticamente. Limites podem mudar; conferir painel antes de autorizar.

## Comparação e orçamento proposto

| Serviço | Referência atual | Limite / decisão |
|---|---|---|
| Supabase Free | US$0/mês; 500 MB banco, 1 GB Storage, 5 GB egress e 5 GB cached egress; 50 mil MAU | Até 2 projetos ativos; pausa após 1 semana inativo, sem backups automáticos nem branching. Adequado a ensaio sintético, não SLA |
| Supabase Pro | A partir de US$25/mês, crédito compute de US$10; segundo Micro aproximadamente +US$10/mês | Dois Micro ≈US$35/mês antes de extras; daily backup 7 dias. Só contratar após orçamento explícito |
| Cloudflare Pages Free | Proposta frontend estático gratuita; 500 builds/mês, 1 concorrente, 20 mil arquivos, 25 MiB por asset | Access e cobertura de todos os hostnames precisam de configuração/verificação; Functions têm quota Workers separada |
| Cloudflare Access Free | Plano para até 50 usuários | Usar apenas testers permitidos; confirmar retenção e elegibilidade no painel |
| Turnstile Free | Até 20 widgets, 10 hostnames/widget | Independente de zona Cloudflare; chaves/hostname distintos por ambiente |
| Netlify Free | 300 créditos/mês, hard limit | Alternativa; comparar consumo por deploy/banda/requests e proteção privada antes de escolher |
| SMTP/domínio/backup externo | Não escolhidos / sem preço total verificável | Cotação posterior. Não comprar domínio por iniciativa técnica |
| IA | Desativada operacionalmente; preço depende do modelo/volume não definidos | Não inserir chave nem efetuar chamadas pagas sem autorização |

Fontes: [Supabase pricing](https://supabase.com/pricing), [Pages limits](https://developers.cloudflare.com/pages/platform/limits/), [Cloudflare plans](https://www.cloudflare.com/plans/), [Turnstile plans](https://developers.cloudflare.com/turnstile/plans/), [Netlify pricing](https://www.netlify.com/pricing/). Proposta inicial de infraestrutura básica Free: US$0/mês dentro das cotas, **sem afirmar custo operacional total zero**, disponibilidade contínua ou proteção privada já habilitada. Não converter plano grátis em pago silenciosamente. Revalidar custos do projeto/organização via conector antes de qualquer criação.

## Backup e recuperação

Free exige exportações off-site próprias. Backups de banco não contêm os bytes do Storage, apenas metadados; manter cópia separada de objetos com hash/tamanho/chave de bucket, criptografia e ACL mínima. Pro inclui 7 dias de backups diários, mas não substitui restauração exercitada ([Supabase backups](https://supabase.com/docs/guides/platform/backups)).

Procedimento proposto, não executado: operador autorizado descobre `supabase db dump --help`/pg_dump compatível; exporta schema/data/roles suportados, registra migration ledger e configurações Auth/Storage fora dos dumps quando não incluídas. Evitar comandos que imprimam URL/senha; armazenar credenciais em cofre/processo protegido. Criptografar backup, manter chave separada e cópia fora da conta principal. Retenção inicial a aprovar: 7 diários/4 semanais, somente dados necessários. RPO 24h/RTO 24h são metas propostas, não medidas.

Restaurar em projeto isolado explicitamente autorizado com e-mail/webhook/IA/envio externo desativados. Não restaurar sobre produção nem repetir seeds. Verificar contagens, integridade referencial, grants/policies/search_path, funções, Auth sintético, bytes/hashes Storage, URLs e exclusão. Registrar duração, erros, perda efetiva e hash do conjunto. O backup só é verificável após esse ensaio; não encerrar KYR-010 por existir um script.

## Observabilidade e incidentes

Começar com audit trail SQL existente, logs provedores e CI. Definir operador, frequência e canal de alerta antes da operação. Telemetria proposta: rota, status, duração, correlation id aleatório e contagens agregadas; não conteúdo privado, senhas, tokens/cookies, IP sem finalidade aprovada, seed MFA ou prompt/resposta IA. Não instalar session replay/analytics invasivo. Erro frontend deve ser sanitizado antes de agregar; um dashboard não prova que existe plantão.

Sinais para calibrar no staging: aumento sustentado 5xx, 429 ou latência, falha no backup/restore, mudança de papel privilegiado inesperada, quota IA/egress/Storage próxima do orçamento. Definir janela/limiar a partir da baseline e responsável por tratar falso positivo. Uptime externo exige URL privada e monitor autorizado; não tornar staging público para facilitar monitoramento. Supabase Free pausa por inatividade: não mascarar com ping para alegar SLA.

Quota SQL de IA não é cap financeiro. Na futura conta de IA aprovada, identificar projeto/modelo, estimar tokens máximos por chamada × quota, estabelecer orçamento/alertas e kill switch administrativo no cofre/provedor; conferir se cap é bloqueio ou alerta. Nenhuma cobrança ou monitor IA foi ativado. Spend cap Supabase não elimina todos os extras/compute; revisar categorias na confirmação de custo.

Incidente: preservar cronologia sanitizada; fechar função/rotas afetadas; revisar papéis/sessões/configuração; revogar/rotacionar secrets apenas com operador autorizado; corrigir e validar isoladamente; recuperar por plano aprovado; repetir negativas. Não apagar evidências nem automatizar restore/destruição. Comunicação a titulares/autoridades depende do responsável jurídico e fatos, sem declarar conformidade legal por teste.

## Riscos residuais

| Severidade | Pendência |
|---|---|
| Alta para lançamento | Ausência de projeto/hospedagem/Access/SMTP/backup recuperável/operador/alertas; os 13 achados externos continuam sem prova |
| Alta | Publicar preview antes de fechar todos os hostnames pode expor staging; noindex não impede acesso |
| Média | KYR-022 residual e KYR-039/040 requerem etapa de escala com equivalência dos cálculos |
| Média | KYR-038 duas abas reais e demais fluxos MFA/CAPTCHA/JWT/Storage ainda dependem do projeto autorizado |
| Média | CSP ainda usa wildcard Supabase, HSTS e proteção da origem não entregues/medidos |
| Baixa | OBS23-002 não reproduzida; manter diagnóstico sem ampliar timeouts ou declarar causa encerrada |

Manual operacional separado do Prompt 19 continua não encontrado; confrontá-lo se o titular o fornecer. PROMPT20_OPERATIONS é referência histórica (143 funções em 029); baseline pós-030 correta é 145. Esta distinção não reescreve SQL nem muda avaliação dos 49.

Próximo passo recomendado: titular definir organização/região/orçamento e conta de hospedagem, depois apresentar operação concreta de criação staging com ficha de autorização do runbook. Somente após autorização e identificação executar migrations/configurações e ensaios reais. Nenhuma próxima missão comercial ou recrutamento iniciada.
