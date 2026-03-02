# AUDITORIA COMPLETA + PROMPT PARA CLAUDE CODE
## Site: aguasegura.github.io/mapainterativo
## Data: 01/03/2026

---

# PARTE 1 — RELATÓRIO DE AUDITORIA

## 1. VISÃO GERAL DO REPOSITÓRIO

**URL**: https://aguasegura.github.io/mapainterativo/
**Repo**: https://github.com/aguasegura/mapainterativo
**Stack**: HTML estático + CSS + JavaScript vanilla (Leaflet.js, Turf.js, Pako) + GitHub Pages
**Arquivos principais**:
- `index.html` (875 linhas) — Página inicial/portal do programa
- `map.html` (61 linhas) — Página do mapa interativo Leaflet
- `selecaoregional.html` (91 linhas) — Página de seleção de regional
- `script.js` (1721 linhas) — Lógica do mapa (camadas, filtros, popups, legend)
- `home.js` (112 linhas) — Lógica da seleção de regional
- `styles.css` (806 linhas) — Estilos globais
- `assets/app.py` (294 linhas) — App Streamlit (explorador de camadas, NÃO usado no site)
- `data/baciasselecionadas.geojson` — GeoJSON principal (93 features)
- Diversos `.geojson_part-*.gz` comprimidos (curvas de nível, uso do solo, agrotóxicos, etc.)

---

## 2. AUDITORIA DE FRONTEND

### 2.1 Problemas Críticos

**F-01 | Número incorreto do TCTF no index.html**
- Linha 274: `CE 09/2024-GHID`
- Correto (conforme Termo de Cooperação oficial): `CE 009/2024-GHID`
- Severidade: ALTA — documento oficial usa 009

**F-02 | Links de PDF apontam para arquivos inexistentes**
Todos os links em `index.html` na seção "Materiais" apontam para `assets/*.pdf` que NÃO existem no repositório:
- `assets/tctf_ce09_2024.pdf`
- `assets/tctf_aditivos_despachos.pdf`
- `assets/diretrizes_manejo_microbacias.pdf`
- `assets/roteiro_prediagnostico_microbacias.pdf`
- `assets/modelos_fichas_relatorios_ur.pdf`
- `assets/mapas_tematicos_regionais.zip`
- `assets/materiais_educacao_ambiental.pdf`
- `assets/eventos_lancamentos_regionais.pdf`
- `assets/eventos_oficinas_planejamento.pdf`
- `assets/eventos_dias_campo_visitas.pdf`
- `assets/capacitacao_mapa_interativo.pdf`
- `assets/capacitacao_diagnostico_monitoramento.pdf`
- `assets/capacitacao_urts_planejamento.pdf`
- `assets/capacitacao_praticas_conservacao.pdf`
- `assets/capacitacao_governanca_participacao.pdf`
- `assets/capacitacao_bioinsumos_mip.pdf`
- Total: 16 links quebrados para PDFs/ZIPs inexistentes
- Severidade: ALTA — usuários clicam e recebem erro 404

**F-03 | Erro SSL intermitente**
- O site apresenta `ERR_SSL_PROTOCOL_ERROR` intermitentemente
- Provável problema de configuração do GitHub Pages com custom domain ou HTTPS enforcement
- Severidade: MÉDIA — afeta acesso de usuários esporadicamente

### 2.2 Problemas de Layout e Responsividade

**F-04 | Barra superior (topbar) do mapa congestionada em telas médias**
- Em `map.html`, a topbar contém logos, region pill, botões "Trocar regional", "Início", "Ajustar visão", slider de opacidade e versão
- Em viewports de 768-1024px, os elementos ficam apertados e podem empilhar de forma desordenada
- O CSS tem breakpoints em `max-width: 980px` e `max-width: 640px`, mas a transição entre eles não é suave
- Severidade: MÉDIA

**F-05 | Falta de meta description e Open Graph**
- Nenhuma das 3 páginas HTML tem `<meta name="description">` ou tags Open Graph
- Prejudica SEO e compartilhamento em redes sociais
- Severidade: BAIXA

**F-06 | Favicon inconsistente**
- `data/aguasegura_ico.ico` — funciona, mas a extensão `.ico` é antiga
- Não há fallback em PNG ou SVG para dispositivos modernos
- Severidade: BAIXA

