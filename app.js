/* ============================================================================
   PRONOS CdM 2026 — APP.JS
   ============================================================================ */

'use strict';

const DATA_URL = 'data/classement.json';

const AUTH_PASSWORD = 'diables2026';
const AUTH_STORAGE_KEY = 'pronos_cdm2026_authed';

function isAuthed() {
  try { return localStorage.getItem(AUTH_STORAGE_KEY) === 'yes'; } catch (e) { return false; }
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
      try { localStorage.setItem(AUTH_STORAGE_KEY, 'yes'); } catch (err) {}
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
let _applyPronosMode = null; // exposé par renderPronos

const $  = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function formatDateFr(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}h${String(d.getMinutes()).padStart(2,'0')}`;
}

function tendance(sh, sa) { if (sh > sa) return 'H'; if (sa > sh) return 'A'; return 'N'; }

const DJDITCH_LOOP_DURATION_MS = 9000;
const DJDITCH_TRIP_DURATION_MS = 9000;
let tripPlayed = false;

function showSplash() {
  const splash = document.getElementById('djditch-splash');
  if (!splash) return;
  splash.hidden = false;
  setTimeout(() => {
    splash.classList.add('djditch-fadeout');
    splash.addEventListener('animationend', () => { splash.hidden = true; splash.classList.remove('djditch-fadeout'); }, { once: true });
  }, DJDITCH_LOOP_DURATION_MS);
}

function playTripOnce() {
  if (tripPlayed) return;
  tripPlayed = true;
  const headerImg = document.getElementById('djditch-header-img');
  if (!headerImg) return;
  headerImg.src = 'img/DjDitch-trip.gif';
  setTimeout(() => {
    headerImg.src = 'img/djditch-header.png';
  }, DJDITCH_TRIP_DURATION_MS);
}

async function init() {
  try {
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    DATA = await res.json();
  } catch (err) {
    document.body.innerHTML = `<div style="padding:40px;text-align:center;font-family:Manrope"><h2 style="color:#E30613">Erreur de chargement</h2><p>Impossible de charger les données du concours.</p><p style="color:#6B6B6B;font-size:12px">${escapeHtml(err.message)}</p></div>`;
    return;
  }
  $('#last-update-value').textContent = formatDateFr(DATA.meta.generated_at);
  renderPhaseBanner();
  $$('.tab').forEach(t => t.addEventListener('click', () => setTab(t.dataset.tab)));
  renderClassement();
  renderTournoi();
  renderBracket();
  renderPronos();
  renderBonus();
}

function renderPhaseBanner() {
  const banner = $('#phase-banner');
  const phase = DATA.meta.phase;
  const joues = DATA.meta.nb_matches_joues;
  const total = DATA.meta.nb_matches_total;
  let label;
  if (phase === 'poules') label = `Phase de poules — ${joues}/${total} matches joués`;
  else if (phase === 'phase_finale') label = `Phase à élimination directe`;
  else if (phase === 'termine') label = `Tournoi terminé`;
  else label = phase;
  banner.textContent = label;
}

function setTab(name) {
  CURRENT_TAB = name;
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  $$('.vue').forEach(v => v.classList.toggle('active', v.id === `vue-${name}`));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  djditchOnTabChange(name);
  if (name === 'tournoi') playTripOnce();
  if (name === 'pronos' && _applyPronosMode) setTimeout(_applyPronosMode, 0);
  if (name === 'bracket') renderBracket();
}

function renderClassement() {
  const container = $('#classement-container');
  const parts = DATA.concours.participants;
  if (!parts || parts.length === 0) {
    container.innerHTML = `<p style="color:#6B6B6B;text-align:center;padding:32px">Aucun participant importé pour l'instant.</p>`;
    return;
  }
  container.innerHTML = `
    <table class="classement-table">
      <thead><tr>
        <th class="num">Rang</th><th>Participant</th><th class="num">Total</th>
        <th class="num">Poules<br>matches</th><th class="num">Poules<br>classement</th>
        <th class="num">Phase<br>finale</th><th class="num">Bonus</th>
        <th class="num">Pénalité</th><th class="num">Sc.<br>exacts</th>
      </tr></thead>
      <tbody>${parts.map(p => renderRow(p)).join('')}</tbody>
    </table>
    <div class="classement-mobile">${parts.map(p => renderCard(p)).join('')}</div>`;
}

function renderRow(p) {
  const rangCell = p.rang <= 3 ? `<span class="rang-medal rang-${p.rang}">${p.rang}</span>` : `${p.rang}`;
  return `<tr>
    <td class="rang-cell">${rangCell}</td>
    <td class="nom-cell">${escapeHtml(p.nom)}</td>
    <td class="total-cell">${p.total}</td>
    <td class="detail-cell ${p.poules_matches===0?'zero':''}">${p.poules_matches}</td>
    <td class="detail-cell ${p.poules_classement===0?'zero':''}">${p.poules_classement}</td>
    <td class="detail-cell ${p.phase_finale===0?'zero':''}">${p.phase_finale}</td>
    <td class="detail-cell ${p.bonus===0?'zero':''}">${p.bonus}</td>
    <td class="detail-cell ${p.penalite<0?'penalite':'zero'}">${p.penalite}</td>
    <td class="detail-cell ${p.scores_exacts===0?'zero':''}">${p.scores_exacts}</td>
  </tr>`;
}

