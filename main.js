const BACKEND_URL = 'https://pd2hub-backend.onrender.com';

// Only Steam's own avatar server is trusted as an image source for profile pictures
function isSteamAvatar(url) {
    return typeof url === 'string' && url.startsWith('https://avatars.steamstatic.com/');
}

// --- THEME MANAGEMENT ---
function initTheme() {
    const themeBtn = document.getElementById('themeToggleBtn');
    const currentTheme = localStorage.getItem('theme');

    if (currentTheme === 'light') {
        document.body.classList.add('light-theme');
        if (themeBtn) themeBtn.textContent = '🌙 Dark Mode';
    }

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            let theme = 'dark';
            if (document.body.classList.contains('light-theme')) {
                theme = 'light';
                themeBtn.textContent = '🌙 Dark Mode';
            } else {
                themeBtn.textContent = '☀️ Light Mode';
            }
            localStorage.setItem('theme', theme);
        });
    }
}

// --- NAVIGATION TOGGLE ---
function initNavToggle() {
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');

    if (navToggle && navLinks) {
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-controls', 'navLinks');
        navToggle.addEventListener('click', () => {
            const open = navLinks.classList.toggle('active');
            navToggle.setAttribute('aria-expanded', String(open));
        });
    }
}

// --- TOAST NOTIFICATIONS ---
let toastTimer = null;
function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// --- STEAM AUTHENTICATION ---

// Reads the middle part of the login token (the user info). Only the backend can verify it.
function decodeTokenPayload(token) {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
}

// A random value made before sign-in and checked after it. It lives only in this
// tab's sessionStorage, so a sign-in link crafted by someone else (to log a visitor
// into the attacker's account) can't contain it and is ignored.
const LOGIN_STATE_KEY = 'pd2_login_state';

function getLoginState() {
    let state = null;
    try { state = sessionStorage.getItem(LOGIN_STATE_KEY); } catch {}
    if (!state) {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        state = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
        try { sessionStorage.setItem(LOGIN_STATE_KEY, state); } catch {}
    }
    return state;
}

// After Steam login, the backend sends us back to page.html#token=...&state=...
function processSteamLogin() {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const token = hashParams.get('token');
    if (!token) return;
    // Never leave the token in the address bar, whatever happens next
    window.history.replaceState({}, document.title, window.location.pathname);

    let expected = null;
    try { expected = sessionStorage.getItem(LOGIN_STATE_KEY); } catch {}
    if (!expected || hashParams.get('state') !== expected) {
        showToast('That sign-in link did not start on this page, so it was ignored. Please use the Sign in button.');
        return;
    }
    try { sessionStorage.removeItem(LOGIN_STATE_KEY); } catch {}

    try {
        const payload = decodeTokenPayload(token);
        if (!/^\d{17}$/.test(String(payload.steamId)) || !payload.exp) throw new Error('Unexpected token contents');
        const userObj = {
            token,
            steamId: payload.steamId,
            username: String(payload.username || 'Steam user').slice(0, 64),
            avatar: isSteamAvatar(payload.avatar) ? payload.avatar : '',
            expiresAt: payload.exp * 1000
        };
        localStorage.setItem('steam_user', JSON.stringify(userObj));
    } catch (err) {
        console.error('Could not read login token', err);
    }
}

// Returns the signed-in user, or null if not signed in or the login expired
let loginExpired = false;
function getSavedUser() {
    let raw = null;
    try {
        raw = localStorage.getItem('steam_user');
        const user = JSON.parse(raw);
        if (user && user.token && user.expiresAt > Date.now()) return user;
    } catch {
        // Corrupt value, fall through and clear it
    }
    if (raw) loginExpired = true;
    localStorage.removeItem('steam_user');
    return null;
}

// Points the "Sign in through Steam" button back to the current page after login
function initSteamLoginLink() {
    const steamAuthBtn = document.getElementById('steamAuthBtn');
    if (!steamAuthBtn) return;
    const page = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
    steamAuthBtn.href = `${BACKEND_URL}/auth/steam?returnTo=${encodeURIComponent(page)}&state=${getLoginState()}`;
}

