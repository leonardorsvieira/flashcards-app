# Especificação de funcionalidades: flashcards-app

Documento de referência para o escopo do app de flashcards (Android e iPhone, React Native + Expo).

Legenda de prioridade:

- **v1**: obrigatório para a primeira versão publicada.
- **Depois**: planejado para versões seguintes; não entra no escopo da v1.

Premissa de desenvolvimento: o código e os assets são originais (abordagem clean-room, conforme o README). Esta especificação descreve comportamento e requisitos, não implementação.

---

## 1. Visão geral

Um app para estudar por meio de cartões (flashcards). O usuário organiza o conteúdo em baralhos (decks), cria cartões com frente e verso, estuda em sessões guiadas e acompanha o progresso. A repetição espaçada usa o algoritmo SM-2 para decidir quando cada cartão deve voltar a ser revisado.

Plataformas: Android e iOS, com uma base de código única.

---

## 2. Baralhos (decks)

| Funcionalidade | Prioridade | Descrição |
|---|---|---|
| Criar baralho | v1 | Nome obrigatório (1 a 80 caracteres) e descrição opcional. |
| Editar baralho | v1 | Alterar nome e descrição. |
| Excluir baralho | v1 | Remove o baralho e seus cartões após confirmação. Exclusão é irreversível. |
| Listar baralhos | v1 | Tela inicial com todos os baralhos, mostrando nome, total de cartões e quantidade de cartões devidos hoje. |
| Ordenar baralhos | v1 | Por nome, data de criação ou quantidade de cartões devidos. |
| Buscar baralhos | v1 | Campo de busca por nome. |
| Cor ou ícone do baralho | Depois | Personalização visual para identificar baralhos. |
| Subbaralhos (hierarquia) | Depois | Baralhos aninhados, com estudo agregado do ramo. |
| Arquivar baralho | Depois | Oculta o baralho da lista sem excluí-lo; pode ser restaurado. |

Regras:

- Não é possível criar dois baralhos com o mesmo nome (comparação sem diferenciar maiúsculas e minúsculas).
- Um baralho sem cartões pode ser estudado apenas em modo de prática, se houver.

---

## 3. Cartões (cards)

Cada cartão tem frente (pergunta) e verso (resposta), ambos em texto.

| Funcionalidade | Prioridade | Descrição |
|---|---|---|
| Criar cartão | v1 | Frente e verso obrigatórios (1 a 2000 caracteres cada). Associado a um baralho. |
| Editar cartão | v1 | Alterar frente e verso. Preserva o histórico de revisões. |
| Excluir cartão | v1 | Remove o cartão e seu histórico, após confirmação. |
| Listar cartões do baralho | v1 | Lista com frente e situação (novo, em aprendizado, revisão, devido). |
| Buscar cartões | v1 | Busca em frente e verso dentro do baralho. |
| Mover cartão para outro baralho | Depois | Troca o cartão de baralho preservando o progresso. |
| Mover cartão em lote | Depois | Seleção múltipla para mover ou excluir. |
| Formatação básica (negrito, itálico) | Depois | Markdown simples no texto. |
| Imagens e áudio nos cartões | Depois | Anexos de mídia na frente ou no verso. |
| Tags | Depois | Rótulos livres para filtrar cartões entre baralhos. |
| Cartão reverso automático | Depois | Gera um segundo cartão invertendo frente e verso. |

Regras:

- Ao criar um cartão, ele entra no estado **novo** e fica disponível para estudo imediatamente.
- Frente e verso não podem ser vazios após remover espaços no início e no fim.

---

## 4. Repetição espaçada (SM-2)

O algoritmo SM-2 agenda a próxima revisão de cada cartão a partir da qualidade da resposta dada pelo usuário.

### 4.1 Dados por cartão

- `easeFactor` (fator de facilidade): valor inicial 2,5; mínimo 1,3.
- `interval` (intervalo em dias): 0 para cartões novos.
- `repetitions` (repetições bem-sucedidas consecutivas).
- `dueAt` (data e hora da próxima revisão).
- `state`: novo, aprendizado, revisão ou reaprendizado.

### 4.2 Avaliação do usuário

Ao ver o verso, o usuário escolhe uma de quatro respostas, que correspondem à qualidade `q` do SM-2:

| Botão | Significado | q |
|---|---|---|
| Errei | Não lembrei | 0 |
| Difícil | Lembrei com muita dificuldade | 3 |
| Bom | Lembrei com algum esforço | 4 |
| Fácil | Lembrei sem esforço | 5 |

### 4.3 Regras de cálculo

