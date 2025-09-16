(function () {
  'use strict';

  const scriptSrc = (() => {
    if (document.currentScript?.src) return document.currentScript.src;
    const scripts = document.getElementsByTagName('script');
    for (const el of scripts) {
      if (el.src) return el.src;
    }
    return window.location.href;
  })();

  const DATA_BASE_URL = new URL('./data/', scriptSrc);

  const LAYERS = [
    { name: 'Declividade', key: 'declividade', type: 'poly', file: ['declividade__declividade_otto.geojson.gz'], preload: true },
    { name: 'Altimetria', key: 'altimetria', type: 'poly', file: ['altimetria__altimetria_otto.geojson.gz'], preload: true },
    { name: 'Uso do Solo', key: 'uso_solo', type: 'poly', file: ['uso_solo__usodosolo_otto.geojson.gz'], preload: true },
    { name: 'Estradas', key: 'estradas', type: 'line', file: ['estradas__estradas_otto.geojson.gz'] },
    { name: 'Hidrografia', key: 'hidrografia', type: 'line', file: ['hidrografia__hidrografia_otto.geojson.gz'] },
    { name: 'Nascentes', key: 'nascentes', type: 'point', file: ['nascentes__nascentes_otto.geojson.gz'] },
    {
      name: 'Construções',
      key: 'construcoes',
      type: 'point',
      file: [
        'construcoes__construcoes_otto__part1.geojson.gz',
        'construcoes__construcoes_otto__part2.geojson.gz',
        'construcoes__construcoes_otto__part3.geojson.gz',
        'construcoes__construcoes_otto__part4.geojson.gz',
        'construcoes__construcoes_otto__part5.geojson.gz',
        'construcoes__construcoes_otto__part6.geojson.gz'
      ]
    },
    { name: 'Solos', key: 'solos', type: 'poly', file: ['solos__solos_otto.geojson.gz'], preload: true },
    { name: 'Microbacias', key: 'microbacias', type: 'poly', file: ['otto_selec__ottos_selec_lista4.geojson.gz'], preload: true },
    { name: 'CAF', key: 'caf', type: 'poly', file: ['caf__caf_otto.geojson.gz'], preload: true },
    { name: 'CAR', key: 'car', type: 'poly', file: ['car__car_otto.geojson'], idField: 'cod_imovel' }
  ];

  const CLASS_FIELDS = {
    declividade: 'ClDec',
    altimetria: 'ClAlt',
    uso_solo: 'NIVEL_II',
    solos: 'Cl_solos'
  };

  const slopeOrder = ['000a003', '003a008', '008a015', '015a025', '025a045', '045a100', '>100'];
  const slopeLabels = ['0–3%', '3–8%', '8–15%', '15–25%', '25–45%', '45–100%', '>100%'];
  const slopeColors = ['#edf8e9', '#c7e9c0', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#0c2c84'];
  const slopeColorFor = value => {
    const idx = slopeOrder.indexOf(String(value));
    return slopeColors[idx >= 0 ? idx : 0];
  };

  const altRamp = ['#ffffcc', '#c2e699', '#78c679', '#31a354', '#006837', '#00441b'];
  function altColorFor(value) {
    if (!value) return altRamp[0];
    const match = String(value).match(/(\d+).+?(\d+)/);
    const mid = match ? (Number(match[1]) + Number(match[2])) / 2 : NaN;
    if (Number.isNaN(mid)) return altRamp[0];
    const breaks = [0, 400, 800, 1200, 1600, 2000, Number.POSITIVE_INFINITY];
    for (let i = 0; i < breaks.length - 1; i += 1) {
      if (mid >= breaks[i] && mid < breaks[i + 1]) return altRamp[i];
    }
    return altRamp[altRamp.length - 1];
  }

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

  const fmt = {
    ha(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) return '—';
      if (value >= 100) return value.toFixed(0).replace('.', ',');
      if (value >= 10) return value.toFixed(1).replace('.', ',');
      return value.toFixed(2).replace('.', ',');
    },
    km(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) return '—';
      if (value >= 100) return value.toFixed(0).replace('.', ',');
      if (value >= 10) return value.toFixed(1).replace('.', ',');
      return value.toFixed(2).replace('.', ',');
    },
    int(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) return '—';
      return Math.round(value).toLocaleString('pt-BR');
    }
  };

  const fetchCache = new Map();

  const baseLayers = {
    'CARTO Light': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
      attribution: '© OSM • © CARTO'
    }),
    'OSM Padrão': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }),
    'Esri Imagery': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Imagery: Esri/Maxar'
    }),
    'Esri Streets': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri'
    }),
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

  const layerControl = L.control.layers(baseLayers, {}, {
    collapsed: false,
    position: 'topleft'
  }).addTo(map);

  const datasetByKey = {};
  const legendControls = {};
  let currentOpacity = 0.7;
  let microSelection = { label: null, features: null };
  let microTablePromise = null;

  const MetricsControl = L.Control.extend({
    onAdd() {
      const div = L.DomUtil.create('div', 'metrics');
      div.innerHTML = `
        <h3>Métricas</h3>
        <div id="microSummary" class="muted">Sem filtro de Microbacias — totais gerais.</div>
        <table>
          <thead>
            <tr><th>Camada</th><th>Área (ha)</th><th>Extensão (km)</th><th>Qtd</th></tr>
          </thead>
          <tbody id="mtbody"></tbody>
        </table>`;
      L.DomEvent.disableClickPropagation(div);
      return div;
    }
  });
  const metricsControl = new MetricsControl({ position: 'bottomright' }).addTo(map);

  const MicroFilterControl = L.Control.extend({
    initialize(options) {
      L.setOptions(this, options);
      this._data = [];
      this._activeCodes = new Set();
      this._elements = {};
      this._filteredItems = [];
      this._prefix = `mf-${Math.random().toString(36).slice(2, 8)}`;
    },
    onAdd() {
      const container = L.DomUtil.create('div', 'panel');
      container.innerHTML = `
        <h3>Microbacias</h3>
        <label for="${this._prefix}-org">Origem</label>
        <select id="${this._prefix}-org"><option value="">(todas)</option></select>
        <label for="${this._prefix}-reg">Regional IDR</label>
        <select id="${this._prefix}-reg"><option value="">(todas)</option></select>
        <label for="${this._prefix}-mun">Município</label>
        <select id="${this._prefix}-mun"><option value="">(todos)</option></select>
        <label for="${this._prefix}-search" style="margin-top:.5rem;">Pesquisar <b>Região_Município_Manancial</b></label>
        <input id="${this._prefix}-search" type="search" placeholder="Pesquisar..." />
        <div class="row">
          <button id="${this._prefix}-all" class="btn-sm">Marcar todos</button>
          <button id="${this._prefix}-none" class="btn-sm">Desmarcar</button>
          <button id="${this._prefix}-apply" class="btn-sm primary">Aplicar</button>
        </div>
        <div id="${this._prefix}-list" class="list"><div class="muted">Carregando microbacias...</div></div>`;

      const refs = {
        container,
        selectOrg: container.querySelector(`#${this._prefix}-org`),
        selectReg: container.querySelector(`#${this._prefix}-reg`),
        selectMun: container.querySelector(`#${this._prefix}-mun`),
        search: container.querySelector(`#${this._prefix}-search`),
        btnAll: container.querySelector(`#${this._prefix}-all`),
        btnNone: container.querySelector(`#${this._prefix}-none`),
        btnApply: container.querySelector(`#${this._prefix}-apply`),
        list: container.querySelector(`#${this._prefix}-list`)
      };
      this._elements = refs;

      const changeHandler = () => this._render();
      refs.selectOrg.addEventListener('change', changeHandler);
      refs.selectReg.addEventListener('change', changeHandler);
      refs.selectMun.addEventListener('change', changeHandler);
      refs.search.addEventListener('input', () => this._render());
      refs.btnAll.addEventListener('click', event => {
        event.preventDefault();
        for (const item of this._filteredItems || []) {
          this._activeCodes.add(item.code);
        }
        this._render();
      });
      refs.btnNone.addEventListener('click', event => {
        event.preventDefault();
        for (const item of this._filteredItems || []) {
          this._activeCodes.delete(item.code);
        }
        this._render();
      });
      refs.btnApply.addEventListener('click', event => {
        event.preventDefault();
        this._applySelection();
      });

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      if (this._data.length) {
        this._populateCombos();
        this._render();
      }
      return container;
    },
    setData(table) {
      this._data = Array.isArray(table) ? table : [];
      this._activeCodes = new Set(this._data.map(item => item.code));
      if (this._elements.container) {
        this._populateCombos();
        this._render();
      }
    },
    _populateCombos() {
      const refs = this._elements;
      if (!refs.selectOrg) return;
      const clearAndFill = (select, values) => {
        const current = select.value;
        select.innerHTML = '<option value="">(todos)</option>';
        [...values].sort((a, b) => a.localeCompare(b, 'pt-BR')).forEach(value => {
          const opt = document.createElement('option');
          opt.value = value;
          opt.textContent = value;
          select.appendChild(opt);
        });
        if ([...select.options].some(opt => opt.value === current)) {
          select.value = current;
        } else {
          select.value = '';
        }
      };

      const origins = new Set();
      const regionals = new Set();
      const municipios = new Set();
      for (const row of this._data) {
        if (row.org) origins.add(row.org);
        for (const reg of row.regionals) regionals.add(reg);
        for (const mun of row.municipios) municipios.add(mun);
      }
      clearAndFill(refs.selectOrg, origins);
      clearAndFill(refs.selectReg, regionals);
      clearAndFill(refs.selectMun, municipios);
    },
    _render() {
      const refs = this._elements;
      if (!refs.list) return;
      const originFilter = refs.selectOrg?.value || '';
      const regFilter = refs.selectReg?.value || '';
      const munFilter = refs.selectMun?.value || '';
      const query = (refs.search?.value || '').trim().toLowerCase();

      const filtered = this._data.filter(row => {
        if (originFilter && row.org !== originFilter) return false;
        if (regFilter && !row.regionals.includes(regFilter)) return false;
        if (munFilter && !row.municipios.includes(munFilter)) return false;
        if (query && !row.label.toLowerCase().includes(query)) return false;
        return true;
      });
      this._filteredItems = filtered;

      if (!filtered.length) {
        refs.list.innerHTML = '<div class="muted">Nenhum item para os filtros atuais.</div>';
        return;
      }

      refs.list.innerHTML = '';
      for (const row of filtered) {
        const label = document.createElement('label');
        label.className = 'item';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = row.code;
        checkbox.checked = this._activeCodes.has(row.code);
        checkbox.addEventListener('change', event => {
          if (event.target.checked) this._activeCodes.add(row.code);
          else this._activeCodes.delete(row.code);
        });
        const span = document.createElement('span');
        span.textContent = row.label;
        label.append(checkbox, span);
        refs.list.appendChild(label);
      }
    },
    _applySelection() {
      if (!this._data.length) return;
      const selectedCodes = new Set(this._activeCodes);
      const selectedItems = this._data.filter(row => selectedCodes.has(row.code));
      const features = selectedItems.map(row => row.feature);
      const label = selectedItems.length && selectedItems.length !== this._data.length
        ? `${selectedItems.length} microbacias selecionadas`
        : null;
      applyMicroSelection(selectedCodes, label, features);
    }
  });

  const microFilterControl = new MicroFilterControl({ position: 'topright' }).addTo(map);
  function makeDataUrl(file) {
    return new URL(file, DATA_BASE_URL).toString();
  }

  async function fetchMaybeGz(url) {
    if (fetchCache.has(url)) return fetchCache.get(url);
    const promise = (async () => {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ao buscar ${url}\n${text.slice(0, 160)}`);
      }
      if (url.toLowerCase().endsWith('.gz')) {
        const arrayBuffer = await res.arrayBuffer();
        const inflated = window.pako.inflate(new Uint8Array(arrayBuffer), { to: 'string' });
        return JSON.parse(inflated);
      }
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return res.json();
      }
      const text = await res.text();
      return JSON.parse(text);
    })();
    fetchCache.set(url, promise);
    return promise;
  }

  function toFeatures(geojson) {
    if (!geojson) return [];
    if (geojson.type === 'FeatureCollection') return geojson.features || [];
    if (geojson.type === 'Feature') return [geojson];
    return [];
  }

  function ensureDatasetEntry(def) {
    if (datasetByKey[def.key]) return datasetByKey[def.key];
    const entry = {
      def,
      layerGroup: L.layerGroup(),
      features: null,
      loadPromise: null,
      geoLayer: null,
      filteredLayer: null,
      metrics: null,
      summary: null
    };
    entry.layerGroup.datasetKey = def.key;
    datasetByKey[def.key] = entry;
    layerControl.addOverlay(entry.layerGroup, def.name);
    return entry;
  }

  function polygonAreaHa(features) {
    let total = 0;
    for (const feature of features) {
      if (!feature || !feature.geometry) continue;
      const type = feature.geometry.type;
      if (type === 'Polygon' || type === 'MultiPolygon') {
        total += turf.area(feature) / 10000;
      }
    }
    return total;
  }

  function lineLengthKm(features) {
    let total = 0;
    for (const feature of features) {
      if (!feature || !feature.geometry) continue;
      const type = feature.geometry.type;
      if (type === 'LineString' || type === 'MultiLineString') {
        total += turf.length(feature, { units: 'kilometers' });
      }
    }
    return total;
  }

  function pointCount(features) {
    let total = 0;
    for (const feature of features) {
      if (!feature || !feature.geometry) continue;
      const { type, coordinates } = feature.geometry;
      if (type === 'Point') total += 1;
      else if (type === 'MultiPoint' && Array.isArray(coordinates)) total += coordinates.length;
    }
    return total;
  }

  function summarizeAreasByClass(features, getKey) {
    const map = new Map();
    let total = 0;
    for (const feature of features) {
      const key = getKey(feature);
      if (!key) continue;
      const area = turf.area(feature) / 10000;
      total += area;
      map.set(key, (map.get(key) || 0) + area);
    }
    return { total, map };
  }

  function updateMetricsForEntry(entry) {
    if (!entry.features) return;
    const { def } = entry;
    if (def.type === 'poly') {
      if (['declividade', 'altimetria', 'uso_solo', 'solos'].includes(def.key)) {
        entry.summary = summarizeAreasByClass(entry.features, feature => {
          const props = feature?.properties || {};
          if (def.key === 'uso_solo') {
            const field = Object.prototype.hasOwnProperty.call(props, CLASS_FIELDS.uso_solo)
              ? CLASS_FIELDS.uso_solo
              : 'NIVEL_I';
            return String(props[field] || '').trim();
          }
          const fieldName = CLASS_FIELDS[def.key];
          return String(props[fieldName] || '').trim();
        });
        entry.metrics = {
          areaHa: entry.summary.total,
          lenKm: 0,
          count: entry.features.length
        };
      } else {
        entry.metrics = {
          areaHa: polygonAreaHa(entry.features),
          lenKm: 0,
          count: entry.features.length
        };
      }
    } else if (def.type === 'line') {
      entry.metrics = {
        areaHa: 0,
        lenKm: lineLengthKm(entry.features),
        count: entry.features.length
      };
    } else if (def.type === 'point') {
      entry.metrics = {
        areaHa: 0,
        lenKm: 0,
        count: pointCount(entry.features)
      };
    }
  }

  function styleFn(key) {
    if (key === 'declividade') {
      return feature => ({
        color: '#444',
        weight: 0.4,
        fillColor: slopeColorFor(feature?.properties?.[CLASS_FIELDS.declividade]),
        fillOpacity: 0.65 * currentOpacity,
        opacity: currentOpacity
      });
    }
    if (key === 'altimetria') {
      return feature => ({
        color: '#333',
        weight: 0.4,
        fillColor: altColorFor(feature?.properties?.[CLASS_FIELDS.altimetria]),
        fillOpacity: 0.6 * currentOpacity,
        opacity: currentOpacity
      });
    }
    if (key === 'uso_solo') {
      return feature => {
        const props = feature?.properties || {};
        const field = Object.prototype.hasOwnProperty.call(props, CLASS_FIELDS.uso_solo)
          ? CLASS_FIELDS.uso_solo
          : 'NIVEL_I';
        const value = String(props[field] || '');
        const color = field === 'NIVEL_II'
          ? (usoColors[value] || '#31a354')
          : (usoFallbackColors[value] || '#31a354');
        return {
          color: '#444',
          weight: 0.3,
          fillColor: color,
          fillOpacity: 0.55 * currentOpacity,
          opacity: currentOpacity
        };
      };
    }
    if (key === 'solos') {
      return feature => {
        const value = String(feature?.properties?.[CLASS_FIELDS.solos] || '');
        const color = soilColors[value] || '#dfc27d';
        return {
          color: '#555',
          weight: 0.4,
          fillColor: color,
          fillOpacity: 0.65 * currentOpacity,
          opacity: currentOpacity
        };
      };
    }
    const defaults = {
      estradas: { color: '#737373', weight: 2, dashArray: '4,4', opacity: currentOpacity },
      hidrografia: { color: '#2b8cbe', weight: 2, opacity: currentOpacity, fillOpacity: 0.2 * currentOpacity },
      nascentes: { color: '#1c9099', weight: 1, opacity: currentOpacity, fillOpacity: Math.min(1, 0.8 * currentOpacity) },
      construcoes: { color: '#252525', weight: 0.6, opacity: currentOpacity, fillOpacity: Math.min(1, 0.9 * currentOpacity) },
      caf: { color: '#006837', weight: 1, opacity: currentOpacity, fillOpacity: 0.35 * currentOpacity },
      microbacias: { color: '#1e40af', weight: 2, fillColor: '#93c5fd', opacity: currentOpacity, fillOpacity: 0.25 * currentOpacity },
      car: { color: '#ff7f00', weight: 1.2, fillColor: '#ffa64d', opacity: currentOpacity, fillOpacity: 0.2 * currentOpacity }
    };
    return () => ({
      color: '#555',
      weight: 1,
      opacity: currentOpacity,
      fillOpacity: 0.25 * currentOpacity,
      ...(defaults[key] || {})
    });
  }

  function pointOptionsFor(key) {
    const base = {
      nascentes: { radius: 5, color: '#1c9099', fillColor: '#1c9099', weight: 1, fillOpacity: 0.85 },
      construcoes: { radius: 2, color: '#252525', fillColor: '#252525', weight: 0, fillOpacity: 0.85 }
    };
    const defaults = base[key] || { radius: 4, color: '#333', fillColor: '#333', weight: 1, fillOpacity: 0.8 };
    return {
      ...defaults,
      opacity: currentOpacity,
      fillOpacity: Math.min(1, defaults.fillOpacity * currentOpacity)
    };
  }

  function popupHtml(def, feature) {
    const props = feature?.properties || {};
    let title = def.name;
    if (def.key === 'car' && def.idField && props[def.idField]) {
      title += ` — ${props[def.idField]}`;
    }
    const lines = Object.keys(props)
      .slice(0, 20)
      .map(key => `<div><b>${key}</b>: ${String(props[key])}</div>`);
    return `<div><b>${title}</b></div>${lines.join('')}`;
  }

  function createGeoLayer(entry) {
    const def = entry.def;
    const style = styleFn(def.key);
    return L.geoJSON(entry.features, {
      style,
      pointToLayer: (feature, latlng) => {
        if (def.type === 'point') return L.circleMarker(latlng, pointOptionsFor(def.key));
        return L.marker(latlng);
      },
      onEachFeature: (feature, layer) => {
        const html = popupHtml(def, feature);
        if (html) layer.bindPopup(html);
      }
    });
  }
  async function loadFeatures(entry) {
    if (entry.features) return entry.features;
    if (entry.loadPromise) return entry.loadPromise;
    const { def } = entry;
    entry.loadPromise = (async () => {
      const files = Array.isArray(def.file) ? def.file : [def.file];
      const features = [];
      for (const file of files) {
        const url = makeDataUrl(file);
        const geojson = await fetchMaybeGz(url);
        features.push(...toFeatures(geojson));
      }
      entry.features = features;
      updateMetricsForEntry(entry);
      refreshTotals();
      return features;
    })();
    entry.loadPromise.catch(err => {
      console.error(`Falha ao carregar ${def.name}:`, err);
    });
    return entry.loadPromise;
  }

  async function ensureGeoLayer(entry) {
    await loadFeatures(entry);
    if (!entry.geoLayer) {
      entry.geoLayer = createGeoLayer(entry);
      entry.layerGroup.addLayer(entry.geoLayer);
    }
    if (['declividade', 'altimetria', 'uso_solo', 'solos'].includes(entry.def.key)) {
      updateLegendForKey(entry.def.key);
    }
    return entry.geoLayer;
  }

  function updateEntryStyle(entry) {
    if (!entry) return;
    const style = styleFn(entry.def.key);
    if (entry.geoLayer) entry.geoLayer.setStyle(style);
    if (entry.filteredLayer) entry.filteredLayer.setStyle(style);
    if (entry.def.type === 'point') {
      const updatePoints = layer => {
        layer.eachLayer(child => {
          if (child.setStyle) child.setStyle(pointOptionsFor(entry.def.key));
        });
      };
      if (entry.geoLayer) updatePoints(entry.geoLayer);
      if (entry.filteredLayer) updatePoints(entry.filteredLayer);
    }
  }

  function updateAllStyles() {
    Object.keys(datasetByKey).forEach(key => updateEntryStyle(datasetByKey[key]));
  }

  function addLegend(id, title, items) {
    const control = L.control({ position: 'bottomleft' });
    control.onAdd = () => {
      const div = L.DomUtil.create('div', 'legend');
      div.id = id;
      div.innerHTML = `<div><b>${title}</b></div>` + items.map(([label, color, extra]) => `
        <div class="leg-row"><span class="sw" style="background:${color}"></span>${label}${extra ? ` — <b>${extra}</b>` : ''}</div>`).join('');
      return div;
    };
    control.addTo(map);
    return control;
  }

  function updateLegendForKey(key) {
    const entry = datasetByKey[key];
    if (!entry || !entry.summary) return;
    if (legendControls[key]) {
      map.removeControl(legendControls[key]);
      delete legendControls[key];
    }
    const total = entry.summary.total || 0;
    let items = [];
    let title = '';
    if (key === 'declividade') {
      items = slopeOrder.map((code, index) => {
        const area = entry.summary.map.get(code) || 0;
        const pct = total > 0 ? (area / total) * 100 : 0;
        return [slopeLabels[index], slopeColors[index], `${fmt.ha(area)} ha (${pct.toFixed(1)}%)`];
      });
      title = 'Declividade (%)';
    } else if (key === 'altimetria') {
      items = Array.from(entry.summary.map.entries()).map(([label, area]) => {
        const pct = total > 0 ? (area / total) * 100 : 0;
        return [label, altColorFor(label), `${fmt.ha(area)} ha (${pct.toFixed(1)}%)`];
      }).sort((a, b) => {
        const na = Number(String(a[0]).match(/^(\d+)/)?.[1] || 0);
        const nb = Number(String(b[0]).match(/^(\d+)/)?.[1] || 0);
        return na - nb;
      });
      title = 'Altimetria (m)';
    } else if (key === 'uso_solo') {
      items = Array.from(entry.summary.map.entries()).map(([label, area]) => {
        const pct = total > 0 ? (area / total) * 100 : 0;
        const color = usoColors[label] || usoFallbackColors[label] || '#31a354';
        return [label, color, `${fmt.ha(area)} ha (${pct.toFixed(1)}%)`];
      }).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
      title = 'Uso do Solo (Nível II)';
    } else if (key === 'solos') {
      items = Array.from(entry.summary.map.entries()).map(([label, area]) => {
        const pct = total > 0 ? (area / total) * 100 : 0;
        const color = soilColors[label] || '#dfc27d';
        return [label, color, `${fmt.ha(area)} ha (${pct.toFixed(1)}%)`];
      }).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
      title = 'Solos';
    }
    if (!items.length) return;
    legendControls[key] = addLegend(`legend-${key}`, title, items);
  }

  function metricsFor(features, type) {
    if (!Array.isArray(features)) return { areaHa: 0, lenKm: 0, count: 0 };
    if (type === 'poly') {
      return { areaHa: polygonAreaHa(features), lenKm: 0, count: features.length };
    }
    if (type === 'line') {
      return { areaHa: 0, lenKm: lineLengthKm(features), count: features.length };
    }
    if (type === 'point') {
      return { areaHa: 0, lenKm: 0, count: pointCount(features) };
    }
    return { areaHa: 0, lenKm: 0, count: 0 };
  }

  function refreshTotals() {
    const tbody = document.getElementById('mtbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    for (const def of LAYERS) {
      const entry = datasetByKey[def.key];
      const metrics = entry?.metrics;
      const areaCell = def.type === 'poly' && metrics ? fmt.ha(metrics.areaHa) : '—';
      const lenCell = def.type === 'line' && metrics ? fmt.km(metrics.lenKm) : '—';
      const countCell = def.type === 'point' && metrics ? fmt.int(metrics.count) : '—';
      const row = document.createElement('tr');
      row.innerHTML = `<td>${def.name}</td><td>${areaCell}</td><td>${lenCell}</td><td>${countCell}</td>`;
      tbody.appendChild(row);
    }
    const summaryDiv = document.getElementById('microSummary');
    if (summaryDiv) {
      if (microSelection.label && microSelection.features?.length) {
        const metrics = metricsFor(microSelection.features, 'poly');
        summaryDiv.innerHTML = `<b>${microSelection.label}</b><br/>Área selecionada: <b>${fmt.ha(metrics.areaHa)} ha</b>`;
        summaryDiv.classList.remove('muted');
      } else {
        summaryDiv.textContent = 'Sem filtro de Microbacias — totais gerais.';
        summaryDiv.classList.add('muted');
      }
    }
  }

  function setMicroSelection(label, features) {
    if (label && Array.isArray(features) && features.length) {
      microSelection = { label, features };
    } else {
      microSelection = { label: null, features: null };
    }
    refreshTotals();
  }

  function assignMicroCode(feature, index) {
    if (!feature) return '';
    if (feature.__microCode) return feature.__microCode;
    const props = feature.properties || {};
    let code = props.Cod_man;
    if (code === undefined || code === null || code === '') {
      code = `__sem_codigo__${index}`;
    } else {
      code = String(code);
    }
    feature.__microCode = code;
    return code;
  }

  async function buildMicroTable() {
    const microEntry = datasetByKey.microbacias;
    const cafEntry = datasetByKey.caf;
    await Promise.all([loadFeatures(microEntry), loadFeatures(cafEntry)]);
    const cafByCode = new Map();
    for (const feature of cafEntry.features || []) {
      const props = feature?.properties || {};
      const rawCode = props.Cod_man;
      if (rawCode === undefined || rawCode === null || rawCode === '') continue;
      const code = String(rawCode);
      const record = cafByCode.get(code) || {
        org: new Set(),
        regionals: new Set(),
        municipios: new Set(),
        nomeBacias: new Set(),
        mananciais: new Set()
      };
      if (props.Classe) record.org.add(String(props.Classe));
      if (props.RegIdr) record.regionals.add(String(props.RegIdr));
      const municipio = props.Municipio || props.municipio_;
      if (municipio) record.municipios.add(String(municipio));
      if (props.Nome_bacia) record.nomeBacias.add(String(props.Nome_bacia));
      if (props.Manancial) record.mananciais.add(String(props.Manancial));
      cafByCode.set(code, record);
    }

    const table = [];
    (microEntry.features || []).forEach((feature, index) => {
      const props = feature?.properties || {};
      const code = assignMicroCode(feature, index);
      const rawCode = props.Cod_man;
      const cafInfo = cafByCode.get(String(rawCode ?? ''));
      const orgs = cafInfo ? Array.from(cafInfo.org) : [];
      if (!orgs.length && props.Classe) orgs.push(String(props.Classe));
      const regionalsSet = new Set(cafInfo ? Array.from(cafInfo.regionals) : []);
      if (props.Nome_bacia) regionalsSet.add(String(props.Nome_bacia));
      const regionals = Array.from(regionalsSet).filter(Boolean);
      const municipios = cafInfo ? Array.from(cafInfo.municipios).filter(Boolean) : [];
      const nomeBacias = cafInfo ? Array.from(cafInfo.nomeBacias).filter(Boolean) : [];
      if (props.Nome_bacia) nomeBacias.push(String(props.Nome_bacia));
      const mananciais = cafInfo ? Array.from(cafInfo.mananciais).filter(Boolean) : [];
      if (props.Manancial) mananciais.push(String(props.Manancial));
      const org = orgs[0] || '';
      const nomeBacia = nomeBacias[0] || regionals[0] || '';
      const manancial = mananciais[0] || '';
      const labelParts = [nomeBacia || 'Sem região', municipios.length ? municipios.join(', ') : 'Sem município', manancial || 'Sem manancial'];
      const label = labelParts.join(' • ');
      table.push({
        code,
        org,
        regionals,
        municipios,
        nome_bacia: nomeBacia,
        manancial: manancial,
        label,
        feature
      });
    });
    return table;
  }

  async function ensureMicroTable() {
    if (!microTablePromise) {
      microTablePromise = buildMicroTable().then(table => {
        microFilterControl.setData(table);
        return table;
      }).catch(err => {
        console.error('Falha ao preparar tabela de microbacias:', err);
        throw err;
      });
    }
    return microTablePromise;
  }

  async function applyMicroSelection(selectedCodes, label, features) {
    const entry = datasetByKey.microbacias;
    if (!entry) return;
    await ensureGeoLayer(entry);
    const allFeatures = entry.features || [];
    if (!allFeatures.length) return;
    const codes = selectedCodes && selectedCodes.size
      ? new Set(selectedCodes)
      : new Set(allFeatures.map((feature, index) => assignMicroCode(feature, index)));
    const subset = allFeatures.filter((feature, index) => codes.has(assignMicroCode(feature, index)));
    const isFull = subset.length === allFeatures.length;

    if (entry.filteredLayer) {
      entry.layerGroup.removeLayer(entry.filteredLayer);
      entry.filteredLayer = null;
    }

    if (isFull) {
      if (!entry.layerGroup.hasLayer(entry.geoLayer)) entry.layerGroup.addLayer(entry.geoLayer);
      setMicroSelection(null, null);
    } else {
      if (entry.layerGroup.hasLayer(entry.geoLayer)) entry.layerGroup.removeLayer(entry.geoLayer);
      entry.filteredLayer = L.geoJSON(subset, {
        style: styleFn('microbacias'),
        onEachFeature: (feature, layer) => {
          const html = popupHtml(entry.def, feature);
          if (html) layer.bindPopup(html);
        }
      });
      entry.layerGroup.addLayer(entry.filteredLayer);
      const bounds = entry.filteredLayer.getBounds();
      if (bounds && bounds.isValid()) {
        map.fitBounds(bounds.pad(0.12));
      }
      setMicroSelection(label || `${subset.length} microbacias selecionadas`, subset);
    }
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function preloadDatasets() {
    for (const def of LAYERS) {
      if (!def.preload || def.key === 'microbacias') continue;
      const entry = datasetByKey[def.key];
      if (!entry) continue;
      try {
        await loadFeatures(entry);
        if (['declividade', 'altimetria', 'uso_solo', 'solos'].includes(def.key)) {
          updateLegendForKey(def.key);
        }
      } catch (err) {
        console.error(`Falha ao carregar ${def.name}:`, err);
      }
      await delay(20);
    }
  }

  async function init() {
    LAYERS.forEach(ensureDatasetEntry);
    const microEntry = datasetByKey.microbacias;
    try {
      await ensureGeoLayer(microEntry);
      if (!map.hasLayer(microEntry.layerGroup)) microEntry.layerGroup.addTo(map);
      const bounds = microEntry.geoLayer?.getBounds();
      if (bounds && bounds.isValid()) {
        map.fitBounds(bounds.pad(0.08));
      }
    } catch (err) {
      console.error('Falha ao carregar Microbacias:', err);
      alert('Falha ao carregar Microbacias. Consulte o console para detalhes.');
    }
    refreshTotals();
    ensureMicroTable().catch(() => {});
    preloadDatasets().then(() => refreshTotals());
    map.attributionControl.setPrefix(false);
    map.attributionControl.addAttribution('Água Segura • classes + filtros + métricas');
  }

  map.on('overlayadd', event => {
    const key = event.layer?.datasetKey;
    if (!key) return;
    const entry = datasetByKey[key];
    if (!entry) return;
    ensureGeoLayer(entry).catch(err => {
      console.error(`Falha ao ativar camada ${entry.def.name}:`, err);
    });
  });

  const fitBtn = document.getElementById('fitAll');
  if (fitBtn) {
    fitBtn.addEventListener('click', () => {
      const layers = [];
      for (const entry of Object.values(datasetByKey)) {
        if (!entry) continue;
        if (!map.hasLayer(entry.layerGroup)) continue;
        const layer = entry.filteredLayer || entry.geoLayer;
        if (layer) layers.push(layer);
      }
      if (!layers.length) return;
      const bounds = L.featureGroup(layers).getBounds();
      if (bounds && bounds.isValid()) map.fitBounds(bounds.pad(0.08));
    });
  }

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

  init();
})();
