// === XSS safety: escape user/data-provided strings before HTML interpolation ===
function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// === Empty-data guard ===
if (typeof OVERVIEW === 'undefined') {
  const errDiv = document.createElement('div');
  errDiv.setAttribute('role', 'alert');
  errDiv.style.cssText = 'background:#f85149;color:#fff;padding:1rem;margin:1rem;border-radius:6px;font-weight:600;';
  errDiv.textContent = 'Error: Dashboard data failed to load. Ensure data.js is present and loads before this page.';
  document.body.prepend(errDiv);
}

// === Accessibility: reduced motion ===
const REDUCE_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;

// === Theme Toggle ===
var themeVersion = 0;
var tabThemeVersion = {};

function isDark() {
  return document.documentElement.getAttribute('data-theme') !== 'light';
}

function getThemeColors() {
  var s = getComputedStyle(document.documentElement);
  return {
    textPrimary:   s.getPropertyValue('--text-primary').trim()   || '#e6edf3',
    textSecondary: s.getPropertyValue('--text-secondary').trim() || '#8b949e',
    splitLine:     s.getPropertyValue('--border-subtle').trim()  || '#21262d',
    bgLow:         s.getPropertyValue('--bg-secondary').trim()   || '#161b22',
    borderColor:   s.getPropertyValue('--border').trim()         || '#30363d',
    borderSubtle:  s.getPropertyValue('--border-subtle').trim()  || '#21262d'
  };
}

(function initTheme() {
  var saved = localStorage.getItem('sust-dashboard-theme');
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
  var btn = document.getElementById('themeToggle');
  if (btn) {
    function updateToggleButton() {
      var dark = isDark();
      btn.textContent = dark ? 'Light' : 'Dark';
      btn.setAttribute('aria-pressed', dark ? 'false' : 'true');
      btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    }
    updateToggleButton();
    btn.addEventListener('click', function() {
      var nowLight = isDark();
      document.documentElement.setAttribute('data-theme', nowLight ? 'light' : '');
      if (nowLight) {
        localStorage.setItem('sust-dashboard-theme', 'light');
      } else {
        localStorage.removeItem('sust-dashboard-theme');
      }
      updateToggleButton();
      themeVersion++;
      updateAllChartsTheme();
    });
  }
})();

function updateAllChartsTheme() {
  var tc = getThemeColors();
  var allCharts = document.querySelectorAll('[id^="chart-"]');
  allCharts.forEach(function(el) {
    var inst = echarts.getInstanceByDom(el);
    if (!inst || inst.isDisposed()) return;
    var opt = inst.getOption();
    var patch = {};
    // Update axes
    if (opt.xAxis) {
      patch.xAxis = opt.xAxis.map(function(ax) {
        var p = { axisLabel: { color: ax.type === 'category' ? tc.textPrimary : tc.textSecondary } };
        if (ax.nameTextStyle) p.nameTextStyle = { color: tc.textSecondary };
        if (ax.splitLine) p.splitLine = { lineStyle: { color: tc.splitLine } };
        return p;
      });
    }
    if (opt.yAxis) {
      patch.yAxis = opt.yAxis.map(function(ax) {
        var p = { axisLabel: { color: ax.type === 'category' ? tc.textPrimary : tc.textSecondary } };
        if (ax.splitLine) p.splitLine = { lineStyle: { color: tc.splitLine } };
        return p;
      });
    }
    // Update legend
    if (opt.legend && opt.legend.length) {
      patch.legend = [{ textStyle: { color: tc.textPrimary } }];
    }
    // Update visualMap
    if (opt.visualMap && opt.visualMap.length) {
      patch.visualMap = opt.visualMap.map(function(vm) {
        var p = { textStyle: { color: tc.textSecondary } };
        if (vm.inRange && vm.inRange.color) {
          p.inRange = { color: [tc.bgLow, vm.inRange.color[1]] };
        }
        return p;
      });
    }
    // Update series labels (pie charts unconditionally; others by presence)
    if (opt.series) {
      opt.series.forEach(function(s, i) {
        if (s.type === 'pie') {
          if (!patch.series) patch.series = [];
          patch.series[i] = {
            label: { color: tc.textPrimary },
            emphasis: { label: { color: tc.textPrimary } },
            labelLine: { lineStyle: { color: tc.textSecondary } }
          };
        } else {
          if (s.itemStyle && s.itemStyle[0] && s.itemStyle[0].borderColor) {
            if (!patch.series) patch.series = [];
            patch.series[i] = { itemStyle: { borderColor: tc.borderColor } };
          }
        }
      });
    }
    inst.setOption(patch);
  });
  // Track version for lazy tab re-render
  var activeTab = document.querySelector('.tab-pane.active');
  if (activeTab) tabThemeVersion[activeTab.id] = themeVersion;
}

