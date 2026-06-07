/* ============================================================
   CONCRETE MIX OPTIMIZER — script.js v2.0
   Simulasi Optimasi Komposisi Campuran Beton

   Algoritma Implementasi:
   1. Hill Climbing   — Simple | Steepest-Ascent | Stochastic
   2. Simulated Annealing — Boltzmann acceptance, cooling schedule
   3. Genetic Algorithm   — Tournament/Roulette, crossover, mutasi, elitisme

   Masalah: Optimasi nonlinear multivariabel (4 dimensi)
   Fungsi Objektif: Multi-kriteria — Kekuatan (Abrams) + Workability − Biaya
   ============================================================ */

'use strict';

/* ============================================================
   UTILITY FUNCTIONS
   ============================================================ */

/** Random float dalam range [a, b) */
const rand = (a, b) => a + Math.random() * (b - a);

/** Random integer inklusif [a, b] */
const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));

/** Clamp: pastikan v berada dalam [a, b] */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ============================================================
   KONSTANTA — Batasan komposisi & harga material
   ============================================================ */

/**
 * Batasan komposisi campuran beton (kg/m³)
 * Sesuai standar ACI 211 dan SNI 03-2834
 */
const BOUNDS = {
    cement: [250, 450],   // Semen Portland
    sand:   [600, 900],   // Pasir halus (agregat halus)
    gravel: [900, 1200],  // Kerikil (agregat kasar)
    water:  [150, 220]    // Air
};

/**
 * Harga material beton (Rp/kg) — estimasi pasar Indonesia 2024
 * Semen Portland  : Rp 1.200 / kg
 * Pasir           : Rp   180 / kg
 * Kerikil/Agregat : Rp   150 / kg
 * Air             : Rp     5 / liter
 */
const PRICE = { cement: 1200, sand: 180, gravel: 150, water: 5 };

/* ============================================================
   FITNESS FUNCTION — Fungsi Objektif Multi-Kriteria
   ============================================================

   Komponen penilaian:
   1. Kekuatan f'c (MPa) — Model Abrams: f'c = A / B^(W/C)
      · Parameter: A = 96.5, B = 4.2 (kalibrasi kondisi normal)
      · Penalti jika W/C > 0.65 (campuran terlalu encer)
      · Koreksi rasio agregat (optimal: 0.78–0.84)
   2. Biaya (Rp/m³) — diminimalkan melalui penalti dalam skor
   3. Workability (cm slump) — harus ≥ 5 cm untuk digunakan

   Skor gabungan: score = 0.7·strength − 0.002·cost + 0.3·workability
   ============================================================ */

/**
 * Evaluasi kualitas campuran beton
 * @param {Object} mix - { cement, sand, gravel, water } (kg/m³)
 * @returns {Object} { score, strength, cost, workability, wc }
 */
function fitness(mix) {
    const { cement, sand, gravel, water } = mix;

    /* Water-Cement Ratio (rasio faktor kunci kekuatan beton) */
    const wc = water / cement;

    /* === Kekuatan beton: Hukum Abrams (semi-empiris) === */
    const A = 96.5, B = 4.2;
    let strength = A / Math.pow(B, wc);

    /* Penalti eksponensial jika W/C > 0.65 */
    if (wc > 0.65) {
        strength *= Math.exp(-3 * (wc - 0.65));
    }

    /* Koreksi rasio agregat: optimal 0.76–0.84 */
    const total    = cement + sand + gravel + water;
    const aggRatio = (sand + gravel) / total;
    const aggPen   = Math.max(0, Math.abs(aggRatio - 0.80) - 0.04);
    strength      *= (1 - 2 * aggPen);
    strength       = Math.max(0, strength);

    /* === Workability: cm slump (0–22 cm) === */
    const workability = clamp((wc - 0.3) * 28, 0, 22);

    /* === Biaya per m³ (dalam ribuan Rupiah) === */
    const cost = (
        cement * PRICE.cement +
        sand   * PRICE.sand   +
        gravel * PRICE.gravel +
        water  * PRICE.water
    ) / 1000;

    /* Penalti jika workability < 5 cm (campuran tidak bisa digunakan) */
    const workBonus = workability >= 5 ? 1.0 : 0.5;

    /* Skor gabungan: maksimalkan kekuatan + workability, minimasi biaya */
    const score = (strength * 0.70) - (cost * 0.002) + (workability * 0.30);

    return {
        score:       score * workBonus,
        strength:    +strength.toFixed(1),
        cost:        +cost.toFixed(0),
        workability: +workability.toFixed(1),
        wc:          +wc.toFixed(3)
    };
}

/* ============================================================
   HELPER FUNCTIONS
   ============================================================ */

/** Generate campuran beton acak dalam batas yang sah */
function randomMix() {
    return {
        cement: rand(BOUNDS.cement[0], BOUNDS.cement[1]),
        sand:   rand(BOUNDS.sand[0],   BOUNDS.sand[1]),
        gravel: rand(BOUNDS.gravel[0], BOUNDS.gravel[1]),
        water:  rand(BOUNDS.water[0],  BOUNDS.water[1])
    };
}

/** Ambil komposisi awal dari slider UI (shared-params) */
function getInitMix() {
    return {
        cement: +document.getElementById('init-cement').value,
        sand:   +document.getElementById('init-sand').value,
        gravel: +document.getElementById('init-gravel').value,
        water:  +document.getElementById('init-water').value
    };
}

/**
 * Generate satu tetangga acak (satu dimensi berubah)
 * Digunakan oleh Simple HC, Stochastic HC, dan SA
 */
function neighborMix(mix, step) {
    const keys = ['cement', 'sand', 'gravel', 'water'];
    const k  = keys[randInt(0, 3)];
    const nm = { ...mix };
    nm[k] = clamp(mix[k] + rand(-step, step), BOUNDS[k][0], BOUNDS[k][1]);
    return nm;
}

/**
 * Generate SEMUA tetangga (semua dimensi, beberapa delta)
 * Digunakan oleh Steepest-Ascent HC untuk memilih tetangga terbaik
 */
