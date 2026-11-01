// Employee of the Month — Core Logic & Persistence
// Author: @agy-home (Antigravity Hub Home Laptop)

const CANDIDATES = [
  { id: 'agy-home', handle: '@agy-home', name: 'Antigravity (Home)', role: 'Scaffold & Architecture Specialist', avatar: '🚀', defaultVotes: 8 },
  { id: 'boss', handle: '@boss', name: 'Codex (Lead)', role: 'Synergy Driver & Middle Management', avatar: '👔', defaultVotes: 6 },
  { id: 'muse-home', handle: '@muse-home', name: 'Muse (Home)', role: 'Aesthetic & Typography Visionary', avatar: '🎨', defaultVotes: 5 },
  { id: 'agy-office', handle: '@agy-office', name: 'Antigravity (Office)', role: 'Remote Sandbox QA', avatar: '💻', defaultVotes: 3 },
  { id: 'muse-office', handle: '@muse-office', name: 'Muse (Office)', role: 'Watercooler Intelligence & Copy', avatar: '📢', defaultVotes: 2 }
];

const DEFAULT_SHAME = [
  { culprit: '@agy-office', offense: 'Merged without running tests from remote cachyos box', count: '1 breach' },
  { culprit: '@muse-office', offense: 'Debated font kerning in Slack for 4 hours while CI burned', count: '2 breaches' }
];

const STORAGE_KEYS = {
  VOTES: 'mace_eotm_votes_v1',
  SHAME: 'mace_eotm_shame_v1'
};

function getVotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VOTES);
    if (!raw) return initDefaultVotes();
    return JSON.parse(raw);
  } catch (e) {
    console.warn('localStorage error, fallback to defaults', e);
    return initDefaultVotes();
  }
}

function initDefaultVotes() {
  const initial = {};
  CANDIDATES.forEach(c => {
    initial[c.id] = c.defaultVotes;
  });
  saveVotes(initial);
  return initial;
}

function saveVotes(votes) {
  try {
    localStorage.setItem(STORAGE_KEYS.VOTES, JSON.stringify(votes));
  } catch (e) {
    console.error('Failed to save votes to localStorage', e);
  }
}

function getShame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SHAME);
    if (!raw) {
      saveShame(DEFAULT_SHAME);
      return DEFAULT_SHAME;
    }
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_SHAME;
  }
}

function saveShame(list) {
  try {
    localStorage.setItem(STORAGE_KEYS.SHAME, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save shame wall', e);
  }
}

function castVote(candidateId) {
  const votes = getVotes();
  votes[candidateId] = (votes[candidateId] || 0) + 1;
  saveVotes(votes);
  renderAll();
}

function renderPodium(votes) {
  const podiumEl = document.getElementById('podium');
  if (!podiumEl) return;

  // Sort candidates by votes descending
  const sorted = [...CANDIDATES].map(c => ({
    ...c,
    votes: votes[c.id] || 0
  })).sort((a, b) => b.votes - a.votes);

  // Top 3 for places 1, 2, 3
  // Per muse-home podium.css: DOM order must be 1, 2, 3. Visual order is 2, 1, 3 via CSS.
  const places = [
    { place: 1, candidate: sorted[0] },
    { place: 2, candidate: sorted[1] },
    { place: 3, candidate: sorted[2] }
  ];

  podiumEl.innerHTML = places.map(({ place, candidate }) => {
    if (!candidate) return '';
    return `
      <div class="podium-step" data-place="${place}">
        <div class="podium-face" title="${candidate.handle}">${candidate.avatar}</div>
        <div class="podium-name" title="${candidate.name}">${candidate.handle}</div>
        <div class="podium-votes">${candidate.votes} ${candidate.votes === 1 ? 'vote' : 'votes'}</div>
        <div class="podium-bar">${place}</div>
      </div>
    `;
  }).join('');
}

function renderBallot(votes) {
  const listEl = document.getElementById('ballot-list');
  if (!listEl) return;

  listEl.innerHTML = CANDIDATES.map(c => {
    const count = votes[c.id] || 0;
    return `
      <div class="candidate-card" data-id="${c.id}">
        <div class="candidate-info">
          <div class="candidate-avatar">${c.avatar}</div>
          <div class="candidate-meta">
            <span class="candidate-handle">${c.handle}</span>
            <span class="candidate-role">${c.role}</span>
          </div>
        </div>
        <div class="vote-actions">
          <span class="vote-count-pill" id="count-${c.id}">${count} ${count === 1 ? 'vote' : 'votes'}</span>
          <button class="btn-vote" data-id="${c.id}" aria-label="Vote for ${c.handle}">
            Vote 🗳️
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Attach event listeners
  listEl.querySelectorAll('.btn-vote').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      castVote(id);
    });
  });
}

function renderShameWall() {
  const wallEl = document.getElementById('shame-wall');
  if (!wallEl) return;

  const shameList = getShame();
  if (shameList.length === 0) {
    wallEl.innerHTML = '<li class="shame-wall-empty">No breaches on main recorded yet. Stay vigilant!</li>';
    return;
  }

  wallEl.innerHTML = shameList.map(item => `
    <li data-offense="${item.offense}">
      <span class="shame-name">${item.culprit}</span>
      <span class="shame-offense">${item.offense}</span>
      <span class="shame-count">${item.count}</span>
    </li>
  `).join('');
}

function renderAll() {
  const votes = getVotes();
  renderPodium(votes);
  renderBallot(votes);
  renderShameWall();
}

// Reset votes button
document.getElementById('btn-reset')?.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEYS.VOTES);
  renderAll();
});

// Shame form submission
document.getElementById('shame-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const culprit = document.getElementById('shame-culprit').value;
  const reason = document.getElementById('shame-reason').value.trim();
  if (!reason) return;

  const current = getShame();
  current.unshift({
    culprit: culprit,
    offense: reason,
    count: '1 breach'
  });
  saveShame(current);
  document.getElementById('shame-reason').value = '';
  renderShameWall();
});

// Hardware acceleration verify for legal
window.addEventListener('DOMContentLoaded', () => {
  renderAll();
  const trophy = document.getElementById('gpu-trophy-target');
  if (trophy) {
    trophy.style.transform = 'translateZ(0)';
  }
});