// === Tab Navigation ===
document.querySelectorAll('[role="tab"][data-tab]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('[role="tab"][data-tab]').forEach(l => {
      l.classList.remove('active');
      l.setAttribute('aria-selected', 'false');
      l.setAttribute('tabindex', '-1');
    });
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    link.classList.add('active');
    link.setAttribute('aria-selected', 'true');
    link.setAttribute('tabindex', '0');
    var tabId = link.dataset.tab;
    document.getElementById(tabId).classList.add('active');
    // Resize charts in new tab + lazy theme re-render
    setTimeout(() => {
      var needsThemeUpdate = (tabThemeVersion[tabId] || 0) < themeVersion;
      document.querySelectorAll('.tab-pane.active [id^="chart-"]').forEach(el => {
        const inst = echarts.getInstanceByDom(el);
        if (inst) inst.resize();
      });
      if (needsThemeUpdate) {
        updateAllChartsTheme();
        tabThemeVersion[tabId] = themeVersion;
      }
    }, 50);
  });
});

// Arrow key navigation for tabs
document.getElementById('mainTabs').addEventListener('keydown', function(e) {
  const tabs = Array.from(this.querySelectorAll('[role="tab"]'));
  const idx = tabs.indexOf(document.activeElement);
  if (idx < 0) return;
  let next = idx;
  if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
  else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = tabs.length - 1;
  else return;
  e.preventDefault();
  tabs[next].click();
  // Restore focus after tab activation (Home/End keys lose focus otherwise)
  requestAnimationFrame(function() { tabs[next].focus(); });
});

// Hash routing
function activateHash() {
  const hash = location.hash.replace('#','');
  if (hash) {
    const link = document.querySelector('[role="tab"][data-tab="tab-' + hash + '"]');
    if (link) link.click();
  }
}
document.querySelectorAll('[role="tab"][data-tab]').forEach(l => {
  l.addEventListener('click', () => { location.hash = l.dataset.tab.replace('tab-',''); });
});
window.addEventListener('hashchange', activateHash);

// === Populate Overview ===
document.getElementById('ov-total').textContent = OVERVIEW.total_scored;
document.getElementById('ov-nonzero').textContent = OVERVIEW.total_nonzero;
document.getElementById('ov-tiera').textContent = OVERVIEW.total_tier_a;
document.getElementById('ov-mean').textContent = OVERVIEW.score_mean;

// === Chart: Tier Distribution (donut) ===
const tierChart = echarts.init(document.getElementById('chart-tier'));
const tierColors = { A: '#3fb950', B: '#58a6ff', C: '#f0883e', D: '#8b949e', zero: '#30363d' };
tierChart.setOption({
  animation: !REDUCE_MOTION,
  aria: { enabled: true, label: { enabled: true, description: 'Donut chart showing sustainability tier distribution across 431 Tapestry statements: Tier A strong engagement, Tier B, Tier C, Tier D keyword mentions, and zero no engagement.' }, decal: { show: true } },
  toolbox: { feature: { saveAsImage: { pixelRatio: 3 } } },
  tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
  series: [{
    type: 'pie', radius: ['40%', '70%'],
    label: { color: '#e6edf3', fontSize: 12 },
    data: Object.entries(OVERVIEW.tier_counts).map(([k,v]) => ({
      name: 'Tier ' + k, value: v, itemStyle: { color: tierColors[k] || '#666' }
    }))
  }]
});

// === Chart: Org Type Bar ===
const orgChart = echarts.init(document.getElementById('chart-orgtype'));
const orgEntries = Object.entries(OVERVIEW.org_type_distribution).sort((a,b) => b[1]-a[1]);
orgChart.setOption({
  animation: !REDUCE_MOTION,
  aria: { enabled: true, label: { enabled: true, description: 'Horizontal bar chart ranking ten organization types by count of statements engaging sustainability, sorted highest to lowest.' }, decal: { show: true } },
  toolbox: { feature: { saveAsImage: { pixelRatio: 3 } } },
  tooltip: { trigger: 'axis' },
  grid: { left: '30%', right: '5%', top: '5%', bottom: '5%' },
  xAxis: { type: 'value', axisLabel: { color: '#8b949e' }, splitLine: { lineStyle: { color: '#21262d' } } },
  yAxis: { type: 'category', data: orgEntries.map(e => e[0]).reverse(), axisLabel: { color: '#e6edf3', fontSize: 11 } },
  series: [{
    type: 'bar',
    data: orgEntries.map(e => ({ value: e[1], itemStyle: { color: ORG_TYPE_COLORS[e[0]] || '#666' } })).reverse(),
    barMaxWidth: 20
  }]
});

