/* ============================================================================
   PRONOS CdM 2026 — APP.JS
   Charge classement.json, rend les 4 vues, gère les onglets et le verrouillage
   des pronos avant la date de révélation.
   ============================================================================ */

'use strict';

const DATA_URL = 'data/classement.json';

/* --------------------------------------------------------------------------
   AUTHENTIFICATION (côté client, simple JS)
   Pour un concours amical : suffisant pour bloquer les curieux non-techniques.
   Quelqu'un de motivé peut voir le mot de passe via les DevTools, mais
   l'Article 9 du règlement interdit ce genre de pratique.
   -------------------------------------------------------------------------- */

const AUTH_PASSWORD = 'diables2026';
const AUTH_STORAGE_KEY = 'pronos_cdm2026_authed';

function isAuthed() {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEY) === 'yes';
  } catch (e) {
    return false;
  }
}

function setupLogin() {
  const overlay = document.getElementById('auth-overlay');
  const form = document.getElementById('auth-form');
  const pwdInput = document.getElementById('auth-password');
  const errorBox = document.getElementById('auth-error');

  overlay.hidden = false;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (pwdInput.value === AUTH_PASSWORD) {
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, 'yes');
      } catch (err) { /* mode privé navigateur : on continue quand même */ }
      overlay.hidden = true;
      init();
    } else {
      errorBox.hidden = false;
      pwdInput.value = '';
      pwdInput.focus();
    }
  });
}

let DATA = null;
let CURRENT_TAB = 'classement';

/* --------------------------------------------------------------------------
   Utilitaires
   -------------------------------------------------------------------------- */