function allNeighbors(mix, step) {
    const keys   = ['cement', 'sand', 'gravel', 'water'];
    const deltas = [-step, -step * 0.5, step * 0.5, step];
    const result = [];
    keys.forEach(k => {
        deltas.forEach(d => {
            const nm = { ...mix };
            nm[k] = clamp(mix[k] + d, BOUNDS[k][0], BOUNDS[k][1]);
            result.push(nm);
        });
    });
    return result;
}

/* ============================================================
   UI HELPERS — Update tampilan nilai slider
   ============================================================ */

/** Update span display: id = input.id + '-val' */
function updateVal(input) {
    const el = document.getElementById(input.id + '-val');
    if (el) el.textContent = input.value;
}

/** Update span display dengan suffix (mis. 'kg') */
function updateValSuffix(input, suffix) {
    const el = document.getElementById(input.id + '-val');
    if (el) el.textContent = input.value + suffix;
}

/** Cooling rate: nilai 80–99 ditampilkan sebagai 0.80–0.99 */
function updateCoolingRate(input) {
    const el = document.getElementById(input.id + '-val');
    if (el) el.textContent = '0.' + input.value;
}

/** Crossover probability: 50–99 → 0.50–0.99 */
function updateCxProb(input) {
    const el = document.getElementById(input.id + '-val');
    if (el) el.textContent = '0.' + input.value;
}

/** Mutation probability: 1–30 → 0.01–0.30 */
function updateMutProb(input) {
    const el = document.getElementById(input.id + '-val');
    if (el) el.textContent = '0.' + String(input.value).padStart(2, '0');
}

/* ============================================================
   CHART MANAGEMENT
   ============================================================ */

const charts = {};  // Registry untuk destroy/recreate

/**
 * Buat atau perbarui Chart.js chart dengan tema dark
 * @param {string} id  - ID elemen canvas
 * @param {Object} cfg - Chart.js config {type, data, options}
 */
function makeChart(id, cfg) {
    if (charts[id]) charts[id].destroy();
    const canvas = document.getElementById(id);
    if (!canvas) return null;

    /* Warna tema dark */
    const GC = 'rgba(255,255,255,0.05)';  // grid color
    const TC = '#7a80b6';                  // tick color

    /* Merge scale defaults dengan konfigurasi yang diberikan */
    const rawScales = cfg.options?.scales || {};
    const scales    = {};
    const buildScale = (ext) => ({
        grid:  { color: GC, ...(ext?.grid  || {}) },
        ticks: { color: TC, font: { size: 9 }, maxTicksLimit: 10, ...(ext?.ticks || {}) },
        ...(ext || {})
    });

    if (Object.keys(rawScales).length === 0) {
        /* Default: x + y */
        scales.x = buildScale();
        scales.y = buildScale();
    } else {
        Object.keys(rawScales).forEach(k => {
            scales[k] = buildScale(rawScales[k]);
        });
    }

    const isNoScaleType = ['pie', 'doughnut', 'polarArea', 'radar'].includes(cfg.type);

    charts[id] = new Chart(canvas.getContext('2d'), {
        type: cfg.type,
        data: cfg.data,
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            animation:           { duration: 450, easing: 'easeOutQuart' },
            ...(cfg.options || {}),
            plugins: {
                legend: {
                    display: false,
                    labels:  { color: '#a2a6cc', font: { size: 11, family: "'JetBrains Mono'" }, boxWidth: 12 }
                },
                tooltip: {
                    backgroundColor: 'rgba(11,11,20,0.95)',
                    titleColor:      '#f8fafc',
                    bodyColor:       '#a2a6cc',
                    borderColor:     'rgba(255,255,255,0.08)',
                    borderWidth:     1
                },
                ...(cfg.options?.plugins || {})
            },
            scales: isNoScaleType ? undefined : scales
        }
    });
    return charts[id];
}

/** Render visualisasi komposisi campuran sebagai bar warna proporsional */
function mixBar(containerId, mix) {
    const total = mix.cement + mix.sand + mix.gravel + mix.water;
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = [
        `<div class="mix-bar" style="width:${(mix.cement/total*100).toFixed(1)}%;background:var(--c-cement)">${(mix.cement/total*100).toFixed(0)}%</div>`,
        `<div class="mix-bar" style="width:${(mix.sand/total*100).toFixed(1)}%;background:var(--c-sand)">${(mix.sand/total*100).toFixed(0)}%</div>`,
        `<div class="mix-bar" style="width:${(mix.gravel/total*100).toFixed(1)}%;background:var(--c-gravel)">${(mix.gravel/total*100).toFixed(0)}%</div>`,
        `<div class="mix-bar" style="width:${(mix.water/total*100).toFixed(1)}%;background:var(--c-water)">${(mix.water/total*100).toFixed(0)}%</div>`
    ].join('');
}

/** Tambah entri ke log area */
function addLog(id, msg, cls = '') {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = 'block';
    const d = document.createElement('div');
    d.className = 'log-entry' + (cls ? ' ' + cls : '');
    d.textContent = msg;
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
}

/** Hapus isi log area */
function clearLog(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '';
    el.style.display = 'block';
}

/** Helper: set textContent elemen */
const fill = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

/* ============================================================
   LANDSCAPE CHART — Visualisasi 1D fitness landscape
   ============================================================ */

/**
 * Gambar landscape fitness: semen (250-450) vs kekuatan (MPa)
 * Air, pasir, kerikil ditetapkan; semen divariasikan.
 * Overlay posisi solusi dari masing-masing algoritma.
 *
 * @param {string} canvasId   - ID canvas
 * @param {Array}  algResults - [{ label, color, mix, fit }]
 */
