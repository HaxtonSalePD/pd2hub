// --- STEAM SIGN-IN LANDING PAGE ---
// Steam sends visitors back here after they sign in. This page hands Steam's answer
// to the backend, which checks it with Steam and returns a login token. The visitor
// then goes back to the page they started on, where main.js checks the per-tab
// state value and stores the token (the same path as before).
// Uses BACKEND_URL from main.js.

const LOGIN_RETURN_PAGES = ['index', 'trade', 'giveaway', 'market', 'admin', 'rules'];

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const page = LOGIN_RETURN_PAGES.includes(params.get('page')) ? params.get('page') : 'index';
    const state = params.get('state') || '';
    const openid = {};
    for (const [key, value] of params) {
        if (key.startsWith('openid.')) openid[key] = value;
    }
    // Keep Steam's answer out of the browser history
    window.history.replaceState(null, '', window.location.pathname);

    const status = document.getElementById('loginStatus');
    const back = document.getElementById('loginBack');
    back.href = `${page}.html`;
    const showProblem = message => {
        status.textContent = message;
        back.hidden = false;
    };

    if (openid['openid.mode'] !== 'id_res') {
        showProblem('Sign-in was cancelled. No worries — you can try again any time.');
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/auth/steam/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ openid })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.token) {
            throw new Error(data.error || 'That Steam sign-in could not be verified. Please try signing in again.');
        }
        window.location.replace(`${page}.html#token=${encodeURIComponent(data.token)}&state=${encodeURIComponent(state)}`);
    } catch (err) {
        showProblem(err.message === 'Failed to fetch'
            ? 'Could not reach the server. It may still be waking up — please try signing in again in a minute.'
            : err.message);
    }
});