function renderCard(p) {
  const rangClass = p.rang <= 3 ? `rang-${p.rang}-card` : '';
  return `<div class="participant-card ${rangClass}">
    <div class="pc-top">
      <div class="pc-left"><div class="pc-rang">${p.rang}</div><div class="pc-nom">${escapeHtml(p.nom)}</div></div>
      <div class="pc-total">${p.total}</div>
    </div>
    <div class="pc-bottom">
      <div class="pc-stat"><div class="pc-stat-label">Poules</div><div class="pc-stat-value ${p.poules_matches===0?'zero':''}">${p.poules_matches+p.poules_classement}</div></div>
      <div class="pc-stat"><div class="pc-stat-label">Phase finale</div><div class="pc-stat-value ${p.phase_finale===0?'zero':''}">${p.phase_finale}</div></div>
      <div class="pc-stat"><div class="pc-stat-label">Bonus</div><div class="pc-stat-value ${p.bonus===0?'zero':''}">${p.bonus}</div></div>
      <div class="pc-stat"><div class="pc-stat-label">Pénalité</div><div class="pc-stat-value ${p.penalite<0?'pen':'zero'}">${p.penalite}</div></div>
    </div>
  </div>`;
}

function renderTournoi() {
  const groupesContainer = $('#groupes-container');
  const matchesContainer = $('#matches-container');
  const nbJouesSpan = $('#nb-joues');
  const groupes = DATA.tournoi.groupes;
  const matches = DATA.tournoi.matches;
  nbJouesSpan.textContent = matches.filter(m => m.joue).length;
  groupesContainer.innerHTML = groupes.map(g => renderGroupeCard(g)).join('');
  const matchesParGroupe = {};
  matches.forEach(m => { if (!matchesParGroupe[m.groupe]) matchesParGroupe[m.groupe] = []; matchesParGroupe[m.groupe].push(m); });
  matchesContainer.innerHTML = Object.keys(matchesParGroupe).sort().map(g => {
    return `<div class="matches-groupe-bloc"><div class="matches-groupe-titre">Groupe ${g}</div>${matchesParGroupe[g].map(m => renderMatchRow(m)).join('')}</div>`;
  }).join('');
}

function renderGroupeCard(g) {
  const joues = g.equipes.reduce((acc, e) => acc + e.j, 0) / 2;
  const badge = joues > 0 ? `<span class="badge-joues">${joues}/6 joués</span>` : '';
  const rows = g.equipes.map((e, i) => {
    const qClass = i===0?'qualifie-1':i===1?'qualifie-2':i===2?'qualifie-3':'';
    return `<tr class="${qClass}"><td>${i+1}</td><td class="team">${escapeHtml(e.equipe)}</td><td>${e.j}</td><td>${e.v}</td><td>${e.n}</td><td>${e.d}</td><td>${e.bp}</td><td>${e.bc}</td><td>${e.diff>=0?'+':''}${e.diff}</td><td class="col-pts">${e.pts}</td></tr>`;
  }).join('');
  return `<div class="groupe-card"><div class="groupe-head"><span>Groupe ${g.id}</span>${badge}</div>
    <table class="groupe-table"><thead><tr><th>#</th><th class="team">Équipe</th><th>J</th><th>V</th><th>N</th><th>D</th><th>Bp</th><th>Bc</th><th>Diff</th><th>Pts</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function renderMatchRow(m) {
  let scoreHtml, homeClass='', awayClass='';
  if (m.joue) {
    scoreHtml = `<span class="match-score">${m.score_home} – ${m.score_away}</span>`;
    if (m.score_home > m.score_away) { homeClass='winner'; awayClass='loser'; }
    else if (m.score_away > m.score_home) { homeClass='loser'; awayClass='winner'; }
  } else { scoreHtml = `<span class="match-score empty">vs</span>`; }
  return `<div class="match-row ${m.joue?'joue':''}"><span class="match-n">#${m.n}</span><span class="match-home ${homeClass}">${escapeHtml(m.home)}</span>${scoreHtml}<span class="match-away ${awayClass}">${escapeHtml(m.away)}</span></div>`;
}

const REVEAL_KEY = 'reveal_pronos_at';

function isPronosRevealed() {
  const at = DATA.meta[REVEAL_KEY];
  if (!at) return true;
  return new Date() >= new Date(at);
}

