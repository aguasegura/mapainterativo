(function () {
  'use strict';

  const turf = window.turf || null;
  const pako = window.pako || null;

  function resolveAppBaseUrl() {
    try {
      if (typeof window === 'undefined') return './';
      if (window.__APP_BASE_URL__) return window.__APP_BASE_URL__;

      const { origin, pathname } = window.location;
      let normalizedPath = pathname || '/';

      if (normalizedPath.includes('.')) {
        const lastSlash = normalizedPath.lastIndexOf('/');
        normalizedPath = lastSlash >= 0 ? normalizedPath.slice(0, lastSlash + 1) : '/';
      } else if (!normalizedPath.endsWith('/')) {
        normalizedPath = `${normalizedPath}/`;
      }

      if (!normalizedPath.startsWith('/')) {
        normalizedPath = `/${normalizedPath}`;
      }

      const href = `${origin}${normalizedPath}`;
      window.__APP_BASE_URL__ = href;
      return href;
    } catch (error) {
      console.warn('Não foi possível determinar a URL base automaticamente.', error);
      return './';
    }
  }

  const APP_BASE_URL = resolveAppBaseUrl();
  const DATA_BASE_URL = new URL('data/', APP_BASE_URL);

  const fmt = {
    ha(value) {
      if (!Number.isFinite(value)) return '0,00';
      const abs = Math.abs(value);
      const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
      return value.toLocaleString('pt-BR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      });
    },
    km(value) {
      if (!Number.isFinite(value)) return '0,00';
      const abs = Math.abs(value);
      const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
      return value.toLocaleString('pt-BR', {
        minimumFractionDigits: digits,
@@ -245,66 +257,95 @@
      return 0;
    }
  }

  function computeLengthKm(feature) {
    if (!feature || !turf) return 0;
    try {
      const length = turf.length(feature, { units: 'kilometers' });
      return Number.isFinite(length) ? length : 0;
    } catch (error) {
      console.warn('Falha ao calcular comprimento de uma feição.', error);
      return 0;
    }
  }

  function countPoints(feature) {
    const geometry = feature?.geometry;
    if (!geometry) return 0;
    if (geometry.type === 'Point') return 1;
    if (geometry.type === 'MultiPoint' && Array.isArray(geometry.coordinates)) {
      return geometry.coordinates.length;
    }
    return 0;
  }

  function getFeatureBbox(feature) {
    if (!turf || typeof turf.bbox !== 'function') return null;
    try {
      return turf.bbox(feature);
    } catch (error) {
      console.warn('Falha ao calcular o envelope da feição.', error);
      return null;
    }
  }

  function findField(props, candidates) {
    if (!props) return null;
    const lower = Object.create(null);
    Object.keys(props).forEach(key => {
      lower[key.toLowerCase()] = key;
    });
    for (const candidate of candidates) {
      const match = lower[candidate.toLowerCase()];
      if (match) return match;
    }
    return null;
  }

  function enrichFeature(def, feature, codeField) {
    if (!feature) {
      return {
        feature,
        code: '',
        areaHa: 0,
        lengthKm: 0,
        pointCount: 0,
        classValue: ''
      };
    }
    const props = feature.properties || (feature.properties = {});
    let code = codeField ? trim(props[codeField]) : '';
    if (!code && def.needsMicroJoin) {
      code = matchFeatureToMicro(feature);
      if (code) {
        const joinField = def.joinField || 'Cod_man';
        if (joinField) {
          props[joinField] = code;
        }
      }
    }
    const areaHa = def.type === 'polygon' ? computeAreaHa(feature) : 0;
    const lengthKm = def.type === 'line' ? computeLengthKm(feature) : 0;
    const pointCount = def.type === 'point' ? countPoints(feature) : 0;
    let classValue = '';
    if (def.legend && def.legend.type === 'area-classes') {
      try {
        classValue = trim(def.legend.getClass(feature, props));
      } catch (error) {
        console.warn('Falha ao obter a classe da feição.', error);
        classValue = '';
      }
    }
    return {
      feature,
      code,
      areaHa,
      lengthKm,
      pointCount,
      classValue
    };
  }

  function createPopupContent(feature) {
    const props = feature?.properties;
    if (!props) return '';
@@ -623,99 +664,102 @@
        'construcoes__construcoes_otto__part5.geojson.gz',
        'construcoes__construcoes_otto__part6.geojson.gz'
      ],
      legend: {
        type: 'count-total',
        title: 'Construções',
        unit: 'registros'
      }
    },
    {
      key: 'caf',
      name: 'CAF',
      type: 'point',
      files: ['caf__caf_otto.geojson.gz'],
      legend: {
        type: 'count-total',
        title: 'CAF',
        unit: 'registros'
      }
    },
    {
      key: 'car',
      name: 'CAR',
      type: 'polygon',
      files: ['car__car_otto.geojson'],
      needsMicroJoin: true,
      joinField: 'Cod_man',
      legend: {
        type: 'area-total',
        title: 'CAR',
        color: '#fb923c',
        includeCount: true
      }
    }
  ];

  const baseLayers = {
    'CARTO Light': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap • © CARTO'
    }),
    'OSM Padrão': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap colaboradores'
    }),
    'Esri Imagery': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Imagens © Esri & partners'
    }),
    'Esri Streets': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Map data © Esri'
    }),
    'Stamen Terrain': L.tileLayer('https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg', {
      attribution: 'Map tiles © Stamen'
    })
  };

  const map = L.map('map', {
    center: [-24.5, -51.5],
    zoom: 7,
    preferCanvas: true,
    layers: [baseLayers['CARTO Light']]
  });

  const layerControl = L.control.layers(baseLayers, {}, {
    collapsed: false,
    position: 'topleft'
  }).addTo(map);

  map.attributionControl.setPrefix(false);
  map.attributionControl.addAttribution('Água Segura');

  const legendControl = createLegendDock().addTo(map);
  const legendContainer = legendControl.getContainer();

  const stateByKey = new Map();
  const groupLookup = new Map();

  const microUi = setupMicroFilterControl();
  const microSpatialIndex = [];
  let microOptions = [];
  const allMicroCodes = new Set();
  let activeCodes = new Set();
  let microOptionsReady = false;

  let currentOpacity = 0.7;
  const opacityInput = document.getElementById('opacity');
  const opacityValue = document.getElementById('opacityVal');
  if (opacityInput) {
    const initial = Number(opacityInput.value || 70);
    const clamped = Math.min(100, Math.max(20, Number.isFinite(initial) ? initial : 70));
    currentOpacity = clamped / 100;
    if (opacityValue) {
      opacityValue.textContent = `${clamped}%`;
    }
    opacityInput.addEventListener('input', event => {
      const raw = Number(event.target.value);
      const next = Math.min(100, Math.max(20, Number.isFinite(raw) ? raw : 70));
      currentOpacity = next / 100;
      if (opacityValue) {
        opacityValue.textContent = `${next}%`;
      }
      stateByKey.forEach(updateLayerOpacity);
    });
  }