- Se `q < 3` (Errei): `repetitions` volta a 0, o cartão vai para reaprendizado e volta a ser exibido na mesma sessão (ou revisado em 1 dia, se a sessão já terminou). O fator de facilidade é reduzido.
- Se `q >= 3`:
  - 1ª repetição bem-sucedida: intervalo de 1 dia.
  - 2ª repetição bem-sucedida: intervalo de 6 dias.
  - Demais: `interval = round(interval * easeFactor)`.
- Atualização do fator de facilidade: `EF' = EF + (0,1 - (5 - q) * (0,08 + (5 - q) * 0,02))`, nunca abaixo de 1,3.
- Para "Difícil", o intervalo é multiplicado por um fator menor (por exemplo, 1,2) e para "Fácil" por um fator maior (por exemplo, 1,3), para diferenciar os botões no uso real. Esses multiplicadores são parâmetros de configuração.
- Cada revisão grava um registro em `reviews` (cartão, data, qualidade, intervalo anterior e novo, tempo de resposta).

### 4.4 Configurações de agendamento (v1)

- Limite de novos cartões por dia (padrão 20).
- Limite de revisões por dia (padrão 200).
- Intervalo máximo de revisão (padrão 365 dias).

### 4.5 Repetição espaçada avançada

| Funcionalidade | Prioridade |
|---|---|
| Algoritmo FSRS como alternativa ao SM-2 | Depois |
| Ajuste automático de parâmetros pelo histórico | Depois |
| Visualizar a previsão de intervalos antes de responder | Depois |

---

## 5. Sessões de estudo

| Funcionalidade | Prioridade | Descrição |
|---|---|---|
| Iniciar sessão por baralho | v1 | Estuda os cartões devidos e novos do baralho, respeitando os limites diários. |
| Sessão de estudo geral | v1 | Reúne os cartões devidos de todos os baralhos. |
| Exibir frente, depois verso | v1 | Toque para revelar a resposta, seguido dos quatro botões de avaliação. |
| Desfazer última resposta | v1 | Volta ao cartão anterior e reverte o agendamento. |
| Contador da sessão | v1 | Mostra restantes, acertos e erros. |
| Resumo ao final | v1 | Total revisado, tempo gasto e distribuição das respostas. |
| Modo prática (sem agendar) | Depois | Estudo livre que não altera o agendamento SM-2. |
| Estudo com cronômetro | Depois | Limite de tempo por cartão. |
| Estudo com gestos (deslizar) | Depois | Deslizar para avaliar; a v1 usa botões. |
| Ordem aleatória | v1 | Opção para embaralhar cartões devidos. |
| Pausar e retomar sessão | Depois | Guarda o estado da sessão ao sair. |

Regras:

- Cartões reaprendidos na mesma sessão reaparecem após pelo menos alguns cartões intermediários, quando houver.
- Sair no meio da sessão não perde as revisões já registradas.

---

## 6. Estatísticas

| Funcionalidade | Prioridade | Descrição |
|---|---|---|
| Revisões do dia | v1 | Quantidade de cartões revisados hoje e meta diária. |
| Sequência de dias (streak) | v1 | Dias consecutivos com pelo menos uma revisão. |
| Totais por estado | v1 | Quantidade de cartões novos, em aprendizado, em revisão e devidos. |
| Taxa de acerto | v1 | Percentual de respostas diferentes de "Errei", por período. |
| Previsão de revisões | v1 | Quantidade de cartões devidos nos próximos 7 dias. |
| Tempo de estudo | v1 | Tempo total e médio por cartão. |
| Estatísticas por baralho | v1 | Os indicadores acima filtrados por baralho. |
| Gráfico de revisões por dia (30 dias) | Depois | Visualização temporal. |
| Mapa de calor de atividade | Depois | Estilo calendário anual. |
| Taxa de retenção no longo prazo | Depois | Métrica baseada na probabilidade de lembrar. |

---

## 7. Importação e exportação (CSV)

### 7.1 Exportação

| Funcionalidade | Prioridade | Descrição |
|---|---|---|
| Exportar baralho para CSV | v1 | Uma linha por cartão com colunas: `deck`, `front`, `back`. |
| Exportar todos os baralhos | v1 | Um único arquivo CSV com a coluna `deck` identificando cada baralho. |
| Incluir progresso na exportação | Depois | Colunas extras de intervalo, fator de facilidade e data de revisão. |

Regras de formato:

- Codificação UTF-8, com separador vírgula e campos entre aspas quando necessário (RFC 4180).
- A primeira linha é o cabeçalho.
- O arquivo é salvo e compartilhado pelo seletor nativo do sistema (compartilhar ou salvar em arquivos).

### 7.2 Importação