function renderPronos() {
  const lockedScreen = $('#pronos-locked');
  const content = $('#pronos-content');
  if (!isPronosRevealed()) { lockedScreen.hidden=false; content.hidden=true; return; }
  lockedScreen.hidden = true;
  content.hidden = false;
  const pronos = DATA.concours.pronostics || {};
  const participants = DATA.concours.participants;
  const select = $('#select-participant');
  select.innerHTML = participants.filter(p => pronos[p.slug]).map(p => `<option value="${escapeHtml(p.slug)}">${escapeHtml(p.nom)}</option>`).join('');

  const selectMatch = $('#select-match');
  selectMatch.innerHTML = DATA.tournoi.matches.map(m => {
    const joue = m.joue ? ` [${m.score_home}-${m.score_away}]` : '';
    return `<option value="${m.n}">#${m.n} Gr.${m.groupe} — ${m.home} vs ${m.away}${joue}</option>`;
  }).join('');

  const compare = () => $('#toggle-compare').checked;
  let mode = 'participant';
  // Forcer l'état initial indépendamment de ce que Safari a pu restaurer
  $('#pronos-mode-participant').classList.add('active');
  $('#pronos-mode-match').classList.remove('active');

  function applyMode() {
    const ctrlParticipant = $('#ctrl-participant');
    const ctrlMatch = $('#ctrl-match');
    const sectionsParticipant = $('#pronos-sections-participant');
    const sectionsMatch = $('#pronos-sections-match');
    const btnParticipant = $('#pronos-mode-participant');
    const btnMatch = $('#pronos-mode-match');
    if (mode === 'participant') {
      btnParticipant.classList.add('active');
      btnMatch.classList.remove('active');
      ctrlParticipant.hidden = false;
      ctrlParticipant.classList.remove('hidden-by-mode');
      ctrlMatch.classList.remove('visible');
      ctrlMatch.hidden = true;
      sectionsParticipant.hidden = false;
      sectionsMatch.hidden = true;
      renderSelected();
    } else {
      btnParticipant.classList.remove('active');
      btnMatch.classList.add('active');
      ctrlParticipant.hidden = true;
      ctrlParticipant.classList.add('hidden-by-mode');
      ctrlMatch.classList.add('visible');
      ctrlMatch.hidden = false;
      sectionsParticipant.hidden = true;
      sectionsMatch.hidden = false;
      renderMatchSelected();
    }
  }

  function renderSelected() {
    const slug = select.value;
    const prono = pronos[slug];
    if (!prono) return;
    renderPronoMatches(prono, compare());
    renderPronosClassements(prono, compare());
    renderPronos3es(prono, compare());
    renderPronosBonus(prono, compare());
  }

  function renderMatchSelected() {
    const n = parseInt(selectMatch.value, 10);
    renderPronosParMatch(n, compare());
  }

  $('#pronos-mode-participant').addEventListener('click', () => { mode='participant'; applyMode(); });
  $('#pronos-mode-match').addEventListener('click', () => { mode='match'; applyMode(); });
  select.addEventListener('change', renderSelected);
  selectMatch.addEventListener('change', renderMatchSelected);
  $('#toggle-compare').addEventListener('change', () => {
    if (mode === 'participant') renderSelected(); else renderMatchSelected();
  });
  _applyPronosMode = applyMode;
  setTimeout(applyMode, 0);
}

