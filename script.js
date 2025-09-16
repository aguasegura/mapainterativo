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

  const MICRO_CODE_FIELDS = ['Cod_man', 'cod_man', 'COD_MAN', 'codman', 'CodMan', 'codMan'];
  const LEGEND_TITLES = {
    declividade: 'Declividade (%)',
    altimetria: 'Altimetria (m)',
    uso_solo: 'Uso do Solo (Nível II)',
    solos: 'Solos'
  };

  const fmt = {
    ha(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) return '—';
      if (value >= 100) return value.toFixed(0).replace('.', ',');
      if (value >= 10) return value.toFixed(1).replace('.', ',');
      return value.toFixed(2).replace('.', ',');
    }
  };

  function normalizeString(value) {
    if (value === undefined || value === null) return '';
    return String(value)
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function toCleanArray(values) {
    const map = new Map();
    for (const raw of values || []) {
      if (raw === undefined || raw === null) continue;
      const text = String(raw).trim();
      if (!text) continue;
      const key = normalizeString(text);
      if (!map.has(key)) map.set(key, text);
    }
    return Array.from(map.values());
  }

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
  const LEGEND_LAYER_KEYS = new Set(['declividade', 'altimetria', 'uso_solo', 'solos']);
  const legendNodes = {};
  let legendDockContainer = null;
  let currentOpacity = 0.7;
  let activeMicroCodes = null;
  let microTablePromise = null;

  const legendDockControl = L.control({ position: 'bottomleft' });
  legendDockControl.onAdd = () => {
    const div = L.DomUtil.create('div', 'legend-dock');
    div.id = 'legendDock';
    return div;
  };
  legendDockControl.addTo(map);
  legendDockContainer = legendDockControl.getContainer();
  if (legendDockContainer) {
    L.DomEvent.disableScrollPropagation(legendDockContainer);
    L.DomEvent.disableClickPropagation(legendDockContainer);
  }

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
        <div id="${this._prefix}-summary" class="micro-summary muted">Sem filtro aplicado — exibindo todas as microbacias.</div>
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
        summary: container.querySelector(`#${this._prefix}-summary`),
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
        this._updateSummary(this._activeCodes.size);
      }
      return container;
    },
    setData(table) {
      this._data = Array.isArray(table) ? table : [];
      this._activeCodes = new Set(this._data.map(item => item.code));
      if (this._elements.container) {
        this._populateCombos();
        this._render();
        this._updateSummary(this._activeCodes.size);
      }
    },
    _populateCombos() {
      const refs = this._elements;
      if (!refs.selectOrg) return;
      const clearAndFill = (select, values, placeholder) => {
        if (!select) return;
        const current = select.value;
        const cleaned = toCleanArray(values).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        select.innerHTML = `<option value="">${placeholder}</option>`;
        cleaned.forEach(value => {
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

      clearAndFill(
        refs.selectOrg,
        this._data.map(row => row.org).filter(Boolean),
        '(todas)'
      );
      clearAndFill(
        refs.selectReg,
        this._data.flatMap(row => row.regionals),
        '(todas)'
      );
      clearAndFill(
        refs.selectMun,
        this._data.flatMap(row => row.municipios),
        '(todos)'
      );
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
      const sorted = filtered.slice().sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
      this._filteredItems = sorted;

      if (!sorted.length) {
        refs.list.innerHTML = '<div class="muted">Nenhum item para os filtros atuais.</div>';
        return;
      }

      refs.list.innerHTML = '';
      for (const row of sorted) {
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
    _updateSummary(count) {
      const summaryEl = this._elements.summary;
      if (!summaryEl) return;
      const total = this._data.length;
      if (!total) {
        summaryEl.textContent = 'Sem dados de microbacias disponíveis.';
        summaryEl.classList.remove('muted');
        return;
      }
      if (!count) {
        summaryEl.textContent = 'Nenhuma microbacia selecionada.';
        summaryEl.classList.remove('muted');
        return;
      }
      if (count === total) {
        summaryEl.textContent = 'Sem filtro aplicado — exibindo todas as microbacias.';
        summaryEl.classList.add('muted');
        return;
      }
      summaryEl.textContent = `${count} microbacias selecionadas.`;
      summaryEl.classList.remove('muted');
    },
    _applySelection() {
      if (!this._data.length) return;
      const selectedCodes = new Set(this._activeCodes);
      const selectedItems = this._data.filter(row => selectedCodes.has(row.code));
      this._updateSummary(selectedItems.length);
      applyMicroSelection(selectedCodes);
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
      legendData: null,
      microField: undefined
    };
    entry.layerGroup.datasetKey = def.key;
    datasetByKey[def.key] = entry;
    layerControl.addOverlay(entry.layerGroup, def.name);
    return entry;
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

  function detectMicroField(entry) {
    if (!entry) return null;
    if (entry.microField !== undefined) return entry.microField || null;
    entry.microField = null;
    const sample = (entry.features || []).find(feature => feature && feature.properties && Object.keys(feature.properties).length);
    if (!sample) return null;
    const keys = Object.keys(sample.properties);
    const match = keys.find(key => MICRO_CODE_FIELDS.some(candidate => candidate.toLowerCase() === key.toLowerCase()));
    if (match) entry.microField = match;
    return entry.microField;
  }

  function featureMatchesCodes(entry, feature, index, codes) {
    if (!codes) return true;
    if (codes.size === 0) return false;
    if (!feature) return false;
    const field = detectMicroField(entry);
    if (!field) return true;
    const props = feature.properties || {};
    if (Object.prototype.hasOwnProperty.call(feature, '__microCode')) {
      const code = String(feature.__microCode);
      return codes.has(code);
    }
    const value = props[field];
    if (value === undefined || value === null || value === '') return false;
    const code = String(value);
    feature.__microCode = code;
    return codes.has(code);
  }

  function featuresForLegend(entry) {
    if (!entry?.features) return [];
    if (activeMicroCodes === null) return entry.features;
    if (activeMicroCodes.size === 0) return [];
    return entry.features.filter((feature, index) => featureMatchesCodes(entry, feature, index, activeMicroCodes));
  }

  function buildEmptyLegend(title, note) {
    return {
      title,
      items: [['Sem dados no filtro atual', '#d1d5db', '']],
      note: note || null
    };
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
@@ -589,402 +599,441 @@
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
        try {
          const geojson = await fetchMaybeGz(url);
          features.push(...toFeatures(geojson));
        } catch (error) {
          console.error(`Falha ao carregar ${def.name} (${file}):`, error);
        }
      }
      entry.features = features;
      detectMicroField(entry);
      updateLegendForKey(def.key);
      return features;
    })().catch(error => {
      console.error(`Falha ao carregar ${def.name}:`, error);
      entry.loadPromise = null;
      throw error;
    });
    return entry.loadPromise;
  }

  async function ensureGeoLayer(entry) {
    await loadFeatures(entry);
    if (!entry.geoLayer) {
      entry.geoLayer = createGeoLayer(entry);
      entry.layerGroup.addLayer(entry.geoLayer);
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

  function buildLegendData(entry) {
    if (!entry || !entry.features?.length) return null;
    const key = entry.def.key;
    const titleBase = LEGEND_TITLES[key] || entry.def.name;
    const filterActive = activeMicroCodes !== null;
    const title = filterActive ? `${titleBase} — filtro ativo` : titleBase;
    const note = filterActive ? 'Valores calculados apenas para as microbacias filtradas.' : null;
    const features = featuresForLegend(entry);
    if (!features.length) return buildEmptyLegend(title, note);

    if (key === 'declividade') {
      const { total, map } = summarizeAreasByClass(features, feature => {
        const props = feature?.properties || {};
        return String(props[CLASS_FIELDS.declividade] || '').trim();
      });
      const items = slopeOrder.map((code, index) => {
        const area = map.get(code) || 0;
        const pct = total > 0 ? (area / total) * 100 : 0;
        return [slopeLabels[index], slopeColors[index], `${fmt.ha(area)} ha (${pct.toFixed(1)}%)`];
      });
      return { title, items, note };
    }
    if (key === 'altimetria') {
      const { total, map } = summarizeAreasByClass(features, feature => {
        const props = feature?.properties || {};
        return String(props[CLASS_FIELDS.altimetria] || '').trim();
      });
      const entries = Array.from(map.entries());
      if (!entries.length) return buildEmptyLegend(title, note);
      const items = entries
        .map(([label, area]) => {
          const pct = total > 0 ? (area / total) * 100 : 0;
          return [label, altColorFor(label), `${fmt.ha(area)} ha (${pct.toFixed(1)}%)`];
        })
        .sort((a, b) => {
          const na = Number(String(a[0]).match(/^(\d+)/)?.[1] || 0);
          const nb = Number(String(b[0]).match(/^(\d+)/)?.[1] || 0);
          return na - nb;
        });
      return { title, items, note };
    }
    if (key === 'uso_solo') {
      const { total, map } = summarizeAreasByClass(features, feature => {
        const props = feature?.properties || {};
        const field = Object.prototype.hasOwnProperty.call(props, CLASS_FIELDS.uso_solo)
          ? CLASS_FIELDS.uso_solo
          : 'NIVEL_I';
        return String(props[field] || '').trim();
      });
      const entries = Array.from(map.entries());
      if (!entries.length) return buildEmptyLegend(title, note);
      const items = entries
        .map(([label, area]) => {
          const pct = total > 0 ? (area / total) * 100 : 0;
          const color = usoColors[label] || usoFallbackColors[label] || '#31a354';
          return [label, color, `${fmt.ha(area)} ha (${pct.toFixed(1)}%)`];
        })
        .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
      return { title, items, note };
    }
    if (key === 'solos') {
      const { total, map } = summarizeAreasByClass(features, feature => {
        const props = feature?.properties || {};
        return String(props[CLASS_FIELDS.solos] || '').trim();
      });
      const entries = Array.from(map.entries());
      if (!entries.length) return buildEmptyLegend(title, note);
      const items = entries
        .map(([label, area]) => {
          const pct = total > 0 ? (area / total) * 100 : 0;
          const color = soilColors[label] || '#dfc27d';
          return [label, color, `${fmt.ha(area)} ha (${pct.toFixed(1)}%)`];
        })
        .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
      return { title, items, note };
    }
    return null;
  }

  function renderLegend(key) {
    const entry = datasetByKey[key];
    const data = entry?.legendData;
    if (!data || !legendDockContainer) return;
    let node = legendNodes[key];
    if (!node) {
      node = document.createElement('div');
      node.className = 'legend';
      node.dataset.legendKey = key;
      legendDockContainer.appendChild(node);
      legendNodes[key] = node;
    }
    node.innerHTML = '';
    const titleEl = document.createElement('div');
    titleEl.className = 'legend-title';
    titleEl.textContent = data.title;
    node.appendChild(titleEl);
    const listEl = document.createElement('div');
    listEl.className = 'legend-list';
    data.items.forEach(([label, color, extra]) => {
      const row = document.createElement('div');
      row.className = 'leg-row';
      const sw = document.createElement('span');
      sw.className = 'sw';
      sw.style.background = color;
      row.appendChild(sw);
      const labelEl = document.createElement('span');
      labelEl.className = 'leg-label';
      labelEl.textContent = label;
      row.appendChild(labelEl);
      if (extra) {
        const extraEl = document.createElement('span');
        extraEl.className = 'leg-extra';
        extraEl.textContent = extra;
        row.appendChild(extraEl);
      }
      listEl.appendChild(row);
    });
    node.appendChild(listEl);
    if (data.note) {
      const noteEl = document.createElement('div');
      noteEl.className = 'legend-note';
      noteEl.textContent = data.note;
      node.appendChild(noteEl);
    }
  }

  function removeLegend(key) {
    const node = legendNodes[key];
    if (!node || !legendDockContainer) return;
    if (legendDockContainer.contains(node)) legendDockContainer.removeChild(node);
    delete legendNodes[key];
  }

  function updateLegendForKey(key) {
    const entry = datasetByKey[key];
    if (!entry || !entry.features) return;
    const legendData = buildLegendData(entry);
    entry.legendData = legendData;
    if (!legendData || !map.hasLayer(entry.layerGroup)) {
      removeLegend(key);
      return;
    }
    renderLegend(key);
  }

  function updateLegendsForSelection() {
    LEGEND_LAYER_KEYS.forEach(key => {
      const entry = datasetByKey[key];
      if (entry?.features) updateLegendForKey(key);
    });
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
    const addValue = (set, value) => {
      if (value === undefined || value === null) return;
      const text = String(value).trim();
      if (text) set.add(text);
    };
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
      addValue(record.org, props.Classe);
      addValue(record.regionals, props.RegIdr);
      addValue(record.regionals, props.Regiao);
      addValue(record.municipios, props.Municipio || props.municipio_);
      addValue(record.nomeBacias, props.Nome_bacia);
      addValue(record.mananciais, props.Manancial);
      cafByCode.set(code, record);
    }

    const table = [];
    (microEntry.features || []).forEach((feature, index) => {
      const props = feature?.properties || {};
      const code = assignMicroCode(feature, index);
      const rawCode = props.Cod_man;
      const cafInfo = cafByCode.get(String(rawCode ?? ''));
      const orgList = toCleanArray([
        ...(cafInfo ? Array.from(cafInfo.org) : []),
        props.Classe
      ]);
      const regionals = toCleanArray([
        ...(cafInfo ? Array.from(cafInfo.regionals) : []),
        props.RegIdr,
        props.Regiao,
        props.Nome_bacia
      ]);
      const municipios = toCleanArray([
        ...(cafInfo ? Array.from(cafInfo.municipios) : []),
        props.Municipio,
        props.municipio_,
        props.MUNICIPIO
      ]);
      const nomeBacias = toCleanArray([
        ...(cafInfo ? Array.from(cafInfo.nomeBacias) : []),
        props.Nome_bacia
      ]);
      const mananciais = toCleanArray([
        ...(cafInfo ? Array.from(cafInfo.mananciais) : []),
        props.Manancial
      ]);
      const org = orgList[0] || '';
      const nomeBacia = nomeBacias[0] || regionals[0] || '';
      const manancial = mananciais[0] || '';
      const labelParts = [];
      if (nomeBacia) labelParts.push(nomeBacia);
      if (municipios.length) labelParts.push(municipios.join(', '));
      if (manancial) labelParts.push(manancial);
      const label = labelParts.join(' • ') || 'Microbacia sem identificação';
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

  async function applyMicroSelection(selectedCodes) {
    const entry = datasetByKey.microbacias;
    if (!entry) return;
    await ensureGeoLayer(entry);
    const allFeatures = entry.features || [];
    if (!allFeatures.length) return;
    const allCodes = allFeatures.map((feature, index) => assignMicroCode(feature, index));
    const codes = selectedCodes instanceof Set
      ? new Set(Array.from(selectedCodes, code => String(code)))
      : new Set(allCodes);
    const subset = allFeatures.filter((feature, index) => codes.has(assignMicroCode(feature, index)));
    const subsetCodes = new Set(subset.map(feature => String(feature.__microCode || '')));
    const isFull = subset.length === allFeatures.length && subset.length > 0;

    if (entry.filteredLayer) {
      entry.layerGroup.removeLayer(entry.filteredLayer);
      entry.filteredLayer = null;
    }

    if (isFull) {
      if (!entry.layerGroup.hasLayer(entry.geoLayer)) entry.layerGroup.addLayer(entry.geoLayer);
      activeMicroCodes = null;
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
      if (subset.length) {
        const bounds = entry.filteredLayer.getBounds();
        if (bounds && bounds.isValid()) {
          map.fitBounds(bounds.pad(0.12));
        }
      }
      activeMicroCodes = subsetCodes;
    }

    updateLegendsForSelection();
  }

  async function init() {
    LAYERS.forEach(def => {
      const entry = ensureDatasetEntry(def);
      if (def.initiallyVisible) {
        entry.layerGroup.addTo(map);
      }
    });
    const microEntry = datasetByKey.microbacias;
    if (microEntry) {
      try {
        await ensureGeoLayer(microEntry);
        const bounds = microEntry.geoLayer?.getBounds();
        if (bounds && bounds.isValid()) {
          map.fitBounds(bounds.pad(0.08));
        }
      } catch (err) {
        console.error('Falha ao carregar Microbacias:', err);
        alert('Falha ao carregar Microbacias. Consulte o console para detalhes.');
      }
    }
    ensureMicroTable().catch(() => {});
    map.attributionControl.setPrefix(false);
    map.attributionControl.addAttribution('Água Segura • classes + filtros com legendas dinâmicas');
  }

  map.on('overlayadd', event => {
    const key = event.layer?.datasetKey;
    if (!key) return;
    const entry = datasetByKey[key];
    if (!entry) return;
    ensureGeoLayer(entry)
      .then(() => {
        if (LEGEND_LAYER_KEYS.has(key)) {
          updateLegendForKey(key);
        }
      })
      .catch(err => {
        console.error(`Falha ao ativar camada ${entry.def.name}:`, err);
      });
  });

  map.on('overlayremove', event => {
    const key = event.layer?.datasetKey;
    if (!key) return;
    if (LEGEND_LAYER_KEYS.has(key)) removeLegend(key);
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
