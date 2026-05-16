// Sostituisci questo URL con l'URL della tua Web App di Google Apps Script (assicurati finisca con /exec)
const API_URL = 'https://script.google.com/macros/s/AKfycbx38nGmf0QzZz8AjDrCgljgXjmXA5ZHPIB50quq6M_rh5qCypdJ9lvqkyKVrXF804St/exec';

// Elementi DOM
const loginScreen = document.getElementById('login-screen');
const homeScreen = document.getElementById('home-screen');
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const btnLogin = document.getElementById('btn-login');
const loginText = document.getElementById('login-text');
const loginSpinner = document.getElementById('login-spinner');
const loginError = document.getElementById('login-error');
const btnInstall = document.getElementById('btn-install');
const btnLogout = document.getElementById('btn-logout');
const userGreeting = document.getElementById('user-greeting');
const appsContainer = document.getElementById('apps-container');
const loadingApps = document.getElementById('loading-apps');

// Elementi iFrame
const iframeScreen = document.getElementById('iframe-screen');
const appIframe = document.getElementById('app-iframe');
const iframeTitle = document.getElementById('iframe-title');
const btnCloseIframe = document.getElementById('btn-close-iframe');

// Elementi Admin
const adminScreen = document.getElementById('admin-screen');
const btnAdminBack = document.getElementById('btn-admin-back');
const btnAdminSave = document.getElementById('btn-admin-save');
const btnAddUser = document.getElementById('btn-add-user');
const btnAddApp = document.getElementById('btn-add-app');
const btnAddGroup = document.getElementById('btn-add-group');
const adminLoading = document.getElementById('admin-loading');
const adminContent = document.getElementById('admin-content');
const transitionOverlay = document.getElementById('transition-overlay');
const transitionIconContainer = document.getElementById('transition-icon-container');

// Elementi Monitor
const monitorScreen = document.getElementById('monitor-screen');
const btnMonitorBack = document.getElementById('btn-monitor-back');
const monitorLoading = document.getElementById('monitor-loading');
const monitorContent = document.getElementById('monitor-content');
const monitorBody = document.getElementById('monitor-body');
const monitorLastUpdated = document.getElementById('monitor-last-updated');
const toggleLimits = document.getElementById('toggle-limits');
const limitsDetails = document.getElementById('limits-details');
const monitorError = document.getElementById('monitor-error');
const monitorErrorMsg = document.getElementById('monitor-error-msg');

// State
let currentUser = null;
let adminData = null; // { utenti, profili, apps, permessi }

// Registrazione Service Worker per PWA e Caching PWA Install
let deferredPrompt;

// Aiuto per Installazione iOS (Apple Safari)
const isIos = () => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iPadOsDesktopMode = userAgent.includes('macintosh') && navigator.maxTouchPoints > 1;
    return /iphone|ipad|ipod/.test(userAgent) || iPadOsDesktopMode;
};
const isMobileBrowser = () => /android|iphone|ipad|ipod/i.test(window.navigator.userAgent) || navigator.maxTouchPoints > 1;
const isInStandaloneMode = () => window.matchMedia('(display-mode: standalone)').matches || (('standalone' in window.navigator) && window.navigator.standalone);

if (btnInstall && isMobileBrowser() && !isInStandaloneMode()) {
    btnInstall.classList.remove('hidden');
    btnInstall.innerHTML = isIos()
        ? '<i class="fa-brands fa-apple"></i> Setup su iPhone/iPad'
        : '<i class="fa-solid fa-download"></i> Installa App';
}

window.addEventListener('beforeinstallprompt', (e) => {
    // Previeni apparizione banner automatico
    e.preventDefault();
    deferredPrompt = e;
    // Mostra il pulsante di installazione (ambiente Android/PC)
    if (btnInstall) btnInstall.classList.remove('hidden');
});

btnInstall.addEventListener('click', async () => {
    // Seleziona comportamento Apple
    if (isIos() && !isInStandaloneMode()) {
        alert("PER INSTALLARE SU APPLE iOS:\n\n1. Tocca l'icona 'Condividi' (il quadrato con la freccia rivolta in alto) nella barra inferiore di Safari.\n2. Scorri il menÃ¹ e tocca 'Aggiungi alla schermata Home' o 'Aggiungi a Home'.");
        return;
    }

    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        btnInstall.classList.add('hidden');
    } else if (!isIos()) {
        alert("Per installare l'app:\n\n1. Apri il menu del browser.\n2. Tocca 'Installa app' oppure 'Aggiungi a schermata Home'.\n\nSe il pulsante non compare nel menu, ricarica la pagina dopo qualche secondo.");
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => {
                reg.update();
            })
            .catch(err => console.error('Errore Service Worker', err));
    });
}

// Inizializzazione
function init() {
    // Controlla se c'Ã¨ una sessione salvata
    const session = localStorage.getItem('portale_session');
    if (session) {
        currentUser = JSON.parse(session);
        showHomeScreen();
    } else {
        showLoginScreen();
    }
}

// UI Navigazione
function showLoginScreen() {
    homeScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    loginError.classList.add('hidden');
    usernameInput.value = '';
    passwordInput.value = '';
}

function showHomeScreen() {
    loginScreen.classList.add('hidden');
    homeScreen.classList.remove('hidden');
    userGreeting.textContent = `Ciao, ${currentUser.nome}`;
    loadApps();
}

function hideHomeForFullscreenView() {
    document.body.classList.add('fullscreen-active');
    homeScreen.classList.add('hidden');
}

function restoreHomeAfterFullscreenView() {
    const fullscreenViewsClosed =
        iframeScreen.classList.contains('hidden') &&
        document.getElementById('drive-viewer-screen').classList.contains('hidden') &&
        document.getElementById('timbrature-screen').classList.contains('hidden') &&
        adminScreen.classList.contains('hidden');

    if (currentUser && loginScreen.classList.contains('hidden') && fullscreenViewsClosed) {
        document.body.classList.remove('fullscreen-active');
        homeScreen.classList.remove('hidden');
    } else if (fullscreenViewsClosed) {
        document.body.classList.remove('fullscreen-active');
    }
}

function setLoading(isLoading) {
    if (isLoading) {
        loginText.classList.add('hidden');
        loginSpinner.classList.remove('hidden');
        btnLogin.disabled = true;
    } else {
        loginText.classList.remove('hidden');
        loginSpinner.classList.add('hidden');
        btnLogin.disabled = false;
    }
}

// Gestione Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');
    setLoading(true);

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'LOGIN',
                username: username,
                password: password
            })
        });

        const data = await response.json();

        if (data.status === 'success') {
            // Salva sessione in localStorage
            currentUser = data.user;
            localStorage.setItem('portale_session', JSON.stringify(currentUser));
            showHomeScreen();
        } else {
            loginError.textContent = data.message || "Credenziali errate.";
            loginError.classList.remove('hidden');
        }
    } catch (error) {
        console.error("Errore login:", error);
        loginError.textContent = "Errore di rete. Verifica la connessione.";
        loginError.classList.remove('hidden');
    } finally {
        setLoading(false);
    }
});

btnLogout.addEventListener('click', () => {
    localStorage.removeItem('portale_session');
    currentUser = null;
    showLoginScreen();
});

// Caricamento App
async function loadApps() {
    appsContainer.innerHTML = '';
    loadingApps.classList.remove('hidden');

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'GET_USER_DATA',
                userId: currentUser.id || currentUser.ID_UTENTE
            })
        });

        const data = await response.json();

        if (data.status === 'success') {
            renderApps(data.apps);
        } else {
            alert("Errore nel caricamento delle app: " + data.message);
            if (data.message === 'Utente non attivo.' || data.message.includes('non attivo')) {
                btnLogout.click();
            }
        }
    } catch (error) {
        console.error("Errore fetch app:", error);
        alert("Errore di rete durante il caricamento delle app.");
    } finally {
        loadingApps.classList.add('hidden');
    }
}

