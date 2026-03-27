/**
 * rh_common.js - Shared logic for all RH module pages
 */

function syncTheme() {
    if (window.parent && window.parent.document.body.classList.contains('dark-theme')) {
        document.body.classList.remove('light-mode');
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-mode');
    }
}

// Auto-sync on load
document.addEventListener('DOMContentLoaded', syncTheme);