function drawLandscapeChart(canvasId, algResults) {
    const waterVal  = +document.getElementById('init-water').value;
    const sand      = 750, gravel = 1050;
    const cVals     = [], sVals = [];

    /* Hitung strength untuk setiap nilai semen */
    for (let c = 250; c <= 450; c += 2) {
        cVals.push(c);
        sVals.push(fitness({ cement: c, sand, gravel, water: waterVal }).strength);
    }

    /* Dataset utama: landscape */
    const datasets = [{
        label: 'Landscape f\'c',
        data:  sVals,
        borderColor:     'rgba(255,255,255,0.18)',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1.5,
        pointRadius: 0,
        fill: true,
        tension: 0.35
    }];

    /* Overlay marker masing-masing algoritma */
    const shapes = ['triangle', 'circle', 'rect', 'cross'];
    algResults.forEach((r, i) => {
        if (!r || !r.mix) return;
        const ci  = clamp(Math.round((r.mix.cement - 250) / 2), 0, cVals.length - 1);
        const pts = Array(cVals.length).fill(null);
        pts[ci]   = r.fit.strength;
        datasets.push({
            label:           r.label,
            data:            pts,
            borderColor:     r.color,
            backgroundColor: r.color,
            pointRadius:     10,
            pointHoverRadius:13,
            pointStyle:      shapes[i % shapes.length],
            showLine:        false
        });
    });

    makeChart(canvasId, {
        type: 'line',
        data: { labels: cVals, datasets },
        options: {
            plugins: { legend: { display: algResults.length > 0 } },
            scales: {
                x: { title: { display: true, text: 'Semen (kg/m³)',  color: '#a2a6cc', font: { size: 11 } } },
                y: { title: { display: true, text: 'Kekuatan (MPa)', color: '#a2a6cc', font: { size: 11 } } }
            }
        }
    });
}

/* ============================================================
   BOLTZMANN PROBABILITY CHART
   Visualisasi: P(accept) = exp(ΔE / T) vs Suhu (T)
   ============================================================ */

/**
 * Gambar kurva probabilitas penerimaan Boltzmann.
 * Dipanggil setelah SA selesai.
 */
function drawBoltzmannChart() {
    const T0   = +document.getElementById('sa-t0').value;
    const cr   = +document.getElementById('sa-cr').value / 100;
    const Tmin = +document.getElementById('sa-tmin').value;

    /* Hitung jadwal pendinginan */
    const temps = [];
    let T = T0;
    while (T > Tmin && temps.length < 300) { temps.push(T); T *= cr; }
    if (!temps.length) return;

    /* ΔE (perbedaan energi negatif = solusi lebih buruk) */
    const deltas = [-0.5, -2, -5, -15];
    const colors = ['#22c55e', '#f97316', '#a855f7', '#ef4444'];

    /* Label sumbu-x: tampilkan hanya beberapa titik */
    const skip   = Math.max(1, Math.floor(temps.length / 10));
    const labels = temps.map((t, i) => i % skip === 0 ? t.toFixed(0) : '');

    const datasets = deltas.map((d, i) => ({
        label:       `ΔE = ${d}`,
        data:        temps.map(t => +(Math.exp(d / t)).toFixed(4)),
        borderColor: colors[i],
        borderWidth: 1.8,
        pointRadius: 0,
        fill:        false,
        tension:     0.3
    }));

    /* Garis referensi P = 0.5 */
    datasets.push({
        label:       'P = 0.50 (threshold)',
        data:        Array(temps.length).fill(0.5),
        borderColor: 'rgba(255,255,255,0.18)',
        borderWidth: 1,
        borderDash:  [5, 5],
        pointRadius: 0,
        fill:        false
    });

    makeChart('sa-boltzmann-chart', {
        type: 'line',
        data: { labels, datasets },
        options: {
            plugins: { legend: { display: true } },
            scales: {
                x: {
                    reverse: false,
                    title:   { display: true, text: 'Suhu T (kiri = T₀ tinggi → kanan = T_min rendah)', color: '#a2a6cc', font: { size: 11 } }
                },
                y: {
                    min:   0, max: 1.02,
                    title: { display: true, text: 'P(accept)', color: '#a2a6cc', font: { size: 11 } }
                }
            }
        }
    });
}

/* ============================================================
   GLOBAL RESULTS STORE
   ============================================================ */
window._results = {};

/* ============================================================
   ALGORITMA 1: HILL CLIMBING
   Varian: Simple | Steepest-Ascent | Stochastic
   Fitur: Random Restart untuk menghindari local optima
   ============================================================ */

