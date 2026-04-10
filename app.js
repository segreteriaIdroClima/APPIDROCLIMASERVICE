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
const tableUtentiBody = document.querySelector('#table-utenti tbody');
const tableAppsBody = document.querySelector('#table-apps tbody');
const tableGruppiBody = document.getElementById('gruppi-body');
const tablePermessiHeader = document.getElementById('permessi-header');
const tablePermessiBody = document.getElementById('permessi-body');

// State
let currentUser = null;
let adminData = null; // { utenti, profili, apps, permessi }

// Registrazione Service Worker per PWA e Caching PWA Install
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    // Previeni apparizione banner automatico
    e.preventDefault();
    deferredPrompt = e;
    // Mostra il pulsante di installazione
    btnInstall.classList.remove('hidden');
});

btnInstall.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('PWA Installata dal bottone!');
        }
        deferredPrompt = null;
        btnInstall.classList.add('hidden');
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registrato', reg))
            .catch(err => console.error('Errore Service Worker', err));
    });
}

// Inizializzazione
function init() {
    // Controlla se c'è una sessione salvata
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

// Gestione Logout
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
        const card = document.createElement('a');
        card.className = 'app-card ' + (app.isAllowed ? '' : 'disabled');
        card.href = '#';

        if (app.isAllowed) {
            card.onclick = (e) => {
                e.preventDefault();
                if (app.link === 'native://timbrature') {
                    openTimbratureNative();
                } else {
                    openAppInIframe(app.nome, app.link);
                }
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
            showAdminScreen();
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

// Logica Apertura App in iFrame
function openAppInIframe(nome, url) {
    document.body.style.overflow = 'hidden'; // Blocca scroll corpo
    iframeTitle.textContent = nome;
    appIframe.src = url;
    iframeScreen.classList.remove('hidden');

    const wrapper = appIframe.parentElement;
    if (nome.toLowerCase().includes('tecnico')) {
        // Fix specifico per web app tecnico: abilita scroll morbido, forza limiti esatti
        wrapper.style.overflowY = 'auto';
        wrapper.style.overflowX = 'hidden';
        appIframe.style.width = '100%';
        appIframe.style.minWidth = '0';
        appIframe.style.maxWidth = '100%';
        appIframe.setAttribute('scrolling', 'yes');
    } else {
        // Comportamento standard per le altre app
        wrapper.style.overflow = 'hidden';
        appIframe.style.width = '1px';
        appIframe.style.minWidth = '100%';
        appIframe.style.maxWidth = '';
        appIframe.removeAttribute('scrolling');
    }
}

btnCloseIframe.addEventListener('click', () => {
    document.body.style.overflow = '';
    iframeScreen.classList.add('hidden');
    appIframe.src = ''; // Svuota per fermare processi in background
});

// ================= TIMBRATURE NATIVE LOGIC =================

const timbratureScreen = document.getElementById('timbrature-screen');
const btnCloseTimbrature = document.getElementById('btn-close-timbrature');
const timbratureLoading = document.getElementById('timbrature-loading');
const timbratureResult = document.getElementById('timbrature-result');

function openTimbratureNative() {
    document.body.style.overflow = 'hidden';
    timbratureScreen.classList.remove('hidden');
    timbratureLoading.classList.remove('hidden');
    timbratureResult.classList.add('hidden');
    timbratureResult.innerHTML = '';
    
    fetchMyTimbrature();
}

if (btnCloseTimbrature) {
    btnCloseTimbrature.addEventListener('click', () => {
        document.body.style.overflow = '';
        timbratureScreen.classList.add('hidden');
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
            timbratureResult.innerHTML = `<div class="error-msg" style="display:block;">${data.message || 'Errore nel recupero delle timbrature.'}</div>`;
            timbratureLoading.classList.add('hidden');
            timbratureResult.classList.remove('hidden');
        }
    } catch (error) {
        timbratureResult.innerHTML = `<div class="error-msg" style="display:block;">Errore di rete. Impossibile connettersi al server.</div>`;
        timbratureLoading.classList.add('hidden');
        timbratureResult.classList.remove('hidden');
    }
}

function renderTimbrature(data) {
    const tableHTML = `
        <h3 style="color:white; margin-bottom: 15px;">Mese: ${data.mese}/${data.anno} - <span style="color:var(--primary-color)">${data.nome}</span></h3>
        <p style="color:var(--text-muted); font-size:13px; margin-bottom:15px;">*Le doppie timbrature continue (< 15 min) sono tagliate per chiarezza.</p>
        <div class="table-responsive">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Giorno</th>
                        <th>Timbrature Valide</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.giorni.map(g => {
                        let pausaTesto = '';
                        if (g.stamps.length >= 4) {
                            let [h1, m1] = g.stamps[1].split(':');
                            let [h2, m2] = g.stamps[2].split(':');
                            let d1 = new Date(2000, 0, 1, h1, m1);
                            let d2 = new Date(2000, 0, 1, h2, m2);
                            let diffMins = Math.round((d2 - d1) / 60000);
                            if (diffMins > 0) {
                                let labelPausa = diffMins === 60 ? '1 ora' : (diffMins + ' min');
                                pausaTesto = `<br><span style="font-size: 11px; color: #f59e0b; padding-top: 3px; display: inline-block;">☕ Pausa: ${labelPausa}</span>`;
                            }
                        }

                        return `
                        <tr>
                            <td><strong>${g.key}</strong></td>
                            <td style="color:${g.stamps.length > 0 ? '#10b981' : 'var(--text-muted)'}; font-family:monospace; font-size:15px;">
                                ${g.stamps.length > 0 ? g.stamps.join(' - ') : '-'}
                                ${pausaTesto}
                            </td>
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
    homeScreen.classList.add('hidden');
    adminScreen.classList.remove('hidden');
    loadAdminData();
}

btnAdminBack.addEventListener('click', () => {
    adminScreen.classList.add('hidden');
    homeScreen.classList.remove('hidden');
    loadApps(); // ricarica le app nel caso i permessi siano cambiati
});

async function loadAdminData() {
    adminLoading.classList.remove('hidden');
    adminContent.classList.add('hidden');

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'GET_ADMIN_DATA', profile: currentUser.profilo })
        });
        const data = await response.json();

        if (data.status === 'success') {
            adminData = {
                utenti: data.utenti,
                profili: data.profili,
                apps: data.apps,
                permessi: data.permessi,
                dipendentiDisponibili: data.dipendentiDisponibili || []
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
    renderUtenti();
    renderAppsAdmin();
    renderGruppi();
    renderPermessi();
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

    tableUtentiBody.innerHTML = '';
    adminData.utenti.forEach((u, i) => {
        const tr = document.createElement('tr');

        let profiliOptions = adminData.profili.map(p =>
            `<option value="${p.ID_PROFILO}" ${p.ID_PROFILO === u.PROFILO ? 'selected' : ''}>${p.ID_PROFILO}</option>`
        ).join('');

        let isAttivo = (u.ATTIVO === true || u.ATTIVO === 'TRUE' || u.ATTIVO === 'Vero');

        tr.innerHTML = `
            <td><input type="text" value="${u.ID_UTENTE}" data-idx="${i}" data-field="ID_UTENTE" class="u-input" style="width:70px"></td>
            <td><input type="text" list="nomi-dipendenti" value="${u.NOME}" data-idx="${i}" data-field="NOME" class="u-input" placeholder="Libero o scegli..."></td>
            <td><input type="text" value="${u.USERNAME}" data-idx="${i}" data-field="USERNAME" class="u-input" style="width:100px"></td>
            <td><input type="text" value="${u.PASSWORD_HASH}" data-idx="${i}" data-field="PASSWORD_HASH" class="u-input" style="width:100px"></td>
            <td>
                <select data-idx="${i}" data-field="PROFILO" class="u-input">
                    ${profiliOptions}
                </select>
            </td>
            <td>
                <label class="toggle-switch">
                    <input type="checkbox" data-idx="${i}" data-field="ATTIVO" class="u-toggle" ${isAttivo ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </td>
            <td>
                <button class="btn-danger-small" onclick="removeUtente(${i})"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tableUtentiBody.appendChild(tr);
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

    tableAppsBody.innerHTML = '';
    adminData.apps.forEach((a, i) => {
        const tr = document.createElement('tr');
        let isAttiva = (a.ATTIVA === true || a.ATTIVA === 'TRUE' || a.ATTIVA === 'Vero');
        let isVis = (a.VISIBILE_HOME === true || a.VISIBILE_HOME === 'TRUE' || a.VISIBILE_HOME === 'Vero');

        tr.innerHTML = `
            <td><input type="text" value="${a.ID_APP}" data-idx="${i}" data-field="ID_APP" class="a-input" style="width:80px"></td>
            <td><input type="text" value="${a.NOME_APP}" data-idx="${i}" data-field="NOME_APP" class="a-input"></td>
            <td><input type="text" value="${a.LINK_DEPLOYMENT}" data-idx="${i}" data-field="LINK_DEPLOYMENT" class="a-input" style="width:150px"></td>
            <td><input type="text" list="icone-list" value="${a.ICONA}" data-idx="${i}" data-field="ICONA" class="a-input" style="width:100px" placeholder="Seleziona icona..."></td>
            <td>
                <label class="toggle-switch">
                    <input type="checkbox" data-idx="${i}" data-field="ATTIVA" class="a-toggle" ${isAttiva ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </td>
            <td>
                <label class="toggle-switch">
                    <input type="checkbox" data-idx="${i}" data-field="VISIBILE_HOME" class="a-toggle" ${isVis ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </td>
            <td>
                <button class="btn-danger-small" onclick="removeApp(${i})"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tableAppsBody.appendChild(tr);
    });

    document.querySelectorAll('.a-input').forEach(el => el.addEventListener('change', updateAppData));
    document.querySelectorAll('.a-toggle').forEach(el => el.addEventListener('change', updateAppData));
}

function renderGruppi() {
    if (!tableGruppiBody) return;
    tableGruppiBody.innerHTML = '';
    adminData.profili.forEach((g, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" value="${g.ID_PROFILO || ''}" data-idx="${i}" data-field="ID_PROFILO" class="g-input" style="width:100px"></td>
            <td><input type="text" value="${g.DESCRIZIONE || ''}" data-idx="${i}" data-field="DESCRIZIONE" class="g-input"></td>
            <td>
                <button class="btn-danger-small" onclick="removeGruppo(${i})"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tableGruppiBody.appendChild(tr);
    });

    document.querySelectorAll('.g-input').forEach(el => el.addEventListener('change', updateGruppoData));
}

function updateGruppoData(e) {
    let idx = e.target.getAttribute('data-idx');
    let field = e.target.getAttribute('data-field');
    adminData.profili[idx][field] = e.target.value;
    
    // Se modifichiamo ID di un gruppo, aggiorniamo i selettori degli utenti
    if(field === 'ID_PROFILO') renderUtenti();
}

window.removeGruppo = function (idx) {
    if (confirm("Sei sicuro di eliminare questo gruppo?")) {
        adminData.profili.splice(idx, 1);
        renderGruppi();
        renderUtenti(); // aggiorna select
    }
};

if(btnAddGroup) {
    btnAddGroup.addEventListener('click', () => {
        adminData.profili.push({
            ID_PROFILO: 'NUOVO_GRUPPO', DESCRIZIONE: 'Descrizione'
        });
        renderGruppi();
        renderUtenti();
    });
}

function updateUtenteData(e) {
    let idx = e.target.getAttribute('data-idx');
    let field = e.target.getAttribute('data-field');
    adminData.utenti[idx][field] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
}

function updateAppData(e) {
    let idx = e.target.getAttribute('data-idx');
    let field = e.target.getAttribute('data-field');
    adminData.apps[idx][field] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;

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

btnAddUser.addEventListener('click', () => {
    let newId = 'U' + String(adminData.utenti.length + 1).padStart(3, '0');
    adminData.utenti.push({
        ID_UTENTE: newId, NOME: 'Nuovo Utente', USERNAME: 'nuovouser', PASSWORD_HASH: 'pass123',
        PROFILO: 'UFFICIO', ATTIVO: true, IS_ADMIN: false, NOTE: ''
    });
    renderUtenti();
});

btnAddApp.addEventListener('click', () => {
    adminData.apps.push({
        ID_APP: 'NUOVA_APP', NOME_APP: 'Nuova App', LINK_DEPLOYMENT: 'https://',
        DESCRIZIONE: '', ICONA: 'fa-globe', ORDINE: 99, ATTIVA: true, VISIBILE_HOME: true, COLORE_BADGE: '#10b981', NOTE: ''
    });
    renderAppsAdmin();
    renderPermessi();
});

function renderPermessi() {
    let appsDisponibili = adminData.apps.filter(app => app.ATTIVA === true || app.ATTIVA === 'TRUE' || app.ATTIVA === 'Vero');
    tablePermessiHeader.innerHTML = '<th>Utente</th>' + appsDisponibili.map(app => `<th>${app.NOME_APP}</th>`).join('');

    tablePermessiBody.innerHTML = '';
    adminData.utenti.forEach(utente => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${utente.NOME} (${utente.ID_UTENTE})</strong></td>`;

        appsDisponibili.forEach(app => {
            let hasPerm = false;
            // CONTROLLO SU ID_UTENTE INVECE DI ID_PROFILO
            let permIndex = adminData.permessi.findIndex(p => p.ID_UTENTE === utente.ID_UTENTE && p.ID_APP === app.ID_APP);

            if (permIndex > -1) {
                let pval = adminData.permessi[permIndex].ABILITATO;
                hasPerm = (pval === true || pval === 'TRUE' || pval === 'Vero' || pval === 'SÌ');
            } else {
                adminData.permessi.push({
                    ID_UTENTE: utente.ID_UTENTE,
                    ID_APP: app.ID_APP,
                    ABILITATO: false
                });
                permIndex = adminData.permessi.length - 1;
            }

            tr.innerHTML += `
                <td>
                    <label class="toggle-switch">
                        <input type="checkbox" onchange="updatePermesso(${permIndex}, this)" ${hasPerm ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </td>
            `;
        });
        tablePermessiBody.appendChild(tr);
    });
}

window.updatePermesso = function (idx, el) {
    adminData.permessi[idx].ABILITATO = el.checked;
};

btnAdminSave.addEventListener('click', async () => {
    btnAdminSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btnAdminSave.disabled = true;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'SAVE_ADMIN_DATA',
                utenti_aggiornati: adminData.utenti,
                apps_aggiornate: adminData.apps,
                profili_aggiornati: adminData.profili,
                permessi_aggiornati: adminData.permessi
            })
        });
        const data = await response.json();
        if (data.status === 'success') {
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
