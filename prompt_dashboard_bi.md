# Prompt para Claude Code — Painel BI Interativo (dashboard.html)

## Objetivo

Criar uma nova página `dashboard.html` no repositório `mapainterativo` que substitua o painel Power BI quebrado do Programa Água Segura. O painel deve:

1. Ler os dados dos GeoJSON existentes (`baciasselecionadas.geojson` com 93 polígonos e `urs_part1` com 31 URTs)
2. Replicar e melhorar as 8 páginas do Power BI original
3. Usar React 18 + Recharts + D3.js via CDN (sem build step — o site roda em GitHub Pages como vanilla JS)
4. Ser **formatado para impressão A4** (cada aba/página do dashboard deve caber em uma folha A4 paisagem)
5. Integrar-se à navegação breadcrumb existente do site

---

## Estrutura do Repositório (GitHub Pages — sem build step)

```
mapainterativo/
├── index.html          ← Landing page (sobre o programa)
├── selecaoregional.html ← Seleção de regional IDR
├── map.html            ← Mapa interativo Leaflet
├── dashboard.html      ← NOVA PÁGINA (criar esta)
├── styles.css          ← CSS global compartilhado
├── script.js           ← Lógica do mapa (Leaflet + turf.js)
├── home.js             ← Lógica da seleção regional
└── data/
    ├── baciasselecionadas.geojson  ← 93 ottobacias (polígonos)
    ├── urs_part1                    ← 31 URTs (pontos)
    ├── aguaseguralogo2.png
    ├── logo_sanepar.jpg
    ├── Logo_IAT_PR.png
    ├── adapar.png
    ├── logo_IDR-SEAB.png
    └── aguasegura_ico.ico
```

**IMPORTANTE:** O site é 100% estático servido pelo GitHub Pages. NÃO use bundlers, npm, ou qualquer build step. Use React via CDN com `esm.sh`:

```html
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@18.3.1",
    "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
    "recharts": "https://esm.sh/recharts@2.15.3?bundle-deps",
    "d3": "https://esm.sh/d3@7.9.0"
  }
}
</script>
```

---

## Dados Disponíveis

### baciasselecionadas.geojson (93 features — Polygon)

Propriedades de cada feature:
```json
{
  "Nome_bacia": "Litoranea",       // 9 bacias: Litoranea, Iguaçu, Paraná 3, Piquiri, Ivai, Pirapó, Paranapanema 3, Tibagi, Cinzas
  "Cod_otto": "7751411",            // Código ottobacia
  "Classe": "IDR-Paraná",           // 2 classes: "IDR-Paraná", "Sanepar"
  "Manancial": "Mundo Novo do Saquarema",  // 43 mananciais únicos
  "Cod_man": "24",
  "Regional IDR": "Paranaguá",      // 22 regionais únicas
  "NomeMunicipio": "Morretes",      // 41 municípios únicos
  "CodIBGE": 4116208
}
```

**Totais deriváveis dos dados:**
- 93 ottobacias (features)
- 43 mananciais únicos
- 9 bacias hidrográficas
- 22 regionais IDR
- 41 municípios
- 2 classes (IDR-Paraná / Sanepar)

### urs_part1 (31 features — Point)

Propriedades relevantes:
```json
{
  "Região": "Dois Vizinhos",
  "Municipio": "Salto do Lontra",
  "Agricultor": "Marcio Ribeiro",
  "Responsáv": "[Marcelo Vicensi]",
  "MIP": "Sim",           // Manejo Integrado de Pragas
  "MID": "Sim",           // Manejo Integrado de Doenças
  "Coletor": "Sim",
  "Programa": "Grãos",    // 4 tipos: Grãos, Agroindústria, Pecuária de Corte, Piscicultura
  "Nome_bacia": "Iguaçu",
  "Classe": "Sanepar",
  "Manancial": "Lontra",
  "Regional IDR": "Dois Vizinhos",
  "NomeMunicipio": "Salto do Lontra",
  "CodIBGE": 4123006,
  "Latitude": -25.838192,
  "Longitude": -53.281131
}
```

---

## Estrutura do Power BI Original (8 páginas — replicar e melhorar)