function renderApps(apps) {
    if (apps.length === 0) {
        appsContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Nessuna applicazione disponibile.</p>';
        return;
    }

    apps.forEach(app => {
        if (!app.isAllowed) return; // L'admin ha chiesto di nasconderle completamente

        const card = document.createElement('a');
        card.className = 'app-card';
        card.href = '#';

        if (app.isAllowed) {
            card.onclick = (e) => {
                e.preventDefault();
                const targetUrl = app.link;
                const targetName = app.nome;

                fetch(API_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'LOG_APP_OPEN',
                        userId: currentUser.id || currentUser.ID_UTENTE,
                        userName: currentUser.nome || currentUser.NOME,
                        appId: app.id,
                        appName: app.nome
                    })
                }).catch(e => console.error("Log error", e));

                if (isIos() && !targetUrl.startsWith('native://')) {
                    // Bypass specifico per iOS: evitiamo iframe a causa del blocco cookie di terze parti (ITP).
                    // Utilizziamo window.location.href per aprire nel Safari View Controller (in PWA) 
                    // o nella stessa scheda senza subire blocchi di popup.
                    window.location.href = targetUrl;
                    return;
                }

                runAppTransition(card, () => {
                    if (targetUrl === 'native://timbrature') {
                        openTimbratureNative();
                    } else if (targetUrl === 'native://procedure') {
                        openDriveViewerNative('procedure', targetName);
                    } else if (targetUrl === 'native://comunicazioni') {
                        openDriveViewerNative('comunicazioni', targetName);
                    } else if (targetUrl === 'native://modulirapidi') {
                        openModuliRapidiNative();
                    } else {
                        openAppInIframe(targetName, targetUrl, app.id);
                    }
                });
            };
        } else {
            card.onclick = (e) => {
                e.preventDefault();
                alert(`Accesso non abilitato al profilo '${currentUser.profilo}' per questa App.`);
            };
        }

        const iconClass = app.icona ? app.icona : 'fa-folder';
        const iconColor = app.colore ? app.colore : 'var(--primary-color)';

        let isImage = false;
        const iconLower = iconClass.toLowerCase();
        if (iconLower.startsWith('http') || iconLower.startsWith('data:img') || iconLower.startsWith('data:image') || iconLower.includes('.png') || iconLower.includes('.jpg') || iconLower.includes('.jpeg') || iconLower.includes('.svg') || iconLower.includes('.webp')) {
            isImage = true;
        }

        if (isImage) {
            let src = iconClass;
            if (!src.startsWith('http') && !src.startsWith('data:')) {
                src = `Prismi & Icone/${iconClass}`;
            }

            card.innerHTML = `
                <img src="${src}" style="width: 85px; height: 85px; object-fit: contain; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5)); margin-bottom: 5px;" alt="${app.nome}">
                <div class="app-title">${app.nome}</div>
                ${!app.isAllowed ? '<div class="app-badge"><i class="fa-solid fa-lock"></i></div>' : ''}
            `;
        } else {
            let iconContent = `<i class="${iconClass.includes('fa-') ? 'fa-solid ' + iconClass : 'fa-solid fa-folder'}"></i>`;
            card.innerHTML = `
                <div class="app-icon" style="background-color: ${iconColor};">
                    ${iconContent}
                </div>
                <div class="app-title">${app.nome}</div>
                ${!app.isAllowed ? '<div class="app-badge"><i class="fa-solid fa-lock"></i></div>' : ''}
            `;
        }

        appsContainer.appendChild(card);
    });

    // Se admin, aggiungi card per config
    if (currentUser.isAdmin === true || currentUser.isAdmin === 'TRUE' || currentUser.isAdmin === 'Vero') {
        const adminCard = document.createElement('a');
        adminCard.className = 'app-card';
        adminCard.href = '#';
        adminCard.onclick = (e) => {
            e.preventDefault();
            runAppTransition(adminCard, () => {
                showAdminScreen();
            });
        };
        adminCard.innerHTML = `
            <div class="app-icon" style="background-color: #10b981;">
                <i class="fa-solid fa-user-shield"></i>
            </div>
            <div class="app-title">Area Admin</div>
        `;
        appsContainer.appendChild(adminCard);
    }
}

// Logica Transizione Premium
function runAppTransition(sourceElement, callback) {
    // 1. Prepara l'icona da clonare
    const icon = sourceElement.querySelector('img') || sourceElement.querySelector('.app-icon');
    if (!icon) {
        callback();
        return;
    }

    const rect = icon.getBoundingClientRect();
    const clone = icon.cloneNode(true);

    // Cattura stili calcolati per coerenza (es. background-color)
    const computedStyle = window.getComputedStyle(icon);
    const bgColor = computedStyle.backgroundColor;

    // Rimuovi stili inline che potrebbero interferire se presenti
    clone.style.margin = '0';
    clone.style.position = 'fixed';
    clone.style.top = rect.top + 'px';
    clone.style.left = rect.left + 'px';
    clone.style.width = rect.width + 'px';
    clone.style.height = rect.height + 'px';

    // Se Ã¨ un'icona FA (div.app-icon), applica il colore originale
    if (icon.classList.contains('app-icon')) {
        clone.style.backgroundColor = bgColor;
    }

    clone.classList.add('transition-clone');

    document.body.appendChild(clone);

    // 2. Mostra l'overlay
    transitionOverlay.classList.remove('hidden');
    // Piccolo delay per permettere al browser di registrare la rimozione di hidden prima di opacity
    setTimeout(() => transitionOverlay.classList.add('active'), 10);

    // 3. Sequenza Animazioni (Totale ~3 secondi)
    // Step A: Sposta al centro
    setTimeout(() => {
        clone.classList.add('moving');
    }, 50);

    // Step B: Ruota su se stesso
    setTimeout(() => {
        clone.classList.add('spinning');
    }, 850);

    // Step C: Zoom finale ed esecuzione callback (cambio schermata)
    setTimeout(() => {
        clone.classList.add('zooming');
        callback();
    }, 2100);

    // Step D: Pulizia e chiusura overlay
    setTimeout(() => {
        transitionOverlay.classList.remove('active');
        setTimeout(() => {
            transitionOverlay.classList.add('hidden');
            clone.remove();
        }, 600);
    }, 3200);
}

// Logica Apertura App in iFrame
function openAppInIframe(nome, url, appId = '') {
    document.body.style.overflow = 'hidden';
    hideHomeForFullscreenView();
    iframeTitle.textContent = nome;
    iframeScreen.classList.remove('hidden');
    iframeScreen.style.width = '100vw';
    iframeScreen.style.height = '100dvh';
    iframeScreen.style.position = 'fixed';
    iframeScreen.style.inset = '0';
    iframeScreen.style.overflow = 'hidden';

    const iframeContainer = document.getElementById('iframe-container');
    if (iframeContainer) {
        iframeContainer.style.width = '100vw';
        iframeContainer.style.height = '100dvh';
        iframeContainer.style.maxWidth = '100vw';
        iframeContainer.style.maxHeight = '100dvh';
        iframeContainer.style.overflow = 'hidden';
    }

    const wrapper = appIframe.parentElement;
    wrapper.style.overflow = 'hidden';
    wrapper.style.position = 'relative';
    wrapper.style.webkitOverflowScrolling = 'touch';
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    wrapper.style.minWidth = '0';

    appIframe.style.position = 'absolute';
    appIframe.style.top = '0';
    appIframe.style.left = '0';
    appIframe.style.border = '0';
    appIframe.style.outline = '0';
    appIframe.style.margin = '0';
    appIframe.style.padding = '0';
    appIframe.style.display = 'block';
    appIframe.style.boxSizing = 'border-box';
    appIframe.style.background = 'transparent';
    appIframe.style.transformOrigin = '0 0';

    appIframe.style.width = '100%';
    appIframe.style.height = '100%';
    appIframe.style.minWidth = '0';
    appIframe.style.maxWidth = '100%';
    appIframe.style.transform = 'none';
    appIframe.style.zoom = '1';
    appIframe.setAttribute('scrolling', 'yes');

    appIframe.src = url;
}

