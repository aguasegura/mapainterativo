  'use strict';

  function deriveAppBaseUrl() {
    if (typeof window !== 'undefined') {
      const cached = window.__APP_BASE_URL__;
      if (typeof cached === 'string' && cached) return cached;
      try {
        const { origin, pathname } = window.location;
        const looksLikeFile = /\.[^/]+$/.test(pathname);
        const basePath = looksLikeFile ? pathname.replace(/[^/]*$/, '') : pathname;
        const normalisedPath = basePath.endsWith('/') ? basePath : `${basePath}/`;
        const href = `${origin}${normalisedPath}`;
        window.__APP_BASE_URL__ = href;
        return href;
      } catch (error) {
        console.warn('Não foi possível determinar o caminho base automaticamente.', error);
      }
    }
    if (typeof window !== 'undefined' && window.location) {
      return `${window.location.origin}/`;
    }
    return './';
  }

  const APP_BASE_URL = deriveAppBaseUrl();
  const DATA_BASE_URL = new URL('data/', APP_BASE_URL);

  const fmt = {
    ha(value) {
      if (!Number.isFinite(value) || value <= 0) return '—';
      const abs = Math.abs(value);
      const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
      return value.toLocaleString('pt-BR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      });
    },
    km(value) {
      if (!Number.isFinite(value) || value <= 0) return '—';
      const abs = Math.abs(value);
      const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
      return value.toLocaleString('pt-BR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      });
    },
    int(value) {
      if (!Number.isFinite(value) || value <= 0) return '—';
      return Math.round(value).toLocaleString('pt-BR');
    },
    pct(value) {
      if (!Number.isFinite(value) || value <= 0) return '—';
      return value.toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      });
    }
  };

  const SLOPE_CLASSES = ['000a003', '003a008', '008a015', '015a025', '025a045', '045a100', '>100'];
  const SLOPE_LABELS = ['0–3%', '3–8%', '8–15%', '15–25%', '25–45%', '45–100%', '>100%'];
  const SLOPE_COLORS = ['#edf8e9', '#c7e9c0', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#0c2c84'];

  const ALT_RAMP = ['#ffffcc', '#c2e699', '#78c679', '#31a354', '#006837', '#00441b'];

  function altColorFor(value) {
    if (!value) return ALT_RAMP[0];
    const match = String(value).match(/(\d+).+?(\d+)/);
    const mid = match ? (Number(match[1]) + Number(match[2])) / 2 : Number.NaN;
    if (Number.isNaN(mid)) return ALT_RAMP[0];
    const breaks = [0, 400, 800, 1200, 1600, 2000, Number.POSITIVE_INFINITY];
    for (let i = 0; i < breaks.length - 1; i += 1) {
      if (mid >= breaks[i] && mid < breaks[i + 1]) return ALT_RAMP[i];
    }
    return ALT_RAMP[ALT_RAMP.length - 1];
  }

  const USO_COLORS = {
    'Agricultura Anual': '#e6ab02',
    'Agricultura Perene': '#c98c00',
    'Corpos d’Água': '#67a9cf',
    'Floresta Nativa': '#1b9e77',
    Mangue: '#0f766e',
    'Pastagem/Campo': '#a6d854',
    'Plantios Florestais': '#106b21',
    Restinga: '#66c2a5',
    'Solo Exposto/Mineração': '#bdbdbd',
    'Várzea': '#c7e9c0',
    'Área Construída': '#7570b3',
    'Área Urbanizada': '#6a51a3'
  };

  const USO_FALLBACK_COLORS = {
    Água: '#67a9cf',
    'Áreas de Vegetação Natural': '#1b9e77',
    'Áreas Antrópicas Agrícolas': '#e6ab02',
    'Áreas Antrópicas Não Agrícolas': '#6a51a3',
    'Áreas Antrópicas Agrícolas/Áreas de Vegetação Natural': '#8da0cb'
  };

  const SOIL_COLORS = {
    LATOSSOLOS: '#d95f0e',
    ARGISSOLOS: '#fdae6b',
    'NEOSSOLOS LITÓLICOS': '#fee6ce',
    'NEOSSOLOS REGOLÍTICOS': '#fdd0a2',
    NITOSSOLOS: '#a6761d',
    CAMBISSOLOS: '#e0c2a2',
    GLEISSOLOS: '#74c476',
    ESPODOSSOLOS: '#9ecae1',
    ORGANOSSOLOS: '#807dba',
    'AFLORAMENTOS DE ROCHAS': '#bdbdbd',
    'ÁREAS URBANAS': '#756bb1',
    'ESPELHOS DAGUA': '#67a9cf'
  };

  const POINT_COLORS = {
    nascentes: '#0f766e',
    construcoes: '#1f2937',
    caf: '#16a34a'
  };

  const CODE_FIELD_CANDIDATES = ['Cod_man', 'COD_MAN', 'cod_man', 'codman'];
  const ORIGIN_FIELD_CANDIDATES = ['Classe', 'CLASSE'];
  const MANANCIAL_FIELD_CANDIDATES = ['Manancial', 'MANANCIAL'];
  const NAME_FIELD_CANDIDATES = ['Nome_bacia', 'NOME_BACIA'];
  const REGION_FIELD_CANDIDATES = ['RegIdr', 'REGIDR', 'CRegIdr', 'regiao', 'REGIAO'];
  const MUNICIPALITY_FIELD_CANDIDATES = ['Municipio', 'MUNICIPIO', 'municipio', 'NM_MUN', 'NM_MUNIC'];

  function trimString(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
  }

  function normaliseCode(value) {
    return trimString(value);
  }

  function normaliseText(value) {
    return trimString(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function findField(props, candidates) {
    if (!props) return null;
    const lower = new Map();
    Object.keys(props).forEach(key => lower.set(key.toLowerCase(), key));
    for (const candidate of candidates) {
      const match = lower.get(candidate.toLowerCase());
      if (match) return match;
    }
    return null;
  }

  function createFieldExtractor(primary, fallback) {
    return props => {
      const fieldPrimary = findField(props, primary);
      const fieldFallback = fallback ? findField(props, fallback) : null;
      return feature => {
        const properties = feature?.properties || {};
        const raw = fieldPrimary && properties[fieldPrimary] !== undefined && properties[fieldPrimary] !== null
          ? properties[fieldPrimary]
          : fieldFallback
            ? properties[fieldFallback]
            : undefined;
        return trimString(raw);
      };
    };
  }

  const LAYERS = [
    {
      key: 'microbacias',
      name: 'Microbacias',
      type: 'poly',
      files: ['otto_selec__ottos_selec_lista4.geojson.gz'],
      initiallyVisible: true,
      popupTitleField: 'Nome_bacia'
    },
    {
      key: 'declividade',
      name: 'Declividade',
      type: 'poly',
      files: ['declividade__declividade_otto.geojson.gz'],
      legendType: 'area',
      classStrategy: {
        title: 'Declividade (%)',
        createExtractor: createFieldExtractor(['ClDec']),
        colorFor: value => {
          const idx = SLOPE_CLASSES.indexOf(value);
          return SLOPE_COLORS[idx >= 0 ? idx : 0];
        },
        orderedClasses: SLOPE_CLASSES,
        orderedLabels: SLOPE_LABELS
      }
    },
    {
      key: 'altimetria',
      name: 'Altimetria',
      type: 'poly',
      files: ['altimetria__altimetria_otto.geojson.gz'],
      legendType: 'area',
      classStrategy: {
        title: 'Altimetria (m)',
        createExtractor: createFieldExtractor(['ClAlt']),
        colorFor: value => altColorFor(value)
      }
    },
    {
      key: 'uso_solo',
      name: 'Uso do Solo',
      type: 'poly',
      files: ['uso_solo__usodosolo_otto.geojson.gz'],
      legendType: 'area',
      classStrategy: {
        title: 'Uso do Solo',
        createExtractor: createFieldExtractor(['NIVEL_II', 'nivel_ii', 'Nivel_II'], ['NIVEL_I', 'nivel_i', 'Nivel_I']),
        colorFor: value => USO_COLORS[value] || USO_FALLBACK_COLORS[value] || '#31a354'
      }
    },
    {
      key: 'solos',
      name: 'Solos',
      type: 'poly',
      files: ['solos__solos_otto.geojson.gz'],
      legendType: 'area',
      classStrategy: {
        title: 'Solos',
        createExtractor: createFieldExtractor(['Cl_solos', 'cl_solos']),
        colorFor: value => SOIL_COLORS[value] || '#dfc27d'
      }
    },
    {
      key: 'estradas',
      name: 'Estradas',
      type: 'line',
      files: ['estradas__estradas_otto.geojson.gz'],
      legendType: 'line',
      legendTitle: 'Estradas — extensão filtrada'
    },
    {
      key: 'hidrografia',
      name: 'Hidrografia',
      type: 'line',
      files: ['hidrografia__hidrografia_otto.geojson.gz'],
      legendType: 'line',
      legendTitle: 'Hidrografia — extensão filtrada'
    },
    {
      key: 'nascentes',
      name: 'Nascentes',
      type: 'point',
      files: ['nascentes__nascentes_otto.geojson.gz'],
      legendType: 'count',
      legendTitle: 'Nascentes'
    },
    {
      key: 'construcoes',
      name: 'Construções',
      type: 'point',
      files: [
        'construcoes__construcoes_otto__part1.geojson.gz',
        'construcoes__construcoes_otto__part2.geojson.gz',
        'construcoes__construcoes_otto__part3.geojson.gz',
        'construcoes__construcoes_otto__part4.geojson.gz',
        'construcoes__construcoes_otto__part5.geojson.gz',
        'construcoes__construcoes_otto__part6.geojson.gz'
      ],
      legendType: 'count',
      legendTitle: 'Construções'
    },
    {
      key: 'caf',
      name: 'CAF',
      type: 'point',
      files: ['caf__caf_otto.geojson.gz'],
      legendType: 'count',
      legendTitle: 'CAF'
    },
    {
      key: 'car',
      name: 'CAR',
      type: 'poly',
      files: ['car__car_otto.geojson'],
      filterable: false,
      legendType: null,
      popupTitleField: 'cod_imovel'
    }
  ];

  const baseLayers = {
    'CARTO Light': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
      attribution: '© OSM • © CARTO'
    }),
    'OSM Padrão': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }),
    'Esri Imagery': L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Imagery © Esri/Maxar' }
    ),
    'Esri Streets': L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      { attribution: '© Esri' }
    ),
    'Stamen Terrain': L.tileLayer('https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg', {
      attribution: '© Stamen'
    })
  };

  const map = L.map('map', {
    center: [-24.5, -51.5],
    zoom: 7,
    preferCanvas: true,
    layers: [baseLayers['CARTO Light']]
  });

  const layerControl = L.control.layers(baseLayers, {}, { collapsed: false, position: 'topleft' }).addTo(map);

  let legendContainer = null;
  const legendElements = new Map();

  const legendControl = L.control({ position: 'bottomleft' });
  legendControl.onAdd = () => {
    const div = L.DomUtil.create('div', 'legend-dock');
    div.id = 'legendDock';
    legendContainer = div;
    L.DomEvent.disableScrollPropagation(div);
    L.DomEvent.disableClickPropagation(div);
    return div;
  };
  legendControl.addTo(map);

  let summaryBody = null;
  let summaryNote = null;
  const summaryControl = L.control({ position: 'bottomright' });
  summaryControl.onAdd = () => {
    const div = L.DomUtil.create('div', 'summary-panel');
    div.innerHTML = `
      <h3>Resumo das camadas</h3>
      <div class="summary-note" id="summaryNote">Carregando microbacias...</div>
      <table class="summary-table">
        <thead>
          <tr>
            <th>Camada</th>
            <th>Área (ha)</th>
            <th>Extensão (km)</th>
            <th>Qtd</th>
          </tr>
        </thead>
        <tbody id="summaryBody"></tbody>
      </table>
    `;
    summaryBody = div.querySelector('#summaryBody');
    summaryNote = div.querySelector('#summaryNote');
    L.DomEvent.disableScrollPropagation(div);
    L.DomEvent.disableClickPropagation(div);
    return div;
  };
  summaryControl.addTo(map);

  const microState = {
    container: null,
    records: [],
    filtered: [],
    selected: new Set(),
    applied: null,
    total: 0,
    searchTimer: 0,
    elements: {
      summary: null,
      pending: null,
      origin: null,
      region: null,
      municipality: null,
      search: null,
      list: null,
      count: null,
      selectAll: null,
      selectNone: null,
      reset: null,
      apply: null
    }
  };

  const microControl = L.control({ position: 'topright' });
  microControl.onAdd = () => {
    const div = L.DomUtil.create('div', 'panel micro-panel');
    div.innerHTML = '<h3>Microbacias</h3><div class="micro-summary">Carregando filtros...</div>';
    microState.container = div;
    L.DomEvent.disableScrollPropagation(div);
    L.DomEvent.disableClickPropagation(div);
    return div;
  };
  microControl.addTo(map);

  const datasetStore = new Map();
  let currentOpacity = 0.7;
  let currentSelection = null;

  const fetchCache = new Map();

  LAYERS.forEach(registerDataset);

  const fitButton = document.getElementById('fitAll');
  if (fitButton) fitButton.addEventListener('click', fitToVisibleLayers);

  const opacityInput = document.getElementById('opacity');
  const opacityLabel = document.getElementById('opacityVal');
  if (opacityInput) {
    opacityInput.addEventListener('input', () => {
      const pct = Number(opacityInput.value);
      currentOpacity = Math.max(0.2, Math.min(1, pct / 100));
      if (opacityLabel) opacityLabel.textContent = `${pct}%`;
      updateAllStyles();
    });
  }

  map.on('overlayadd', event => {
    const key = event.layer?.datasetKey;
    if (!key) return;
    const entry = datasetStore.get(key);
    if (!entry) return;
    ensureLayerReady(entry)
      .then(() => {
        updateLegendForEntry(entry);
        updateSummary();
      })
      .catch(error => console.error(`Falha ao ativar camada ${entry.def.name}:`, error));
  });

  map.on('overlayremove', event => {
    const key = event.layer?.datasetKey;
    if (!key) return;
    removeLegend(key);
    updateSummary();
  });

  function registerDataset(def) {
    if (datasetStore.has(def.key)) return datasetStore.get(def.key);
    const entry = {
      def,
      layerGroup: L.layerGroup(),
      layer: null,
      features: null,
      filteredFeatures: [],
      codeField: null,
      byCode: new Map(),
      metricsByCode: new Map(),
      classTotals: null,
      classByCode: null,
      classExtractor: null,
      totals: { areaHa: 0, lengthKm: 0, count: 0 },
      filteredMetrics: { areaHa: 0, lengthKm: 0, count: 0 },
      currentLegend: null,
      loading: null
    };
    entry.layerGroup.datasetKey = def.key;
    layerControl.addOverlay(entry.layerGroup, def.name);
    if (def.initiallyVisible) entry.layerGroup.addTo(map);
    datasetStore.set(def.key, entry);
    return entry;
  }

  function pointStyleFor(key) {
    const color = POINT_COLORS[key] || '#2563eb';
    return {
      radius: key === 'construcoes' ? 4 : 5,
      color,
      weight: 1,
      fillColor: color,
      fillOpacity: 0.8,
      opacity: currentOpacity
    };
  }

  function styleForFeature(key, feature) {
    if (key === 'declividade') {
      const entry = datasetStore.get('declividade');
      const value = entry?.classExtractor ? entry.classExtractor(feature) : '';
      const colorIdx = SLOPE_CLASSES.indexOf(value);
      return {
        color: '#4b5563',
        weight: 0.5,
        fillColor: SLOPE_COLORS[colorIdx >= 0 ? colorIdx : 0],
        fillOpacity: 0.6 * currentOpacity,
        opacity: currentOpacity
      };
    }
    if (key === 'altimetria') {
      const entry = datasetStore.get('altimetria');
      const value = entry?.classExtractor ? entry.classExtractor(feature) : '';
      return {
        color: '#475569',
        weight: 0.5,
        fillColor: altColorFor(value),
        fillOpacity: 0.6 * currentOpacity,
        opacity: currentOpacity
      };
    }
    if (key === 'uso_solo') {
      const entry = datasetStore.get('uso_solo');
      const value = entry?.classExtractor ? entry.classExtractor(feature) : '';
      return {
        color: '#374151',
        weight: 0.4,
        fillColor: USO_COLORS[value] || USO_FALLBACK_COLORS[value] || '#31a354',
        fillOpacity: 0.55 * currentOpacity,
        opacity: currentOpacity
      };
    }
    if (key === 'solos') {
      const entry = datasetStore.get('solos');
      const value = entry?.classExtractor ? entry.classExtractor(feature) : '';
      return {
        color: '#4b5563',
        weight: 0.4,
        fillColor: SOIL_COLORS[value] || '#dfc27d',
        fillOpacity: 0.6 * currentOpacity,
        opacity: currentOpacity
      };
    }
    if (key === 'estradas') {
      return { color: '#737373', weight: 2, dashArray: '4,4', opacity: currentOpacity };
    }
    if (key === 'hidrografia') {
      return { color: '#2b8cbe', weight: 2, opacity: currentOpacity };
    }
    if (key === 'microbacias') {
      return { color: '#1d4ed8', weight: 2, fillColor: '#93c5fd', fillOpacity: 0.25 * currentOpacity, opacity: currentOpacity };
    }
    if (key === 'car') {
      return { color: '#ff7f00', weight: 1.2, fillColor: '#ffa64d', fillOpacity: 0.2 * currentOpacity, opacity: currentOpacity };
    }
    return { color: '#4b5563', weight: 1, fillOpacity: 0.25 * currentOpacity, opacity: currentOpacity };
  }

  function popupHtml(def, feature) {
    const props = feature?.properties;
    if (!props) return '';
    const entries = Object.entries(props);
    if (!entries.length) return '';
    const titleField = def.popupTitleField ? findField(props, [def.popupTitleField]) : null;
    const titleValue = titleField ? props[titleField] : null;
    const rows = entries
      .slice(0, 20)
      .map(([key, value]) => `<tr><th>${key}</th><td>${value}</td></tr>`)
      .join('');
    const title = titleValue ? `<div class="popup-title"><strong>${def.name}</strong> — ${titleValue}</div>` : `<div class="popup-title"><strong>${def.name}</strong></div>`;
    return `${title}<table class="popup-table">${rows}</table>`;
  }

  function createGeoJson(entry) {
    const options = {
      style: feature => styleForFeature(entry.def.key, feature),
      onEachFeature: (feature, layer) => {
        const html = popupHtml(entry.def, feature);
        if (html) layer.bindPopup(html);
      }
    };
    if (entry.def.type === 'point') {
      options.pointToLayer = (feature, latlng) => L.circleMarker(latlng, pointStyleFor(entry.def.key));
      delete options.style;
    }
    const layer = L.geoJSON([], options);
    layer.datasetKey = entry.def.key;
    return layer;
  }

  function applyStyleToEntry(entry) {
    if (!entry?.layer) return;
    if (entry.def.type === 'point') {
      const style = pointStyleFor(entry.def.key);
      entry.layer.eachLayer(layer => {
        if (layer.setStyle) layer.setStyle(style);
        if (typeof layer.setRadius === 'function') layer.setRadius(style.radius);
      });
      return;
    }
    entry.layer.eachLayer(layer => {
      if (layer.setStyle) layer.setStyle(styleForFeature(entry.def.key, layer.feature));
    });
  }

  async function fetchMaybeGz(url) {
    if (fetchCache.has(url)) return fetchCache.get(url);
    const promise = (async () => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status} ao buscar ${url}\n${text.slice(0, 160)}`);
      }
      if (url.toLowerCase().endsWith('.gz')) {
        if (!window.pako || typeof window.pako.inflate !== 'function') {
          throw new Error('Dependência pako não encontrada para descompactar dados.');
        }
        const buffer = await response.arrayBuffer();
        if (!buffer.byteLength) return { type: 'FeatureCollection', features: [] };
        const inflated = window.pako.inflate(new Uint8Array(buffer), { to: 'string' });
        return JSON.parse(inflated);
      }
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) return response.json();
      const text = await response.text();
      return JSON.parse(text);
    })();
    fetchCache.set(url, promise);
    promise.catch(() => fetchCache.delete(url));
    return promise;
  }

  function toFeatures(geojson) {
    if (!geojson) return [];
    if (geojson.type === 'FeatureCollection') return Array.isArray(geojson.features) ? geojson.features : [];
    if (geojson.type === 'Feature') return [geojson];
    return [];
  }

  function computeMetrics(feature, type) {
    if (!feature) return { areaHa: 0, lengthKm: 0, count: 0 };
    try {
      if (type === 'poly') {
        const area = turf.area(feature) / 10000;
        return { areaHa: Number.isFinite(area) ? area : 0, lengthKm: 0, count: 0 };
      }
      if (type === 'line') {
        const len = turf.length(feature, { units: 'kilometers' });
        return { areaHa: 0, lengthKm: Number.isFinite(len) ? len : 0, count: 0 };
      }
      if (type === 'point') {
        const geom = feature.geometry;
        if (!geom) return { areaHa: 0, lengthKm: 0, count: 0 };
        if (geom.type === 'Point') return { areaHa: 0, lengthKm: 0, count: 1 };
        if (geom.type === 'MultiPoint') {
          const pts = Array.isArray(geom.coordinates) ? geom.coordinates.length : 0;
          return { areaHa: 0, lengthKm: 0, count: pts };
        }
        return { areaHa: 0, lengthKm: 0, count: 0 };
      }
    } catch (error) {
      console.warn('Falha ao calcular métricas:', error);
    }
    return { areaHa: 0, lengthKm: 0, count: 0 };
  }

  function mergeMetrics(target, delta) {
    target.areaHa += delta.areaHa || 0;
    target.lengthKm += delta.lengthKm || 0;
    target.count += delta.count || 0;
  }

  function prepareDataset(entry, features) {
    entry.features = features;
    entry.filteredFeatures = features;
    entry.byCode = new Map();
    entry.metricsByCode = new Map();
    entry.classTotals = entry.def.legendType === 'area' ? new Map() : null;
    entry.classByCode = entry.def.legendType === 'area' ? new Map() : null;
    entry.totals = { areaHa: 0, lengthKm: 0, count: 0 };
    entry.filteredMetrics = { areaHa: 0, lengthKm: 0, count: 0 };
    entry.currentLegend = null;

    if (!features.length) {
      entry.codeField = null;
      entry.classExtractor = entry.def.classStrategy ? () => '' : null;
      return;
    }

    const sampleProps = features.find(f => f?.properties)?.properties || {};
    entry.codeField = entry.def.filterable === false ? null : findField(sampleProps, CODE_FIELD_CANDIDATES);
    if (entry.def.key === 'microbacias' && !entry.codeField) entry.codeField = 'Cod_man';
    if (entry.def.classStrategy?.createExtractor) {
      entry.classExtractor = entry.def.classStrategy.createExtractor(sampleProps);
    }

    features.forEach(feature => {
      const metrics = computeMetrics(feature, entry.def.type);
      mergeMetrics(entry.totals, metrics);

      const code = entry.codeField ? normaliseCode(feature?.properties?.[entry.codeField]) : '';
      if (code) {
        if (!entry.byCode.has(code)) entry.byCode.set(code, []);
        entry.byCode.get(code).push(feature);
        if (!entry.metricsByCode.has(code)) entry.metricsByCode.set(code, { areaHa: 0, lengthKm: 0, count: 0 });
        mergeMetrics(entry.metricsByCode.get(code), metrics);
      }

      if (entry.def.legendType === 'area' && metrics.areaHa > 0 && entry.classExtractor) {
        const cls = entry.classExtractor(feature);
        if (cls) {
          entry.classTotals.set(cls, (entry.classTotals.get(cls) || 0) + metrics.areaHa);
          if (code) {
            if (!entry.classByCode.has(code)) entry.classByCode.set(code, new Map());
            const bucket = entry.classByCode.get(code);
            bucket.set(cls, (bucket.get(cls) || 0) + metrics.areaHa);
          }
        }
      }
    });

    entry.filteredMetrics = { ...entry.totals };
    if (entry.def.legendType === 'area') {
      entry.currentLegend = { total: entry.totals.areaHa, map: new Map(entry.classTotals) };
    }
  }

  async function loadDataset(entry) {
    if (!entry) return [];
    if (entry.features) return entry.features;
    if (entry.loading) return entry.loading;
    entry.loading = (async () => {
      const files = Array.isArray(entry.def.files) ? entry.def.files : [entry.def.files];
      const features = [];
      for (const file of files) {
        try {
          const data = await fetchMaybeGz(new URL(file, DATA_BASE_URL).toString());
          features.push(...toFeatures(data));
        } catch (error) {
          console.warn(`Falha ao carregar ${entry.def.name} (${file}):`, error);
        }
      }
      prepareDataset(entry, features);
      applyFilterToEntry(entry, currentSelection);
      return entry.features;
    })();
    entry.loading.finally(() => {
      entry.loading = null;
    });
    return entry.loading;
  }
  async function ensureLayerReady(entry) {
    await loadDataset(entry);
    if (!entry.layer) {
      entry.layer = createGeoJson(entry);
      entry.layerGroup.addLayer(entry.layer);
    }
    refreshEntryLayer(entry);
  }

  function refreshEntryLayer(entry) {
    if (!entry?.layer) return;
    entry.layer.clearLayers();
    if (entry.filteredFeatures?.length) entry.layer.addData(entry.filteredFeatures);
    applyStyleToEntry(entry);
  }

  function aggregateLegendForSelection(entry, selection) {
    if (entry.def.legendType !== 'area') {
      entry.currentLegend = null;
      return;
    }
    if (!selection || !entry.codeField) {
      entry.currentLegend = { total: entry.totals.areaHa, map: new Map(entry.classTotals) };
      return;
    }
    if (selection.size === 0) {
      entry.currentLegend = { total: 0, map: new Map() };
      return;
    }
    const mapValues = new Map();
    selection.forEach(code => {
      const bucket = entry.classByCode?.get(code);
      if (!bucket) return;
      bucket.forEach((value, key) => {
        mapValues.set(key, (mapValues.get(key) || 0) + value);
      });
    });
    const total = Array.from(mapValues.values()).reduce((sum, value) => sum + value, 0);
    entry.currentLegend = { total, map: mapValues };
  }

  function applyFilterToEntry(entry, selection) {
    if (!entry?.features) return;
    if (!selection || !entry.codeField) {
      entry.filteredFeatures = entry.features;
      entry.filteredMetrics = { ...entry.totals };
      aggregateLegendForSelection(entry, null);
    } else if (selection.size === 0) {
      entry.filteredFeatures = [];
      entry.filteredMetrics = { areaHa: 0, lengthKm: 0, count: 0 };
      aggregateLegendForSelection(entry, selection);
    } else {
      const features = [];
      const metrics = { areaHa: 0, lengthKm: 0, count: 0 };
      selection.forEach(code => {
        const list = entry.byCode.get(code);
        if (!list) return;
        features.push(...list);
        const aggregate = entry.metricsByCode.get(code);
        if (aggregate) mergeMetrics(metrics, aggregate);
      });
      entry.filteredFeatures = features;
      entry.filteredMetrics = metrics;
      aggregateLegendForSelection(entry, selection);
    }
    if (entry.layer) {
      if (map.hasLayer(entry.layerGroup)) refreshEntryLayer(entry);
    }
  }

  function buildDeclividadeLegend(entry) {
    const legend = entry.currentLegend || { total: 0, map: new Map() };
    const total = legend.total || 0;
    const mapValues = legend.map || new Map();
    const items = [];

    entry.def.classStrategy.orderedClasses.forEach((code, idx) => {
      const area = mapValues.get(code) || 0;
      if (!(area > 0)) return;
      const pct = total > 0 ? (area / total) * 100 : 0;
      items.push({ label: entry.def.classStrategy.orderedLabels[idx], color: SLOPE_COLORS[idx], area, pct });
    });

    mapValues.forEach((area, code) => {
      if (entry.def.classStrategy.orderedClasses.includes(code) || !(area > 0)) return;
      const pct = total > 0 ? (area / total) * 100 : 0;
      items.push({ label: code, color: '#6b7280', area, pct });
    });

    return { title: entry.def.classStrategy.title, unit: 'area', total, items };
  }

  function buildAreaLegend(entry, colorFor, title, sortMode) {
    const legend = entry.currentLegend || { total: 0, map: new Map() };
    const total = legend.total || 0;
    const mapValues = legend.map || new Map();
    const items = Array.from(mapValues.entries())
      .filter(([, area]) => area > 0)
      .map(([label, area]) => ({
        label,
        color: colorFor(label),
        area,
        pct: total > 0 ? (area / total) * 100 : 0
      }));
    if (sortMode === 'numeric') {
      items.sort((a, b) => {
        const na = Number(String(a.label).match(/^(\d+)/)?.[1] || 0);
        const nb = Number(String(b.label).match(/^(\d+)/)?.[1] || 0);
        return na - nb;
      });
    } else {
      items.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    }
    return { title, unit: 'area', total, items };
  }

  function buildLineLegend(entry) {
    const total = entry.filteredMetrics?.lengthKm || 0;
    const color = styleForFeature(entry.def.key, {}).color || '#4b5563';
    const items = total > 0 ? [{ label: 'Extensão filtrada', color, length: total }] : [];
    return { title: entry.def.legendTitle || entry.def.name, unit: 'length', total, items };
  }

  function buildPointLegend(entry) {
    const total = entry.filteredMetrics?.count || 0;
    const color = pointStyleFor(entry.def.key).fillColor;
    const items = total > 0 ? [{ label: 'Total filtrado', color, count: total }] : [];
    return { title: entry.def.legendTitle || entry.def.name, unit: 'count', total, items };
  }

  function buildLegendData(entry) {
    switch (entry.def.key) {
      case 'declividade':
        return buildDeclividadeLegend(entry);
      case 'altimetria':
        return buildAreaLegend(entry, altColorFor, entry.def.classStrategy.title, 'numeric');
      case 'uso_solo':
        return buildAreaLegend(entry, value => USO_COLORS[value] || USO_FALLBACK_COLORS[value] || '#31a354', entry.def.classStrategy.title);
      case 'solos':
        return buildAreaLegend(entry, value => SOIL_COLORS[value] || '#dfc27d', entry.def.classStrategy.title);
      case 'estradas':
      case 'hidrografia':
        return buildLineLegend(entry);
      case 'nascentes':
      case 'construcoes':
      case 'caf':
        return buildPointLegend(entry);
      default:
        return null;
    }
  }

  function renderLegend(key, data) {
    if (!legendContainer) return;
    if (!data) {
      removeLegend(key);
      return;
    }
    const hasContent = (data.items && data.items.length) || (data.total && data.total > 0);
    if (!hasContent) {
      removeLegend(key);
      return;
    }
    let node = legendElements.get(key);
    if (!node) {
      node = document.createElement('div');
      node.className = 'legend';
      node.dataset.legendKey = key;
      legendContainer.appendChild(node);
      legendElements.set(key, node);
    }

@@ -903,469 +948,482 @@
        textWrap.appendChild(labelEl);

        const metricEl = document.createElement('div');
        metricEl.className = 'legend-metric';
        if (data.unit === 'length') {
          metricEl.textContent = `${fmt.km(item.length)} km`;
        } else if (data.unit === 'count') {
          metricEl.textContent = `${fmt.int(item.count)} registros`;
        } else {
          metricEl.textContent = `${fmt.ha(item.area)} ha (${fmt.pct(item.pct)}%)`;
        }
        textWrap.appendChild(metricEl);

        row.appendChild(textWrap);
        listEl.appendChild(row);
      });
      node.appendChild(listEl);
    } else {
      const note = document.createElement('div');
      note.className = 'legend-note';
      note.textContent = 'Nenhum dado para o filtro atual.';
      node.appendChild(note);
    }
  }

  function removeLegend(key) {
    const node = legendElements.get(key);
    if (!node || !legendContainer) return;
    if (legendContainer.contains(node)) legendContainer.removeChild(node);
    legendElements.delete(key);
  }

  function updateLegendForEntry(entry) {
    if (!map.hasLayer(entry.layerGroup)) {
      removeLegend(entry.def.key);
      return;
    }
    const data = buildLegendData(entry);
    renderLegend(entry.def.key, data);
  }

  function updateLegendsForVisible() {
    datasetStore.forEach(entry => {
      if (map.hasLayer(entry.layerGroup)) updateLegendForEntry(entry);
    });
  }

  function updateSummary() {
    if (!summaryBody) return;
    summaryBody.innerHTML = '';
    LAYERS.forEach(def => {
      const entry = datasetStore.get(def.key);
      const row = document.createElement('tr');

      const nameCell = document.createElement('td');
      nameCell.textContent = def.name;
      row.appendChild(nameCell);

      const areaCell = document.createElement('td');
      const lengthCell = document.createElement('td');
      const countCell = document.createElement('td');

      if (!entry || !entry.features) {
        areaCell.textContent = def.type === 'poly' ? '—' : '—';
        lengthCell.textContent = def.type === 'line' ? '—' : '—';
        countCell.textContent = def.type === 'point' ? '—' : '—';
        [areaCell, lengthCell, countCell].forEach(cell => {
          cell.classList.add('muted-cell');
          cell.title = 'Ative a camada para carregar os dados';
        });
      } else {
        [areaCell, lengthCell, countCell].forEach(cell => {
          cell.classList.remove('muted-cell');
          cell.removeAttribute('title');
        });
        const metrics = entry.filteredMetrics || entry.totals || { areaHa: 0, lengthKm: 0, count: 0 };
        areaCell.textContent = def.type === 'poly' ? fmt.ha(metrics.areaHa) : '—';
        lengthCell.textContent = def.type === 'line' ? fmt.km(metrics.lengthKm) : '—';
        countCell.textContent = def.type === 'point' ? fmt.int(metrics.count) : '—';
      }

      row.appendChild(areaCell);
      row.appendChild(lengthCell);
      row.appendChild(countCell);
      summaryBody.appendChild(row);
    });

    if (!summaryNote) return;
    if (!microState.records.length) {
      summaryNote.textContent = 'Microbacias não disponíveis para filtragem.';
    } else if (!microState.applied) {
      summaryNote.textContent = 'Sem filtro de microbacias — totais gerais.';
    } else if (microState.applied.size === 0) {
      summaryNote.textContent = 'Filtro aplicado sem microbacias — nenhuma feição exibida.';
    } else if (microState.applied.size <= 3) {
      const labels = [];
      microState.applied.forEach(code => {
        const item = microState.records.find(record => record.code === code);
        labels.push(item?.label || code);
      });
      summaryNote.innerHTML = `Filtro ativo: <strong>${labels.join(', ')}</strong>`;
    } else {
      summaryNote.innerHTML = `Filtro ativo: <strong>${microState.applied.size}</strong> microbacias`;
    }
  }

  function sameSelection(a, b) {
    if (!a && !b) return true;
    if (!a || !b) return false;
    if (a.size !== b.size) return false;
    for (const value of a) {
      if (!b.has(value)) return false;
    }
    return true;
  }

  function normaliseSelection(set) {
    if (!set) return null;
    if (set.size === 0) return new Set();
    if (set.size === microState.total) return null;
    return new Set(set);
  }

  function filterMicroRecords() {
    const origin = microState.elements.origin?.value || '';
    const region = microState.elements.region?.value || '';
    const municipality = microState.elements.municipality?.value || '';
    const query = microState.elements.search?.value || '';
    const normalizedQuery = query ? normaliseText(query) : '';
    return microState.records.filter(item => {
      if (origin && item.origin !== origin) return false;
      if (region && !item.regionals.includes(region)) return false;
      if (municipality && !item.municipalities.includes(municipality)) return false;
      if (normalizedQuery && !item.searchText.includes(normalizedQuery)) return false;
      return true;
    });
  }

  function updateMicroSummary() {
    const summaryEl = microState.elements.summary;
    const pendingEl = microState.elements.pending;
    const countEl = microState.elements.count;
    const normalized = normaliseSelection(microState.selected);
    const pending = !sameSelection(normalized, microState.applied);

    if (summaryEl) {
      summaryEl.classList.remove('filtered', 'none');
      if (!microState.applied) {
        summaryEl.textContent = 'Todas as microbacias ativas.';
      } else if (microState.applied.size === 0) {
        summaryEl.textContent = 'Nenhuma microbacia aplicada.';
        summaryEl.classList.add('none');
      } else if (microState.applied.size === 1) {
        const code = Array.from(microState.applied)[0];
        const label = microState.records.find(item => item.code === code)?.label || code;
        summaryEl.innerHTML = `Selecionada: <strong>${label}</strong>`;
        summaryEl.classList.add('filtered');
      } else {
        summaryEl.innerHTML = `<strong>${microState.applied.size}</strong> microbacias selecionadas.`;
        summaryEl.classList.add('filtered');
      }
    }

    if (pendingEl) pendingEl.hidden = !pending;
    if (countEl) countEl.textContent = `Selecionadas: ${microState.selected.size} de ${microState.total}`;
  }

  function renderMicroList() {
    const listEl = microState.elements.list;
    if (!listEl) return;
    const filtered = filterMicroRecords();
    microState.filtered = filtered;
    listEl.innerHTML = '';

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'Nenhuma microbacia encontrada para os filtros selecionados.';
      listEl.appendChild(empty);
      updateMicroSummary();
      return;
    }

    const fragment = document.createDocumentFragment();
    filtered.forEach(item => {
      const row = document.createElement('label');
      row.className = 'option-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = item.code;
      checkbox.checked = microState.selected.has(item.code);
      checkbox.addEventListener('change', event => {
        if (event.target.checked) microState.selected.add(item.code);
        else microState.selected.delete(item.code);
        updateMicroSummary();
      });
      row.appendChild(checkbox);

      const textWrap = document.createElement('div');
      textWrap.className = 'option-text';

      const labelEl = document.createElement('div');
      labelEl.className = 'option-label';
      labelEl.textContent = item.label;
      textWrap.appendChild(labelEl);

      const meta = document.createElement('div');
      meta.className = 'option-meta';
      const parts = [];
      if (item.origin) parts.push(item.origin);
      if (item.regionals.length) parts.push(item.regionals.join(', '));
      if (item.municipalities.length) {
        if (item.municipalities.length <= 2) parts.push(item.municipalities.join(', '));
        else parts.push(`${item.municipalities.slice(0, 2).join(', ')} +${item.municipalities.length - 2}`);
      }
      meta.textContent = parts.join(' • ');
      textWrap.appendChild(meta);

      row.appendChild(textWrap);
      fragment.appendChild(row);
    });

    listEl.appendChild(fragment);
    updateMicroSummary();
  }

  function populateSelect(selectEl, values, placeholder) {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    const option = document.createElement('option');
    option.value = '';
    option.textContent = placeholder;
    selectEl.appendChild(option);
    values.forEach(value => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value;
      selectEl.appendChild(opt);
    });
  }

  function setupMicroFilterUI() {
    const container = microState.container;
    if (!container) return;

    if (!microState.records.length) {
      container.innerHTML = '<h3>Microbacias</h3><div class="micro-summary">Nenhuma microbacia disponível para filtragem.</div>';
      return;
    }

    container.innerHTML = `
      <h3>Microbacias</h3>
      <div class="micro-summary" id="mf-summary">Todas as microbacias ativas.</div>
      <div class="micro-pending" id="mf-pending" hidden>Aplicar seleção para atualizar o mapa.</div>
      <label for="mf-origin">Origem</label>
      <select id="mf-origin"></select>
      <label for="mf-region">Regional IDR</label>
      <select id="mf-region"></select>
      <label for="mf-municipio">Município</label>
      <select id="mf-municipio"></select>
      <label for="mf-search">Pesquisar</label>
      <input id="mf-search" type="search" placeholder="Buscar microbacia ou código" />
      <div class="control-row">
        <button id="mf-select-all" class="btn-sm" type="button">Marcar todos</button>
        <button id="mf-select-none" class="btn-sm" type="button">Limpar</button>
        <button id="mf-reset" class="btn-sm" type="button">Redefinir</button>
        <button id="mf-apply" class="btn-sm primary" type="button">Aplicar</button>
      </div>
      <div class="micro-count" id="mf-count"></div>
      <div id="mf-list" class="option-list"></div>
    `;

    microState.elements.summary = container.querySelector('#mf-summary');
    microState.elements.pending = container.querySelector('#mf-pending');
    microState.elements.origin = container.querySelector('#mf-origin');
    microState.elements.region = container.querySelector('#mf-region');
    microState.elements.municipality = container.querySelector('#mf-municipio');
    microState.elements.search = container.querySelector('#mf-search');
    microState.elements.list = container.querySelector('#mf-list');
    microState.elements.count = container.querySelector('#mf-count');
    microState.elements.selectAll = container.querySelector('#mf-select-all');
    microState.elements.selectNone = container.querySelector('#mf-select-none');
    microState.elements.reset = container.querySelector('#mf-reset');
    microState.elements.apply = container.querySelector('#mf-apply');

    const origins = Array.from(new Set(microState.records.map(item => item.origin).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    );
    const regions = Array.from(new Set(microState.records.flatMap(item => item.regionals))).sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    );
    const municipalities = Array.from(new Set(microState.records.flatMap(item => item.municipalities))).sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    );

    populateSelect(microState.elements.origin, origins, '(todas)');
    populateSelect(microState.elements.region, regions, '(todas)');
    populateSelect(microState.elements.municipality, municipalities, '(todos)');

    const rerender = () => renderMicroList();

    microState.elements.origin?.addEventListener('change', rerender);
    microState.elements.region?.addEventListener('change', rerender);
    microState.elements.municipality?.addEventListener('change', rerender);
    microState.elements.search?.addEventListener('input', () => {
      window.clearTimeout(microState.searchTimer);
      microState.searchTimer = window.setTimeout(rerender, 120);
    });

    microState.elements.selectAll?.addEventListener('click', () => {
      const filtered = microState.filtered.length ? microState.filtered : filterMicroRecords();
      filtered.forEach(item => microState.selected.add(item.code));
      renderMicroList();
    });

    microState.elements.selectNone?.addEventListener('click', () => {
      const filtered = microState.filtered.length ? microState.filtered : filterMicroRecords();
      filtered.forEach(item => microState.selected.delete(item.code));
      renderMicroList();
    });

    microState.elements.reset?.addEventListener('click', () => {
      if (microState.elements.origin) microState.elements.origin.value = '';
      if (microState.elements.region) microState.elements.region.value = '';
      if (microState.elements.municipality) microState.elements.municipality.value = '';
      if (microState.elements.search) microState.elements.search.value = '';
      microState.selected = new Set(microState.records.map(item => item.code));
      microState.applied = null;
      applySelection(null);
      renderMicroList();
    });

    microState.elements.apply?.addEventListener('click', () => {
      const normalized = normaliseSelection(microState.selected);
      if (sameSelection(normalized, microState.applied)) {
        updateMicroSummary();
        return;
      }
      microState.applied = normalized ? new Set(normalized) : null;
      applySelection(microState.applied);
      renderMicroList();
    });

    renderMicroList();
  }

  function buildMicroRecords(microEntry, cafEntry) {
    if (!microEntry?.features?.length) {
      microState.records = [];
      microState.selected = new Set();
      microState.applied = null;
      microState.total = 0;
      return;
    }

    const sample = microEntry.features.find(f => f?.properties)?.properties || {};
    const codeField = microEntry.codeField || findField(sample, CODE_FIELD_CANDIDATES) || 'Cod_man';
    const originField = findField(sample, ORIGIN_FIELD_CANDIDATES);
    const manancialField = findField(sample, MANANCIAL_FIELD_CANDIDATES);
    const nomeField = findField(sample, NAME_FIELD_CANDIDATES);

    const records = new Map();

    microEntry.features.forEach(feature => {
      const props = feature?.properties || {};
      const code = normaliseCode(props[codeField]);
      if (!code) return;
      if (!records.has(code)) {
        const manancial = manancialField ? trimString(props[manancialField]) : '';
        const nome = nomeField ? trimString(props[nomeField]) : '';
        const labelParts = [code];
        if (manancial) labelParts.push(manancial);
        else if (nome) labelParts.push(nome);
        records.set(code, {
          code,
          label: labelParts.join(' — '),
          origin: originField ? trimString(props[originField]) : '',
          manancial,
          nomeBacia: nome,
          regionals: new Set(),
          municipalities: new Set()
        });
      }
    });

    if (cafEntry?.features?.length) {
      const cafSample = cafEntry.features.find(f => f?.properties)?.properties || {};
      const cafCodeField = cafEntry.codeField || findField(cafSample, CODE_FIELD_CANDIDATES) || 'Cod_man';
      const regionField = findField(cafSample, REGION_FIELD_CANDIDATES);
      const municipalityField = findField(cafSample, MUNICIPALITY_FIELD_CANDIDATES);
      cafEntry.features.forEach(feature => {
        const props = feature?.properties || {};
        const code = normaliseCode(props[cafCodeField]);
        if (!code) return;
        const record = records.get(code);
        if (!record) return;
        if (regionField) {
          const region = trimString(props[regionField]);
          if (region) record.regionals.add(region);
        }
        if (municipalityField) {
          const municipality = trimString(props[municipalityField]);
          if (municipality) record.municipalities.add(municipality);
        }
      });
    }

    const list = Array.from(records.values()).map(record => {
      const regionals = Array.from(record.regionals).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      const municipalities = Array.from(record.municipalities).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      const searchBase = [record.code, record.label, record.origin || '', ...regionals, ...municipalities].join(' ');
      return {
        ...record,
        regionals,
        municipalities,
        searchText: normaliseText(searchBase)
      };
    });

    list.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

    microState.records = list;
    microState.selected = new Set(list.map(item => item.code));
    microState.applied = null;
    microState.total = list.length;
  }

  function applySelection(selection) {
    currentSelection = selection ? new Set(selection) : null;
    datasetStore.forEach(entry => {
      if (entry.features) applyFilterToEntry(entry, currentSelection);
    });
    updateLegendsForVisible();
    updateSummary();
    updateMicroSummary();
  }

  function updateAllStyles() {
    datasetStore.forEach(entry => applyStyleToEntry(entry));
  }

  function fitToVisibleLayers() {
    const layers = [];
    datasetStore.forEach(entry => {
      if (!map.hasLayer(entry.layerGroup)) return;
      if (entry.layer && entry.layer.getLayers().length) layers.push(entry.layer);
    });
    if (!layers.length) return;
    const bounds = L.featureGroup(layers).getBounds();
    if (bounds && bounds.isValid()) map.fitBounds(bounds.pad(0.08));
  }

  async function init() {
    const microEntry = datasetStore.get('microbacias');
    const cafEntry = datasetStore.get('caf');

    await Promise.all([loadDataset(microEntry), loadDataset(cafEntry)]);

    applySelection(null);

    await ensureLayerReady(microEntry);
    if (microEntry.layer) {
      const bounds = microEntry.layer.getBounds();
      if (bounds && bounds.isValid()) map.fitBounds(bounds.pad(0.08));
    }

    buildMicroRecords(microEntry, cafEntry);
    setupMicroFilterUI();

    updateSummary();
    updateLegendsForVisible();

    map.attributionControl.setPrefix(false);
    map.attributionControl.addAttribution('Água Segura • filtros dinâmicos');
  }

  init().catch(error => {
    console.error('Falha ao inicializar o mapa:', error);
    window.alert('Não foi possível carregar os dados iniciais. Verifique o console para detalhes.');
  });
})();