const $  = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateFr(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mn = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}h${mn}`;
}

function tendance(sh, sa) {
  if (sh > sa) return 'H';
  if (sa > sh) return 'A';
  return 'N';
}

/* --------------------------------------------------------------------------
   MASCOTTE — DjDitch splash (page d'accueil, 1x au chargement)

   Comportement :
   - Si déjà authentifié : le splash apparaît centré SOUS le header,
     le loop joue 1x (9s), puis le bloc disparaît en fondu.
   - Si pas encore authentifié : le GIF est visible dans l'overlay de login
     pendant la saisie — il disparaît avec l'overlay quand le mdp est validé.
     Pas de splash supplémentaire dans ce cas.
   -------------------------------------------------------------------------- */

const DJDITCH_LOOP_DURATION_MS = 9000;  // mesuré : 9 secondes
const DJDITCH_TRIP_DURATION_MS = 9000;  // mesuré : 9 secondes

// Flag de session : DjDitch-trip ne se joue qu'une seule fois par session
let tripPlayed = false;

function showSplash() {
  const splash = document.getElementById('djditch-splash');
  if (!splash) return;
  splash.hidden = false;

  setTimeout(() => {
    splash.classList.add('djditch-fadeout');
    splash.addEventListener('animationend', () => {
      splash.hidden = true;
      splash.classList.remove('djditch-fadeout');
    }, { once: true });
  }, DJDITCH_LOOP_DURATION_MS);
}

/* --------------------------------------------------------------------------
   MASCOTTE — DjDitch trip overlay (onglet Tournoi, 1x par session)
   -------------------------------------------------------------------------- */

function playTripOnce() {
  if (tripPlayed) return;
  tripPlayed = true;

  const overlay = document.getElementById('djditch-trip-overlay');
  const img     = document.getElementById('djditch-trip-gif');
  if (!overlay || !img) return;

  img.src = 'img/DjDitch-trip.gif';
  overlay.hidden = false;

  setTimeout(() => {
    overlay.classList.add('djditch-fadeout');
    overlay.addEventListener('animationend', () => {
      overlay.hidden = true;
      overlay.classList.remove('djditch-fadeout');
      img.src = '';
    }, { once: true });
  }, DJDITCH_TRIP_DURATION_MS);
}

/* --------------------------------------------------------------------------
   Bootstrap : charger le JSON puis rendre
   -------------------------------------------------------------------------- */

async function init() {
  try {
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    DATA = await res.json();
  } catch (err) {
    document.body.innerHTML = `
      <div style="padding:40px;text-align:center;font-family:Manrope">
        <h2 style="color:#E30613">Erreur de chargement</h2>
        <p>Impossible de charger les données du concours.</p>
        <p style="color:#6B6B6B;font-size:12px">${escapeHtml(err.message)}</p>
      </div>`;
    return;
  }

  $('#last-update-value').textContent = formatDateFr(DATA.meta.generated_at);
  renderPhaseBanner();
  $$('.tab').forEach(t => t.addEventListener('click', () => setTab(t.dataset.tab)));
  renderClassement();
  renderTournoi();
  renderPronos();
  renderBonus();
}

function renderPhaseBanner() {
  const banner = $('#phase-banner');
  const phase  = DATA.meta.phase;
  const joues  = DATA.meta.nb_matches_joues;
  const total  = DATA.meta.nb_matches_total;

  let label;
  if (phase === 'poules')            label = `Phase de poules — ${joues}/${total} matches joués`;
  else if (phase === 'phase_finale') label = `Phase à élimination directe`;
  else if (phase === 'termine')      label = `Tournoi terminé`;
  else                               label = phase;
  banner.textContent = label;
}

function setTab(name) {
  CURRENT_TAB = name;
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  $$('.vue').forEach(v => v.classList.toggle('active', v.id === `vue-${name}`));
  window.scrollTo({ top: 0, behavior: 'smooth' });

  djditchOnTabChange(name);

  if (name === 'tournoi') {
    playTripOnce();
  }
}

/* --------------------------------------------------------------------------
   VUE CLASSEMENT
   -------------------------------------------------------------------------- */

function renderClassement() {
  const container = $('#classement-container');
  const parts = DATA.concours.participants;

  if (!parts || parts.length === 0) {
    container.innerHTML = `<p style="color:#6B6B6B;text-align:center;padding:32px">
      Aucun participant importé pour l'instant.
    </p>`;
    return;
  }

  const tableHtml = `
    <table class="classement-table">
      <thead>
        <tr>
          <th class="num">Rang</th>
          <th>Participant</th>
          <th class="num">Total</th>
          <th class="num">Poules<br>matches</th>
          <th class="num">Poules<br>classement</th>
          <th class="num">Phase<br>finale</th>
          <th class="num">Bonus</th>
          <th class="num">Pénalité</th>
          <th class="num">Sc.<br>exacts</th>
        </tr>
      </thead>
      <tbody>
        ${parts.map(p => renderRow(p)).join('')}
      </tbody>
    </table>`;

  const cardsHtml = `
    <div class="classement-mobile">
      ${parts.map(p => renderCard(p)).join('')}
    </div>`;

  container.innerHTML = tableHtml + cardsHtml;
}

function renderRow(p) {
  const rangCell = p.rang <= 3
    ? `<span class="rang-medal rang-${p.rang}">${p.rang}</span>`
    : `${p.rang}`;

  return `
    <tr>
      <td class="rang-cell">${rangCell}</td>
      <td class="nom-cell">${escapeHtml(p.nom)}</td>
      <td class="total-cell">${p.total}</td>
      <td class="detail-cell ${p.poules_matches === 0 ? 'zero' : ''}">${p.poules_matches}</td>
      <td class="detail-cell ${p.poules_classement === 0 ? 'zero' : ''}">${p.poules_classement}</td>
      <td class="detail-cell ${p.phase_finale === 0 ? 'zero' : ''}">${p.phase_finale}</td>
      <td class="detail-cell ${p.bonus === 0 ? 'zero' : ''}">${p.bonus}</td>
      <td class="detail-cell ${p.penalite < 0 ? 'penalite' : 'zero'}">${p.penalite}</td>
      <td class="detail-cell ${p.scores_exacts === 0 ? 'zero' : ''}">${p.scores_exacts}</td>
    </tr>`;
}

function renderCard(p) {
  const rangClass = p.rang <= 3 ? `rang-${p.rang}-card` : '';
  return `
    <div class="participant-card ${rangClass}">
      <div class="pc-top">
        <div class="pc-left">
          <div class="pc-rang">${p.rang}</div>
          <div class="pc-nom">${escapeHtml(p.nom)}</div>
        </div>
        <div class="pc-total">${p.total}</div>
      </div>
      <div class="pc-bottom">
        <div class="pc-stat">
          <div class="pc-stat-label">Poules</div>
          <div class="pc-stat-value ${p.poules_matches === 0 ? 'zero' : ''}">${p.poules_matches + p.poules_classement}</div>
        </div>
        <div class="pc-stat">
          <div class="pc-stat-label">Phase finale</div>
          <div class="pc-stat-value ${p.phase_finale === 0 ? 'zero' : ''}">${p.phase_finale}</div>
        </div>
        <div class="pc-stat">
          <div class="pc-stat-label">Bonus</div>
          <div class="pc-stat-value ${p.bonus === 0 ? 'zero' : ''}">${p.bonus}</div>
        </div>
        <div class="pc-stat">
          <div class="pc-stat-label">Pénalité</div>
          <div class="pc-stat-value ${p.penalite < 0 ? 'pen' : 'zero'}">${p.penalite}</div>
        </div>
      </div>
    </div>`;
}

/* --------------------------------------------------------------------------
   VUE TOURNOI
   -------------------------------------------------------------------------- */

function renderTournoi() {
  const groupesContainer = $('#groupes-container');
  const matchesContainer = $('#matches-container');
  const nbJouesSpan      = $('#nb-joues');

  const groupes = DATA.tournoi.groupes;
  const matches = DATA.tournoi.matches;
  const nbJoues = matches.filter(m => m.joue).length;

  nbJouesSpan.textContent = nbJoues;

  groupesContainer.innerHTML = groupes.map(g => renderGroupeCard(g)).join('');

  const matchesParGroupe = {};
  matches.forEach(m => {
    if (!matchesParGroupe[m.groupe]) matchesParGroupe[m.groupe] = [];
    matchesParGroupe[m.groupe].push(m);
  });

  matchesContainer.innerHTML = Object.keys(matchesParGroupe).sort().map(g => {
    const bloc = matchesParGroupe[g].map(m => renderMatchRow(m)).join('');
    return `
      <div class="matches-groupe-bloc">
        <div class="matches-groupe-titre">Groupe ${g}</div>
        ${bloc}
      </div>`;
  }).join('');
}

function renderGroupeCard(g) {
  const joues = g.equipes.reduce((acc, e) => acc + e.j, 0) / 2;
  const badge = joues > 0 ? `<span class="badge-joues">${joues}/6 joués</span>` : '';

  const rows = g.equipes.map((e, i) => {
    const qClass = i === 0 ? 'qualifie-1' : i === 1 ? 'qualifie-2' : i === 2 ? 'qualifie-3' : '';
    return `
      <tr class="${qClass}">
        <td>${i + 1}</td>
        <td class="team">${escapeHtml(e.equipe)}</td>
        <td>${e.j}</td>
        <td>${e.v}</td>
        <td>${e.n}</td>
        <td>${e.d}</td>
        <td>${e.bp}</td>
        <td>${e.bc}</td>
        <td>${e.diff >= 0 ? '+' : ''}${e.diff}</td>
        <td class="col-pts">${e.pts}</td>
      </tr>`;
  }).join('');

  return `
    <div class="groupe-card">
      <div class="groupe-head">
        <span>Groupe ${g.id}</span>
        ${badge}
      </div>
      <table class="groupe-table">
        <thead>
          <tr>
            <th>#</th><th class="team">Équipe</th>
            <th>J</th><th>V</th><th>N</th><th>D</th>
            <th>Bp</th><th>Bc</th><th>Diff</th><th>Pts</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderMatchRow(m) {
  let scoreHtml, homeClass = '', awayClass = '';
  if (m.joue) {
    scoreHtml = `<span class="match-score">${m.score_home} – ${m.score_away}</span>`;
    if (m.score_home > m.score_away)      { homeClass = 'winner'; awayClass = 'loser'; }
    else if (m.score_away > m.score_home) { homeClass = 'loser';  awayClass = 'winner'; }
  } else {
    scoreHtml = `<span class="match-score empty">vs</span>`;
  }
  return `
    <div class="match-row ${m.joue ? 'joue' : ''}">
      <span class="match-n">#${m.n}</span>
      <span class="match-home ${homeClass}">${escapeHtml(m.home)}</span>
      ${scoreHtml}
      <span class="match-away ${awayClass}">${escapeHtml(m.away)}</span>
    </div>`;
}

