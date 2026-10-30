# Organizador de Chamados & Demandas (Desktop Windows)
### Conciliador Contábil - Importer Ultra

Aplicativo Desktop moderno para Windows desenvolvido para organizar, filtrar e gerenciar as demandas do suporte com sincronização em tempo real via API oficial.

---

## 🚀 Como Iniciar o Aplicativo

1. Basta dar um duplo clique no arquivo **`iniciar.bat`** na pasta do projeto.
2. Ou via terminal / prompt de comando:
   ```bash
   npm start
   ```

---

## ✨ Recursos Principais

### 1. Sistema de Filtros Fixos (Views Salvas)
- **Filtros Prontos de Fábrica**:
  - ⚡ **Todas as Demandas**
  - 👤 **Minhas Demandas** (Chamados atribuídos a você ou abertos por você)
  - 📥 **Na Fila** (Demandas aguardando início)
  - 🚀 **Em Progresso**
  - ⏳ **Aguardando Resposta do N2** (Demandas aguardando retorno do suporte/solicitante N2)
  - 🔍 **Em Revisão** (Aguardando validação)
  - ✅ **Chamados Concluídos** (Demandas finalizadas)
  - 📑 **Concluídos (Documentar)** (Demandas finalizadas que possuem a etiqueta DOCUMENTAR)
  - ⚠️ **Erros e Urgências**
  - 📅 **Prazos Críticos** (Demandas vencidas ou com prazo para hoje)
  - ⭐ **Favoritos & Marcados**
  - 🚫 **Chamados Ignorados** (Isola os chamados que você optou por ignorar e os oculta das demais listas)

- **Criação de Novos Filtros Fixos**:
  - Clique em **`+ Novo`** na barra lateral de Filtros Fixos.
  - Defina o nome, ícone/emoji, cor e critérios (Situação, Tipo, Responsável, Banco/Cliente, Prazo).
  - Ou configure os filtros rápidos no topo e clique em **`Salvar como Filtro Fixo`**.
  - O filtro fixo fica salvo permanentemente no seu PC e exibe o contador de demandas em tempo real!

### 2. Modos de Visualização & Organização por Datas
- **📋 Tabela Inteligente**:
  - **Organização e Ordenação por Datas**:
    - Clique no cabeçalho **Prazo de Entrega** para ordenar por prazos mais próximos/atrasados ou mais distantes (▲ / ▼).
    - Clique no cabeçalho **Criado em** para ver os chamados mais recentes criados primeiro.
    - Clique no cabeçalho **Nº** para ordenar por número do chamado.
  - **Filtro Rápido por Data**:
    - 🔴 Atrasados (Vencidos)
    - 🟡 Para Hoje
    - 🟠 Para Amanhã
    - 📆 Esta Semana (próximos 7 dias)
    - 🗓️ Este Mês
    - ⚪ Sem Prazo Definido
  - **Badges de Prazos Inteligentes**:
    - Indicadores coloridos: `⚠️ Atrasado`, `🟡 Hoje`, `🟠 Amanhã`, `📅 Data futura`.
  - **Nº do Layout**: Exibe o código do layout apontado (ex: `6391`, `10407`, `10405`).
  - **Link Movidesk Oficial**: Abre direto no formato `https://conciliador-contabil2.movidesk.com/Ticket/Edit/{id}`.
  - Busca instantânea enquanto digita (`Ctrl+F`).
  - Marcador de estrelas (Favoritos) com 1 clique.
- **📊 Quadro Kanban**:
  - Cartões organizados em colunas por Situação (*Na Fila*, *Em Progresso*, *Aguardando*, *Em Revisão*, *Finalizado*).
  - Informações de layout (ex: `📐 6391`), banco de dados, badges de prazo e responsável com avatar.