### 2.3 Acessibilidade

**F-07 | Contraste insuficiente em textos muted**
- CSS `--muted: #94a3b8` sobre fundo branco — ratio ~3.3:1, abaixo do mínimo WCAG AA (4.5:1 para texto normal)
- Afeta: slider label "Opacidade", versão "IDR-Paraná · 2026", dicas na landing
- Severidade: MÉDIA

**F-08 | Falta de ARIA labels em controles do mapa**
- O slider `#opacity` não tem `aria-label` ou `<label>` associado
- O botão `#fitAll` não tem `aria-label` descritivo
- O painel de filtros lateral (gerado dinamicamente) não tem roles ARIA adequados
- Severidade: MÉDIA

**F-09 | Imagens sem alt text descritivo**
- Os logos no header usam alt genéricos como "Programa Água Segura", "Sanepar" — aceitável, mas poderiam ser mais descritivos
- Severidade: BAIXA

### 2.4 Performance

**F-10 | Carregamento de bibliotecas externas via CDN sem fallback**
- Leaflet 1.9.4 via `unpkg.com`
- Pako 2.1.0 via `unpkg.com`
- Turf 6.5.0 via `unpkg.com`
- Se unpkg cair, o mapa inteiro quebra. Não há fallback local
- Severidade: MÉDIA

**F-11 | GeoJSON principal carregado inteiro sem lazy loading**
- `baciasselecionadas.geojson` (~1.1MB, 93 features) é carregado por inteiro no home.js para extrair regionais
- No script.js, o mesmo arquivo é carregado novamente para o mapa
- Poderia ser otimizado com cache ou dados embutidos
- Severidade: BAIXA

**F-12 | GeoJSONs comprimidos (gz) são pesados**
- Camadas como curvas de nível, uso do solo e agrotóxicos usam partes .gz que podem ser muito pesadas
- Descompressão em browser via Pako pode causar lentidão em dispositivos modestos
- Severidade: BAIXA (funcional, mas lento em celulares)

### 2.5 Código JavaScript

**F-13 | Hardcoded default region "Curitiba" no script.js**
- Se o usuário acessa map.html diretamente sem `?region=`, o código força "Curitiba"
- Melhor: redirecionar para selecaoregional.html
- Severidade: BAIXA

**F-14 | FILTER_FIELDS usa 'Regional I' como campo principal de filtragem**
- Mas no GeoJSON, o campo real é `Regional IDR`
- O código usa FILTER_ALIASES para lidar com isso, mas é confuso e frágil
- Se algum dado usar apenas `Regional I`, funcionaria; mas atualmente os dados usam `Regional IDR`
- Severidade: BAIXA (funciona via aliases, mas confuso)

**F-15 | CRS do GeoJSON é EPSG:4736**
- O GeoJSON usa `urn:ogc:def:crs:EPSG::4736` — este é um CRS pouco comum (SAD 1969 / Brazil Polyconic)
- Leaflet espera WGS84 (EPSG:4326) por padrão
- Se o Leaflet estiver interpretando as coordenadas como WGS84, pode haver pequeno deslocamento
- Severidade: MÉDIA — verificar se as posições no mapa estão corretas

---

## 3. AUDITORIA DE BACKEND / DADOS

### 3.1 Dados GeoJSON

**D-01 | GeoJSON "baciasselecionadas" contém 93 features, mas documentos indicam 27 microbacias e ~46 mananciais**
- O TCTF e documentos do programa mencionam "27 microbacias hidrográficas"
- O campo `Cod_man` vai de 1 a 46, indicando 46 mananciais
- 93 features representam sub-bacias (microbacias por código otto), não microbacias inteiras
- O site deveria explicar essa diferença (93 polígonos = múltiplos trechos de 46 mananciais em 27 microbacias)
- Severidade: MÉDIA — confusão conceitual para usuários

**D-02 | Feature #89 e #90 são duplicatas**
- Ambas têm `Cod_otto: 84226511`, mesmo manancial "Pato Branco", mesmo município
- Geometrias provavelmente idênticas
- Severidade: BAIXA