/* --------------------------------------------------------------------------
   VUE PRONOS
   -------------------------------------------------------------------------- */

const REVEAL_KEY = 'reveal_pronos_at';

function isPronosRevealed() {
  const at = DATA.meta[REVEAL_KEY];
  if (!at) return false;
  return new Date() >= new Date(at);
}

function renderPronos() {
  const lockedScreen = $('#pronos-locked');
  const content      = $('#pronos-content');

  if (!isPronosRevealed()) {
    lockedScreen.hidden = false;
    content.hidden = true;
    return;
  }

  lockedScreen.hidden = true;
  content.hidden = false;

  const pronos = DATA.concours.pronostics || {};
  const participants = DATA.concours.participants;
  const select = $('#select-participant');

  select.innerHTML = participants
    .filter(p => pronos[p.slug])
    .map(p => `<option value="${escapeHtml(p.slug)}">${escapeHtml(p.nom)}</option>`)
    .join('');

  const compare = () => $('#toggle-compare').checked;

  function renderSelected() {
    const slug  = select.value;
    const prono = pronos[slug];
    if (!prono) return;
    renderPronoMatches(prono, compare());
    renderPronosClassements(prono, compare());
    renderPronos3es(prono, compare());
    renderPronosBonus(prono, compare());
  }

  select.addEventListener('change', renderSelected);
  $('#toggle-compare').addEventListener('change', renderSelected);

  if (select.options.length > 0) renderSelected();
}