btnCloseIframe.addEventListener('click', () => {
    iframeScreen.classList.add('hidden');
    appIframe.src = ''; // Svuota per fermare processi in background
    iframeScreen.style.zIndex = ''; // Ripristina z-index se modificato

    // Ripristina lo scroll solo se non ci sono altre modali full-screen attive
    if (document.getElementById('drive-viewer-screen').classList.contains('hidden') &&
        document.getElementById('timbrature-screen').classList.contains('hidden') &&
        document.getElementById('admin-screen').classList.contains('hidden')) {
        document.body.style.overflow = '';
    } else {
        document.body.style.overflow = 'hidden';
    }
    restoreHomeAfterFullscreenView();
});

// ================= TIMBRATURE NATIVE LOGIC =================

const timbratureScreen = document.getElementById('timbrature-screen');
const btnCloseTimbrature = document.getElementById('btn-close-timbrature');
const timbratureLoading = document.getElementById('timbrature-loading');
const timbratureResult = document.getElementById('timbrature-body');
const timbratureError = document.getElementById('timbrature-error');

function openTimbratureNative() {
    document.body.style.overflow = 'hidden';
    hideHomeForFullscreenView();
    timbratureScreen.classList.remove('hidden');
    timbratureLoading.classList.remove('hidden');
    timbratureError.classList.add('hidden');
    timbratureError.textContent = '';
    timbratureResult.classList.add('hidden');
    timbratureResult.innerHTML = '';

    fetchMyTimbrature();
}

if (btnCloseTimbrature) {
    btnCloseTimbrature.addEventListener('click', () => {
        document.body.style.overflow = '';
        timbratureScreen.classList.add('hidden');
        restoreHomeAfterFullscreenView();
    });
}

async function fetchMyTimbrature() {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'GET_MY_TIMBRATURE',
                nome: currentUser.nome
            })
        });

        const data = await response.json();

        if (data.status === 'success') {
            renderTimbrature(data);
        } else {
            timbratureError.textContent = data.message || 'Errore nel recupero delle timbrature.';
            timbratureLoading.classList.add('hidden');
            timbratureError.classList.remove('hidden');
        }
    } catch (error) {
        timbratureError.textContent = 'Errore di rete. Impossibile connettersi al server.';
        timbratureLoading.classList.add('hidden');
        timbratureError.classList.remove('hidden');
    }
}