function renderSteamUserBadge() {
    const savedUser = getSavedUser();
    const authContainer = document.getElementById('navAuthContainer');
    const themeBtn = document.getElementById('themeToggleBtn');
    const usernameInput = document.getElementById('username');

    if (savedUser && usernameInput) {
        usernameInput.value = savedUser.username;
        usernameInput.readOnly = true;
    }

    if (savedUser && authContainer) {
        const badge = document.createElement('div');
        badge.style.cssText = 'display:flex;align-items:center;gap:0.6rem;background:rgba(255,194,26,0.1);padding:0.25rem 0.6rem;border-radius:20px;border:1px solid var(--accent-blue);';

        if (isSteamAvatar(savedUser.avatar)) {
            const img = document.createElement('img');
            img.src = savedUser.avatar;
            img.width = 26;
            img.height = 26;
            img.alt = '';
            img.style.cssText = 'border-radius:50%;vertical-align:middle;';
            badge.append(img);
        }

        const name = document.createElement('span');
        name.textContent = savedUser.username;
        name.style.cssText = 'color:var(--accent-blue);font-weight:bold;font-size:0.85rem;';
        badge.append(name);

        const logoutBtn = document.createElement('button');
        logoutBtn.type = 'button';
        logoutBtn.textContent = '✕';
        logoutBtn.title = 'Log out';
        logoutBtn.setAttribute('aria-label', 'Log out');
        logoutBtn.style.cssText = 'background:transparent;border:none;color:var(--accent-red);cursor:pointer;font-weight:bold;font-size:0.8rem;margin-left:0.2rem;';
        logoutBtn.addEventListener('click', logoutSteam);
        badge.append(logoutBtn);

        authContainer.replaceChildren(badge);
        if (themeBtn) authContainer.appendChild(themeBtn);
    }
}

function logoutSteam() {
    localStorage.removeItem('steam_user');
    window.location.reload();
}

// --- BACKEND REQUESTS ---

// Calls the backend with the login token attached. Throws an Error with the server's message on failure.
async function apiRequest(path, options = {}) {
    const user = getSavedUser();
    const headers = { ...(options.headers || {}) };
    if (options.body) headers['Content-Type'] = 'application/json';
    if (user) headers.Authorization = `Bearer ${user.token}`;

    let response;
    try {
        response = await fetch(`${BACKEND_URL}${path}`, { ...options, headers });
    } catch (err) {
        console.error(err);
        throw new Error('Error connecting to backend server.');
    }

    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
        localStorage.removeItem('steam_user');
        if (user || loginExpired) handleExpiredSession();
    }
    if (!response.ok) {
        throw new Error(data.error || 'Request failed.');
    }
    return data;
}

// The login ran out while the page was open: say so, then reload so the page
// shows the signed-out view (sign-in button back, owner-only buttons gone)
let sessionExpiryHandled = false;
function handleExpiredSession() {
    if (sessionExpiryHandled) return;
    sessionExpiryHandled = true;
    showToast('Your login expired — please sign in with Steam again.');
    setTimeout(() => window.location.reload(), 2500);
}

// --- SIGNED-IN USER DATA (fetched once per page, shared by several features) ---
let mePromise = null;
function loadMe() {
    if (!getSavedUser()) return Promise.resolve(null);
    if (!mePromise) {
        mePromise = apiRequest('/api/me').catch(() => null);
    }
    return mePromise;
}

// Steam never exposes the trade token through any API, so it must be pasted once.
// After that, the server remembers it and we fill it in automatically.
async function prefillTradeLink() {
    const input = document.getElementById('tradelink') || document.getElementById('sellerTradeLink');
    if (!input || input.value) return;
    const me = await loadMe();
    if (me?.tradeLink && !input.value) {
        input.value = me.tradeLink;
    }
}

// Admins get an extra nav link; everyone else never sees it
async function renderAdminNavLink() {
    const me = await loadMe();
    const navLinks = document.getElementById('navLinks');
    if (!me?.isAdmin || !navLinks || navLinks.querySelector('a[href="admin.html"]')) return;
    const a = document.createElement('a');
    a.href = 'admin.html';
    a.textContent = 'Admin';
    if (window.location.pathname.endsWith('admin.html')) a.className = 'active';
    navLinks.append(a);
}

// Giveaway page: show a friendly "you're in" state instead of letting the user
// discover via an error that they already entered
// No running giveaway: hide the prize details and close the form
function markGiveawayClosed() {
    const prizeEl = document.getElementById('prizeName');
    if (prizeEl) {
        prizeEl.textContent = 'No active giveaway right now';
        prizeEl.style.color = '';
    }
    const countEl = document.getElementById('giveawayEntryCount');
    if (countEl) countEl.style.display = 'none';
    const tradeInput = document.getElementById('tradelink');
    if (!tradeInput) return;
    tradeInput.disabled = true;
    tradeInput.closest('form').dataset.closed = '1';
    const btn = tradeInput.closest('form').querySelector('button[type="submit"]');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Check back soon!';
        btn.style.opacity = '0.75';
        btn.style.cursor = 'default';
    }
}