function renderPronoMatches(prono, compare) {
  const matchesReels = {};
  DATA.tournoi.matches.forEach(m => { matchesReels[m.n] = m; });

  const byGroup = {};
  prono.matches.forEach(pm => {
    if (!byGroup[pm.groupe]) byGroup[pm.groupe] = [];
    byGroup[pm.groupe].push(pm);
  });

  const grouped = Object.keys(byGroup).sort().map(g => {
    const rows = byGroup[g].map(pm => renderPronoMatchRow(pm, matchesReels[pm.n] || {}, compare)).join('');
    return `<div class="matches-groupe-bloc">
      <div class="matches-groupe-titre">Groupe ${g}</div>
      ${rows}
    </div>`;
  }).join('');

  $('#pronos-matches-container').innerHTML = grouped;
}

function renderPronoMatchRow(pm, reel, compare) {
  let resultClass = '';
  let reelScoreHtml = `<span class="pm-score-reel empty">vs</span>`;

  if (reel.joue) {
    reelScoreHtml = `<span class="pm-score-reel">${reel.score_home} - ${reel.score_away}</span>`;
    if (compare) {
      const exact = pm.score_home === reel.score_home && pm.score_away === reel.score_away;
      const tendOk = tendance(pm.score_home, pm.score_away) === tendance(reel.score_home, reel.score_away);
      if (exact)       resultClass = 'pronos-exact';
      else if (tendOk) resultClass = 'pronos-tendance';
      else             resultClass = 'pronos-faux';
    }
  }

  const showReelClass = compare ? 'show-reel' : '';

  return `
    <div class="pronos-match-row ${resultClass} ${showReelClass}">
      <span class="match-n">#${pm.n}</span>
      <span class="match-home" style="text-align:right">${escapeHtml(reel.home)}</span>
      <span class="pm-score-prono">${pm.score_home}-${pm.score_away}</span>
      <span class="pm-vs">vs réel →</span>
      ${reelScoreHtml}
      <span class="match-away">${escapeHtml(reel.away)}</span>
    </div>`;
}