// === Chart: Thread Comparison ===
const threadChart = echarts.init(document.getElementById('chart-threads'));
const threadEntries = Object.entries(THREAD_OVERVIEW);
threadChart.setOption({
  animation: !REDUCE_MOTION,
  aria: { enabled: true, label: { enabled: true, description: 'Grouped bar chart comparing six research threads (energy, water, climate, nuclear, cost tracking, policy) by count of statements with nonzero and high engagement.' }, decal: { show: true } },
  toolbox: { feature: { saveAsImage: { pixelRatio: 3 } } },
  tooltip: { trigger: 'axis' },
  legend: { data: ['Non-zero count', 'High (>=50)'], textStyle: { color: '#e6edf3' }, top: 0 },
  grid: { left: '15%', right: '5%', top: '12%', bottom: '10%' },
  xAxis: { type: 'category', data: threadEntries.map(e => e[1].label), axisLabel: { color: '#e6edf3' } },
  yAxis: { type: 'value', axisLabel: { color: '#8b949e' }, splitLine: { lineStyle: { color: '#21262d' } } },
  series: [
    {
      name: 'Non-zero count', type: 'bar', barGap: '10%',
      data: threadEntries.map(e => ({ value: e[1].count_nonzero, itemStyle: { color: e[1].color } }))
    },
    {
      name: 'High (>=50)', type: 'bar',
      data: threadEntries.map(e => ({ value: e[1].count_high, itemStyle: { color: e[1].color, opacity: 0.5 } }))
    }
  ]
});

// === Chart: Co-occurrence ===
const coChart = echarts.init(document.getElementById('chart-cooccur'));
const coLabels = Object.values(THREAD_OVERVIEW).map(t => t.label);
const coData = [];
Object.entries(CO_OCCURRENCE).forEach(([key, val]) => {
  const parts = key.split('|');
  const xi = coLabels.indexOf(parts[0]);
  const yi = coLabels.indexOf(parts[1]);
  if (xi >= 0 && yi >= 0) {
    coData.push([xi, yi, val]);
    if (xi !== yi) coData.push([yi, xi, val]);
  }
});
coChart.setOption({
  animation: !REDUCE_MOTION,
  aria: { enabled: true, label: { enabled: true, description: 'Heatmap of thread co-occurrence patterns among Tier A and B statements, with diagonal cells showing single-thread counts and off-diagonal cells showing paired counts.' }, decal: { show: true } },
  toolbox: { feature: { saveAsImage: { pixelRatio: 3 } } },
  tooltip: { formatter: p => p.data ? coLabels[p.data[0]] + ' × ' + coLabels[p.data[1]] + ': ' + p.data[2] : '' },
  grid: { left: '18%', right: '12%', top: '5%', bottom: '15%' },
  xAxis: { type: 'category', data: coLabels, axisLabel: { color: '#e6edf3', rotate: 30 } },
  yAxis: { type: 'category', data: coLabels, axisLabel: { color: '#e6edf3' } },
  visualMap: { min: 0, max: Math.max(...coData.map(d => d[2])), inRange: { color: ['#161b22', '#3fb950'] }, textStyle: { color: '#8b949e' }, right: 0 },
  series: [{
    type: 'heatmap', data: coData,
    label: { show: true, color: '#e6edf3', fontSize: 11 },
    itemStyle: { borderColor: '#0d1117', borderWidth: 2 }
  }]
});

// === Chart: Org × Thread Heatmap ===
const hmChart = echarts.init(document.getElementById('chart-heatmap'));
hmChart.setOption({
  animation: !REDUCE_MOTION,
  aria: { enabled: true, label: { enabled: true, description: 'Heatmap of mean thread engagement scores by organization type, with darker cells indicating higher mean scores.' }, decal: { show: true } },
  toolbox: { feature: { saveAsImage: { pixelRatio: 3 } } },
  tooltip: { formatter: p => p.data ? HEATMAP.x_labels[p.data[0]] + ' × ' + HEATMAP.y_labels[p.data[1]] + ': ' + p.data[2] : '' },
  grid: { left: '22%', right: '12%', top: '5%', bottom: '12%' },
  xAxis: { type: 'category', data: HEATMAP.x_labels, axisLabel: { color: '#e6edf3' } },
  yAxis: { type: 'category', data: HEATMAP.y_labels, axisLabel: { color: '#e6edf3', fontSize: 11 } },
  visualMap: { min: 0, max: Math.max(...HEATMAP.data.map(d => d[2])), inRange: { color: ['#161b22', '#58a6ff'] }, textStyle: { color: '#8b949e' }, right: 0 },
  series: [{
    type: 'heatmap', data: HEATMAP.data,
    label: { show: true, color: '#e6edf3', fontSize: 10 },
    itemStyle: { borderColor: '#0d1117', borderWidth: 2 }
  }]
});

