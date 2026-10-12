# Exclusão física: manutenção exclusiva, ainda proibida hospedada

DELETE privilegiado sem protocolo continua proibido para uso concorrente. A migration não cria RPC de exclusão física nem concede privilégios de manutenção. Este documento não autoriza apagar contas/perfis.

Em janela futura explicitamente aprovada, suspender escritores de todas as origens, inclusive backend/operadores, e drenar transações. Começar transação nova READ COMMITTED, com lock_timeout e statement_timeout finitos. Antes de qualquer row lock/DELETE, adquirir pg_advisory_xact_lock(2423,31), a forma exclusiva do fence dos escritores eSports. Conferir pg_locks: nenhuma ShareLock concedida nesse par por outro backend. Solicitar ACCESS EXCLUSIVE NOWAIT em TODAS as tabelas public/private, em ordem schema/nome, ainda na mesma transação. Isso também recusa leitores e escritores SQL não cooperativos que mantenham locks de relação; qualquer conflito aborta e exige nova avaliação da janela.

Não manter row locks antes do fence; não atualizar de shared para exclusive numa transação que já escreveu eSports. Não executar manutenção global a partir de RPC de navegador. Aprovação do usuário alvo, backup/restauração e escopo de dependências são pré-condições distintas.

Somente depois dos locks e verificações, um operador autorizado poderá efetuar a exclusão expressamente autorizada e verificar cascades/auditoria antes do COMMIT. A evidência 24.2.3 testa apenas DELETE de profile sintético, não DELETE auth.users/GoTrue, Storage ou todas as consequências de exclusão de conta.

Falha, timeout/NOWAIT, 40P01 ou 40001: rollback integral; nova transação apenas após nova drenagem e revalidação de identidade, consentimento, grants, CAS e escopo. Não ignorar erro, repetir decisão cegamente, encerrar sessões de terceiros ou enfraquecer FKs/RLS. Após COMMIT, rollback de frontend não recupera SQL; restauração/correção exigem autorização própria.

Nos testes, grant-first confirma antes da manutenção e sua FK é excluída pelo DELETE autorizado; delete-first termina e o grant posterior é recusado. Ambas as ordens sem 40P01 sob o protocolo. Sem esse protocolo, o contraexemplo 40P01 original permanece documentado e a operação não é considerada segura.