function runHC() {
    const maxIter  = +document.getElementById('hc-iter').value;
    const step     = +document.getElementById('hc-step').value;
    const variant  = document.getElementById('hc-variant').value;
    const restarts = +document.getElementById('hc-restart').value;

    const btn = document.getElementById('btn-hc');
    btn.disabled = true;
    clearLog('hc-log');
    document.getElementById('hc-results').style.display = 'none';
    document.getElementById('hc-chart-area').style.display = 'none';
    document.getElementById('hc-landscape-area').style.display = 'none';
    document.getElementById('status-hc').innerHTML = '<span class="spin">⟳</span> Menjalankan Hill Climbing...';

    setTimeout(() => {
        const curve = [];
        let globalBest = null, globalFit = null, totalIter = 0;

        for (let r = 0; r < restarts; r++) {
            /* Restart pertama: gunakan komposisi awal dari UI */
            let current = (r === 0) ? getInitMix() : randomMix();
            let curFit  = fitness(current);
            let localBest = { ...current }, localFit = { ...curFit };
            const ipr = Math.floor(maxIter / restarts);

            for (let i = 0; i < ipr; i++) {
                totalIter++;

                if (variant === 'simple') {
                    /* ---- Simple HC: ambil satu tetangga, pindah jika lebih baik ---- */
                    const next    = neighborMix(current, step);
                    const nextFit = fitness(next);
                    if (nextFit.score > curFit.score) { current = next; curFit = nextFit; }

                } else if (variant === 'steepest') {
                    /* ---- Steepest-Ascent HC: evaluasi semua tetangga, pilih terbaik ---- */
                    const neighbors = allNeighbors(current, step);
                    const fits      = neighbors.map(n => fitness(n));
                    const bi        = fits.reduce((a, _, i) => fits[i].score > fits[a].score ? i : a, 0);
                    if (fits[bi].score > curFit.score) { current = neighbors[bi]; curFit = fits[bi]; }

                } else {
                    /* ---- Stochastic HC: tetangga acak, 5% eksplorasi meskipun lebih buruk ---- */
                    const next    = neighborMix(current, step * 2);
                    const nextFit = fitness(next);
                    if (nextFit.score > curFit.score) {
                        current = next; curFit = nextFit;
                    } else if (Math.random() < 0.05) {
                        /* Eksplorasi acak untuk menghindari local optima */
                        current = next; curFit = nextFit;
                    }
                }

                if (curFit.score > localFit.score) { localBest = { ...current }; localFit = { ...curFit }; }
                curve.push(localFit.strength);
            }

            const isBetter = !globalFit || localFit.score > globalFit.score;
            addLog('hc-log',
                `[Restart ${r+1}/${restarts}] f'c: ${localFit.strength} MPa | Biaya: Rp${localFit.cost}k | W/C: ${localFit.wc}`,
                isBetter ? 'best' : ''
            );
            if (isBetter) { globalBest = { ...localBest }; globalFit = { ...localFit }; }
        }

        /* Tampilkan hasil */
        fill('hc-strength', globalFit.strength + ' MPa');
        fill('hc-cost',     'Rp' + globalFit.cost + 'k');
        fill('hc-work',     globalFit.workability + ' cm');
        fill('hc-iters',    totalIter);
        document.getElementById('hc-results').style.display = 'grid';
        document.getElementById('hc-chart-area').style.display = 'block';
        document.getElementById('hc-landscape-area').style.display = 'block';
        document.getElementById('status-hc').innerHTML =
            `Selesai! f'c optimal: <span>${globalFit.strength} MPa</span> | W/C: <span>${globalFit.wc}</span> | Iterasi: <span>${totalIter}</span>`;

        /* Kurva konvergensi */
        const skip = Math.max(1, Math.floor(curve.length / 120));
        makeChart('hc-chart', {
            type: 'line',
            data: {
                labels: curve.filter((_, i) => i % skip === 0).map((_, i) => (i * skip + 1) + ''),
                datasets: [{
                    label: "f'c (MPa)", data: curve.filter((_, i) => i % skip === 0),
                    borderColor: '#f97316', borderWidth: 2, pointRadius: 0,
                    fill: true, backgroundColor: 'rgba(249,115,22,0.08)', tension: 0.3
                }]
            }
        });

        mixBar('hc-mix-bar', globalBest);

        /* Landscape chart */
        drawLandscapeChart('hc-landscape-chart', [
            { label: 'HC (' + variant + ')', color: '#f97316', mix: globalBest, fit: globalFit }
        ]);

        /* Update landscape di tab Local Optima juga */
        _updateGlobalLandscape();

        window._results.hc = { fit: globalFit, mix: globalBest, iters: totalIter, curve };
        btn.disabled = false;
    }, 50);
}

/* ============================================================
   ALGORITMA 2: SIMULATED ANNEALING
   Cooling schedule: T_{k+1} = α · T_k  (geometrik)
   Penerimaan solusi buruk: P(accept) = exp(ΔE / T)  — Boltzmann
   ============================================================ */

function runSA() {
    const T0    = +document.getElementById('sa-t0').value;
    const cr    = +document.getElementById('sa-cr').value / 100;
    const Tmin  = +document.getElementById('sa-tmin').value;
    const inner = +document.getElementById('sa-inner').value;

    const btn = document.getElementById('btn-sa');
    btn.disabled = true;
    clearLog('sa-log');
    document.getElementById('sa-results').style.display = 'none';
    document.getElementById('sa-chart-area').style.display = 'none';
    document.getElementById('sa-boltzmann-area').style.display = 'none';
    document.getElementById('status-sa').innerHTML = '<span class="spin">⟳</span> Menjalankan Simulated Annealing...';

    setTimeout(() => {
        let current = getInitMix();
        let curFit  = fitness(current);
        let best    = { ...current }, bestFit = { ...curFit };
        const curve = [], tempLog = [];
        let T = T0, totalIter = 0, acceptedWorse = 0;

        while (T > Tmin) {
            for (let i = 0; i < inner; i++) {
                totalIter++;
                const next    = neighborMix(current, 15);
                const nextFit = fitness(next);
                const delta   = nextFit.score - curFit.score;

                if (delta > 0) {
                    /* Solusi lebih baik — selalu diterima */
                    current = next; curFit = nextFit;
                } else {
                    /* Solusi lebih buruk — diterima dengan probabilitas Boltzmann */
                    const prob = Math.exp(delta / T);
                    if (Math.random() < prob) { current = next; curFit = nextFit; acceptedWorse++; }
                }
                if (curFit.score > bestFit.score) { best = { ...current }; bestFit = { ...curFit }; }
            }
            curve.push(bestFit.strength);
            tempLog.push(+T.toFixed(2));
            if (totalIter % 60 === 0) {
                addLog('sa-log', `T=${T.toFixed(1)} | f'c: ${bestFit.strength} MPa | W/C: ${bestFit.wc}`, '');
            }
            T *= cr;
        }

        fill('sa-strength', bestFit.strength + ' MPa');
        fill('sa-cost',     'Rp' + bestFit.cost + 'k');
        fill('sa-work',     bestFit.workability + ' cm');
        fill('sa-iters',    totalIter);
        document.getElementById('sa-results').style.display = 'grid';
        document.getElementById('sa-chart-area').style.display = 'block';
        document.getElementById('sa-boltzmann-area').style.display = 'block';
        document.getElementById('status-sa').innerHTML =
            `Selesai! f'c: <span>${bestFit.strength} MPa</span> | W/C: <span>${bestFit.wc}</span> | Solusi buruk diterima: <span>${acceptedWorse}</span>x`;

        /* Chart konvergensi + penurunan suhu (dual axis) */
        const skip = Math.max(1, Math.floor(curve.length / 120));
        const cD   = curve.filter((_, i) => i % skip === 0);
        const tD   = tempLog.filter((_, i) => i % skip === 0);
        const lbl  = cD.map((_, i) => (i * skip + 1) + '');

        makeChart('sa-chart', {
            type: 'line',
            data: {
                labels: lbl,
                datasets: [
                    {
                        label: "f'c (MPa)", data: cD,
                        borderColor: '#a855f7', borderWidth: 2, pointRadius: 0,
                        fill: true, backgroundColor: 'rgba(168,85,247,0.08)', tension: 0.3, yAxisID: 'y'
                    },
                    {
                        label: 'Suhu T', data: tD,
                        borderColor: '#fbbf24', borderWidth: 1.5, borderDash: [5, 5],
                        pointRadius: 0, fill: false, tension: 0, yAxisID: 'y1'
                    }
                ]
            },
            options: {
                plugins: { legend: { display: true } },
                scales: {
                    y:  { title: { display: true, text: "f'c (MPa)", color: '#a2a6cc', font: { size: 11 } } },
                    y1: {
                        position: 'right',
                        title:    { display: true, text: 'Suhu', color: '#a2a6cc', font: { size: 11 } },
                        grid:     { drawOnChartArea: false }
                    }
                }
            }
        });

        mixBar('sa-mix-bar', best);
        drawBoltzmannChart();
        _updateGlobalLandscape();

        window._results.sa = { fit: bestFit, mix: best, iters: totalIter, curve };
        btn.disabled = false;
    }, 50);
}