// === Table: Top Statements ===
const topTbody = document.querySelector('#table-top tbody');
TOP_STATEMENTS.forEach((r, i) => {
  const threadBadges = Object.entries(r.threads).map(([t,s]) =>
    '<span class="thread-badge" style="background:rgba(88,166,255,0.15);color:var(--accent)">' + escapeHtml(t) + '=' + s + '</span>'
  ).join(' ');
  const tierClass = 'badge-tier-' + r.tier;
  topTbody.insertAdjacentHTML('beforeend', '<tr>' +
    '<td>' + (i+1) + '</td>' +
    '<td style="font-family:JetBrains Mono;font-size:0.75rem">' + escapeHtml(r.key) + '</td>' +
    '<td>' + escapeHtml(r.org) + '</td>' +
    '<td>' + r.year + '</td>' +
    '<td style="font-weight:700">' + r.overall + '</td>' +
    '<td><span class="badge ' + tierClass + '">' + escapeHtml(r.tier) + '</span></td>' +
    '<td>' + threadBadges + '</td>' +
    '<td>' + (r.greenwash > 0 ? r.greenwash : '-') + '</td>' +
    '</tr>');
});

// === Chart: Timeline ===
const tlChart = echarts.init(document.getElementById('chart-timeline'));
const tlYears = Object.keys(YEAR_TIMELINE).map(Number).sort();
tlChart.setOption({
  animation: !REDUCE_MOTION,
  aria: { enabled: true, label: { enabled: true, description: 'Timeline chart showing counts of sustainability-relevant statements per publication year, with tier-A counts overlaid as a line series.' }, decal: { show: true } },
  toolbox: { feature: { saveAsImage: { pixelRatio: 3 } } },
  tooltip: { trigger: 'axis' },
  legend: { data: ['Count', 'Tier A'], textStyle: { color: '#e6edf3' }, top: 0 },
  grid: { left: '10%', right: '10%', top: '12%', bottom: '10%' },
  xAxis: { type: 'category', data: tlYears, axisLabel: { color: '#e6edf3' } },
  yAxis: [
    { type: 'value', name: 'Count', axisLabel: { color: '#8b949e' }, splitLine: { lineStyle: { color: '#21262d' } } },
    { type: 'value', name: 'Tier A', axisLabel: { color: '#8b949e' }, splitLine: { show: false } }
  ],
  series: [
    {
      name: 'Count', type: 'bar', yAxisIndex: 0,
      data: tlYears.map(y => ({ value: YEAR_TIMELINE[y].count, itemStyle: { color: '#58a6ff' } })),
      barMaxWidth: 30
    },
    {
      name: 'Tier A', type: 'line', yAxisIndex: 1,
      data: tlYears.map(y => YEAR_TIMELINE[y].tier_a),
      lineStyle: { color: '#3fb950', width: 2 },
      itemStyle: { color: '#3fb950' }
    }
  ]
});

// === Chart: Greenwash by org type ===
const gwChart = echarts.init(document.getElementById('chart-greenwash'));
const gwEntries = Object.entries(GREENWASH.type_means).sort((a,b) => b[1]-a[1]);
// WCAG 1.4.1: split into 3 series by risk tier so color is not the sole distinguishing channel.
// stack: 'gw' collapses the 3 sparse series into a single bar per category (each org belongs to exactly one tier).
const gwHigh = gwEntries.filter(e => e[1] >= 20).map(e => ({ name: e[0], value: e[1] }));
const gwMed = gwEntries.filter(e => e[1] >= 10 && e[1] < 20).map(e => ({ name: e[0], value: e[1] }));
const gwLow = gwEntries.filter(e => e[1] < 10).map(e => ({ name: e[0], value: e[1] }));
gwChart.setOption({
  animation: !REDUCE_MOTION,
  aria: { enabled: true, label: { enabled: true, description: 'Horizontal bar chart ranking organization types by mean greenwash risk score, split into three series (high risk, medium risk, low risk) distinguished by color and decal pattern.' }, decal: { show: true } },
  toolbox: { feature: { saveAsImage: { pixelRatio: 3 } } },
  tooltip: { trigger: 'item', formatter: '{a}: {c} (org type: {b})' },
  legend: { data: ['High risk (>=20)', 'Medium risk (10-19)', 'Low risk (<10)'], textStyle: { color: '#e6edf3' }, top: 0 },
  grid: { left: '30%', right: '5%', top: '15%', bottom: '5%' },
  xAxis: { type: 'value', name: 'Mean GW Risk', axisLabel: { color: '#8b949e' }, splitLine: { lineStyle: { color: '#21262d' } } },
  yAxis: { type: 'category', data: gwEntries.map(e => e[0]).reverse(), axisLabel: { color: '#e6edf3', fontSize: 11 } },
  series: [
    { name: 'High risk (>=20)', type: 'bar', stack: 'gw', data: gwHigh, itemStyle: { color: '#f85149' }, barMaxWidth: 20 },
    { name: 'Medium risk (10-19)', type: 'bar', stack: 'gw', data: gwMed, itemStyle: { color: '#f0883e' }, barMaxWidth: 20 },
    { name: 'Low risk (<10)', type: 'bar', stack: 'gw', data: gwLow, itemStyle: { color: '#3fb950' }, barMaxWidth: 20 }
  ]
});

