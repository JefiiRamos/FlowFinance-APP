# Relatório de análise mobile — FlowFinance

Data: 6 de outubro de 2026.

## Escopo e método

Análise da implementação em `flowFinanceWeb`, com foco no dashboard, tabbar, assistente, transações, autenticação e landing page. Foram examinados os componentes e suas regras responsivas. Não houve execução de uma sessão visual em navegador ou aparelho: problemas estruturais abaixo são confirmados pelo código; efeitos de teclado, recortes, desempenho e aparência final são riscos a validar. Não foram alteradas funcionalidades do site.

## Diagnóstico

O projeto já possui uma base responsiva: grids se adaptam, a sidebar dá lugar à navegação inferior, há cartões de transações e inputs comuns com fonte de 16 px no celular. Entretanto, a experiência mobile ainda replica a quantidade de conteúdo e opções do desktop. A principal correção é tornar o assistente acessível e protagonista na tabbar.

## 1. IA e navegação inferior — prioridade máxima

**Confirmado:** em `components/dashboard/app-shell.tsx`, `MOBILE_TAB_ENTRIES` reutiliza as sete entradas da sidebar: Início, Transações, Gráficos, Metas, Simulador, Recorrências e Relatórios. Não existe entrada para `/assistente`, embora haja código preparado para links. O botão flutuante do assistente no dashboard é exibido apenas em telas a partir de 1024 px. A rota do assistente existe, mas os controles examinados não oferecem acesso a ela na navegação mobile.

Cada item tem largura mínima de 72 px. Só os sete itens exigem 504 px; com gaps, padding e margens, a barra precisa de aproximadamente 568 px de viewport para caber sem rolagem. Em larguras como 360, 390 e 430 px, algumas opções ficam fora da área inicialmente visível. A navegação depende de descobrir o gesto horizontal.

**Proposta:** cinco destinos permanentes, nesta ordem:

| Início | Transações | Assistente IA | Metas | Mais |
| --- | --- | --- | --- | --- |
| Visão do mês | Histórico e registros | Destaque central | Objetivos | Gráficos, Simulador, Recorrências, Relatórios e conta |

- Tornar a IA o item central, com fundo primário preenchido, ícone de assistente e rótulo permanente. Não depender só da cor ou de animação.
- Usar o rótulo curto “IA” na barra estreita, com nome acessível “Assistente IA”; manter a identificação completa no cabeçalho da conversa.
- Reservar áreas de toque de aproximadamente 48 px ou mais e distribuir os cinco itens sem largura mínima que force rolagem.
- Abrir `/assistente` no celular em tela dedicada. A implementação atual do overlay tem largura de 480 px e foi feita para desktop; não deve ser simplesmente exposta no mobile.
- Manter a tabbar na tela do assistente, com IA selecionada, ou garantir retorno explícito com preservação da seção anterior. Hoje a página usa um layout próprio e o retorno aponta para `/dashboard`.
- Recolher a tabbar durante a digitação se ela disputar espaço com o teclado; manter o campo e o botão Enviar acessíveis.
- Acrescentar um convite contextual no início: “Registre um gasto com uma mensagem”, levando ao assistente.

**Critério de conclusão:** IA acessível com um toque a partir de qualquer seção principal; cinco destinos inteiros visíveis em 360 px; estado ativo identificável; acesso à IA sem digitar URL.

## 2. Hierarquia do dashboard — prioridade alta

**Confirmado:** a saudação usa `text-4xl`, o cabeçalho da seção tem padding de 20 px, os quatro indicadores ficam em uma coluna abaixo de 640 px e há três gráficos antes do painel de inteligência financeira na ordem do conteúdo.

**Impacto provável:** muita rolagem antes de chegar às orientações e informações práticas. Uma saudação com nome longo pode ocupar várias linhas.

**Melhorias:**

