# Adaptação mobile do FlowFinance

Implementação baseada em `RELATORIO-MOBILE.md`, aplicada ao app Expo existente. A integração com a API e as telas financeiras foram preservadas. Não houve publicação, alteração no backend ou gravação de dados reais durante a validação.

## O que mudou

| Recomendação | Implementação no app |
| --- | --- |
| Identidade semelhante à web | Fundo escuro, violeta primário, cartões discretos, cores de receita/despesa e status bar clara; splash e configuração de tema alinhados. |
| IA em destaque | Cinco abas: Início, Extrato, IA, Metas e Mais; IA central com ícone, rótulo e fundo preenchido. |
| Dashboard compacto | Período visível, saldo principal, receitas/despesas compactas, economia e orientação com convite à IA antes dos demais conteúdos. Valores longos adaptam fonte ou largura do cartão. |
| Navegação clara | Metas com aba própria; relatórios, gráficos, recorrências, simulador e conta em Mais. |
| Extrato único | Uma lista com busca, mês/histórico e tipo; ações visíveis de edição e exclusão com confirmação nativa. Descrições podem quebrar linhas. |
| Formulários | Fonte de 16 px nos campos, teclado decimal, validação de data, centavos preservados na edição, conteúdo rolável e ações separadas. |
| Assistente | Conversa preservada entre abas, confirmação dos dados registrados, revisão por edição, texto preservado em erro, campo de mensagem separado da conversa e envio com área maior. |
| Safe area e teclado | Espaço inferior considera insets; barra recolhe quando o teclado nativo aparece; formulário considera inset inferior; Android usa resize. |
| Leitura e toque | Rótulos auxiliares ampliados, botões principais e seletores com áreas maiores, estados selecionados acessíveis, controles sem dependência de hover. |
| Autenticação | Identificação breve seguida de formulário; apresentação extensa não precede a tarefa. |
| Relatórios | Valores de receitas, gastos, saldo e acumulado por mês acompanham os gráficos, dispensando hover e tabela horizontal. |
| Efeitos visuais | Fundo estático em gradiente; não foram adicionados fundos WebGL ou animações contínuas. |

A landing page comercial pertence ao projeto web; suas recomendações foram traduzidas para entrada/autenticação e navegação do app. Não foi criada uma landing dentro do app. As capacidades do assistente continuam sendo as do parser/API existente.

Foi corrigida também a apresentação do progresso de metas: usa o valor acumulado da própria meta, em vez de atribuir o saldo total da conta a todos os objetivos.

## Verificação

- TypeScript e lint.
- Testes locais do contrato da API, sem acesso ao servidor real.
- Testes de valores: entrada brasileira, decimal da API, centavos e entradas inválidas.
- Exportação web e teste da prévia com respostas simuladas: login, cinco abas, assistente, persistência da conversa, confirmação, telas secundárias, busca e edição de centavos.
- Layout em 320, 360, 390 e 430 px, além de 844 × 390; nomes/descrições longos e valores elevados.
- Revisão de capturas de login, início, extrato, assistente e formulário em `dist/preview`.
- Bundles JavaScript Android e iOS exportados com `--no-bytecode`.

## Limites da validação

O ambiente negou execução do compilador Hermes no Windows. O bundle Android JavaScript foi validado sem bytecode; isso não equivale a gerar ou instalar um APK. Não foi gerado IPA nem realizada publicação.

O comportamento real de teclado, safe area, confirmação nativa de exclusão e leitor de tela precisa de verificação em Android/iPhone. As capturas e testes de layout usam React Native Web com dados locais. A conversa é preservada durante a sessão; não foi implementada persistência do histórico após fechar o app.

## Executar

Na pasta `flowFinanceApp`, execute `npm start` e abra o app no ambiente Expo compatível com o SDK 57. Use `npm run typecheck`, `npm run lint`, `npm run check:api` e `npm run check:finance` para repetir as verificações locais.
