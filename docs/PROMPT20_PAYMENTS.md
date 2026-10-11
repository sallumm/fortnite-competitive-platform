# KYRVEN — arquitetura preparada para LivePix

Status: preparação local para integração futura, sem credenciais, chamadas LivePix, endpoint público, cobrança, plano premium concedido ou infraestrutura comercial. Implementação executável atual: supabase/functions/_shared/billing.ts e 12 testes em billing-security.test.ts.

## Base documental e fronteira de confiança

A documentação oficial consultada em 2026-10-11 descreve OAuth2, credenciais de cliente, fluxo de autorização com state, API v2 e notificações webhook com identificação de usuário/aplicação/evento/recurso. Na documentação consultada não foi identificado um contrato verificável de assinatura HMAC do payload. Não se inventa cabeçalho de assinatura nem se trata o webhook como prova do pagamento. [LivePix API](https://docs.livepix.gg/api/)

O webhook será um aviso para consultar a API oficial com credencial servidor, escopo mínimo e conta comerciante conferida. O adaptador futuro deve comprovar quais estados/valores a API realmente expõe; os estados normalizados abaixo são contrato interno, não promessa de campos ou assinaturas nativos LivePix. Recursos ausentes ou ambíguos exigem reconciliação humana sem concessão automática.

## Fluxo proposto

1. Cliente autenticado escolhe apenas identificador de produto. Servidor resolve preço, moeda BRL, período mensal/trimestral/anual e versão do catálogo aprovado. Nunca aceitar preço, usuário beneficiário ou tier vindos do browser como autoridade.
2. Servidor cria pedido pendente vinculado ao auth.uid e ao identificador do provedor, com chave de idempotência única por intenção. Pedido não concede benefício.
3. OAuth, quando necessário, usa state aleatório de pelo menos 32 caracteres, armazenado no servidor com vínculo à sessão, expiração curta e consumo atômico. Redirect exato por ambiente. Tokens/refresh/client secret nunca transitam para storage do browser. A função validOAuthState apenas valida o contrato; criação aleatória e consumo persistente pertencem ao adaptador ainda não implementado.
4. Endpoint webhook futuro aceita somente método/corpo/tamanho esperados, rate limit antes de consultas, esquema mínimo e deadline. IDs permitidos geram URL do provedor a partir de base fixa. Nunca seguir URL arbitrária recebida no payload (SSRF).
5. Buscar estado oficial com escopo mínimo. Comparar comerciante, recurso/pedido, usuário associado no ledger, valor integral em centavos, moeda, período e janela. Erro/timeout não concede benefício.
6. Transação bloqueia pedido, deduplica observação, aplica reconcilePayment e grava antes/depois, versão, motivo, timestamp servidor, referência externa e correlation id. Persistência idempotente exige restrição única e lock/controle otimista; a função pura por si só não resolve concorrência.
7. Benefício deriva do estado confirmado e paidUntil confiável. Resposta de retorno do checkout/browser não concede nada. Cancelamento mantém período já contratado quando devido; reembolso remove benefício; vencimento limita acesso mesmo sem novo webhook.
8. Worker futuro reconcilia pendências com backoff limitado e dead-letter supervisionada. Repetir consulta oficial periodicamente e após eventos suspeitos; não confiar na ordem de entrega.
9. Renovação cria novo período/pedido confirmado; não reabre pedido já reembolsado. Alteração de preço vale apenas para contrato/renovação autorizados. Não interpretar monthly como número fixo de dias sem regra contratual/calendário explícita.

## Contrato executável e testes

BillingOrder associa usuário, pedido, providerId, amountCents, currency, período, estado, providerAt, paidUntil e versão. reconcilePayment rejeita vínculo/valor/moeda/tempo incompatíveis; ignora duplicados/eventos antigos; prioriza estados mais restritivos no mesmo timestamp e mantém refunded terminal. paymentBenefit não concede a pending/expired/refunded; cancelled preserva somente o prazo contratado. Testes cobrem mensal/trimestral/anual, campos forjados, duplicação, ordem, igualdade temporal com refund, expiração, cancelamento e OAuth inválido/reutilizado/expirado.

Não existe tabela de pedidos/ledger criada pela 029: evitar esquema comercial prematuro sem contrato validado do provedor. O desenho implementável futuro é:
- private.billing_orders: vínculo único usuário/pedido/provedor, catálogo versionado, estado, paid_until, version; sem escrita direta de clientes.
- private.billing_observations: deduplicação por recurso/estado/versão oficial normalizada e referência de evento quando confiável; conteúdo mínimo, sem payload pessoal completo.
- private.billing_transitions: histórico append-only de antes/depois/motivo/ator/origem, restrito a auditor financeiro.
- public RPC de status próprio: projeção mínima por auth.uid; nenhuma concessão por RPC acessível ao cliente.
- concessões de benefícios em função interna transacional; cargos esports continuam separados de planos comerciais.

Essas tabelas/adaptador/worker/endpoint são especificação futura, não artefatos SQL aplicados. Antes de implementá-los, confirmar capacidade LivePix para cada período, cancelamento e reembolso, revisar direitos do consumidor com titular adulto, definir preço e retenção fiscal, testar concorrência/retries com sandbox oficial quando disponível e produzir nova migration incremental. Não reutilizar coluna de cargo para representar plano.

## Gate financeiro

KYR-025 permanece aberto para operação comercial completa. KYR-026 está corrigido no contrato local reconstruído, pendente de integração persistente. Somente uma missão comercial explicitamente autorizada poderá implementar e conectar adaptador real. Até lá não há pagamento habilitado nem falsa simulação de assinatura concluída.