// Greenwash table
const gwTbody = document.querySelector('#table-greenwash tbody');
GREENWASH.top_flagged.forEach(r => {
  gwTbody.insertAdjacentHTML('beforeend', '<tr>' +
    '<td style="font-family:JetBrains Mono;font-size:0.75rem">' + escapeHtml(r.key) + '</td>' +
    '<td>' + escapeHtml(r.org) + '</td>' +
    '<td>' + escapeHtml(r.org_type) + '</td>' +
    '<td style="color:var(--danger);font-weight:700">' + r.greenwash_risk + '</td>' +
    '<td>' + r.actionability + '</td>' +
    '<td>' + r.overall + '</td>' +
    '</tr>');
});

// === Chart: Extra Dimensions ===
const extraChart = echarts.init(document.getElementById('chart-extra'));
const exEntries = Object.entries(EXTRA_DIMENSIONS);
extraChart.setOption({
  animation: !REDUCE_MOTION,
  aria: { enabled: true, label: { enabled: true, description: 'Horizontal bar chart showing counts of statements engaging five underrepresented dimensions: environmental justice, religious ethics, gendered labor, disability, and informal economy.' }, decal: { show: true } },
  toolbox: { feature: { saveAsImage: { pixelRatio: 3 } } },
  tooltip: { trigger: 'axis' },
  grid: { left: '25%', right: '5%', top: '5%', bottom: '5%' },
  xAxis: { type: 'value', axisLabel: { color: '#8b949e' }, splitLine: { lineStyle: { color: '#21262d' } } },
  yAxis: { type: 'category', data: exEntries.map(e => e[1].label).reverse(), axisLabel: { color: '#e6edf3' } },
  series: [{
    type: 'bar',
    data: exEntries.map(e => ({
      value: e[1].count,
      itemStyle: { color: e[1].count < 20 ? '#f85149' : '#58a6ff' }
    })).reverse(),
    barMaxWidth: 25,
    label: { show: true, position: 'right', color: '#e6edf3', fontSize: 11 }
  }]
});

// Dynamic critical gap annotation (replaces hardcoded S3 counts)
const gapEl = document.getElementById('critical-gap-text');
if (gapEl) {
  const gl = EXTRA_DIMENSIONS.sust_gendered_labor ? EXTRA_DIMENSIONS.sust_gendered_labor.count : 0;
  const di = EXTRA_DIMENSIONS.sust_disability ? EXTRA_DIMENSIONS.sust_disability.count : 0;
  const ie = EXTRA_DIMENSIONS.sust_informal_economy ? EXTRA_DIMENSIONS.sust_informal_economy.count : 0;
  const ej = EXTRA_DIMENSIONS.sust_justice ? EXTRA_DIMENSIONS.sust_justice.count : 0;
  gapEl.textContent = 'Gendered labor (' + gl + ' statements), disability (' + di +
    '), and informal economy (' + ie + ') are almost entirely absent from AI governance sustainability discourse. ' +
    'Environmental justice fares better (' + ej + ' statements) but remains concentrated in civil society organizations.';
}

// Extra dimension detail cards (collapsible)
const extraCards = document.getElementById('extra-dim-cards');
exEntries.forEach(([field, dim]) => {
  if (dim.top.length === 0) return;
  let rows = dim.top.map(r =>
    '<tr><td style="font-family:JetBrains Mono;font-size:0.72rem">' + escapeHtml(r.key) + '</td><td>' + escapeHtml(r.org) + '</td><td>' + r.score + '</td></tr>'
  ).join('');
  extraCards.insertAdjacentHTML('beforeend', '<div class="col-md-6"><details>' +
    '<summary>' + escapeHtml(dim.label) + ' — Top 10 (' + dim.count + ' statements)</summary>' +
    '<div class="detail-body" style="max-height:250px;overflow-y:auto">' +
    '<table class="data-table"><caption class="visually-hidden">Top statements engaging the ' + escapeHtml(dim.label) + ' dimension</caption><thead><tr><th>Key</th><th>Org</th><th>Score</th></tr></thead><tbody>' +
    rows + '</tbody></table></div></details></div>');
});

