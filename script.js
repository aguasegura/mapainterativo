// script.js

// Objetos para armazenar camadas e features
const layers = {};          // label → camada Leaflet
const allFeatures = {};     // label → lista de features (GeoJSON feature objects)
let currentFilter = null;    // string ou null para filtro Cod_man

// Inicializa mapa
const map = L.map('map').setView([-10, -52], 4);  // ajustar centro/zoom se necessário

// Base tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Lista de arquivos .gz com seus rótulos e cores
const files = [
  { filename: 'curvasdenivel_curvas_ot�o.geojson_part-001.gz', label: 'Curvas de Nível', color: '#444' },
  { filename: 'educacao_educacao_ot�o.geojson_part-001.gz', label: 'Educação', color: '#3366cc' },
  { filename: 'estradas_estradas_ot�o.geojson_part-001.gz', label: 'Estradas', color: '#cc6600' },
  { filename: 'hidrografia_hidrografia_ot�o.geojson_part-001.gz', label: 'Hidrografia', color: '#3399cc' },
  { filename: 'uso_solo_usodosolo_ot�o.geojson_part-001.gz', label: 'Uso do Solo', color: '#9966cc' },
  // Adicione todos os outros arquivos que você quer mapear
];

// Função para carregar, descompactar, armazenar e exibir camada
async function loadLayer(fileInfo) {
  try {
    const resp = await fetch(`data/${fileInfo.filename}`);
    if (!resp.ok) {
      console.error(`Falha ao carregar ${fileInfo.filename}: ${resp.status}`);
      return;
    }

    const buffer = await resp.arrayBuffer();
    const u8 = new Uint8Array(buffer);
    const decompressed = pako.inflate(u8, { to: 'string' });
    const geojson = JSON.parse(decompressed);

    // Armazena features
    allFeatures[fileInfo.label] = geojson.features || [];

    // Cria camada Leaflet, mas sem adicionar todas as features ainda
    const layer = L.geoJSON(null, {
      style: { color: fileInfo.color, weight: 2, opacity: 0.7 },
      onEachFeature: (feature, lyr) => {
        const cod = feature.properties?.Cod_man ?? 'N/A';
        lyr.bindPopup(`<strong>${fileInfo.label}</strong><br>Cod_man: ${cod}`);
      }
    });

    layers[fileInfo.label] = layer;
    layer.addTo(map);

    // Adiciona todos os dados para começar
    layer.addData(allFeatures[fileInfo.label]);

    updateLegend();
    updateFilterButtons();

    // Opcional: ajustar fitBounds se for a primeira camada carregada
    adjustMapBounds();

  } catch (err) {
    console.error(`Erro processando ${fileInfo.filename}:`, err);
  }
}

// Atualiza legenda na UI
function updateLegend() {
  const legendList = document.getElementById('legendList');
  if (!legendList) return;
  legendList.innerHTML = '';
  for (const label in layers) {
    const style = layers[label].options?.style || {};
    const color = style.color || '#000';
    const li = document.createElement('li');
    li.className = 'legend-item';
    li.innerHTML = `
      <span class="legend-swatch" style="background: ${color};"></span>
      <span class="legend-label">${label}</span>
    `;
    legendList.appendChild(li);
  }
}

// Gera botões de filtro de Cod_man
function updateFilterButtons() {
  const btnContainer = document.getElementById('filterButtons');
  if (!btnContainer) return;
  btnContainer.innerHTML = '';  // limpa antigo

  // Coleta todos os Cod_man únicos
  const codSet = new Set();
  for (const label in allFeatures) {
    allFeatures[label].forEach(f => {
      if (f.properties && f.properties.Cod_man != null) {
        codSet.add(f.properties.Cod_man);
      }
    });
  }

  // Ordena se quiser
  const codList = Array.from(codSet).sort();

  codList.forEach(cod => {
    const btn = document.createElement('button');
    btn.className = 'btn-chip';
    btn.textContent = cod;
    btn.addEventListener('click', () => {
      currentFilter = cod;
      applyFilter();
    });
    btnContainer.appendChild(btn);
  });

  // Botão para limpar filtro
  const allBtn = document.createElement('button');
  allBtn.className = 'btn-chip';
  allBtn.textContent = 'Mostrar tudo';
  allBtn.addEventListener('click', () => {
    currentFilter = null;
    applyFilter();
  });
  btnContainer.appendChild(allBtn);
}

// Aplica o filtro (Cod_man)
function applyFilter() {
  for (const label in layers) {
    const layer = layers[label];
    layer.clearLayers();

    const feats = allFeatures[label];
    const filtered = currentFilter
      ? feats.filter(f => f.properties?.Cod_man === currentFilter)
      : feats;

    layer.addData(filtered);
  }
}

// Ajusta opacidade com base no slider na UI
function setupOpacityControl() {
  const op = document.getElementById('opacity');
  const opVal = document.getElementById('opacityVal');
  if (!op || !opVal) return;

  op.addEventListener('input', () => {
    const v = Number(op.value);
    opVal.textContent = `${v}%`;
    const opNorm = v / 100;
    for (const label in layers) {
      layers[label].setStyle && layers[label].setStyle({ opacity: opNorm });
    }
  });
}

// Botão de ajustar visão pra todas as camadas
function setupFitAllButton() {
  const btn = document.getElementById('fitAll');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const group = L.featureGroup(Object.values(layers));
    if (group.getLayers().length > 0) {
      map.fitBounds(group.getBounds(), { padding: [20, 20] });
    }
  });
}

// Ajusta bounds do mapa ao carregar a primeira camada ou as camadas visíveis
function adjustMapBounds() {
  const group = L.featureGroup(Object.values(layers));
  const bounds = group.getBounds();
  if (bounds && bounds.isValid && bounds.isValid()) {
    map.fitBounds(bounds, { padding: [20, 20] });
  }
}

// Função principal de inicialização
async function init() {
  setupOpacityControl();
  setupFitAllButton();

  // Carrega todos os arquivos da lista
  for (const fi of files) {
    await loadLayer(fi);
  }
}

document.addEventListener('DOMContentLoaded', init);
