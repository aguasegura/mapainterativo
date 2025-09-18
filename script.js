const map = L.map('map').setView([-24.7, -53.7], 7);

// Camadas base
const baseMaps = {
  "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }),
  "ESRI Satélite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© ESRI' }),
  "ESRI Topográfico": L.tileLayer('https://{s}.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© ESRI',
    subdomains: ['server', 'services']
  }),
  "Carto Light": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; Carto',
    subdomains: 'abcd'
  })
};
baseMaps["OpenStreetMap"].addTo(map); // padrão inicial

L.control.layers(baseMaps, {}, { position: 'topright', collapsed: true }).addTo(map);

// Camadas disponíveis (relacione nomes dos arquivos, campos e cores)
const camadas = [
  { nome: 'baciasselecionadas.geojson_part-001.gz', chave: 'bacias', cor: '#2b8a3e' },
  { nome: 'altimetria.geojson_part-001.gz', chave: 'altimetria', cor: '#5e81ac', classe: 'ClAlt', area: 'AreaHa', unidade: 'ha' },
  { nome: 'declividade.geojson_part-001.gz', chave: 'declividade', cor: '#d08770', classe: 'ClDec', area: 'AreaHa', unidade: 'ha' },
  { nome: 'usodosolo.geojson_part-001.gz', chave: 'usodosolo', cor: '#b48ead', classe: 'NIVEL_II', area: 'Area_ha_1', unidade: 'ha' },
  { nome: 'solos.geojson_part-001.gz', chave: 'solos', cor: '#ebcb8b', classe: 'Cl_solos', area: null, unidade: 'ha' },
  { nome: 'construcoes.geojson_part-001.gz', chave: 'construcoes', cor: '#bf616a', classe: null, area: 'area_in_meters', unidade: 'm²' }
];

const layers = {};
const allFeatures = {};
const legendList = document.getElementById('legendList');

// Load and decompress GeoJSON
async function loadGeoJSON(file) {
  const res = await fetch(`./data/${file}`);
  const bin = await res.arrayBuffer();
  const texto = pako.inflate(new Uint8Array(bin), { to: 'string' });
  return JSON.parse(texto);
}

// Adiciona ao mapa e atualiza legenda
function ativarCamada(meta) {
  if (layers[meta.chave]) {
    map.addLayer(layers[meta.chave]);
    atualizarLegenda(meta.chave);
    return;
  }

  loadGeoJSON(meta.nome).then(geo => {
    allFeatures[meta.chave] = geo.features;

    const camada = L.geoJSON(geo, {
     style: { color: meta.cor, weight: 2, opacity: 0.7 },
     onEachFeature: (f, lyr) => {
       lyr.bindPopup(`<strong>${meta.chave}</strong><br>Cod_man: ${f.properties?.Cod_man ?? 'N/A'}`);
      }
    });

    layers[meta.chave] = camada;
    camada.addTo(map);
    atualizarLegenda(meta.chave);
  });
}

// Remove camada
function desativarCamada(chave) {
  if (layers[chave]) map.removeLayer(layers[chave]);
  if (legendList) legendList.innerHTML = '';
}

// Gera legenda dinâmica
function atualizarLegenda(chave) {
  const meta = camadas.find(c => c.chave === chave);
  if (!meta || !allFeatures[chave]) return;

  const lista = {};
  let totalConstruido = 0;

  allFeatures[chave].forEach(f => {
    const p = f.properties || {};
    const classe = meta.classe ? p[meta.classe] : 'Total';
    let area = 0;

    if (meta.area) {
      area = parseFloat(p[meta.area]) || 0;
    } else {
      try {
        area = turf.area(f) / 10000; // m² → ha
      } catch (e) {}
    }

    if (meta.chave === 'construcoes') {
      totalConstruido += area;
    } else {
      lista[classe] = (lista[classe] || 0) + area;
    }
  });

  legendList.innerHTML = '';
  if (meta.chave === 'construcoes') {
    legendList.innerHTML = `<li class="legend-item"><span class="legend-label">Área construída:</span><span class="legend-value">${totalConstruido.toFixed(1)} m²</span></li>`;
    return;
  }

  Object.entries(lista).sort().forEach(([k, v]) => {
    const li = document.createElement('li');
    li.className = 'legend-item';
    li.innerHTML = `<span class="legend-label">${k}</span><span class="legend-value">${v.toFixed(1)} ${meta.unidade}</span>`;
    legendList.appendChild(li);
  });
}

// Lista de camadas disponíveis (checkboxes)
function montarListaCamadas() {
  const container = document.getElementById('layerList');
  if (!container) return;
  camadas.forEach(meta => {
    const label = document.createElement('label');
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.onchange = e => {
      if (e.target.checked) ativarCamada(meta);
      else desativarCamada(meta.chave);
    };
    label.appendChild(check);
    label.appendChild(document.createTextNode(` ${meta.chave}`));
    container.appendChild(label);
  });
}

// Ajusta opacidade
document.getElementById('opacity').addEventListener('input', e => {
  const val = parseInt(e.target.value);
  document.getElementById('opacityVal').textContent = `${val}%`;
  Object.values(layers).forEach(layer => layer.setStyle?.({ opacity: val / 100 }));
});

document.getElementById('fitAll').addEventListener('click', () => {
  const grupo = L.featureGroup(Object.values(layers).filter(l => map.hasLayer(l)));
  if (grupo.getLayers().length > 0) map.fitBounds(grupo.getBounds());
});

// Inicializa UI
montarListaCamadas();