O painel Power BI original está em `https://app.powerbi.com/view?r=eyJrIjoiNGNmZDA3YWQtMTg5ZC00YjRlLTkzNDItMDgwMTE0ZGFkM2E5IiwidCI6IjdkZmY5MTA4LWU4OWEtNGNkMy1hNDk4LWE3MzQ5OWU1M2MyYSJ9` e possui defeitos visuais (Página 7 quebrada). A nova versão deve reproduzir a estrutura mas usando os dados reais dos GeoJSON.

### Página 1 — Capa
- Título: "PROGRAMA ÁGUA SEGURA"
- Subtítulo: "Pré-diagnóstico das Microbacias Selecionadas"
- Texto de contexto sobre a parceria IDR-Paraná e SANEPAR
- Logos institucionais (usar as mesmas imagens do header: `data/aguaseguralogo2.png`, `data/logo_sanepar.jpg`, `data/Logo_IAT_PR.png`, `data/adapar.png`, `data/logo_IDR-SEAB.png`)

### Página 2 — Visão Geral
- **KPI Cards** (calcular dos GeoJSON):
  - Nº de Mananciais: `43` (valores únicos de `Manancial`)
  - Nº de Ottobacias: `93` (total de features)
  - Nº de Bacias: `9` (valores únicos de `Nome_bacia`)
  - Nº de Municípios: `41` (valores únicos de `NomeMunicipio`)
  - Nº de Regionais IDR: `22` (valores únicos de `Regional IDR`)
  - Nº de URTs: `31` (total de features em urs_part1)
- **Mapa** miniatura de localização dos polígonos (usar D3.js geo com projeção do Paraná)
- **Gráfico de rosca/donut**: Distribuição por Classe (IDR-Paraná vs Sanepar)

### Página 3 — Distribuição por Bacia
- **Bar chart horizontal**: Nº de ottobacias por `Nome_bacia` (contar features por bacia)
- **Bar chart horizontal**: Nº de mananciais por `Nome_bacia`
- **Bar chart horizontal**: Nº de municípios por `Nome_bacia`
- KPIs: Total de bacias, total de ottobacias

### Página 4 — Distribuição por Regional
- **Bar chart horizontal**: Nº de ottobacias por `Regional IDR` (22 regionais, ordenar decrescente)
- **Bar chart horizontal**: Nº de mananciais por `Regional IDR`
- KPIs: Total de regionais, média de ottobacias por regional

### Página 5 — Distribuição por Município
- **Treemap** (D3.js): Municípios agrupados por bacia, tamanho proporcional ao nº de ottobacias
- **Tabela**: Top 10 municípios por nº de ottobacias
- KPIs: Total de municípios, município com mais ottobacias

### Página 6 — Classificação (IDR-Paraná vs Sanepar)
- **Stacked bar chart**: Distribuição de classes por bacia
- **Donut chart**: Proporção geral IDR-Paraná vs Sanepar
- **Tabela**: Contagem por classe e regional

### Página 7 — URTs (Unidades de Referência Tecnológica)
- **KPI Cards**: Total URTs (31), URTs com MIP, URTs com MID, URTs com Coletor
- **Donut chart**: Distribuição por `Programa` (Grãos, Agroindústria, Pecuária de Corte, Piscicultura)
- **Bar chart**: URTs por Regional
- **Tabela**: Lista de URTs com Agricultor, Município, Programa, MIP, MID, Coletor
- **Mapa** D3: Localização dos pontos de URT sobre o contorno do Paraná

### Página 8 — Tabela Detalhada
- **Matriz/tabela interativa** com todas as 93 ottobacias
- Colunas: Cod_otto, Manancial, Nome_bacia, Regional IDR, NomeMunicipio, Classe
- Busca/filtro por texto
- Ordenação por qualquer coluna
- Paginação ou scroll virtual

---

## Filtros Globais (persistentes em todas as páginas)

Replicar o filtro hierárquico do Power BI:
1. **Regional IDR** → dropdown com 22 opções + "Todas"
2. **Município** → dropdown filtrado pela regional selecionada + "Todos"
3. **Bacia** → dropdown com 9 opções + "Todas"

Quando um filtro é aplicado, TODOS os KPIs, gráficos e tabelas devem recalcular para refletir apenas os dados filtrados. Mostrar um badge/chip indicando filtros ativos.

---

## Design Visual

