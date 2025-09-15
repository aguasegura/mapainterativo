// Assumindo que você usa Leaflet e que vai carregar camadas GeoJSON
// Este script faz filtro com base na camada base (otto_selec__ottos_selec_lista4.geojson)
// e aplica aos demais

let map = L.map('map').setView([-25.5, -52.5], 7);  // ajustar centro/zoom conforme seus dados

// Basemap exemplo
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap',
}).addTo(map);

// Variáveis para armazenar camadas
let layerBase = null;  // otto_selec__ottos_selec_lista4
let layerUsoSolo = null;
let layerCAF = null;
// outras camadas...

// Função para estilo comum de polígonos com transparência
function estiloPoligonoDefault(feature) {
  return {
    color: '#3388ff',  // borda
    weight: 1,
    fillColor: '#3388ff',
    fillOpacity: 0.35,  // transparência aumentada
  };
}

// Função para o CAF popup
function onEachFeatureCAF(feature, layer) {
  if (feature.properties && feature.properties.CAF_AREA_C !== undefined) {
    layer.bindPopup('<b>Cód. CAF:</b> ' + feature.properties.CAF_AREA_C);
  }
}

// Carregar GeoJSONs
function carregarLayerBase() {
  fetch('data/otto_selec__ottos_selec_lista4.geojson')
    .then(resp => resp.json())
    .then(json => {
      layerBase = L.geoJSON(json, {
        style: estiloPoligonoDefault,
        onEachFeature: (feature, layer) => {
          // opcional: popup para base se quiser
          if (feature.properties && feature.properties.Cod_man !== undefined) {
            layer.bindPopup('Cod_man: ' + feature.properties.Cod_man);
          }
        }
      }).addTo(map);
      map.fitBounds(layerBase.getBounds());
    });
}

function carregarUsoSolo() {
  fetch('data/uso_solo.geojson')
    .then(resp => resp.json())
    .then(json => {
      layerUsoSolo = L.geoJSON(json, {
        style: { color: '#66cc99', fillColor: '#66cc99', fillOpacity: 0.35, weight: 1 },
        filter: feature => {
          // filtrar por Cod_man comparando com features da layerBase
          if (!layerBase) return false;
          let cod = feature.properties.Cod_man;
          // verificar se existe este Cod_man em base
          return layerBase.getLayers().some(l => l.feature.properties.Cod_man === cod);
        }
      }).addTo(map);
    });
}

function carregarCAF() {
  fetch('data/caf__caf_otto.geojson')
    .then(resp => resp.json())
    .then(json => {
      layerCAF = L.geoJSON(json, {
        style: { color: '#ff8800', fillColor: '#ff8800', fillOpacity: 0.35, weight: 1 },
        filter: feature => {
          if (!layerBase) return false;
          let cod = feature.properties.Cod_man;
          return layerBase.getLayers().some(l => l.feature.properties.Cod_man === cod);
        },
        onEachFeature: onEachFeatureCAF
      }).addTo(map);
    });
}

// Chama os carregamentos iniciais
carregarLayerBase();
carregarUsoSolo();
carregarCAF();
// carregar outras camadas similares

// Filtros do painel
document.getElementById('btnApplyFilters').addEventListener('click', () => {
  // exemplo simples: re‑filtrar camadas com base nos selects
  let origemValue = document.getElementById('origemFilter').value;
  let regiaoValue = document.getElementById('regiaoFilter').value;

  // função de filtro genérica para cada camada
  function aplicarFiltroCamada(layer, propertyName, value) {
    if (!layer) return;
    layer.clearLayers && layer.clearLayers();  // se for layer geojson reutilizável

    fetch(layer.options && layer.options.url ? layer.options.url : '')  // você pode armazenar URL no layer ou recarregar
      .then(r => r.json())
      .then(json => {
        L.geoJSON(json, {
          style: estiloPoligonoDefault,
          filter: feature => {
            let okBase = true;
            // garantir que Cod_man seja compatível com layerBase
            if (feature.properties.Cod_man !== undefined) {
              okBase = layerBase.getLayers().some(l => l.feature.properties.Cod_man === feature.properties.Cod_man);
            }
            let okOrigem = true;
            if (origemValue && origemValue !== '(todos)') {
              okOrigem = feature.properties.origem === origemValue;
            }
            let okRegiao = true;
            if (regiaoValue && regiaoValue !== '(todos)') {
              okRegiao = feature.properties.regiao === regiaoValue;
            }
            return okBase && okOrigem && okRegiao;
          },
          onEachFeature: (feature, lyr) => {
            // se for camada CAF, usar popups específicos
            if (layer === layerCAF) {
              if (feature.properties && feature.properties.CAF_AREA_C !== undefined) {
                lyr.bindPopup('<b>Cód. CAF:</b> ' + feature.properties.CAF_AREA_C);
              }
            }
            // outros popups conforme necessidade
          }
        }).addTo(map);
      });
  }

  // re‑aplicar para cada camada
  // No exemplo abaixo, estamos chamando para uso solo e CAF
  // você pode generalizar para todas as suas camadas adicionais

  // Limpar camadas antigas
  if (layerUsoSolo) map.removeLayer(layerUsoSolo);
  if (layerCAF) map.removeLayer(layerCAF);
  // recarregar com filtro aplicado
  carregarUsoSolo();
  carregarCAF();
});

