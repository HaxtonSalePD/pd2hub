// --- GIVEAWAY ADMIN PAGE ---
// Uses getSavedUser, apiRequest and showToast from main.js.
// The backend decides who is an admin; this page only shows what the backend allows.

// Small helper so user text is always set with textContent (never innerHTML)
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function createWinnerRow(winner, isLatest) {
    const row = el('div', isLatest ? 'winner-row latest' : 'winner-row');

    if (winner.avatar) {
        const avatar = el('img');
        avatar.src = winner.avatar;
        avatar.alt = '';
        avatar.width = 48;
        avatar.height = 48;
        row.append(avatar);
    }

    const info = el('div', 'winner-info');

    const name = el('a', 'winner-name', winner.username);
    name.href = `https://steamcommunity.com/profiles/${encodeURIComponent(winner.steamId)}`;
    name.target = '_blank';
    name.rel = 'noopener noreferrer';
    name.title = 'View Steam profile';
    info.append(name);

    if (isLatest) {
        info.append(el('span', 'winner-badge', 'Latest winner'));
    }

    const drawnAt = new Date(winner.drawnAt).toLocaleString();
    info.append(el('p', 'winner-meta', `Drawn ${drawnAt} from ${winner.eligibleEntries} eligible entries`));
    row.append(info);

    if (winner.tradeLink && winner.tradeLink.startsWith('https://steamcommunity.com/tradeoffer/new/')) {
        const tradeBtn = el('a', 'btn-trade-offer', 'Send Prize');
        tradeBtn.href = winner.tradeLink;
        tradeBtn.target = '_blank';
        tradeBtn.rel = 'noopener noreferrer';
        tradeBtn.title = 'Opens a Steam trade offer to this winner';
        row.append(tradeBtn);
    }

    return row;
}

function renderAdminData(data) {
    document.getElementById('entryCount').textContent = data.totalEntries;

    const prizeEl = document.getElementById('currentPrize');
    if (data.active === false) {
        prizeEl.replaceChildren('No active giveaway — start one below.');
    } else {
        prizeEl.replaceChildren('Current prize: ', Object.assign(document.createElement('strong'), { textContent: data.prizeName }));
        if (data.startedAt) {
            prizeEl.append(` — running since ${new Date(data.startedAt).toLocaleDateString()}`);
        }
    }

    const winnersList = document.getElementById('winnersList');
    if (data.winners.length === 0) {
        winnersList.replaceChildren(el('p', 'winner-meta', 'No winners drawn yet.'));
        return;
    }
    winnersList.replaceChildren(...data.winners.map((winner, i) => createWinnerRow(winner, i === 0)));
}

async function loadGiveawayAdmin() {
    const status = document.getElementById('adminStatus');
    const panel = document.getElementById('adminPanel');

    if (!getSavedUser()) {
        status.textContent = 'Sign in with Steam above to use the admin page.';
        panel.hidden = true;
        return;
    }

    status.textContent = 'Opening the safehouse… (the server may need a minute to wake up)';
    try {
        const data = await apiRequest('/api/admin/giveaway');
        status.textContent = '';
        panel.hidden = false;
        renderAdminData(data);
        loadReports();
    } catch (err) {
        status.textContent = err.message;
        panel.hidden = true;
    }
}

// --- REPORTED LISTINGS ---
function createReportRow(report) {
    const row = el('div', 'winner-row');
    const info = el('div', 'winner-info');

    if (report.listing) {
        const name = el('a', 'winner-name', `${report.listing.itemName} — ${(report.listing.priceCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`);
        name.href = `https://steamcommunity.com/profiles/${encodeURIComponent(report.listing.sellerSteamId)}`;
        name.target = '_blank';
        name.rel = 'noopener noreferrer';
        name.title = "View the seller's Steam profile";
        info.append(name);
        info.append(el('p', 'winner-meta', `Seller: ${report.listing.sellerName}`));
    } else {
        info.append(el('span', 'winner-name', '(listing already removed)'));
    }

    const reportCount = report.count === 1 ? '1 report' : `${report.count} reports`;
    info.append(el('p', 'winner-meta', reportCount + (report.reasons.length ? ` — "${report.reasons.join('" · "')}"` : '')));
    row.append(info);

    const actions = el('div', 'report-actions');
    if (report.listing) {
        const removeBtn = el('button', 'btn-small remove', 'Remove');
        removeBtn.type = 'button';
        removeBtn.addEventListener('click', () => adminRemoveListing(report.listingId));
        actions.append(removeBtn);
    }
    const dismissBtn = el('button', 'btn-small dismiss', 'Dismiss');
    dismissBtn.type = 'button';
    dismissBtn.addEventListener('click', () => dismissReports(report.listingId));
    actions.append(dismissBtn);
    row.append(actions);

    return row;
}

async function loadReports() {
    const list = document.getElementById('reportsList');
    try {
        const reports = await apiRequest('/api/admin/reports');
        if (reports.length === 0) {
            list.replaceChildren(el('p', 'winner-meta', 'No reported listings. All quiet in the safehouse.'));
            return;
        }
        list.replaceChildren(...reports.map(createReportRow));
    } catch (err) {
        list.replaceChildren(el('p', 'winner-meta', err.message));
    }
}

async function adminRemoveListing(listingId) {
    if (!confirm('Remove this listing from the market? This cannot be undone.')) return;
    try {
        const data = await apiRequest(`/api/admin/listings/${encodeURIComponent(listingId)}`, { method: 'DELETE' });
        showToast(data.message);
        loadReports();
    } catch (err) {
        showToast(err.message);
    }
}