**D-03 | Campo "Classe" tem apenas 2 valores: "Sanepar" e "IDR-Paraná"**
- Não está claro o que "Classe" significa para o usuário final
- Deveria ser explicado como "Responsabilidade" ou "Gestão" (quem seleciona aquela microbacia)
- Severidade: BAIXA

**D-04 | Falta de dados dinâmicos/reais de monitoramento**
- O GeoJSON contém apenas dados cadastrais estáticos
- Não há dados de: qualidade da água, status do Checklist PRNS, progresso das URTs, indicadores de solo
- O programa prevê coleta contínua desses dados
- Severidade: ALTA — o site não cumpre a função de monitoramento

**D-05 | Sem camada de URTs/Unidades de Referência**
- O programa tem como meta mínimo 125 URTs
- Não há nenhuma camada GeoJSON ou dados de URTs no repositório
- Severidade: ALTA — dado fundamental do programa ausente

**D-06 | Sem integração com dados SANEPAR (mananciais ativos, SAAs)**
- O TCTF prevê compartilhamento de dados operacionais da SANEPAR
- O GeoJSON tem `Manancial` como texto, mas sem dados de captação, vazão, qualidade
- Severidade: MÉDIA

### 3.2 App Streamlit (assets/app.py)

**D-07 | App Streamlit não é acessível via GitHub Pages**
- O `assets/app.py` é um app Streamlit que requer servidor Python
- GitHub Pages não executa Python
- Não há link ou referência ao app no site
- O `requirements.txt` lista dependências (geopandas, streamlit, pydeck, pyproj)
- Deveria ou ser removido do repo principal, ou ter instruções de deploy separadas
- Severidade: BAIXA (não afeta o site, mas gera confusão)

### 3.3 Backend Ausente

**D-08 | Sem backend para coleta e armazenamento de dados**
- O site é 100% estático (GitHub Pages)
- Não há formulários de coleta, API REST, ou banco de dados
- Para virar ferramenta de gestão, precisa de backend para:
  - Registro de URTs e propriedades
  - Checklist PRNS (entrada de dados)
  - Upload de fotos e relatórios
  - Dashboard de indicadores
- Severidade: ALTA — limitação arquitetural fundamental

---

## 4. AUDITORIA DE CONTEÚDO

### 4.1 Erros e Inconsistências com Documentos Oficiais

**C-01 | Número do TCTF inconsistente**
- Site (index.html, linha 274): `CE 09/2024-GHID`
- Documentos oficiais (Termo de Cooperação, cláusulas iniciais): `CE 009/2024-GHID`
- O formato com zeros à esquerda (009) é o oficial
- Severidade: ALTA

**C-02 | Valor total do TCTF não mencionado no site**
- O Termo de Cooperação define R$ 10.929.019,79
- A composição: IDR econômico R$ 5.378.219,79 + SANEPAR econômico R$ 1.145.000 + SANEPAR financeiro R$ 4.405.800
- O site não menciona esses valores em nenhum lugar
- Severidade: MÉDIA — informação relevante para transparência

**C-03 | Nomes dos gestores ausentes**
- TCTF Cláusula 5.2: Gestor IDR = Avner Paes Gomes; Fiscal IDR = Amauri Ferreira Pinto
- TCTF Cláusula 5.3: Gestor SANEPAR = Raul Alberto Marcon; Fiscal SANEPAR = Adriana de Souza Trigo
- O site não menciona gestores/responsáveis
- Severidade: BAIXA — pode ser intencional por privacidade

**C-04 | Prazo do programa não mencionado**
- TCTF prevê 48 meses (4 anos), com vigência até ~2028
- O site fala do "ciclo 2026-2027" mas não contextualiza o prazo total
- Severidade: BAIXA

**C-05 | Número de microbacias inconsistente**
- Index.html, seção "Fase 1": menciona "priorização de 100 microbacias"
- Documentos oficiais: 27 microbacias selecionadas no TCTF
- GeoJSON: 93 features cobrindo 46 mananciais
- O "100 microbacias" parece ser meta futura do PRNS (não apenas do Água Segura)
- Severidade: ALTA — confunde escopo do TCTF com meta do PRNS