function renderPronosParMatch(matchN, compare) {
  const pronos = DATA.concours.pronostics || {};
  const participants = DATA.concours.participants;
  const reel = DATA.tournoi.matches.find(m => m.n === matchN);
  if (!reel) return;
  const reelScoreHtml = reel.joue
    ? `<span class="pm-score-reel">${reel.score_home} – ${reel.score_away}</span>`
    : `<span class="pm-score-reel empty">Non joué</span>`;
  const rows = participants.filter(p => pronos[p.slug]).map(p => {
    const pm = pronos[p.slug].matches.find(m => m.n === matchN);
    if (!pm) return '';
    let resultClass = '';
    if (compare && reel.joue) {
      const exact = pm.score_home===reel.score_home && pm.score_away===reel.score_away;
      const tendOk = tendance(pm.score_home,pm.score_away)===tendance(reel.score_home,reel.score_away);
      if (exact) resultClass='pronos-exact'; else if (tendOk) resultClass='pronos-tendance'; else resultClass='pronos-faux';
    }
    return `<tr class="${resultClass}"><td class="pm-nom">${escapeHtml(p.nom)}</td><td class="pm-score-cell"><span class="pm-score-prono">${pm.score_home} – ${pm.score_away}</span></td></tr>`;
  }).join('');
  $('#pronos-sections-match').innerHTML = `
    <div class="par-match-header">
      <span class="match-home">${escapeHtml(reel.home)}</span>
      ${reelScoreHtml}
      <span class="match-away">${escapeHtml(reel.away)}</span>
    </div>
    <table class="par-match-table">
      <thead><tr><th>Participant</th><th>Pronostic</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderPronoMatches(prono, compare) {
  const matchesReels = {};
  DATA.tournoi.matches.forEach(m => { matchesReels[m.n] = m; });
  const byGroup = {};
  prono.matches.forEach(pm => {
    const groupe = (matchesReels[pm.n] || {}).groupe || '?';
    if (!byGroup[groupe]) byGroup[groupe]=[];
    byGroup[groupe].push(pm);
  });
  $('#pronos-matches-container').innerHTML = Object.keys(byGroup).sort().map(g => {
    return `<div class="matches-groupe-bloc"><div class="matches-groupe-titre">Groupe ${g}</div>${byGroup[g].map(pm => renderPronoMatchRow(pm, matchesReels[pm.n]||{}, compare)).join('')}</div>`;
  }).join('');
}

function renderPronoMatchRow(pm, reel, compare) {
  let resultClass='', reelScoreHtml=`<span class="pm-score-reel empty">vs</span>`;
  if (reel.joue) {
    reelScoreHtml = `<span class="pm-score-reel">${reel.score_home} - ${reel.score_away}</span>`;
    if (compare) {
      const exact = pm.score_home===reel.score_home && pm.score_away===reel.score_away;
      const tendOk = tendance(pm.score_home,pm.score_away)===tendance(reel.score_home,reel.score_away);
      if (exact) resultClass='pronos-exact'; else if (tendOk) resultClass='pronos-tendance'; else resultClass='pronos-faux';
    }
  }
  const showReelClass = compare ? 'show-reel' : '';
  return `<div class="pronos-match-row ${resultClass} ${showReelClass}"><span class="match-n">#${pm.n}</span><span class="match-home" style="text-align:right">${escapeHtml(reel.home)}</span><span class="pm-score-prono">${pm.score_home}-${pm.score_away}</span><span class="pm-vs">vs réel →</span>${reelScoreHtml}<span class="match-away">${escapeHtml(reel.away)}</span></div>`;
}

function stripDrapeau(nom) {
  if (!nom) return '';
  const s = nom.trim();
  let i = 0;
  while (i < s.length && !/[\p{L}\p{N}]/u.test(s[i])) i++;
  return s.slice(i).trim();
}

function renderPronosClassements(prono, compare) {
  const groupesReels = {};
  DATA.tournoi.groupes.forEach(g => { groupesReels[g.id] = g.equipes; });
  const classements = prono.classement_par_groupe || prono.classements || {};
  $('#pronos-classements-container').innerHTML = Object.keys(classements).sort().map(g_id => {
    const pronoTeams = classements[g_id];
    const reelLignes = groupesReels[g_id] || [];
    const reelTop2 = reelLignes.slice(0,2).map(l => l.equipe);
    const groupTermine = reelLignes.every(l => l.j===3);
    const rows = pronoTeams.map((team,i) => {
      let rowClass='';
      if (compare && groupTermine && i<2) { const t=stripDrapeau(team); if (t===stripDrapeau(reelTop2[i])) rowClass='bonne-place'; else if (reelTop2.some(r=>stripDrapeau(r)===t)) rowClass='inversion'; }
      return `<tr class="${rowClass}"><td class="rang">${i+1}</td><td>${escapeHtml(team)}</td></tr>`;
    }).join('');
    return `<div class="prono-classement-card"><div class="groupe-head"><span>Groupe ${g_id}</span>${groupTermine?'<span class="badge-joues">Terminé</span>':''}</div><table class="prono-classement-table"><tbody>${rows}</tbody></table></div>`;
  }).join('');
}

function renderPronos3es(prono, compare) {
  const reels3es = new Set((DATA.tournoi.meilleurs_3es || []).map(stripDrapeau));
  $('#pronos-3es-container').innerHTML = prono.meilleurs_3es.map(t => `<span class="pill ${compare&&reels3es.has(stripDrapeau(t))?'matched':''}">${escapeHtml(t)}</span>`).join('');
}

const BONUS_LABELS = {
  meilleur_buteur:             { icon:'🥅', label:'Meilleur buteur du tournoi' },
  premiere_equipe_carton_rouge:{ icon:'🟥', label:'1ère équipe carton rouge' },
  premiere_equipe_penalty:     { icon:'⚽', label:"1ère équipe à bénéficier d'un penalty" },
  premier_belge_carton_jaune:  { icon:'🇧🇪', label:'1er Belge carton jaune' },
  premier_belge_remplace:      { icon:'🇧🇪', label:'1er Belge remplacé' },
  premier_belge_but_de_la_tete:{ icon:'🇧🇪', label:'1er Belge à marquer de la tête' },
};