function renderTimbrature(data) {
    const tableHTML = `
        <h3 style="color:white; margin-bottom: 5px;">Mese: ${data.mese}/${data.anno}</h3>
        <p style="color:var(--primary-color); font-weight: 600; margin-bottom: 15px;">Persona: ${data.nome}</p>
        <div class="table-responsive">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th style="width: 60px;">Data</th>
                        <th>Timbrature</th>
                        <th style="width: 70px;">Pausa</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.giorni.map(g => {
        let pausaLabel = '-';
        if (g.stamps.length > 0) {
            if (g.pauseMin === 60) pausaLabel = '1h';
            else if (g.pauseMin > 0) pausaLabel = g.pauseMin + ' min';
            else pausaLabel = '0 min';

            if (g.pauseType === 'timbrata') {
                pausaLabel += ' <small style="display:block; font-size:10px; color:#10b981;">(Timbrata)</small>';
            } else {
                pausaLabel += ' <small style="display:block; font-size:10px; color:#94a3b8;">(Offset)</small>';
            }
        }

        let stampsLabel = '-';
        if (g.stamps.length > 0) {
            if (g.stamps.length === 1) {
                stampsLabel = `Ing: <span style="color:#10b981;">${g.stamps[0]}</span>`;
            } else if (g.stamps.length >= 2) {
                let ing = g.stamps[0];
                let usc = g.stamps[g.stamps.length - 1];
                stampsLabel = `<div style="display:flex; flex-direction:column; gap:2px;">
                                    <div>Ing: <span style="color:#10b981;">${ing}</span> | Usc: <span style="color:#ef4444;">${usc}</span></div>
                                </div>`;
            }
            if (g.stamps.length > 2) {
                stampsLabel += `<div style="font-size:10px; color:var(--text-muted); margin-top:2px;">Tutte: ${g.stamps.join(' - ')}</div>`;
            }
        }

        return `
                        <tr>
                            <td><strong>${g.key.split('/')[0]}/${g.key.split('/')[1]}</strong></td>
                            <td style="font-family:monospace; font-size:13px; color: white;">
                                ${stampsLabel}
                            </td>
                            <td style="font-size: 13px; color: #f59e0b;">${pausaLabel}</td>
                        </tr>
                        `;
    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    timbratureResult.innerHTML = tableHTML;
    timbratureLoading.classList.add('hidden');
    timbratureResult.classList.remove('hidden');
}

// ================= ADMIN DASHBOARD LOGIC =================

function showAdminScreen() {
    hideHomeForFullscreenView();
    homeScreen.classList.add('hidden');
    adminScreen.classList.remove('hidden');
    loadAdminData();
}

btnAdminBack.addEventListener('click', () => {
    adminScreen.classList.add('hidden');
    document.body.classList.remove('fullscreen-active');
    homeScreen.classList.remove('hidden');
    loadApps(); // ricarica le app nel caso i permessi siano cambiati
});

const btnSharePortal = document.getElementById('btn-share-portal');
if (btnSharePortal) {
    btnSharePortal.addEventListener('click', () => {
        // Pulisce l'URL (elimina eventuali '?hash' o query vecchie) ma mantiene l'URL base
        const urlToShare = window.location.origin + window.location.pathname;
        navigator.clipboard.writeText(urlToShare).then(() => {
            const originalHTML = btnSharePortal.innerHTML;
            btnSharePortal.innerHTML = '<i class="fa-solid fa-check"></i> Copiato!';
            btnSharePortal.style.background = '#10b981';
            btnSharePortal.style.borderColor = '#10b981';
            btnSharePortal.style.color = '#fff';
            setTimeout(() => {
                btnSharePortal.innerHTML = originalHTML;
                btnSharePortal.style.background = '';
                btnSharePortal.style.borderColor = '';
                btnSharePortal.style.color = '';
            }, 2000);
        }).catch(err => {
            alert("Errore durante la copia del link: " + err);
        });
    });
}

async function loadAdminData() {
    adminLoading.classList.remove('hidden');
    adminContent.classList.add('hidden');

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'GET_ADMIN_DATA',
                adminUserId: currentUser.id || currentUser.ID_UTENTE,
                profile: currentUser.profilo
            })
        });
        const data = await response.json();

        if (data.status === 'success') {
            adminData = {
                utenti: data.utenti,
                profili: data.profili,
                apps: data.apps,
                permessi: data.permessi,
                dipendentiDisponibili: data.dipendentiDisponibili || [],
                log_accessi: data.log_accessi || []
            };
            renderAdminDashboard();
        } else {
            alert("Errore Admin: " + data.message);
            btnAdminBack.click();
        }
    } catch (e) {
        alert("Errore caricamento dati admin.");
        btnAdminBack.click();
    } finally {
        adminLoading.classList.add('hidden');
        adminContent.classList.remove('hidden');
    }
}

function renderAdminDashboard() {
    renderMonitoraggio();
    renderUtenti();
    renderAppsAdmin();
    renderGruppi();
    renderPermessi();

    // Aggiungi pulsante per monitoraggio in fondo all'admin dashboard
    if (!document.getElementById('btn-open-monitor')) {
        const adminDashboard = document.querySelector('.admin-dashboard');
        const monitorBtnContainer = document.createElement('div');
        monitorBtnContainer.id = 'btn-open-monitor';
        monitorBtnContainer.className = 'admin-section glass';
        monitorBtnContainer.style.textAlign = 'center';
        monitorBtnContainer.innerHTML = `
            <button class="btn-primary" style="background:#6366f1; width: auto; padding: 12px 25px;">
                <i class="fa-solid fa-microchip"></i> Apri Statistiche Quota Sistema
            </button>
        `;
        monitorBtnContainer.querySelector('button').onclick = openMonitorScreen;
        adminDashboard.appendChild(monitorBtnContainer);
    }
}

function renderMonitoraggio() {
    const container = document.getElementById('monitoraggio-container');
    if (!container) return;
    container.innerHTML = '';

    if (!adminData.log_accessi || adminData.log_accessi.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); font-size:14px; text-align:center;">Nessun dato negli ultimi 30 giorni.</p>';
        return;
    }

    adminData.log_accessi.forEach(log => {
        let card = document.createElement('div');
        card.className = 'admin-card';
        
        let header = document.createElement('div');
        header.className = 'admin-card-header';
        header.innerHTML = `<span><i class="fa-solid fa-chart-line"></i> ${log.app}</span> <span class="badge-mid" style="background:var(--primary-color);">${log.accessi.reduce((a,b)=>a+b.conteggio, 0)} view</span>`;
        card.appendChild(header);

        let body = document.createElement('div');
        body.className = 'admin-card-body';
        
        log.accessi.forEach(u => {
            body.innerHTML += `
                <div class="admin-log-row">
                    <span><i class="fa-solid fa-user-check" style="color:var(--text-muted);"></i> ${u.utente}</span>
                    <strong style="color:var(--text-main);">${u.conteggio}</strong>
                </div>
            `;
        });
        
        card.appendChild(body);
        container.appendChild(card);
    });
}

// ================= MONITORAGGIO SYSTEM LOGIC =================

function openMonitorScreen() {
    monitorScreen.classList.remove('hidden');
    monitorError.classList.add('hidden'); // Reset errori
    loadMonitorData();
}

function showMonitorError(msg) {
    monitorErrorMsg.innerHTML = msg;
    monitorError.classList.remove('hidden');
}

btnMonitorBack.addEventListener('click', () => {
    monitorScreen.classList.add('hidden');
});

if (toggleLimits) {
    toggleLimits.addEventListener('click', () => {
        limitsDetails.classList.toggle('hidden');
        const icon = toggleLimits.querySelector('.fa-chevron-down, .fa-chevron-up');
        if (icon) {
            icon.classList.toggle('fa-chevron-down');
            icon.classList.toggle('fa-chevron-up');
        }
    });
}

async function loadMonitorData() {
    monitorLoading.classList.remove('hidden');
    monitorContent.classList.add('hidden');

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'GET_MONITOR_DATA', profile: currentUser.profilo })
        });
        const data = await response.json();

        if (data.status === 'success') {
            renderMonitorDashboard(data);
        } else {
            showMonitorError("<b>Errore Server:</b> " + data.message);
        }
    } catch (e) {
        showMonitorError("<b>Connessione fallita:</b> Impossibile recuperare i dati dal monitoraggio GAS.");
    } finally {
        monitorLoading.classList.add('hidden');
        monitorContent.classList.remove('hidden');
    }
}

function renderMonitorDashboard(data) {
    if (data.lastUpdated) {
        const date = new Date(data.lastUpdated);
        monitorLastUpdated.textContent = date.toLocaleString('it-IT');
    }

    // Email Quota
    const emailBar = document.getElementById('quota-email-bar');
    const emailText = document.getElementById('quota-email-text');

    if (data.emailQuota === -1) {
        emailBar.style.width = '0%';
        emailText.textContent = "Permessi non concessi";
        showMonitorError("<b>Permessi Email:</b> Google non ha autorizzato la lettura delle quote email. Prova a eseguire nuovamente 'scanner_hourlyAudit' dall'editor script per forzare l'autorizzazione.");
    } else {
        const emailUsed = 1500 - data.emailQuota;
        const emailPerc = (emailUsed / 1500 * 100);
        emailBar.style.width = emailPerc + '%';
        emailText.textContent = `${emailUsed} / 1500`;

        if (emailPerc >= 90) emailBar.className = 'quota-progress-fill critical';
        else if (emailPerc >= 70) emailBar.className = 'quota-progress-fill warning';
        else emailBar.className = 'quota-progress-fill';
    }

    // App Table
    monitorBody.innerHTML = '';
    let totalErrors = 0;

    data.apps.forEach(app => {
        const errCount = parseInt(app.ERRORI_7G || 0);
        const execCount = parseInt(app.ESECUZIONI_7G || 0);
        const errRate = parseFloat(app.ERROR_RATE || 0);

        totalErrors += errCount;

        const tr = document.createElement('tr');

        // Alert Color Coding per riga
        if (errRate >= 20 || errCount > 50) tr.className = 'table-row-critical';
        else if (errRate >= 10 || errCount > 20) tr.className = 'table-row-warning';

        // Badge colore
        let rateClass = 'badge-low';
        if (errRate >= 15) rateClass = 'badge-high';
        else if (errRate >= 5) rateClass = 'badge-mid';

        tr.innerHTML = `
            <td>
                <div style="font-weight:600;">${app.NOME}</div>
                <div style="font-size:9px; color:var(--text-muted); font-family:monospace;">${app.ID}</div>
            </td>
            <td>${execCount}</td>
            <td><span class="monitor-badge ${rateClass}">${app.ERROR_RATE}</span></td>
            <td style="font-size:11px; white-space: normal; max-width: 200px;">${app.POSIZIONE}</td>
            <td>
                <a href="${app.URL}" target="_blank" class="btn-primary-small" style="padding:4px 8px; font-size:10px;">
                    <i class="fa-solid fa-code"></i> Apri
                </a>
            </td>
        `;
        monitorBody.appendChild(tr);
    });

    // Salute Generale
    const healthPerc = data.apps.length > 0 ? (100 - (totalErrors / data.apps.length * 10)).toFixed(1) : 100;
    const hBar = document.getElementById('quota-health-bar');
    const clampedHealth = Math.max(0, Math.min(100, healthPerc));
    hBar.style.width = clampedHealth + '%';
    document.getElementById('quota-health-text').textContent = `${clampedHealth}% Ok`;

    if (clampedHealth <= 70) hBar.className = 'quota-progress-fill critical';
    else if (clampedHealth <= 85) hBar.className = 'quota-progress-fill warning';
    else hBar.className = 'quota-progress-fill';
}

function renderUtenti() {
    // Genera datalist per nomi dipendenti disponibili
    if (!document.getElementById('nomi-dipendenti')) {
        const datalist = document.createElement('datalist');
        datalist.id = 'nomi-dipendenti';
        document.body.appendChild(datalist);
    }
    const dlNomi = document.getElementById('nomi-dipendenti');
    dlNomi.innerHTML = '';
    if (adminData.dipendentiDisponibili) {
        adminData.dipendentiDisponibili.forEach(nome => {
            const option = document.createElement('option');
            option.value = nome;
            dlNomi.appendChild(option);
        });
    }

    const container = document.getElementById('utenti-container');
    if (!container) return;
    container.innerHTML = '';
    adminData.utenti.forEach((u, i) => {
        let profiliOptions = adminData.profili.map(p =>
            `<option value="${p.ID_PROFILO}" ${p.ID_PROFILO === u.PROFILO ? 'selected' : ''}>${p.ID_PROFILO}</option>`
        ).join('');
        let isAttivo = (u.ATTIVO === true || u.ATTIVO === 'TRUE' || u.ATTIVO === 'Vero');

        let card = document.createElement('div');
        card.className = 'admin-card';
        card.innerHTML = `
            <div class="admin-card-header">
                <span><i class="fa-solid fa-user"></i> ${u.NOME || 'Nuovo'} (${u.ID_UTENTE})</span>
                <button class="btn-danger-small" onclick="removeUtente(${i})"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="admin-card-body">
                <div class="admin-input-group">
                    <label>ID e Nome Dipendente</label>
                    <div style="display:flex; gap:10px;">
                        <input type="text" value="${u.ID_UTENTE}" data-idx="${i}" data-field="ID_UTENTE" class="u-input" style="flex:1" placeholder="ID">
                        <input type="text" list="nomi-dipendenti" value="${u.NOME}" data-idx="${i}" data-field="NOME" class="u-input" style="flex:3" placeholder="Nome">
                    </div>
                </div>
                <div class="admin-input-group">
                    <label>Credenziali Accesso</label>
                    <div style="display:flex; gap:10px;">
                        <input type="text" value="${u.USERNAME}" data-idx="${i}" data-field="USERNAME" class="u-input" placeholder="Username" style="flex:1">
                        <input type="text" value="${u.PASSWORD_HASH}" data-idx="${i}" data-field="PASSWORD_HASH" class="u-input" placeholder="Password" style="flex:1">
                    </div>
                </div>
                <div class="admin-input-group">
                    <label>Gruppo di Permessi</label>
                    <select data-idx="${i}" data-field="PROFILO" class="u-input">${profiliOptions}</select>
                </div>
                <div class="admin-toggle-row">
                    <span>Account Attivo</span>
                    <label class="toggle-switch">
                        <input type="checkbox" data-idx="${i}" data-field="ATTIVO" class="u-toggle" ${isAttivo ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    // Aggiungi event listeners
    document.querySelectorAll('.u-input').forEach(el => el.addEventListener('change', updateUtenteData));
    document.querySelectorAll('.u-toggle').forEach(el => el.addEventListener('change', updateUtenteData));
}

function renderAppsAdmin() {
    // Genera la lista delle icone disponibili come menu a tendina/autocompletamento
    if (!document.getElementById('icone-list')) {
        const availableIcons = [
            "CF.png", "CFR.png", "CH.png", "CTR.png", "ICSR.png", "ICSSquare.png",
            "IP.png", "IPR.png", "IS.png", "ISR.png", "SC.png", "SCR.png", "SF.png", "SFR.png",
            "fa-solid fa-list", "fa-solid fa-folder", "fa-solid fa-wrench", "fa-solid fa-user", "fa-solid fa-chart-line"
        ];
        const datalist = document.createElement('datalist');
        datalist.id = 'icone-list';
        availableIcons.forEach(icon => {
            const option = document.createElement('option');
            option.value = icon;
            datalist.appendChild(option);
        });
        document.body.appendChild(datalist);
    }

    const container = document.getElementById('admin-apps-container');
    if (!container) return;
    container.innerHTML = '';
    
    adminData.apps.forEach((a, i) => {
        let isAttiva = (a.ATTIVA === true || a.ATTIVA === 'TRUE' || a.ATTIVA === 'Vero');
        let isVis = (a.VISIBILE_HOME === true || a.VISIBILE_HOME === 'TRUE' || a.VISIBILE_HOME === 'Vero');

        let card = document.createElement('div');
        card.className = 'admin-card';
        card.innerHTML = `
            <div class="admin-card-header">
                <span><i class="${a.ICONA.startsWith('fa-') ? a.ICONA : 'fa-solid fa-cube'}"></i> ${a.NOME_APP || 'Nuova App'} (${a.ID_APP})</span>
                <button class="btn-danger-small" onclick="removeApp(${i})"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="admin-card-body">
                <div class="admin-input-group">
                    <label>ID App e Nome Visualizzato</label>
                    <div style="display:flex; gap:10px;">
                        <input type="text" value="${a.ID_APP}" data-idx="${i}" data-field="ID_APP" class="a-input" style="flex:1" placeholder="ID APP">
                        <input type="text" value="${a.NOME_APP}" data-idx="${i}" data-field="NOME_APP" class="a-input" style="flex:2" placeholder="Nome Visualizzato">
                    </div>
                </div>
                <div class="admin-input-group">
                    <label>Link Deployment / Modulo Nativo</label>
                    <textarea data-idx="${i}" data-field="LINK_DEPLOYMENT" class="a-input" style="width:100%; height: 50px; resize: vertical; font-size: 11px; padding:8px; border-radius:6px; background:var(--input-bg); color:var(--text-main); border:1px solid var(--card-border);" placeholder="https://... o native://...">${a.LINK_DEPLOYMENT}</textarea>
                    <select onchange="if(this.value) { const ta = this.previousElementSibling; ta.value = this.value; ta.dispatchEvent(new Event('change')); this.value=''; }" class="u-input" style="font-size:12px;">
                        <option value="">-- Autocompila Modulo Nativo --</option>
                        <option value="native://procedure">App Procedure</option>
                        <option value="native://comunicazioni">App Comunicazioni</option>
                        <option value="native://timbrature">App Timbrature</option>
                        <option value="native://modulirapidi">Moduli Rapidi</option>
                    </select>
                </div>
                <div class="admin-input-group">
                    <label>Icona e Ordine</label>
                    <div style="display:flex; gap:10px;">
                        <input type="text" list="icone-list" value="${a.ICONA}" data-idx="${i}" data-field="ICONA" class="a-input" style="flex:2" placeholder="Icona">
                        <input type="number" value="${a.ORDINE || 99}" data-idx="${i}" data-field="ORDINE" class="a-input" style="flex:1" placeholder="Ordine">
                    </div>
                </div>
                <div class="admin-toggle-row">
                    <span>App Attiva nel sistema</span>
                    <label class="toggle-switch">
                        <input type="checkbox" data-idx="${i}" data-field="ATTIVA" class="a-toggle" ${isAttiva ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="admin-toggle-row">
                    <span>Visibile in Homepage</span>
                    <label class="toggle-switch">
                        <input type="checkbox" data-idx="${i}" data-field="VISIBILE_HOME" class="a-toggle" ${isVis ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    document.querySelectorAll('.a-input').forEach(el => el.addEventListener('change', updateAppData));
    document.querySelectorAll('.a-toggle').forEach(el => el.addEventListener('change', updateAppData));
}

function renderGruppi() {
    const container = document.getElementById('gruppi-container');
    if (!container) return;
    container.innerHTML = '';
    adminData.profili.forEach((g, i) => {
        let card = document.createElement('div');
        card.className = 'admin-card';
        card.innerHTML = `
            <div class="admin-card-header">
                <span><i class="fa-solid fa-users-gear"></i> ${g.ID_PROFILO || 'Nuovo Gruppo'}</span>
                <button class="btn-danger-small" onclick="removeGruppo(${i})"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="admin-card-body">
                <div class="admin-input-group">
                    <label>Nome Gruppo e Descrizione</label>
                    <div style="display:flex; gap:10px;">
                        <input type="text" value="${g.ID_PROFILO || ''}" data-idx="${i}" data-field="ID_PROFILO" class="g-input" style="flex:1" placeholder="NOME GRUPPO">
                        <input type="text" value="${g.DESCRIZIONE || ''}" data-idx="${i}" data-field="DESCRIZIONE" class="g-input" style="flex:2" placeholder="Descrizione">
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
    document.querySelectorAll('.g-input').forEach(el => el.addEventListener('change', updateGruppoData));
}

function updateGruppoData(e) {
    let idx = e.target.getAttribute('data-idx');
    let field = e.target.getAttribute('data-field');
    adminData.profili[idx][field] = e.target.value;

    if (field === 'ID_PROFILO') { renderUtenti(); renderPermessi(); }
}

window.removeGruppo = function (idx) {
    if (confirm("Sei sicuro di eliminare questo gruppo?")) {
        adminData.profili.splice(idx, 1);
        renderGruppi();
        renderUtenti(); 
        renderPermessi();
    }
};

if (btnAddGroup) {
    btnAddGroup.addEventListener('click', () => {
        adminData.profili.push({
            ID_PROFILO: 'NUOVO_GRUPPO', DESCRIZIONE: 'Descrizione'
        });
        renderGruppi();
        renderUtenti();
        renderPermessi();
    });
}

function updateUtenteData(e) {
    let idx = e.target.getAttribute('data-idx');
    let field = e.target.getAttribute('data-field');
    adminData.utenti[idx][field] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
}

function updateAppData(e) {
    let idx = parseInt(e.target.getAttribute('data-idx'));
    let field = e.target.getAttribute('data-field');
    let newValue = e.target.type === 'checkbox' ? e.target.checked : e.target.value;

    if (field === 'ORDINE') {
        newValue = parseInt(newValue);
        if (isNaN(newValue)) newValue = 99;
        let oldValue = parseInt(adminData.apps[idx][field] || 99);
        adminData.apps[idx][field] = newValue;

        adminData.apps.forEach((a, i) => {
            if (i !== idx) {
                let o = parseInt(a.ORDINE || 99);
                if (oldValue > newValue && o >= newValue && o < oldValue) {
                    a.ORDINE = o + 1;
                } else if (oldValue < newValue && o > oldValue && o <= newValue) {
                    a.ORDINE = o - 1;
                }
            }
        });

        adminData.apps.sort((a,b) => parseInt(a.ORDINE||99) - parseInt(b.ORDINE||99));
        adminData.apps.forEach((a, i) => a.ORDINE = i + 1);

        renderAppsAdmin();
        renderPermessi();
        return;
    }

    adminData.apps[idx][field] = newValue;

    // Se cambia un ID APP dobbiamo re-renderizzare i permessi (o se si disattiva/attiva, cambiano le colonne)
    if (field === 'ID_APP' || field === 'ATTIVA' || field === 'VISIBILE_HOME') {
        renderPermessi();
    }
}

window.removeUtente = function (idx) {
    if (confirm("Sei sicuro di eliminare questo utente? Verranno rimossi anche i suoi permessi specifici.")) {
        let utenteRemoved = adminData.utenti[idx];
        adminData.permessi = adminData.permessi.filter(p => p.ID_UTENTE !== utenteRemoved.ID_UTENTE);
        adminData.utenti.splice(idx, 1);
        renderUtenti();
        renderPermessi();
    }
};

window.removeApp = function (idx) {
    if (confirm("Sei sicuro di eliminare questa App? Verranno rimossi anche i relativi permessi.")) {
        let appRemoved = adminData.apps[idx];
        // Rimuovi anche i permessi orfani
        adminData.permessi = adminData.permessi.filter(p => p.ID_APP !== appRemoved.ID_APP);
        adminData.apps.splice(idx, 1);
        renderAppsAdmin();
        renderPermessi();
    }
};

if (btnAddUser) {
    btnAddUser.addEventListener('click', () => {
        let newId = 'U' + String(adminData.utenti.length + 1).padStart(3, '0');
        adminData.utenti.push({
            ID_UTENTE: newId, NOME: 'Nuovo Utente', USERNAME: 'nuovouser', PASSWORD_HASH: 'pass123',
            PROFILO: 'TECNICO', ATTIVO: true, IS_ADMIN: false, NOTE: ''
        });
        renderUtenti();
    });
}

if (btnAddApp) {
    btnAddApp.addEventListener('click', () => {
        adminData.apps.push({
            ID_APP: 'NUOVA_APP', NOME_APP: 'Nuova App', LINK_DEPLOYMENT: 'https://',
            DESCRIZIONE: '', ICONA: 'fa-solid fa-cube', ORDINE: 99, ATTIVA: true, VISIBILE_HOME: true, COLORE_BADGE: '#10b981', NOTE: ''
        });
        renderAppsAdmin();
        renderPermessi();
    });
}

let groupPerms = {};

function renderPermessi() {
    let appsDisponibili = adminData.apps.filter(app => app.ATTIVA === true || app.ATTIVA === 'TRUE' || app.ATTIVA === 'Vero');
    const container = document.getElementById('permessi-container');
    if (!container) return;
    container.innerHTML = '';

    // Ricostruiamo lo stato dei permessi di gruppo partendo dagli utenti attuali
    adminData.profili.forEach(gruppo => {
        if (!groupPerms[gruppo.ID_PROFILO]) groupPerms[gruppo.ID_PROFILO] = {};
        
        let refUser = adminData.utenti.find(u => u.PROFILO === gruppo.ID_PROFILO);

        let card = document.createElement('div');
        card.className = 'admin-card';
        card.innerHTML = `
            <div class="admin-card-header" style="color:var(--primary-color);">
                <span><i class="fa-solid fa-key"></i> Gruppo: <b>${gruppo.ID_PROFILO}</b></span>
            </div>
            <div class="admin-card-body" id="perms-body-${gruppo.ID_PROFILO}">
            </div>
        `;
        container.appendChild(card);

        const body = card.querySelector('.admin-card-body');
        
        appsDisponibili.forEach(app => {
            let hasPerm = false;

            if (groupPerms[gruppo.ID_PROFILO][app.ID_APP] !== undefined) {
                hasPerm = groupPerms[gruppo.ID_PROFILO][app.ID_APP];
            } else if (refUser) {
                let perm = adminData.permessi.find(p => p.ID_UTENTE === refUser.ID_UTENTE && p.ID_APP === app.ID_APP);
                if (perm) {
                    let pval = perm.ABILITATO;
                    hasPerm = (pval === true || pval === 'TRUE' || pval === 'Vero' || pval === 'SÌ');
                }
                groupPerms[gruppo.ID_PROFILO][app.ID_APP] = hasPerm;
            } else {
                groupPerms[gruppo.ID_PROFILO][app.ID_APP] = false;
            }

            body.innerHTML += `
                <div class="admin-toggle-row" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding: 8px 0;">
                    <span style="font-size:14px;"><i class="${app.ICONA.startsWith('fa-') ? app.ICONA : 'fa-solid fa-cube'}"></i> ${app.NOME_APP}</span>
                    <label class="toggle-switch">
                        <input type="checkbox" onchange="updateGroupPermesso('${gruppo.ID_PROFILO}', '${app.ID_APP}', this.checked)" ${hasPerm ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
            `;
        });
    });
}

window.updateGroupPermesso = function (gruppoId, appId, checked) {
    if (!groupPerms[gruppoId]) groupPerms[gruppoId] = {};
    groupPerms[gruppoId][appId] = checked;
};

btnAdminSave.addEventListener('click', async () => {
    btnAdminSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btnAdminSave.disabled = true;

    // ESPANSIONE DEI PERMESSI DA GRUPPI A SINGOLI UTENTI
    // Per garantire la retrocompatibilità totale con le altre app che leggono il foglio PERMESSI_APP,
    // andiamo a generare una riga per ogni ID_UTENTE e ogni APP disponibile,
    // applicando il permesso definito a livello di Gruppo.
    let permessiEstesi = [];
    let appsDisponibili = adminData.apps.filter(app => app.ATTIVA === true || app.ATTIVA === 'TRUE' || app.ATTIVA === 'Vero');

    adminData.utenti.forEach(u => {
        appsDisponibili.forEach(a => {
            let hasPerm = false;
            if (groupPerms[u.PROFILO] && groupPerms[u.PROFILO][a.ID_APP] !== undefined) {
                hasPerm = groupPerms[u.PROFILO][a.ID_APP];
            }
            permessiEstesi.push({
                ID_UTENTE: u.ID_UTENTE,
                ID_APP: a.ID_APP,
                ABILITATO: hasPerm
            });
        });
    });

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'SAVE_ADMIN_DATA',
                adminUserId: currentUser.id || currentUser.ID_UTENTE,
                utenti_aggiornati: adminData.utenti,
                apps_aggiornate: adminData.apps,
                profili_aggiornati: adminData.profili,
                permessi_aggiornati: permessiEstesi
            })
        });
        const data = await response.json();
        if (data.status === 'success') {
            // Aggiorniamo i permessi locali con quelli appena salvati
            adminData.permessi = permessiEstesi;
            alert('Salvataggio completato con successo!');
        } else {
            alert('Errore al salvataggio: ' + data.message);
        }
    } catch (e) {
        alert('Errore di rete al salvataggio.');
    } finally {
        btnAdminSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salva';
        btnAdminSave.disabled = false;
    }
});

