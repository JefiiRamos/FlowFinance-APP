# FlowFinance App

App React Native / Expo SDK 57, React 19.2, TypeScript e Expo Router conectado ao backend Next.js do FlowFinance Web. Interface alinhada ao site: fundo escuro, destaque violeta, cartões com bordas discretas e ícones vetoriais.

A barra inferior tem cinco destinos: Início, Extrato, IA, Metas e Mais. A IA ocupa o centro com destaque permanente. Gráficos e relatórios, recorrências, simulador e conta ficam em Mais. Novos lançamentos são criados pelo botão Nova no Extrato ou pelo assistente. A conversa permanece ao trocar de aba e a barra é recolhida quando o teclado nativo aparece.

O Extrato oferece busca por descrição/categoria, filtro de mês/histórico, receitas/gastos, edição e confirmação de exclusão. Valores aceitam vírgula decimal e o formato decimal da API. O formulário é rolável e mantém as ações fora da área de campos.

## Executar

```sh
npm install
npm start
```

Use npm run android, npm run ios ou npm run web. Entre com sua conta do site: cadastros e dados financeiros sao reais e compartilhados com o painel.

## API

Servidor padrao: https://flow-finance-five.vercel.app
Para trocar, configure EXPO_PUBLIC_API_URL no .env conforme .env.example e reinicie o Expo.

Rotas: /api/auth, /api/onboarding, /api/transactions, /api/goals, /api/budget-limits, /api/recurring, /api/recurring-expenses e /api/ai/expense-assistant.
A sessao usa Authorization: Bearer e guarda o token no AsyncStorage. Senhas e dados financeiros nao ficam no cache local. O assistente usa o mesmo parser do site.

Foi adicionada GET /api/recurring no projeto web. Publique essa alteracao na Vercel para habilitar a listagem de rendas recorrentes. Falhas de API sao exibidas, sem dados simulados.

O navegador em outra origem precisa de CORS no backend ou proxy na mesma origem. Android e iOS usam HTTPS diretamente.

## Verificar

```sh
npx tsc --noEmit
npm run lint
npm run check:api
npm run check:finance
```

Para a prévia com dados locais: exporte com `npx expo export --platform web` e execute `node scripts/check-layout.cjs <caminho-do-modulo-playwright>`. O teste intercepta as chamadas à API e salva imagens em `dist/preview`; não grava dados na conta real.

O resumo de implementação e as limitações da validação estão em [IMPLEMENTACAO-MOBILE.md](IMPLEMENTACAO-MOBILE.md).

Valide no dispositivo: login, cadastro, onboarding, lancamentos, metas, limites, recorrencias, assistente e logout. O backend e o banco continuam no web; o app usa a stack nativa do Expo.
