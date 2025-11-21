(() => {
  'use strict';

  const DATA_URL = 'data/baciasselecionadas.geojson';
  const STORAGE_KEY = 'aguasegura:last-region';

  function setStatus(message, isError = false) {
    const statusEl = document.getElementById('regionStatus');
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.dataset.state = isError ? 'error' : message ? 'info' : '';
  }

  function setLoading(isLoading) {
    const form = document.getElementById('regionForm');
    if (!form) return;
    form.classList.toggle('is-loading', Boolean(isLoading));
  }

  function populateRegions(regions) {
    const select = document.getElementById('regionSelect');
    if (!select) return;
    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Selecione uma regional do IDR-Paraná';
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);

    regions.forEach(region => {
      const option = document.createElement('option');
      option.value = region;
      option.textContent = region;
      select.appendChild(option);
    });

    const stored = window.localStorage?.getItem(STORAGE_KEY);
    if (stored && regions.includes(stored)) {
      select.value = stored;
      const button = document.getElementById('enterMap');
      if (button) {
        button.disabled = false;
        button.textContent = 'Abrir mapa';
      }
    }
  }

  async function fetchRegions() {
    try {
      setLoading(true);
      setStatus('Carregando regionais disponíveis…');
      const response = await fetch(DATA_URL, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Erro ${response.status}`);
      }
      const data = await response.json();
      const regions = Array.from(
        new Set(
          (data.features || [])
            .map(feature => feature?.properties?.['Regional I'])
            .filter(value => typeof value === 'string' && value.trim() !== '')
            .map(value => value.trim())
        )
      ).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      if (!regions.length) {
        throw new Error('Nenhuma regional encontrada nos dados.');
      }
      populateRegions(regions);
      setStatus('');
    } catch (error) {
      console.error('Falha ao obter regionais.', error);
      setStatus('Não foi possível carregar as regionais. Atualize a página ou contate a equipe responsável.', true);
    } finally {
      setLoading(false);
    }
  }

  function handleForm() {
    const form = document.getElementById('regionForm');
    const select = document.getElementById('regionSelect');
    const button = document.getElementById('enterMap');
    if (!form || !select || !button) return;

    select.addEventListener('change', () => {
      button.disabled = !select.value;
      if (select.value) {
        button.textContent = 'Abrir mapa';
        window.localStorage?.setItem(STORAGE_KEY, select.value);
      }
    });

    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!select.value) return;
      const target = new URL('map.html', window.location.href);
      target.searchParams.set('region', select.value);
      window.location.href = target.toString();
    });
  }

  function init() {
    handleForm();
    fetchRegions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