**C-06 | Falta de lista das 27 microbacias oficiais**
- O TCTF tem lista específica de microbacias
- O site não apresenta essa lista nem relaciona com os dados do GeoJSON
- Severidade: MÉDIA

**C-07 | Checklist PRNS descrito genericamente**
- Index.html menciona Bronze/Prata/Ouro e 0-60 pontos
- Não detalha os critérios (6 dimensões: solo, água, biodiversidade, produção, social, gestão)
- PPTX de planejamento mostra critérios detalhados que não estão no site
- Severidade: MÉDIA

### 4.2 Conteúdo Faltante (com base nos documentos do programa)

**C-08 | Página "Sobre o Programa" inexistente**
Deveria conter:
- Histórico (PSA da SANEPAR desde 2019, parceria com IDR-Paraná)
- Objetivos centrais (do TCTF e do PRNS)
- Parceiros e seus papéis (IDR-Paraná, SANEPAR, IAT, ADAPAR, SIMEPAR, SEAB)
- Metas quantitativas (27 microbacias, 125 URTs, R$10.9M, 4 anos)
- Severidade: ALTA

**C-09 | Dados de contato e institucional ausentes**
- Sem email, telefone, endereço do programa
- Sem links para sites institucionais (IDR-Paraná, SANEPAR)
- Severidade: MÉDIA

**C-10 | Falta seção de metodologia/abordagem**
- O PSA (Plano de Segurança da Água) é metodologia central — não explicado no site
- A abordagem por microbacia hidrográfica como unidade de planejamento — não explicada
- Severidade: MÉDIA

**C-11 | Falta seção PRNS detalhada**
- O PRNS é o programa-mãe que contextualiza o Água Segura
- Os 6 eixos, critérios Bronze/Prata/Ouro, pontuação, não estão detalhados
- O PPTX tem organograma, cronograma, visão "onde estamos hoje" — nada disso está no site
- Severidade: MÉDIA

**C-12 | Sem indicadores ou dashboard de progresso**
- O programa prevê monitoramento por indicadores
- O site não tem nenhum dashboard, gráfico ou painel de progresso
- O link do Power BI existe mas está em card lateral pouco visível
- Severidade: ALTA

**C-13 | Regionais do GeoJSON — sem contexto**
As 21 regionais do IDR-Paraná listadas no GeoJSON:
Apucarana, Campo Mourão, Cascavel, Cianorte, Cornélio Procópio, Curitiba, Dois Vizinhos, Francisco Beltrão, Guarapuava, Irati, Ivaiporã, Laranjeiras do Sul, Londrina, Maringá, Paranaguá, Paranavaí, Pato Branco, Ponta Grossa, Santo Antonio da Platina, Toledo, Umuarama, União da Vitória
- Sem nenhuma informação sobre cada regional (n° de microbacias, municípios, equipe responsável)
- Severidade: MÉDIA

**C-14 | Seção de "Eventos" vazia/genérica**
- 3 links genéricos para PDFs inexistentes
- Nenhum evento real listado com data, local, participantes
- Severidade: MÉDIA

**C-15 | Falta referência ao Memorial Descritivo (Projeto Básico)**
- O Memorial Descritivo v4 detalha cada atividade com composições de custo
- É o documento operacional principal — não mencionado no site
- Severidade: MÉDIA

### 4.3 Conteúdo do PPTX não refletido no site

**C-16 | Cronograma Ponta Grossa (2026-2027) do PPTX não está no site**
- Slide 26 mostra cronograma detalhado por fases: Organização Regional → Marco Zero → Planejamento Detalhado → Implementação → Monitoramento → Consolidação
- Datas específicas: Fev-Mar/2026, Abr-Jun/2026, Jul-Ago/2026, Set/2026-Abr/2027, Jan-Mai/2027, Jun-Jul/2027
- Severidade: MÉDIA

**C-17 | Organograma do Departamento de Sustentabilidade não está no site**
- Slide 22: Diretoria de Extensão Rural → Chefia do Dept. Sustentabilidade → Assessoria → 3 eixos (Edafologia/Hidrologia, Sustentabilidade, Gestão) → 8 NGPs
- Severidade: BAIXA