/* ============================================================
   ALGORITMA 3: GENETIC ALGORITHM
   Representasi: kromosom = [cement, sand, gravel, water]
   Seleksi: Tournament (k=3) | Roulette Wheel (Fitness Proportional)
   Crossover: Single-point (titik potong acak 1–3)
   Mutasi: Gaussian perturbation (±20 kg, per gen)
   Elitisme: top-N diwariskan langsung tanpa modifikasi
   ============================================================ */

function runGA() {
    const popSize = +document.getElementById('ga-pop').value;
    const maxGen  = +document.getElementById('ga-gen').value;
    const cxProb  = +document.getElementById('ga-cx').value / 100;
    const mutProb = +document.getElementById('ga-mut').value / 100;
    const elite   = +document.getElementById('ga-elite').value;
    const selType = document.getElementById('ga-sel').value;

    const btn = document.getElementById('btn-ga');
    btn.disabled = true;
    clearLog('ga-log');
    document.getElementById('ga-results').style.display = 'none';
    document.getElementById('ga-chart-area').style.display = 'none';
    document.getElementById('status-ga').innerHTML = '<span class="spin">⟳</span> Menjalankan Genetic Algorithm...';

    setTimeout(() => {
        /* Inisialisasi populasi awal secara acak */
        let pop  = Array.from({ length: popSize }, randomMix);
        let fits = pop.map(fitness);
        const bestCurve = [], avgCurve = [];
        let globalBest = null, globalFit = null;

        for (let g = 0; g < maxGen; g++) {
            /* Urutkan populasi (descending fitness) */
            const sorted = pop.map((m, i) => ({ m, f: fits[i] })).sort((a, b) => b.f.score - a.f.score);

            /* Update solusi terbaik global */
            if (!globalFit || sorted[0].f.score > globalFit.score) {
                globalBest = { ...sorted[0].m };
                globalFit  = { ...sorted[0].f };
            }

            /* Statistik generasi */
            const avgStr = fits.reduce((s, f) => s + f.strength, 0) / popSize;
            bestCurve.push(sorted[0].f.strength);
            avgCurve.push(+avgStr.toFixed(1));

            if (g % 10 === 0 || g === maxGen - 1) {
                addLog('ga-log', `Gen ${g+1}/${maxGen} | Terbaik: ${sorted[0].f.strength} MPa | Rata-rata: ${avgStr.toFixed(1)} MPa`, '');
            }

            /* === Elitisme: pertahankan top-N individu === */
            const newPop = sorted.slice(0, elite).map(x => ({ ...x.m }));

            /* === Seleksi + Crossover + Mutasi === */
            while (newPop.length < popSize) {
                let p1, p2;

                if (selType === 'tournament') {
                    /* Tournament selection (k = 3) */
                    const tourney = (s) => {
                        const k = Math.min(3, s.length);
                        let best = s[randInt(0, s.length - 1)];
                        for (let t = 1; t < k; t++) {
                            const cand = s[randInt(0, s.length - 1)];
                            if (cand.f.score > best.f.score) best = cand;
                        }
                        return best.m;
                    };
                    p1 = tourney(sorted); p2 = tourney(sorted);
                } else {
                    /* Roulette Wheel (Fitness Proportional) selection */
                    const minS   = Math.min(...sorted.map(x => x.f.score));
                    const adj    = sorted.map(x => x.f.score - minS + 1);
                    const total  = adj.reduce((s, a) => s + a, 0);
                    const spin   = () => {
                        let r = Math.random() * total, cum = 0;
                        for (let i = 0; i < sorted.length; i++) {
                            cum += adj[i];
                            if (cum >= r) return sorted[i].m;
                        }
                        return sorted[0].m;
                    };
                    p1 = spin(); p2 = spin();
                }

                /* Single-point Crossover */
                let child = { ...p1 };
                if (Math.random() < cxProb) {
                    const keys  = ['cement', 'sand', 'gravel', 'water'];
                    const point = randInt(1, 3);
                    keys.forEach((k, i) => { if (i >= point) child[k] = p2[k]; });
                }

                /* Gaussian Mutation (±20 kg per gen yang termutasi) */
                ['cement', 'sand', 'gravel', 'water'].forEach(k => {
                    if (Math.random() < mutProb) {
                        child[k] = clamp(child[k] + rand(-20, 20), BOUNDS[k][0], BOUNDS[k][1]);
                    }
                });

                newPop.push(child);
            }

            pop  = newPop;
            fits = pop.map(fitness);
        }

        fill('ga-strength', globalFit.strength + ' MPa');
        fill('ga-cost',     'Rp' + globalFit.cost + 'k');
        fill('ga-work',     globalFit.workability + ' cm');
        fill('ga-gens',     maxGen + ' gen');
        document.getElementById('ga-results').style.display = 'grid';
        document.getElementById('ga-chart-area').style.display = 'block';
        document.getElementById('status-ga').innerHTML =
            `Selesai! f'c: <span>${globalFit.strength} MPa</span> | Populasi: <span>${popSize}</span> | Generasi: <span>${maxGen}</span>`;

        /* Kurva evolusi populasi */
        makeChart('ga-chart', {
            type: 'line',
            data: {
                labels: bestCurve.map((_, i) => i + 1 + ''),
                datasets: [
                    {
                        label: 'Terbaik', data: bestCurve,
                        borderColor: '#22c55e', borderWidth: 2, pointRadius: 0, fill: false, tension: 0.3
                    },
                    {
                        label: 'Rata-rata', data: avgCurve,
                        borderColor: '#22c55e', borderWidth: 1, borderDash: [4, 4],
                        pointRadius: 0, fill: true, backgroundColor: 'rgba(34,197,94,0.06)', tension: 0.3
                    }
                ]
            },
            options: { plugins: { legend: { display: true } } }
        });

        mixBar('ga-mix-bar', globalBest);
        _updateGlobalLandscape();

        window._results.ga = { fit: globalFit, mix: globalBest, iters: maxGen, curve: bestCurve };
        btn.disabled = false;
    }, 50);
}