// === Literature Context (Background Sources) ===
if (typeof BACKGROUND_SOURCES !== 'undefined') {
  const litContainer = document.getElementById('literature-context-container');
  if (litContainer) {
    const underrepDims = ['sust_gendered_labor', 'sust_disability', 'sust_informal_economy', 'sust_justice', 'sust_ethics_religious'];
    const dimLabels = {
      'sust_gendered_labor': 'Gendered Labor',
      'sust_disability': 'Disability',
      'sust_informal_economy': 'Informal Economy',
      'sust_justice': 'Environmental Justice',
      'sust_ethics_religious': 'Ethics / Religious'
    };

    const card = document.createElement('details');
    card.className = 'mt-3';
    card.id = 'extra-lit';

    const header = document.createElement('summary');
    header.textContent = 'Literature Context — External Sources';
    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'detail-body';

    const methodNote = document.createElement('div');
    methodNote.className = 'annotation';
    methodNote.style.marginTop = '0';
    methodNote.style.marginBottom = '1rem';
    const noteStrong = document.createElement('strong');
    noteStrong.textContent = 'Methodological note: ';
    methodNote.appendChild(noteStrong);
    methodNote.appendChild(document.createTextNode(
      'These external academic and policy sources contextualize the corpus gaps identified above. ' +
      'They are NOT scored through the LLM pipeline — they represent what the literature says governance statements are missing. ' +
      'The contrast between corpus coverage and external evidence IS the analytical finding.'
    ));
    body.appendChild(methodNote);

    underrepDims.forEach(dim => {
      const sources = BACKGROUND_SOURCES[dim];
      if (!sources || sources.length === 0) return;

      const heading = document.createElement('h6');
      heading.style.color = 'var(--accent3)';
      heading.style.marginTop = '1rem';
      heading.textContent = (dimLabels[dim] || dim) + ' (' + sources.length + ' sources)';
      body.appendChild(heading);

      sources.forEach(src => {
        const ctx = document.createElement('div');
        ctx.className = 'literature-context';

        const badge = document.createElement('span');
        badge.className = 'ext-badge';
        badge.textContent = 'External Source';
        ctx.appendChild(badge);

        const authorSpan = document.createElement('strong');
        authorSpan.textContent = src.authors + ' (' + src.year + ')';
        ctx.appendChild(authorSpan);

        if (src.tier === '1' || src.tier === 1) {
          const tierBadge = document.createElement('span');
          tierBadge.style.cssText = 'background:#3fb950;color:#000;font-size:0.6rem;padding:0.1rem 0.3rem;border-radius:2px;margin-left:0.3rem;';
          tierBadge.textContent = 'TIER 1';
          ctx.appendChild(tierBadge);
        }

        ctx.appendChild(document.createElement('br'));

        const titleEm = document.createElement('em');
        titleEm.textContent = '“' + src.title + '”';
        ctx.appendChild(titleEm);

        ctx.appendChild(document.createElement('br'));

        const finding = document.createElement('span');
        finding.style.color = 'var(--text-secondary)';
        finding.textContent = src.key_finding;
        ctx.appendChild(finding);

        body.appendChild(ctx);
      });
    });

    card.appendChild(body);
    litContainer.appendChild(card);
  }
}