**C-18 | "Onde estamos hoje" (slide 24) não refletido**
- Diagnósticos concluídos
- Abrangência territorial consolidada
- Investimento público realizado e orçamento pronto
- Expectativa criada junto aos territórios
- Severidade: MÉDIA

---

## 5. RESUMO DA AUDITORIA

| Categoria | Críticos | Médios | Baixos | Total |
|-----------|----------|--------|--------|-------|
| Frontend  | 3 (F-01, F-02, F-03) | 4 (F-04, F-07, F-08, F-10) | 8 (F-05, F-06, F-09, F-11, F-12, F-13, F-14, F-15) | 15 |
| Backend/Dados | 3 (D-04, D-05, D-08) | 2 (D-01, D-06) | 3 (D-02, D-03, D-07) | 8 |
| Conteúdo | 4 (C-01, C-05, C-08, C-12) | 9 (C-02, C-06, C-07, C-09, C-10, C-11, C-13, C-14, C-15) | 5 (C-03, C-04, C-16, C-17, C-18) | 18 |
| **TOTAL** | **10** | **15** | **16** | **41** |

---
---

# PARTE 2 — PROMPT DETALHADO PARA CLAUDE CODE

```
# PROMPT PARA CLAUDE CODE — ATUALIZAÇÃO DO SITE PROGRAMA ÁGUA SEGURA

## CONTEXTO
Você está trabalhando no repositório `aguasegura/mapainterativo` hospedado no GitHub Pages em `aguasegura.github.io/mapainterativo/`. O site é o portal do Programa Água Segura, uma parceria entre IDR-Paraná e SANEPAR (TCTF CE 009/2024-GHID, R$ 10,9 milhões, 4 anos, 2024-2028). O site tem 3 páginas HTML, 2 arquivos JS, 1 CSS, dados GeoJSON e arquivos comprimidos de camadas geoespaciais.

Foi realizada uma auditoria completa que identificou 41 problemas em 3 categorias: Frontend (15), Backend/Dados (8), Conteúdo (18). Sua tarefa é corrigir esses problemas de forma organizada, priorizando os críticos.

## ARQUIVOS DO PROJETO
- `index.html` — Página inicial/portal (875 linhas)
- `map.html` — Página do mapa interativo (61 linhas)
- `selecaoregional.html` — Seleção de regional (91 linhas)
- `script.js` — Lógica do mapa Leaflet (1721 linhas)
- `home.js` — Lógica da seleção de regional (112 linhas)
- `styles.css` — Estilos globais (806 linhas)
- `data/baciasselecionadas.geojson` — GeoJSON principal (93 features, 8 propriedades: Nome_bacia, Cod_otto, Classe, Manancial, Cod_man, Regional IDR, NomeMunicipio, CodIBGE)
- `assets/app.py` — App Streamlit (não usado no site, manter como está)

## DADOS REAIS DO PROGRAMA (usar para atualizar conteúdo)

### Identificação
- Nome: Programa Água Segura
- TCTF: CE 009/2024-GHID (NÃO "CE 09/2024")
- Valor total: R$ 10.929.019,79
  - IDR contrapartida econômica: R$ 5.378.219,79
  - SANEPAR contrapartida econômica: R$ 1.145.000,00
  - SANEPAR repasse financeiro (SIT/TCE): R$ 4.405.800,00
- Vigência: 48 meses (2024-2028)
- Partes: SANEPAR + IDR-Paraná (com participação IAT, ADAPAR, SIMEPAR, SEAB)
- Gestor IDR: Avner Paes Gomes (Coordenador Estadual de Programas e Projetos)
- Fiscal IDR: Amauri Ferreira Pinto (Gerente Estadual)
- Gestor SANEPAR: Raul Alberto Marcon (Coordenador de Gestão de Recursos Hídricos)
- Fiscal SANEPAR: Adriana de Souza Trigo

### Números-chave
- 27 microbacias hidrográficas selecionadas (NÃO confundir com 93 features do GeoJSON que são sub-bacias)
- 46 mananciais abrangidos
- Mínimo 125 URTs (Unidades de Referência Tecnológica), 3-5 por microbacia
- 21 regionais do IDR-Paraná com microbacias atendidas
- 252 mananciais superficiais da SANEPAR no PR total

### Parceiros e Papéis
- IDR-Paraná: Extensão rural, assistência técnica, execução de campo, gestão do programa
- SANEPAR: Financiamento, dados de mananciais, monitoramento de qualidade da água
- IAT (Instituto Água e Terra): Fiscalização ambiental, CAR, licenciamento
- ADAPAR: Fiscalização agropecuária, controle de agrotóxicos
- SIMEPAR: Dados meteorológicos e hidrológicos
- SEAB: Política agrícola estadual

### PRNS (Programa de Recursos Naturais e Sustentabilidade)
- Programa-mãe do IDR-Paraná que contextualiza o Água Segura
- Checklist PRNS: 6 dimensões de sustentabilidade, pontuação 0-60
- Classificação: Bronze (0-20), Prata (21-40), Ouro (41-60)
- Marco Zero: aplicação inicial do checklist
- Marco 1: reaplicação para medir evolução

### Metodologia Central
- PSA (Plano de Segurança da Água) — OMS, Portaria GM/MS 888/2021, NBR 17080/2023
- Microbacia hidrográfica como unidade de planejamento
- Ciclo: diagnóstico → planejamento → implantação → monitoramento → avaliação
- URTs: propriedades modelo com Plano Individual de Propriedade (PIP)
- Unidades Multiplicadoras: vinculadas às URTs para disseminação

### Cronograma do Ciclo 2026-2027 (18 meses)
- Fase 1 (Fev-Mar/2026): Organização e alinhamento regional
- Fase 2 (Abr-Jun/2026): Diagnóstico e Marco Zero
- Fase 3 (Jul-Ago/2026): Planejamento tático-operacional
- Fase 4 (Set/2026-Abr/2027): Implementação em campo
- Fase 5 (Jan-Mai/2027): Monitoramento e ajustes (Marco 1)
- Fase 6 (Jun-Jul/2027): Consolidação e escala

### Grandes Eixos de Ação
1. Intensificação sustentável e redesenho de sistemas de produção
2. Conservação de solos e água
3. Adaptação e resiliência climática
4. Aumento do carbono no solo
5. Reflorestamento e arborização funcional
6. Bioinsumos e MIP/MID/MIPD
7. Educação continuada e comunicação

### Organograma do Departamento de Sustentabilidade
- Diretoria de Extensão Rural
  - Chefia do Departamento de Sustentabilidade
    - Assessoria de Sustentabilidade
      - Edafologia e Hidrologia (NGP Solos, NGP Hidrologia, NGP Florestas)
      - Sustentabilidade (NGP Manejo Integrado, NGP Educação Ambiental, NGP Tecnologia de Aplicação)
      - Gestão (NGP Geoprocessamento, NGP Comunicação)

### Governança do Programa
- Fórum Estadual (estratégico): Diretoria IDR, SEAB, SANEPAR, IAT, ADAPAR, SIMEPAR — reuniões mensais
- Coordenação Estadual (tático): Coordenador Estadual + técnicos de referência — atuação contínua
- Comitê Regional (operacional): Gerente Regional + extensionistas — reuniões bimestrais

## CORREÇÕES A IMPLEMENTAR (em ordem de prioridade)

### PRIORIDADE 1 — Correções Críticas

#### 1.1 Corrigir número do TCTF
Em `index.html`, substituir TODAS as ocorrências de `CE 09/2024` por `CE 009/2024`.
Buscar em todos os arquivos HTML e JS qualquer referência ao número do TCTF e padronizar.

#### 1.2 Corrigir/remover links quebrados de PDFs
Em `index.html`, todos os links `href="assets/*.pdf"` apontam para arquivos inexistentes.
Opções (escolher uma):
a) **Recomendado**: Converter os links em texto descritivo com nota "(em preparação)" ou "(disponível em breve)" e remover o `<a>` tag. Manter a descrição do documento.
b) Alternativa: Criar arquivos PDF placeholder com uma página dizendo "Documento em elaboração — [nome do documento]" e colocá-los em `assets/`.
c) Alternativa: Comentar os links no HTML com `<!-- TODO: adicionar quando disponível -->`.

Ação: Implementar opção (a) — remover links, manter texto, adicionar badge/tag "(em preparação)".

#### 1.3 Corrigir inconsistência no número de microbacias
Em `index.html`, a seção "Fase 1" menciona "priorização de 100 microbacias". Corrigir para:
- Deixar claro que o TCTF Água Segura abrange 27 microbacias selecionadas com 46 mananciais
- O PRNS tem meta futura de expandir para mais microbacias
- Texto sugerido: "consolidação dos diagnósticos das 27 microbacias do Programa Água Segura e definição de prioridades para expansão futura"

#### 1.4 Criar seção "Sobre o Programa" 
Criar uma nova seção na `index.html` ANTES do "Resumo executivo" ou transformar o resumo executivo em seção mais completa, incluindo:
- Histórico (PSA da SANEPAR desde 2019, parceria IDR em 2024)
- Objetivos centrais do TCTF
- Metas quantitativas (27 microbacias, 125 URTs, R$10.9M, 4 anos)
- Parceiros e papéis
- Metodologia (PSA + microbacia como unidade de planejamento)

#### 1.5 Adicionar indicadores/status do programa
Na sidebar ou em nova seção, adicionar cards com números-chave:
- 27 microbacias atendidas
- 46 mananciais protegidos
- 21 regionais envolvidas
- 125+ URTs planejadas
- R$ 10,9M investidos
- 48 meses de duração
Usar design de cards com números grandes e labels descritivos.

### PRIORIDADE 2 — Correções Médias

#### 2.1 Melhorar contraste de cores (acessibilidade)
Em `styles.css`, alterar:
- `--muted: #94a3b8` → `--muted: #64748b` (ratio ~5.5:1, WCAG AA compliant)
- Verificar que todos os textos com classe `.muted` ficam legíveis

