# KYRVEN — instruções para a próxima auditoria independente

Auditar a ponta imutável registrada no manifesto da entrega e o diff desde eca9630d7f4c4a45a1b08f7331577ab1da39e427. A base do draft PR é feat/ultimate-brand-transformation; main ainda representa produto anterior. Não mesclar, publicar, criar infraestrutura, testar terceiros ou abrir recrutamento/pagamentos por interpretar este roteiro como autorização.

## Entradas e procedência

Ler o Prompt 20 original, diagnóstico de recuperação, auditoria 21.1, inventário anterior à implementação, relatório, matriz 49 e manuais operacionais/financeiros desta entrega. Obter e confrontar o manual separado do Prompt 19, que permaneceu indisponível. Confirmar branch/commit no GitHub, integridade do bundle/arquivo de código e hashes do pacote. Distinguir arquivo preservado de evidência de execução.

## Repetição local em checkout limpo

Usar Node 24 como CI, lock preservado e ambiente descartável sem variáveis de produção. Executar:

```text
npm ci --ignore-scripts
npm audit --audit-level=high
npm run check:security
npm run check:brand
npm run lint
npm test -- --maxWorkers=2
node scripts/security-database-inventory.mjs
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
npm run check:production
```

A última verificação deve falhar sem as quatro variáveis públicas obrigatórias. Não injetar URLs/chaves falsas para torná-la verde. Build sem configuração demonstra modo demonstração; não prova Auth real. A execução final Vitest conhecida passou 369 testes/63 arquivos. Conferir CI por SHA, não somente badge da branch. Browser local anterior foi interrompido sem resultado final; CI dos checkpoints indicados teve sucesso.

## Pontos prioritários de revisão adversarial

1. AAL1 administrativo não lê/escreve por alternativa de staff, RPC, mídia, exportação ou função auxiliar. Claim de user_metadata não produz AAL2. Testar JWT inválido, sem claim, papel comum com AAL2, staff atribuído e não atribuído, admin e sessão rebaixada após remoção de fator.
2. SQL dinâmico da migration 029 só altera assinaturas esperadas e aborta em divergência. Todas as migrations antigas permanecem idênticas ao checkpoint. Examinar cada política/grant e SECURITY DEFINER, não apenas o booleano relrowsecurity. Validar constraints/team_member preservados.
3. CAPTCHA não pode ser contornado por RPC antigo, prova de terceiro/outro ciclo/expirada/repetida, emissão direta por authenticated ou falha de Siteverify. Reserva de quota ocorre antes da chamada externa. Repetição concorrente deve resultar em no máximo uma submissão bem-sucedida por prova.
4. Auth manda captchaToken em todos os fluxos previstos; backend hospedado exige verificação. CAPTCHA de UI sem configuração Auth não basta. Validar timeout, retry, token consumido/expirado e acessibilidade.
5. MFA UI oferece múltiplos fatores, bootstrap não concede privilégio, erro não libera Continue obrigatório. MFA opcional de conta comum não está globalmente imposto em RLS; avaliar esse risco separadamente do requisito administrativo.
6. Exclusão usa AMR de token validado e pertencente ao mesmo sub; refresh, login recente em outro dispositivo, timestamps inválidos e AAL1 privilegiado não autorizam. Confirmar efeitos reais no Auth e revogação sem PII.
7. Logout/troca de conta não permitem regravação tardia de rascunhos. Verificar outras abas, storage events e caches em cenário real; geração atual cobre escritores do builder no mesmo contexto.
8. Bodies sem Content-Length/chunked, cabeçalho mentiroso, UTF-8 inválido e stream sem término não ultrapassam caps. Avaliar timeout/cancelamento sob ambiente Edge real.
9. Injeções em conhecimento publicado não criam ferramentas administrativas, não expõem rascunhos e não alteram registros. Quotas, consentimento, contexto mínimo, storage e store:false precisam manter contratos.
10. Aceite não pode ser escrito por terceiro, falsificado com accepted=false ou versão arbitrária. Exportar/excluir próprios registros e conferir trigger de onboarding. Não equiparar aceite a autorização parental.
11. Contrato financeiro: eventos repetidos, fora de ordem e refund no mesmo timestamp; vínculo/preço/moeda forjados; estado OAuth de outra sessão. A integração persistente ainda não existe: não avaliar função pura como se tivesse lock/ledger/webhook real.
12. GitHub Actions não utiliza tags móveis, pull_request_target privilegiado ou secrets em PR. Scanner é limitado a padrões em arquivos rastreados, sem certificação de histórico inteiro. Executar investigação adicional de histórico sem imprimir valores de segredos.
13. Seeds antigos não são escritos por geradores e os hashes conferem. Mudança editorial deve criar nova migration, sem reaplicar 002/008/011/013/015.
14. Testes antigos não foram enfraquecidos: distinguir UPDATE zero rows sob USING de erro WITH CHECK; revisar fixtures AAL2/aceite e manter negativos.

## Validação externa futura, somente com nova autorização

Nenhum projeto Supabase/hospedagem existe nesta entrega. Quando criado: comparar catálogo/grants/políticas/functions e gateway, testar Auth/SMTP/Turnstile verdadeiros com contas sintéticas, buckets privados/URLs temporárias, MFA/recovery, email enumeration, HTTP headers/CSP/cache/TLS e Cloudflare somente nos hosts efetivamente proxied. Medir quotas/429 sem teste de carga invasivo. Restaurar banco e Storage em ambiente isolado, verificar cron/purga/retention e alertas. Conferir recursos Free no momento.

Jurídico/operacional: operador adulto, canal de privacidade, idade/menores, termos versionados finais, moderação/denúncias, licenças de mídia/marca, avaliadores e questão/prova, orçamentos IA, contatos de incidente. Não habilitar pagamento para “validar” arquitetura futura.

## Como registrar resultados

Preservar os IDs KYR-001–049; adicionar evidência de commit/arquivo/teste/ambiente e severidade residual. Só encerrar pendência externa com observação direta do ambiente autorizado. Separar defeito novo de risco herdado, resultado inconclusivo de sucesso, limitação de escopo de falso positivo. Findings de produto/escala 022/023/027/039–042 permanecem abertos.

Se interrompida, registrar SHA remoto/local, alterações não commitadas, teste iniciado/concluído/falhou e próximo passo exato. Não apagar evidência nem declarar produção pronta para reduzir a lista de pendências.
