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
    prizeEl.replaceChildren('Current prize: ', Object.assign(document.createElement('strong'), { textContent: data.prizeName }));
    if (data.startedAt) {
        prizeEl.append(` — running since ${new Date(data.startedAt).toLocaleDateString()}`);
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

// --- START NEW GIVEAWAY ---
async function startNewGiveaway() {
    const input = document.getElementById('newPrizeName');
    const prizeName = input.value.trim();
    if (prizeName.length < 3) {
        showToast('Please enter a prize name (at least 3 characters).');
        return;
    }
    if (!confirm(`Start a new giveaway for "${prizeName}"?\n\nAll current entries and winners are archived, and everyone can enter again.`)) return;

    const btn = document.getElementById('startGiveawayBtn');
    btn.disabled = true;
    try {
        const data = await apiRequest('/api/admin/giveaway/new', {
            method: 'POST',
            body: JSON.stringify({ prizeName })
        });
        showToast(data.message);
        input.value = '';
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

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('drawBtn').addEventListener('click', drawWinner);
    document.getElementById('startGiveawayBtn').addEventListener('click', startNewGiveaway);
    loadGiveawayAdmin();
});