// Avvia app
init();

// ================= DRIVE VIEWER & KEYWORDS LOGIC =================

const driveViewerScreen = document.getElementById('drive-viewer-screen');
const btnCloseDriveViewer = document.getElementById('btn-close-drive-viewer');
const driveViewerTitle = document.getElementById('drive-viewer-title');
const driveViewerIcon = document.getElementById('drive-viewer-icon');
const driveViewerList = document.getElementById('drive-viewer-list');
const driveViewerLoading = document.getElementById('drive-viewer-loading');
const driveViewerError = document.getElementById('drive-viewer-error');
const driveViewerSearch = document.getElementById('drive-viewer-search');

const keywordModal = document.getElementById('keyword-modal');
const btnCloseKeywordModal = document.getElementById('btn-close-keyword-modal');
const keywordInput = document.getElementById('keyword-input');
const btnAddKeyword = document.getElementById('btn-add-keyword');
const keywordTagsContainer = document.getElementById('keyword-tags-container');
const keywordModalFileName = document.getElementById('keyword-modal-file-name');
const btnSaveKeywords = document.getElementById('btn-save-keywords');

let currentDriveFiles = [];
let currentDriveType = '';
let currentEditingFileId = null;
let currentEditingKeywords = [];

function openDriveViewerNative(type, title) {
    document.body.style.overflow = 'hidden';
    hideHomeForFullscreenView();
    driveViewerScreen.classList.remove('hidden');
    driveViewerLoading.classList.remove('hidden');
    driveViewerError.classList.add('hidden');
    driveViewerList.innerHTML = '';

    if (driveViewerSearch) {
        driveViewerSearch.value = '';
    }

    currentDriveType = type;
    if (driveViewerTitle) driveViewerTitle.textContent = title;
    if (driveViewerIcon) {
        if (type === 'procedure') {
            driveViewerIcon.className = 'fa-solid fa-book';
        } else {
            driveViewerIcon.className = 'fa-solid fa-bullhorn';
        }
    }

    fetchDriveFiles(type);
}

