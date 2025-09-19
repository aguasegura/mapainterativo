// script.js

const map = L.map('map').setView([-24.7, -53.7], 7);

const baseMaps = {
  "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }),
  "ESRI Satélite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© ESRI' }),
  "ESRI Topográfico": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { attribution: '© ESRI' }),
  "Carto Light": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; Carto', subdomains: 'abcd' })
};

baseMaps["OpenStreetMap"].addTo(map);
L.control.layers(baseMaps, {}, { position: 'topright', collapsed: true }).addTo(map);

// Logos controle
L.Control.LogoControl = L.Control.extend({
  options: { position: 'topright' },
  onAdd: function(map) {
    const container = L.DomUtil.create('div', 'leaflet-control logo-control');
    container.innerHTML =
      '<img src="aguaseguralogo2.png" alt="Água Segura" />' +
      '<img src="logo_IDR-SEAB.png" alt="IDR‑SEAB" />' +
      '<img src="logo_sanepar.jpg" alt="Sanepar" />';
    L.DomEvent.disableClickPropagation(container);
    return container;
  }
});
new L.Control.LogoControl().addTo(map);

const camadas = [
  { nome: ['baciasselecionadas.geojson_part-001.gz'], chave: 'bacias', cor: '#2b8a3e' },
  { nome: ['altimetria__altimetria_otto.geojson_part-001.gz'], chave: 'altimetria', cor: '#5e81ac', classe: 'ClAlt', area: 'AreaHa', unidade: 'ha' },
  { nome: ['declividade__declividade_otto.geojson_part-001.gz'], chave: 'declividade', cor: '#d08770', classe: 'ClDec', area: 'AreaHa', unidade: 'ha' },
  {
    nome: [
      'uso_solo__usodosolo_otto.geojson_part-001.gz',
      'uso_solo__usodosolo_otto.geojson_part-002.gz',
      'uso_solo__usodosolo_otto.geojson_part-003.gz',
      'uso_solo__usodosolo_otto.geojson_part-004.gz'
    ],
    chave: 'usodosolo',
    cor: '#b48ead',
    classe: 'NIVEL_II',
    area: 'Area_ha_1',
    unidade: 'ha'
  },
  { nome: ['solos__solos_otto.geojson_part-001.gz'], chave: 'solos', cor: '#ebcb8b', classe: 'Cl_solos', unidade: 'ha' },
  {
    nome: [
      'construcoes__construcoes_otto.geojson_part-001.gz',
      'construcoes__construcoes_otto.geojson_part-002.gz'
    ],
    chave: 'construcoes',
    cor: '#bf616a',
    area: 'area_in_meters',
    unidade: 'm²'
  },
  { nome: ['aves__aves.geojson_part-001.gz'], chave: 'aves', cor: '#4c9f70' },
  { nome: ['bovinos__bovinos.geojson_part-001.gz'], chave: 'bovinos', cor: '#a0522d' },
  { nome: ['bubalinos__bubalinos.geojson_part-001.gz'], chave: 'bubalinos', cor: '#8b4513' },
  { nome: ['caf.geojson_part-001.gz'], chave: 'caf', cor: '#556b2f' },
  { nome: ['educacao__educacao_otto.geojson_part-001.gz'], chave: 'educacao', cor: '#4682b4' },
  { nome: ['estradas__estradas_otto.geojson_part-001.gz'], chave: 'estradas', cor: '#cd5c5c' },
  { nome: ['hidrografia__hidrografia_otto.geojson_part-001.gz'], chave: 'hidrografia', cor: '#1e90ff' },
  { nome: ['nascentes__nascentes_otto.geojson_part-001.gz'], chave: 'nascentes', cor: '#7fffd4' },
  { nome: ['sigarh.geojson_part-001.gz'], chave: 'sigarh', cor: '#808000' },
  { nome: ['suinos__suinos.geojson_part-001.gz'], chave: 'suinos', cor: '#ff6347' }
];

const layers = {};
const allFeatures = {};
const legendList = document.getElementById('legendList');

