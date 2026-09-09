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
function processSteamQueryParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const querySteamId = urlParams.get('steamid');
    const queryUsername = urlParams.get('username');
    const queryAvatar = urlParams.get('avatar');

    if (querySteamId && queryUsername) {
        const userObj = { 
            steamId: querySteamId, 
            username: queryUsername, 
            avatar: queryAvatar 
        };
        localStorage.setItem('steam_user', JSON.stringify(userObj));
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

function renderSteamUserBadge() {
    const savedUser = JSON.parse(localStorage.getItem('steam_user'));
    const authContainer = document.getElementById('navAuthContainer');
    const themeBtn = document.getElementById('themeToggleBtn');
    const usernameInput = document.getElementById('username');

    if (savedUser && usernameInput) {
        usernameInput.value = savedUser.username;
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

document.addEventListener('DOMContentLoaded', () => {
    processSteamQueryParams();
    initTheme();
    initNavToggle();
    renderSteamUserBadge();
});