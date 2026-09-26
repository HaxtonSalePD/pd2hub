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

    status.textContent = 'Loading… (the server can take up to a minute to wake up)';
    try {
        const data = await apiRequest('/api/admin/giveaway');
        status.textContent = '';
        panel.hidden = false;
        renderAdminData(data);
    } catch (err) {
        status.textContent = err.message;
        panel.hidden = true;
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
    loadGiveawayAdmin();
});