function renderPronosBonus(prono, compare) {
  const reels = DATA.tournoi.bonus_reels || {};
  const butsParJoueur = reels.buts_par_joueur || {};
  const rows = Object.keys(BONUS_LABELS).map(key => {
    const meta = BONUS_LABELS[key];
    const pronoVal = prono.bonus[key] || '—';
    let reelVal, verdictHtml;
    if (key==='meilleur_buteur') {
      const buts = butsParJoueur[pronoVal]||0;
      reelVal = `${buts} but${buts>1?'s':''} (à ce jour)`;
      if (!compare) verdictHtml='';
      else if (buts>0) verdictHtml=`<span class="verdict ok">+${buts} pt${buts>1?'s':''}</span>`;
      else verdictHtml=`<span class="verdict pending">0 pt</span>`;
    } else {
      reelVal = reels[key]||'<em style="color:#A8A8A8">en attente</em>';
      if (!compare||!reels[key]) verdictHtml=reels[key]?'':'<span class="verdict pending">en attente</span>';
      else verdictHtml=pronoVal===reels[key]?'<span class="verdict ok">+5 pts</span>':'<span class="verdict ko">raté</span>';
    }
    return `<tr><td class="col-q">${meta.icon} ${meta.label}</td><td>${escapeHtml(pronoVal)}</td><td>${reelVal}</td><td>${verdictHtml}</td></tr>`;
  }).join('');
  $('#pronos-bonus-container').innerHTML = `<table class="bonus-prono-table"><thead><tr><th>Question</th><th>Pronostic</th><th>Réel</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderBonus() {
  const reels = DATA.tournoi.bonus_reels || {};
  const butsParJoueur = reels.buts_par_joueur || {};
  const pronos = DATA.concours.pronostics || {};
  const participants = DATA.concours.participants;
  const revealed = isPronosRevealed();
  const cards = Object.keys(BONUS_LABELS).map(key => {
    const meta = BONUS_LABELS[key];
    let reelHtml;
    if (key==='meilleur_buteur') {
      const entries = Object.entries(butsParJoueur).sort((a,b)=>b[1]-a[1]).slice(0,5);
      reelHtml = entries.length===0 ? `<p class="bonus-card-reel pending">Aucun but enregistré pour les joueurs pronostiqués.</p>` : `<p class="bonus-card-reel">${entries.map(([j,b])=>`<strong>${escapeHtml(j)}</strong> : ${b} but${b>1?'s':''}`).join('<br>')}</p>`;
    } else {
      reelHtml = reels[key] ? `<p class="bonus-card-reel">Réponse : <strong>${escapeHtml(reels[key])}</strong></p>` : `<p class="bonus-card-reel pending">En attente que la situation se présente.</p>`;
    }
    let pronosHtml = '';
    if (revealed) {
      const lines = participants.filter(p=>pronos[p.slug]).map(p => {
        const v = pronos[p.slug].bonus[key]||'—';
        const matchOk = key==='meilleur_buteur' ? (butsParJoueur[v]||0)>0 : reels[key]&&v===reels[key];
        return `<div class="bonus-card-prono-line ${matchOk?'match-ok':''}"><span class="nom">${escapeHtml(p.nom)}</span><span class="val">${escapeHtml(v)}${matchOk?' ✓':''}</span></div>`;
      }).join('');
      pronosHtml = `<div class="bonus-card-pronos"><div class="bonus-card-pronos-title">Pronostics des participants</div>${lines}</div>`;
    } else {
      pronosHtml = `<div class="bonus-card-pronos"><div class="bonus-card-pronos-title">Pronostics</div><div class="bonus-card-prono-line"><span class="nom" style="font-style:italic">🔒 Révélés au coup d'envoi (11 juin 21h)</span></div></div>`;
    }
    return `<div class="bonus-card"><div class="bonus-card-title">${meta.icon} ${meta.label}</div>${reelHtml}${pronosHtml}</div>`;
  }).join('');
  $('#bonus-container').innerHTML = `<div class="bonus-cards">${cards}</div>`;
}

/* ============================================================================
   PHASE FINALE — BRACKET
   ============================================================================ */

const REVEAL_BRACKET_KEY = 'reveal_bracket_at';

function isBracketRevealed() {
  const at = DATA.meta[REVEAL_BRACKET_KEY];
  if (!at) return true;
  return new Date() >= new Date(at);
}

// Ensembles réels par tour (noms normalisés) + état du tournoi
function bracketRealSets() {
  const b = DATA.concours.bracket;
  const reel = b && b.reel;
  const S = (name) => new Set(((reel && reel[name]) || []).filter(Boolean).map(stripDrapeau));
  const huit = S('huitiemes'), quarts = S('quarts'), demis = S('demis'), fin = S('finalistes');
  const champion = reel && reel.champion ? stripDrapeau(reel.champion) : null;
  const troisieme = reel && reel.troisieme ? stripDrapeau(reel.troisieme) : null;
  const aliveArr = (reel && reel.alive ? reel.alive : []).map(stripDrapeau);
  const aliveSet = aliveArr.length ? new Set(aliveArr) : null; // null => personne d'éliminé connu
  return { huit, quarts, demis, fin, champion, troisieme, aliveSet,
           started: huit.size > 0, tournamentOver: !!champion };
}

