const BACKEND_URL = 'https://pd2hub-backend.onrender.com';

// --- HELPER: HTML ESCAPING FOR XSS PROTECTION ---
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g,
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
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
        navToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }
}

// --- TOAST NOTIFICATIONS ---
function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
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

// After Steam login, the backend sends us back to page.html#token=...
function processSteamLogin() {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const token = hashParams.get('token');
    if (!token) return;

    try {
        const payload = decodeTokenPayload(token);
        const userObj = {
            token,
            steamId: payload.steamId,
            username: payload.username,
            avatar: payload.avatar,
            expiresAt: payload.exp * 1000
        };
        localStorage.setItem('steam_user', JSON.stringify(userObj));
    } catch (err) {
        console.error('Could not read login token', err);
    }
    window.history.replaceState({}, document.title, window.location.pathname);
}

// Returns the signed-in user, or null if not signed in or the login expired
function getSavedUser() {
    try {
        const user = JSON.parse(localStorage.getItem('steam_user'));
        if (user && user.token && user.expiresAt > Date.now()) return user;
    } catch {
        // Corrupt value, fall through and clear it
    }
    localStorage.removeItem('steam_user');
    return null;
}

// Points the "Sign in through Steam" button back to the current page after login
function initSteamLoginLink() {
    const steamAuthBtn = document.getElementById('steamAuthBtn');
    if (!steamAuthBtn) return;
    const page = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
    steamAuthBtn.href = `${BACKEND_URL}/auth/steam?returnTo=${encodeURIComponent(page)}`;
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
        const safeUsername = escapeHTML(savedUser.username);
        const safeAvatar = escapeHTML(savedUser.avatar);

        authContainer.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.6rem; background: rgba(0, 168, 255, 0.1); padding: 0.25rem 0.6rem; border-radius: 20px; border: 1px solid var(--accent-blue);">
                <img src="${safeAvatar}" width="26" height="26" style="border-radius: 50%; vertical-align: middle;" alt="Avatar">
                <span style="color: var(--accent-blue); font-weight: bold; font-size: 0.85rem;">${safeUsername}</span>
                <button onclick="logoutSteam()" style="background: transparent; border: none; color: var(--accent-red); cursor: pointer; font-weight: bold; font-size: 0.8rem; margin-left: 0.2rem;" title="Logout">✕</button>
            </div>
        `;
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
    }
    if (!response.ok) {
        throw new Error(data.error || 'Request failed.');
    }
    return data;
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
function markGiveawayEntered() {
    const tradeInput = document.getElementById('tradelink');
    if (!tradeInput) return;
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

// --- GIVEAWAY INFO (giveaway page only) ---
async function loadGiveawayInfo() {
    const prizeEl = document.getElementById('prizeName');
    if (!prizeEl) return;
    try {
        const data = await apiRequest('/api/giveaway');
        prizeEl.textContent = data.prizeName;
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

    try {
        const data = await apiRequest('/api/giveaway/enter', {
            method: 'POST',
            body: JSON.stringify({ tradeLink: tradeLinkInput.value.trim() })
        });
        showToast(data.message || 'Entry received! Good luck.');
        markGiveawayEntered();
        loadGiveawayInfo(); // refresh the "N heisters have entered" line
    } catch (err) {
        showToast(err.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    processSteamLogin();
    initTheme();
    initNavToggle();
    initSteamLoginLink();
    renderSteamUserBadge();
    loadGiveawayInfo();
    prefillTradeLink();
    renderAdminNavLink();
    renderGiveawayEntryState();

    // Wake the backend early: on the free plan it sleeps after ~15 minutes idle,
    // so this ping starts it while the visitor is still reading the page.
    fetch(`${BACKEND_URL}/`).catch(() => {});
});
