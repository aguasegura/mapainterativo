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

  const FILTER_ALIASES = {
    region: ['Regional', 'regional', 'regional i', 'Regional_I', 'RegionalI', 'regional_i', 'Regional IDR', 'Regional_IDR'],
    municipality: ['municipio'],
    manancial: ['manancial']
  };

  const DEFAULT_CATEGORY_COLORS = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b',
    '#e377c2', '#7f7f7f', '#bcbd22', '#17becf', '#3182bd', '#31a354',
    '#e6550d', '#636363', '#bdbdbd', '#393b79', '#637939', '#8c6d31',
    '#843c39', '#7b4173'
  ];

  const POINT_LAYER_PRESETS = {
    nascentes: { fill: '#0ea5e9', stroke: '#0369a1', label: 'N', fontSize: 11, legendFontSize: 10 },
    aves: { fill: '#facc15', stroke: '#b45309', label: 'Av', fontSize: 10, legendFontSize: 9 },
    bovinos: { fill: '#22c55e', stroke: '#15803d', label: 'Bo', fontSize: 10, legendFontSize: 9 },
    bubalinos: { fill: '#a855f7', stroke: '#5b21b6', label: 'Bu', fontSize: 10, legendFontSize: 9 },
    caf: { fill: '#6366f1', stroke: '#3730a3', label: 'CAF', fontSize: 8, legendFontSize: 7 },
    educacao: { fill: '#06b6d4', stroke: '#0e7490', label: 'Ed', fontSize: 10, legendFontSize: 9 },
    sigarh: { fill: '#fb7185', stroke: '#be123c', label: 'SG', fontSize: 9, legendFontSize: 8 },
    suinos: { fill: '#ef4444', stroke: '#991b1b', label: 'Su', fontSize: 10, legendFontSize: 9 }
  };

  const pointIconCache = new Map();

  const SLOPE_CLASSES = ['000a003', '003a008', '008a015', '015a025', '025a045', '045a100', '>100'];
  const SLOPE_COLORS = ['#f7fcfd', '#ccece6', '#66c2a4', '#41ae76', '#238b45', '#006d2c', '#00441b'];
  const SLOPE_PALETTE = Object.fromEntries(SLOPE_CLASSES.map((cls, idx) => [cls, SLOPE_COLORS[idx] || '#444444']));
  const SLOPE_LABELS = {
    '000a003': '0% a 3%',
    '003a008': '3% a 8%',
    '008a015': '8% a 15%',
    '015a025': '15% a 25%',
    '025a045': '25% a 45%',
    '045a100': '45% a 100%',
    '>100': '> 100%'
  };

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

  function escapeHtml(value) {
    return `${value ?? ''}`
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function findNumericCoordinate(node) {
    if (!node) return null;
    if (Array.isArray(node)) {
      if (typeof node[0] === 'number' && typeof node[1] === 'number') {
        return node;
      }
      for (const item of node) {
        const match = findNumericCoordinate(item);
        if (match) return match;
      }
    }
    return null;
  }

  function extractSampleCoordinate(geometry) {
    if (!geometry) return null;
    if (geometry.type === 'GeometryCollection') {
      for (const inner of geometry.geometries || []) {
        const match = extractSampleCoordinate(inner);
        if (match) return match;
      }
      return null;
    }
    return findNumericCoordinate(geometry.coordinates);
  }

  function geometryIsProjected(geometry) {
    const sample = extractSampleCoordinate(geometry);
    if (!sample) return false;
    const [x, y] = sample;
    return Math.abs(x) > 200 || Math.abs(y) > 90;
  }

  const WEB_MERCATOR_RADIUS = 6378137;
  const RAD2DEG = 180 / Math.PI;

  function mercatorToLon(x) {
    if (!Number.isFinite(x)) return 0;
    return (x / WEB_MERCATOR_RADIUS) * RAD2DEG;
  }

  function mercatorToLat(y) {
    if (!Number.isFinite(y)) return 0;
    const latRad = 2 * Math.atan(Math.exp(y / WEB_MERCATOR_RADIUS)) - Math.PI / 2;
    const latDeg = latRad * RAD2DEG;
    return Math.max(Math.min(latDeg, 90), -90);
  }

  function transformCoordsToWgs84(coords) {
    if (!Array.isArray(coords)) return coords;
    if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const lon = mercatorToLon(coords[0]);
      const lat = mercatorToLat(coords[1]);
      if (coords.length > 2) {
        return [lon, lat, ...coords.slice(2)];
      }
      return [lon, lat];
    }
    return coords.map(transformCoordsToWgs84);
  }

  function reprojectGeometryToWgs84(geometry) {
    if (!geometry) return null;
    if (geometry.type === 'GeometryCollection') {
      const geometries = (geometry.geometries || [])
        .map(inner => reprojectGeometryToWgs84(inner))
        .filter(Boolean);
      return geometries.length ? { type: 'GeometryCollection', geometries } : null;
    }
    if (!Array.isArray(geometry.coordinates)) {
      return null;
    }
    return {
      ...geometry,
      coordinates: transformCoordsToWgs84(geometry.coordinates)
    };
  }

  function reprojectFeatureToWgs84(feature) {
    if (!feature) return null;
    const geometry = reprojectGeometryToWgs84(feature.geometry);
    if (!geometry) return null;
    const clone = { type: 'Feature', geometry };
    if (feature.id !== undefined) {
      clone.id = feature.id;
    }
    if (feature.properties && typeof feature.properties === 'object') {
      clone.properties = { ...feature.properties };
    }
    return clone;
  }

  function buildDisplayFeatures(entry) {
    if (!entry) return [];
    const features = Array.isArray(entry.currentFeatures) ? entry.currentFeatures : [];
    if (!features.length) return [];
    if (!entry.isProjected) return features;
    return features
      .map(reprojectFeatureToWgs84)
      .filter(Boolean);
  }

  function planarRingArea(ring) {
    if (!Array.isArray(ring) || ring.length < 4) return 0;
    let sum = 0;
    for (let i = 1; i < ring.length; i += 1) {
      const [x1, y1] = ring[i - 1];
      const [x2, y2] = ring[i];
      sum += x1 * y2 - x2 * y1;
    }
    return Math.abs(sum) / 2;
  }

  function planarPolygonArea(coordinates) {
    if (!Array.isArray(coordinates)) return 0;
    return coordinates.reduce((total, ring, index) => {
      const area = planarRingArea(ring);
      return index === 0 ? total + area : total - area;
    }, 0);
  }

  function planarGeometryArea(geometry) {
    if (!geometry) return 0;
    const { type } = geometry;
    if (type === 'Polygon') {
      return planarPolygonArea(geometry.coordinates);
    }
    if (type === 'MultiPolygon') {
      return (geometry.coordinates || []).reduce((total, polygon) => total + planarPolygonArea(polygon), 0);
    }
    if (type === 'GeometryCollection') {
      return (geometry.geometries || []).reduce((total, inner) => total + planarGeometryArea(inner), 0);
    }
    return 0;
  }

  function planarLineLength(line) {
    if (!Array.isArray(line) || line.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < line.length; i += 1) {
      const [x1, y1] = line[i - 1];
      const [x2, y2] = line[i];
      total += Math.hypot(x2 - x1, y2 - y1);
    }
    return total;
  }

  function planarGeometryLength(geometry) {
    if (!geometry) return 0;
    const { type } = geometry;
    if (type === 'LineString') {
      return planarLineLength(geometry.coordinates);
    }
    if (type === 'MultiLineString') {
      return (geometry.coordinates || []).reduce((total, line) => total + planarLineLength(line), 0);
    }
    if (type === 'GeometryCollection') {
      return (geometry.geometries || []).reduce((total, inner) => total + planarGeometryLength(inner), 0);
    }
    return 0;
  }

  function detectProjected(features) {
    if (!Array.isArray(features)) return false;
    return features.some(feature => geometryIsProjected(feature?.geometry));
  }

  function computeFeatureArea(feature, entry) {
    const geometry = feature?.geometry || null;
    if (!geometry) return 0;
    const usePlanar = entry?.isProjected ?? geometryIsProjected(geometry);
    if (usePlanar) {
      return planarGeometryArea(geometry);
    }
    try {
      return turf.area(feature);
    } catch (error) {
      console.warn('Falha ao calcular área com turf.area; retornando 0.', error);
      return 0;
    }
  }

  function computeFeatureLength(feature, entry) {
    const geometry = feature?.geometry || null;
    if (!geometry) return 0;
    const usePlanar = entry?.isProjected ?? geometryIsProjected(geometry);
    if (usePlanar) {
      return planarGeometryLength(geometry) / 1000;
    }
    try {
      return turf.length(feature, { units: 'kilometers' });
    } catch (error) {
      console.warn('Falha ao calcular comprimento com turf.length; retornando 0.', error);
      return 0;
    }
  }

  function getPointPreset(id) {
    const fallbackLabel = (id || '•').slice(0, 2).toUpperCase();
    return {
      fill: '#ef4444',
      stroke: '#7f1d1d',
      label: fallbackLabel,
      fontSize: 10,
      legendFontSize: 9,
      textColor: '#ffffff',
      ...POINT_LAYER_PRESETS[id]
    };
  }

  function buildPointSVG(preset, { size = 26, strokeWidth, fontSize } = {}) {
    const resolvedFontSize = fontSize ?? preset.fontSize ?? 10;
    const resolvedStroke = strokeWidth ?? 2;
    const label = escapeHtml(preset.label || '');
    const hasLabel = label.trim().length > 0;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">` +
      `<circle cx="12" cy="12" r="9" fill="${preset.fill}" stroke="${preset.stroke}" stroke-width="${resolvedStroke}" />` +
      (hasLabel
        ? `<text x="12" y="12" text-anchor="middle" dominant-baseline="middle" font-family="Inter, 'Segoe UI', sans-serif" font-size="${resolvedFontSize}" font-weight="700" fill="${preset.textColor || '#ffffff'}">${label}</text>`
        : '') +
      '</svg>';
  }

  function getPointIcon(entry, { size = 28 } = {}) {
    const key = `${entry.id}:${size}`;
    if (!pointIconCache.has(key)) {
      const preset = getPointPreset(entry.id);
      const svg = buildPointSVG(preset, { size });
      const icon = L.divIcon({
        className: `point-marker point-marker-${entry.id}`,
        html: svg,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -(size / 2) + 4]
      });
      pointIconCache.set(key, icon);
    }
    return pointIconCache.get(key);
  }

  function getPointLegendSVG(entry) {
    const preset = getPointPreset(entry.id);
    const fontSize = preset.legendFontSize ?? Math.max((preset.fontSize || 10) - 1, 7);
    return buildPointSVG(preset, { size: 18, strokeWidth: 1.8, fontSize });
  }

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
    'Corpos d'Água': '#4c78a8',
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
      name: 'Altimetria (classes)',
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
      classLabels: SLOPE_LABELS,
      visualHints: 'Camada detalhada; reduza a opacidade ou utilize a alternativa de altimetria para visão geral.'
    },
    {
      id: 'solos',
      name: 'Tipos de Solos',
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
        'uso_solo__usodosolo_otto.geojson_part-004.gz',
        'uso_solo__usodosolo_otto.geojson_part-005.gz'
      ],
      geom: 'polygon',
      classField: 'NIVEL_II',
      palette: USO_COLORS,
      visualHints: 'Para áreas extensas utilize esta camada em conjunto com "Bacias Selecionadas" para destacar prioridades.'
    },
    {
      id: 'uso_app',
      name: 'Conflito de Uso (APP 30m)',
      files: ['conflitosdeuso__uso_solo_em_app.geojson_part-001.gz'],
      geom: 'polygon',
      visualHints: 'Ative junto com "Nascentes" para identificar conflitos próximos às áreas protegidas.'
    },
    {
      id: 'car',
      name: 'Cadastro Ambiental Rural (CAR)',
      files: ['car.geojson_part-001.gz'],
      geom: 'polygon',
      defaultVisible: false,
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
        'curvasdenivel__curvas_otto.geojson_part-004.gz',
        'curvasdenivel__curvas_otto.geojson_part-005.gz',
        'curvasdenivel__curvas_otto.geojson_part-006.gz',
        'curvasdenivel__curvas_otto.geojson_part-007.gz',
        'curvasdenivel__curvas_otto.geojson_part-008.gz',
        'curvasdenivel__curvas_otto.geojson_part-009.gz',
        'curvasdenivel__curvas_otto.geojson_part-010.gz',
        'curvasdenivel__curvas_otto.geojson_part-011.gz',
        'curvasdenivel__curvas_otto.geojson_part-012.gz',
        'curvasdenivel__curvas_otto.geojson_part-013.gz',
        'curvasdenivel__curvas_otto.geojson_part-014.gz',
        'curvasdenivel__curvas_otto.geojson_part-015.gz'
      ],
      geom: 'line',
      metric: 'length',
      visualHints: 'Para melhor contraste utilize o mapa base "ESRI Topográfico".'
    },
    {
      id: 'hidrografia',
      name: 'Rede de Drenagem (Hidrografia)',
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
    { id: 'educacao', name: 'Escolas Estaduais', files: ['educacao__educacao_otto.geojson_part-001.gz'], geom: 'point', metric: 'count' },
    { id: 'sigarh', name: 'Outorgas (SIGARH)', files: ['sigarh.geojson_part-001.gz'], geom: 'point', metric: 'count' },
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
    allowedMunicipalities: new Set(),
    allowedMananciais: new Set(),
    regionMask: null,
    regionMask4326: null,
    regionBBox: null,
    regionBBox4326: null,
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

  function getFilterFields(kind) {
    const fields = [];
    const canonical = FILTER_FIELDS[kind];
    if (canonical) fields.push(canonical);
    const aliases = FILTER_ALIASES[kind];
    if (Array.isArray(aliases)) {
      aliases.forEach(alias => {
        if (alias && !fields.includes(alias)) fields.push(alias);
      });
    }
    return fields;
  }

  function getFilterValue(properties, kind, { normalized = false } = {}) {
    if (!properties) return '';
    const candidates = getFilterFields(kind);
    for (const field of candidates) {
      if (!field) continue;
      if (Object.prototype.hasOwnProperty.call(properties, field)) {
        const raw = properties[field];
        if (raw !== undefined && raw !== null) {
          const text = `${raw}`.trim();
          if (text) {
            return normalized ? normalizeText(text) : text;
          }
        }
      }
    }
    return '';
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
    return (
      getFilterValue(feature.properties, 'region') ||
      getFilterValue(feature.properties, 'municipality') ||
      getFilterValue(feature.properties, 'manancial')
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

  function normalizeClassLabels(labels) {
    if (!labels) return null;
    const normalized = {};
    Object.entries(labels).forEach(([key, value]) => {
      if (!key || !value) return;
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
        ? (() => {
            const preset = getPointPreset(entry.id);
            return {
              radius: 7,
              color: preset.stroke,
              weight: 2,
              fillColor: preset.fill,
              fillOpacity: state.opacity,
              opacity: state.opacity
            };
          })()
        : { color: '#1f78b4', weight: 1, fillColor: '#1f78b4', fillOpacity: 0.4 * state.opacity, opacity: 0.8 * state.opacity };

    if (entry.id === 'bacias' && geom === 'polygon') {
      style.color = '#1d4ed8';
      style.weight = 2.6;
      style.fillColor = '#bfdbfe';
      style.fillOpacity = 0.22 * state.opacity;
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
      if (entry.geom === 'point') {
        const icon = getPointIcon(entry);
        entry.layer.eachLayer(featureLayer => {
          if (!featureLayer) return;
          if (typeof featureLayer.setIcon === 'function') {
            featureLayer.setIcon(icon);
          }
          if (typeof featureLayer.setOpacity === 'function') {
            featureLayer.setOpacity(state.opacity);
          }
        });
        return;
      }
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
      const displayFeatures = buildDisplayFeatures(entry);
      if (displayFeatures.length) {
        entry.layer.addData({ type: 'FeatureCollection', features: displayFeatures });
        if (entry.id === 'bacias' && state.map && state.map.hasLayer(entry.layer)) {
          entry.layer.bringToFront();
        }
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

  function labelForClass(entry, value) {
    if (!entry || !entry.classLabels) return value;
    const key = typeof value === 'string' ? value.trim() : value;
    return (
      entry.classLabels[key] ||
      (typeof key === 'string' ? entry.classLabels[key.toUpperCase()] : undefined) ||
      value
    );
  }

  function aggregateMetrics(entry, features) {
    let total = 0;
    const breakdown = new Map();

    features.forEach(feature => {
      let value = 0;
      try {
        if (entry.metric === 'area') {
          value = computeFeatureArea(feature, entry);
        } else if (entry.metric === 'length') {
          value = computeFeatureLength(feature, entry);
        } else {
          value = 1;
        }
      } catch (error) {
        console.error('Erro ao calcular métrica da legenda', error);
        value = 0;
      }

      if (!Number.isFinite(value)) {
        value = 0;
      }

      total += value;

      if (entry.classField) {
        const rawClass = feature.properties?.[entry.classField];
        const hasValue = rawClass !== undefined && rawClass !== null && `${rawClass}`.trim() !== '';
        const classKey = hasValue ? `${rawClass}`.trim() : 'Sem classificação';
        const previous = breakdown.get(classKey) || 0;
        breakdown.set(classKey, previous + value);
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
          const swatchClass = entry.geom === 'line'
            ? 'legend-swatch line'
            : entry.geom === 'point'
              ? 'legend-swatch point'
              : 'legend-swatch';
          const styleAttr = color && entry.geom !== 'point'
            ? entry.geom === 'line'
              ? `style="background:${color}; border-color:${color};"`
              : `style="background:${color};"`
            : '';
          const swatchContent = entry.geom === 'point' ? getPointLegendSVG(entry) : '';
          const label = labelForClass(entry, className);
          block.push(`<li class="legend-item"><span class="${swatchClass}" ${styleAttr}>${swatchContent}</span><span class="legend-label">${label}</span><span class="legend-value">${formatMetric(value, entry.metric)}</span></li>`);
        });
        block.push('</ul>');
      } else if (entry.geom === 'point') {
        block.push('<ul class="legend-list">');
        block.push(`<li class="legend-item"><span class="legend-swatch point">${getPointLegendSVG(entry)}</span><span class="legend-label">Registros</span><span class="legend-value">${formatMetric(total, entry.metric)}</span></li>`);
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

    const regionValueNorm = getFilterValue(properties, 'region', { normalized: true });
    const municipalityValue = getFilterValue(properties, 'municipality');
    const municipalityValueNorm = normalizeText(municipalityValue);
    const manancialValue = getFilterValue(properties, 'manancial');
    const manancialValueNorm = normalizeText(manancialValue);

    if (state.filter.region) {
      if (regionValueNorm) {
        if (regionValueNorm !== state.normalizedRegion) return false;
      } else {
        const hasUniverse = state.allowedMunicipalities.size || state.allowedMananciais.size;
        if (hasUniverse) {
          let matches = false;
          if (!matches && municipalityValueNorm && state.allowedMunicipalities.size) {
            matches = state.allowedMunicipalities.has(municipalityValueNorm);
          }
          if (!matches && manancialValueNorm && state.allowedMananciais.size) {
            matches = state.allowedMananciais.has(manancialValueNorm);
          }
          if (!matches) return false;
        }
      }
    }

    if (state.filter.municipality) {
      if (!municipalityValue || municipalityValue !== state.filter.municipality) return false;
    }

    if (state.filter.manancial) {
      if (!manancialValue || manancialValue !== state.filter.manancial) return false;
    }

    return true;
  }

  function fitMapToFeatures(features, { isProjected = false } = {}) {
    if (!state.map || !Array.isArray(features) || !features.length) return;
    const normalizedFeatures = isProjected
      ? features.map(reprojectFeatureToWgs84).filter(Boolean)
      : features;
    if (!normalizedFeatures.length) return;
    try {
      const bbox = turf.bbox({ type: 'FeatureCollection', features: normalizedFeatures });
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
    fitMapToFeatures(baciasEntry.currentFeatures, { isProjected: baciasEntry.isProjected });
  }

  function collectFilterUniverse() {
    const allowedMunicipalities = new Set();
    const allowedMananciais = new Set();
    const baciasEntry = state.layerStore.get('bacias');
    if (baciasEntry && Array.isArray(baciasEntry.originalFeatures)) {
      baciasEntry.originalFeatures.forEach(feature => {
        const props = feature?.properties;
        const municipality = getFilterValue(props, 'municipality');
        if (municipality) {
          allowedMunicipalities.add(normalizeText(municipality));
        }
        const manancial = getFilterValue(props, 'manancial');
        if (manancial) {
          allowedMananciais.add(normalizeText(manancial));
        }
      });
    }
    state.allowedMunicipalities = allowedMunicipalities;
    state.allowedMananciais = allowedMananciais;
    updateRegionMask();
  }

  function updateRegionMask() {
    const baciasEntry = state.layerStore.get('bacias');
    if (!baciasEntry || !Array.isArray(baciasEntry.originalFeatures)) {
      state.regionMask = null;
      state.regionMask4326 = null;
      state.regionBBox = null;
      state.regionBBox4326 = null;
      return;
    }

    const features = baciasEntry.originalFeatures
      .filter(feature => feature && feature.geometry)
      .map(feature => ({ type: 'Feature', geometry: feature.geometry }));

    if (!features.length) {
      state.regionMask = null;
      state.regionMask4326 = null;
      state.regionBBox = null;
      state.regionBBox4326 = null;
      return;
    }

    state.regionMask = features;
    state.regionMask4326 = features;
    state.regionBBox = null;
    state.regionBBox4326 = null;
    try {
      state.regionBBox = turf.bbox({ type: 'FeatureCollection', features });
    } catch (error) {
      console.warn('Não foi possível calcular a extensão da regional selecionada.', error);
      state.regionBBox = null;
    }

    const maskIsProjected = features.some(feature => geometryIsProjected(feature.geometry));
    if (maskIsProjected) {
      const geographicFeatures = features
        .map(reprojectFeatureToWgs84)
        .filter(Boolean);
      if (geographicFeatures.length) {
        state.regionMask4326 = geographicFeatures;
        try {
          state.regionBBox4326 = turf.bbox({ type: 'FeatureCollection', features: geographicFeatures });
        } catch (error) {
          console.warn('Não foi possível calcular a extensão em coordenadas geográficas.', error);
          state.regionBBox4326 = null;
        }
      } else {
        state.regionMask4326 = null;
        state.regionBBox4326 = null;
      }
    } else {
      state.regionBBox4326 = state.regionBBox;
    }

    if (!state.regionBBox4326 && state.regionMask4326) {
      try {
        state.regionBBox4326 = turf.bbox({ type: 'FeatureCollection', features: state.regionMask4326 });
      } catch (error) {
        console.warn('Não foi possível calcular a extensão geográfica da regional.', error);
        state.regionBBox4326 = null;
      }
    }
  }

  async function ensureRegionMask() {
    if (!state.normalizedRegion) return null;
    if (state.regionMask) return state.regionMask;
    const baciasEntry = state.layerStore.get('bacias');
    if (!baciasEntry) return null;
    if (!baciasEntry.loaded) {
      await baciasEntry.ensureLoaded();
    }
    updateRegionMask();
    return state.regionMask;
  }

  function getRegionMaskContext({ isProjected = false } = {}) {
    const mask = isProjected ? state.regionMask : state.regionMask4326 || state.regionMask;
    const bbox = isProjected ? state.regionBBox : state.regionBBox4326 || state.regionBBox;
    return { mask, bbox };
  }

  function bboxIntersectsRegion(feature, bbox) {
    if (!bbox) return true;
    try {
      const featureBBox = turf.bbox(feature);
      const [minX, minY, maxX, maxY] = bbox;
      return !(
        featureBBox[2] < minX ||
        featureBBox[0] > maxX ||
        featureBBox[3] < minY ||
        featureBBox[1] > maxY
      );
    } catch (error) {
      return true;
    }
  }

  function filterByRegionMask(features, { isProjected = false } = {}) {
    if (!Array.isArray(features) || !features.length) {
      return Array.isArray(features) ? features : [];
    }

    if (!state.normalizedRegion) return features;

    const { mask, bbox } = getRegionMaskContext({ isProjected });
    if (!mask || !mask.length) {
      return features;
    }

    return features.filter(feature => {
      if (!feature || !feature.geometry) return false;
      if (!bboxIntersectsRegion(feature, bbox)) return false;
      try {
        const featureWrapper = feature.type === 'Feature' ? feature : { type: 'Feature', geometry: feature.geometry };
        return mask.some(maskFeature => turf.booleanIntersects(maskFeature, featureWrapper));
      } catch (error) {
        console.warn('Falha ao verificar interseção espacial; mantendo a feição.', error);
        return true;
      }
    });
  }

  function applyFilter({ fit = false } = {}) {
    state.orderedEntries.forEach(entry => {
      if (!entry.loaded) return;
      if (!entry.filterable) {
        entry.currentFeatures = filterByRegionMask(entry.originalFeatures, { isProjected: entry.isProjected });
        syncEntryLayer(entry, { force: true });
        return;
      }
      const filtered = filterByRegionMask(
        entry.originalFeatures.filter(feature => passesFilter(feature.properties)),
        { isProjected: entry.isProjected }
      );
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
    collectFilterUniverse();
    applyFilter();

    const regions = Array.from(new Set(
      baciasEntry.originalFeatures
        .map(feature => getFilterValue(feature.properties, 'region'))
        .filter(Boolean)
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
          .filter(feature => getFilterValue(feature.properties, 'region', { normalized: true }) === state.normalizedRegion)
          .map(feature => getFilterValue(feature.properties, 'municipality'))
          .filter(Boolean)
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
            if (getFilterValue(props, 'region', { normalized: true }) !== state.normalizedRegion) return false;
            if (state.filter.municipality) {
              const municipality = getFilterValue(props, 'municipality');
              if (!municipality || municipality !== state.filter.municipality) return false;
            }
            return true;
          })
          .map(feature => getFilterValue(feature.properties, 'manancial'))
          .filter(Boolean)
      )).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      populateSelect(manancialSelect, mananciais, '— Manancial —');
      if (state.filter.manancial) {
        manancialSelect.value = state.filter.manancial;
      }
    };

    if (municipalitySelect) {
      municipalitySelect.addEventListener('change', event => {
        state.filter.municipality = (event.target.value || '').trim();
        state.filter.manancial = '';
        updateMananciais();
        applyFilter({ fit: true });
      });
    }

    if (manancialSelect) {
      manancialSelect.addEventListener('change', event => {
        state.filter.manancial = (event.target.value || '').trim();
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
      } else {
        fitToFilteredSelection();
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
      classLabels: normalizeClassLabels(config.classLabels),
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
      zoomVisible: true,
      isProjected: false
    };

    const layer = L.geoJSON(null, {
      style: feature => styleForEntry(entry, feature.properties || {}),
      pointToLayer: (feature, latlng) => {
        if (entry.geom === 'point') {
          return L.marker(latlng, { icon: getPointIcon(entry) });
        }
        return L.circleMarker(latlng, styleForEntry(entry, feature.properties || {}));
      },
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
        const datasetIsProjected = detectProjected(allFeatures);
        entry.isProjected = datasetIsProjected;

        if (state.normalizedRegion && entry.id !== 'bacias') {
          await ensureRegionMask();
        }

        let features = allFeatures;
        if (state.normalizedRegion) {
          if (entry.filterable) {
            features = allFeatures.filter(feature => {
              const props = feature?.properties;
              if (!props) return false;
              const regionValue = getFilterValue(props, 'region', { normalized: true });
              if (regionValue) {
                return regionValue === state.normalizedRegion;
              }
              const municipalityNorm = normalizeText(getFilterValue(props, 'municipality'));
              if (municipalityNorm && state.allowedMunicipalities.size) {
                return state.allowedMunicipalities.has(municipalityNorm);
              }
              const manancialNorm = normalizeText(getFilterValue(props, 'manancial'));
              if (manancialNorm && state.allowedMananciais.size) {
                return state.allowedMananciais.has(manancialNorm);
              }
              if (entry.id === 'bacias') {
                return false;
              }
              const { mask } = getRegionMaskContext({ isProjected: datasetIsProjected });
              if (!mask || !mask.length) return false;
              try {
                const featureWrapper = feature.type === 'Feature' ? feature : { type: 'Feature', geometry: feature.geometry };
                return mask.some(maskFeature => turf.booleanIntersects(maskFeature, featureWrapper));
              } catch (error) {
                console.warn('Falha ao usar a máscara regional como fallback de filtro.', error);
                return false;
              }
            });
          } else {
            features = filterByRegionMask(allFeatures, { isProjected: datasetIsProjected });
          }
        }

        if (state.normalizedRegion) {
          features = filterByRegionMask(features, { isProjected: datasetIsProjected });
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
        entry.isProjected = detectProjected(features);
        if (entry.id === 'bacias') {
          collectFilterUniverse();
        }
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