// Construit les tours d'une moitié (gauche ou droite) du bracket miroir.
// Chaque match = { a, b, w } (équipe haute, basse, vainqueur prédit).
function bkmHalfRounds(b, side) {
  const r32 = b.r32 || [], huit = b.huitiemes || [], quarts = b.quarts || [],
        demis = b.demis || [], fin = b.finalistes || [];
  const mk = (entrants, winners) => {
    const out = [];
    for (let m = 0; m < Math.floor(entrants.length / 2); m++)
      out.push({ a: entrants[2 * m], b: entrants[2 * m + 1], w: winners[m] });
    return out;
  };
  if (side === 'left') {
    return [
      { label: '16<sup>es</sup>', pts: 2, set: 'huit',   matches: mk(r32.slice(0, 16), huit.slice(0, 8)) },
      { label: '8<sup>es</sup>',  pts: 3, set: 'quarts', matches: mk(huit.slice(0, 8), quarts.slice(0, 4)) },
      { label: 'Quarts',          pts: 4, set: 'demis',  matches: mk(quarts.slice(0, 4), demis.slice(0, 2)) },
      { label: 'Demi',            pts: 5, set: 'fin',    matches: mk(demis.slice(0, 2), [fin[0]]) },
    ];
  }
  // côté droit : ordre DOM du centre vers l'extérieur
  return [
    { label: 'Demi',            pts: 5, set: 'fin',    matches: mk(demis.slice(2), [fin[1]]) },
    { label: 'Quarts',          pts: 4, set: 'demis',  matches: mk(quarts.slice(4), demis.slice(2)) },
    { label: '8<sup>es</sup>',  pts: 3, set: 'quarts', matches: mk(huit.slice(8), quarts.slice(4)) },
    { label: '16<sup>es</sup>', pts: 2, set: 'huit',   matches: mk(r32.slice(16), huit.slice(8)) },
  ];
}

function roundRealInfo(round, sets) {
  switch (round.set) {
    case 'huit':   return { set: sets.huit,   decided: sets.huit.size > 0 };
    case 'quarts': return { set: sets.quarts, decided: sets.quarts.size > 0 };
    case 'demis':  return { set: sets.demis,  decided: sets.demis.size > 0 };
    case 'fin':    return { set: sets.fin,    decided: sets.fin.size > 0 };
    case 'champion': return { set: sets.champion ? new Set([sets.champion]) : new Set(),
                              decided: sets.champion != null };
  }
  return { set: new Set(), decided: false };
}

// Classe CSS d'un pronostic comparé à la réalité
function classifyPick(team, realSet, decided, sets) {
  const t = team ? stripDrapeau(team) : '';
  if (!t) return '';
  if (decided) return realSet.has(t) ? 'pick-ok' : 'pick-ko';
  if (sets.tournamentOver) return 'pick-ko';
  if (sets.aliveSet === null) return 'pick-pending';
  return sets.aliveSet.has(t) ? 'pick-pending' : 'pick-ko';
}

function bkTeamChip(name, cls) {
  if (!name) return `<span class="bk-team empty ${cls || ''}">—</span>`;
  return `<span class="bk-team ${cls || ''}">${escapeHtml(name)}</span>`;
}

function bkmMatch(mt, round, opts) {
  const sets = opts.sets;
  const aT = mt.a ? stripDrapeau(mt.a) : null, bT = mt.b ? stripDrapeau(mt.b) : null;
  const wT = mt.w ? stripDrapeau(mt.w) : null;
  let aCls = '', bCls = '';
  if (opts.mode === 'real') {
    if (wT) {
      if (aT === wT) { aCls = 'advanced'; bCls = 'eliminated'; }
      else if (bT === wT) { bCls = 'advanced'; aCls = 'eliminated'; }
    }
  } else {
    const ri = roundRealInfo(round, sets);
    const wcls = opts.compare ? classifyPick(mt.w, ri.set, ri.decided, sets) : 'advanced-neutral';
    if (aT && wT && aT === wT) { aCls = wcls; bCls = 'muted'; }
    else if (bT && wT && bT === wT) { bCls = wcls; aCls = 'muted'; }
  }
  return `<div class="bkm-match"><div class="bkm-pair">${bkTeamChip(mt.a, aCls)}${bkTeamChip(mt.b, bCls)}</div></div>`;
}

function bkmRoundCol(round, opts) {
  const matches = round.matches.map(mt => bkmMatch(mt, round, opts)).join('');
  return `<div class="bkm-round">
    <div class="bkm-rlabel">${round.label}<span class="bkm-rpts">+${round.pts}</span></div>
    <div class="bkm-matches">${matches}</div>
  </div>`;
}