function renderPronosClassements(prono, compare) {
  const groupesReels = {};
  DATA.tournoi.groupes.forEach(g => { groupesReels[g.id] = g.equipes; });

  const html = Object.keys(prono.classements).sort().map(g_id => {
    const pronoTeams = prono.classements[g_id];
    const reelLignes = groupesReels[g_id] || [];
    const reelTop2 = reelLignes.slice(0, 2).map(l => l.equipe);
    const groupTermine = reelLignes.every(l => l.j === 3);

    const rows = pronoTeams.map((team, i) => {
      let rowClass = '';
      if (compare && groupTermine) {
        if (i < 2) {
          if (team === reelTop2[i])              rowClass = 'bonne-place';
          else if (reelTop2.includes(team))      rowClass = 'inversion';
        }
      }
      return `
        <tr class="${rowClass}">
          <td class="rang">${i + 1}</td>
          <td>${escapeHtml(team)}</td>
        </tr>`;
    }).join('');

    return `
      <div class="prono-classement-card">
        <div class="groupe-head">
          <span>Groupe ${g_id}</span>
          ${groupTermine ? '<span class="badge-joues">Terminé</span>' : ''}
        </div>
        <table class="prono-classement-table">
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join('');

  $('#pronos-classements-container').innerHTML = html;
}

function renderPronos3es(prono, compare) {
  const reels3es = new Set(DATA.tournoi.meilleurs_3es || []);
  const html = prono.meilleurs_3es.map(t => {
    const matched = compare && reels3es.has(t);
    return `<span class="pill ${matched ? 'matched' : ''}">${escapeHtml(t)}</span>`;
  }).join('');
  $('#pronos-3es-container').innerHTML = html;
}

const BONUS_LABELS = {
  meilleur_buteur:             { icon: '🥅', label: 'Meilleur buteur du tournoi' },
  premiere_equipe_carton_rouge:{ icon: '🟥', label: '1ère équipe carton rouge' },
  premiere_equipe_penalty:     { icon: '⚽', label: '1ère équipe à bénéficier d\'un penalty' },
  premier_belge_carton_jaune:  { icon: '🇧🇪', label: '1er Belge carton jaune' },
  premier_belge_remplace:      { icon: '🇧🇪', label: '1er Belge remplacé' },
  premier_belge_but_de_la_tete:{ icon: '🇧🇪', label: '1er Belge à marquer de la tête' },
};

function renderPronosBonus(prono, compare) {
  const reels = DATA.tournoi.bonus_reels || {};
  const butsParJoueur = reels.buts_par_joueur || {};

  const rows = Object.keys(BONUS_LABELS).map(key => {
    const meta = BONUS_LABELS[key];
    const pronoVal = prono.bonus[key] || '—';
    let reelVal, verdictHtml;

    if (key === 'meilleur_buteur') {
      const buts = butsParJoueur[pronoVal] || 0;
      reelVal = `${buts} but${buts > 1 ? 's' : ''} (à ce jour)`;
      if (!compare) verdictHtml = '';
      else if (buts > 0) verdictHtml = `<span class="verdict ok">+${buts} pt${buts > 1 ? 's' : ''}</span>`;
      else verdictHtml = `<span class="verdict pending">0 pt</span>`;
    } else {
      reelVal = reels[key] || '<em style="color:#A8A8A8">en attente</em>';
      if (!compare || !reels[key]) {
        verdictHtml = reels[key] ? '' : '<span class="verdict pending">en attente</span>';
      } else {
        const ok = pronoVal === reels[key];
        verdictHtml = ok
          ? '<span class="verdict ok">+5 pts</span>'
          : '<span class="verdict ko">raté</span>';
      }
    }

    return `
      <tr>
        <td class="col-q">${meta.icon} ${meta.label}</td>
        <td>${escapeHtml(pronoVal)}</td>
        <td>${reelVal}</td>
        <td>${verdictHtml}</td>
      </tr>`;
  }).join('');

  $('#pronos-bonus-container').innerHTML = `
    <table class="bonus-prono-table">
      <thead>
        <tr>
          <th>Question</th>
          <th>Pronostic</th>
          <th>Réel</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/* --------------------------------------------------------------------------
   VUE BONUS (vue d'ensemble : résultat réel + tous les pronostics)
   -------------------------------------------------------------------------- */

function renderBonus() {
  const reels = DATA.tournoi.bonus_reels || {};
  const butsParJoueur = reels.buts_par_joueur || {};
  const pronos = DATA.concours.pronostics || {};
  const participants = DATA.concours.participants;
  const revealed = isPronosRevealed();

  const cards = Object.keys(BONUS_LABELS).map(key => {
    const meta = BONUS_LABELS[key];

    let reelHtml;
    if (key === 'meilleur_buteur') {
      const entries = Object.entries(butsParJoueur)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      if (entries.length === 0) {
        reelHtml = `<p class="bonus-card-reel pending">Aucun but enregistré pour les joueurs pronostiqués.</p>`;
      } else {
        const list = entries.map(([j, b]) => `<strong>${escapeHtml(j)}</strong> : ${b} but${b > 1 ? 's' : ''}`).join('<br>');
        reelHtml = `<p class="bonus-card-reel">${list}</p>`;
      }
    } else {
      const val = reels[key];
      reelHtml = val
        ? `<p class="bonus-card-reel">Réponse : <strong>${escapeHtml(val)}</strong></p>`
        : `<p class="bonus-card-reel pending">En attente que la situation se présente.</p>`;
    }

    let pronosHtml = '';
    if (revealed) {
      const lines = participants
        .filter(p => pronos[p.slug])
        .map(p => {
          const v = pronos[p.slug].bonus[key] || '—';
          let matchOk = false;
          if (key === 'meilleur_buteur') {
            matchOk = (butsParJoueur[v] || 0) > 0;
          } else {
            matchOk = reels[key] && v === reels[key];
          }
          return `
            <div class="bonus-card-prono-line ${matchOk ? 'match-ok' : ''}">
              <span class="nom">${escapeHtml(p.nom)}</span>
              <span class="val">${escapeHtml(v)}${matchOk ? ' ✓' : ''}</span>
            </div>`;
        }).join('');
      pronosHtml = `
        <div class="bonus-card-pronos">
          <div class="bonus-card-pronos-title">Pronostics des participants</div>
          ${lines}
        </div>`;
    } else {
      pronosHtml = `
        <div class="bonus-card-pronos">
          <div class="bonus-card-pronos-title">Pronostics</div>
          <div class="bonus-card-prono-line">
            <span class="nom" style="font-style:italic">🔒 Révélés au coup d'envoi (11 juin 21h)</span>
          </div>
        </div>`;
    }

    return `
      <div class="bonus-card">
        <div class="bonus-card-title">${meta.icon} ${meta.label}</div>
        ${reelHtml}
        ${pronosHtml}
      </div>`;
  }).join('');

  $('#bonus-container').innerHTML = `<div class="bonus-cards">${cards}</div>`;
}


/* --------------------------------------------------------------------------
   DJDITCH — Bulle de dialogue dans le header
   Répliques contextuelles, déclenchement aléatoire toutes les 45-90 secondes
   -------------------------------------------------------------------------- */

// Répliques par contexte
// Les répliques dynamiques utilisent des tokens {premier} et {dernier}
// remplacés en temps réel depuis DATA.concours.participants

const DJDITCH_REPLIQUES = {
  generiques: [
    "Alors, on vérifie si on est meilleur que Claude IA ?",
    "Tu consultes le classement une 3ème fois aujourd'hui ? La foi, ça se respecte.",
    "Rappel : le hasard n'existe pas. Sauf quand tu gagnes.",
    "Je te regarde. Je vois tout. Je juge.",
  ],
  classement: [
    "Alors, on vérifie si on a rattrapé Claude IA ?",
    "{dernier} est dernier. Minute de silence... ou pas. Ahahaha !",
    "{premier} en tête. Pour l'instant... Mais le tournoi est long.",
    "Les points de classement arrivent le 28 juin. D'ici là, souffrez en silence.",
  ],
  tournoi: [
    "Regarde ces scores. Maintenant regarde tes pronos. Maintenant repleure.",
    "Le Groupe G ? Belgique première, évidemment. T'as pas pronostiqué ça ? Traître.",
    "Ah, t'as mis la France première du Groupe I ? Je vais faire semblant de ne pas avoir vu ça. À mort, la France !",
  ],
  pronos: [
    "T'as pronostiqué Mbappé meilleur buteur ? Traître à ton sang !",
    "Un score exact, c'est bien. C'est surtout de la chance, soyons honnêtes.",
    "Deux scores exacts ? Soit tu es un génie, soit tu as triché. Je penche pour la 2ème option. Surtout si ChatGPT t'a aidé !",
    "Regarder les pronos de tes concurrents à la recherche d'inspiration... C'est beau, l'humilité.",
  ],
  bonus: [
    "Premier carton rouge : pas encore tombé. La violence, ça se mérite.",
    "Meilleur buteur pronostiqué : Diogo Jota. Il joue plus dans ce tournoi. Ni dans aucun autre. Bravo. Tu t'es crashé comme lui !",
    "Premier Belge remplacé... Dès la 12ème minute probablement. Connaissant Rudi Garcia !",
    "Premier Belge à marquer de la tête ? Doku peut-être. Si De Bruyne lui fait la courte échelle !",
  ],
  connexion: [
    "Ah, te voilà. On t'attendait. Enfin... Didier t'attendait. Moi, bof.",
    "Mot de passe accepté. T'as quand même mis du temps.",
  ],
  inactivite: [
    "Tu dors ? Le tournoi, lui, il dort pas.",
  ],
};

// Durée d'affichage de la bulle en ms
const BUBBLE_DISPLAY_MS   = 5000;
// Intervalle minimum entre deux bulles en ms (45s)
const BUBBLE_MIN_DELAY_MS = 45000;
// Intervalle maximum (90s)
const BUBBLE_MAX_DELAY_MS = 90000;

let bubbleTimer      = null;  // timer de disparition de la bulle courante
let nextBubbleTimer  = null;  // timer pour la prochaine bulle
let bubbleShownOnce  = false; // bulle de connexion jouée ?

function _pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function _resolveDynamic(text) {
  if (!DATA || !DATA.concours || !DATA.concours.participants) return text;
  const parts = DATA.concours.participants;
  if (parts.length === 0) return text;
  const premier = parts[0].nom;
  const dernier = parts[parts.length - 1].nom;
  return text.replace('{premier}', premier).replace('{dernier}', dernier);
}

function _buildPool(tab) {
  // Mélange : 60% contextuelles, 40% génériques
  const contextual = DJDITCH_REPLIQUES[tab] || [];
  const generiques  = DJDITCH_REPLIQUES.generiques;
  // On prend toutes les contextuelles + 2 génériques aléatoires
  const pool = [...contextual];
  for (let i = 0; i < 2; i++) pool.push(_pickRandom(generiques));
  return pool;
}

function showBubble(text) {
  const header = document.getElementById('djditch-header');
  const bubble = document.getElementById('djditch-bubble');
  const span   = document.getElementById('djditch-bubble-text');
  if (!header || !bubble || !span) return;

  // Annuler le timer de disparition en cours si une bulle est déjà visible
  if (bubbleTimer) { clearTimeout(bubbleTimer); bubbleTimer = null; }

  // Résoudre les tokens dynamiques
  const resolved = _resolveDynamic(text);
  span.textContent = resolved;

  // Reset classes d'animation
  bubble.classList.remove('bubble-in', 'bubble-out');
  bubble.hidden = false;

  // Force reflow pour relancer l'animation
  void bubble.offsetWidth;
  bubble.classList.add('bubble-in');
  header.classList.add('speaking');

  // Retirer la classe speaking après le bounce
  setTimeout(() => header.classList.remove('speaking'), 400);

  // Programmer la disparition
  bubbleTimer = setTimeout(() => {
    bubble.classList.remove('bubble-in');
    bubble.classList.add('bubble-out');
    bubble.addEventListener('animationend', () => {
      bubble.hidden = true;
      bubble.classList.remove('bubble-out');
    }, { once: true });
    bubbleTimer = null;
  }, BUBBLE_DISPLAY_MS);
}

function scheduleNextBubble() {
  if (nextBubbleTimer) clearTimeout(nextBubbleTimer);
  const delay = BUBBLE_MIN_DELAY_MS + Math.random() * (BUBBLE_MAX_DELAY_MS - BUBBLE_MIN_DELAY_MS);
  nextBubbleTimer = setTimeout(() => {
    const pool = _buildPool(CURRENT_TAB);
    showBubble(_pickRandom(pool));
    scheduleNextBubble();
  }, delay);
}

function initDjDitchHeader() {
  // Bulle de connexion immédiate
  const connexionMsg = _pickRandom(DJDITCH_REPLIQUES.connexion);
  setTimeout(() => {
    showBubble(connexionMsg);
    bubbleShownOnce = true;
    // Démarrer le cycle aléatoire après la bulle de connexion
    scheduleNextBubble();
  }, 1200);

  // Inactivité : si pas de clic pendant 30s, DjDitch relance
  let inactivityTimer = null;
  function resetInactivity() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      showBubble(_pickRandom(DJDITCH_REPLIQUES.inactivite));
    }, 30000);
  }
  document.addEventListener('click', resetInactivity);
  document.addEventListener('keydown', resetInactivity);
  resetInactivity();
}

// Appelé depuis setTab() à chaque changement d'onglet
function djditchOnTabChange(tab) {
  if (!bubbleShownOnce) return; // pas encore initialisé
  // 50% de chances de parler au changement d'onglet
  if (Math.random() < 0.5) {
    const pool = _buildPool(tab);
    showBubble(_pickRandom(pool));
    // Reprogrammer le prochain timer depuis maintenant
    scheduleNextBubble();
  }
}

/* --------------------------------------------------------------------------
   GO
   -------------------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
  if (!isAuthed()) {
    setupLogin();
  } else {
    showSplash();
    init().then(() => initDjDitchHeader());
  }
});
