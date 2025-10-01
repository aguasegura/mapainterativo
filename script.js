(() => {
  'use strict';

  const turf = window.turf;
  const pako = window.pako;

  const STORAGE_KEY = 'aguasegura:last-region';
  const params = new URLSearchParams(window.location.search);
  let selectedRegion = params.get('region');

  if (!selectedRegion) {
    const stored = window.localStorage?.getItem(STORAGE_KEY);
    if (stored) {
      const target = new URL(window.location.href);
      target.searchParams.set('region', stored);
      window.location.replace(target.toString());
      return;
    }
    window.location.replace('index.html');
    return;
  }

  selectedRegion = selectedRegion.trim();
  window.localStorage?.setItem(STORAGE_KEY, selectedRegion);

  const normalizedRegion = selectedRegion.toLowerCase();

  const FILTER_FIELDS = {
    region: 'Regional I',
    municipality: 'Municipio',
    manancial: 'Manancial'
  };

  const DEFAULT_CATEGORY_COLORS = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b',
    '#e377c2', '#7f7f7f', '#bcbd22', '#17becf', '#3182bd', '#31a354',
    '#e6550d', '#636363', '#bdbdbd', '#393b79', '#637939', '#8c6d31',
    '#843c39', '#7b4173'
  ];

  const SLOPE_CLASSES = ['000a003', '003a008', '008a015', '015a025', '025a045', '045a100', '>100'];
  const SLOPE_COLORS = ['#f7fcfd', '#ccece6', '#66c2a4', '#41ae76', '#238b45', '#006d2c', '#00441b'];
  const SLOPE_PALETTE = Object.fromEntries(SLOPE_CLASSES.map((cls, idx) => [cls, SLOPE_COLORS[idx] || '#444444']));

  const ALTIMETRY_CLASSES = [
    '0 a 100 m',
    '100 a 200 m',
    '200 a 300 m',
    '300a 400 m',
    '400 a 500 m',
    '500 a 600 m',
    '600 a 700 m',
    '700 a 800 m',
    '800 a 900 m',
    '900 a 1000 m',
    '1000 a 1100 m',
    '1100 a 1200 m',
    '1200 a 1300 m',
    '1300 a 1400 m'
  ];
  const ALTIMETRY_COLORS = [
    '#1d4f91',
    '#2763a5',
    '#2f79b3',
    '#3b90b7',
    '#4aa7b3',
    '#66bfa8',
    '#85d090',
    '#a9dd7f',
    '#cde87a',
    '#e8f07c',
    '#f6d776',
    '#f3b555',
    '#ed8a3b',
    '#e85c28'
  ];
  const ALTIMETRY_PALETTE = Object.fromEntries(
    ALTIMETRY_CLASSES.map((cls, idx) => [cls, ALTIMETRY_COLORS[idx] || '#6b7280'])
  );

  const SOIL_COLORS = {
    'AFLORAMENTOS DE ROCHAS': '#593411',
    'ARGISSOLOS': '#bc7434',
    'CAMBISSOLOS': '#d89c63',
    'ESPELHOS DAGUA': '#4f9ed9',
    'ESPODOSSOLOS': '#6db5a6',
    'GLEISSOLOS': '#2b7da0',
    'LATOSSOLOS': '#f4d6a0',
    'NEOSSOLOS LITÓLICOS': '#8d5035',
    'NEOSSOLOS REGOLÍTICOS': '#c1784c',
    'NITOSSOLOS': '#f8b26a',
    'ORGANOSSOLOS': '#1f8b4d',
    'ÁREAS URBANAS': '#9f3a38'
  };

  const USO_COLORS = {
    'Agricultura Anual': '#f6d55c',
    'Agricultura Perene': '#ed9c44',
    'Área Construída': '#b13f3c',
    'Área Urbanizada': '#e34a33',
    'Corpos d’Água': '#4c78a8',
    "Corpos d'Água": '#4c78a8',
    'Floresta Nativa': '#1a7f3b',
    'Mangue': '#3b9d5d',
    'Pastagem/Campo': '#a3d47c',
    'Plantios Florestais': '#175c3c',
    'Solo Exposto/Mineração': '#f0b67f',
    'Várzea': '#7fc6bc'
  };
  const DATASET_CONFIG = [
    {
      id: 'bacias',
      name: 'Bacias Selecionadas',
      files: ['baciasselecionadas.geojson'],
      geom: 'polygon',
      defaultVisible: true,
      classField: 'Classe',
      autoPalette: true,
      visualHints: 'Use os filtros para focar em um município ou manancial específico.'
    },
    {
      id: 'altimetria',
      name: 'Altimetria',
      files: ['altimetria__altimetria_otto.geojson_part-001.gz'],
      geom: 'polygon',
      classField: 'ClAlt',
      palette: ALTIMETRY_PALETTE,
      visualHints: 'Caso a leitura fique confusa, combine com o mapa base "ESRI Topográfico" e ajuste a opacidade.'
    },
    {
      id: 'declividade',
      name: 'Declividade (classes)',
      files: [
        'declividade__declividade_otto.geojson_part-001.gz',
        'declividade__declividade_otto.geojson_part-002.gz'
      ],
      geom: 'polygon',
      classField: 'ClDec',
      palette: SLOPE_PALETTE,
      visualHints: 'Camada detalhada; reduza a opacidade ou utilize a alternativa de altimetria para visão geral.'
    },
    {
      id: 'solos',
      name: 'Solos',
      files: ['solos__solos_otto.geojson_part-001.gz'],
      geom: 'polygon',
      classField: 'Cl_solos',
      palette: SOIL_COLORS
    },
    {
      id: 'uso_solo',
      name: 'Uso do Solo',
      files: [
        'uso_solo__usodosolo_otto.geojson_part-001.gz',
        'uso_solo__usodosolo_otto.geojson_part-002.gz',
        'uso_solo__usodosolo_otto.geojson_part-003.gz',
        'uso_solo__usodosolo_otto.geojson_part-004.gz'
      ],
      geom: 'polygon',
      classField: 'NIVEL_II',
      palette: USO_COLORS,
      visualHints: 'Para áreas extensas utilize esta camada em conjunto com "Bacias Selecionadas" para destacar prioridades.'
    },
    {
      id: 'uso_app',
      name: 'Uso do Solo em APP',
      files: ['conflitosdeuso__uso_solo_em_app.geojson_part-001.gz'],
      geom: 'polygon',
      visualHints: 'Ative junto com "Nascentes" para identificar conflitos próximos às áreas protegidas.'
    },
    {
      id: 'car',
      name: 'Cadastro Ambiental Rural (CAR)',
      files: ['car.geojson_part-001.gz'],
      geom: 'polygon',
      visualHints: 'Camada com geometrias complexas; aproxime para evitar sobreposições excessivas.'
    },
    {
      id: 'construcoes',
      name: 'Construções',
      files: [
        'construcoes__construcoes_otto.geojson_part-001.gz',
        'construcoes__construcoes_otto.geojson_part-002.gz',
        'construcoes__construcoes_otto.geojson_part-003.gz'
      ],
      geom: 'polygon',
      minZoom: 12,
      visualHints: 'Muito densa. Aproxime (zoom ≥ 12) ou utilize "Uso do Solo" como alternativa para visão macro.'
    },
    {
      id: 'curvasdenivel',
      name: 'Curvas de Nível',
      files: [
        'curvasdenivel__curvas_otto.geojson_part-001.gz',
        'curvasdenivel__curvas_otto.geojson_part-002.gz',
        'curvasdenivel__curvas_otto.geojson_part-003.gz',
        'curvasdenivel__curvas_otto.geojson_part-004.gz'
      ],
      geom: 'line',
      metric: 'length',
      visualHints: 'Para melhor contraste utilize o mapa base "ESRI Topográfico".'
    },
    {
      id: 'hidrografia',
      name: 'Hidrografia',
      files: ['hidrografia__hidrografia_otto.geojson_part-001.gz'],
      geom: 'line',
      metric: 'length',
      visualHints: 'Combine com "Nascentes" ou "Uso do Solo em APP" para identificar áreas críticas.'

    },
    {
      id: 'estradas',
      name: 'Infraestrutura Viária',
      files: ['estradas__estradas_otto.geojson_part-001.gz'],
      geom: 'line',
      metric: 'length'
    },

    { id: 'nascentes', name: 'Nascentes', files: ['nascentes__nascentes_otto.geojson_part-001.gz'], geom: 'point', metric: 'count' },
    { id: 'aves', name: 'Aves', files: ['aves__aves.geojson_part-001.gz'], geom: 'point', metric: 'count' },
    { id: 'bovinos', name: 'Bovinos', files: ['bovinos__bovinos.geojson_part-001.gz'], geom: 'point', metric: 'count' },
    { id: 'bubalinos', name: 'Bubalinos', files: ['bubalinos__bubalinos.geojson_part-001.gz'], geom: 'point', metric: 'count' },
    { id: 'caf', name: 'CAF', files: ['caf.geojson_part-001.gz'], geom: 'point', metric: 'count' },
    { id: 'educacao', name: 'Educação Ambiental', files: ['educacao__educacao_otto.geojson_part-001.gz'], geom: 'point', metric: 'count' },
    { id: 'sigarh', name: 'SIGARH', files: ['sigarh.geojson_part-001.gz'], geom: 'point', metric: 'count' },
    { id: 'suinos', name: 'Suínos', files: ['suinos__suinos.geojson_part-001.gz'], geom: 'point', metric: 'count' }
  ];

  const state = {
    selectedRegion,
    normalizedRegion,
    map: null,
    opacity: 0.7,
    layerStore: new Map(),
    orderedEntries: [],
    legendEl: null,
    hintsEl: null,
    filter: {
      region: selectedRegion,
      municipality: '',
      manancial: ''
    }
  };

  const LAYER_STYLE_OVERRIDES = {
    car(style, entry) {
      return {
        ...style,
        color: '#0f3d1f',
        weight: 1.4,
        fillColor: '#2bb24c',
        fillOpacity: (entry.geom === 'polygon' ? 0.55 : style.fillOpacity || 0) * state.opacity,
        opacity: 0.95 * state.opacity
      };
    },
    uso_app(style, entry) {
      const baseFillOpacity = entry.geom === 'polygon' ? 0.6 : style.fillOpacity || 0;
      return {
        ...style,
        color: '#641919',
        weight: 1.1,
        fillColor: '#b91c1c',
        fillOpacity: baseFillOpacity * state.opacity,
        opacity: 0.85 * state.opacity
      };
    },
    hidrografia(style) {
      return {
        ...style,
        color: '#2b8cbe',
        weight: 2,
        opacity: 0.9 * state.opacity
      };
    },
    estradas(style) {
      return {
        ...style,
        color: '#d1495b',
        weight: 1.6,
        opacity: 0.85 * state.opacity
      };
    }
  };

  document.title = `Programa Água Segura — ${selectedRegion}`;

  const regionPill = document.getElementById('regionPill');
  if (regionPill) {
    regionPill.textContent = selectedRegion;
  }

  function normalizeText(value) {
    return `${value ?? ''}`.trim().toLowerCase();
  }

  async function fetchGeoJSON(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erro ao carregar ${url}: ${response.status}`);
    }
    if (url.endsWith('.gz')) {
      const buffer = await response.arrayBuffer();
      const text = pako.ungzip(new Uint8Array(buffer), { to: 'string' });
      return JSON.parse(text);
    }
    return await response.json();
  }

  async function loadGeoJSON(input) {
    const files = Array.isArray(input) ? input : [input];
    if (!files.length) {
      return { type: 'FeatureCollection', features: [] };
    }

    const collections = await Promise.all(
      files.map(async file => {
        const url = `data/${file}`;
        return fetchGeoJSON(url);
      })
    );

    if (collections.length === 1) {
      return collections[0];
    }

    const merged = { ...collections[0], features: [] };
    merged.features = collections.flatMap(fc => (Array.isArray(fc.features) ? fc.features : []));
    return merged;
  }

  function geometryTypeFromFeature(feature) {
    if (!feature) return null;
    const geometry = feature.geometry;
    if (!geometry) return null;
    if (geometry.type === 'GeometryCollection') {
      for (const inner of geometry.geometries || []) {
        const resolved = geometryTypeFromFeature({ geometry: inner });
        if (resolved) return resolved;
      }
      return null;
    }
    return geometry.type || null;
  }

  function inferGeometryKind(collection) {
    const features = collection?.features;
    if (!Array.isArray(features) || !features.length) {
      return 'polygon';
    }
    for (const feature of features) {
      const type = geometryTypeFromFeature(feature);
      if (!type) continue;
      if (type.includes('Polygon')) return 'polygon';
      if (type.includes('Line')) return 'line';
      if (type.includes('Point')) return 'point';
    }
    return 'polygon';
  }

  function metricFromGeometry(kind) {
    if (kind === 'line') return 'length';
    if (kind === 'point') return 'count';
    return 'area';
  }

  function hasFilterAttributes(feature) {
    if (!feature || !feature.properties) return false;
    const props = feature.properties;
    return (
      FILTER_FIELDS.region in props ||
      FILTER_FIELDS.municipality in props ||
      FILTER_FIELDS.manancial in props
    );
  }

  function normalizePalette(palette) {
    if (!palette) return null;
    const normalized = {};
    Object.entries(palette).forEach(([key, value]) => {
      if (!value) return;
      const trimmed = typeof key === 'string' ? key.trim() : key;
      normalized[trimmed] = value;
      if (typeof trimmed === 'string') {
        normalized[trimmed.toUpperCase()] = value;
      }
    });
    return normalized;
  }

  function buildAutoPalette(values) {
    const palette = {};
    values.forEach((value, index) => {
      const key = typeof value === 'string' ? value.trim() : value;
      const color = DEFAULT_CATEGORY_COLORS[index % DEFAULT_CATEGORY_COLORS.length];
      palette[key] = color;
      if (typeof key === 'string') {
        palette[key.toUpperCase()] = color;
      }
    });
    return palette;
  }

  function styleForEntry(entry, properties = {}) {
    const geom = entry.geom || 'polygon';
    const style = geom === 'line'
      ? { color: '#1f78b4', weight: 1.5, opacity: 0.8 * state.opacity }
      : geom === 'point'
        ? { radius: 6, color: '#222', weight: 1, fillColor: '#e31a1c', fillOpacity: 0.85 * state.opacity, opacity: 1 }
        : { color: '#1f78b4', weight: 1, fillColor: '#1f78b4', fillOpacity: 0.4 * state.opacity, opacity: 0.8 * state.opacity };

    if (entry.id === 'bacias' && geom === 'polygon') {
      style.color = '#0f172a';
      style.weight = 2.5;
      style.fillOpacity = 0.3 * state.opacity;
      style.opacity = 0.95;
    }

    if (entry.classField && entry.palette) {
      const raw = properties[entry.classField];
      if (raw !== undefined && raw !== null) {
        const key = typeof raw === 'string' ? raw.trim() : raw;
        const paletteColor = entry.palette[key] || (typeof key === 'string' ? entry.palette[key.toUpperCase()] : undefined);
        if (paletteColor) {
          if (geom === 'point') {
            style.fillColor = paletteColor;
            style.color = '#202020';
          } else {
            style.fillColor = paletteColor;
            style.color = entry.id === 'bacias' ? '#0f172a' : '#333333';
          }
        }
      }
    }

    const override = LAYER_STYLE_OVERRIDES[entry.id];
    if (typeof override === 'function') {
      return override(style, entry, properties);
    }

    return style;
  }

  function refreshLayerStyles() {
    state.orderedEntries.forEach(entry => {
      if (!entry.layer || !entry.loaded) return;
      entry.layer.eachLayer(featureLayer => {
        if (!featureLayer || !featureLayer.feature) return;
        const style = styleForEntry(entry, featureLayer.feature.properties || {});
        if (typeof featureLayer.setStyle === 'function') {
          featureLayer.setStyle(style);
        }
        if (typeof featureLayer.setRadius === 'function' && style.radius !== undefined) {
          featureLayer.setRadius(style.radius);
        }
      });
    });
  }

  function shouldRenderEntry(entry) {
    if (!entry || !entry.layer) return false;
    if (!state.map) return true;
    if (entry.minZoom !== undefined) {
      return state.map.getZoom() >= entry.minZoom;
    }
    return true;
  }

  function syncEntryLayer(entry, { force = false } = {}) {
    if (!entry || !entry.layer) return;
    const canRender = shouldRenderEntry(entry);
    if (!canRender) {
      if (entry.zoomVisible || force) {
        entry.layer.clearLayers();
        entry.zoomVisible = false;
      }
      return;
    }

    if (!entry.zoomVisible || force) {
      entry.layer.clearLayers();
      if (entry.currentFeatures && entry.currentFeatures.length) {
        entry.layer.addData({ type: 'FeatureCollection', features: entry.currentFeatures });
      }
      entry.zoomVisible = true;
    }
  }

  function enforceZoomVisibility() {
    state.orderedEntries.forEach(entry => {
      if (!entry.loaded || entry.minZoom === undefined) return;
      syncEntryLayer(entry);
    });
    refreshLayerStyles();
  }

  function formatNumber(value, digits = 2) {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(value);
  }

  function formatMetric(total, metric) {
    if (metric === 'area') {
      return `${formatNumber(total / 10000)} ha`;
    }
    if (metric === 'length') {
      return `${formatNumber(total)} km`;
    }
    return new Intl.NumberFormat('pt-BR').format(total);
  }

  function colorForClass(entry, value) {
    if (!entry || !entry.palette) return null;
    const key = typeof value === 'string' ? value.trim() : value;
    return entry.palette[key] || (typeof key === 'string' ? entry.palette[key.toUpperCase()] : null);
  }

  function aggregateMetrics(entry, features) {
    let total = 0;
    const breakdown = new Map();

    features.forEach(feature => {
      let value = 0;
      try {
        if (entry.metric === 'area') {
          value = turf.area(feature);
        } else if (entry.metric === 'length') {
          value = turf.length(feature, { units: 'kilometers' });
        } else {
          value = 1;
        }
      } catch (error) {
        console.error('Erro ao calcular métrica da legenda', error);
        value = 0;
      }

      total += entry.metric === 'count' ? 1 : value;

      if (entry.classField) {
        const rawClass = feature.properties?.[entry.classField];
        const hasValue = rawClass !== undefined && rawClass !== null && `${rawClass}`.trim() !== '';
        const classKey = hasValue ? `${rawClass}`.trim() : 'Sem classificação';
        const previous = breakdown.get(classKey) || 0;
        breakdown.set(classKey, previous + (entry.metric === 'count' ? 1 : value));
      }
    });

    return { total, breakdown };
  }

  function updateLegend() {
    if (!state.legendEl || !state.map) return;
    const rows = [];
    state.orderedEntries.forEach(entry => {
      const layer = entry.layer;
      if (!layer || !entry.loaded || !state.map.hasLayer(layer)) return;

      const block = ['<div class="legend-block">'];


      const features = entry.currentFeatures || [];

      if (!shouldRenderEntry(entry)) {
        block.push(`<h4>${entry.name}</h4>`);
        if (entry.minZoom !== undefined) {
          block.push(`<div class="legend-note">Aproxime o mapa (zoom ≥ ${entry.minZoom}) para visualizar os dados.</div>`);
        }
        block.push('</div>');
        rows.push(block.join(''));
        return;
      }

      if (!features.length) {
        block.push(`<h4>${entry.name}</h4>`);
        block.push('<div class="legend-note">Sem registros para o filtro aplicado.</div>');
        block.push('</div>');
        rows.push(block.join(''));
        return;
      }

      const { total, breakdown } = aggregateMetrics(entry, features);
      block.push(`<div class="legend-header"><h4>${entry.name}</h4><span class="legend-total">Total: ${formatMetric(total, entry.metric)}</span></div>`);

      if (breakdown.size) {
        const items = Array.from(breakdown.entries()).sort((a, b) => b[1] - a[1]);
        block.push('<ul class="legend-list">');
        items.forEach(([className, value]) => {
          if (value === 0) return;
          const color = colorForClass(entry, className) || '#d1d5db';
          const swatchClass = entry.geom === 'line' ? 'legend-swatch line' : 'legend-swatch';
          const styleAttr = color
            ? entry.geom === 'line'
              ? `style="background:${color}; border-color:${color};"`
              : `style="background:${color};"`
            : '';
          block.push(`<li class="legend-item"><span class="${swatchClass}" ${styleAttr}></span><span class="legend-label">${className}</span><span class="legend-value">${formatMetric(value, entry.metric)}</span></li>`);
        });
        block.push('</ul>');
      }

      block.push('</div>');
      rows.push(block.join(''));
    });
    state.legendEl.innerHTML = rows.join('') || '<div class="legend-empty">Nenhuma camada ativa</div>';
    updateLayerHints();
  }

  function updateLayerHints() {
    if (!state.hintsEl) return;
    const rows = [];
    state.orderedEntries.forEach(entry => {
      const layer = entry.layer;
      if (!layer || !entry.loaded || !state.map || !state.map.hasLayer(layer)) return;
      const notes = [];
      if (!shouldRenderEntry(entry) && entry.minZoom !== undefined) {
        notes.push(`Aproxime o mapa (zoom ≥ ${entry.minZoom}) para renderizar os dados.`);
      }
      if (entry.visualHints) {
        notes.push(entry.visualHints);
      }
      if (notes.length) {
        rows.push(`<div><b>${entry.name}</b><ul>${notes.map(note => `<li>${note}</li>`).join('')}</ul></div>`);
      }
    });


    state.hintsEl.innerHTML = rows.length ? `<h4>Dicas de visualização</h4>${rows.join('')}` : '';
  }

  function passesFilter(properties) {
    if (!properties) return true;
    if (state.filter.region && normalizeText(properties[FILTER_FIELDS.region]) !== state.normalizedRegion) return false;
    if (state.filter.municipality && properties[FILTER_FIELDS.municipality] !== state.filter.municipality) return false;
    if (state.filter.manancial && properties[FILTER_FIELDS.manancial] !== state.filter.manancial) return false;
    return true;
  }

  function fitMapToFeatures(features) {
    if (!state.map || !Array.isArray(features) || !features.length) return;
    try {
      const bbox = turf.bbox({ type: 'FeatureCollection', features });
      const bounds = L.latLngBounds(
        [bbox[1], bbox[0]],
        [bbox[3], bbox[2]]
      );
      if (bounds.isValid()) {
        state.map.fitBounds(bounds, { padding: [24, 24] });
      }
    } catch (error) {
      console.error('Erro ao ajustar o zoom para o filtro', error);
    }
  }

  function fitToFilteredSelection() {
    const baciasEntry = state.layerStore.get('bacias');
    if (!baciasEntry || !baciasEntry.currentFeatures?.length) return;
    fitMapToFeatures(baciasEntry.currentFeatures);
  }

  function applyFilter({ fit = false } = {}) {
    state.orderedEntries.forEach(entry => {
      if (!entry.loaded) return;
      if (!entry.filterable) {
        entry.currentFeatures = entry.originalFeatures;
        syncEntryLayer(entry, { force: true });
        return;
      }
      const filtered = entry.originalFeatures.filter(feature => passesFilter(feature.properties));
      entry.currentFeatures = filtered;
      syncEntryLayer(entry, { force: true });
    });
    refreshLayerStyles();
    updateLegend();

    if (fit) {
      fitToFilteredSelection();
    }
  }

  function populateSelect(selectEl, values, placeholder) {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    const firstOption = document.createElement('option');
    firstOption.value = '';
    firstOption.textContent = placeholder;
    selectEl.appendChild(firstOption);
    values.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      selectEl.appendChild(option);
    });
  }

  async function setupFilters() {
    if (!state.map) return;

    const control = L.control({ position: 'topleft' });
    control.onAdd = () => {
      const container = L.DomUtil.create('div', 'leaflet-control micro-filter');
      container.innerHTML = `
        <h4>Filtro</h4>
        <select id="fReg"><option value="">— Região —</option></select>
        <select id="fMun"><option value="">— Município —</option></select>
        <select id="fMan"><option value="">— Manancial —</option></select>
        <button id="fClear" type="button">Limpar filtros</button>
      `;
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);
      return container;
    };
    control.addTo(state.map);

    const regionSelect = document.getElementById('fReg');
    const municipalitySelect = document.getElementById('fMun');
    const manancialSelect = document.getElementById('fMan');
    const clearButton = document.getElementById('fClear');

    const baciasEntry = state.layerStore.get('bacias');
    if (!baciasEntry) {
      [regionSelect, municipalitySelect, manancialSelect, clearButton].forEach(el => {
        if (el) el.disabled = true;
      });
      return;
    }

    await baciasEntry.ensureLoaded();

    const regions = Array.from(new Set(
      baciasEntry.originalFeatures
        .map(feature => feature.properties?.[FILTER_FIELDS.region])
        .filter(Boolean)
        .map(value => `${value}`.trim())
    )).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    populateSelect(regionSelect, regions, '— Região —');

    if (regionSelect) {
      regionSelect.value = selectedRegion;
      regionSelect.disabled = true;
      regionSelect.title = 'Para alterar a regional utilize o botão "Trocar regional" no topo.';
    }

    const updateMunicipalities = () => {
      const municipalities = Array.from(new Set(
        baciasEntry.originalFeatures
          .filter(feature => normalizeText(feature.properties?.[FILTER_FIELDS.region]) === state.normalizedRegion)
          .map(feature => feature.properties?.[FILTER_FIELDS.municipality])
          .filter(Boolean)
          .map(value => `${value}`.trim())
      )).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      populateSelect(municipalitySelect, municipalities, '— Município —');
      if (state.filter.municipality) {
        municipalitySelect.value = state.filter.municipality;
      }
    };

    const updateMananciais = () => {
      const mananciais = Array.from(new Set(
        baciasEntry.originalFeatures
          .filter(feature => {
            const props = feature.properties || {};
            if (normalizeText(props[FILTER_FIELDS.region]) !== state.normalizedRegion) return false;
            if (state.filter.municipality && props[FILTER_FIELDS.municipality] !== state.filter.municipality) return false;
            return true;
          })
          .map(feature => feature.properties?.[FILTER_FIELDS.manancial])
          .filter(Boolean)
          .map(value => `${value}`.trim())
      )).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      populateSelect(manancialSelect, mananciais, '— Manancial —');
      if (state.filter.manancial) {
        manancialSelect.value = state.filter.manancial;
      }
    };

    if (municipalitySelect) {
      municipalitySelect.addEventListener('change', event => {
        state.filter.municipality = event.target.value;
        state.filter.manancial = '';
        updateMananciais();
        applyFilter({ fit: true });
      });
    }

    if (manancialSelect) {
      manancialSelect.addEventListener('change', event => {
        state.filter.manancial = event.target.value;
        applyFilter({ fit: true });
      });
    }

    if (clearButton) {
      clearButton.addEventListener('click', () => {
        state.filter.municipality = '';
        state.filter.manancial = '';
        if (municipalitySelect) municipalitySelect.value = '';
        updateMananciais();
        applyFilter({ fit: true });
      });
    }

    updateMunicipalities();
    updateMananciais();
  }

  function computeVisibleBounds() {
    let bounds = null;
    state.orderedEntries.forEach(entry => {
      const layer = entry.layer;
      if (!layer || !entry.loaded || !state.map.hasLayer(layer)) return;
      const layerBounds = layer.getBounds?.();
      if (!layerBounds || !layerBounds.isValid()) return;
      if (!bounds) {
        bounds = layerBounds.clone();
      } else {
        bounds.extend(layerBounds);
      }
    });
    return bounds;
  }

  function setupFitControl() {
    const button = document.getElementById('fitAll');
    if (!button) return;
    button.addEventListener('click', () => {
      if (!state.map) return;
      const bounds = computeVisibleBounds();
      if (bounds && bounds.isValid()) {
        state.map.fitBounds(bounds, { padding: [24, 24] });
      }
    });
  }

  function setupOpacityControl() {
    const slider = document.getElementById('opacity');
    const label = document.getElementById('opacityVal');
    if (!slider) return;

    const update = () => {
      const raw = Number(slider.value);
      const percent = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 100) : 70;
      state.opacity = percent / 100;
      if (label) label.textContent = `${percent}%`;
      refreshLayerStyles();
    };

    slider.addEventListener('input', update);
    update();
  }

  function onEachFeature(feature, layer) {
    const properties = feature.properties || {};
    const html = Object.entries(properties)
      .map(([key, value]) => `<div><b>${key}</b>: ${value}</div>`)
      .join('');
    if (html) {
      layer.bindPopup(html);
    }
  }

  function createEntry(config) {
    const entry = {
      id: config.id,
      name: config.name,
      files: config.files,
      geom: config.geom || 'polygon',
      metric: config.metric || 'area',
      classField: config.classField,
      palette: normalizePalette(config.palette),
      autoPalette: config.autoPalette,
      visualHints: config.visualHints || '',
      minZoom: Number.isFinite(config.minZoom) ? Number(config.minZoom) : undefined,
      filterable: false,
      originalFeatures: [],
      currentFeatures: [],
      layer: null,
      loaded: false,
      loadingPromise: null,
      ensureLoaded: null,
      zoomVisible: true
    };

    const layer = L.geoJSON(null, {
      style: feature => styleForEntry(entry, feature.properties || {}),
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, styleForEntry(entry, feature.properties || {})),
      onEachFeature
    });

    entry.layer = layer;

    entry.ensureLoaded = async () => {
      if (entry.loaded) return;
      if (entry.loadingPromise) return entry.loadingPromise;

      entry.loadingPromise = (async () => {
        const fc = await loadGeoJSON(config.files);
        const geom = config.geom || inferGeometryKind(fc);
        entry.geom = geom;
        entry.metric = config.metric || metricFromGeometry(geom);
        const allFeatures = Array.isArray(fc.features) ? fc.features : [];
        entry.filterable = allFeatures.some(hasFilterAttributes);

        let features = allFeatures;
        if (state.normalizedRegion && entry.filterable) {
          features = allFeatures.filter(feature => normalizeText(feature?.properties?.[FILTER_FIELDS.region]) === state.normalizedRegion);
        }

        if (entry.classField) {
          const categories = Array.from(new Set(
            features
              .map(feature => feature.properties?.[entry.classField])
              .filter(value => value !== undefined && value !== null && `${value}`.trim() !== '')
              .map(value => `${value}`.trim())
          ));
          if (!entry.palette && (entry.autoPalette || categories.length)) {
            entry.palette = buildAutoPalette(categories);
          }
        }

        entry.originalFeatures = features;
        entry.currentFeatures = features;
        syncEntryLayer(entry, { force: true });
        entry.loaded = true;
      })().catch(error => {
        console.error(`Erro ao carregar a camada "${config.name}"`, error);
      }).finally(() => {
        entry.loadingPromise = null;
      });

      return entry.loadingPromise;
    };

    state.layerStore.set(entry.id, entry);
    state.orderedEntries.push(entry);
    return entry;
  }

  async function ensureLayerLoaded(entry) {
    await entry.ensureLoaded();
    if (entry.filterable) {
      applyFilter();
    } else {
      updateLegend();
    }
  }

  async function init() {
    const baseLayers = {
      'CARTO Light': L.tileLayer('https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap, &copy; CARTO'
      }),
      'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }),
      'ESRI Satélite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri'
      }),
      'ESRI Topográfico': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri'
      })
    };

    state.map = L.map('map', {
      center: [-24.5, -51],
      zoom: 7,
      preferCanvas: true,
      layers: [baseLayers['CARTO Light']]
    });

    const overlays = {};
    const defaultLoads = [];

    DATASET_CONFIG.forEach(config => {
      const entry = createEntry(config);
      overlays[entry.name] = entry.layer;
      if (config.defaultVisible) {
        entry.layer.addTo(state.map);
        defaultLoads.push(entry.ensureLoaded().then(() => {
          if (entry.filterable) {
            applyFilter();
          }
        }));
      }
    });

    L.control.layers(baseLayers, overlays, { collapsed: false }).addTo(state.map);

    state.map.on('overlayadd', event => {
      const entry = state.orderedEntries.find(candidate => candidate.layer === event.layer);
      if (!entry) return;
      ensureLayerLoaded(entry).catch(error => console.error(error));
    });

    state.map.on('zoomend', () => {
      enforceZoomVisibility();
      updateLegend();
    });

    state.map.on('overlayremove', () => {
      updateLegend();
    });

    await Promise.all(defaultLoads);

    await setupFilters();
    setupFitControl();
    setupOpacityControl();

    const legendControl = L.control({ position: 'bottomright' });
    legendControl.onAdd = () => {
      state.legendEl = L.DomUtil.create('div', 'legend-dock');
      return state.legendEl;
    };
    legendControl.addTo(state.map);

    const hintsControl = L.control({ position: 'bottomleft' });
    hintsControl.onAdd = () => {
      state.hintsEl = L.DomUtil.create('div', 'layer-hints');
      return state.hintsEl;
    };
    hintsControl.addTo(state.map);

    enforceZoomVisibility();
    updateLegend();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