function bkmCenter(b, opts) {
  const sets = opts.sets;
  let champCls, troCls;
  if (opts.mode === 'real') {
    champCls = b.champion ? 'advanced' : '';
    troCls = b.troisieme ? 'advanced' : '';
  } else if (opts.compare) {
    champCls = classifyPick(b.champion, sets.champion ? new Set([sets.champion]) : new Set(), sets.champion != null, sets);
    troCls = classifyPick(b.troisieme, sets.troisieme ? new Set([sets.troisieme]) : new Set(), sets.troisieme != null, sets);
  } else { champCls = 'advanced-neutral'; troCls = 'advanced-neutral'; }
  return `<div class="bkm-center">
    <div class="bkm-final-block">
      <div class="bkm-rlabel center">Finale<span class="bkm-rpts">+7</span></div>
      <div class="bkm-champion ${champCls}">🏆 ${b.champion ? escapeHtml(b.champion) : '—'}</div>
    </div>
    <div class="bkm-third-block">
      <div class="bkm-rlabel center small">3<sup>e</sup> place<span class="bkm-rpts">+6</span></div>
      <div class="bkm-third ${troCls}">🥉 ${b.troisieme ? escapeHtml(b.troisieme) : '—'}</div>
    </div>
  </div>`;
}

function renderBracketTree(b, opts) {
  const left = bkmHalfRounds(b, 'left').map(r => bkmRoundCol(r, opts)).join('');
  const right = bkmHalfRounds(b, 'right').map(r => bkmRoundCol(r, opts)).join('');
  return `<div class="bkm">
    <div class="bkm-half left">${left}</div>
    ${bkmCenter(b, opts)}
    <div class="bkm-half right">${right}</div>
  </div>`;
}

function updateBracketCountdown() {
  const at = DATA.meta[REVEAL_BRACKET_KEY];
  const el = $('#bracket-countdown');
  if (!at || !el) return;
  const diff = new Date(at) - new Date();
  if (diff <= 0) { el.textContent = 'Révélation imminente — recharge la page. ⚽'; return; }
  const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000);
  el.textContent = `Révélation dans ${h}h${String(m).padStart(2, '0')}. ⚽`;
}

function renderBracketCourse() {
  const rows = DATA.concours.participants.map(p => {
    const gain = Math.max(0, (p.phase_finale_max || 0) - (p.phase_finale || 0));
    return { nom: p.nom, current: p.total, gain, ceiling: p.total + gain };
  });
  const maxCeil = Math.max(...rows.map(r => r.ceiling), 1);
  const leader = Math.max(...rows.map(r => r.current));
  const leaderPct = (leader / maxCeil) * 100;
  const bars = rows.map((r, i) => {
    const curPct = (r.current / maxCeil) * 100;
    const gainPct = (r.gain / maxCeil) * 100;
    const enPiste = r.ceiling >= leader;
    return `<div class="course-row ${enPiste ? 'en-piste' : 'out'}">
      <div class="course-nom">${i + 1}. ${escapeHtml(r.nom)}</div>
      <div class="course-bar-wrap">
        <div class="course-bar-solid" style="width:${curPct}%"></div>
        <div class="course-bar-ghost" style="width:${gainPct}%"></div>
      </div>
      <div class="course-val"><span class="cur">${r.current}</span><span class="course-ceil">max ${r.ceiling}</span></div>
    </div>`;
  }).join('');
  $('#bracket-course-container').innerHTML = `<div class="course" style="--leaderpct:${leaderPct.toFixed(2)}%">${bars}</div>`;
}

function renderBracketParticipantSummary(slug, b) {
  $('#bracket-participant-summary').innerHTML = `<div class="bk-summary">
    <span class="bk-sum-item"><span class="bk-sum-label">Points phase finale</span><span class="bk-sum-val">${b.points || 0}</span></span>
    <span class="bk-sum-item"><span class="bk-sum-label">Plafond atteignable</span><span class="bk-sum-val">${b.points_max || 0}</span></span>
    <span class="bk-sum-item"><span class="bk-sum-label">Champion pronostiqué</span><span class="bk-sum-val">${b.champion ? escapeHtml(b.champion) : '—'}</span></span>
  </div>`;
}

function setupBracketParticipant(sets) {
  const sel = $('#select-bracket-participant');
  const compareEl = $('#toggle-bracket-compare');
  const pronos = (DATA.concours.bracket && DATA.concours.bracket.pronostics) || {};
  const parts = DATA.concours.participants.filter(p => pronos[p.slug]);
  if (parts.length === 0) {
    sel.innerHTML = '';
    $('#bracket-participant-summary').innerHTML = '';
    $('#bracket-participant-container').innerHTML = `<p class="bracket-empty">Aucun bracket reçu pour l'instant.</p>`;
    return;
  }
  sel.innerHTML = parts.map(p => `<option value="${escapeHtml(p.slug)}">${escapeHtml(p.nom)}</option>`).join('');
  function render() {
    const b = pronos[sel.value];
    if (!b) return;
    renderBracketParticipantSummary(sel.value, b);
    $('#bracket-participant-container').innerHTML = renderBracketTree(b, { mode: 'prono', compare: compareEl.checked, sets });
  }
  sel.onchange = render;
  compareEl.onchange = render;
  render();
}