#### 2.2 Adicionar ARIA labels
Em `map.html`:
- Slider `#opacity`: adicionar `aria-label="Opacidade das camadas do mapa"`
- Botão `#fitAll`: adicionar `aria-label="Ajustar visão para mostrar todas as microbacias"`
- Adicionar `role="region" aria-label="Filtros do mapa"` no painel lateral

#### 2.3 Adicionar meta description e Open Graph
Em cada arquivo HTML, adicionar no `<head>`:
```html
<meta name="description" content="Programa Água Segura — Mapa interativo e portal de gestão das microbacias hidrográficas do Paraná. Parceria IDR-Paraná e SANEPAR." />
<meta property="og:title" content="Programa Água Segura — Mapa Interativo" />
<meta property="og:description" content="Portal de gestão das microbacias hidrográficas do Programa Água Segura. 27 microbacias, 46 mananciais, 21 regionais." />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://aguasegura.github.io/mapainterativo/" />
```

#### 2.4 Adicionar seção PRNS detalhada
Em `index.html`, criar seção "Programa PRNS" com:
- Explicação do PRNS como programa-mãe
- Checklist: 6 dimensões, pontuação 0-60
- Classificação Bronze/Prata/Ouro com descrição visual (cores, ícones)
- Relação PRNS ↔ Água Segura

