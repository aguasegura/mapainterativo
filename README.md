# Água Segura — Dados, Mapas e Análises - [EM CONSTRUÇÃO]

Repositório do **Programa Água Segura** (IDR-Paraná) para organização de dados geoespaciais, notebooks, scripts e produtos cartográficos relacionados a **conservação de solo e água em microbacias**. O repositório integra camadas temáticas (altimetria, declividade, uso do solo, hidrografia, estradas, CAR), análises por **ottobacias**, e fluxos de trabalho de monitoramento com imagens de satélite.

> Parceiros institucionais: **IDR-Paraná, SANEPAR, ADAPAR, IAT**.

---

## 📁 Estrutura do repositório

```
aguasegura/
├─ data/
│  ├─ raw/            # dados originais (somente leitura / LFS)
│  ├─ interim/        # dados intermediários (processos em andamento)
│  └─ processed/      # dados prontos para análise/publicação
├─ notebooks/         # Jupyter Notebooks (ETL, QA/QC, análises)
├─ scripts/           # scripts Python/CLI (automação e utilitários)
├─ docs/              # relatórios, notas técnicas e apresentações
├─ webmap/            # visualizações (Leaflet/MapLibre) e assets
├─ .gitattributes     # regras Git LFS (arquivos grandes)
├─ environment.yml    # ambiente conda (opcional)
└─ README.md
```

---

## 🗺️ Principais camadas (data)

- **Altimetria** (MDT/curvas) — `data/raw/altimetria_otto.gpkg`
- **Declividade** (classes) — `data/raw/declividade_otto.gpkg`
- **Uso e Cobertura do Solo** — `data/raw/usodosolo_otto.gpkg`
- **Hidrografia** (rede, nascentes) — `data/raw/hidrografia_otto.gpkg`
- **Estradas** (malha viária) — `data/raw/estradas_otto.gpkg`
- **CAR** (Cadastro Ambiental Rural) — `data/raw/car__car_otto.geojson`
- **Limites de microbacias** (ottobacias) — `data/raw/ottobacias.gpkg`
- **Linhas de Energia** (LTs em operação EPE + alimentadores 34,5 kV e estruturas LDAT COPEL) — `data/energia__linhas.geojson_part-001.gz`, `data/energia__estruturas.geojson_part-001.gz`
- **Transectos de Campo** (levantamento por transectos nas microbacias) — `data/transectos__pontos.geojson_part-001.gz`
- **Rede de Distribuição completa (BDGD/ANEEL 2025, COPEL-DIS)** — rede BT (`energia__rede_bt`), rede MT (`energia__rede_mt`), postes (`energia__postes`, 2 partes) e transformadores (`energia__transformadores`)
- **Camadas temáticas (curadoria 2026-09)** — degradação do solo e aptidão agrícola (IAT), plantios florestais (APRE), UCs estaduais, perímetros urbanos, densidade demográfica (setores IBGE 2022), talhões de soja e armazéns (CONAB), assentamentos (INCRA), terras indígenas (FUNAI), unidades IDR, empresas do agro (CNPJ/Receita)
- **Indicadores ambientais do BI** — `data/indicadores_ambientais.json`: chuva anual CHIRPS v3.0 e perda de dossel Hansen GFC por manancial

> **Observação:** alguns arquivos podem ser grandes e versionados via **Git LFS**.

---

## 🧭 Padrões cartográficos

- **CRS de armazenamento (vetor):** `EPSG:4674` (SIRGAS 2000, lat/long)
- **CRS de análise/medidas em PR:**
  - Oeste/Centro-Oeste: `EPSG:31982` (SIRGAS 2000 / UTM 22S)
  - Centro-Leste/Leste: `EPSG:31983` (SIRGAS 2000 / UTM 23S)
- **Regra prática:** armazene em 4674; reprojete para 31982/31983 antes de operações métricas (área, buffer, *centroid*, distância).

---

## 🔌 Fontes de dados

- **IBGE** — malhas territoriais, hidrografia, vias  
- **IPARDES** — base cartográfica do Paraná  
- **MapBiomas** — séries históricas de uso/cobertura (1985-2023)  
- **ANA (Hidroweb)** — séries de precipitação e vazão  
- **PlanetScope / Sentinel-2 / Landsat** — imagens para monitoramento
- **EPE (Webmap EPE)** — linhas de transmissão em operação
- **COPEL (ANEEL/mapaANEEL)** — alimentadores 34,5 kV, estruturas LDAT e subestações
- **BDGD/ANEEL** — Base de Dados Geográfica da Distribuidora (COPEL-DIS 2025-12-31): SSDBT, SSDMT, PONNOT, UNTRMT  
- **SEAB / IAT / ADAPAR / IDR-Paraná** — camadas setoriais e apoio  
- **CAR** — limites de imóveis rurais (conforme disponibilidade/acesso)

