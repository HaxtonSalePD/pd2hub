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

// --- GIVEAWAY SUBMISSION ---
async function handleGiveawaySubmit(event) {
    event.preventDefault();

    const savedUser = JSON.parse(localStorage.getItem('steam_user'));
    if (!savedUser) {
        showToast('Please sign in with Steam first to enter.');
        return;
    }

    const tradeLink = document.getElementById('tradelink').value;
    const backendUrl = 'https://pd2hub-backend.onrender.com';

    try {
        const response = await fetch(`${backendUrl}/api/giveaway/enter`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                steamId: savedUser.steamId,
                username: savedUser.username,
                tradeLink: tradeLink
            })
        });

        const data = await response.json();

        if (response.ok) {
            showToast(data.message || 'Entry received! Good luck.');
            document.getElementById('tradelink').value = '';
        } else {
            showToast(data.error || 'Failed to submit entry.');
        }
    } catch (err) {
        console.error(err);
        showToast('Error connecting to backend server.');
    }
}

// --- PICK GIVEAWAY WINNER (ADMIN/HOST) ---
async function pickGiveawayWinner() {
    const backendUrl = 'https://pd2hub-backend.onrender.com';
    try {
        const response = await fetch(`${backendUrl}/api/giveaway/winner`);
        const data = await response.json();
        const display = document.getElementById('winnerDisplay');

        if (response.ok && display) {
            display.style.display = 'block';
            display.innerHTML = `🎉 <strong>Winner:</strong> ${escapeHTML(data.winner.username)} (<a href="${escapeHTML(data.winner.tradeLink)}" target="_blank" style="color:var(--accent-blue);">Trade Link</a>)`;
        } else {
            showToast(data.error || 'Failed to pick winner.');
        }
    } catch (err) {
        console.error(err);
        showToast('Failed to select winner.');
    }
}

// --- MARKETPLACE & INVENTORY SYSTEM ---
const BACKEND_URL = 'https://pd2hub-backend.onrender.com';

async function fetchUserInventory() {
    const savedUser = JSON.parse(localStorage.getItem('steam_user'));
    const grid = document.getElementById('inventoryGrid');
    if (!grid) return;

    if (!savedUser) {
        grid.innerHTML = '<p style="color:var(--text-muted); grid-column:1/-1;">Please sign in with Steam above to load your Payday 2 inventory.</p>';
        return;
    }

    grid.innerHTML = '<p style="color:var(--text-muted); grid-column:1/-1;">Loading Payday 2 inventory from Steam...</p>';

    try {
        const res = await fetch(`${BACKEND_URL}/api/inventory/${savedUser.steamId}`);
        const data = await res.json();

        if (!res.ok || !data.items || data.items.length === 0) {
            grid.innerHTML = '<p style="color:var(--text-muted); grid-column:1/-1;">No tradable Payday 2 skins found or your inventory is set to private.</p>';
            return;
        }

        grid.innerHTML = data.items.map(item => `
            <div class="card" style="text-align: center; padding: 1rem;">
                <img src="${escapeHTML(item.iconUrl)}" alt="${escapeHTML(item.name)}" style="width: 100px; height: 100px; object-fit: contain; margin-bottom: 0.5rem;">
                <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">${escapeHTML(item.name)}</h4>
                <input type="number" step="0.01" min="0.01" placeholder="Price ($USD)" id="price-${item.assetId}" style="width: 100%; padding: 0.4rem; margin-bottom: 0.5rem; background: var(--input-bg); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 4px;">
                <button onclick="listSkinForSale('${item.assetId}', '${escapeHTML(item.name)}', '${escapeHTML(item.iconUrl)}')" class="btn" style="width: 100%; margin-top: 0;">List Skin</button>
            </div>
        `).join('');

    } catch (err) {
        console.error(err);
        grid.innerHTML = '<p style="color:var(--accent-red); grid-column:1/-1;">Failed to fetch inventory from server.</p>';
    }
}

async function listSkinForSale(assetId, itemName, iconUrl) {
    const savedUser = JSON.parse(localStorage.getItem('steam_user'));
    const priceInput = document.getElementById(`price-${assetId}`);
    const tradeLinkInput = document.getElementById('userTradeUrl');

    if (!savedUser) {
        showToast('Please sign in with Steam first.');
        return;
    }

    const price = priceInput ? priceInput.value : null;
    const tradeLink = tradeLinkInput ? tradeLinkInput.value : null;

    if (!price || parseFloat(price) <= 0) {
        showToast('Please enter a valid price greater than $0.00.');
        return;
    }

    if (!tradeLink) {
        showToast('Please enter your Steam Trade URL above.');
        return;
    }

    try {
        const res = await fetch(`${BACKEND_URL}/api/listings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                steamId: savedUser.steamId,
                username: savedUser.username,
                assetId,
                itemName,
                iconUrl,
                price,
                tradeLink
            })
        });

        const data = await res.json();
        if (res.ok) {
            showToast(data.message || 'Skin listed successfully!');
            fetchActiveListings();
        } else {
            showToast(data.error || 'Failed to list item.');
        }
    } catch (err) {
        console.error(err);
        showToast('Error sending listing request.');
    }
}

async function fetchActiveListings() {
    const grid = document.getElementById('marketListingsGrid');
    if (!grid) return;

    try {
        const res = await fetch(`${BACKEND_URL}/api/listings`);
        const data = await res.json();

        if (!data.listings || data.listings.length === 0) {
            grid.innerHTML = '<p style="color:var(--text-muted); grid-column:1/-1;">No skins are currently listed for sale.</p>';
            return;
        }

        grid.innerHTML = data.listings.map(item => `
            <div class="card" style="text-align: center; padding: 1rem;">
                <img src="${escapeHTML(item.iconUrl)}" alt="${escapeHTML(item.itemName)}" style="width: 100px; height: 100px; object-fit: contain; margin-bottom: 0.5rem;">
                <h4 style="font-size: 1rem; color: var(--accent-blue);">${escapeHTML(item.itemName)}</h4>
                <p style="font-size: 1.1rem; font-weight: bold; margin: 0.3rem 0;">$${escapeHTML(item.price)} USD</p>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.8rem;">Seller: ${escapeHTML(item.username)}</p>
                <a href="${escapeHTML(item.tradeLink)}" target="_blank" rel="noopener noreferrer" class="btn" style="display: block;">Send Trade Offer</a>
            </div>
        `).join('');

    } catch (err) {
        console.error(err);
        grid.innerHTML = '<p style="color:var(--accent-red); grid-column:1/-1;">Could not load active market listings.</p>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    processSteamQueryParams();
    initTheme();
    initNavToggle();
    renderSteamUserBadge();
    fetchUserInventory();
    fetchActiveListings();
});