/* ============================================================
   UPDATE LANDSCAPE DI TAB LOCAL OPTIMA
   Dipanggil setelah setiap algoritma selesai
   ============================================================ */
function _updateGlobalLandscape() {
    const r = window._results;
    const overlays = [];
    if (r.hc) overlays.push({ label: 'HC', color: '#f97316', mix: r.hc.mix, fit: r.hc.fit });
    if (r.sa) overlays.push({ label: 'SA', color: '#a855f7', mix: r.sa.mix, fit: r.sa.fit });
    if (r.ga) overlays.push({ label: 'GA', color: '#22c55e', mix: r.ga.mix, fit: r.ga.fit });
    drawLandscapeChart('landscape-chart', overlays);
}

/* ============================================================
   RUN ALL — Perbandingan semua algoritma
   ============================================================ */

function runAll() {
    const btn = document.getElementById('btn-all');
    btn.disabled = true;
    document.getElementById('compare-cards').style.display = 'none';
    document.getElementById('status-all').innerHTML = '<span class="spin">⟳</span> Menjalankan semua algoritma...';

    setTimeout(() => {
        window._results = {};
        const times = {};
        let t;

        t = performance.now(); _runHCSilent(); times.hc = performance.now() - t;
        t = performance.now(); _runSASilent(); times.sa = performance.now() - t;
        t = performance.now(); _runGASilent(); times.ga = performance.now() - t;

        const r = window._results;
        if (!r.hc || !r.sa || !r.ga) { btn.disabled = false; return; }

        /* Isi kartu perbandingan */
        fill('cmp-hc-str',  r.hc.fit.strength + ' MPa');
        fill('cmp-hc-cost', 'Rp' + r.hc.fit.cost + 'k');
        fill('cmp-hc-work', r.hc.fit.workability + ' cm');
        fill('cmp-hc-iter', r.hc.iters + ' iter');
        fill('cmp-hc-time', times.hc.toFixed(0) + ' ms');
        fill('cmp-sa-str',  r.sa.fit.strength + ' MPa');
        fill('cmp-sa-cost', 'Rp' + r.sa.fit.cost + 'k');
        fill('cmp-sa-work', r.sa.fit.workability + ' cm');
        fill('cmp-sa-iter', r.sa.iters + ' iter');
        fill('cmp-sa-time', times.sa.toFixed(0) + ' ms');
        fill('cmp-ga-str',  r.ga.fit.strength + ' MPa');
        fill('cmp-ga-cost', 'Rp' + r.ga.fit.cost + 'k');
        fill('cmp-ga-work', r.ga.fit.workability + ' cm');
        fill('cmp-ga-iter', r.ga.iters + ' gen');
        fill('cmp-ga-time', times.ga.toFixed(0) + ' ms');

        /* Isi tabel metrik lengkap */
        fill('mt-hc-str',    r.hc.fit.strength + ' MPa');   fill('mt-sa-str',    r.sa.fit.strength + ' MPa');   fill('mt-ga-str',    r.ga.fit.strength + ' MPa');
        fill('mt-hc-cost',   'Rp' + r.hc.fit.cost + 'k');  fill('mt-sa-cost',   'Rp' + r.sa.fit.cost + 'k');  fill('mt-ga-cost',   'Rp' + r.ga.fit.cost + 'k');
        fill('mt-hc-work',   r.hc.fit.workability + ' cm'); fill('mt-sa-work',   r.sa.fit.workability + ' cm'); fill('mt-ga-work',   r.ga.fit.workability + ' cm');
        fill('mt-hc-wc',     r.hc.fit.wc);                  fill('mt-sa-wc',     r.sa.fit.wc);                  fill('mt-ga-wc',     r.ga.fit.wc);
        fill('mt-hc-iter',   r.hc.iters + ' iter');         fill('mt-sa-iter',   r.sa.iters + ' iter');         fill('mt-ga-iter',   r.ga.iters + ' gen');
        fill('mt-hc-time',   times.hc.toFixed(1) + ' ms');  fill('mt-sa-time',   times.sa.toFixed(1) + ' ms');  fill('mt-ga-time',   times.ga.toFixed(1) + ' ms');
        fill('mt-hc-cement', r.hc.mix.cement.toFixed(0) + ' kg'); fill('mt-sa-cement', r.sa.mix.cement.toFixed(0) + ' kg'); fill('mt-ga-cement', r.ga.mix.cement.toFixed(0) + ' kg');
        fill('mt-hc-water',  r.hc.mix.water.toFixed(0) + ' kg');  fill('mt-sa-water',  r.sa.mix.water.toFixed(0) + ' kg');  fill('mt-ga-water',  r.ga.mix.water.toFixed(0) + ' kg');

        /* Winner badge (kekuatan terbaik) */
        const maxStr = Math.max(r.hc.fit.strength, r.sa.fit.strength, r.ga.fit.strength);
        [['cmp-hc-badge', r.hc.fit.strength], ['cmp-sa-badge', r.sa.fit.strength], ['cmp-ga-badge', r.ga.fit.strength]]
            .forEach(([id, v]) => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = v === maxStr ? '<span class="winner-badge">🏆 KEKUATAN TERBAIK</span>' : '';
            });

        document.getElementById('compare-cards').style.display = 'block';

        /* Chart konvergensi */
        const interp = (arr, n) => Array.from({ length: n }, (_, i) => arr[Math.floor(i / n * arr.length)]);
        const N = 100;
        const hcD = interp(r.hc.curve, N), saD = interp(r.sa.curve, N), gaD = interp(r.ga.curve, N);
        makeChart('cmp-chart', {
            type: 'line',
            data: {
                labels: hcD.map((_, i) => i + 1 + ''),
                datasets: [
                    { label: 'Hill Climbing',  data: hcD, borderColor: '#f97316', borderWidth: 2, pointRadius: 0, fill: false, tension: 0.3 },
                    { label: 'Sim. Annealing', data: saD, borderColor: '#a855f7', borderWidth: 2, pointRadius: 0, fill: false, tension: 0.3, borderDash: [6, 4] },
                    { label: 'Genetic Algo',   data: gaD, borderColor: '#22c55e', borderWidth: 2, pointRadius: 0, fill: false, tension: 0.3, borderDash: [2, 3] }
                ]
            },
            options: { plugins: { legend: { display: true } } }
        });

        /* Bar chart metrik */
        makeChart('cmp-bar', {
            type: 'bar',
            data: {
                labels: ['Kekuatan (MPa)', 'Workability (cm)'],
                datasets: [
                    { label: 'HC', data: [r.hc.fit.strength, r.hc.fit.workability], backgroundColor: 'rgba(249,115,22,0.75)', borderRadius: 5 },
                    { label: 'SA', data: [r.sa.fit.strength, r.sa.fit.workability], backgroundColor: 'rgba(168,85,247,0.75)',  borderRadius: 5 },
                    { label: 'GA', data: [r.ga.fit.strength, r.ga.fit.workability], backgroundColor: 'rgba(34,197,94,0.75)',   borderRadius: 5 }
                ]
            },
            options: { plugins: { legend: { display: true } } }
        });

        /* Update landscape tab */
        _updateGlobalLandscape();

        document.getElementById('status-all').innerHTML =
            `Perbandingan selesai! f'c terbaik: <span>${maxStr} MPa</span>`;
        btn.disabled = false;
    }, 50);
}