function markGiveawayEntered() {
    const tradeInput = document.getElementById('tradelink');
    if (!tradeInput) return;
    if (tradeInput.closest('form')?.dataset.closed === '1') return;
    const btn = tradeInput.closest('form')?.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = "You're in — good luck! 🍀";
    btn.style.opacity = '0.75';
    btn.style.cursor = 'default';
    tradeInput.disabled = true;
}

async function renderGiveawayEntryState() {
    if (!document.getElementById('tradelink') || document.getElementById('sellerTradeLink')) return;
    const me = await loadMe();
    if (me?.enteredGiveaway) markGiveawayEntered();
}

function centsToUsd(cents) {
    return '$' + (cents / 100).toFixed(2);
}

// --- GIVEAWAY INFO (giveaway page only) ---
let countdownTimer = null;
async function loadGiveawayInfo() {
    const prizeEl = document.getElementById('prizeName');
    if (!prizeEl) return;
    try {
        const data = await apiRequest('/api/giveaway');

        if (data.active === false) {
            markGiveawayClosed();
            return;
        }

        const imgEl = document.getElementById('prizeImage');
        const metaEl = document.getElementById('prizeMeta');
        const poolEl = document.getElementById('prizePool');

        if (Array.isArray(data.prizes) && data.prizes.length > 1 && poolEl) {
            // Several prizes: show the pool as a list
            const total = data.prizes.reduce((sum, p) => sum + (p.quantity || 1), 0);
            prizeEl.textContent = data.titleCustom ? data.prizeName : `Prize Pool — ${total} items`;
            poolEl.replaceChildren(...data.prizes.map(p => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;gap:0.8rem;padding:0.5rem 0;border-bottom:1px solid var(--border-color);';
                if (typeof p.image === 'string' && p.image.startsWith('https://community.cloudflare.steamstatic.com/economy/image/')) {
                    const img = document.createElement('img');
                    img.src = p.image;
                    img.alt = '';
                    img.loading = 'lazy';
                    img.style.cssText = 'width:72px;height:46px;object-fit:contain;flex-shrink:0;';
                    row.append(img);
                }
                const info = document.createElement('div');
                const name = document.createElement('div');
                name.textContent = p.quantity > 1 ? `${p.name} ×${p.quantity}` : p.name;
                name.style.fontWeight = '600';
                if (typeof p.color === 'string' && /^#[0-9a-f]{6}$/i.test(p.color)) name.style.color = p.color;
                info.append(name);
                const parts = [p.condition, p.rarity, p.statBoost ? 'Stat Boost' : null,
                    p.steamPriceCents > 0 ? `~${centsToUsd(p.steamPriceCents)} on Steam` : null].filter(Boolean);
                if (parts.length) {
                    const meta = document.createElement('div');
                    meta.textContent = parts.join(' · ');
                    meta.style.cssText = 'color:var(--text-muted);font-size:0.85rem;';
                    info.append(meta);
                }
                row.append(info);
                return row;
            }));
            const knownValue = data.prizes.reduce((sum, p) =>
                sum + (p.steamPriceCents > 0 ? p.steamPriceCents * (p.quantity || 1) : 0), 0);
            if (knownValue > 0) {
                const totalRow = document.createElement('div');
                totalRow.textContent = `Combined Steam value: ~${centsToUsd(knownValue)}`;
                totalRow.style.cssText = 'color:var(--accent-blue);font-weight:600;padding-top:0.6rem;';
                poolEl.append(totalRow);
            }
            poolEl.style.display = 'block';
        } else {
            // Single prize (or free text)
            prizeEl.textContent = data.prizeName;
            if (typeof data.prizeColor === 'string' && /^#[0-9a-f]{6}$/i.test(data.prizeColor)) {
                prizeEl.style.color = data.prizeColor;
            }
            if (imgEl && typeof data.prizeImage === 'string'
                && data.prizeImage.startsWith('https://community.cloudflare.steamstatic.com/economy/image/')) {
                imgEl.src = data.prizeImage;
                imgEl.style.display = 'block';
            }
            const singleSteam = data.prizes?.[0]?.steamPriceCents;
            const metaParts = [data.prizeCondition, data.prizeRarity, data.prizeStatBoost ? 'Stat Boost' : null,
                singleSteam > 0 ? `~${centsToUsd(singleSteam * (data.prizes[0].quantity || 1))} on Steam` : null].filter(Boolean);
            // Custom title over a single skin: keep the skin's own name visible too
            if (data.titleCustom && data.prizes?.[0]) {
                const p = data.prizes[0];
                metaParts.unshift(p.quantity > 1 ? `${p.name} ×${p.quantity}` : p.name);
            }
            if (metaEl && metaParts.length) {
                metaEl.textContent = metaParts.join(' · ');
                metaEl.style.display = 'block';
            }
        }
        const lastEl = document.getElementById('lastWinner');
        if (lastEl && data.lastWinner) {
            lastEl.replaceChildren();
            if (isSteamAvatar(data.lastWinner.avatar)) {
                const av = document.createElement('img');
                av.src = data.lastWinner.avatar;
                av.alt = '';
                av.width = 22;
                av.height = 22;
                av.style.cssText = 'border-radius:50%;vertical-align:middle;margin-right:0.4rem;';
                lastEl.append(av);
            }
            lastEl.append(`Last winner: ${data.lastWinner.username}`
                + (data.lastWinner.prize ? ` — won ${data.lastWinner.prize}` : '')
                + ` (${new Date(data.lastWinner.drawnAt).toLocaleDateString()})`);
            lastEl.style.display = 'block';
        }
        const endsEl = document.getElementById('giveawayEnds');
        if (endsEl && data.endsAt) {
            const renderCountdown = () => {
                const ms = new Date(data.endsAt).getTime() - Date.now();
                if (ms <= 0) {
                    endsEl.textContent = 'This round has ended — winner incoming!';
                    const tradeInput = document.getElementById('tradelink');
                    const btn = tradeInput?.closest('form')?.querySelector('button[type="submit"]');
                    if (tradeInput) tradeInput.disabled = true;
                    if (btn && !btn.disabled) {
                        btn.disabled = true;
                        btn.textContent = 'Round ended';
                        btn.style.opacity = '0.75';
                    }
                    return true;
                }
                const d = Math.floor(ms / 86400000);
                const h = Math.floor(ms / 3600000) % 24;
                const m = Math.floor(ms / 60000) % 60;
                endsEl.textContent = `⏳ Ends in ${d > 0 ? d + 'd ' : ''}${h}h ${m}m`;
                return false;
            };
            endsEl.style.display = 'block';
            clearInterval(countdownTimer);
            if (!renderCountdown()) {
                countdownTimer = setInterval(() => { if (renderCountdown()) clearInterval(countdownTimer); }, 60000);
            }
        }
        const countEl = document.getElementById('giveawayEntryCount');
        if (countEl) {
            countEl.textContent = data.totalEntries === 1
                ? '1 heister has entered so far.'
                : `${data.totalEntries} heisters have entered so far.`;
            countEl.style.display = 'block';
        }
    } catch {
        // Server still waking up — the static prize text stays visible
    }
}