#### 2.5 Criar seção com lista das 27 microbacias
Usar dados do GeoJSON para gerar tabela ou lista agrupada por Regional:
- Regional → Município → Manancial → Classe (IDR-Paraná / Sanepar)
- Agrupar as 93 sub-bacias (features) por manancial (46 únicos) e regional (21 únicas)

#### 2.6 Adicionar contexto nas regionais (selecaoregional.html)
Ao selecionar uma regional, mostrar:
- Número de microbacias/mananciais naquela regional
- Municípios envolvidos
- Extrair esses dados do GeoJSON em tempo de carregamento

#### 2.7 Melhorar seção de Eventos
Substituir links quebrados por:
- Lista de eventos reais (extrair do cronograma do PPTX e da seção de capacitações já existente)
- Se não houver eventos confirmados, manter texto "Programação de eventos em definição"
- Integrar com o calendário que já existe na página

#### 2.8 Referência ao Memorial Descritivo
Na seção "Materiais", adicionar referência ao Memorial Descritivo (Projeto Básico v4) como documento técnico operacional principal, mesmo sem PDF (marcar como "em preparação").

#### 2.9 Verificar/documentar CRS do GeoJSON
O GeoJSON usa EPSG:4736. Verificar se o Leaflet está interpretando corretamente.
Se houver deslocamento, adicionar transformação de coordenadas no script.js.
Idealmente, converter o GeoJSON para EPSG:4326 (WGS84) que é o padrão web.