// === Geographic Coverage Section ===
if (typeof GEOGRAPHIC_COVERAGE !== 'undefined') {
  const geoCards = document.getElementById('geo-region-cards');
  const regionColors = { 'CEE': 'var(--region-cee)', 'SE_Asia': 'var(--region-sea)', 'MENA': 'var(--region-mena)' };
  const regionLabels = { 'CEE': 'Central & Eastern Europe', 'SE_Asia': 'Southeast Asia', 'MENA': 'Middle East & North Africa' };

  Object.entries(GEOGRAPHIC_COVERAGE).forEach(([key, region]) => {
    const pct = region.coverage_pct;
    const color = regionColors[key] || '#8b949e';
    let noteHtml = '';
    if (region.singapore_note) noteHtml = '<div style="font-size:0.7rem;color:var(--text-secondary);margin-top:0.3rem;">' + escapeHtml(region.singapore_note) + '</div>';
    if (region.classification_note) noteHtml = '<div style="font-size:0.7rem;color:var(--text-secondary);margin-top:0.3rem;">' + escapeHtml(region.classification_note) + '</div>';

    // Reality facts
    const r = region.reality || {};
    let factsHtml = '';
    if (r.facts) {
      factsHtml = '<ul class="geo-fact-list">' + r.facts.map(f => '<li>' + escapeHtml(f) + '</li>').join('') + '</ul>';
      if (r.source_refs) factsHtml += '<div class="geo-source-ref">Sources: ' + r.source_refs.map(escapeHtml).join(', ') + '</div>';
    }

    // Top countries
    const countries = region.countries || {};
    const topCountries = Object.entries(countries).slice(0, 5);
    let countryHtml = '<div style="font-size:0.75rem;margin-top:0.5rem;color:var(--text-secondary)"><strong>Top countries:</strong> ' +
      topCountries.map(([c, n]) => escapeHtml(c) + ' (' + n + ')').join(', ') + '</div>';

    geoCards.insertAdjacentHTML('beforeend', '<div class="col-md-4"><div class="geo-card">' +
      '<div class="geo-headline">' + escapeHtml(regionLabels[key] || key) + '</div>' +
      '<div class="geo-stat">' + pct + '%</div>' +
      '<div class="geo-stat-label">of ' + region.total_statements + ' statements address sustainability (' + region.scored_nonzero + ' nonzero)</div>' +
      noteHtml +
      '<div style="margin-top:0.6rem;border-top:1px solid var(--border);padding-top:0.5rem;">' +
      '<div style="font-size:0.78rem;font-weight:600;color:' + color + '">Reality: ' + escapeHtml(r.headline || '') + '</div>' +
      factsHtml +
      '</div>' +
      countryHtml +
      '</div></div>');
  });

  // Gap visualization chart
  const geoGapChart = echarts.init(document.getElementById('chart-geo-gap'));
  const geoKeys = Object.keys(GEOGRAPHIC_COVERAGE);
  const geoData = geoKeys.map(k => {
    const reg = GEOGRAPHIC_COVERAGE[k];
    return {
      name: (regionLabels[k] || k),
      governance: reg.coverage_pct,
      total: reg.total_statements,
      scored: reg.scored_nonzero
    };
  });

  geoGapChart.setOption({
  animation: !REDUCE_MOTION,
    aria: { enabled: true, label: { enabled: true, description: 'Horizontal bar chart of geographic coverage gaps by region, highlighting underrepresented global regions.' }, decal: { show: true } },
    toolbox: { feature: { saveAsImage: { pixelRatio: 3 } } },
    tooltip: {
      trigger: 'axis',
      formatter: function(params) {
        const d = geoData[params[0].dataIndex];
        return d.name + '<br/>Governance coverage: ' + d.governance + '%<br/>' +
          d.scored + ' of ' + d.total + ' statements address sustainability';
      }
    },
    grid: { left: '30%', right: '10%', top: '8%', bottom: '12%' },
    xAxis: {
      type: 'value',
      max: 100,
      name: 'Coverage %',
      nameTextStyle: { color: '#8b949e', fontSize: 10 },
      axisLabel: { color: '#8b949e', formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#21262d' } }
    },
    yAxis: {
      type: 'category',
      data: geoData.map(d => d.name),
      axisLabel: { color: '#e6edf3', fontSize: 12 }
    },
    series: [{
      type: 'bar',
      data: geoData.map((d, i) => ({
        value: d.governance,
        itemStyle: { color: Object.values(regionColors)[i] || '#58a6ff' }
      })),
      barMaxWidth: 30,
      label: {
        show: true,
        position: 'right',
        color: '#e6edf3',
        fontSize: 11,
        formatter: '{c}%'
      },
      markLine: {
        silent: true,
        symbol: 'none',
        lineStyle: { color: '#f85149', type: 'dashed', width: 1 },
        data: [{ xAxis: 50, label: { show: true, formatter: 'Adequate', color: '#f85149', fontSize: 10 } }]
      }
    }]
  });
}

// === Chart: Framing Orientation by Org Type (Diverging Stacked Bar) ===
if (typeof FRAMING_ANALYSIS !== 'undefined' && FRAMING_ANALYSIS.by_org_type) {
  const framingEl = document.getElementById('chart-framing-org');
  if (framingEl) {
    const framingChart = echarts.init(framingEl);
    const byOT = FRAMING_ANALYSIS.by_org_type;
    const orgKeys = Object.keys(byOT).sort((a,b) => {
      const totalA = (byOT[a].problem||0) + (byOT[a].solution||0) + (byOT[a].both||0);
      const totalB = (byOT[b].problem||0) + (byOT[b].solution||0) + (byOT[b].both||0);
      return totalA - totalB;
    });
    framingChart.setOption({
  animation: !REDUCE_MOTION,
      aria: { enabled: true, label: { enabled: true, description: 'Diverging bar chart of framing orientation by organization type, showing AI-as-problem statements on the left in red, AI-as-solution on the right in green, and both-framing centered in blue.' }, decal: { show: true } },
      toolbox: { feature: { saveAsImage: { pixelRatio: 3 } } },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: function(params) {
          let tip = params[0].name + '<br/>';
          params.forEach(p => { tip += p.marker + ' ' + p.seriesName + ': ' + Math.abs(p.value) + '<br/>'; });
          const ot = byOT[params[0].name] || {};
          tip += 'Neutral: ' + (ot.neutral || 0);
          return tip;
        }
      },
      legend: { data: ['Problem', 'Both', 'Solution'], textStyle: { color: '#e6edf3' }, top: 0 },
      grid: { left: '25%', right: '8%', top: '12%', bottom: '8%' },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#8b949e', formatter: function(v) { return Math.abs(v); } },
        splitLine: { lineStyle: { color: '#21262d' } }
      },
      yAxis: { type: 'category', data: orgKeys, axisLabel: { color: '#e6edf3', fontSize: 11 } },
      series: [
        {
          name: 'Problem', type: 'bar', stack: 'framing',
          data: orgKeys.map(k => -(byOT[k].problem || 0)),
          itemStyle: { color: '#f85149' },
          label: { show: true, position: 'left', color: '#e6edf3', fontSize: 10, formatter: function(p) { return Math.abs(p.value) > 0 ? Math.abs(p.value) : ''; } }
        },
        {
          name: 'Both', type: 'bar', stack: 'framing',
          data: orgKeys.map(k => (byOT[k].both || 0)),
          itemStyle: { color: '#58a6ff' },
          label: { show: true, position: 'inside', color: '#e6edf3', fontSize: 10, formatter: function(p) { return p.value > 0 ? p.value : ''; } }
        },
        {
          name: 'Solution', type: 'bar', stack: 'framing',
          data: orgKeys.map(k => (byOT[k].solution || 0)),
          itemStyle: { color: '#3fb950' },
          label: { show: true, position: 'right', color: '#e6edf3', fontSize: 10, formatter: function(p) { return p.value > 0 ? p.value : ''; } }
        }
      ]
    });
  }
}