- Cabeçalho mobile compacto, com saudação de 24–28 px e período financeiro claramente indicado.
- Saldo em um cartão principal; receitas e despesas em dois cartões compactos, desde que valores longos caibam; economia em uma linha secundária.
- Mostrar uma orientação relevante e o acesso à IA antes dos gráficos.
- Exibir apenas um gráfico principal no Início e deixar os demais em Gráficos.
- Evitar truncar valores financeiros essenciais: os cartões atuais usam `truncate`. Adaptar fonte e layout ou permitir visualizar o valor completo.
- Revisar os dois cabeçalhos sticky: o shell e a seção usam posições superiores sem uma coordenação explícita. Validar sobreposição durante a rolagem e manter apenas o que ajuda a tarefa.

## 3. Transações — prioridade alta

**Confirmado:** a seção renderiza `TransactionsForm`, que também lista todas as transações, e depois `TransactionsTable`, com outra lista e busca. Em mobile, esses blocos se empilham. A segunda lista tem altura máxima de 520 px e rolagem própria.

**Melhorias:**

- Uma única lista mobile, com busca e filtros no topo; separar o formulário da listagem.
- Manter o botão de adicionar alcançável e oferecer escolha clara entre receita e gasto.
- Preferir rolagem da página à rolagem interna da lista no celular.
- Colocar valor em uma linha ou área com espaço suficiente; agrupar editar/excluir em menu acessível para aliviar cartões estreitos.
- Aumentar botões pequenos: a primeira lista usa ações de 32 × 32 px e sem rótulos acessíveis explícitos.
- Exibir ações em dispositivos de toque independentemente da largura. A partir de 640 px, os componentes escondem ações com opacidade e dependem de hover; isso também afeta celulares em paisagem e tablets.
- Oferecer confirmação ou desfazer exclusão. Os handlers examinados disparam exclusão diretamente.
- Restaurar o filtro de período ou remover o título “Filtrar” sem controle correspondente: o `PeriodFilter` está comentado na seção e no cabeçalho.

## 4. Formulários e teclado — prioridade alta

**Confirmado:** o diálogo de transação reúne tipo, descrição, valor, categoria, pagamento, data e ações. O componente base de diálogo é centralizado e não define limite de altura nem rolagem vertical do conteúdo.

**Risco a validar:** campos e botão Salvar podem ficar inacessíveis em telas baixas ou com teclado aberto.

**Melhorias:** usar formulário em tela dedicada ou painel inferior com altura limitada ao viewport dinâmico, conteúdo rolável e ações acessíveis; testar `dvh` e safe area. No valor, oferecer teclado decimal e tratamento explícito de vírgula/ponto. O código atual usa `type="number"` e `parseFloat`; a experiência de entrada brasileira deve ser verificada no Android e iOS.

## 5. Conversa com o assistente — prioridade alta

**Confirmado:** o chat usa `min-h-screen`, sugestões com texto de 11 px e padding vertical pequeno, textarea de 14 px e orientação “Enter envia · Shift+Enter nova linha”. Não há tratamento explícito de safe area ou viewport dinâmico nesses componentes.

**Melhorias:**

- Campo de mensagem ancorado à área visível, com fonte de 16 px no celular, botão Enviar de fácil toque e conversa rolável acima.
- Substituir a instrução de atalhos de teclado por uma dica adequada ao celular.
- Sugestões com texto de 13–14 px e área de toque maior, por exemplo “Gastei R$ 45 no almoço” e “Recebi R$ 2.000”.
- Mostrar confirmação clara do lançamento: valor, tipo, categoria e data; oferecer editar ou desfazer.
- Ao voltar ao dashboard, atualizar os indicadores e preservar o contexto de navegação.
- Identificar processamento, erro e sucesso com mensagens acessíveis, mantendo o texto digitado se houver falha.

**Limite funcional relevante:** a rota `api/ai/expense-assistant` usa `parseExpenseMessage`, um parser local, e pode criar uma transação diretamente após validar os dados. O destaque da IA deve descrever capacidades efetivamente suportadas; não pressupor conversa geral ou aconselhamento financeiro amplo. Exemplos e onboarding devem ser compatíveis com esse comportamento.

## 6. Safe area e elementos fixos — prioridade alta

**Confirmado:** a tabbar usa `bottom-3`, o conteúdo reserva `pb-24` e o botão de adicionar fica em `bottom-28`. O shell não usa `env(safe-area-inset-bottom)`.