async function loadGeoJSON(files) {
  const arquivos = Array.isArray(files) ? files : [files];
  const todasFeatures = [];
  for (const file of arquivos) {
    try {
      const res = await fetch(`./data/${file}`);
      if (!res.ok) {
        console.error(`Falha ao buscar: ${file} (status ${res.status})`);
        continue;
      }
      const bin = await res.arrayBuffer();
      const texto = pako.inflate(new Uint8Array(bin), { to: 'string' });
      const json = JSON.parse(texto);
      if (json.features && Array.isArray(json.features)) {
        todasFeatures.push(...json.features);
      }
    } catch (e) {
      console.error(`Erro ao processar ${file}:`, e);
    }
  }
  return { type: 'FeatureCollection', features: todasFeatures };
}

async function ativarCamada(meta) {
  if (layers[meta.chave]) {
    map.addLayer(layers[meta.chave]);
    // Atualiza legenda caso seja classe definida
    atualizarLegenda(meta.chave);
    return;
  }
  const geo = await loadGeoJSON(meta.nome);
  allFeatures[meta.chave] = geo.features;

  const camada = L.geoJSON(geo, {
    style: { color: meta.cor, weight: 2, opacity: 0.7 },
    onEachFeature: (f, lyr) => {
      const cod = f.properties?.Cod_man ?? 'N/A';
      lyr.bindPopup(`<strong>${meta.chave}</strong><br>Cod_man: ${cod}`);
    }
  });

  layers[meta.chave] = camada;
  camada.addTo(map);
  atualizarLegenda(meta.chave);
}

function desativarCamada(chave) {
  if (layers[chave]) map.removeLayer(layers[chave]);
  if (legendList) legendList.innerHTML = '';
}

function atualizarLegenda(chave) {
  const meta = camadas.find(c => c.chave === chave);
  if (!meta || !allFeatures[chave]) return;
  // somente exibe legenda por classe se campo 'classe' estiver definido
  if (!meta.classe) {
    legendList.innerHTML = `<li class="legend-item"><span class="legend-label">Camada "${chave}" sem classes definidas</span></li>`;
    return;
  }

  const lista = {};
  allFeatures[chave].forEach(f => {
    const p = f.properties || {};
    const classe = p[meta.classe] ?? 'Sem classe';
    let area = 0;
    if (meta.area && p[meta.area] != null) {
      area = parseFloat(p[meta.area]) || 0;
    } else {
      try {
        area = turf.area(f) / 10000;
      } catch (e) {
        console.warn(`Não foi possível calcular área da feature em ${chave}`, e);
      }
    }
    lista[classe] = (lista[classe] || 0) + area;
  });

  // exibir no legendList
  legendList.innerHTML = '';
  Object.entries(lista).sort((a,b) => {
    const na = parseFloat(a[0]);
    const nb = parseFloat(b[0]);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a[0].localeCompare(b[0]);
  }).forEach(([classe, area]) => {
    const li = document.createElement('li');
    li.className = 'legend-item';
    li.innerHTML = `<span class="legend-label">${classe}</span><span class="legend-value">${area.toFixed(1)} ${meta.unidade ?? ''}</span>`;
    legendList.appendChild(li);
  });
}

function montarListaCamadas() {
  const container = document.getElementById('layerList');
  if (!container) return;
  camadas.forEach(meta => {
    const label = document.createElement('label');
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.style.marginRight = '0.5rem';
    check.onchange = e => {
      if (e.target.checked) ativarCamada(meta);
      else desativarCamada(meta.chave);
    };
    label.appendChild(check);
    label.appendChild(document.createTextNode(` ${meta.chave}`));
    container.appendChild(label);
  });
}

document.getElementById('opacity').addEventListener('input', e => {
  const val = parseInt(e.target.value);
  document.getElementById('opacityVal').textContent = `${val}%`;
  const op = val / 100;
  Object.values(layers).forEach(layer => {
    if (map.hasLayer(layer)) {
      layer.setStyle?.({ opacity: op });
    }
  });
});

document.getElementById('fitAll').addEventListener('click', () => {
  const visible = Object.values(layers).filter(l => map.hasLayer(l));
  if (visible.length > 0) {
    const group = L.featureGroup(visible);
    map.fitBounds(group.getBounds());
  }
});

montarListaCamadas();