### Identidade visual (manter consistência com o site)
- Font: `'Inter', 'Segoe UI', sans-serif`
- Cor primária: `#1e40af` (azul escuro)
- Cor secundária: `#2563eb` (azul médio)
- Background: `#f5f6f8`
- Surface: `#ffffff`
- Border: `#e5e7eb`
- Muted text: `#6b7280`
- Text: `#0f172a`
- Border radius dos cards: `20px` (seguir `.landing-card`)
- Box shadow: `0 20px 40px rgba(15, 23, 42, 0.1)` (seguir `.landing-card`)

### Header e navegação
Usar o mesmo padrão do site:

```html
<header class="landing-header">
  <div class="header-logos">
    <img src="data/aguaseguralogo2.png" alt="Programa Água Segura" class="logo-medium" />
    <img src="data/logo_sanepar.jpg" alt="Sanepar" class="logo-small" />
    <img src="data/Logo_IAT_PR.png" alt="IAT-Paraná" class="logo-small" />
    <img src="data/adapar.png" alt="ADAPAR" class="logo-small" />
    <img src="data/logo_IDR-SEAB.png" alt="IDR-SEAB" class="logo-small" />
  </div>
  <span class="version">Departamento de Sustentabilidade · IDR-Paraná · 2026</span>
</header>

<nav class="breadcrumb-nav" aria-label="Navegação">
  <a href="index.html">Início</a>
  <span class="breadcrumb-sep"></span>
  <span class="breadcrumb-current">Painel BI</span>
  <span class="breadcrumb-sep"></span>
  <a href="selecaoregional.html">Seleção de regional</a>
  <span class="breadcrumb-sep"></span>
  <a href="map.html">Mapa interativo</a>
</nav>
```

### Estilo dos KPI Cards
Seguir o padrão `.ds-indicator-card` existente:
```css
.ds-indicator-card {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
}
.ds-indicator-number {
  display: block;
  font-size: 1.75rem;
  font-weight: 700;
  color: #1e40af;
  line-height: 1.2;
}
.ds-indicator-label {
  display: block;
  font-size: 0.85rem;
  color: #6b7280;
  margin-top: 0.25rem;
}
```

### Paleta de cores para gráficos
```javascript
const CHART_COLORS = [
  '#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd',
  '#1d4ed8', '#1e3a8a', '#172554', '#0ea5e9', '#0284c7',
  '#0369a1', '#075985', '#0c4a6e', '#22c55e', '#16a34a',
  '#15803d', '#f59e0b', '#d97706', '#b45309', '#ef4444'
];
```

---

## Navegação entre Páginas do Dashboard

Usar abas/tabs horizontais no topo do conteúdo (abaixo do breadcrumb):

```
[ Capa | Visão Geral | Bacias | Regionais | Municípios | Classificação | URTs | Tabela Detalhada ]
```

- A aba ativa deve ter destaque visual (bordas, cor de fundo)
- Troca de aba via React state (sem recarregar página)
- A aba ativa deve ser refletida na URL hash (`#visao-geral`, `#bacias`, etc.) para permitir link direto

---

## Formatação para Impressão A4

**CRÍTICO**: Cada aba do dashboard deve ser imprimível em uma folha A4 paisagem. Implementar:

```css
@media print {
  /* Ocultar elementos de navegação */
  .landing-header,
  .breadcrumb-nav,
  .dashboard-tabs,
  .dashboard-filters,
  .no-print {
    display: none !important;
  }

  /* Reset do layout */
  body {
    background: white !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  /* Cada página do dashboard = uma folha A4 paisagem */
  .dashboard-page {
    page-break-after: always;
    page-break-inside: avoid;
    width: 297mm;
    min-height: 190mm;
    max-height: 200mm;
    padding: 10mm;
    margin: 0 auto;
    overflow: hidden;
  }

  .dashboard-page:last-child {
    page-break-after: auto;
  }

  /* Garantir que gráficos caibam */
  .recharts-responsive-container {
    max-height: 140mm !important;
  }

  /* Cabeçalho de impressão com logos */
  .print-header {
    display: flex !important;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 5mm;
    padding-bottom: 3mm;
    border-bottom: 2px solid #1e40af;
  }

  .print-header img {
    height: 30px;
  }

  .print-title {
    font-size: 14pt;
    font-weight: 700;
    color: #1e40af;
  }

  .print-date {
    font-size: 8pt;
    color: #6b7280;
  }
}

/* Orientação paisagem para impressão */
@page {
  size: A4 landscape;
  margin: 8mm;
}
```

