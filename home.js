// --- HOME PAGE: HEISTER PROFILES ---
// Each heister card opens a dialog with their details. Cards work with the
// mouse and the keyboard (Tab to a card, Enter or Space to open, Escape to close),
// and focus returns to the card the dialog was opened from.

let lastHeisterCard = null;

function openHeisterModal(card) {
    const d = card.dataset;
    document.getElementById('modalTitle').textContent = d.name;
    document.getElementById('modalTag').textContent = d.role;
    document.getElementById('modalRealName').textContent = d.realName;
    document.getElementById('modalEquipment').textContent = d.equipment;
    document.getElementById('modalWeapon').textContent = d.weapon;
    document.getElementById('modalBio').textContent = d.bio;

    const modal = document.getElementById('heisterModal');
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    lastHeisterCard = card;
    document.getElementById('modalClose').focus();
}

function closeHeisterModal() {
    const modal = document.getElementById('heisterModal');
    if (!modal.classList.contains('active')) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    if (lastHeisterCard) lastHeisterCard.focus();
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.card-clickable[data-name]').forEach(card => {
        card.addEventListener('click', () => openHeisterModal(card));
        card.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openHeisterModal(card);
            }
        });
    });

    const modal = document.getElementById('heisterModal');
    document.getElementById('modalClose').addEventListener('click', closeHeisterModal);
    // Clicking the dark backdrop (not the dialog itself) closes it
    modal.addEventListener('click', e => {
        if (e.target === modal) closeHeisterModal();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeHeisterModal();
            return;
        }
        // Keep Tab inside the dialog while it's open: the close button is its only control
        if (e.key === 'Tab' && modal.classList.contains('active')) {
            e.preventDefault();
            document.getElementById('modalClose').focus();
        }
    });
});
