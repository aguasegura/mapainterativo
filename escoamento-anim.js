// Animação 2D do escoamento: partículas descendo as linhas de fluxo (montante -> jusante).
// O mapa usa preferCanvas, então nada de stroke-dashoffset em SVG: canvas próprio por cima do mapa.
// Uso: const anim = criarAnimacaoEscoamento(map, () => featuresVisiveis); anim.start(); anim.stop();
(function () {
  const MAX_PARTICULAS = 1200;
  const MIN_ZOOM = 12;           // abaixo disso a rede vira ruído e custa CPU à toa
  const RASTRO = 0.12;           // quanto o quadro anterior apaga (maior = rastro mais curto)
  const COR = 'rgba(0, 150, 200, 0.95)';

  function velocidadePx(areaHa) {
    // mais rápido onde drena mais área; log para o tronco não "teleportar"
    return 18 + 22 * Math.log10(Math.max(areaHa || 1, 1));
  }

  function linhasDe(feature) {
    const g = feature && feature.geometry;
    if (!g) return [];
    if (g.type === 'LineString') return [g.coordinates];
    if (g.type === 'MultiLineString') return g.coordinates;
    return [];
  }

  window.criarAnimacaoEscoamento = function (map, getFeatures) {
    const reduzMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvas = document.createElement('canvas');
    canvas.className = 'escoamento-anim';
    Object.assign(canvas.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: 450 });
    const ctx = canvas.getContext('2d');
    let caminhos = [];   // { latlngs, pts:[{x,y}], cum:[d], len, vel }
    let particulas = [];
    let raf = null, ultimo = 0, ativo = false, emZoom = false;

    function redimensionar() {
      const s = map.getSize(), dpr = window.devicePixelRatio || 1;
      canvas.width = s.x * dpr; canvas.height = s.y * dpr;
      canvas.style.width = `${s.x}px`; canvas.style.height = `${s.y}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    let origem = null;  // ponto de pixel do canto do mapa na última projeção completa
    function projetar(c) {
      const pts = c.latlngs.map(ll => map.latLngToContainerPoint(ll));
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
      c.pts = pts; c.cum = cum; c.len = cum[cum.length - 1];
    }

    function reconstruir() {
      caminhos = [];
      particulas = [];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (map.getZoom() < MIN_ZOOM) return;
      const b = map.getBounds().pad(0.1);
      (getFeatures() || []).forEach(f => {
        const vel = velocidadePx(f.properties && f.properties.area_contrib_ha);
        linhasDe(f).forEach(coords => {
          if (coords.length < 2) return;
          const latlngs = coords.map(c => L.latLng(c[1], c[0]));
          // trecho reto pode cruzar a tela com os dois vértices fora dela
          if (!L.latLngBounds(latlngs).intersects(b)) return;
          caminhos.push({ latlngs, vel });
        });
      });
      caminhos.forEach(projetar);
      origem = map.containerPointToLayerPoint([0, 0]);
      caminhos = caminhos.filter(c => c.len > 2);
    }

    function nova() {
      // sorteio ponderado pelo comprimento na tela: cobre a rede de modo uniforme
      const total = caminhos.reduce((s, c) => s + c.len, 0);
      let r = Math.random() * total;
      const c = caminhos.find(k => (r -= k.len) <= 0) || caminhos[caminhos.length - 1];
      return { c, d: Math.random() * c.len, vida: 1.5 + Math.random() * 3 };
    }

    function pontoEm(c, d) {
      let i = 1;
      while (i < c.cum.length - 1 && c.cum[i] < d) i++;
      const a = c.pts[i - 1], b = c.pts[i], seg = (c.cum[i] - c.cum[i - 1]) || 1;
      const t = Math.min(Math.max((d - c.cum[i - 1]) / seg, 0), 1);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }

    function quadro(t) {
      raf = requestAnimationFrame(quadro);
      const dt = Math.min((t - (ultimo || t)) / 1000, 0.05);
      ultimo = t;
      if (emZoom || !caminhos.length) return;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0,0,0,${RASTRO})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
      const alvo = Math.min(MAX_PARTICULAS, Math.round(caminhos.length * 1.5));
      while (particulas.length < alvo) particulas.push(nova());
      ctx.strokeStyle = COR; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath();
      particulas = particulas.filter(p => {
        const a = pontoEm(p.c, p.d);
        p.d += p.c.vel * dt; p.vida -= dt;
        if (p.d >= p.c.len || p.vida <= 0) return false;
        const b = pontoEm(p.c, p.d);
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        return true;
      });
      ctx.stroke();
    }

    function ligarSeVisivel() {
      const deveRodar = ativo && !document.hidden && map.getZoom() >= MIN_ZOOM &&
        !document.body.classList.contains('mode-3d');
      canvas.style.display = deveRodar ? '' : 'none';
      if (deveRodar && !raf) { ultimo = 0; raf = requestAnimationFrame(quadro); }
      if (!deveRodar && raf) { cancelAnimationFrame(raf); raf = null; }
    }

    const ev = {
      move: () => {
        // pan não muda a escala: basta transladar o que já está projetado
        if (!origem) return;
        const agora = map.containerPointToLayerPoint([0, 0]), dx = origem.x - agora.x, dy = origem.y - agora.y;
        if (!dx && !dy) return;
        caminhos.forEach(c => c.pts.forEach(p => { p.x += dx; p.y += dy; }));
        origem = agora;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      },
      moveend: () => { reconstruir(); ligarSeVisivel(); },
      zoomstart: () => { emZoom = true; ctx.clearRect(0, 0, canvas.width, canvas.height); },
      zoomend: () => { emZoom = false; },
      resize: () => { redimensionar(); reconstruir(); }
    };

    return {
      start() {
        if (ativo || reduzMovimento) return;
        ativo = true;
        emZoom = false;
        map.getContainer().appendChild(canvas);
        redimensionar(); reconstruir();
        map.on(ev);
        document.addEventListener('visibilitychange', ligarSeVisivel);
        ligarSeVisivel();
      },
      stop() {
        if (!ativo) return;
        ativo = false;
        map.off(ev);
        document.removeEventListener('visibilitychange', ligarSeVisivel);
        ligarSeVisivel();
        canvas.remove();
      },
      refresh() { if (ativo) { reconstruir(); ligarSeVisivel(); } }
    };
  };
})();
