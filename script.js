  'use strict';

  const DATA_BASE_URL = new URL('./data/', window.location.href);

  const LAYER_DEFS = [
    {
      key: 'microbacias',
      name: 'Microbacias',
      type: 'poly',
      files: ['otto_selec__ottos_selec_lista4.geojson.gz'],
      initiallyVisible: true
    },
    { key: 'declividade', name: 'Declividade', type: 'poly', files: ['declividade__declividade_otto.geojson.gz'] },
    { key: 'altimetria', name: 'Altimetria', type: 'poly', files: ['altimetria__altimetria_otto.geojson.gz'] },
    { key: 'uso_solo', name: 'Uso do Solo', type: 'poly', files: ['uso_solo__usodosolo_otto.geojson.gz'] },
    { key: 'solos', name: 'Solos', type: 'poly', files: ['solos__solos_otto.geojson.gz'] },
    { key: 'estradas', name: 'Estradas', type: 'line', files: ['estradas__estradas_otto.geojson.gz'] },
    { key: 'hidrografia', name: 'Hidrografia', type: 'line', files: ['hidrografia__hidrografia_otto.geojson.gz'] },
    { key: 'nascentes', name: 'Nascentes', type: 'point', files: ['nascentes__nascentes_otto.geojson.gz'] },
    {
      key: 'construcoes',
      name: 'Construções',
      type: 'point',
      files: [
        'construcoes__construcoes_otto__part1.geojson.gz',
        'construcoes__construcoes_otto__part2.geojson.gz',
        'construcoes__construcoes_otto__part3.geojson.gz',
        'construcoes__construcoes_otto__part4.geojson.gz',
        'construcoes__construcoes_otto__part5.geojson.gz'
      ]
    },
    { key: 'caf', name: 'CAF', type: 'point', files: ['caf__caf_otto.geojson.gz'] },
    { key: 'car', name: 'CAR', type: 'poly', files: ['car__car_otto.geojson'], idField: 'cod_imovel' }
  ];

  const CLASS_FIELDS = {
    declividade: 'ClDec',
    altimetria: 'ClAlt',
    uso_solo: 'NIVEL_II',
    solos: 'Cl_solos'
  };

  const CODE_FIELD_CANDIDATES = ['Cod_man', 'COD_MAN', 'cod_man', 'codman'];
  const REGION_FIELD_CANDIDATES = ['RegIdr', 'REGIDR', 'regidr', 'REG_IDR', 'CRegIdr'];
  const MUNICIPALITY_FIELD_CANDIDATES = ['Municipio', 'MUNICIPIO', 'municipio', 'municipio_', 'NM_MUN', 'NM_MUNIC'];

  const AREA_LAYER_KEYS = new Set(['declividade', 'altimetria', 'uso_solo', 'solos']);

  const slopeOrder = ['000a003', '003a008', '008a015', '015a025', '025a045', '045a100', '>100'];
  const slopeLabels = ['0–3%', '3–8%', '8–15%', '15–25%', '25–45%', '45–100%', '>100%'];
  const slopeColors = ['#edf8e9', '#c7e9c0', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#0c2c84'];

  const altRamp = ['#ffffcc', '#c2e699', '#78c679', '#31a354', '#006837', '#00441b'];

  const usoColors = {
    'Agricultura Anual': '#e6ab02',
    'Agricultura Perene': '#c98c00',
    "Corpos d’Água": '#67a9cf',
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

  const usoFallbackColors = {
    Água: '#67a9cf',
    'Áreas de Vegetação Natural': '#1b9e77',
    'Áreas Antrópicas Agrícolas': '#e6ab02',
    'Áreas Antrópicas Não Agrícolas': '#6a51a3',
    'Áreas Antrópicas Agrícolas/Áreas de Vegetação Natural': '#8da0cb'
  };

  const soilColors = {
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

  const fmt = {
    ha(value) {
      if (typeof value !== 'number' || Number.isNaN(value) || value === 0) return '—';
      const abs = Math.abs(value);
      const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
      return value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    },
    km(value) {
      if (typeof value !== 'number' || Number.isNaN(value) || value === 0) return '—';
      const abs = Math.abs(value);
      const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
      return value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    },
    pct(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) return '—';
      return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    },
    int(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) return '—';
      return Math.round(value).toLocaleString('pt-BR');
    }
  };

  let currentOpacity = 0.7;

  const datasetStore = new Map();
  const legendElements = new Map();
  let legendContainer = null;

  const fetchCache = new Map();

  const microUI = {
    container: null,
    records: [],
    filteredRecords: [],
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

  let currentSelection = null;

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

  const microControl = L.control({ position: 'topright' });
  microControl.onAdd = () => {
    const div = L.DomUtil.create('div', 'panel micro-panel');
    div.innerHTML = '<h3>Microbacias</h3><div class="micro-summary">Carregando filtros...</div>';
    microUI.container = div;
    L.DomEvent.disableScrollPropagation(div);
    L.DomEvent.disableClickPropagation(div);
    return div;
  };
  microControl.addTo(map);

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

  LAYER_DEFS.forEach(registerDataset);

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

  function makeDataUrl(file) {
    return new URL(file, DATA_BASE_URL).toString();
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
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength === 0) return { type: 'FeatureCollection', features: [] };
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
    if (geojson.type === 'FeatureCollection') return geojson.features || [];
    if (geojson.type === 'Feature') return [geojson];
    return [];
  }

  function registerDataset(def) {
    if (datasetStore.has(def.key)) return datasetStore.get(def.key);
    const entry = {
      def,
      layerGroup: L.layerGroup(),
      geoJson: null,
      features: null,
      filteredFeatures: [],
      byCode: new Map(),
      metricsByCode: new Map(),
      legendByCode: new Map(),
      legendTotals: new Map(),
      totals: { areaHa: 0, lengthKm: 0, count: 0 },
      filteredMetrics: { areaHa: 0, lengthKm: 0, count: 0 },
      filteredLegend: { total: 0, map: new Map() },
      codeField: null,
      loading: null,
      needsRefresh: false
    };
    entry.layerGroup.datasetKey = def.key;
    layerControl.addOverlay(entry.layerGroup, def.name);
    if (def.initiallyVisible) entry.layerGroup.addTo(map);
    datasetStore.set(def.key, entry);
    return entry;
  }

  function normaliseCode(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
  }

  function normaliseString(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
  }

  function normaliseText(value) {
    return normaliseString(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function findMatchingField(props, candidates) {
    if (!props) return null;
    const lower = new Map();
    Object.keys(props).forEach(key => {
      lower.set(key.toLowerCase(), key);
    });
    for (const candidate of candidates) {
      const match = lower.get(candidate.toLowerCase());
      if (match) return match;
    }
    return null;
  }

  function ensureMetric(feature, key, compute) {
    if (!feature) return 0;
    if (!feature.__metrics) feature.__metrics = {};
    const cache = feature.__metrics;
    if (typeof cache[key] === 'number') return cache[key];
    const value = compute(feature);
    cache[key] = Number.isFinite(value) ? value : 0;
    return cache[key];
  }

  function getAreaHa(feature) {
    return ensureMetric(feature, 'areaHa', feat => {
      try {
        return turf.area(feat) / 10000;
      } catch (error) {
        return 0;
      }
    });
  }

  function getLengthKm(feature) {
    return ensureMetric(feature, 'lengthKm', feat => {
      try {
        return turf.length(feat, { units: 'kilometers' });
      } catch (error) {
        return 0;
      }
    });
  }

  function getPointCount(feature) {
    return ensureMetric(feature, 'pointCount', feat => {
      const geom = feat?.geometry;
      if (!geom) return 0;
      if (geom.type === 'Point') return 1;
      if (geom.type === 'MultiPoint') return Array.isArray(geom.coordinates) ? geom.coordinates.length : 0;
      return 0;
    });
  }

  function computeFeatureMetrics(feature, type) {
    if (type === 'poly') return { areaHa: getAreaHa(feature), lengthKm: 0, count: 0 };
    if (type === 'line') return { areaHa: 0, lengthKm: getLengthKm(feature), count: 0 };
    if (type === 'point') return { areaHa: 0, lengthKm: 0, count: getPointCount(feature) };
    return { areaHa: 0, lengthKm: 0, count: 0 };
  }

  function mergeMetrics(target, delta) {
    target.areaHa += delta.areaHa || 0;
    target.lengthKm += delta.lengthKm || 0;
    target.count += delta.count || 0;
  }

  function classValueFor(key, feature) {
    const props = feature?.properties || {};
    switch (key) {
      case 'declividade':
        return normaliseString(props[CLASS_FIELDS.declividade]);
      case 'altimetria':
        return normaliseString(props[CLASS_FIELDS.altimetria]);
      case 'uso_solo': {
        const field = Object.prototype.hasOwnProperty.call(props, CLASS_FIELDS.uso_solo) ? CLASS_FIELDS.uso_solo : 'NIVEL_I';
        return normaliseString(props[field]);
      }
      case 'solos':
        return normaliseString(props[CLASS_FIELDS.solos]);
      default:
        return '';
    }
  }

  function slopeColorFor(value) {
    const index = slopeOrder.indexOf(String(value));
    return slopeColors[index >= 0 ? index : 0];
  }

  function altColorFor(value) {
    if (!value) return altRamp[0];
    const match = String(value).match(/(\d+).+?(\d+)/);
    const mid = match ? (Number(match[1]) + Number(match[2])) / 2 : Number.NaN;
    if (Number.isNaN(mid)) return altRamp[0];
    const breaks = [0, 400, 800, 1200, 1600, 2000, Number.POSITIVE_INFINITY];
    for (let i = 0; i < breaks.length - 1; i += 1) {
      if (mid >= breaks[i] && mid < breaks[i + 1]) return altRamp[i];
    }
    return altRamp[altRamp.length - 1];
  }

  function usoColorFor(value) {
    return usoColors[value] || usoFallbackColors[value] || '#31a354';
  }

  function soilColorFor(value) {
    return soilColors[value] || '#dfc27d';
  }

  function styleForFeature(key, feature) {
    if (key === 'declividade') {
      const value = classValueFor('declividade', feature);
      return {
        color: '#4b5563',
        weight: 0.4,
        fillColor: slopeColorFor(value),
        fillOpacity: 0.6 * currentOpacity,
        opacity: currentOpacity
      };
    }
    if (key === 'altimetria') {
      const value = classValueFor('altimetria', feature);
      return {
        color: '#4b5563',
        weight: 0.4,
        fillColor: altColorFor(value),
        fillOpacity: 0.6 * currentOpacity,
        opacity: currentOpacity
      };
    }
    if (key === 'uso_solo') {
      const value = classValueFor('uso_solo', feature);
      return {
        color: '#374151',
        weight: 0.3,
        fillColor: usoColorFor(value),
        fillOpacity: 0.55 * currentOpacity,
        opacity: currentOpacity
      };
    }
    if (key === 'solos') {
      const value = classValueFor('solos', feature);
      return {
        color: '#475569',
        weight: 0.4,
        fillColor: soilColorFor(value),
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
      return { color: '#1e3a8a', weight: 1.6, fillColor: '#93c5fd', fillOpacity: 0.25 * currentOpacity, opacity: currentOpacity };
    }
    if (key === 'caf') {
      return { color: '#166534', weight: 1, fillColor: '#22c55e', fillOpacity: 0.4 * currentOpacity, opacity: currentOpacity };
    }
    if (key === 'car') {
      return { color: '#ea580c', weight: 1.2, fillColor: '#fb923c', fillOpacity: 0.2 * currentOpacity, opacity: currentOpacity };
    }
    return { color: '#4b5563', weight: 1, fillOpacity: 0.25 * currentOpacity, opacity: currentOpacity };
  }

  function pointStyleFor(key) {
    const baseColor = POINT_COLORS[key] || '#2563eb';
    return {
      radius: 4,
      color: '#1f2937',
      weight: 1,
      fillColor: baseColor,
      fillOpacity: 0.85 * currentOpacity,
      opacity: currentOpacity
    };
  }

  function popupHtml(def, feature) {
    const props = feature?.properties;
    if (!props) return '';
    const lines = [];
    const title = def.idField && props[def.idField] ? `${def.name} — ${props[def.idField]}` : def.name;
    lines.push(`<div class="popup-title"><strong>${title}</strong></div>`);
    const keys = Object.keys(props);
    for (let i = 0; i < Math.min(keys.length, 20); i += 1) {
      const key = keys[i];
      const value = props[key];
      lines.push(`<div><strong>${key}</strong>: ${value}</div>`);
    }
    return lines.join('');
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
    if (!entry?.geoJson) return;
    if (entry.def.type === 'point') {
      const style = pointStyleFor(entry.def.key);
      entry.geoJson.eachLayer(layer => {
        if (layer.setStyle) layer.setStyle(style);
        if (typeof layer.setRadius === 'function') layer.setRadius(style.radius);
      });
      return;
    }
    entry.geoJson.eachLayer(layer => {
      if (layer.setStyle) layer.setStyle(styleForFeature(entry.def.key, layer.feature));
    });
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
          const data = await fetchMaybeGz(makeDataUrl(file));
          features.push(...toFeatures(data));
        } catch (error) {
          console.warn(`Falha ao carregar ${entry.def.name} (${file}):`, error);
        }
      }
      prepareDataset(entry, features);
      entry.loading = null;
      return entry.features;
    })();
    return entry.loading;
  }

  function prepareDataset(entry, features) {
    entry.features = features;
    entry.filteredFeatures = features;
    entry.byCode = new Map();
    entry.metricsByCode = new Map();
    entry.legendByCode = new Map();
    entry.legendTotals = new Map();
    entry.totals = { areaHa: 0, lengthKm: 0, count: 0 };
    entry.filteredMetrics = { areaHa: 0, lengthKm: 0, count: 0 };
    entry.filteredLegend = { total: 0, map: new Map() };

    if (!features.length) {
      entry.codeField = null;
      return;
    }

    const sampleProps = features.find(f => f?.properties)?.properties || {};
    entry.codeField = findMatchingField(sampleProps, CODE_FIELD_CANDIDATES);

    features.forEach(feature => {
      const metrics = computeFeatureMetrics(feature, entry.def.type);
      mergeMetrics(entry.totals, metrics);

      const code = entry.codeField ? normaliseCode(feature?.properties?.[entry.codeField]) : '';
      if (code) {
        if (!entry.byCode.has(code)) entry.byCode.set(code, []);
        entry.byCode.get(code).push(feature);

        if (!entry.metricsByCode.has(code)) entry.metricsByCode.set(code, { areaHa: 0, lengthKm: 0, count: 0 });
        mergeMetrics(entry.metricsByCode.get(code), metrics);
      }

      if (AREA_LAYER_KEYS.has(entry.def.key)) {
        const classValue = classValueFor(entry.def.key, feature);
        if (classValue && metrics.areaHa > 0) {
          entry.legendTotals.set(classValue, (entry.legendTotals.get(classValue) || 0) + metrics.areaHa);
          if (code) {
            if (!entry.legendByCode.has(code)) entry.legendByCode.set(code, new Map());
            const bucket = entry.legendByCode.get(code);
            bucket.set(classValue, (bucket.get(classValue) || 0) + metrics.areaHa);
          }
        }
      }
    });

    entry.filteredMetrics = { ...entry.totals };
    if (AREA_LAYER_KEYS.has(entry.def.key)) {
      entry.filteredLegend = { total: entry.totals.areaHa, map: new Map(entry.legendTotals) };
    }
  }

  function aggregateLegendForSelection(entry, selection) {
    if (!AREA_LAYER_KEYS.has(entry.def.key)) {
      entry.filteredLegend = { total: 0, map: new Map() };
      return;
    }
    if (!selection) {
      entry.filteredLegend = { total: entry.totals.areaHa, map: new Map(entry.legendTotals) };
      return;
    }
    if (selection.size === 0) {
      entry.filteredLegend = { total: 0, map: new Map() };
      return;
    }
    const mapValues = new Map();
    selection.forEach(code => {
      const bucket = entry.legendByCode.get(code);
      if (!bucket) return;
      bucket.forEach((value, key) => {
        mapValues.set(key, (mapValues.get(key) || 0) + value);
      });
    });
    entry.filteredLegend = { total: entry.filteredMetrics.areaHa, map: mapValues };
  }

  function applyFilterToEntry(entry, selection) {
    if (!entry?.features) return;
    if (!selection || !entry.codeField) {
      entry.filteredFeatures = entry.features;
      entry.filteredMetrics = { ...entry.totals };
    } else if (selection.size === 0) {
      entry.filteredFeatures = [];
      entry.filteredMetrics = { areaHa: 0, lengthKm: 0, count: 0 };
    } else {
      const filtered = [];
      const metrics = { areaHa: 0, lengthKm: 0, count: 0 };
      selection.forEach(code => {
        const list = entry.byCode.get(code);
        if (!list) return;
        filtered.push(...list);
        const aggregate = entry.metricsByCode.get(code);
        if (aggregate) mergeMetrics(metrics, aggregate);
      });
      entry.filteredFeatures = filtered;
      entry.filteredMetrics = metrics;
    }

    aggregateLegendForSelection(entry, selection);

    if (entry.geoJson) {
      if (map.hasLayer(entry.layerGroup)) {
        entry.geoJson.clearLayers();
        if (entry.filteredFeatures.length) entry.geoJson.addData(entry.filteredFeatures);
        applyStyleToEntry(entry);
        entry.needsRefresh = false;
      } else {
        entry.needsRefresh = true;
      }
    }
  }

  async function ensureLayerReady(entry) {
    await loadDataset(entry);
    if (!entry.geoJson) {
      entry.geoJson = createGeoJson(entry);
      entry.layerGroup.addLayer(entry.geoJson);
    }
    applyFilterToEntry(entry, currentSelection);
  }

  function removeLegend(key) {
    const node = legendElements.get(key);
    if (!node || !legendContainer) return;
    if (legendContainer.contains(node)) legendContainer.removeChild(node);
    legendElements.delete(key);
  }

  function buildDeclividadeLegend(entry) {
    const legend = entry.filteredLegend || { total: 0, map: new Map() };
    const total = legend.total || 0;
    const mapValues = legend.map || new Map();
    const items = [];

    slopeOrder.forEach((code, index) => {
      const area = mapValues.get(code) || 0;
      if (!(area > 0)) return;
      const pct = total > 0 ? (area / total) * 100 : 0;
      items.push({ label: slopeLabels[index], color: slopeColors[index], area, pct });
    });

    mapValues.forEach((area, code) => {
      if (slopeOrder.includes(code) || !(area > 0)) return;
      const pct = total > 0 ? (area / total) * 100 : 0;
      items.push({ label: code, color: '#6b7280', area, pct });
    });

    return { title: 'Declividade (%)', unit: 'area', total, items };
  }

  function buildAltimetriaLegend(entry) {
    const legend = entry.filteredLegend || { total: 0, map: new Map() };
    const total = legend.total || 0;
    const mapValues = legend.map || new Map();
    const items = Array.from(mapValues.entries())
      .filter(([, area]) => area > 0)
      .map(([label, area]) => ({ label, color: altColorFor(label), area, pct: total > 0 ? (area / total) * 100 : 0 }))
      .sort((a, b) => {
        const na = Number(String(a.label).match(/^(\d+)/)?.[1] || 0);
        const nb = Number(String(b.label).match(/^(\d+)/)?.[1] || 0);
        return na - nb;
      });
    return { title: 'Altimetria (m)', unit: 'area', total, items };
  }

  function buildUsoSoloLegend(entry) {
    const legend = entry.filteredLegend || { total: 0, map: new Map() };
    const total = legend.total || 0;
    const mapValues = legend.map || new Map();
    const items = Array.from(mapValues.entries())
      .filter(([, area]) => area > 0)
      .map(([label, area]) => ({ label, color: usoColorFor(label), area, pct: total > 0 ? (area / total) * 100 : 0 }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    return { title: 'Uso do Solo', unit: 'area', total, items };
  }

  function buildSolosLegend(entry) {
    const legend = entry.filteredLegend || { total: 0, map: new Map() };
    const total = legend.total || 0;
    const mapValues = legend.map || new Map();
    const items = Array.from(mapValues.entries())
      .filter(([, area]) => area > 0)
      .map(([label, area]) => ({ label, color: soilColorFor(label), area, pct: total > 0 ? (area / total) * 100 : 0 }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    return { title: 'Solos', unit: 'area', total, items };
  }

  function buildLineLegend(entry, title) {
    const total = entry.filteredMetrics?.lengthKm || 0;
    const color = styleForFeature(entry.def.key, {}).color || '#4b5563';
    const items = total > 0 ? [{ label: 'Extensão filtrada', color, length: total }] : [];
    return { title, unit: 'length', total, items };
  }

  function buildPointLegend(entry, title, label) {
    const total = entry.filteredMetrics?.count || 0;
    const color = pointStyleFor(entry.def.key).fillColor;
    const items = total > 0 ? [{ label, color, count: total }] : [];
    return { title, unit: 'count', total, items };
  }

  function buildLegendData(entry) {
    switch (entry.def.key) {
      case 'declividade':
        return buildDeclividadeLegend(entry);
      case 'altimetria':
        return buildAltimetriaLegend(entry);
      case 'uso_solo':
        return buildUsoSoloLegend(entry);
      case 'solos':
        return buildSolosLegend(entry);
      case 'estradas':
        return buildLineLegend(entry, 'Estradas');
      case 'hidrografia':
        return buildLineLegend(entry, 'Hidrografia');
      case 'nascentes':
        return buildPointLegend(entry, 'Nascentes', 'Total de nascentes');
      case 'construcoes':
        return buildPointLegend(entry, 'Construções', 'Total de registros');
      case 'caf':
        return buildPointLegend(entry, 'CAF', 'Total de registros CAF');
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

    node.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'legend-header';

    const titleEl = document.createElement('div');
    titleEl.className = 'legend-title';
    titleEl.textContent = data.title;
    header.appendChild(titleEl);

    if (data.total && data.total > 0) {
      const totalEl = document.createElement('div');
      totalEl.className = 'legend-total';
      if (data.unit === 'length') {
        totalEl.innerHTML = `<span>Extensão total</span><strong>${fmt.km(data.total)} km</strong>`;
      } else if (data.unit === 'count') {
        totalEl.innerHTML = `<span>Total</span><strong>${fmt.int(data.total)}</strong>`;
      } else {
        totalEl.innerHTML = `<span>Área total</span><strong>${fmt.ha(data.total)} ha</strong>`;
      }
      header.appendChild(totalEl);
    }

    node.appendChild(header);

    if (data.items && data.items.length) {
      const listEl = document.createElement('div');
      listEl.className = 'legend-list';
      data.items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'legend-item';

        const sw = document.createElement('span');
        sw.className = 'sw';
        sw.style.background = item.color;
        row.appendChild(sw);
@@ -789,663 +887,469 @@
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
    LAYER_DEFS.forEach(def => {
      const entry = datasetStore.get(def.key);
      const row = document.createElement('tr');

      const nameCell = document.createElement('td');
      nameCell.textContent = def.name;
      row.appendChild(nameCell);

      const areaCell = document.createElement('td');
      const lengthCell = document.createElement('td');
      const countCell = document.createElement('td');

      if (!entry || !entry.features) {
        areaCell.textContent = def.type === 'poly' ? '…' : '—';
        lengthCell.textContent = def.type === 'line' ? '…' : '—';
        countCell.textContent = def.type === 'point' ? '…' : '—';
      } else {
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

    if (summaryNote) {
      if (!microUI.records.length) {
        summaryNote.textContent = 'Microbacias não disponíveis para filtragem.';
      } else if (!microUI.applied) {
        summaryNote.textContent = 'Sem filtro de microbacias — totais gerais.';
      } else if (microUI.applied.size === 0) {
        summaryNote.textContent = 'Filtro aplicado sem microbacias — nenhuma feição exibida.';
      } else if (microUI.applied.size <= 3) {
        const labels = [];
        microUI.applied.forEach(code => {
          const item = microUI.records.find(record => record.code === code);
          labels.push(item?.label || code);
        });
        summaryNote.innerHTML = `Filtro ativo: <strong>${labels.join(', ')}</strong>`;
      } else {
        summaryNote.innerHTML = `Filtro ativo: <strong>${microUI.applied.size}</strong> microbacias`;
      }
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
    if (set.size === microUI.total) return null;
    return new Set(set);
  }

  function filterMicroRecords() {
    const origin = microUI.elements.origin?.value || '';
    const region = microUI.elements.region?.value || '';
    const municipality = microUI.elements.municipality?.value || '';
    const query = microUI.elements.search?.value || '';
    const normalizedQuery = query ? normaliseText(query) : '';
    return microUI.records.filter(item => {
      if (origin && item.origin !== origin) return false;
      if (region && !item.regionals.includes(region)) return false;
      if (municipality && !item.municipalities.includes(municipality)) return false;
      if (normalizedQuery && !item.searchText.includes(normalizedQuery)) return false;
      return true;
    });
  }

  function updateMicroSummary() {
    const summaryEl = microUI.elements.summary;
    const pendingEl = microUI.elements.pending;
    const countEl = microUI.elements.count;
    const normalized = normaliseSelection(microUI.selected);
    const pending = !sameSelection(normalized, microUI.applied);

    if (summaryEl) {
      summaryEl.classList.remove('filtered', 'none');
      if (!microUI.applied) {
        summaryEl.textContent = 'Todas as microbacias ativas.';
      } else if (microUI.applied.size === 0) {
        summaryEl.textContent = 'Nenhuma microbacia aplicada.';
        summaryEl.classList.add('none');
      } else if (microUI.applied.size === 1) {
        const code = Array.from(microUI.applied)[0];
        const label = microUI.records.find(item => item.code === code)?.label || code;
        summaryEl.innerHTML = `Selecionada: <strong>${label}</strong>`;
        summaryEl.classList.add('filtered');
      } else {
        summaryEl.innerHTML = `<strong>${microUI.applied.size}</strong> microbacias selecionadas.`;
        summaryEl.classList.add('filtered');
      }
    }

    if (pendingEl) pendingEl.hidden = !pending;
    if (countEl) countEl.textContent = `Selecionadas: ${microUI.selected.size} de ${microUI.total}`;
  }

  function renderMicroList() {
    const listEl = microUI.elements.list;
    if (!listEl) return;
    const filtered = filterMicroRecords();
    microUI.filteredRecords = filtered;
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
      checkbox.checked = microUI.selected.has(item.code);
      checkbox.addEventListener('change', event => {
        if (event.target.checked) microUI.selected.add(item.code);
        else microUI.selected.delete(item.code);
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
    const container = microUI.container;
    if (!container) return;

    if (!microUI.records.length) {
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

    microUI.elements.summary = container.querySelector('#mf-summary');
    microUI.elements.pending = container.querySelector('#mf-pending');
    microUI.elements.origin = container.querySelector('#mf-origin');
    microUI.elements.region = container.querySelector('#mf-region');
    microUI.elements.municipality = container.querySelector('#mf-municipio');
    microUI.elements.search = container.querySelector('#mf-search');
    microUI.elements.list = container.querySelector('#mf-list');
    microUI.elements.count = container.querySelector('#mf-count');
    microUI.elements.selectAll = container.querySelector('#mf-select-all');
    microUI.elements.selectNone = container.querySelector('#mf-select-none');
    microUI.elements.reset = container.querySelector('#mf-reset');
    microUI.elements.apply = container.querySelector('#mf-apply');

    const origins = Array.from(new Set(microUI.records.map(item => item.origin).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    );
    const regions = Array.from(new Set(microUI.records.flatMap(item => item.regionals))).sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    );
    const municipalities = Array.from(new Set(microUI.records.flatMap(item => item.municipalities))).sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    );

    populateSelect(microUI.elements.origin, origins, '(todas)');
    populateSelect(microUI.elements.region, regions, '(todas)');
    populateSelect(microUI.elements.municipality, municipalities, '(todos)');

    const rerender = () => renderMicroList();

    microUI.elements.origin?.addEventListener('change', rerender);
    microUI.elements.region?.addEventListener('change', rerender);
    microUI.elements.municipality?.addEventListener('change', rerender);
    microUI.elements.search?.addEventListener('input', () => {
      window.clearTimeout(microUI.searchTimer);
      microUI.searchTimer = window.setTimeout(rerender, 120);
    });

    microUI.elements.selectAll?.addEventListener('click', () => {
      const filtered = microUI.filteredRecords.length ? microUI.filteredRecords : filterMicroRecords();
      filtered.forEach(item => microUI.selected.add(item.code));
      renderMicroList();
    });

    microUI.elements.selectNone?.addEventListener('click', () => {
      const filtered = microUI.filteredRecords.length ? microUI.filteredRecords : filterMicroRecords();
      filtered.forEach(item => microUI.selected.delete(item.code));
      renderMicroList();
    });

    microUI.elements.reset?.addEventListener('click', () => {
      microUI.elements.origin.value = '';
      microUI.elements.region.value = '';
      microUI.elements.municipality.value = '';
      microUI.elements.search.value = '';
      microUI.selected = new Set(microUI.records.map(item => item.code));
      microUI.applied = null;
      applySelection(null);
      renderMicroList();
    });

    microUI.elements.apply?.addEventListener('click', () => {
      const normalized = normaliseSelection(microUI.selected);
      if (sameSelection(normalized, microUI.applied)) {
        updateMicroSummary();
        return;
      }
      microUI.applied = normalized ? new Set(normalized) : null;
      applySelection(microUI.applied);
      renderMicroList();
    });

    renderMicroList();
  }

  function buildMicroRecords(microEntry, cafEntry) {
    if (!microEntry?.features?.length) {
      microUI.records = [];
      microUI.selected = new Set();
      microUI.applied = null;
      microUI.total = 0;
      return;
    }

    const sample = microEntry.features.find(f => f?.properties)?.properties || {};
    const codeField = microEntry.codeField || findMatchingField(sample, CODE_FIELD_CANDIDATES) || 'Cod_man';
    const originField = findMatchingField(sample, ['Classe', 'CLASSE']);
    const manancialField = findMatchingField(sample, ['Manancial', 'MANANCIAL']);
    const nomeField = findMatchingField(sample, ['Nome_bacia', 'NOME_BACIA']);

    const records = new Map();

    microEntry.features.forEach(feature => {
      const props = feature?.properties || {};
      const code = normaliseCode(props[codeField]);
      if (!code) return;
      if (!records.has(code)) {
        const manancial = manancialField ? normaliseString(props[manancialField]) : '';
        const nome = nomeField ? normaliseString(props[nomeField]) : '';
        const labelParts = [code];
        if (manancial) labelParts.push(manancial);
        else if (nome) labelParts.push(nome);
        records.set(code, {
          code,
          label: labelParts.join(' — '),
          origin: originField ? normaliseString(props[originField]) : '',
          manancial,
          nomeBacia: nome,
          regionals: new Set(),
          municipalities: new Set()
        });
      }
    });

    if (cafEntry?.features?.length) {
      const cafSample = cafEntry.features.find(f => f?.properties)?.properties || {};
      const cafCodeField = cafEntry.codeField || findMatchingField(cafSample, CODE_FIELD_CANDIDATES) || 'Cod_man';
      const regionField = findMatchingField(cafSample, REGION_FIELD_CANDIDATES);
      const municipalityField = findMatchingField(cafSample, MUNICIPALITY_FIELD_CANDIDATES);
      cafEntry.features.forEach(feature => {
        const props = feature?.properties || {};
        const code = normaliseCode(props[cafCodeField]);
        if (!code) return;
        const record = records.get(code);
        if (!record) return;
        if (regionField) {
          const region = normaliseString(props[regionField]);
          if (region) record.regionals.add(region);
        }
        if (municipalityField) {
          const municipality = normaliseString(props[municipalityField]);
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

    microUI.records = list;
    microUI.selected = new Set(list.map(item => item.code));
    microUI.applied = null;
    microUI.total = list.length;
  }

  function updateAllStyles() {
    datasetStore.forEach(entry => applyStyleToEntry(entry));
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

  function fitToVisibleLayers() {
    const layers = [];
    datasetStore.forEach(entry => {
      if (!map.hasLayer(entry.layerGroup)) return;
      if (entry.geoJson && entry.geoJson.getLayers().length) layers.push(entry.geoJson);
    });
    if (!layers.length) return;
    const bounds = L.featureGroup(layers).getBounds();
    if (bounds && bounds.isValid()) map.fitBounds(bounds.pad(0.08));
  }

  async function init() {
    const microEntry = datasetStore.get('microbacias');
    const cafEntry = datasetStore.get('caf');

    await loadDataset(microEntry);
    await loadDataset(cafEntry);

    applySelection(null);

    await ensureLayerReady(microEntry);
    if (microEntry.geoJson) {
      const bounds = microEntry.geoJson.getBounds();
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