function renderBracket() {
  const b = DATA.concours.bracket;
  const reelContainer = $('#bracket-reel-container');
  const hint = $('#bracket-reel-hint');
  const locked = $('#bracket-locked');
  const revealed = $('#bracket-revealed');
  if (!b) {
    reelContainer.innerHTML = `<p class="bracket-empty">La phase à élimination directe n'a pas encore commencé. Le bracket réel se remplira au fil des matchs.</p>`;
    if (hint) hint.textContent = '';
    locked.hidden = true; revealed.hidden = true;
    return;
  }
  const sets = bracketRealSets();
  reelContainer.innerHTML = b.reel
    ? renderBracketTree(b.reel, { mode: 'real', sets })
    : `<p class="bracket-empty">Bracket réel non disponible.</p>`;
  if (hint) {
    hint.textContent = sets.tournamentOver
      ? 'Tournoi terminé.'
      : (sets.started
          ? "Les équipes qualifiées s'allument au fil des tours ; les éliminées se grisent."
          : 'En attente du coup d’envoi des 16es — les 32 équipes sont en lice.');
  }
  if (!isBracketRevealed()) {
    locked.hidden = false; revealed.hidden = true;
    updateBracketCountdown();
    return;
  }
  locked.hidden = true; revealed.hidden = false;
  renderBracketCourse();
  setupBracketParticipant(sets);
}

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

const BUBBLE_DISPLAY_MS   = 5000;
const BUBBLE_MIN_DELAY_MS = 45000;
const BUBBLE_MAX_DELAY_MS = 90000;
let bubbleTimer = null;
let nextBubbleTimer = null;
let bubbleShownOnce = false;

function _pickRandom(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

function _resolveDynamic(text) {
  if (!DATA||!DATA.concours||!DATA.concours.participants) return text;
  const parts = DATA.concours.participants;
  if (parts.length===0) return text;
  return text.replace('{premier}',parts[0].nom).replace('{dernier}',parts[parts.length-1].nom);
}

function _buildPool(tab) {
  const contextual = DJDITCH_REPLIQUES[tab]||[];
  const pool = [...contextual];
  for (let i=0;i<2;i++) pool.push(_pickRandom(DJDITCH_REPLIQUES.generiques));
  return pool;
}

function showBubble(text) {
  const header = document.getElementById('djditch-header');
  const bubble = document.getElementById('djditch-bubble');
  const span = document.getElementById('djditch-bubble-text');
  if (!header||!bubble||!span) return;
  if (bubbleTimer) { clearTimeout(bubbleTimer); bubbleTimer=null; }
  span.textContent = _resolveDynamic(text);
  bubble.classList.remove('bubble-in','bubble-out');
  bubble.hidden = false;
  void bubble.offsetWidth;
  bubble.classList.add('bubble-in');
  header.classList.add('speaking');
  setTimeout(()=>header.classList.remove('speaking'),400);
  bubbleTimer = setTimeout(()=>{
    bubble.classList.remove('bubble-in');
    bubble.classList.add('bubble-out');
    bubble.addEventListener('animationend',()=>{bubble.hidden=true;bubble.classList.remove('bubble-out');},{once:true});
    bubbleTimer=null;
  },BUBBLE_DISPLAY_MS);
}

function scheduleNextBubble() {
  if (nextBubbleTimer) clearTimeout(nextBubbleTimer);
  const delay = BUBBLE_MIN_DELAY_MS + Math.random()*(BUBBLE_MAX_DELAY_MS-BUBBLE_MIN_DELAY_MS);
  nextBubbleTimer = setTimeout(()=>{ showBubble(_pickRandom(_buildPool(CURRENT_TAB))); scheduleNextBubble(); },delay);
}

function initDjDitchHeader() {
  setTimeout(()=>{ showBubble(_pickRandom(DJDITCH_REPLIQUES.connexion)); bubbleShownOnce=true; scheduleNextBubble(); },1200);
  let inactivityTimer=null;
  function resetInactivity() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer=setTimeout(()=>showBubble(_pickRandom(DJDITCH_REPLIQUES.inactivite)),30000);
  }
  document.addEventListener('click',resetInactivity);
  document.addEventListener('keydown',resetInactivity);
  resetInactivity();
}

function djditchOnTabChange(tab) {
  if (!bubbleShownOnce) return;
  if (Math.random()<0.5) { showBubble(_pickRandom(_buildPool(tab))); scheduleNextBubble(); }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!isAuthed()) { setupLogin(); } else { showSplash(); init().then(()=>initDjDitchHeader()); }
});