@@ -792,53 +836,63 @@
    });
  }

  if (microUi.clear) {
    microUi.clear.addEventListener('click', () => {
      activeCodes = new Set();
      updateMicroSummary();
      renderMicroList();
      applyFilters({ fitToMicro: true });
    });
  }

  function getEffectiveCodes() {
    if (!microOptionsReady || !microOptions.length) return null;
    if (!activeCodes) return null;
    if (activeCodes.size === 0) return new Set();
    if (activeCodes.size >= microOptions.length) return null;
    return activeCodes;
  }

  function applyFilters(options = {}) {
    const effectiveCodes = getEffectiveCodes();
    stateByKey.forEach(state => {
      if (!state.ready) return;
      const { def } = state;
      let filteredItems = state.enriched;
      if (effectiveCodes) {
        filteredItems = state.enriched.filter(item => {
          if (state.codeField) {
            return item.code && effectiveCodes.has(item.code);
          }
          if (def.needsMicroJoin) {
            const code = ensureItemCode(item, state);
            return code && effectiveCodes.has(code);
          }
          return false;
        });
      }
      state.filtered = filteredItems;
      state.group.clearLayers();
      if (filteredItems.length) {
        const features = filteredItems.map(item => item.feature);
        const layer = buildGeoJsonLayer(def, features);
        state.group.addLayer(layer);
        state.displayLayer = layer;
        updateLayerOpacity(state);
      } else {
        state.displayLayer = null;
      }
    });
    updateLegendDock();
    if (options.fitToMicro) {
      const microState = stateByKey.get('microbacias');
      if (microState && microState.displayLayer) {
        const bounds = microState.displayLayer.getBounds?.();
        if (bounds && bounds.isValid && bounds.isValid()) {
          map.fitBounds(bounds.pad(0.08));
        }
      }
    }
  }

  function updateLayerOpacity(state) {
@@ -854,87 +908,107 @@
        }
      } else if (state.def.type === 'line') {
        layer.setStyle(getLineStyle(state.def, feature));
      } else {
        layer.setStyle(getPolygonStyle(state.def, feature));
      }
    });
  }

  function loadLayer(state) {
    if (state.ready) return Promise.resolve(state);
    if (state.loading && state.promise) return state.promise;
    state.loading = true;
    state.promise = (async () => {
      const collected = [];
      for (const file of state.def.files) {
        try {
          const features = await fetchGeoJsonFile(file);
          collected.push(...features);
        } catch (error) {
          console.error(`Falha ao carregar ${file}`, error);
        }
      }
      state.features = collected;
      const sampleProps = collected.find(item => item && item.properties)?.properties || null;
      const { def } = state;
      let codeField = sampleProps ? findField(sampleProps, CODE_FIELD_CANDIDATES) : null;
      if (!codeField && def.needsMicroJoin) {
        codeField = def.joinField || 'Cod_man';
      }
      state.codeField = codeField;
      state.enriched = collected.map(feature => enrichFeature(def, feature, codeField));
      state.ready = true;
      state.loading = false;
      if (def.key === 'microbacias') {
        prepareMicroOptions(state.enriched);
      }
      applyFilters();
      return state;
    })();
    return state.promise;
  }

  function prepareMicroOptions(enriched) {
    const mapByCode = new Map();
    microSpatialIndex.length = 0;
    enriched.forEach(entry => {
      const { feature, code } = entry;
      if (!feature || !code) return;
      if (!mapByCode.has(code)) {
        const props = feature.properties || {};
        const nome = trim(getFirstValue(props, MICRO_NAME_FIELDS));
        const manancial = trim(getFirstValue(props, MICRO_MANANCIAL_FIELDS));
        const classe = trim(getFirstValue(props, MICRO_CLASS_FIELDS));
        const subtitle = [manancial, classe].filter(Boolean).join(' • ');
        mapByCode.set(code, {
          code,
          title: nome || `Microbacia ${code}`,
          subtitle,
          search: normaliseText(`${code} ${nome} ${manancial} ${classe}`)
        });
      }
      microSpatialIndex.push({
        code,
        feature,
        bounds: getFeatureBbox(feature)
      });
    });
    microOptions = Array.from(mapByCode.values()).sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    allMicroCodes.clear();
    microOptions.forEach(option => allMicroCodes.add(option.code));
    activeCodes = new Set(allMicroCodes);
    microOptionsReady = true;
    refreshMicroUi();
    stateByKey.forEach(state => {
      if (!state.ready || !state.def.needsMicroJoin) return;
      state.enriched.forEach(item => {
        if (!item.code) {
          ensureItemCode(item, state);
        }
      });
    });
  }

  function refreshMicroUi() {
    updateMicroSummary();
    renderMicroList();
  }

  function updateMicroSummary() {
    if (!microUi.summary) return;
    if (!microOptionsReady) {
      microUi.summary.textContent = 'Carregando microbacias…';
      microUi.summary.classList.add('muted');
      return;
    }
    if (!microOptions.length) {
      microUi.summary.textContent = 'Nenhuma microbacia disponível.';
      microUi.summary.classList.add('muted');
      return;
    }
    const total = allMicroCodes.size || microOptions.length;
    const selected = activeCodes ? activeCodes.size : 0;
    if (!selected) {
      microUi.summary.textContent = 'Nenhuma microbacia selecionada.';
      microUi.summary.classList.remove('muted');
    } else if (selected >= total) {
@@ -974,50 +1048,102 @@
        text.className = 'micro-option-text';
        const title = document.createElement('div');
        title.className = 'micro-option-title';
        title.textContent = `${option.code} · ${option.title}`;
        text.appendChild(title);
        if (option.subtitle) {
          const subtitle = document.createElement('div');
          subtitle.className = 'micro-option-sub';
          subtitle.textContent = option.subtitle;
          text.appendChild(subtitle);
        }
        label.appendChild(input);
        label.appendChild(text);
        fragment.appendChild(label);
      });
    }
    if (microOptionsReady && rendered === 0) {
      const empty = document.createElement('div');
      empty.className = 'micro-empty muted';
      empty.textContent = query ? 'Nenhuma microbacia corresponde à busca.' : 'Nenhuma microbacia disponível.';
      fragment.appendChild(empty);
    }
    microUi.list.appendChild(fragment);
  }

  function matchFeatureToMicro(feature) {
    if (!feature || !microSpatialIndex.length || !turf) return '';
    let testPoint = null;
    try {
      testPoint = turf.centroid(feature);
    } catch (error) {
      console.warn('Falha ao calcular o centróide da feição.', error);
    }
    if (!testPoint || !testPoint.geometry || !Array.isArray(testPoint.geometry.coordinates)) {
      try {
        testPoint = turf.pointOnFeature(feature);
      } catch (error) {
        console.warn('Falha ao estimar um ponto interno para a feição.', error);
        return '';
      }
    }
    const coords = testPoint?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return '';
    const [x, y] = coords;
    for (const cell of microSpatialIndex) {
      const bounds = cell.bounds;
      if (bounds) {
        if (x < bounds[0] || x > bounds[2] || y < bounds[1] || y > bounds[3]) {
          continue;
        }
      }
      try {
        if (turf.booleanPointInPolygon(testPoint, cell.feature)) {
          return cell.code;
        }
      } catch (error) {
        console.warn('Falha ao verificar interseção com a microbacia.', error);
      }
    }
    return '';
  }

  function ensureItemCode(item, state) {
    if (!item || item.code) return item?.code || '';
    if (!state || !state.def || !state.def.needsMicroJoin) return item.code || '';
    const code = matchFeatureToMicro(item.feature);
    if (code) {
      item.code = code;
      const joinField = state.def.joinField || state.codeField || 'Cod_man';
      if (joinField) {
        const props = item.feature.properties || (item.feature.properties = {});
        props[joinField] = code;
      }
    }
    return item.code || '';
  }

  function handleOptionToggle(code, checked) {
    if (!code) return;
    const next = new Set(activeCodes);
    if (checked) {
      next.add(code);
    } else {
      next.delete(code);
    }
    activeCodes = next;
    updateMicroSummary();
    applyFilters({ fitToMicro: true });
  }

  function setupMicroFilterControl() {
    const Control = L.Control.extend({
      options: { position: 'topright' },
      onAdd() {
        const container = L.DomUtil.create('div', 'leaflet-control micro-filter');
        container.innerHTML = `
          <div class="micro-header">
            <div>
              <h2>Microbacias</h2>
              <p class="micro-summary muted" data-role="summary">Carregando microbacias…</p>
            </div>
          </div>
