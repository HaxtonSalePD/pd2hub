// --- SKIN MARKET PAGE ---
// Uses getSavedUser, apiRequest and showToast from main.js

const RARITY_CLASSES = {
    Common: 'common',
    Uncommon: 'uncommon',
    Rare: 'rare',
    Epic: 'epic',
    Legendary: 'legendary'
};

let searchTimer;
let latestRequestId = 0;

function timeAgo(iso) {
    const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
    if (seconds < 60) return 'just now';
    const minutes = seconds / 60, hours = minutes / 60, days = hours / 24;
    if (minutes < 60) return `${Math.floor(minutes)} min ago`;
    if (hours < 24) return `${Math.floor(hours)} h ago`;
    if (days < 30) return `${Math.floor(days)} day${Math.floor(days) < 2 ? '' : 's'} ago`;
    return new Date(iso).toLocaleDateString();
}

function formatPrice(priceCents) {
    return (priceCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// Small helper so user text is always set with textContent (never innerHTML)
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function createListingCard(listing, currentUser) {
    const rarityClass = RARITY_CLASSES[listing.rarity] || 'common';
    const card = el('div', `card listing-card rarity-${rarityClass}`);

    // Steam's official color for this exact item wins over the generic rarity palette
    if (typeof listing.rarityColor === 'string' && /^#[0-9a-f]{6}$/i.test(listing.rarityColor)) {
        card.style.setProperty('--rarity-color', listing.rarityColor);
    }

    // The item's own Steam icon, when the listing was verified against the inventory
    if (typeof listing.imageUrl === 'string'
        && listing.imageUrl.startsWith('https://community.cloudflare.steamstatic.com/economy/image/')) {
        const img = el('img', 'listing-img');
        img.src = listing.imageUrl;
        img.alt = '';
        img.loading = 'lazy';
        card.append(img);
    }

    const tags = el('div', 'listing-tags');
    if (listing.rarity) {
        tags.append(el('span', 'card-tag rarity-tag', listing.rarity));
    }
    if (listing.condition) {
        tags.append(el('span', 'card-tag condition-tag', listing.condition));
    }
    if (listing.statBoost) {
        tags.append(el('span', 'card-tag condition-tag', 'Stat Boost'));
    }
    if (listing.verified) {
        tags.append(el('span', 'card-tag verified-tag', '✓ Verified'));
    }
    if (currentUser && currentUser.steamId === listing.sellerSteamId) {
        tags.append(el('span', 'card-tag mine-tag', 'Your listing'));
    }

    card.append(
        tags,
        el('h3', null, listing.itemName),
        el('p', 'listing-price', formatPrice(listing.priceCents)),
        el('p', 'listing-price-label', 'Wants skins worth about this much')
    );

    if (listing.note) {
        card.append(el('p', 'listing-note', listing.note));
    }

    const seller = el('a', 'listing-seller');
    seller.href = `https://steamcommunity.com/profiles/${encodeURIComponent(listing.sellerSteamId)}`;
    seller.target = '_blank';
    seller.rel = 'noopener noreferrer';
    seller.title = 'View seller\'s Steam profile';
    if (listing.sellerAvatar) {
        const avatar = el('img');
        avatar.src = listing.sellerAvatar;
        avatar.alt = '';
        avatar.width = 24;
        avatar.height = 24;
        seller.append(avatar);
    }
    seller.append(el('span', null, listing.sellerName));

    const listedDate = el('span', 'listing-date', `Listed ${timeAgo(listing.createdAt)}`);
    card.append(seller, listedDate);

    const actions = el('div', 'listing-actions');
    if (currentUser && currentUser.steamId === listing.sellerSteamId) {
        const removeBtn = el('button', 'btn-remove', 'Remove Listing');
        removeBtn.type = 'button';
        removeBtn.addEventListener('click', () => removeListing(listing.id));
        actions.append(removeBtn);
    } else {
        if (listing.tradeLink && listing.tradeLink.startsWith('https://steamcommunity.com/tradeoffer/new/')) {
            const tradeBtn = el('a', 'btn-trade-offer', 'Send Trade Offer');
            tradeBtn.href = listing.tradeLink;
            tradeBtn.target = '_blank';
            tradeBtn.rel = 'noopener noreferrer';
            actions.append(tradeBtn);
        }
        const reportBtn = el('button', 'btn-report', '⚠ Report this listing');
        reportBtn.type = 'button';
        reportBtn.addEventListener('click', () => reportListing(listing.id));
        actions.append(reportBtn);
    }
    card.append(actions);

    return card;
}

async function loadListings() {
    const grid = document.getElementById('listingsGrid');
    const status = document.getElementById('listingsStatus');
    const params = new URLSearchParams({
        search: document.getElementById('searchInput').value.trim(),
        sort: document.getElementById('sortSelect').value
    });

    // Ignore older responses if the user keeps typing
    const requestId = ++latestRequestId;
    status.textContent = 'Opening the vault… (the free server wakes from its nap in under a minute)';

    try {
        const listings = await apiRequest(`/api/listings?${params}`);
        if (requestId !== latestRequestId) return;

        const currentUser = getSavedUser();
        grid.replaceChildren(...listings.map(listing => createListingCard(listing, currentUser)));
        status.textContent = listings.length === 0
            ? (params.get('search')
                ? 'No listings match your search.'
                : 'The table’s empty — sign in and be the first to put loot on it.')
            : `${listings.length} listing${listings.length === 1 ? '' : 's'}`;
    } catch (err) {
        if (requestId !== latestRequestId) return;
        status.textContent = err.message;
    }
}

async function handleListingSubmit(event) {
    event.preventDefault();

    if (!getSavedUser()) {
        showToast('Please sign in with Steam first to list a skin.');
        return;
    }

    if (!selectedInvItem) {
        showToast('Pick a skin from your inventory first.');
        return;
    }

    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
        const data = await apiRequest('/api/listings', {
            method: 'POST',
            body: JSON.stringify({
                itemName: selectedInvItem.name,
                price: document.getElementById('itemPrice').value,
                note: document.getElementById('itemNote').value,
                tradeLink: document.getElementById('sellerTradeLink').value.trim()
            })
        });
        showToast(data.message || 'Your skin is now listed!');

        // Clear the selection so the next listing is a conscious pick; the trade link stays
        selectedInvItem = null;
        document.querySelectorAll('.inv-tile.selected').forEach(t => t.classList.remove('selected'));
        document.getElementById('selectedItemBox').style.display = 'none';
        ['itemPrice', 'itemNote'].forEach(id => {
            document.getElementById(id).value = '';
        });
        document.getElementById('noteCounter').textContent = '0/140';
        myListingsLoaded = false;
        loadListings();
    } catch (err) {
        showToast(err.message);
    } finally {
        submitBtn.disabled = false;
    }
}

async function reportListing(listingId) {
    if (!getSavedUser()) {
        showToast('Please sign in with Steam first to report a listing.');
        return;
    }
    const reason = prompt('Why are you reporting this listing? (optional)');
    if (reason === null) return; // cancelled

    try {
        const data = await apiRequest(`/api/listings/${encodeURIComponent(listingId)}/report`, {
            method: 'POST',
            body: JSON.stringify({ reason: reason.trim().slice(0, 140) })
        });
        showToast(data.message || 'Report received.');
    } catch (err) {
        showToast(err.message);
    }
}

// --- STEAM INVENTORY GRID ---
let selectedInvItem = null;

let invItems = [];

function renderInventoryGrid(items) {
    invItems = items;
    const filterInput = document.getElementById('invFilter');
    if (filterInput) {
        filterInput.style.display = items.length > 8 ? 'block' : 'none';
    }
    drawInventoryTiles(items);
}

function drawInventoryTiles(items) {
    const grid = document.getElementById('inventoryGrid');
    grid.replaceChildren(...items.map(item => {
        const tile = el('div', 'inv-tile');
        tile.setAttribute('role', 'option');
        tile.tabIndex = 0;

        if (item.image) {
            const img = el('img');
            img.src = item.image;
            img.alt = '';
            img.loading = 'lazy';
            tile.append(img);
        }
        const name = el('div', 'inv-name', item.name);
        if (item.color && /^#[0-9a-f]{6}$/i.test(item.color)) name.style.color = item.color;
        tile.append(name);

        const metaParts = [item.condition, item.rarity, item.statBoost ? 'Stat Boost' : null, item.count > 1 ? `×${item.count}` : null].filter(Boolean);
        if (metaParts.length) tile.append(el('div', 'inv-meta', metaParts.join(' · ')));

        const choose = () => selectInvItem(item, tile);
        tile.addEventListener('click', choose);
        tile.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
        return tile;
    }));
    grid.style.display = 'grid';
}

function onInvFilter() {
    const term = document.getElementById('invFilter').value.trim().toLowerCase();
    drawInventoryTiles(term ? invItems.filter(i => i.name.toLowerCase().includes(term)) : invItems);
}

function selectInvItem(item, tile) {
    selectedInvItem = item;
    document.querySelectorAll('.inv-tile.selected').forEach(t => t.classList.remove('selected'));
    tile.classList.add('selected');

    const panel = document.getElementById('selectedItemPanel');
    panel.replaceChildren();
    if (item.image) {
        const img = el('img');
        img.src = item.image;
        img.alt = '';
        panel.append(img);
    }
    const info = el('div');
    const name = el('div', 'inv-name', item.name);
    name.style.fontSize = '1rem';
    if (item.color && /^#[0-9a-f]{6}$/i.test(item.color)) name.style.color = item.color;
    info.append(name);
    const metaParts = [item.condition, item.rarity].filter(Boolean);
    if (metaParts.length) info.append(el('div', 'inv-meta', metaParts.join(' · ')));
    panel.append(info);
    document.getElementById('selectedItemBox').style.display = 'block';
}

let inventoryLoaded = false;

async function importInventory() {
    if (!getSavedUser()) {
        showToast('Please sign in with Steam first to see your skins.');
        return;
    }
    // Right after a deploy, the browser can hold an older copy of the page than of
    // this script. Bail out with a hint instead of crashing on a missing container.
    if (!document.getElementById('inventoryGrid') || !document.getElementById('selectedItemPanel')) {
        showToast('The site just updated — please refresh the page (Ctrl+F5) and try again.');
        return;
    }
    const hint = document.getElementById('importHint');
    hint.textContent = 'Opening your stash… (this can take a few seconds)';

    try {
        const data = await apiRequest('/api/inventory');
        if (data.items.length === 0) {
            hint.textContent = 'No tradable PAYDAY 2 items found in your inventory.';
            return;
        }
        renderInventoryGrid(data.items);
        inventoryLoaded = true;
        hint.textContent = `${data.items.length} items — click one to select it. Name, condition and rarity are locked to Steam’s data.`;
    } catch (err) {
        hint.textContent = 'Could not load your inventory — make sure it is set to public, then try again.';
        showToast(err.message);
    }
}

// The toggle decides whether the user's skins are loaded and shown at all.
// The choice is remembered on this device.
function onSkinsToggle() {
    const toggle = document.getElementById('showSkinsToggle');
    if (toggle.checked && !getSavedUser()) {
        toggle.checked = false;
        showToast('Please sign in with Steam first to see your skins.');
        return;
    }
    try { localStorage.setItem('pd2_show_skins', toggle.checked ? '1' : '0'); } catch {}
    if (toggle.checked) {
        importInventory();
    } else {
        document.getElementById('inventoryGrid').style.display = 'none';
        document.getElementById('importHint').textContent = 'Turn the toggle on to load your skins from Steam.';
    }
}

// --- MARKET TABS ---
const TAB_SECTIONS = { browse: 'listings', sell: 'sell', mine: 'mylistings' };
let myListingsLoaded = false;

function initialTab() {
    const fromHash = window.location.hash.replace('#', '');
    if (TAB_SECTIONS[fromHash]) return fromHash;
    try {
        const saved = localStorage.getItem('pd2_market_tab');
        if (TAB_SECTIONS[saved]) return saved;
    } catch {}
    return 'browse';
}

function switchTab(tab) {
    for (const [key, sectionId] of Object.entries(TAB_SECTIONS)) {
        document.getElementById(sectionId).hidden = key !== tab;
        document.querySelector(`.market-tab[data-tab="${key}"]`).classList.toggle('active', key === tab);
    }
    try { localStorage.setItem('pd2_market_tab', tab); } catch {}
    history.replaceState(null, '', tab === 'browse' ? window.location.pathname : `#${tab}`);
    if (tab === 'sell' && document.getElementById('showSkinsToggle').checked && !inventoryLoaded) {
        importInventory();
    }
    if (tab === 'mine' && !myListingsLoaded) {
        loadMyListings();
    }
}

async function loadMyListings() {
    const grid = document.getElementById('myListingsGrid');
    const status = document.getElementById('myListingsStatus');
    const currentUser = getSavedUser();
    if (!currentUser) {
        status.textContent = 'Sign in with Steam to see your listings.';
        grid.replaceChildren();
        return;
    }
    status.textContent = 'Fetching your listings…';
    try {
        const listings = await apiRequest('/api/listings/mine');
        grid.replaceChildren(...listings.map(l => createListingCard(l, currentUser)));
        myListingsLoaded = true;
        status.textContent = listings.length === 0
            ? 'You have nothing listed right now.'
            : `${listings.length} active listing${listings.length === 1 ? '' : 's'}`;
    } catch (err) {
        status.textContent = err.message;
    }
}

function initNoteCounter() {
    const note = document.getElementById('itemNote');
    const counter = document.getElementById('noteCounter');
    if (!note || !counter) return;
    const update = () => { counter.textContent = `${note.value.length}/140`; };
    note.addEventListener('input', update);
    update();
}

async function removeListing(listingId) {
    if (!confirm('Remove this listing?')) return;

    try {
        const data = await apiRequest(`/api/listings/${encodeURIComponent(listingId)}`, { method: 'DELETE' });
        showToast(data.message || 'Listing removed.');
        myListingsLoaded = false;
        loadListings();
        if (!document.getElementById('mylistings').hidden) {
            loadMyListings();
        }
    } catch (err) {
        showToast(err.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const loginHint = document.getElementById('sellLoginHint');
    if (loginHint && getSavedUser()) {
        loginHint.style.display = 'none';
    }

    document.getElementById('listingForm').addEventListener('submit', handleListingSubmit);
    document.querySelectorAll('.market-tab').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    const skinsToggle = document.getElementById('showSkinsToggle');
    skinsToggle.addEventListener('change', onSkinsToggle);
    try {
        skinsToggle.checked = localStorage.getItem('pd2_show_skins') === '1' && !!getSavedUser();
    } catch {}
    initNoteCounter();
    document.getElementById('invFilter').addEventListener('input', onInvFilter);
    // Press "/" anywhere on the Browse tab to jump into the search box
    document.addEventListener('keydown', e => {
        if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA')) return;
        if (document.getElementById('listings').hidden) return;
        e.preventDefault();
        document.getElementById('searchInput').focus();
    });
    document.getElementById('sortSelect').addEventListener('change', loadListings);
    document.getElementById('searchInput').addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(loadListings, 300);
    });

    switchTab(initialTab());
    loadListings();
});