**Botão "Imprimir / Exportar PDF"**: Adicionar um botão no topo do dashboard que:
1. No modo "Página atual" → imprime apenas a aba ativa
2. No modo "Todas as páginas" → mostra todas as 8 abas em sequência e chama `window.print()`

Cada página impressa deve ter:
- Cabeçalho com logos e título "Programa Água Segura — [Nome da Aba]"
- Data de geração
- Filtros aplicados (se houver)
- Rodapé: "Departamento de Sustentabilidade · IDR-Paraná · 2026"

---

## Implementação Técnica

### Carregamento dos Dados

```javascript
async function loadData() {
  const [baciasRes, urtsRes] = await Promise.all([
    fetch('data/baciasselecionadas.geojson'),
    fetch('data/urs_part1')
  ]);
  const bacias = await baciasRes.json();
  const urts = await urtsRes.json();
  return { bacias, urts };
}
```

### Componente Principal (React)

```jsx
function Dashboard() {
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('visao-geral');
  const [filters, setFilters] = useState({
    regional: 'Todas',
    municipio: 'Todos',
    bacia: 'Todas'
  });

  // Carregar dados
  useEffect(() => { loadData().then(setData); }, []);

  // Filtrar dados
  const filteredData = useMemo(() => {
    if (!data) return null;
    let features = data.bacias.features;
    let urts = data.urts.features;

    if (filters.regional !== 'Todas') {
      features = features.filter(f => f.properties['Regional IDR'] === filters.regional);
      urts = urts.filter(f => f.properties['Regional IDR'] === filters.regional);
    }
    if (filters.municipio !== 'Todos') {
      features = features.filter(f => f.properties.NomeMunicipio === filters.municipio);
      urts = urts.filter(f => f.properties.NomeMunicipio === filters.municipio);
    }
    if (filters.bacia !== 'Todas') {
      features = features.filter(f => f.properties.Nome_bacia === filters.bacia);
      urts = urts.filter(f => f.properties.Nome_bacia === filters.bacia);
    }

    return { features, urts };
  }, [data, filters]);

  // Render tabs...
}
```

### Mapas D3.js

Para os mini-mapas (Visão Geral e URTs), usar D3.js com projeção Mercator ajustada aos bounds dos dados:

```javascript
function MiniMap({ features, points }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!features.length) return;
    const svg = d3.select(svgRef.current);
    const width = 400, height = 300;

    const geojson = { type: 'FeatureCollection', features };
    const projection = d3.geoMercator().fitSize([width, height], geojson);
    const path = d3.geoPath(projection);

    svg.selectAll('path')
      .data(features)
      .join('path')
      .attr('d', path)
      .attr('fill', '#dbeafe')
      .attr('stroke', '#1e40af')
      .attr('stroke-width', 0.5);

    if (points) {
      svg.selectAll('circle')
        .data(points)
        .join('circle')
        .attr('cx', d => projection([d.properties.Longitude, d.properties.Latitude])?.[0])
        .attr('cy', d => projection([d.properties.Longitude, d.properties.Latitude])?.[1])
        .attr('r', 4)
        .attr('fill', '#ef4444')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1);
    }
  }, [features, points]);

  return <svg ref={svgRef} viewBox="0 0 400 300" style={{width: '100%', maxHeight: '300px'}} />;
}
```

### Componentes Recharts

Para bar charts:
```jsx
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={chartData} layout="vertical" margin={{left: 120}}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis type="number" />
    <YAxis dataKey="name" type="category" width={110} tick={{fontSize: 12}} />
    <Tooltip />
    <Bar dataKey="value" fill="#1e40af" radius={[0, 4, 4, 0]} />
  </BarChart>
</ResponsiveContainer>
```

Para donut charts:
```jsx
<ResponsiveContainer width="100%" height={250}>
  <PieChart>
    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
         innerRadius={60} outerRadius={90} label>
      {pieData.map((entry, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
    </Pie>
    <Tooltip />
    <Legend />
  </PieChart>
</ResponsiveContainer>
```

---

## Atualização do index.html

Após criar `dashboard.html`, atualizar o link do Power BI na landing page. No `index.html`, substituir o botão que aponta para o Power BI:

