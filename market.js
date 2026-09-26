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

    const tags = el('div', 'listing-tags');
    tags.append(
        el('span', 'card-tag rarity-tag', listing.rarity),
        el('span', 'card-tag condition-tag', listing.condition)
    );

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

    const listedDate = el('span', 'listing-date', `Listed ${new Date(listing.createdAt).toLocaleDateString()}`);
    card.append(seller, listedDate);

    const actions = el('div', 'listing-actions');
    if (currentUser && currentUser.steamId === listing.sellerSteamId) {
        const removeBtn = el('button', 'btn-remove', 'Remove Listing');
        removeBtn.type = 'button';
        removeBtn.addEventListener('click', () => removeListing(listing.id));
        actions.append(removeBtn);
    } else if (listing.tradeLink && listing.tradeLink.startsWith('https://steamcommunity.com/tradeoffer/new/')) {
        const tradeBtn = el('a', 'btn-trade-offer', 'Send Trade Offer');
        tradeBtn.href = listing.tradeLink;
        tradeBtn.target = '_blank';
        tradeBtn.rel = 'noopener noreferrer';
        actions.append(tradeBtn);
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
    status.textContent = 'Loading listings… (the server can take up to a minute to wake up)';

    try {
        const listings = await apiRequest(`/api/listings?${params}`);
        if (requestId !== latestRequestId) return;

        const currentUser = getSavedUser();
        grid.replaceChildren(...listings.map(listing => createListingCard(listing, currentUser)));
        status.textContent = listings.length === 0
            ? (params.get('search')
                ? 'No listings match your search.'
                : 'No skins listed right now — sign in with Steam and be the first!')
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

    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
        const data = await apiRequest('/api/listings', {
            method: 'POST',
            body: JSON.stringify({
                itemName: document.getElementById('itemName').value,
                condition: document.getElementById('itemCondition').value,
                rarity: document.getElementById('itemRarity').value,
                price: document.getElementById('itemPrice').value,
                note: document.getElementById('itemNote').value,
                tradeLink: document.getElementById('sellerTradeLink').value.trim()
            })
        });
        showToast(data.message || 'Your skin is now listed!');

        // Keep the trade link filled in so listing several skins is quicker
        ['itemName', 'itemPrice', 'itemNote'].forEach(id => {
            document.getElementById(id).value = '';
        });
        loadListings();
    } catch (err) {
        showToast(err.message);
    } finally {
        submitBtn.disabled = false;
    }
}

async function removeListing(listingId) {
    if (!confirm('Remove this listing?')) return;

    try {
        const data = await apiRequest(`/api/listings/${encodeURIComponent(listingId)}`, { method: 'DELETE' });
        showToast(data.message || 'Listing removed.');
        loadListings();
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
    document.getElementById('sortSelect').addEventListener('change', loadListings);
    document.getElementById('searchInput').addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(loadListings, 300);
    });

    loadListings();
});