/* ============================================================
   SILENT RUNNERS — Tanpa update UI (untuk runAll)
   ============================================================ */

function _runHCSilent() {
    const maxIter = +document.getElementById('hc-iter').value;
    const step    = +document.getElementById('hc-step').value;
    const restarts= +document.getElementById('hc-restart').value;
    const curve = [];
    let globalBest = null, globalFit = null, totalIter = 0;
    for (let r = 0; r < restarts; r++) {
        let cur = (r === 0) ? getInitMix() : randomMix(), curFit = fitness(cur);
        let lb = { ...cur }, lf = { ...curFit };
        const ipr = Math.floor(maxIter / restarts);
        for (let i = 0; i < ipr; i++) {
            totalIter++;
            const nx = neighborMix(cur, step), nf = fitness(nx);
            if (nf.score > curFit.score) { cur = nx; curFit = nf; }
            if (curFit.score > lf.score) { lb = { ...cur }; lf = { ...curFit }; }
            curve.push(lf.strength);
        }
        if (!globalFit || lf.score > globalFit.score) { globalBest = { ...lb }; globalFit = { ...lf }; }
    }
    window._results.hc = { fit: globalFit, mix: globalBest, iters: totalIter, curve };
}

function _runSASilent() {
    const T0 = +document.getElementById('sa-t0').value;
    const cr = +document.getElementById('sa-cr').value / 100;
    const Tmin = +document.getElementById('sa-tmin').value;
    const inner = +document.getElementById('sa-inner').value;
    let cur = getInitMix(), curFit = fitness(cur), best = { ...cur }, bestFit = { ...curFit };
    let T = T0, totalIter = 0;
    const curve = [];
    while (T > Tmin) {
        for (let i = 0; i < inner; i++) {
            totalIter++;
            const nx = neighborMix(cur, 15), nf = fitness(nx), delta = nf.score - curFit.score;
            if (delta > 0) { cur = nx; curFit = nf; }
            else if (Math.random() < Math.exp(delta / T)) { cur = nx; curFit = nf; }
            if (curFit.score > bestFit.score) { best = { ...cur }; bestFit = { ...curFit }; }
        }
        curve.push(bestFit.strength); T *= cr;
    }
    window._results.sa = { fit: bestFit, mix: best, iters: totalIter, curve };
}

function _runGASilent() {
    const popSize = +document.getElementById('ga-pop').value;
    const maxGen  = +document.getElementById('ga-gen').value;
    const cxProb  = +document.getElementById('ga-cx').value / 100;
    const mutProb = +document.getElementById('ga-mut').value / 100;
    const elite   = +document.getElementById('ga-elite').value;
    let pop = Array.from({ length: popSize }, randomMix), fits = pop.map(fitness);
    const bestCurve = [];
    let globalBest = null, globalFit = null;
    for (let g = 0; g < maxGen; g++) {
        const sorted = pop.map((m, i) => ({ m, f: fits[i] })).sort((a, b) => b.f.score - a.f.score);
        if (!globalFit || sorted[0].f.score > globalFit.score) { globalBest = { ...sorted[0].m }; globalFit = { ...sorted[0].f }; }
        bestCurve.push(sorted[0].f.strength);
        const newPop = sorted.slice(0, elite).map(x => ({ ...x.m }));
        while (newPop.length < popSize) {
            const p1 = sorted[randInt(0, Math.min(5, sorted.length-1))].m;
            const p2 = sorted[randInt(0, Math.min(5, sorted.length-1))].m;
            let child = { ...p1 };
            if (Math.random() < cxProb) {
                const pt = randInt(1, 3);
                ['cement','sand','gravel','water'].forEach((k, i) => { if (i >= pt) child[k] = p2[k]; });
            }
            ['cement','sand','gravel','water'].forEach(k => {
                if (Math.random() < mutProb) child[k] = clamp(child[k] + rand(-20, 20), BOUNDS[k][0], BOUNDS[k][1]);
            });
            newPop.push(child);
        }
        pop = newPop; fits = pop.map(fitness);
    }
    window._results.ga = { fit: globalFit, mix: globalBest, iters: maxGen, curve: bestCurve };
}

