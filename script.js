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
    'Água': '#7fc9f0',
    'Áreas Abertas': '#fc8d62',
    'Floresta Plantada': '#5e3c99',
    'Formação Florestal': '#1b9e77',
    'Formação Pioneira': '#66a61e',
    'Infraestrutura Urbana': '#e7298a',
    'Mineração': '#7570b3',
    'Pastagem': '#d95f02',
    'Reflorestamento': '#a6761d',
    'Silvicultura': '#c49c94'
  };

  const USO_COLORS_ALT = [
    '#fef9c3',
    '#fde68a',
    '#fcd34d',
    '#fbbf24',
    '#f59e0b',
    '#d97706',
    '#b45309',
    '#92400e',
    '#78350f'
  ];

  function usoColorFor(value) {
    if (!value) return '#9ca3af';
    if (USO_COLORS[value]) return USO_COLORS[value];
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) % USO_COLORS_ALT.length;
    }
    return USO_COLORS_ALT[Math.abs(hash) % USO_COLORS_ALT.length];
  }

  const POINT_COLORS = {
    barragens: '#0284c7',
    captações: '#2563eb',
    construcoes: '#7c3aed',
    escolas: '#d946ef',
    hidrometros: '#fb7185',
    nascentes: '#0ea5e9',
    poços: '#0891b2'
  };

  const DEFAULT_POINT_STYLE = {
    radius: 5,
    color: '#2563eb',
    weight: 1,
    fillColor: '#2563eb',
    fillOpacity: 0.8,
    opacity: 0.7
  };

  const FMT_UNITS = {
    area_ha: value => fmt.ha(value),
    areaHa: value => fmt.ha(value),
    area_km2: value => fmt.km(value),
    length_km: value => fmt.km(value),
    lengthKm: value => fmt.km(value),
    count: value => fmt.int(value),
    total: value => fmt.int(value),
    percentual: value => fmt.pct(value),
    percent: value => fmt.pct(value)
  };

  function formatMetric(key, value) {
    const fn = FMT_UNITS[key];
    if (fn) return fn(value);
    if (Number.isFinite(value)) return fmt.int(value);
    return value == null ? '—' : String(value);
  }

  function normaliseText(value) {
    if (!value) return '';
    return String(value)
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  }

  function normaliseCode(value) {
    if (!value) return '';
    return String(value).trim().padStart(4, '0').replace(/^0+/, '');
  }

  function trimString(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function findField(sample, candidates) {
    if (!sample) return null;
    for (const candidate of candidates) {
      if (candidate in sample) return candidate;
    }
    return null;
  }

  const MANANCIAL_FIELD_CANDIDATES = ['Manancial', 'Nome', 'MANANCIAL', 'manancial', 'nome', 'NomeMananc'];
  const NAME_FIELD_CANDIDATES = ['Nome', 'nome', 'Name', 'NOME', 'nm_micro'];
  const REGION_FIELD_CANDIDATES = ['Regional', 'regional', 'REGIONAL', 'Região', 'REGIAO', 'nm_reg'];
  const MUNICIPALITY_FIELD_CANDIDATES = [
    'Municipio',
    'municipio',
    'MUNICIPIO',
    'Município',
    'MUNICÍPIO',
    'Cidade',
    'cidade',
    'CIDADE',
    'nm_mun'
  ];
  const CODE_FIELD_CANDIDATES = ['Cod_micro', 'cod_micro', 'COD_MICRO', 'Cod_man', 'cod_man', 'COD_MAN', 'CD_MICRO'];
  const ORIGIN_FIELD_CANDIDATES = ['origem', 'Origem', 'ORIGEM'];

  const DEFAULT_POPUP_FIELDS = [
    { key: 'Nome', label: 'Nome', formatter: value => value || '—' },
    { key: 'Municipio', label: 'Município', formatter: value => value || '—' },
    { key: 'Regional', label: 'Regional', formatter: value => value || '—' },
    { key: 'Area_ha', label: 'Área (ha)', formatter: value => fmt.ha(value) },
    { key: 'Area_km2', label: 'Área (km²)', formatter: value => fmt.km(value) },
    { key: 'Length_km', label: 'Comprimento (km)', formatter: value => fmt.km(value) }
  ];

  function derivePopupFields(properties) {
    if (!properties) return DEFAULT_POPUP_FIELDS;
    const fields = [];
    const keys = Object.keys(properties);
    const preferredOrder = [
      'nome',
      'Nome',
      'Nome_BAC',
      'Municipio',
      'Municipio_nome',
      'Regional',
      'Area_ha',
      'Area_km2',
      'Area_ha_m',
      'Length_km',
      'Area_ha',
      'LengthKm',
      'Total'
    ];
    const normalisedKeys = new Map();
    keys.forEach(key => {
      normalisedKeys.set(normaliseText(key), key);
    });
    preferredOrder.forEach(prefKey => {
      const realKey = normalisedKeys.get(normaliseText(prefKey));
      if (!realKey) return;
      const value = properties[realKey];
      if (value == null || value === '') return;
      fields.push({
        key: realKey,
        label: realKey.replace(/_/g, ' '),
        formatter: val => (Number.isFinite(val) ? formatMetric(realKey, val) : val)
      });
    });
    keys
      .filter(key => !fields.some(field => field.key === key))
      .forEach(key => {
        const value = properties[key];
        if (value == null || value === '') return;
        fields.push({
          key,
          label: key.replace(/_/g, ' '),
          formatter: val => (Number.isFinite(val) ? formatMetric(key, val) : val)
        });
      });
    if (!fields.length) return DEFAULT_POPUP_FIELDS;
    return fields.slice(0, 10);
  }

  const map = L.map('map', {
    zoomControl: false,
    minZoom: 5,
    maxZoom: 18
  });

  const baseLayers = {
    'Mapbox Light': L.tileLayer(
      'https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoiZGVtb3VzZXIiLCJhIjoiY2tzb3E5MGUwMGZ6djJucWNqY3NrbWRoMSJ9.vv8vZr2tLDlW1wBjxfsqZw',
      {
        tileSize: 512,
        zoomOffset: -1,
        maxZoom: 20,
        attribution:
          '© <a href="https://www.mapbox.com/">Mapbox</a> © <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
      }
    ),
    'Mapbox Satellite': L.tileLayer(
      'https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoiZGVtb3VzZXIiLCJhIjoiY2tzb3E5MGUwMGZ6djJucWNqY3NrbWRoMSJ9.vv8vZr2tLDlW1wBjxfsqZw',
      {
        tileSize: 512,
        zoomOffset: -1,
        maxZoom: 20,
        attribution:
          '© <a href="https://www.mapbox.com/">Mapbox</a> © <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
      }
    )
  };

  const layerControl = L.control.layers(baseLayers, null, { collapsed: true }).addTo(map);
  baseLayers['Mapbox Light'].addTo(map);

  L.control.zoom({ position: 'topleft' }).addTo(map);

  const legendControl = L.control({ position: 'bottomleft' });
  legendControl.onAdd = () => {
    const div = L.DomUtil.create('div', 'legend-dock');
    return div;
  };
  legendControl.addTo(map);

  const summaryControl = L.control({ position: 'bottomleft' });
  summaryControl.onAdd = () => {
    const div = L.DomUtil.create('div', 'summary-panel');
    div.innerHTML =
      '<h3>Visão geral</h3><div class="summary-note">Ative camadas para ver métricas agregadas.</div><table class="summary-table"><tbody><tr><td class="muted-cell">Área (ha)</td><td>—</td></tr><tr><td class="muted-cell">Comprimento (km)</td><td>—</td></tr><tr><td class="muted-cell">Itens</td><td>—</td></tr></tbody></table>';
    return div;
  };
  summaryControl.addTo(map);

  const microState = {
    container: null,
    records: [],
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
      const props = feature?.properties || {};
      const value = props.ALT_CLASS || props.Alt_Class || props.alt_class || props.alt_classif;
      return {
        color: '#4b5563',
        weight: 0.3,
        fillColor: altColorFor(value),
        fillOpacity: 0.6 * currentOpacity,
        opacity: currentOpacity
      };
    }
    if (key === 'uso_solo') {
      const props = feature?.properties || {};
      const value = props.Classe || props.classe || props.Class || props.CLASS;
      return {
        color: '#111827',
        weight: 0.25,
        fillColor: usoColorFor(value),
        fillOpacity: 0.7 * currentOpacity,
        opacity: currentOpacity
      };
    }
    if (key === 'microbacias') {
      return {
        color: '#2563eb',
        weight: 0.8,
        fillColor: '#93c5fd',
        fillOpacity: 0.3 * currentOpacity,
        opacity: currentOpacity
      };
    }
    if (key === 'caf') {
      return {
        color: '#4ade80',
        weight: 1,
        fillColor: '#bbf7d0',
        fillOpacity: 0.35 * currentOpacity,
        opacity: currentOpacity
      };
    }
    return {
      color: '#2563eb',
      weight: 1,
      fillColor: '#bfdbfe',
      fillOpacity: 0.3 * currentOpacity,
      opacity: currentOpacity
    };
  }

  function applyStyleToEntry(entry) {
    if (!entry.layer) return;
    const { def } = entry;
    if (def.pointToLayer) {
      entry.layer.eachLayer(layer => {
        const style = def.pointToLayer(layer.feature, L.latLng(layer.getLatLng()));
        if (style) layer.setStyle(style);
      });
    } else {
      entry.layer.setStyle(feature => def.style ? def.style(feature, entry) : styleForFeature(def.key, feature));
    }
  }

  function applyFilterToEntry(entry, selection) {
    if (!entry.layer) return;
    const { def } = entry;
    const filtered = [];
    entry.layer.clearLayers();
    entry.features.forEach(feature => {
      if (selection && entry.codeField) {
        const code = normaliseCode(feature?.properties?.[entry.codeField]);
        if (!selection.has(code)) return;
      }
      filtered.push(feature);
      if (def.pointToLayer) {
        entry.layer.addLayer(def.pointToLayer(feature, entry));
      } else {
        entry.layer.addData(feature);
      }
    });
    entry.filteredFeatures = filtered;
    updateMetricsForEntry(entry);
    applyStyleToEntry(entry);
  }

  function updateMetricsForEntry(entry) {
    const totals = { areaHa: 0, lengthKm: 0, count: 0 };
    const metricsByCode = new Map();
    const { def, filteredFeatures } = entry;
    filteredFeatures.forEach(feature => {
      const props = feature?.properties || {};
      const area = Number(props.area_ha || props.Area_ha || props.areaHa || props.AreaHa || props.Area_km2 * 100);
      const length =
        Number(props.length_km || props.Length_km || props.lengthKm || props.LengthKm || props.Perimeter_km);
      const code = entry.codeField ? normaliseCode(props[entry.codeField]) : null;
      if (Number.isFinite(area)) totals.areaHa += area;
      if (Number.isFinite(length)) totals.lengthKm += length;
      totals.count += 1;
      if (code) {
        if (!metricsByCode.has(code)) metricsByCode.set(code, { areaHa: 0, lengthKm: 0, count: 0 });
        const metrics = metricsByCode.get(code);
        if (Number.isFinite(area)) metrics.areaHa += area;
        if (Number.isFinite(length)) metrics.lengthKm += length;
        metrics.count += 1;
      }
    });
    entry.filteredMetrics = totals;
    entry.metricsByCode = metricsByCode;
  }

  function createLegendList(title, items, totals, note) {
    const list = L.DomUtil.create('div', 'legend');
    const header = L.DomUtil.create('div', 'legend-header', list);
    const titleEl = L.DomUtil.create('div', 'legend-title', header);
    titleEl.textContent = title;
    if (totals) {
      const totalEl = L.DomUtil.create('div', 'legend-total', header);
      const parts = [];
      if (Number.isFinite(totals.areaHa) && totals.areaHa > 0) parts.push(`Área: ${fmt.ha(totals.areaHa)} ha`);
      if (Number.isFinite(totals.lengthKm) && totals.lengthKm > 0) parts.push(`Comprimento: ${fmt.km(totals.lengthKm)} km`);
      if (Number.isFinite(totals.count)) parts.push(`Itens: ${fmt.int(totals.count)}`);
      totalEl.textContent = parts.join(' • ') || '—';
    }
    const body = L.DomUtil.create('div', 'legend-body', list);
    if (!items || !items.length) {
      body.innerHTML = '<div class="empty-state">Nenhum item visível com os filtros atuais.</div>';
    } else {
      items.forEach(item => {
        const row = L.DomUtil.create('div', 'legend-item', body);
        const sw = L.DomUtil.create('div', 'sw', row);
        sw.style.background = item.color;
        if (item.stroke) {
          sw.style.borderColor = item.stroke;
          sw.style.borderWidth = '2px';
        }
        const text = L.DomUtil.create('div', 'legend-text', row);
        const label = L.DomUtil.create('div', 'legend-label', text);
        label.textContent = item.label;
        if (item.metric) {
          const metric = L.DomUtil.create('div', 'legend-metric', text);
          metric.textContent = item.metric;
        }
      });
    }
    if (note) {
      const noteEl = L.DomUtil.create('div', 'legend-note', list);
      noteEl.textContent = note;
    }
    return list;
  }

  function updateLegendForEntry(entry) {
    removeLegend(entry.def.key);
    const { def } = entry;
    if (def.legend) {
      const list = def.legend(entry);
      if (list) appendLegend(entry.def.key, list);
      return;
    }
    const items = [];
    const { filteredMetrics } = entry;
    if (def.key === 'declividade') {
      const counts = new Map();
      entry.filteredFeatures.forEach(feature => {
        const value = entry.classExtractor ? entry.classExtractor(feature) : '';
        counts.set(value, (counts.get(value) || 0) + 1);
      });
      SLOPE_CLASSES.forEach((cls, idx) => {
        const label = SLOPE_LABELS[idx];
        const count = counts.get(cls) || 0;
        items.push({
          color: SLOPE_COLORS[idx],
          label,
          metric: `${fmt.int(count)} microbacias`
        });
      });
      appendLegend(
        def.key,
        createLegendList(
          'Declividade predominante',
          items,
          { count: entry.filteredFeatures.length },
          'Valores calculados a partir das microbacias selecionadas.'
        )
      );
      return;
    }
    if (def.key === 'altimetria') {
      const counts = new Map();
      entry.filteredFeatures.forEach(feature => {
        const props = feature?.properties || {};
        const value = props.ALT_CLASS || props.Alt_Class || props.alt_class || props.alt_classif || '';
        const color = altColorFor(value);
        const key = `${value}|${color}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      });
      items.push(
        ...Array.from(counts.entries()).map(([key, count]) => {
          const [value, color] = key.split('|');
          const match = String(value).match(/(\d+).+?(\d+)/);
          const label = match ? `${match[1]}–${match[2]} m` : value || 'Sem informação';
          return {
            color,
            label,
            metric: `${fmt.int(count)} áreas`
          };
        })
      );
      items.sort((a, b) => normaliseText(a.label).localeCompare(normaliseText(b.label), 'pt-BR'));
      appendLegend(
        def.key,
        createLegendList(
          'Altimetria',
          items,
          { count: entry.filteredFeatures.length },
          'Classes derivadas da combinação das altitudes mínima e máxima.'
        )
      );
      return;
    }
    if (def.key === 'uso_solo') {
      const counts = new Map();
      entry.filteredFeatures.forEach(feature => {
        const props = feature?.properties || {};
        const value = props.Classe || props.classe || props.Class || props.CLASS || 'Sem informação';
        counts.set(value, (counts.get(value) || 0) + 1);
      });
      counts.forEach((count, label) => {
        items.push({
          color: usoColorFor(label),
          label,
          metric: `${fmt.int(count)} áreas`
        });
      });
      items.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
      appendLegend(
        def.key,
        createLegendList(
          'Uso do solo',
          items,
          { count: entry.filteredFeatures.length },
          'Classes resultantes da interpretação das imagens.'
        )
      );
      return;
    }
    appendLegend(def.key, createLegendList(def.name, items, filteredMetrics));
  }

  function appendLegend(key, element) {
    const dock = legendControl.getContainer();
    if (!dock) return;
    element.dataset.key = key;
    dock.appendChild(element);
  }

  function removeLegend(key) {
    const dock = legendControl.getContainer();
    if (!dock) return;
    Array.from(dock.children).forEach(child => {
      if (child.dataset.key === key) dock.removeChild(child);
    });
  }

  function updateLegendsForVisible() {
    datasetStore.forEach(entry => {
      if (map.hasLayer(entry.layerGroup)) updateLegendForEntry(entry);
    });
  }

  function updateSummary() {
    const container = summaryControl.getContainer();
    if (!container) return;
    const totals = { areaHa: 0, lengthKm: 0, count: 0 };
    datasetStore.forEach(entry => {
      if (!map.hasLayer(entry.layerGroup)) return;
      totals.areaHa += entry.filteredMetrics.areaHa;
      totals.lengthKm += entry.filteredMetrics.lengthKm;
      totals.count += entry.filteredMetrics.count;
    });
    const rows = [
      ['Área (ha)', fmt.ha(totals.areaHa)],
      ['Comprimento (km)', fmt.km(totals.lengthKm)],
      ['Itens', fmt.int(totals.count)]
    ]
      .map(([label, value]) => `<tr><td class="muted-cell">${label}</td><td>${value}</td></tr>`)
      .join('');
    container.innerHTML = `<h3>Visão geral</h3><div class="summary-note">Resultados considerando as camadas ativas e os filtros aplicados.</div><table class="summary-table"><tbody>${rows}</tbody></table>`;
  }

  const fetchTimeouts = new Map();

  async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), options.timeout || 30000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (!response.ok) throw new Error(`Falha ao carregar ${url}: ${response.status} ${response.statusText}`);
      return response;
    } finally {
      clearTimeout(id);
    }
  }

  async function loadDataset(entry) {
    if (!entry || entry.loading) return entry?.loading;
    const url = new URL(entry.def.path, DATA_BASE_URL);
    const cacheKey = url.href;
    if (fetchCache.has(cacheKey)) {
      entry.loading = fetchCache.get(cacheKey);
      return entry.loading;
    }
    const promise = (async () => {
      const response = await fetchWithTimeout(url, { timeout: 60000 });
      const buffer = await response.arrayBuffer();
      let data;
      if (entry.def.compressed) {
        data = JSON.parse(new TextDecoder().decode(pako.inflate(new Uint8Array(buffer))));
      } else {
        data = JSON.parse(new TextDecoder().decode(buffer));
      }
      entry.features = data.features || [];
      if (!entry.layer) {
        if (entry.def.pointToLayer) {
          entry.layer = L.geoJSON(undefined, { pointToLayer: (feature, latlng) => entry.def.pointToLayer(feature, latlng, entry) });
        } else {
          entry.layer = L.geoJSON(undefined, {
            style: feature => (entry.def.style ? entry.def.style(feature, entry) : styleForFeature(entry.def.key, feature)),
            onEachFeature: (feature, layer) => {
              if (!feature?.properties) return;
              const fields = entry.def.popupFields ? entry.def.popupFields(feature.properties) : derivePopupFields(feature.properties);
              const rows = fields
                .map(field => {
                  const value = field.formatter ? field.formatter(feature.properties[field.key], feature, entry) : feature.properties[field.key];
                  return `<tr><th>${field.label}</th><td>${value == null || value === '' ? '—' : value}</td></tr>`;
                })
                .join('');
              layer.bindPopup(
                `<div class="popup"><div class="popup-title">${feature.properties.nome || feature.properties.Nome || 'Detalhes'}</div><table class="popup-table">${rows}</table></div>`
              );
            }
          });
        }
      }
      entry.layerGroup.addLayer(entry.layer);
      entry.layerGroup.datasetKey = entry.def.key;
      applyFilterToEntry(entry, currentSelection);
      if (entry.def.setup) entry.def.setup(entry);
      return entry;
    })();
    entry.loading = promise;
    fetchCache.set(cacheKey, promise);
    entry.loading.finally(() => {
      fetchCache.delete(cacheKey);
      entry.loading = null;
    });
    return promise;
  }

  async function ensureLayerReady(entry) {
    if (!entry) return;
    if (!entry.features) await loadDataset(entry);
    if (entry.layer && entry.layer.getLayers().length === 0 && entry.features?.length) {
      applyFilterToEntry(entry, currentSelection);
    }
  }

  function buildMicroRecords(microEntry, cafEntry) {
    if (!microEntry?.features?.length) return;
    const sample = microEntry.features.find(f => f?.properties)?.properties || {};
    const codeField = findField(sample, CODE_FIELD_CANDIDATES) || 'cod_micro';
    microEntry.codeField = codeField;

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
