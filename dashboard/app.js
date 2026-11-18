// Token Radar's dashboard (radar-3). It reads window.RADAR (written beside dashboard/
// by main.ts) and renders the ranked board, a top-ten strip, implied value by category,
// a filterable table, a per-protocol detail view with the model's own inputs, the traded
// protocols it was priced against, and the protocol's farm plan, and the live-token view
// set aside. No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', watchlist: false, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };
  var WATCH = {};
  DATA.rows.forEach(function (r) { if (r.watchlist) WATCH[r.slug] = true; });

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) { return (Math.round(n * 1000) / 1000).toFixed(3); }

  // The model in one function: the page recomputes a row from the snapshot figures and
  // checks the number board.json carries, so the page and the board are visibly the same
  // arithmetic. Multiples are stored at full precision, so the recompute is exact.
  function impliedOf(row) {
    return Math.max(1, Math.round(row.tvl_usd * row.category_multiple * row.growth_multiplier * row.maturity_multiplier * row.breadth_multiplier));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('wl') === '1') state.watchlist = true;
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('p')) state.selected = params.get('p');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.watchlist) params.set('wl', '1');
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.watchlist && !WATCH[r.slug]) return false;
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'category') { av = (a.category || 'Other').toLowerCase(); bv = (b.category || 'Other').toLowerCase(); }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    var matched = DATA.rows.filter(function (r) { return r.comp_level === 'size-matched'; }).length;
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', null,
          'The watchlist is the floor: every protocol with at least ',
          el('b', { text: '$' + Math.round(DATA.floor_usd / 1e6) + 'M' }),
          ' of TVL and no token on record. The early radar adds ',
          el('b', { text: String(DATA.early_size) }),
          ' further standalone pre-token protocols below that floor. Every row is priced from the traded protocols that resemble it — open a row to see its comparables. Implied value is a model, not a promise.'
        )
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Total implied value' }), el('b', { text: fmtUsd(DATA.total_implied_usd) })),
        el('div', { class: 'fact' }, el('span', { text: 'Market multiple' }), el('b', { text: fmtMult(DATA.market_multiple) + 'x' })),
        el('div', { class: 'fact' }, el('span', { text: 'Rows priced from size-matched comps' }), el('b', { text: matched + ' of ' + DATA.board_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Top row' }), el('b', null, DATA.rows[0] ? DATA.rows[0].name : 'n/a', el('small', { text: DATA.rows[0] ? ' ' + fmtUsd(DATA.rows[0].implied_value_usd) : '' })))
      )
    );
  }

  function topTen() {
    var top = DATA.rows.slice(0, 10);
    return el('section', { class: 'panel' },
      el('h2', { text: 'Top 10 by implied value' }),
      el('p', { class: 'sub', text: 'Select a row for its comparables and farm plan.' }),
      el('ol', { class: 'toplist' }, top.map(function (r) {
        return el('li', { tabindex: '0', onclick: function () { openDetail(r.slug); }, onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } } },
          el('span', { class: 'trk', text: String(r.rank) }),
          el('span', { class: 'tname', text: r.name },
            el('small', { text: (r.category || 'Other') + ' · TVL ' + fmtUsd(r.tvl_usd) })),
          el('span', { class: 'tval' }, el('b', { text: fmtUsd(r.implied_value_usd) }), el('span', { text: fmtMult(r.category_multiple) + 'x' }))
        );
      }))
    );
  }

  function catBreakdown() {
    var totals = {};
    DATA.rows.forEach(function (r) {
      var k = r.category || 'Other';
      totals[k] = (totals[k] || 0) + r.implied_value_usd;
    });
    var cats = Object.keys(totals).map(function (k) { return { category: k, total: totals[k] }; })
      .sort(function (a, b) { return b.total - a.total; }).slice(0, 8);
    var max = cats.length ? cats[0].total : 1;
    return el('section', { class: 'panel' },
      el('h2', { text: 'Implied value by category' }),
      el('p', { class: 'sub', text: 'Where the board\u2019s value sits, top 8 categories.' }),
      cats.map(function (c) {
        return el('div', { class: 'catbar' },
          el('span', { class: 'cname', text: c.category }),
          el('div', { class: 'track', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((c.total / max) * 100)) + '%' })),
          el('span', { class: 'cval', text: fmtUsd(c.total) })
        );
      })
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var catSelect = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c + ' (' + DATA.rows.filter(function (r) { return (r.category || 'Other') === c; }).length + ')', selected: c === state.category ? 'selected' : null }); })
    );
    catSelect.addEventListener('change', function () { state.category = catSelect.value; writeHash(); render(); });
    var chainSelect = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; writeHash(); render(); });
    var wl = el('input', { type: 'checkbox', id: 'wl', checked: state.watchlist ? 'checked' : null });
    wl.addEventListener('change', function () { state.watchlist = wl.checked; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSelect),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
      el('label', { class: 'check', for: 'wl' }, wl, 'Watchlist only'),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' of ' + DATA.board_size + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function lvlBadge(r) {
    var label = r.comp_level === 'size-matched' ? 'size-matched' : r.comp_level === 'category' ? 'category' : 'market';
    return el('span', { class: 'badge lvl' + (r.comp_level === 'size-matched' ? ' matched' : ''), text: label });
  }

  function rowCells(r, maxImplied) {
    var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
    var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
    return [
      el('td', { class: 'num', text: String(r.rank) }),
      el('td', null, el('div', { class: 'name' },
        el('b', null, r.name, WATCH[r.slug] ? el('span', { class: 'badge watch', text: 'watchlist' }) : null),
        el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '') : 'an unnamed chain') })
      )),
      el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
      el('td', { class: 'num ' + growthClass, text: growth }),
      el('td', { class: 'num', text: fmtAge(r.age_days) }),
      el('td', null, el('div', { class: 'implied' },
        el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / maxImplied) * 100)) + '%' })),
        el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
      )),
      el('td', null, lvlBadge(r)),
      el('td', null, el('span', { class: 'badge pre', text: 'no token' }))
    ];
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchlist = false; writeHash(); render(); } })
      ));
    }
    var max = DATA.rows[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      });
      rowCells(r, max).forEach(function (c) { tr.appendChild(c); });
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Pre-token protocols, strongest implied value first. Select a row for its model, its comparables and its farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Priced from' }),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'badge live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var multRows = DATA.multiples.map(function (x) {
      return el('tr', null,
        el('td', { text: x.category }),
        el('td', { class: 'num', text: fmtMult(x.multiple) + 'x' }),
        el('td', { class: 'num', text: x.comps > 0 ? String(x.comps) : 'market median' }),
        el('td', { class: 'num', text: String(x.rows_band) })
      );
    });
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked. The multiple is a precision-weighted blend of three anchors: the median market-cap-to-TVL ratio of the traded protocols in the same category whose TVL sits within 0.25x–4x of the target\u2019s (three or more, else empty), the median of all traded protocols in the category (two or more, else empty), and the whole market\u2019s median of ' + fmtMult(DATA.market_multiple) + 'x, which always counts with a prior weight of five. Each anchor is clamped to 0.05x–1.0x before blending, and each ratio is winsorized to 0.01x–5x first, so one wild print cannot set a multiple.' }),
      el('div', { class: 'formula' },
        'multiple = (5 x market + n_band x band_median + n_cat x category_median) / (5 + n_band + n_cat)\n' +
        'implied = round( tvl_usd x multiple x (1 + 0.3 x sign(change_7d) x sqrt(|clamp(change_7d, -50, 150)| / 100)) x (0.65 + min(age_days, 1095) / 1095 x 0.35) x (1 + 0.02 x min(chains - 1, 5)) )'
      ),
      el('p', { text: 'A weekly move is noisy, so the model takes its square root: a 100% week counts about as much as a 30% move counted straight. Age is the time since the protocol was first listed; an unlisted age uses 365 days. A category with one traded protocol cannot price from itself — its rows fall back to the market anchor, and the row says so.' }),
      el('table', { class: 'mult-table' },
        el('thead', null, el('tr', null, el('th', { text: 'Category' }), el('th', { class: 'num', text: 'Reference multiple' }), el('th', { class: 'num', text: 'Traded comps' }), el('th', { class: 'num', text: 'Rows priced from band' }))),
        el('tbody', null, multRows)
      ),
      el('p', { class: 'note', text: 'TVL and seven-day growth come from the snapshot. TVL is the only scale the snapshot carries: where a category earns off TVL rather than on it, the multiple is a rough anchor, which is why thin categories are pulled toward the market median instead of priced from one or two prints. A protocol that records no token may still have one its record does not carry: implied value is the entry\u2019s own claim, never a promise.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function compNote(row) {
    if (row.comp_level === 'size-matched') {
      return 'Priced from ' + row.band_comps + ' traded protocols in ' + (row.category || 'Other') + ' with TVL within 0.25x–4x of this row, blended with the category and market anchors.';
    }
    if (row.comp_level === 'category') {
      return 'Too few size-matched comps in ' + (row.category || 'Other') + ' — priced from the category median of ' + row.category_comps + ' traded protocols, blended with the market anchor.';
    }
    return (row.category || 'Other') + ' has too few traded protocols to price from, so this row is anchored on the whole market\u2019s median multiple.';
  }

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var recomputed = impliedOf(row);
    var matches = recomputed === row.implied_value_usd;
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'rankline', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (WATCH[row.slug] ? ' · Watchlist' : ' · Early radar') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') + ' · listed ' + (row.listed_at || 'on an unknown day') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Blended multiple' }), el('b', { class: 'num', text: fmtMult(row.category_multiple) + 'x' })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: fmtMult(row.growth_multiplier) + 'x' })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: fmtMult(row.maturity_multiplier) + 'x' })),
        el('div', null, el('span', { text: 'Chains' }), el('b', { class: 'num', text: String(row.chains.length || 1) })),
        el('div', null, el('span', { text: 'Breadth multiplier' }), el('b', { class: 'num', text: fmtMult(row.breadth_multiplier) + 'x' })),
        el('div', { class: 'total' }, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'checkline' },
        'Model ' + DATA.model_version + ': ' + compNote(row) + ' The page recomputes this row as ' + fmtUsd(recomputed) + ' — ',
        matches ? el('b', { text: 'the same number board.json carries.' }) : el('b', { text: 'which differs from the board: the data would be stale.' }),
        ' This is an estimate, not a price.'
      )
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Comparables it was priced against' }),
      el('table', { class: 'comps' },
        el('thead', null, el('tr', null, el('th', { text: 'Protocol' }), el('th', { class: 'num', text: 'TVL' }), el('th', { class: 'num', text: 'Mcap / TVL' }))),
        el('tbody', null, row.comps.map(function (c) {
          return el('tr', null,
            el('td', { text: c.name }),
            el('td', { class: 'num', text: fmtUsd(c.tvl_usd) }),
            el('td', { class: 'num', text: fmtMult(c.ratio) + 'x' })
          );
        }))
      ),
      el('p', { class: 'checkline', text: 'Nearest by TVL first. These are the traded protocols behind the band and category anchors; the market median behind every row is ' + fmtMult(DATA.market_multiple) + 'x.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, row.farm_steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    if (state.tab === 'pre-token') {
      var duo = el('div', { class: 'duo' });
      duo.appendChild(topTen());
      duo.appendChild(catBreakdown());
      shell.appendChild(duo);
    }
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    shell.appendChild(el('p', { class: 'foot', text: 'Source: ' + DATA.source + '. Implied values are this entry\u2019s model, not a promise of a launch or a price.' }));
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('hashchange', function () {
    state.q = '';
    state.category = 'all';
    state.chain = 'all';
    state.watchlist = false;
    state.selected = null;
    readHash();
    render();
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