// --- SUBMIT GIVEAWAY ENTRY ---
async function handleGiveawaySubmit(event) {
    event.preventDefault();

    if (!getSavedUser()) {
        showToast('Please sign in with Steam first to enter.');
        return;
    }

    const tradeLinkInput = document.getElementById('tradelink');
    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Entering…';
    let entered = false;

    try {
        const data = await apiRequest('/api/giveaway/enter', {
            method: 'POST',
            body: JSON.stringify({ tradeLink: tradeLinkInput.value.trim() })
        });
        entered = true;
        showToast(data.message || 'Entry received! Good luck.');
        markGiveawayEntered();
        loadGiveawayInfo(); // refresh the "N heisters have entered" line
    } catch (err) {
        showToast(err.message);
    } finally {
        if (!entered) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalLabel;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    processSteamLogin();
    initTheme();
    initNavToggle();
    initSteamLoginLink();
    renderSteamUserBadge();
    const giveawayForm = document.getElementById('giveawayForm');
    if (giveawayForm) giveawayForm.addEventListener('submit', handleGiveawaySubmit);
    loadGiveawayInfo();
    prefillTradeLink();
    renderAdminNavLink();
    renderGiveawayEntryState();

    // Wake the backend early: on the free plan it sleeps after ~15 minutes idle,
    // so this ping starts it while the visitor is still reading the page.
    fetch(`${BACKEND_URL}/`).catch(() => {});
});