#### 2.10 Valor do TCTF e transparência financeira
Adicionar, na seção "Sobre o Programa" ou em card lateral:
- Valor total: R$ 10.929.019,79
- Composição: contrapartidas econômicas e financeiras
- Fonte: TCTF CE 009/2024-GHID

### PRIORIDADE 3 — Melhorias Opcionais

#### 3.1 Fallback local para bibliotecas CDN
Adicionar fallback local para Leaflet, Pako e Turf:
```javascript
if (!window.L) { 
  document.write('<script src="lib/leaflet.js"><\/script>'); 
}
```
Baixar versões locais em pasta `lib/`.

#### 3.2 Remover duplicata no GeoJSON
Feature #89 e #90 são idênticas (Cod_otto: 84226511, Pato Branco). Remover uma delas.

#### 3.3 Redirect de map.html sem região
Em `script.js`, ao invés de forçar "Curitiba" como default, redirecionar para `selecaoregional.html`:
```javascript
if (!selectedRegion) {
  window.location.href = 'selecaoregional.html';
  return;
}
```

#### 3.4 Explicar campo "Classe" no GeoJSON
No popup do mapa ou em tooltip, explicar que "Classe" = entidade responsável pela seleção/gestão daquela microbacia.

#### 3.5 Limpar campo FILTER_FIELDS
Em `script.js`, o `FILTER_FIELDS.region` usa `'Regional I'` mas os dados usam `'Regional IDR'`. Trocar para:
```javascript
const FILTER_FIELDS = {
  region: 'Regional IDR',
  municipality: 'NomeMunicipio',
  manancial: 'Manancial'
};
```
E ajustar FILTER_ALIASES para manter compatibilidade.

#### 3.6 Adicionar link para Manual Operativo e Guia Prático
Na seção de materiais, referenciar:
- Guia Prático do Programa Água Segura (v03)
- Manual Operativo do Programa Água Segura
Mesmo que em preparação.

#### 3.7 Favicon moderno
Adicionar `<link rel="icon" type="image/png" href="data/aguasegura_favicon.png">` como fallback moderno.

#### 3.8 Organograma visual
Adicionar organograma do Departamento de Sustentabilidade como imagem SVG ou HTML/CSS na seção de governança.

#### 3.9 Status "Onde estamos hoje"
Adicionar seção com status atual do programa:
- Diagnósticos das microbacias concluídos
- Abrangência territorial consolidada
- Investimento público realizado e orçamento pronto
- Expectativa criada junto aos territórios
- Próximo passo: fase de execução territorial

## INSTRUÇÕES DE IMPLEMENTAÇÃO

1. **Não alterar a funcionalidade do mapa** — o mapa Leaflet em map.html/script.js funciona bem. Focar nas correções de conteúdo e frontend da index.html.

2. **Manter o design existente** — usar as mesmas classes CSS, variáveis (`:root`), e padrões visuais. O site tem um design limpo e profissional que deve ser mantido.

3. **Testar responsividade** — após alterações, verificar em 3 viewports: mobile (375px), tablet (768px), desktop (1440px).

4. **Commits organizados** — um commit por categoria de correção:
   - "fix: corrigir número TCTF CE 009/2024"
   - "fix: remover links quebrados de PDFs"
   - "feat: adicionar seção Sobre o Programa"
   - "feat: adicionar indicadores numéricos"
   - "fix: melhorar acessibilidade (contraste, ARIA)"
   - "feat: adicionar meta tags SEO e Open Graph"
   - "feat: seção PRNS detalhada"
   - "feat: lista de microbacias por regional"
   - etc.

5. **Manter compatibilidade com GitHub Pages** — tudo deve ser estático. Sem dependências server-side.

6. **Idioma: Português do Brasil** — todo conteúdo em pt-BR.

7. **Não remover** assets/app.py — é ferramenta auxiliar separada.
```

---

# FIM DO DOCUMENTO