> Documente no `docs/` a origem, data de download, licença e pré-processamento de cada fonte.

---

## ⚙️ Preparação do ambiente (opcional)

```bash
# clone
git clone https://github.com/avnergomes/aguasegura.git
cd aguasegura

# conda (se usar environment.yml)
conda env create -f environment.yml
conda activate aguasegura
```

Pacotes típicos: `geopandas`, `rasterio`, `pyproj`, `shapely`, `rtree`, `pandas`, `matplotlib`, `jupyter`, `ipywidgets`.

---

## 🚿 Fluxo de trabalho (resumo)

1. **Ingestão (notebooks/01_ingestao_*.ipynb)**  
   - padronização de nomes/colunas, validação de CRS e geometrias
2. **Processamento (notebooks/02_processamento_*.ipynb)**  
   - derivação de declividade a partir do MDT; dissolves por ottobacia
3. **Integração temática (notebooks/03_integracao_*.ipynb)**  
   - *overlay* uso do solo × declividade × hidrografia × estradas × CAR
4. **Métricas por ottobacia/município (notebooks/04_metricas_*.ipynb)**  
   - cálculo de áreas por classe, indicadores de risco/prioridade
5. **Publicação (webmap/)**  
   - export GeoJSON simplificado e renderização em mapas web (Leaflet)

> Utilize a pasta `interim/` para *checkpoints* e `processed/` para saídas finais.

---

## 🧪 Qualidade de dados (QA/QC)

- Verificar CRS e *valididade* geométrica (`.is_valid`, *buffer(0)* em casos necessários)  
- Garantir chaves de junção consistentes (ex.: `Cod_man`, `cod_imovel` para CAR)  
- Evitar multi-CRS em *layers* combinadas; reprojetar antes de *joins* espaciais  
- Registrar no `docs/` as **assunções** e **limitações** (resolução, datas, lacunas)

---

## 🌐 Mapa web (Leaflet)

- Código base em `webmap/index.html` + `webmap/js/app.js`  
- Camadas: ottobacias, uso do solo, hidrografia, estradas, CAR  
- Legenda e créditos: **IDR-Paraná, IAT, ADAPAR, SANEPAR, IBGE, MDA, Embrapa, IPARDES**  
- Área reservada para **logo** (pasta `webmap/data/`)

> Se necessário, adicione `webmap/css/styles.css` e *tiles* de base (OpenStreetMap/MapTiler/ESRI).

---

## 📦 Arquivos grandes (Git LFS)

Se já tem o **Git LFS** instalado, rastreie os formatos pesados antes do *commit*:

```bash
git lfs install
git lfs track "*.gpkg"
git lfs track "*.tif"
git lfs track "*.geojson"
git lfs track "*.zip"
git add .gitattributes
git add .
git commit -m "chore: track large geodata via LFS"
git push origin main
```

> **Dica:** evite versionar dados sensíveis. Prefira *links* ou scripts de download quando possível.

---

## 🔐 Licenças e acesso

- Verifique a licença de cada fonte (IBGE, MapBiomas, etc.).  
- Dados restritos (ex.: CAR em certas condições) **não** devem ser públicos.  
- Defina a licença do repositório (ex.: `LICENSE` com MIT/CC-BY-4.0/Outra).

---

## 🤝 Contribuição

1. Crie *branch* de feature: `git checkout -b feat/nome-da-feature`  
2. Faça *commits* pequenos e descritivos  
3. Abra *Pull Request* com descrição clara (dados/métodos/impactos)  
4. Anexe *preview* (mapa, imagens) quando alterar visualizações

---

## 👤 Autor / Contato

**Avner Paes Gomes** — Eng. Florestal | MSc. Ciência de Dados  
Coordenação Estadual — **Programa de Recursos Naturais e Sustentabilidade (PRNS)**, **IDR-Paraná**

---

## 📝 Changelog (resumo)

- **[YYYY-MM-DD]** Estrutura inicial do repositório, inclusão de camadas base e guia de LFS  
- **[YYYY-MM-DD]** Primeira versão do webmap (Leaflet) com ottobacias + uso do solo