**De:**
```html
<a class="btn"
   href="https://app.powerbi.com/view?r=eyJrIjoiNGNmZDA3YWQtMTg5ZC00YjRlLTkzNDItMDgwMTE0ZGFkM2E5IiwidCI6IjdkZmY5MTA4LWU4OWEtNGNkMy1hNDk4LWE3MzQ5OWU1M2MyYSJ9"
   target="_blank"
   rel="noopener">
  Abrir Painel Interativo
</a>
```

**Para:**
```html
<a class="btn" href="dashboard.html">
  Abrir Painel Interativo
</a>
```

Também atualizar o breadcrumb de todas as páginas para incluir o link do dashboard.

---

## Atualização do styles.css

Adicionar ao `styles.css` existente as classes necessárias para o dashboard:

```css
/* ========== Dashboard BI ========== */
.dashboard-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem clamp(1rem, 2vw, 2rem);
}

.dashboard-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.85);
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
}

.dashboard-tab {
  appearance: none;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  padding: 0.5rem 0.85rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.82rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.dashboard-tab:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.dashboard-tab.active {
  background: #1e40af;
  color: white;
  border-color: #1e40af;
}

.dashboard-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.9);
  border-bottom: 1px solid var(--border);
  align-items: center;
}

.dashboard-filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.dashboard-filter-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.dashboard-filter-select {
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  font-size: 0.82rem;
  background: #f8fafc;
  min-width: 160px;
}

.dashboard-active-filters {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.dashboard-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.5rem;
  background: #e0f2fe;
  color: #0369a1;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.dashboard-filter-chip button {
  appearance: none;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0;
  line-height: 1;
}

.dashboard-page {
  padding: 1.5rem 0;
}

.dashboard-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.25rem;
}

.dashboard-card {
  background: white;
  border-radius: 16px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  border: 1px solid #e5e7eb;
}

.dashboard-card h3 {
  margin: 0 0 1rem;
  font-size: 0.95rem;
  color: #0f172a;
  font-weight: 700;
}

/* Tabela do dashboard */
.dashboard-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.dashboard-table th {
  background: #f1f5f9;
  padding: 0.5rem 0.6rem;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.dashboard-table th:hover {
  background: #e2e8f0;
}

.dashboard-table td {
  padding: 0.45rem 0.6rem;
  border-bottom: 1px solid #f1f5f9;
  color: #374151;
}

.dashboard-table tr:hover td {
  background: #f8fafc;
}

.dashboard-search {
  width: 100%;
  max-width: 320px;
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
}

/* Print header (hidden on screen) */
.print-header {
  display: none;
}

.print-footer {
  display: none;
}
```

---

## Checklist de Validação

Antes de finalizar, verificar:

- [ ] `dashboard.html` carrega sem erros no console
- [ ] React renderiza via CDN sem build step
- [ ] Dados dos GeoJSON são carregados e processados corretamente
- [ ] Todas as 8 abas funcionam e exibem os dados corretos
- [ ] Filtros globais (Regional, Município, Bacia) atualizam todos os componentes
- [ ] Filtros hierárquicos funcionam (selecionar Regional filtra Municípios disponíveis)
- [ ] KPIs recalculam com filtros aplicados
- [ ] Mini-mapas D3 renderizam os polígonos e pontos corretamente
- [ ] Gráficos Recharts exibem dados proporcionais e com labels legíveis
- [ ] Tabela detalhada tem busca, ordenação e é funcional
- [ ] `Ctrl+P` / `window.print()` gera PDF em A4 paisagem limpo
- [ ] Cada aba cabe em uma folha A4 paisagem
- [ ] Cabeçalho de impressão aparece com logos e título
- [ ] Rodapé de impressão aparece
- [ ] Navegação breadcrumb funciona
- [ ] Link no `index.html` atualizado para `dashboard.html`
- [ ] O botão "Imprimir" funciona nos modos "Página atual" e "Todas as páginas"
- [ ] Responsivo em telas menores (tablets em campo)
- [ ] Performance: dados processados em <1s

---

## Resumo dos Arquivos a Criar/Modificar

1. **CRIAR**: `dashboard.html` — Página completa do painel BI
2. **MODIFICAR**: `styles.css` — Adicionar estilos do dashboard ao final
3. **MODIFICAR**: `index.html` — Atualizar link do Power BI para `dashboard.html`, adicionar link no breadcrumb
4. **MODIFICAR**: `selecaoregional.html` — Adicionar "Painel BI" ao breadcrumb
5. **MODIFICAR**: `map.html` — Adicionar "Painel BI" ao breadcrumb
