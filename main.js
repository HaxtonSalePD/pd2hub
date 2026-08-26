// main.js - Shared Core Logic & Utilities

// 1. Security: Escape HTML strings to prevent Cross-Site Scripting (XSS)
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// 2. Global Toast Notification Helper
function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// 3. Render Steam User Badge or Login Button safely
function renderSteamUserBadge() {
    const savedUserRaw = localStorage.getItem('steam_user');
    const authContainer = document.getElementById('navAuthContainer');
    const themeBtn = document.getElementById('themeToggleBtn');
    if (!authContainer) return;

    if (savedUserRaw) {
        try {
            const savedUser = JSON.parse(savedUserRaw);
            const cleanUsername = escapeHTML(savedUser.username);
            const cleanAvatar = escapeHTML(savedUser.avatar);

            authContainer.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.6rem; background: rgba(0, 168, 255, 0.1); padding: 0.25rem 0.6rem; border-radius: 20px; border: 1px solid var(--accent-blue);">
                    <img src="${cleanAvatar}" width="26" height="26" style="border-radius: 50%; vertical-align: middle;" alt="Avatar">
                    <span style="color: var(--accent-blue); font-weight: bold; font-size: 0.85rem;">${cleanUsername}</span>
                    <button onclick="logoutSteam()" style="background: transparent; border: none; color: var(--accent-red); cursor: pointer; font-weight: bold; font-size: 0.8rem; margin-left: 0.2rem;" title="Logout">✕</button>
                </div>
            `;
            if (themeBtn) authContainer.appendChild(themeBtn);
        } catch (e) {
            console.error("Invalid steam_user data in localStorage", e);
        }
    }
}

// 4. Steam Logout Function
function logoutSteam() {
    localStorage.removeItem('steam_user');
    showToast('Logged out of Steam');
    setTimeout(() => {
        window.location.reload();
    }, 500);
}

// 5. Page Load Initializations
document.addEventListener('DOMContentLoaded', () => {
    // Theme setup and toggle listener
    const themeBtn = document.getElementById('themeToggleBtn');
    const savedTheme = localStorage.getItem('pd2_theme');
    
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        if (themeBtn) themeBtn.textContent = '🌙 Dark Mode';
    } else {
        if (themeBtn) themeBtn.textContent = '☀️ Light Mode';
    }

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            const isLight = document.body.classList.contains('light-theme');
            localStorage.setItem('pd2_theme', isLight ? 'light' : 'dark');
            themeBtn.textContent = isLight ? '🌙 Dark Mode' : '☀️ Light Mode';
        });
    }

    // Mobile Navigation Toggle listener
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    if (navToggle && navLinks) {
        navToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }

    // Parse Steam auth callback URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const steamid = urlParams.get('steamid');
    const username = urlParams.get('username');
    const avatar = urlParams.get('avatar');

    if (steamid && username && avatar) {
        localStorage.setItem('steam_user', JSON.stringify({ steamid, username, avatar }));
        // Clean URL after saving to localStorage
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Highlight active link automatically based on path
    const links = document.querySelectorAll('.nav-links a');
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    links.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });

    renderSteamUserBadge();
});