**Melhoria:** coordenar altura da barra, espaçamento do conteúdo e posição do botão com a safe area. Validar iPhones com indicador de início, Android com navegação por gestos, paisagem e teclado aberto. O último item de cada tela deve permanecer visível e clicável acima da navegação.

## 7. Autenticação — prioridade alta

**Confirmado:** `AuthShowcase` aparece antes do formulário no DOM. As classes de ordenação só se aplicam em `lg`, portanto o showcase precede o formulário no mobile, tanto no login quanto no cadastro.

**Melhoria:** formulário primeiro no celular; apresentação resumida e secundária. Reduzir padding do cartão em telas estreitas e garantir que o usuário identifique rapidamente os campos e a ação de entrar/criar conta.

## 8. Leitura e acessibilidade — prioridade média

Há rótulos de 10 px na tabbar, texto auxiliar de 9–11 px no chat e uso frequente de `#6B7280` sobre fundos escuros. Isso justifica verificar contraste na renderização final; esta análise não mediu conformidade.

**Melhorias:** aumentar rótulos importantes para 12–14 px, preservar texto de corpo confortável, adicionar estado selecionado acessível nos botões de seção, nomear a navegação e corrigir o botão Perfil do cabeçalho mobile, que atualmente não tem handler. Garantir foco visível, leitura com leitor de tela e compreensão dos estados sem depender só de vermelho/verde.

## 9. Landing page e desempenho — prioridade média

**Confirmado:** hero com título de 48 px, padding superior de 96 px e vários espaçamentos grandes; CTA final com 128 px de padding vertical. A demonstração visual usa uma imagem de dashboard desktop com referência de 2200 × 1400. O botão “Ver demonstração” no hero não tem ação associada no componente examinado. A landing monta o fundo animado `Silk`; a página do assistente monta `Grainient`.

**Melhorias:**

- Compactar hero e seções para comunicar benefício e acesso à ação mais cedo.
- Usar uma demonstração mobile legível ou um recorte focado em saldo, lançamento e IA.
- Implementar a ação “Ver demonstração”, com destino claro.
- Fornecer `sizes` adequado para a imagem responsiva e verificar o tamanho realmente transferido.
- Avaliar versão estática dos fundos em dispositivos modestos e respeitar preferência por movimento reduzido.
- Medir carregamento e fluidez antes de atribuir problemas de desempenho às animações. Não foram executados benchmarks nesta análise.

## 10. Gráficos e relatórios — prioridade média

A tabela de fluxo de caixa mantém cinco colunas em um contêiner com rolagem horizontal. Isso contém o conteúdo, mas exige comparação fora da área visível no celular.

**Melhoria:** cartões mensais expansíveis com renda, gasto e saldo; detalhes de acumulado sob expansão. Nos gráficos, validar eixos, legendas, tooltip por toque e uma síntese textual do resultado. Evitar depender de hover para compreender os dados.

## Ordem sugerida de implementação

1. Tabbar com cinco destinos e IA central, acesso mobile à conversa e safe area.
2. Uma lista de transações, filtros úteis e formulário utilizável com teclado.
3. Formulário de autenticação antes da apresentação.
4. Dashboard compacto com orientação e IA acima dos gráficos.
5. Tipografia, ações por toque, relatórios e landing.
6. Medições de desempenho e refinamento dos efeitos visuais.

## Validação necessária após as mudanças

Testar larguras de 360, 390 e 430 px, além de paisagem e tablet por toque. Executar os percursos: entrar, abrir IA pela barra, registrar gasto, verificar atualização do saldo, editar/excluir transação, filtrar mês, abrir metas e acessar itens em Mais. Testar nome longo, descrições longas, valores elevados, lista vazia, falha de rede e teclado aberto.

Critérios: nenhuma rolagem horizontal na tabbar ou página principal; valores essenciais completos; última linha sem obstrução; campo e envio visíveis com teclado; nenhuma ação essencial dependente de hover; feedback claro após registros e falhas. Testes em navegador e aparelho são necessários para concluir a avaliação visual e de uso.
