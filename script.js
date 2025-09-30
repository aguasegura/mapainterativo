(() => {
  'use strict';

  const turf = window.turf || null;
  const pako = window.pako || null;

  function resolveAppBaseUrl() {
    try {
      if (typeof window !== 'undefined' && window.__APP_BASE_URL__) {
        return window.__APP_BASE_URL__;
      }
      const base = new URL('./', window.location.href);
      if (typeof window !== 'undefined') {
        window.__APP_BASE_URL__ = base.href;
      }
      return base.href;
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
        maximumFractionDigits: digits
      });
    },
    count(value) {
      if (!Number.isFinite(value)) return '0';
      return Math.round(value).toLocaleString('pt-BR');
    },
    pct(value) {
      if (!Number.isFinite(value)) return '0,0';
      return value.toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      });
    }
  };

  const CODE_FIELD_CANDIDATES = ['Cod_man', 'COD_MAN', 'cod_man', 'codman'];
  const MICRO_NAME_FIELDS = ['Nome_bacia', 'NOME_BACIA', 'nome_bacia'];
  const MICRO_MANANCIAL_FIELDS = ['Manancial', 'MANANCIAL', 'Manancia', 'MANANCIA'];
  const MICRO_REGION_FIELDS = [
    'Região',
    'Regiao',
    'REGIÃO',
    'REGIAO',
    'Página1_R',
    'Pagina1_R',
    'PAGINA1_R',
    'Creg'
  ];
  const MICRO_MUNICIPIO_FIELDS = [
    'Município',
    'Municipio',
    'MUNICÍPIO',
    'MUNICIPIO',
    'Municipio_',
    'MUNICIPIO_',
    'Página1_N',
    'Pagina1_N',
    'PAGINA1_N'
  ];
  const MICRO_CLASS_FIELDS = ['Classe', 'CLASSE'];
  const DECLIVIDADE_FIELDS = ['ClDec', 'CLDEC', 'cldec'];
  const ALTIMETRIA_FIELDS = ['ClAlt', 'CLALT', 'clalt'];
  const USO_FIELDS = ['NIVEL_II', 'Nivel_II', 'nivel_ii'];
  const USO_FALLBACK_FIELDS = ['NIVEL_I', 'Nivel_I', 'nivel_i'];
  const SOLOS_FIELDS = ['Cl_solos', 'CL_SOLOS', 'cl_solos'];

  const SLOPE_CLASSES = ['000a003', '003a008', '008a015', '015a025', '025a045', '045a100', '>100'];
  const SLOPE_LABELS = ['0–3%', '3–8%', '8–15%', '15–25%', '25–45%', '45–100%', '>100%'];
  const SLOPE_COLORS = ['#edf8e9', '#c7e9c0', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#0c2c84'];

  const ALT_RAMP = ['#ffffcc', '#c2e699', '#78c679', '#31a354', '#006837', '#00441b'];

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

  function trim(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
  }

  function normaliseText(value) {
    return trim(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function sortedUnique(values) {
    const set = new Set();
    values.forEach(value => {
      const trimmed = trim(value);
      if (trimmed) {
        set.add(trimmed);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseNumeric(value) {
    if (value === undefined || value === null || value === '') return Number.NaN;
    if (typeof value === 'number') return value;
    const text = String(value).trim();
    if (!text) return Number.NaN;
    const cleaned = text
      .replace(/\s+/g, '')
      .replace(/[^0-9.,-]/g, '');
    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');
    let normalised = cleaned;
    if (hasComma && hasDot) {
      normalised = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (hasComma) {
      normalised = cleaned.replace(',', '.');
    }
    const parsed = Number(normalised);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  function getFirstValue(props, candidates) {
    if (!props) return '';
    const lower = Object.create(null);
    Object.keys(props).forEach(key => {
      lower[key.toLowerCase()] = key;
    });
    for (const candidate of candidates) {
      const key = lower[candidate.toLowerCase()];
      if (key !== undefined) {
        const value = props[key];
        if (value !== undefined && value !== null && value !== '') {
          return value;
        }
      }
    }
    return '';
  }

  function getUsoClass(props) {
    const value = getFirstValue(props, USO_FIELDS);
    if (value) return value;
    return getFirstValue(props, USO_FALLBACK_FIELDS);
  }

  function getUsoColor(value) {
    if (!value) return '#31a354';
    return USO_COLORS[value] || USO_FALLBACK_COLORS[value] || '#31a354';
  }

  function getSoilColor(value) {
    if (!value) return '#d9b26f';
    const key = String(value).toUpperCase();
    return SOIL_COLORS[key] || '#d9b26f';
  }

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

  function parseRangeStart(value) {
    const match = String(value).match(/(\d+)/);
    return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
  }

  function makeDataUrl(file) {
    return new URL(file, DATA_BASE_URL).href;
  }

  async function fetchGeoJsonFile(file) {
    const url = makeDataUrl(file);
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ao carregar ${file}`);
    }
    if (file.toLowerCase().endsWith('.gz')) {
      const buffer = await response.arrayBuffer();
      if (!buffer || !buffer.byteLength) return [];
      let text;
      try {
        if (pako && typeof pako.ungzip === 'function') {
          text = pako.ungzip(new Uint8Array(buffer), { to: 'string' });
        } else if (pako && typeof pako.inflate === 'function') {
          text = pako.inflate(new Uint8Array(buffer), { to: 'string' });
        } else {
          text = new TextDecoder('utf-8').decode(new Uint8Array(buffer));
        }
      } catch (error) {
        console.warn('Falha ao descompactar', file, error);
        text = new TextDecoder('utf-8').decode(new Uint8Array(buffer));
      }
      return parseGeoJson(text);
    }
    const text = await response.text();
    return parseGeoJson(text);
  }

  function parseGeoJson(payload) {
    if (!payload) return [];
    let data = payload;
    if (typeof payload === 'string') {
      try {
        data = JSON.parse(payload);
      } catch (error) {
        console.warn('JSON inválido detectado durante o carregamento.', error);
        return [];
      }
    }
    if (!data) return [];
    if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
      return data.features.filter(Boolean);
    }
    if (data.type === 'Feature') {
      return [data];
    }
    return [];
  }

  function computeAreaHa(feature) {
    if (!feature || !turf) return 0;
    try {
      const area = turf.area(feature);
      return Number.isFinite(area) ? area / 10000 : 0;
    } catch (error) {
      console.warn('Falha ao calcular área de uma feição.', error);
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
    const props = feature?.properties || {};
    const code = codeField ? trim(props[codeField]) : '';
    let areaHa = 0;
    if (def.type === 'polygon') {
      areaHa = computeAreaHa(feature);
    }
    if (!areaHa && def.areaProperty) {
      const raw = props[def.areaProperty];
      const parsed = parseNumeric(raw);
      if (Number.isFinite(parsed)) {
        if (def.areaUnit === 'm2') {
          areaHa = parsed / 10000;
        } else if (def.areaUnit === 'km2') {
          areaHa = parsed * 100;
        } else {
          areaHa = parsed;
        }
      }
    }
    let lengthKm = 0;
    if (def.lengthProperty) {
      const rawLen = props[def.lengthProperty];
      const parsedLen = parseNumeric(rawLen);
      if (Number.isFinite(parsedLen)) {
        if (def.lengthUnit === 'm') {
          lengthKm = parsedLen / 1000;
        } else {
          lengthKm = parsedLen;
        }
      }
    }
    if (!lengthKm && def.type === 'line') {
      lengthKm = computeLengthKm(feature);
    }
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
    const region = trim(getFirstValue(props, MICRO_REGION_FIELDS));
    const municipio = trim(getFirstValue(props, MICRO_MUNICIPIO_FIELDS));
    const manancial = trim(getFirstValue(props, MICRO_MANANCIAL_FIELDS));
    const microClass = trim(getFirstValue(props, MICRO_CLASS_FIELDS));
    return {
      feature,
      code,
      areaHa,
      lengthKm,
      pointCount,
      classValue,
      region,
      municipio,
      manancial,
      microClass
    };
  }

  function createPopupContent(feature) {
    const props = feature?.properties;
    if (!props) return '';
    const keys = Object.keys(props);
    if (!keys.length) return '';
    const limit = Math.min(keys.length, 12);
    const pieces = [];
    for (let i = 0; i < limit; i += 1) {
      const key = keys[i];
      const value = props[key];
      if (value === undefined || value === null) continue;
      pieces.push(`<div><span class=\"popup-key\">${escapeHtml(key)}</span>: ${escapeHtml(value)}</div>`);
    }
    return pieces.join('');
  }

  function buildGeoJsonLayer(def, features) {
    const options = {};
    if (def.type === 'polygon' || def.type === 'line') {
      options.style = feature => (def.type === 'line'
        ? getLineStyle(def, feature)
        : getPolygonStyle(def, feature));
    }
    if (def.type === 'point') {
      options.pointToLayer = (feature, latlng) => L.circleMarker(latlng, getPointStyle(def, feature));
    }
    options.onEachFeature = (feature, layer) => {
      const content = createPopupContent(feature);
      if (content) {
        layer.bindPopup(`<div class=\"popup-content\">${content}</div>`);
      }
    };
    return L.geoJSON(features, options);
  }

  function getPolygonStyle(def, feature) {
    const opacity = currentOpacity;
    switch (def.key) {
      case 'microbacias':
        return {
          color: '#1d4ed8',
          weight: 1.2,
          fillColor: '#bfdbfe',
          fillOpacity: 0.25 * opacity,
          opacity
        };
      case 'declividade': {
        const props = feature?.properties || {};
        const value = trim(getFirstValue(props, DECLIVIDADE_FIELDS));
        const idx = SLOPE_CLASSES.indexOf(value);
        const fillColor = SLOPE_COLORS[idx >= 0 ? idx : 0];
        return {
          color: '#1f2937',
          weight: 0.5,
          fillColor,
          fillOpacity: 0.65 * opacity,
          opacity
        };
      }
      case 'altimetria': {
        const props = feature?.properties || {};
        const value = trim(getFirstValue(props, ALTIMETRIA_FIELDS));
        return {
          color: '#1f2937',
          weight: 0.45,
          fillColor: altColorFor(value),
          fillOpacity: 0.6 * opacity,
          opacity
        };
      }
      case 'uso_solo': {
        const props = feature?.properties || {};
        const value = trim(getUsoClass(props));
        return {
          color: '#1f2937',
          weight: 0.45,
          fillColor: getUsoColor(value),
          fillOpacity: 0.55 * opacity,
          opacity
        };
      }
      case 'solos': {
        const props = feature?.properties || {};
        const value = trim(getFirstValue(props, SOLOS_FIELDS)).toUpperCase();
        return {
          color: '#1f2937',
          weight: 0.5,
          fillColor: getSoilColor(value),
          fillOpacity: 0.6 * opacity,
          opacity
        };
      }
      case 'construcoes':
        return {
          color: '#111827',
          weight: 0.35,
          fillColor: '#1f2937',
          fillOpacity: Math.min(0.65, 0.3 + opacity * 0.6),
          opacity: Math.min(0.9, opacity + 0.15)
        };
      default:
        return {
          color: '#1f2937',
          weight: 0.5,
          fillColor: '#cbd5f5',
          fillOpacity: 0.5 * opacity,
          opacity
        };
    }
  }

  function getLineStyle(def) {
    const opacity = currentOpacity;
    switch (def.key) {
      case 'curvasdenivel':
        return {
          color: '#9ca3af',
          weight: 1,
          opacity,
          dashArray: '4,4'
        };
      case 'estradas':
        return {
          color: '#737373',
          weight: 2,
          opacity,
          dashArray: '6,4'
        };
      case 'hidrografia':
        return {
          color: '#2563eb',
          weight: 2.2,
          opacity,
          lineCap: 'round'
        };
      default:
        return {
          color: '#1f2937',
          weight: 1.5,
          opacity
        };
    }
  }

  function getPointStyle(def) {
    const opacity = currentOpacity;
    const base = {
      radius: 5,
      color: '#111827',
      weight: 1,
      fillColor: '#4b5563',
      fillOpacity: Math.min(1, opacity + 0.2),
      opacity
    };
    switch (def.key) {
      case 'nascentes':
        return { ...base, color: '#0ea5e9', fillColor: '#38bdf8', fillOpacity: Math.min(1, opacity + 0.25) };
      case 'sigarh':
        return { ...base, color: '#c2410c', fillColor: '#fb923c' };
      case 'caf':
        return { ...base, color: '#047857', fillColor: '#34d399' };
      case 'educacao':
        return { ...base, color: '#6b21a8', fillColor: '#a855f7' };
      case 'aves':
        return { ...base, color: '#d97706', fillColor: '#fbbf24' };
      case 'bovinos':
        return { ...base, color: '#78350f', fillColor: '#f59e0b' };
      case 'bubalinos':
        return { ...base, color: '#92400e', fillColor: '#facc15' };
      case 'suinos':
        return { ...base, color: '#b91c1c', fillColor: '#f87171' };
      default:
        return base;
    }
  }

  function legendColorFor(def, feature) {
    if (def.type === 'point') {
      const style = getPointStyle(def, feature);
      return style.fillColor || style.color || '#1f2937';
    }
    if (def.type === 'line') {
      const style = getLineStyle(def, feature);
      return style.color || '#1f2937';
    }
    const style = getPolygonStyle(def, feature);
    return style.fillColor || style.color || '#1f2937';
  }

  const layerDefs = [
    {
      key: 'microbacias',
      name: 'Microbacias',
      type: 'polygon',
      files: ['baciasselecionadas.geojson_part-001.gz'],
      areaProperty: 'Area_ha',
      legend: {
        type: 'area-total',
        title: 'Microbacias',
        color: '#1d4ed8',
        includeCount: true
      }
    },
    {
      key: 'declividade',
      name: 'Declividade',
      type: 'polygon',
      files: [
        'declividade__declividade_otto.geojson_part-001.gz',
        'declividade__declividade_otto.geojson_part-002.gz'
      ],
      areaProperty: 'AreaHa',
      legend: {
        type: 'area-classes',
        title: 'Declividade (%)',
        getClass: (_, props) => getFirstValue(props, DECLIVIDADE_FIELDS),
        getColor: value => {
          const idx = SLOPE_CLASSES.indexOf(trim(value));
          return SLOPE_COLORS[idx >= 0 ? idx : 0];
        },
        order: SLOPE_CLASSES,
        labelFor: value => {
          const idx = SLOPE_CLASSES.indexOf(trim(value));
          return idx >= 0 ? SLOPE_LABELS[idx] : value;
        }
      }
    },
    {
      key: 'altimetria',
      name: 'Altimetria',
      type: 'polygon',
      files: ['altimetria__altimetria_otto.geojson_part-001.gz'],
      areaProperty: 'AreaHa',
      legend: {
        type: 'area-classes',
        title: 'Altimetria (m)',
        getClass: (_, props) => getFirstValue(props, ALTIMETRIA_FIELDS),
        getColor: value => altColorFor(value),
        sorter: (a, b) => parseRangeStart(a.value) - parseRangeStart(b.value)
      }
    },
    {
      key: 'uso_solo',
      name: 'Uso do Solo',
      type: 'polygon',
      files: [
        'uso_solo__usodosolo_otto.geojson_part-001.gz',
        'uso_solo__usodosolo_otto.geojson_part-002.gz',
        'uso_solo__usodosolo_otto.geojson_part-003.gz',
        'uso_solo__usodosolo_otto.geojson_part-004.gz'
      ],
      areaProperty: 'Area_ha_1',
      legend: {
        type: 'area-classes',
        title: 'Uso do Solo',
        getClass: (_, props) => getUsoClass(props),
        getColor: value => getUsoColor(value)
      }
    },
    {
      key: 'solos',
      name: 'Solos',
      type: 'polygon',
      files: ['solos__solos_otto.geojson_part-001.gz'],
      areaProperty: 'Area_ha_1',
      legend: {
        type: 'area-classes',
        title: 'Solos',
        getClass: (_, props) => getFirstValue(props, SOLOS_FIELDS),
        getColor: value => getSoilColor(value)
      }
    },
    {
      key: 'construcoes',
      name: 'Construções',
      type: 'polygon',
      files: [
        'construcoes__construcoes_otto.geojson_part-001.gz',
        'construcoes__construcoes_otto.geojson_part-002.gz'
      ],
      areaProperty: 'area_in_meters',
      areaUnit: 'm2',
      legend: {
        type: 'area-total',
        title: 'Construções',
        color: '#1f2937',
        includeCount: true
      }
    },
    {
      key: 'curvasdenivel',
      name: 'Curvas de Nível',
      type: 'line',
      files: [
        'curvasdenivel__curvas_otto.geojson_part-001.gz',
        'curvasdenivel__curvas_otto.geojson_part-002.gz',
        'curvasdenivel__curvas_otto.geojson_part-003.gz',
        'curvasdenivel__curvas_otto.geojson_part-004.gz'
      ],
      legend: {
        type: 'length-total',
        title: 'Curvas de Nível',
        color: '#9ca3af',
        unit: 'km'
      }
    },
    {
      key: 'estradas',
      name: 'Estradas',
      type: 'line',
      files: ['estradas__estradas_otto.geojson_part-001.gz'],
      legend: {
        type: 'length-total',
        title: 'Estradas',
        color: '#737373',
        unit: 'km'
      }
    },
    {
      key: 'hidrografia',
      name: 'Hidrografia',
      type: 'line',
      files: ['hidrografia__hidrografia_otto.geojson_part-001.gz'],
      lengthProperty: 'CompM',
      lengthUnit: 'm',
      legend: {
        type: 'length-total',
        title: 'Hidrografia',
        color: '#2563eb',
        unit: 'km'
      }
    },
    {
      key: 'nascentes',
      name: 'Nascentes',
      type: 'point',
      files: ['nascentes__nascentes_otto.geojson_part-001.gz'],
      legend: {
        type: 'count-total',
        title: 'Nascentes',
        unit: 'pontos'
      }
    },
    {
      key: 'sigarh',
      name: 'SIGARH',
      type: 'point',
      files: ['sigarh.geojson_part-001.gz'],
      legend: {
        type: 'count-total',
        title: 'Usos de água (SIGARH)',
        unit: 'registros'
      }
    },
    {
      key: 'caf',
      name: 'CAF',
      type: 'point',
      files: ['caf.geojson_part-001.gz'],
      legend: {
        type: 'count-total',
        title: 'CAF',
        unit: 'registros'
      }
    },
    {
      key: 'educacao',
      name: 'Educação',
      type: 'point',
      files: ['educacao__educacao_otto.geojson_part-001.gz'],
      legend: {
        type: 'count-total',
        title: 'Equipamentos de Educação',
        unit: 'equipamentos'
      }
    },
    {
      key: 'aves',
      name: 'Aves',
      type: 'point',
      files: ['aves__aves.geojson_part-001.gz'],
      legend: {
        type: 'count-total',
        title: 'Estabelecimentos com aves',
        unit: 'registros'
      }
    },
    {
      key: 'bovinos',
      name: 'Bovinos',
      type: 'point',
      files: ['bovinos__bovinos.geojson_part-001.gz'],
      legend: {
        type: 'count-total',
        title: 'Estabelecimentos com bovinos',
        unit: 'registros'
      }
    },
    {
      key: 'bubalinos',
      name: 'Bubalinos',
      type: 'point',
      files: ['bubalinos__bubalinos.geojson_part-001.gz'],
      legend: {
        type: 'count-total',
        title: 'Estabelecimentos com bubalinos',
        unit: 'registros'
      }
    },
    {
      key: 'suinos',
      name: 'Suínos',
      type: 'point',
      files: ['suinos__suinos.geojson_part-001.gz'],
      legend: {
        type: 'count-total',
        title: 'Estabelecimentos com suínos',
        unit: 'registros'
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
  let microOptions = [];
  const allMicroCodes = new Set();
  let activeCodes = new Set();
  let microOptionsReady = false;
  const filterState = {
    region: null,
    municipio: null,
    manancial: null
  };

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

  const fitAllButton = document.getElementById('fitAll');
  if (fitAllButton) {
    fitAllButton.addEventListener('click', () => {
      let combined = null;
      stateByKey.forEach(state => {
        if (!map.hasLayer(state.group) || !state.displayLayer) return;
        const bounds = state.displayLayer.getBounds?.();
        if (!bounds || !bounds.isValid || !bounds.isValid()) return;
        combined = combined ? combined.extend(bounds) : L.latLngBounds(bounds.getSouthWest(), bounds.getNorthEast());
      });
      if (combined && combined.isValid && combined.isValid()) {
        map.fitBounds(combined.pad(0.08));
      }
    });
  }

  layerDefs.forEach(def => {
    const group = L.layerGroup();
    const state = {
      def,
      group,
      ready: false,
      loading: false,
      promise: null,
      features: [],
      enriched: [],
      filtered: [],
      displayLayer: null,
      codeField: null
    };
    stateByKey.set(def.key, state);
    groupLookup.set(group, def.key);
    layerControl.addOverlay(group, def.name);
  });

  map.on('overlayadd', event => {
    const key = groupLookup.get(event.layer);
    if (!key) return;
    const state = stateByKey.get(key);
    if (!state) return;
    if (!state.ready) {
      loadLayer(state).then(() => {
        applyFilters();
      }).catch(error => {
        console.error(`Falha ao carregar a camada ${state.def.name}`, error);
      });
    } else {
      applyFilters();
    }
  });

  map.on('overlayremove', event => {
    if (!groupLookup.has(event.layer)) return;
    updateLegendDock();
  });

  if (microUi.search) {
    microUi.search.addEventListener('input', () => {
      renderMicroList();
    });
  }

  if (microUi.region) {
    microUi.region.addEventListener('change', event => {
      handleFilterChange('region', event.target.value);
    });
  }

  if (microUi.municipio) {
    microUi.municipio.addEventListener('change', event => {
      handleFilterChange('municipio', event.target.value);
    });
  }

  if (microUi.manancial) {
    microUi.manancial.addEventListener('change', event => {
      handleFilterChange('manancial', event.target.value);
    });
  }

  if (microUi.selectAll) {
    microUi.selectAll.addEventListener('click', () => {
      if (!microOptions.length) return;
      activeCodes = new Set(allMicroCodes);
      updateMicroSummary();
      renderMicroList();
      applyFilters({ fitToMicro: true });
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

  if (microUi.resetFilters) {
    microUi.resetFilters.addEventListener('click', () => {
      filterState.region = null;
      filterState.municipio = null;
      filterState.manancial = null;
      refreshFilterSelectors();
      updateMicroSummary();
      renderMicroList();
      applyFilters({ fitToMicro: true });
    });
  }

  function getEffectiveCodes() {
    if (!microOptionsReady || !microOptions.length) return null;
    const selectionCodes = getSelectionCodes();
    const filterCodes = getFilterCodes();
    if (!selectionCodes && !filterCodes) return null;
    if (selectionCodes && filterCodes) {
      const intersection = new Set();
      selectionCodes.forEach(code => {
        if (filterCodes.has(code)) {
          intersection.add(code);
        }
      });
      return intersection;
    }
    return selectionCodes || filterCodes || null;
  }

  function getSelectionCodes() {
    if (!microOptionsReady || !microOptions.length) return null;
    if (!activeCodes) return null;
    const total = allMicroCodes.size || microOptions.length;
    if (total === 0) return null;
    if (activeCodes.size === 0) return new Set();
    if (activeCodes.size >= total) return null;
    return new Set(activeCodes);
  }

  function getFilterCodes() {
    if (!microOptionsReady || !microOptions.length) return null;
    const { region, municipio, manancial } = filterState;
    if (!region && !municipio && !manancial) return null;
    const codes = new Set();
    microOptions.forEach(option => {
      if (region && option.region !== region) return;
      if (municipio && option.municipio !== municipio) return;
      if (manancial && option.manancial !== manancial) return;
      codes.add(option.code);
    });
    return codes;
  }

  function hasActiveFilters() {
    if (!microOptionsReady) return false;
    return Boolean(filterState.region || filterState.municipio || filterState.manancial);
  }

  function matchesFilterState(item) {
    if (!hasActiveFilters()) return true;
    if (filterState.region && item.region !== filterState.region) return false;
    if (filterState.municipio && item.municipio !== filterState.municipio) return false;
    if (filterState.manancial && item.manancial !== filterState.manancial) return false;
    return true;
  }

  function matchesMicroFilters(option) {
    if (!hasActiveFilters()) return true;
    if (filterState.region && option.region !== filterState.region) return false;
    if (filterState.municipio && option.municipio !== filterState.municipio) return false;
    if (filterState.manancial && option.manancial !== filterState.manancial) return false;
    return true;
  }

  function describeFilterState() {
    if (!hasActiveFilters()) return '';
    const parts = [];
    if (filterState.region) parts.push(`Região: ${filterState.region}`);
    if (filterState.municipio) parts.push(`Município: ${filterState.municipio}`);
    if (filterState.manancial) parts.push(`Manancial: ${filterState.manancial}`);
    return parts.join(' • ');
  }

  function applyFilters(options = {}) {
    const effectiveCodes = getEffectiveCodes();
    const filtersActive = hasActiveFilters();
    stateByKey.forEach(state => {
      if (!state.ready) return;
      const { def } = state;
      const filteredItems = state.enriched.filter(item => {
        if (effectiveCodes) {
          if (item.code) {
            if (!effectiveCodes.has(item.code)) return false;
          } else if (state.codeField) {
            return false;
          }
        }
        if (filtersActive && !matchesFilterState(item)) {
          return false;
        }
        return true;
      });
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
    if (!state.displayLayer) return;
    state.displayLayer.eachLayer(layer => {
      const feature = layer?.feature;
      if (!feature || typeof layer.setStyle !== 'function') return;
      if (state.def.type === 'point') {
        const style = getPointStyle(state.def, feature);
        layer.setStyle(style);
        if (typeof layer.setRadius === 'function' && typeof style.radius === 'number') {
          layer.setRadius(style.radius);
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
      const tasks = state.def.files.map(file => (async () => {
        try {
          const features = await fetchGeoJsonFile(file);
          collected.push(...features);
        } catch (error) {
          console.error(`Falha ao carregar ${file}`, error);
        }
      })());
      await Promise.all(tasks);
      state.features = collected;
      const sampleProps = collected.find(item => item && item.properties)?.properties || null;
      const codeField = sampleProps ? findField(sampleProps, CODE_FIELD_CANDIDATES) : null;
      state.codeField = codeField;
      state.enriched = collected.map(feature => enrichFeature(state.def, feature, codeField));
      state.ready = true;
      state.loading = false;
      if (state.def.key === 'microbacias') {
        prepareMicroOptions(state.enriched);
      }
      applyFilters();
      return state;
    })();
    return state.promise;
  }

  function prepareMicroOptions(enriched) {
    const mapByCode = new Map();
    enriched.forEach(entry => {
      const { feature, code, manancial, region, municipio, microClass } = entry;
      if (!code || mapByCode.has(code)) return;
      const props = feature?.properties || {};
      const nome = trim(getFirstValue(props, MICRO_NAME_FIELDS));
      const subtitleParts = [];
      if (manancial) subtitleParts.push(`Manancial: ${manancial}`);
      if (microClass) subtitleParts.push(`Classe: ${microClass}`);
      const subtitle = subtitleParts.join(' • ');
      const metaParts = [];
      if (region) metaParts.push(`Região: ${region}`);
      if (municipio) metaParts.push(`Município: ${municipio}`);
      const searchPieces = [code, nome, manancial, microClass, region, municipio].filter(Boolean);
      mapByCode.set(code, {
        code,
        title: nome || `Microbacia ${code}`,
        subtitle,
        region,
        municipio,
        manancial,
        microClass,
        meta: metaParts,
        search: normaliseText(searchPieces.join(' '))
      });
    });
    microOptions = Array.from(mapByCode.values()).sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    allMicroCodes.clear();
    microOptions.forEach(option => allMicroCodes.add(option.code));
    activeCodes = new Set(allMicroCodes);
    microOptionsReady = true;
    refreshFilterSelectors();
    refreshMicroUi();
  }

  function refreshFilterSelectors() {
    if (!microOptionsReady) return;
    const regionValues = sortedUnique(microOptions.map(option => option.region));
    if (filterState.region && !regionValues.includes(filterState.region)) {
      filterState.region = null;
    }
    updateFilterSelect(microUi.region, 'Todas as regiões', regionValues, filterState.region);

    const scopedByRegion = microOptions.filter(option => !filterState.region || option.region === filterState.region);
    const municipioValues = sortedUnique(scopedByRegion.map(option => option.municipio));
    if (filterState.municipio && !municipioValues.includes(filterState.municipio)) {
      filterState.municipio = null;
    }
    updateFilterSelect(microUi.municipio, 'Todos os municípios', municipioValues, filterState.municipio);

    const scopedByMunicipio = scopedByRegion.filter(option => !filterState.municipio || option.municipio === filterState.municipio);
    const manancialValues = sortedUnique(scopedByMunicipio.map(option => option.manancial));
    if (filterState.manancial && !manancialValues.includes(filterState.manancial)) {
      filterState.manancial = null;
    }
    updateFilterSelect(microUi.manancial, 'Todos os mananciais', manancialValues, filterState.manancial);
  }

  function updateFilterSelect(select, placeholder, values, currentValue) {
    if (!select) return;
    const fragment = document.createDocumentFragment();
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = placeholder;
    fragment.appendChild(defaultOption);
    values.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      fragment.appendChild(option);
    });
    select.replaceChildren(fragment);
    select.value = currentValue || '';
    select.disabled = false;
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
    const filterCodes = getFilterCodes();
    const filteredCount = filterCodes ? filterCodes.size : total;
    const selectionCodes = getSelectionCodes();

    if (filteredCount === 0) {
      const description = describeFilterState();
      microUi.summary.textContent = description
        ? `Nenhuma microbacia atende aos filtros (${description}).`
        : 'Nenhuma microbacia disponível para os filtros aplicados.';
      microUi.summary.classList.remove('muted');
      return;
    }

    let selectedCount = 0;
    if (selectionCodes === null) {
      selectedCount = filteredCount;
    } else if (selectionCodes.size === 0) {
      selectedCount = 0;
    } else if (filterCodes) {
      selectionCodes.forEach(code => {
        if (filterCodes.has(code)) {
          selectedCount += 1;
        }
      });
    } else {
      selectedCount = selectionCodes.size;
    }

    let summary = '';
    if (selectionCodes === null) {
      if (filteredCount === total) {
        summary = `Todas as ${total} microbacias selecionadas.`;
      } else {
        summary = `Todas as ${filteredCount} microbacias filtradas selecionadas (de ${total} totais).`;
      }
    } else if (selectedCount === 0) {
      if (filteredCount === total) {
        summary = 'Nenhuma microbacia selecionada.';
      } else {
        summary = `Nenhuma microbacia selecionada dentre ${filteredCount} filtradas (de ${total} totais).`;
      }
    } else if (filteredCount === total) {
      summary = `${selectedCount} de ${total} microbacias selecionadas.`;
    } else {
      summary = `${selectedCount} de ${filteredCount} microbacias filtradas selecionadas (de ${total} totais).`;
    }

    const description = describeFilterState();
    if (description) {
      summary += ` — ${description}`;
    }

    microUi.summary.textContent = summary;
    microUi.summary.classList.remove('muted');
  }

  function renderMicroList() {
    if (!microUi.list) return;
    microUi.list.innerHTML = '';
    const fragment = document.createDocumentFragment();
    const query = microUi.search ? normaliseText(microUi.search.value) : '';
    let rendered = 0;
    if (!microOptionsReady) {
      const info = document.createElement('div');
      info.className = 'micro-empty muted';
      info.textContent = 'Carregando microbacias…';
      fragment.appendChild(info);
    } else {
      microOptions.forEach(option => {
        if (query && !option.search.includes(query)) return;
        if (!matchesMicroFilters(option)) return;
        rendered += 1;
        const label = document.createElement('label');
        label.className = 'micro-option';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = option.code;
        input.checked = activeCodes.size ? activeCodes.has(option.code) : false;
        input.addEventListener('change', event => {
          handleOptionToggle(option.code, event.target.checked);
        });
        const text = document.createElement('div');
        text.className = 'micro-option-text';
        const title = document.createElement('div');
        title.className = 'micro-option-title';
        title.textContent = `${option.code} · ${option.title}`;
        text.appendChild(title);
        if (option.meta && option.meta.length) {
          const meta = document.createElement('div');
          meta.className = 'micro-option-meta';
          meta.textContent = option.meta.join(' • ');
          text.appendChild(meta);
        }
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
      if (query && hasActiveFilters()) {
        empty.textContent = 'Nenhuma microbacia corresponde aos filtros e à busca aplicada.';
      } else if (query) {
        empty.textContent = 'Nenhuma microbacia corresponde à busca.';
      } else if (hasActiveFilters()) {
        empty.textContent = 'Nenhuma microbacia atende aos filtros selecionados.';
      } else {
        empty.textContent = 'Nenhuma microbacia disponível.';
      }
      fragment.appendChild(empty);
    }
    microUi.list.appendChild(fragment);
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

  function handleFilterChange(key, rawValue) {
    if (!filterState || !Object.prototype.hasOwnProperty.call(filterState, key)) return;
    const value = trim(rawValue) || null;
    if (filterState[key] === value) return;
    filterState[key] = value;
    refreshFilterSelectors();
    updateMicroSummary();
    renderMicroList();
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
          <div class="micro-actions">
            <input type="search" class="micro-search" placeholder="Buscar por código, região, município ou manancial" data-role="search" />
            <div class="micro-filters">
              <div class="micro-field">
                <label for="micro-region">Região</label>
                <select id="micro-region" class="micro-select" data-role="region"></select>
              </div>
              <div class="micro-field">
                <label for="micro-municipio">Município</label>
                <select id="micro-municipio" class="micro-select" data-role="municipio"></select>
              </div>
              <div class="micro-field">
                <label for="micro-manancial">Manancial</label>
                <select id="micro-manancial" class="micro-select" data-role="manancial"></select>
              </div>
            </div>
            <div class="micro-buttons">
              <button type="button" class="btn-chip" data-action="select-all">Selecionar todas</button>
              <button type="button" class="btn-chip" data-action="clear">Limpar seleção</button>
              <button type="button" class="btn-chip" data-action="reset-filters">Limpar filtros</button>
            </div>
          </div>
          <div class="micro-list" data-role="list"></div>
        `;
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        return container;
      }
    });
    const control = new Control();
    map.addControl(control);
    const container = control.getContainer();
    return {
      container,
      summary: container.querySelector('[data-role="summary"]'),
      search: container.querySelector('[data-role="search"]'),
      list: container.querySelector('[data-role="list"]'),
      selectAll: container.querySelector('[data-action="select-all"]'),
      clear: container.querySelector('[data-action="clear"]'),
      region: container.querySelector('[data-role="region"]'),
      municipio: container.querySelector('[data-role="municipio"]'),
      manancial: container.querySelector('[data-role="manancial"]'),
      resetFilters: container.querySelector('[data-action="reset-filters"]')
    };
  }

  function createLegendDock() {
    const control = L.control({ position: 'bottomleft' });
    control.onAdd = () => {
      const container = L.DomUtil.create('div', 'legend-dock');
      container.innerHTML = '<div class="legend-empty muted">Ative uma camada para visualizar a legenda dinâmica.</div>';
      return container;
    };
    return control;
  }

  function updateLegendDock() {
    if (!legendContainer) return;
    const entries = [];
    stateByKey.forEach(state => {
      if (!state.ready) return;
      if (!map.hasLayer(state.group)) return;
      const entry = buildLegendEntry(state);
      if (entry) entries.push(entry);
    });
    if (!entries.length) {
      legendContainer.innerHTML = '<div class="legend-empty muted">Ative uma camada para visualizar a legenda dinâmica.</div>';
      return;
    }
    const fragment = document.createDocumentFragment();
    entries.forEach(entry => fragment.appendChild(entry));
    legendContainer.replaceChildren(fragment);
  }

  function buildLegendEntry(state) {
    const legend = state.def.legend;
    if (!legend) return null;
    if (legend.type === 'area-classes') {
      return buildAreaClassesLegend(state.def, legend, state.filtered);
    }
    if (legend.type === 'area-total') {
      return buildAreaTotalLegend(state.def, legend, state.filtered);
    }
    if (legend.type === 'length-total') {
      return buildLengthLegend(state.def, legend, state.filtered);
    }
    if (legend.type === 'count-total') {
      return buildCountLegend(state.def, legend, state.filtered);
    }
    return null;
  }

  function buildAreaClassesLegend(def, legend, items) {
    if (!items || !items.length) {
      return createEmptyLegend(legend.title || def.name);
    }
    const totals = new Map();
    let totalArea = 0;
    items.forEach(item => {
      if (!item.classValue) return;
      const area = item.areaHa || 0;
      if (area <= 0) return;
      totalArea += area;
      totals.set(item.classValue, (totals.get(item.classValue) || 0) + area);
    });
    if (!totals.size || totalArea <= 0) {
      return createEmptyLegend(legend.title || def.name);
    }
    const entries = Array.from(totals.entries()).map(([value, area]) => ({
      value,
      label: legend.labelFor ? legend.labelFor(value) : value,
      color: legend.getColor ? legend.getColor(value) : legendColorFor(def, items[0]?.feature),
      area,
      pct: totalArea ? (area / totalArea) * 100 : 0
    }));
    if (legend.order) {
      entries.sort((a, b) => legend.order.indexOf(a.value) - legend.order.indexOf(b.value));
    } else if (legend.sorter) {
      entries.sort((a, b) => legend.sorter(a, b));
    } else {
      entries.sort((a, b) => (a.label || '').localeCompare(b.label || '', 'pt-BR'));
    }
    const block = document.createElement('section');
    block.className = 'legend-block';
    const title = document.createElement('h4');
    title.textContent = legend.title || def.name;
    block.appendChild(title);
    const list = document.createElement('ul');
    list.className = 'legend-list';
    entries.forEach(entry => {
      const item = document.createElement('li');
      item.className = 'legend-item';
      const swatch = document.createElement('span');
      swatch.className = 'legend-swatch';
      swatch.style.background = entry.color || '#4b5563';
      const label = document.createElement('span');
      label.className = 'legend-label';
      label.textContent = entry.label || entry.value || 'Classe';
      const value = document.createElement('span');
      value.className = 'legend-value';
      value.textContent = `${fmt.ha(entry.area)} ha (${fmt.pct(entry.pct)}%)`;
      item.append(swatch, label, value);
      list.appendChild(item);
    });
    block.appendChild(list);
    return block;
  }

  function createEmptyLegend(title) {
    const block = document.createElement('section');
    block.className = 'legend-block';
    const heading = document.createElement('h4');
    heading.textContent = title || 'Legenda';
    const note = document.createElement('div');
    note.className = 'legend-note';
    note.textContent = 'Nenhuma feição disponível para o filtro aplicado.';
    block.appendChild(heading);
    block.appendChild(note);
    return block;
  }

  function buildAreaTotalLegend(def, legend, items) {
    const totalArea = (items || []).reduce((sum, item) => sum + (item.areaHa || 0), 0);
    const totalCount = (items || []).length;
    const block = document.createElement('section');
    block.className = 'legend-block';
    const title = document.createElement('h4');
    title.textContent = legend.title || def.name;
    block.appendChild(title);
    const list = document.createElement('ul');
    list.className = 'legend-list';
    const color = legend.color || legendColorFor(def, items[0]?.feature);
    const row = document.createElement('li');
    row.className = 'legend-item';
    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.style.background = color;
    const label = document.createElement('span');
    label.className = 'legend-label';
    label.textContent = 'Área total';
    const value = document.createElement('span');
    value.className = 'legend-value';
    value.textContent = `${fmt.ha(totalArea)} ha`;
    row.append(swatch, label, value);
    list.appendChild(row);
    if (legend.includeCount) {
      const countRow = document.createElement('li');
      countRow.className = 'legend-item';
      const spacer = document.createElement('span');
      spacer.className = 'legend-swatch';
      spacer.style.background = 'transparent';
      spacer.style.border = '1px solid transparent';
      const countLabel = document.createElement('span');
      countLabel.className = 'legend-label';
      countLabel.textContent = 'Feições';
      const countValue = document.createElement('span');
      countValue.className = 'legend-value';
      countValue.textContent = fmt.count(totalCount);
      countRow.append(spacer, countLabel, countValue);
      list.appendChild(countRow);
    }
    block.appendChild(list);
    if (totalArea <= 0) {
      const note = document.createElement('div');
      note.className = 'legend-note';
      note.textContent = 'Nenhuma área calculada para o filtro atual.';
      block.appendChild(note);
    }
    return block;
  }

  function buildLengthLegend(def, legend, items) {
    const total = (items || []).reduce((sum, item) => sum + (item.lengthKm || 0), 0);
    if (total <= 0) {
      return createEmptyLegend(legend.title || def.name);
    }
    const block = document.createElement('section');
    block.className = 'legend-block';
    const title = document.createElement('h4');
    title.textContent = legend.title || def.name;
    block.appendChild(title);
    const list = document.createElement('ul');
    list.className = 'legend-list';
    const row = document.createElement('li');
    row.className = 'legend-item';
    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch line';
    swatch.style.background = legend.color || legendColorFor(def, items[0]?.feature);
    const label = document.createElement('span');
    label.className = 'legend-label';
    label.textContent = 'Extensão total';
    const value = document.createElement('span');
    value.className = 'legend-value';
    value.textContent = `${fmt.km(total)} ${legend.unit || 'km'}`;
    row.append(swatch, label, value);
    list.appendChild(row);
    block.appendChild(list);
    return block;
  }

  function buildCountLegend(def, legend, items) {
    const total = (items || []).reduce((sum, item) => sum + (item.pointCount || 1), 0);
    if (total <= 0) {
      return createEmptyLegend(legend.title || def.name);
    }
    const block = document.createElement('section');
    block.className = 'legend-block';
    const title = document.createElement('h4');
    title.textContent = legend.title || def.name;
    block.appendChild(title);
    const list = document.createElement('ul');
    list.className = 'legend-list';
    const row = document.createElement('li');
    row.className = 'legend-item';
    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.style.background = legend.color || legendColorFor(def, items[0]?.feature);
    const label = document.createElement('span');
    label.className = 'legend-label';
    label.textContent = 'Quantidade';
    const value = document.createElement('span');
    value.className = 'legend-value';
    value.textContent = `${fmt.count(total)} ${legend.unit || 'registros'}`;
    row.append(swatch, label, value);
    list.appendChild(row);
    block.appendChild(list);
    return block;
  }

  (async function init() {
    const microState = stateByKey.get('microbacias');
    if (microState) {
      await loadLayer(microState);
      if (!map.hasLayer(microState.group)) {
        map.addLayer(microState.group);
      }
      applyFilters({ fitToMicro: true });
    }
  })();
})();