if (btnCloseDriveViewer) {
    btnCloseDriveViewer.addEventListener('click', () => {
        document.body.style.overflow = '';
        driveViewerScreen.classList.add('hidden');
        restoreHomeAfterFullscreenView();
    });
}

async function fetchDriveFiles(type) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'GET_DRIVE_FILES',
                type: type
            })
        });

        const data = await response.json();

        if (data.status === 'success') {
            currentDriveFiles = data.files;
            renderDriveFiles(currentDriveFiles);
        } else {
            driveViewerError.textContent = data.message || 'Errore nel caricamento dei file.';
            driveViewerError.classList.remove('hidden');
        }
    } catch (error) {
        driveViewerError.textContent = 'Errore di rete. Impossibile connettersi al server.';
        driveViewerError.classList.remove('hidden');
    } finally {
        driveViewerLoading.classList.add('hidden');
    }
}

function renderDriveFiles(files) {
    driveViewerList.innerHTML = '';

    if (files.length === 0) {
        driveViewerList.innerHTML = '<div style="text-align:center; padding: 20px; color: #94a3b8;">Nessun file trovato.</div>';
        return;
    }

    const canEditProcedure = currentUser && (currentUser.canEditProcedure === true || currentUser.isAdmin === true || currentUser.isAdmin === 'TRUE' || currentUser.isAdmin === 'Vero');

    files.forEach(file => {
        const card = document.createElement('div');
        card.style.background = 'rgba(30, 41, 59, 0.8)';
        card.style.borderRadius = '8px';
        card.style.padding = '15px';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '10px';
        card.style.border = '1px solid rgba(255,255,255,0.05)';

        let iconClass = 'fa-solid fa-file';
        let iconColor = '#94a3b8';
        if (file.mimeType.includes('pdf')) { iconClass = 'fa-solid fa-file-pdf'; iconColor = '#ef4444'; }
        else if (file.mimeType.includes('document')) { iconClass = 'fa-solid fa-file-word'; iconColor = '#3b82f6'; }
        else if (file.mimeType.includes('spreadsheet')) { iconClass = 'fa-solid fa-file-excel'; iconColor = '#10b981'; }

        let keywordsHtml = '';
        if (file.keywords && file.keywords.length > 0) {
            keywordsHtml = '<div style="display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px;">' +
                file.keywords.map(kw => '<span style="background: rgba(16, 185, 129, 0.2); color: #10b981; font-size: 11px; padding: 2px 6px; border-radius: 4px;">' + kw + '</span>').join('') +
                '</div>';
        }

        const dateStr = new Date(file.lastUpdated).toLocaleDateString('it-IT');

        card.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 15px;">
                <div style="font-size: 24px; color: ${iconColor};"><i class="${iconClass}"></i></div>
                <div style="flex: 1;">
                    <div style="color: white; font-weight: 600; font-size: 14px; word-break: break-word;">${file.name}</div>
                    <div style="color: #94a3b8; font-size: 11px; margin-top: 2px;">Aggiornato il: ${dateStr}</div>
                    ${keywordsHtml}
                </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 5px;">
                ${currentDriveType === 'procedure' && canEditProcedure ?
                '<button class="btn-secondary-small btn-edit-kw" data-id="' + file.id + '" style="background: transparent; border: 1px solid #334155; color: #cbd5e1; padding: 6px 10px;">' +
                '<i class="fa-solid fa-tags"></i> Keyword' +
                '</button>' : ''
            }
                <button onclick="openDriveFile('${file.url}', '${file.name.replace(/'/g, "\\'")}')" class="btn-primary-small" style="padding: 6px 12px;">
                    <i class="fa-solid fa-eye"></i> Apri
                </button>
            </div>
        `;

        driveViewerList.appendChild(card);
    });

    // Add event listeners to the new buttons
    document.querySelectorAll('.btn-edit-kw').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const fileId = e.currentTarget.getAttribute('data-id');
            const file = currentDriveFiles.find(f => f.id === fileId);
            if (file) {
                openKeywordModal(file);
            }
        });
    });
}

if (driveViewerSearch) {
    driveViewerSearch.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        if (!term) {
            renderDriveFiles(currentDriveFiles);
            return;
        }

        const filtered = currentDriveFiles.filter(file => {
            const nameMatch = file.name.toLowerCase().includes(term);
            const kwMatch = file.keywords && file.keywords.some(kw => kw.toLowerCase().includes(term));
            return nameMatch || kwMatch;
        });

        renderDriveFiles(filtered);
    });
}

// === Keyword Modal Logic ===

function openKeywordModal(file) {
    currentEditingFileId = file.id;
    currentEditingKeywords = [...(file.keywords || [])];

    if (keywordModalFileName) keywordModalFileName.textContent = file.name;
    if (keywordInput) keywordInput.value = '';
    renderKeywordTags();

    if (keywordModal) keywordModal.classList.remove('hidden');
}

if (btnCloseKeywordModal) {
    btnCloseKeywordModal.addEventListener('click', () => {
        if (keywordModal) keywordModal.classList.add('hidden');
    });
}

function renderKeywordTags() {
    if (!keywordTagsContainer) return;
    keywordTagsContainer.innerHTML = '';
    if (currentEditingKeywords.length === 0) {
        keywordTagsContainer.innerHTML = '<span style="color: #64748b; font-size: 13px;">Nessuna keyword.</span>';
        return;
    }

    currentEditingKeywords.forEach((kw, index) => {
        const tag = document.createElement('div');
        tag.style.background = '#1e293b';
        tag.style.color = '#10b981';
        tag.style.padding = '4px 8px';
        tag.style.borderRadius = '12px';
        tag.style.fontSize = '12px';
        tag.style.display = 'flex';
        tag.style.alignItems = 'center';
        tag.style.gap = '5px';
        tag.style.border = '1px solid #10b981';

        tag.innerHTML = `
            ${kw}
            <i class="fa-solid fa-xmark remove-kw" data-idx="${index}" style="cursor: pointer; color: #ef4444;"></i>
        `;
        keywordTagsContainer.appendChild(tag);
    });

    document.querySelectorAll('.remove-kw').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
            currentEditingKeywords.splice(idx, 1);
            renderKeywordTags();
        });
    });
}

if (btnAddKeyword) {
    btnAddKeyword.addEventListener('click', () => {
        if (!keywordInput) return;
        const newKw = keywordInput.value.trim();
        if (newKw && !currentEditingKeywords.includes(newKw)) {
            currentEditingKeywords.push(newKw);
            keywordInput.value = '';
            renderKeywordTags();
        }
    });
}

if (keywordInput) {
    keywordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (btnAddKeyword) btnAddKeyword.click();
        }
    });
}

if (btnSaveKeywords) {
    btnSaveKeywords.addEventListener('click', async () => {
        btnSaveKeywords.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btnSaveKeywords.disabled = true;

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'SAVE_PROCEDURE_KEYWORDS',
                    fileId: currentEditingFileId,
                    keywords: currentEditingKeywords
                })
            });

            const data = await response.json();

            if (data.status === 'success') {
                // Aggiorna array locale
                const file = currentDriveFiles.find(f => f.id === currentEditingFileId);
                if (file) {
                    file.keywords = [...currentEditingKeywords];
                }
                // Chiudi modale e re-render
                if (keywordModal) keywordModal.classList.add('hidden');

                // Forza re-render con ricerca corrente
                if (driveViewerSearch) {
                    const event = new Event('input');
                    driveViewerSearch.dispatchEvent(event);
                } else {
                    renderDriveFiles(currentDriveFiles);
                }
            } else {
                alert('Errore salvataggio: ' + data.message);
            }
        } catch (error) {
            alert('Errore di rete al salvataggio.');
        } finally {
            btnSaveKeywords.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salva';
            btnSaveKeywords.disabled = false;
        }
    });
}

// Funzione globale per aprire i file Drive nativamente nell'iframe del portale
window.openDriveFile = function (url, title) {
    if (!url) return;
    // Rimosso il tentativo di apertura interna per problemi noti di X-Frame-Options con gli account Google su mobile.
    if (isIos()) {
        window.location.href = url;
    } else {
        window.open(url, '_blank');
    }
};


// ================= MODULI RAPIDI NATIVI =================

const moduliRapidiScreen = document.getElementById('moduli-rapidi-screen');

function openModuliRapidiNative() {
    hideHomeForFullscreenView();
    moduliRapidiScreen.classList.remove('hidden');
    goMenu(); // Torna sempre al menu principale all'apertura
    
    // Popola select dipendenti se non popolata
    const dipSelect = document.getElementById('dipSelect');
    if (dipSelect && dipSelect.options.length <= 1) {
        // Popola con il currentUser se disponibile
        const opt = document.createElement('option');
        opt.value = currentUser.id || currentUser.ID_UTENTE;
        opt.textContent = currentUser.nome;
        opt.selected = true;
        dipSelect.appendChild(opt);
        
        // Nascondi il loading che veniva da index.html di moduli extra
        const loadingDiv = document.getElementById('loading');
        if (loadingDiv) loadingDiv.classList.add('hidden');
        document.getElementById('menu').classList.remove('hidden');
    } else {
        const loadingDiv = document.getElementById('loading');
        if (loadingDiv) loadingDiv.classList.add('hidden');
        document.getElementById('menu').classList.remove('hidden');
    }
}

function closeModuliRapidi() {
    moduliRapidiScreen.classList.add('hidden');
    restoreHomeAfterFullscreenView();
}

function showForm(id) {
    document.getElementById('formTopbar').classList.remove('hidden');
    document.querySelectorAll('#forms-container .card').forEach(c => c.classList.add('hidden'));
    
    if (id !== 'suggerimenti') {
        const dipCard = document.getElementById('dipCard');
        if (dipCard) dipCard.classList.remove('hidden');
    }
    
    document.getElementById('form-' + id).classList.remove('hidden');
    document.getElementById('menu').classList.add('hidden');
    moduliRapidiScreen.scrollTo({ top: 0, behavior: 'smooth' });
}

function goMenu() {
    document.querySelectorAll('#forms-container .card').forEach(c => c.classList.add('hidden'));
    document.getElementById('formTopbar').classList.add('hidden');
    document.getElementById('menu').classList.remove('hidden');
    moduliRapidiScreen.scrollTo({ top: 0, behavior: 'smooth' });
}

function getDip() {
    const id = currentUser.id || currentUser.ID_UTENTE;
    const nome = currentUser.nome;
    if (!id) {
        alert("Errore: Utente non riconosciuto!");
        return null;
    }
    return { id, nome };
}

function setBtnLoading(btn, text) {
    btn.dataset.oldText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = text;
}

function resetBtn(btn) {
    btn.disabled = false;
    if (btn.dataset.oldText) btn.innerHTML = btn.dataset.oldText;
}

function getBase64(file) {
    return new Promise((res, rej) => {
        if (!file) return res('');
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.onerror = error => rej(error);
        reader.readAsDataURL(file);
    });
}

async function sendModuloRequest(moduloType, payload, btn) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'SUBMIT_MODULO',
                modulo: moduloType,
                payload: payload
            })
        });
        const data = await response.json();
        if (data.status === 'success') {
            alert('Richiesta inviata con successo!');
            goMenu(); // Torna al menu
            return true;
        } else {
            alert('Errore: ' + data.message);
            return false;
        }
    } catch (error) {
        alert('Errore di rete. Riprova più tardi.');
        return false;
    } finally {
        resetBtn(btn);
    }
}

async function inviaSuggerimento(btn) {
    const testo = document.getElementById('sug_testo').value.trim();
    if (!testo) return alert("Scrivi un suggerimento!");
    setBtnLoading(btn, 'INVIO...');
    const ok = await sendModuloRequest('suggerimenti', { testo }, btn);
    if (ok) document.getElementById('sug_testo').value = '';
}

async function inviaAttrezzi(btn) {
    const dip = getDip(); if (!dip) return;
    const desc = document.getElementById('att_desc').value.trim();
    if (!desc) return alert("Descrivi l'attrezzo!");
    const file = document.getElementById('att_foto').files[0];
    setBtnLoading(btn, 'INVIO IN CORSO...');
    const b64 = await getBase64(file);
    const ok = await sendModuloRequest('attrezzi', { id: dip.id, nome: dip.nome, descrizione: desc, fotoBase64: b64 }, btn);
    if (ok) { document.getElementById('att_desc').value = ''; document.getElementById('att_foto').value = ''; }
}

async function inviaMezzi(btn) {
    const dip = getDip(); if (!dip) return;
    const targa = document.getElementById('mez_targa').value.trim();
    const desc = document.getElementById('mez_desc').value.trim();
    if (!targa || !desc) return alert("Inserisci targa e descrizione!");
    const file = document.getElementById('mez_foto').files[0];
    setBtnLoading(btn, 'INVIO IN CORSO...');
    const b64 = await getBase64(file);
    const ok = await sendModuloRequest('mezzi', { id: dip.id, nome: dip.nome, targa: targa, descrizione: desc, fotoBase64: b64 }, btn);
    if (ok) { document.getElementById('mez_targa').value = ''; document.getElementById('mez_desc').value = ''; document.getElementById('mez_foto').value = ''; }
}

async function inviaPermessi(btn) {
    const dip = getDip(); if (!dip) return;
    const tipo = document.getElementById('per_tipo').value;
    const dal = document.getElementById('per_dal').value;
    const al = document.getElementById('per_al').value;
    if (!dal || !al) return alert("Inserisci le date!");
    setBtnLoading(btn, 'INVIO...');
    const ok = await sendModuloRequest('permessi', { id: dip.id, nome: dip.nome, tipologia: tipo, dal: dal, al: al, causale: document.getElementById('per_note').value }, btn);
    if (ok) { document.getElementById('per_dal').value = ''; document.getElementById('per_al').value = ''; document.getElementById('per_note').value = ''; }
}

async function inviaPausa(btn, min) {
    const dip = getDip(); if (!dip) return;
    setBtnLoading(btn, 'INVIO...');
    await sendModuloRequest('pausa', { id: dip.id, nome: dip.nome, minuti: min }, btn);
}





window.switchAdminTab = function(tabId) {
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        if(btn.getAttribute('onclick').includes(tabId)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        if(content.id === tabId) {
            content.classList.remove('hidden');
            content.classList.add('active');
        } else {
            content.classList.add('hidden');
            content.classList.remove('active');
        }
    });
};



window.navigateFolder = function(id, name) {
    driveNavStack.push({id: id, name: name});
    fetchDriveFiles(currentDriveType, id, name);
};