async function dismissReports(listingId) {
    if (!confirm('Dismiss all reports against this listing? It stays on the market.')) return;
    try {
        const data = await apiRequest(`/api/admin/reports/${encodeURIComponent(listingId)}`, { method: 'DELETE' });
        showToast(data.message);
        loadReports();
    } catch (err) {
        showToast(err.message);
    }
}

// --- PRIZE PICKER ---
let prizePool = []; // [{ item, quantity }]

function renderPrizePool() {
    const list = document.getElementById('prizePoolList');
    if (prizePool.length === 0) {
        list.replaceChildren();
        return;
    }
    const header = el('p', 'winner-meta', 'Prize pool:');
    header.style.marginBottom = '0.4rem';
    list.replaceChildren(header, ...prizePool.map((entry, i) => {
        const row = el('div', 'winner-row');
        const info = el('div', 'winner-info');
        const name = el('span', 'inv-name', entry.quantity > 1 ? `${entry.item.name} ×${entry.quantity}` : entry.item.name);
        if (entry.item.color && /^#[0-9a-f]{6}$/i.test(entry.item.color)) name.style.color = entry.item.color;
        info.append(name);
        row.append(info);
        const removeBtn = el('button', 'btn-small dismiss', '✕');
        removeBtn.type = 'button';
        removeBtn.title = 'Remove from pool';
        removeBtn.addEventListener('click', () => {
            prizePool.splice(i, 1);
            renderPrizePool();
        });
        row.append(removeBtn);
        return row;
    }));
}

function renderPrizeGrid(items) {
    const grid = document.getElementById('prizeGrid');
    grid.replaceChildren(...items.map(item => {
        const tile = el('div', 'inv-tile');
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
        const metaParts = [item.condition, item.rarity, item.statBoost ? 'Stat Boost' : null].filter(Boolean);
        if (metaParts.length) tile.append(el('div', 'inv-meta', metaParts.join(' · ')));

        tile.addEventListener('click', () => {
            if (prizePool.some(entry => entry.item.name === item.name)) {
                showToast('That item is already in the prize pool.');
                return;
            }
            let quantity = 1;
            const left = item.available ?? item.count;
            if (left > 1) {
                const answer = prompt(`How many? (you have ${left})`, '1');
                if (answer === null) return;
                quantity = Math.floor(Number(answer));
                if (!Number.isInteger(quantity) || quantity < 1 || quantity > left) {
                    showToast(`Please enter a number between 1 and ${left}.`);
                    return;
                }
            }
            prizePool.push({ item, quantity });
            renderPrizePool();
            document.getElementById('prizePickHint').textContent =
                `${prizePool.length} item${prizePool.length === 1 ? '' : 's'} in the pool — add more, or start the giveaway.`;
        });
        return tile;
    }));
    grid.style.display = 'grid';
}

async function loadPrizeInventory() {
    const hint = document.getElementById('prizePickHint');
    hint.textContent = 'Opening your stash… (this can take a few seconds)';
    try {
        const data = await apiRequest('/api/inventory');
        if (data.items.length === 0) {
            hint.textContent = 'No tradable PAYDAY 2 items found in your inventory.';
            return;
        }
        renderPrizeGrid(data.items);
        hint.textContent = `${data.items.length} items — click one to make it the prize.`;
    } catch (err) {
        hint.textContent = 'Could not load your inventory — you can still type a prize name below.';
        showToast(err.message);
    }
}

// --- START NEW GIVEAWAY ---
async function startNewGiveaway() {
    const input = document.getElementById('newPrizeName');
    const prizeName = input.value.trim();
    const usingPool = prizePool.length > 0;
    if (!usingPool && prizeName.length < 3) {
        showToast('Pick skins for the pool, or enter a prize name (at least 3 characters).');
        return;
    }
    const label = usingPool
        ? prizePool.map(entry => entry.quantity > 1 ? `${entry.item.name} ×${entry.quantity}` : entry.item.name).join(' + ')
        : prizeName;
    if (!confirm(`Start a new giveaway for "${label}"?\n\nAll current entries and winners are archived, and everyone can enter again.`)) return;

    const btn = document.getElementById('startGiveawayBtn');
    btn.disabled = true;
    try {
        const data = await apiRequest('/api/admin/giveaway/new', {
            method: 'POST',
            body: JSON.stringify(usingPool
                ? { prizes: prizePool.map(entry => ({ itemName: entry.item.name, quantity: entry.quantity })) }
                : { prizeName })
        });
        showToast(data.message);
        input.value = '';
        prizePool = [];
        renderPrizePool();
        await loadGiveawayAdmin();
    } catch (err) {
        showToast(err.message);
    } finally {
        btn.disabled = false;
    }
}

async function drawWinner() {
    if (!confirm('Draw a winner now? The result is saved and cannot be undone.')) return;

    const drawBtn = document.getElementById('drawBtn');
    drawBtn.disabled = true;

    try {
        const data = await apiRequest('/api/admin/giveaway/draw', { method: 'POST' });
        showToast(data.message);
        await loadGiveawayAdmin();
    } catch (err) {
        showToast(err.message);
    } finally {
        drawBtn.disabled = false;
    }
}

async function cancelGiveaway() {
    if (!confirm('Cancel the current giveaway?\n\nNo winner is drawn, entries are archived, and the giveaway page closes until you start a new one.')) return;
    try {
        const data = await apiRequest('/api/admin/giveaway', { method: 'DELETE' });
        showToast(data.message);
        await loadGiveawayAdmin();
    } catch (err) {
        showToast(err.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('drawBtn').addEventListener('click', drawWinner);
    document.getElementById('startGiveawayBtn').addEventListener('click', startNewGiveaway);
    document.getElementById('pickPrizeBtn').addEventListener('click', loadPrizeInventory);
    document.getElementById('cancelGiveawayBtn').addEventListener('click', cancelGiveaway);
    loadGiveawayAdmin();
});