| Funcionalidade | Prioridade | Descrição |
|---|---|---|
| Importar CSV com colunas `deck`, `front`, `back` | v1 | Cria baralhos inexistentes e adiciona os cartões. |
| Pré-visualização antes de importar | v1 | Mostra quantidade de linhas válidas, inválidas e baralhos a criar. |
| Relatório de erros | v1 | Lista linhas inválidas com o motivo (campo vazio, tamanho excedido). |
| Importar com cabeçalho personalizado (mapeamento de colunas) | Depois | Usuário associa colunas do arquivo aos campos do app. |
| Evitar duplicatas | Depois | Ignora cartões com mesma frente e mesmo baralho. |
| Importar progresso | Depois | Restaura intervalo e fator de facilidade a partir de colunas extras. |
| Importar outros formatos (Anki, Quizlet) | Depois | Conversores específicos. |

Regras:

- Linhas inválidas não interrompem a importação das demais; são reportadas ao final.
- A importação é feita em uma única transação: ou tudo é gravado, ou nada é alterado.
- Limite de 5.000 linhas por importação na v1.

---

## 8. Aparência e tema

| Funcionalidade | Prioridade | Descrição |
|---|---|---|
| Modo claro e escuro | v1 | Segue o tema do sistema por padrão, com opção manual (claro, escuro, sistema). |
| Tamanho de fonte do cartão | Depois | Ajuste de tamanho para leitura. |
| Temas de cor adicionais | Depois | Paletas alternativas. |

Requisitos: contraste mínimo WCAG AA em ambos os temas; a troca de tema não reinicia a sessão de estudo em andamento.

---

## 9. Notificações e lembretes

| Funcionalidade | Prioridade | Descrição |
|---|---|---|
| Lembrete diário | v1 | Notificação local em horário escolhido pelo usuário, quando há cartões devidos. |
| Ativar ou desativar lembretes | v1 | Nas configurações. Pedido de permissão na primeira ativação. |
| Lembrete só com cartões devidos | v1 | Não notifica se não há nada para revisar. |
| Notificação de sequência em risco | Depois | Aviso no fim do dia se a sequência ainda não foi mantida. |
| Notificações push (servidor) | Depois | Requer backend; fora da v1. |
| Lembretes por baralho | Depois | Horários diferentes por baralho. |

Requisitos: notificações locais, sem envio de dados a servidores externos na v1.

---

## 10. Armazenamento e dados

| Funcionalidade | Prioridade | Descrição |
|---|---|---|
| Armazenamento local (offline) | v1 | Todos os dados ficam no dispositivo; o app funciona sem internet. |
| Backup e restauração (arquivo local) | v1 | Exporta um arquivo com todos os dados e reimporta. |
| Sincronização entre dispositivos | Depois | Conta de usuário e sincronização em nuvem. |
| Backup automático em nuvem | Depois | Integração com serviços de armazenamento do sistema. |

Entidades principais: `decks`, `cards`, `reviews`, `settings`.

---

## 11. Configurações

| Funcionalidade | Prioridade |
|---|---|
| Tema (claro, escuro, sistema) | v1 |
| Limites diários de novos cartões e revisões | v1 |
| Horário e ativação do lembrete diário | v1 |
| Exportar e importar CSV | v1 |
| Backup e restauração | v1 |
| Idioma da interface | Depois |
| Sobre o app e licença (MIT) | v1 |

---

## 12. Requisitos não funcionais

- Desempenho: abrir a lista de baralhos e iniciar uma sessão em menos de 1 segundo com 10.000 cartões no dispositivo.
- Funcionamento offline completo na v1.
- Acessibilidade: tamanhos de toque de pelo menos 44 pt, rótulos para leitores de tela e suporte a escala de fonte do sistema.
- Privacidade: nenhum dado pessoal coletado na v1; sem rastreadores.
- Plataformas: Android e iOS com a mesma base de código (Expo).
- Qualidade: tipagem com TypeScript sem erros (`tsc --noEmit`) e testes automatizados para o cálculo do SM-2 e para o parser de CSV.

---

## 13. Resumo de escopo

**v1 (entrega inicial):** baralhos e cartões (CRUD, busca, ordenação); repetição espaçada SM-2 com quatro respostas; sessões de estudo com desfazer e resumo; estatísticas básicas; importação e exportação CSV com pré-visualização; tema claro e escuro; lembrete diário local; armazenamento offline e backup local.

**Depois:** subbaralhos; mídia e tags nos cartões; FSRS; modo prática; estudo com gestos e cronômetro; gráficos avançados; importação de Anki e Quizlet; sincronização em nuvem e contas de usuário; notificações push.
