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
const btnLogout = document.getElementById('btn-logout');
const userGreeting = document.getElementById('user-greeting');
const appsContainer = document.getElementById('apps-container');
const loadingApps = document.getElementById('loading-apps');

// Elementi Admin
const adminScreen = document.getElementById('admin-screen');
const btnAdminBack = document.getElementById('btn-admin-back');
const btnAdminSave = document.getElementById('btn-admin-save');
const adminLoading = document.getElementById('admin-loading');
const adminContent = document.getElementById('admin-content');
const tableUtentiBody = document.querySelector('#table-utenti tbody');
const tablePermessiHeader = document.getElementById('permessi-header');
const tablePermessiBody = document.getElementById('permessi-body');

// State
let currentUser = null;
let adminData = null; // { utenti, profili, apps, permessi }

// Registrazione Service Worker per PWA
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
                profile: currentUser.profilo
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

        // Se permesso, aggiungi href target. Altrimenti apri alert null.
        if (app.isAllowed) {
            // Per aprire nella stessa PWA (come finestra) usa target="_self" o "_blank"
            // Se si vuole che la web app sostituisca la schermata, usa "_self"
            card.href = app.link;
            card.target = "_self";
        } else {
            card.onclick = (e) => {
                e.preventDefault();
                alert(`Accesso non abilitato al profilo '${currentUser.profilo}' per questa App.`);
            };
        }

        // Determina icona, default: fa-folder
        const iconClass = app.icona ? app.icona : 'fa-folder';
        // Determina colore, default azzurro
        const iconColor = app.colore ? app.colore : 'var(--primary-color)';

        card.innerHTML = `
            <div class="app-icon" style="background-color: ${iconColor};">
                <i class="${iconClass.includes('fa-') ? 'fa-solid ' + iconClass : 'fa-solid fa-folder'}"></i>
            </div>
            <div class="app-title">${app.nome}</div>
            ${!app.isAllowed ? '<div class="app-badge"><i class="fa-solid fa-lock"></i></div>' : ''}
        `;

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
                permessi: data.permessi
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
    // 1. Riempi Tabella Utenti
    tableUtentiBody.innerHTML = '';
    adminData.utenti.forEach((u, i) => {
        const tr = document.createElement('tr');

        // Creazione options per profili
        let profiliOptions = adminData.profili.map(p =>
            `<option value="${p.ID_PROFILO}" ${p.ID_PROFILO === u.PROFILO ? 'selected' : ''}>${p.ID_PROFILO}</option>`
        ).join('');

        let isAttivo = (u.ATTIVO === true || u.ATTIVO === 'TRUE' || u.ATTIVO === 'Vero');

        tr.innerHTML = `
            <td>${u.ID_UTENTE}</td>
            <td>${u.NOME} (${u.USERNAME})</td>
            <td>
                <select class="admin-select-profilo" data-index="${i}">
                    ${profiliOptions}
                </select>
            </td>
            <td>
                <label class="toggle-switch">
                    <input type="checkbox" class="admin-toggle-attivo" data-index="${i}" ${isAttivo ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </td>
        `;
        tableUtentiBody.appendChild(tr);
    });

    // 2. Riempi Tabella Permessi
    // IntestazioneColonne = Profilo + [App 1, App 2...]
    let appsDisponibili = adminData.apps.filter(app => app.ATTIVA === true || app.ATTIVA === 'TRUE' || app.ATTIVA === 'Vero');
    tablePermessiHeader.innerHTML = '<th>Profilo</th>' + appsDisponibili.map(app => `<th>${app.NOME_APP}</th>`).join('');

    // Righe = Profili
    tablePermessiBody.innerHTML = '';
    adminData.profili.forEach(profilo => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${profilo.ID_PROFILO}</strong></td>`;

        appsDisponibili.forEach(app => {
            // Cerca se esiste un record nei permessi correnti
            let hasPerm = false;
            let permIndex = adminData.permessi.findIndex(p => p.ID_PROFILO === profilo.ID_PROFILO && p.ID_APP === app.ID_APP);

            if (permIndex > -1) {
                let pval = adminData.permessi[permIndex].ABILITATO;
                hasPerm = (pval === true || pval === 'TRUE' || pval === 'Vero' || pval === 'SÌ');
            } else {
                // Genera permesso di default falso nella copia locale (per il save)
                adminData.permessi.push({
                    ID_PROFILO: profilo.ID_PROFILO,
                    ID_APP: app.ID_APP,
                    ABILITATO: false
                });
                permIndex = adminData.permessi.length - 1;
            }

            tr.innerHTML += `
                <td>
                    <label class="toggle-switch">
                        <input type="checkbox" class="admin-toggle-permesso" data-perm-index="${permIndex}" ${hasPerm ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </td>
            `;
        });
        tablePermessiBody.appendChild(tr);
    });
}

btnAdminSave.addEventListener('click', async () => {
    btnAdminSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btnAdminSave.disabled = true;

    // Raccogli stato attuale interfaccia per utenti
    document.querySelectorAll('.admin-select-profilo').forEach(sel => {
        let idx = sel.getAttribute('data-index');
        adminData.utenti[idx].PROFILO = sel.value;
    });
    document.querySelectorAll('.admin-toggle-attivo').forEach(chk => {
        let idx = chk.getAttribute('data-index');
        adminData.utenti[idx].ATTIVO = chk.checked;
    });

    // Raccogli stato attuale per i permessi
    document.querySelectorAll('.admin-toggle-permesso').forEach(chk => {
        let pidx = chk.getAttribute('data-perm-index');
        adminData.permessi[pidx].ABILITATO = chk.checked;
    });

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'SAVE_ADMIN_DATA',
                utenti_aggiornati: adminData.utenti,
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
