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
  const SLOPE_COLORS = ['#edf8e9', '#c7e9c0', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#0c2c84'];
  const SLOPE_PALETTE = Object.fromEntries(SLOPE_CLASSES.map((cls, idx) => [cls, SLOPE_COLORS[idx] || '#444444']));

  const USO_COLORS = {
    'Agricultura Anual': '#e6ab02',
    'Agricultura Perene': '#c98c00',
    "Corpos d'Água": '#67a9cf',
    'Floresta Nativa': '#1b9e77',
    'Pastagem/Campo': '#a6d854',
    'Plantios Florestais': '#106b21',
    'Solo Exposto/Mineração': '#bdbdbd',
    'Área Construída': '#7570b3',
    'Área Urbanizada': '#6a51a3'
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
      autoPalette: true,
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
      autoPalette: true
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
      classField: 'NIVEL_III',
      palette: USO_COLORS,
      visualHints: 'Para áreas extensas utilize esta camada em conjunto com "Bacias Selecionadas" para destacar prioridades.'
    },
    {
      id: 'uso_app',
      name: 'Uso do Solo em APP',
      files: ['conflitosdeuso__uso_solo_em_app.geojson_part-001.gz'],
      geom: 'polygon',
      classField: 'Classe',
      autoPalette: true,
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
      classField: 'Regime',
      autoPalette: true,
      visualHints: 'Combine com "Nascentes" ou "Uso do Solo em APP" para identificar áreas críticas.'
    },
    {
      id: 'estradas',
      name: 'Infraestrutura Viária',
      files: ['estradas__estradas_otto.geojson_part-001.gz'],
      geom: 'line',
      metric: 'length',
      classField: 'fclass',
      autoPalette: true
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
            style.color = '#333333';
          }
        }
      }
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

  function updateLegend() {
    if (!state.legendEl || !state.map) return;
    const rows = [];
    state.orderedEntries.forEach(entry => {
      const layer = entry.layer;
      if (!layer || !entry.loaded || !state.map.hasLayer(layer)) return;
      if (!shouldRenderEntry(entry)) {
        if (entry.minZoom !== undefined) {
          rows.push(`<div><b>${entry.name}</b>: Aproxime (zoom ≥ ${entry.minZoom})</div>`);
        }
        return;
      }
      const features = entry.currentFeatures || [];
      if (!features.length) return;
      let total = 0;
      if (entry.metric === 'area') {
        features.forEach(feature => {
          try {
            total += turf.area(feature);
          } catch (error) {
            console.error('Erro ao calcular área', error);
          }
        });
      } else if (entry.metric === 'length') {
        features.forEach(feature => {
          try {
            total += turf.length(feature, { units: 'kilometers' });
          } catch (error) {
            console.error('Erro ao calcular comprimento', error);
          }
        });
      } else {
        total = features.length;
      }
      rows.push(`<div><b>${entry.name}</b>: ${formatMetric(total, entry.metric)}</div>`);
    });
    state.legendEl.innerHTML = rows.join('') || '<i>Nenhuma camada ativa</i>';
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

  function applyFilter() {
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
        applyFilter();
      });
    }

    if (manancialSelect) {
      manancialSelect.addEventListener('change', event => {
        state.filter.manancial = event.target.value;
        applyFilter();
      });
    }

    if (clearButton) {
      clearButton.addEventListener('click', () => {
        state.filter.municipality = '';
        state.filter.manancial = '';
        if (municipalitySelect) municipalitySelect.value = '';
        updateMananciais();
        applyFilter();
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