// === Collapsible <details> in Tab 7 ===
// Convert extra dimension cards and literature context to collapsibles via JS
(function() {
  // Wrap geo fact lists in <details>
  document.querySelectorAll('.geo-fact-list').forEach(ul => {
    const parent = ul.parentElement;
    if (!parent) return;
    const det = document.createElement('details');
    const sum = document.createElement('summary');
    sum.textContent = 'Reality facts';
    sum.style.fontSize = '0.78rem';
    det.appendChild(sum);
    const body = document.createElement('div');
    body.className = 'detail-body';
    // Move the ul and any source ref into the body
    const siblings = [];
    let el = ul;
    while (el) {
      siblings.push(el);
      const next = el.nextElementSibling;
      if (next && next.classList.contains('geo-source-ref')) { siblings.push(next); el = next; }
      else break;
      el = el.nextElementSibling;
    }
    siblings.forEach(s => body.appendChild(s));
    det.appendChild(body);
    parent.appendChild(det);
  });
})();

// Resize charts when <details> toggles open
document.addEventListener('toggle', function(e) {
  if (e.target.tagName === 'DETAILS' && e.target.open) {
    setTimeout(function() {
      e.target.querySelectorAll('[id^="chart-"]').forEach(function(el) {
        var inst = echarts.getInstanceByDom(el);
        if (inst) inst.resize();
      });
    }, 50);
  }
}, true);

// === Mobile responsive chart overrides (WCAG + narrow viewport) ===
const gwMobileMQ = window.matchMedia('(max-width: 576px)');
function applyMobileChartOverrides(isMobile) {
  var tc = getThemeColors();
  // orgChart: org-type y-axis label clipping at narrow viewport
  if (typeof orgChart !== 'undefined' && orgChart && !orgChart.isDisposed()) {
    orgChart.setOption({
      grid: { left: isMobile ? '45%' : '30%', right: '5%', top: '5%', bottom: '5%' },
      yAxis: { axisLabel: { color: tc.textPrimary, fontSize: isMobile ? 10 : 11, width: isMobile ? 100 : null, overflow: isMobile ? 'truncate' : 'none', ellipsis: '...' } }
    });
  }
  // tierChart: donut label overlap at narrow viewport
  if (typeof tierChart !== 'undefined' && tierChart && !tierChart.isDisposed()) {
    tierChart.setOption({
      series: [{
        type: 'pie', radius: ['40%', '70%'],
        label: { color: tc.textPrimary, fontSize: isMobile ? 10 : 12, position: isMobile ? 'outside' : 'inside' },
        labelLine: { show: isMobile, length: 5, length2: 5 }
      }]
    });
  }
}
applyMobileChartOverrides(gwMobileMQ.matches);
if (gwMobileMQ.addEventListener) {
  gwMobileMQ.addEventListener('change', function(e) {
    applyMobileChartOverrides(e.matches);
    // Invalidate active tab's theme version so next tab-switch re-renders
    var activeTab = document.querySelector('.tab-pane.active');
    if (activeTab) delete tabThemeVersion[activeTab.id];
  });
} else if (gwMobileMQ.addListener) {
  gwMobileMQ.addListener(function(e) {
    applyMobileChartOverrides(e.matches);
    var activeTab = document.querySelector('.tab-pane.active');
    if (activeTab) delete tabThemeVersion[activeTab.id];
  });
}

// Resize handler
window.addEventListener('resize', () => {
  document.querySelectorAll('[id^="chart-"]').forEach(el => {
    const inst = echarts.getInstanceByDom(el);
    if (inst) inst.resize();
  });
});

// Activate hash on load
activateHash();

// Apply theme to charts if loaded with light theme from localStorage
if (!isDark()) updateAllChartsTheme();

// Print preparation: open all <details> and show all tabs
window.addEventListener('beforeprint', function() {
  document.querySelectorAll('details:not([open])').forEach(function(d) {
    d.setAttribute('open', '');
    d.setAttribute('data-was-closed', '');
  });
  // Force all tab panes visible (CSS handles this, but ensure charts resize)
  setTimeout(function() {
    document.querySelectorAll('[id^="chart-"]').forEach(function(el) {
      var inst = echarts.getInstanceByDom(el);
      if (inst) inst.resize();
    });
  }, 100);
});
window.addEventListener('afterprint', function() {
  document.querySelectorAll('details[data-was-closed]').forEach(function(d) {
    d.removeAttribute('open');
    d.removeAttribute('data-was-closed');
  });
});