### 3. ➕ Abertura de Novos Chamados Diretamente no App
- **Botão `+ Novo Chamado`** em destaque no topo (ou atalho **`Ctrl+N`**).
- **Formulário Completo e Inteligente**:
  - **Título da Demanda** e **Descrição Detalhada**.
  - **Tipo de Chamado**: *Novo Layout, Inclusão, Erro, Migração, Melhoria*.
  - **Produto**: *Conciliador, Conciliador Web, Importer, Reconcilia*.
  - **Desenvolvedor Responsável**: seleção direta da equipe (*Cairo Felipe, Igor Maduro, Helter Simões, etc.*).
  - **Prioridade**: *Baixa, Média, Alta, Urgente*.
  - **Banco de Dados do Cliente** (`cont_...`) e **Nº Movidesk** opcional.
  - **Busca Rápida de Layouts**: autocompletar ao digitar número ou nome do layout com busca em tempo real na API.
  - **Prazo de Entrega**: seletor de data.
- **Sincronização Imediata**: o chamado é enviado diretamente à API oficial, atualizado na lista/Kanban e aberto no painel de visualização na hora!

### 4. 🔍 Central de Visualização Completa & Sistema Multi-Abas
- **Espaço de Trabalho Multi-Abas**:
  - Abra múltiplos chamados em abas superiores dedicadas mantendo a aba fixa **📋 Demandas** sempre acessível.
  - Crie novos chamados em uma aba dedicada **➕ Novo Chamado** via botão superior ou atalho `Ctrl + N` sem interromper a navegação da lista geral.
  - Alternância instantânea de contexto sem recarregar e com preservação total de rascunhos de texto, formulário de novo chamado, anexos pendentes e posição de rolagem.
  - Atalhos de teclado rápidos: `Ctrl + N` (abrir aba de novo chamado), `Ctrl + W` (fechar chamado ou novo chamado), `Ctrl + Tab` / `Ctrl + Shift + Tab` (navegar entre abas), `Ctrl + 1` (voltar à lista geral) e `Ctrl + 2..9` (acesso direto à aba).
  - Proteção contra perda de dados com indicador visual de alterações pendentes (*dirty dot* `•`) e diálogo de confirmação.
- Clique em qualquer demanda na Tabela ou Kanban para abrir sua aba dedicada:
  - **🗖 Modo Expandido / Reduzido**: botão no cabeçalho para alternar entre painel lateral compacto e workspace amplo em tela cheia.
  - **Aba 📄 Ficha & Descrição**:
    - Ficha técnica completa: Solicitante, Responsável, Validador, Banco de Dados, Layout, Prazos SLA, Movidesk, Produto e Prioridade.
    - Botões de 1 clique: *Copiar Banco*, *Favorito*, *Ignorar*, *Arquivar Demanda*, *Abrir no Conciliador* e *Abrir Movidesk*.
    - Renderização da descrição completa com suporte a imagens integradas.
  - **Aba 💬 Diálogo & Respostas**:
    - Histórico completo de mensagens trocadas com os desenvolvedores.
    - Identificação visual por cargo (*Desenvolvedor, Suporte, Administrador*) com avatar e data/hora.
    - **Envio de Respostas**: campo de texto e botão para enviar mensagens diretamente para a equipe pelo sistema.
  - **Aba 🕒 Linha do Tempo**:
    - Histórico visual de todos os eventos da demanda (abertura, transições de situação, reatribuições de desenvolvedor).
  - **Aba 📎 Anexos**:
    - Cards de cada arquivo com ícone por extensão e botão para baixar/abrir diretamente.
  - **Aba 📝 Minhas Anotações Privadas**:
    - Bloco de notas local privado mantido e salvo automaticamente no seu computador.

### 5. Sincronização Automática
- Botão manual **Sincronizar** (`Ctrl+R`).
- Atualização em segundo plano a cada 1, 3, 5 ou 10 minutos (configurável no rodapé da barra lateral).
- Notificações nativas do Windows quando novas demandas forem recebidas ou criadas.