/* ============================================================
   LOCAL OPTIMA DEMO
   Demonstrasikan fenomena local optima:
   jalankan HC tanpa restart dari N titik acak berbeda,
   bandingkan hasil akhirnya.
   ============================================================ */

function runLocalOptimaDemo() {
    const numRuns = +document.getElementById('demo-runs').value;
    const btn     = document.getElementById('btn-demo');
    btn.disabled  = true;
    document.getElementById('status-demo').innerHTML = '<span class="spin">⟳</span> Menjalankan demo...';
    document.getElementById('optima-chart-area').style.display = 'none';
    document.getElementById('optima-results').style.display = 'none';

    setTimeout(() => {
        const ITER = 250, STEP = 10;
        const allRes = [], allCurves = [];

        /* Jalankan HC dari numRuns titik awal acak — tanpa random restart */
        for (let r = 0; r < numRuns; r++) {
            let cur = randomMix(), curFit = fitness(cur);
            let lb  = { ...cur }, lf = { ...curFit };
            const curve = [lf.strength];

            for (let i = 0; i < ITER; i++) {
                const nx = neighborMix(cur, STEP), nf = fitness(nx);
                if (nf.score > curFit.score) { cur = nx; curFit = nf; }
                if (curFit.score > lf.score) { lb = { ...cur }; lf = { ...curFit }; }
                curve.push(lf.strength);
            }
            allRes.push({ mix: lb, fit: lf });
            allCurves.push(curve);
        }

        /* Statistik */
        const sortedRes = [...allRes].sort((a, b) => b.fit.strength - a.fit.strength);
        const gBest = sortedRes[0], gWorst = sortedRes[sortedRes.length - 1];
        const diff  = (gBest.fit.strength - gWorst.fit.strength).toFixed(1);

        fill('demo-local-count', numRuns);
        fill('demo-best-val',    gBest.fit.strength + ' MPa');
        fill('demo-worst-val',   gWorst.fit.strength + ' MPa');
        fill('demo-diff-val',    diff + ' MPa');

        /* Warna untuk masing-masing run */
        const palette = [
            '#f97316','#a855f7','#22c55e','#60a8f0','#fbbf24',
            '#f43f5e','#06b6d4','#8b5cf6','#10b981','#ec4899',
            '#3b82f6','#d97706','#14b8a6','#6366f1','#84cc16'
        ];
        const maxLen = Math.max(...allCurves.map(c => c.length));
        const labels = Array.from({ length: maxLen }, (_, i) => i + '');

        /* Chart trajektori */
        makeChart('optima-traj-chart', {
            type: 'line',
            data: {
                labels,
                datasets: allCurves.map((curve, i) => ({
                    label:       `Run ${i+1}: ${allRes[i].fit.strength} MPa`,
                    data:        curve,
                    borderColor: palette[i % palette.length],
                    borderWidth: 1.5,
                    pointRadius: 0,
                    fill:        false,
                    tension:     0.3
                }))
            },
            options: {
                plugins: { legend: { display: numRuns <= 8, labels: { font: { size: 9 }, boxWidth: 10 } } },
                scales: {
                    x: { title: { display: true, text: 'Iterasi', color: '#a2a6cc', font: { size: 11 } } },
                    y: { title: { display: true, text: 'Kekuatan (MPa)', color: '#a2a6cc', font: { size: 11 } } }
                }
            }
        });

        /* Chart distribusi kekuatan */
        const maxStrOpt = Math.max(...allRes.map(r => r.fit.strength));
        makeChart('optima-dist-chart', {
            type: 'bar',
            data: {
                labels: allRes.map((_, i) => 'Run ' + (i+1)),
                datasets: [{
                    label: 'Kekuatan (MPa)',
                    data:  allRes.map(r => r.fit.strength),
                    backgroundColor: allRes.map(r =>
                        r.fit.strength === maxStrOpt
                            ? 'rgba(34,197,94,0.85)'
                            : 'rgba(249,115,22,0.55)'
                    ),
                    borderRadius: 5
                }]
            },
            options: { plugins: { legend: { display: false } } }
        });

        /* Update landscape dengan posisi best & worst */
        drawLandscapeChart('landscape-chart', [
            { label: 'Global Best', color: '#22c55e', mix: gBest.mix,  fit: gBest.fit },
            { label: 'Local Worst', color: '#ef4444', mix: gWorst.mix, fit: gWorst.fit },
            ...(window._results.sa ? [{ label: 'SA', color: '#a855f7', mix: window._results.sa.mix, fit: window._results.sa.fit }] : []),
            ...(window._results.ga ? [{ label: 'GA', color: '#22c55e', mix: window._results.ga.mix, fit: window._results.ga.fit }] : [])
        ]);

        document.getElementById('optima-chart-area').style.display = 'block';
        document.getElementById('optima-results').style.display = 'block';
        document.getElementById('status-demo').innerHTML =
            `Demo selesai! ${numRuns} percobaan HC independen — selisih: <span>${diff} MPa</span> (global vs local optima)`;

        btn.disabled = false;
    }, 50);
}

/* ============================================================
   TAB SWITCHING
   ============================================================ */

function switchTab(name, el) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById('panel-' + name).classList.add('active');
    el.classList.add('active');
}

/* ============================================================
   INISIALISASI
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    /* Gambar landscape awal tanpa result markers */
    drawLandscapeChart('landscape-chart', []);
});