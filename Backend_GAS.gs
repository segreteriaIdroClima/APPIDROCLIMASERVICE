const SPREADSHEET_ID = '1bIPwd5a99ed_hhOjXeCwpzm2WnBMCe7uJ0oYEwijMn8';



function doGet(e) {
  return createJsonResponse({ status: "success", message: "API Backend Portale Attiva." });
}

function doPost(e) {
  try {
    const defaultResponse = {"status": "error", "message": "Nessuna azione specificata"};
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse(defaultResponse);
    }

    const request = JSON.parse(e.postData.contents);
    const action = request.action;

    if (action === 'LOGIN') {
      return handleLogin(request);
    } else if (action === 'GET_USER_DATA') {
      return handleGetUserData(request);
    } else if (action === 'GET_ADMIN_DATA') {
      return handleGetAdminData(request);
    } else if (action === 'SAVE_ADMIN_DATA') {
      return handleSaveAdminData(request);
    } else if (action === 'GET_MY_TIMBRATURE') {
      return handleGetMyTimbrature(request);
    } else if (action === 'GET_MONITOR_DATA') {
      return handleGetMonitorData(request);
    } else {
      return createJsonResponse({"status": "error", "message": "Azione non valida."});
    }

  } catch (error) {
    return createJsonResponse({"status": "error", "message": error.toString()});
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ================= HANDLERS ================= //

function handleLogin(request) {
  const username = request.username;
  const password = request.password; // Nel DB dovrebbe esservi l'hash o testo, assumiamo check diretto qua

  if (!username || !password) {
    return createJsonResponse({ status: 'error', message: 'Username e Password richiesti.' });
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetUtenti = ss.getSheetByName('UTENTI');
  const dataUtenti = sheetUtenti.getDataRange().getValues();
  const headerUtenti = dataUtenti[0];

  const idxUser = headerUtenti.indexOf('USERNAME');
  const idxPass = headerUtenti.indexOf('PASSWORD_HASH'); // assuming plain pass for simplicity or simple hash
  const idxIdUtente = headerUtenti.indexOf('ID_UTENTE');
  const idxNome = headerUtenti.indexOf('NOME');
  const idxProfilo = headerUtenti.indexOf('PROFILO');
  const idxAttivo = headerUtenti.indexOf('ATTIVO');
  const idxAdmin = headerUtenti.indexOf('IS_ADMIN');

  for (let i = 1; i < dataUtenti.length; i++) {
    const row = dataUtenti[i];
    if (row[idxUser] === username && row[idxPass] === password) {
      if (row[idxAttivo] !== true && row[idxAttivo] !== 'TRUE' && row[idxAttivo] !== 'Vero' && row[idxAttivo] !== 'SÌ') {
        return createJsonResponse({ status: 'error', message: 'Utente non attivo.' });
      }

      // Genero un "token" simulato (es: base64 dell'id) per sessione statica
      const token = Utilities.base64Encode(row[idxIdUtente] + "_" + new Date().getTime());
      
      return createJsonResponse({
        status: 'success',
        token: token,
        user: {
          id: row[idxIdUtente],
          nome: row[idxNome],
          profilo: row[idxProfilo], // Deve coincidere con un ID_PROFILO
          isAdmin: row[idxAdmin]
        }
      });
    }
  }

  return createJsonResponse({ status: 'error', message: 'Credenziali non valide.' });
}

function handleGetUserData(request) {
  const userId = request.userId; // ID utente loggato

  if (!userId) {
    return createJsonResponse({ status: 'error', message: 'Utente non specificato.' });
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // 1. Get tutte le app
  const sheetApps = ss.getSheetByName('WEB_APPS');
  const dataApps = sheetApps.getDataRange().getValues();
  const headerApps = dataApps.shift();
  
  const apps = dataApps.map(row => {
    let app = {};
    headerApps.forEach((col, index) => {
      app[col] = row[index];
    });
    return app;
  });

  // 2. Get permessi per il profilo
  const sheetPerms = ss.getSheetByName('PERMESSI_APP');
  const dataPerms = sheetPerms.getDataRange().getValues();
  const headerPerms = dataPerms.shift();

  const idxPermUser = headerPerms.indexOf('ID_UTENTE');
  const idxPermApp = headerPerms.indexOf('ID_APP');
  const idxPermAbil = headerPerms.indexOf('ABILITATO');

  // Quali app sono abilitate per questo utente?
  const allowedAppIds = [];
  dataPerms.forEach(row => {
    if (row[idxPermUser] === userId) {
      let isAbilitato = row[idxPermAbil];
      if (isAbilitato === true || isAbilitato === 'TRUE' || isAbilitato === 'Vero' || isAbilitato === 'SÌ') {
        allowedAppIds.push(row[idxPermApp]);
      }
    }
  });

  // Filtriamo e completiamo le app da mandare al frontend
  const finalApps = apps.filter(app => (app.ATTIVA === true || app.ATTIVA === 'TRUE' || app.ATTIVA === 'Vero') && (app.VISIBILE_HOME === true || app.VISIBILE_HOME === 'TRUE' || app.VISIBILE_HOME === 'Vero'))
    .map(app => {
      return {
        id: app.ID_APP,
        nome: app.NOME_APP,
        link: app.LINK_DEPLOYMENT,
        descrizione: app.DESCRIZIONE,
        icona: app.ICONA, // Es. icona FontAwesome o material
        ordine: app.ORDINE || 99,
        colore: app.COLORE_BADGE,
        isAllowed: allowedAppIds.includes(app.ID_APP)
      };
    })
    .sort((a, b) => a.ordine - b.ordine);

  return createJsonResponse({
    status: 'success',
    apps: finalApps
  });
}

// ================= ADMIN HANDLERS ================= //

function handleGetAdminData(request) {
  // Check if user is actually admin
  if (request.profile !== 'ADMIN') { // Simplification, could be more robust
     return createJsonResponse({ status: 'error', message: 'Accesso negato.' });
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // 1. Get Users
  const dataUtenti = ss.getSheetByName('UTENTI').getDataRange().getValues();
  const headerUtenti = dataUtenti.shift();
  const utenti = dataUtenti.map(row => {
    let obj = {};
    headerUtenti.forEach((col, idx) => obj[col] = row[idx]);
    return obj;
  });

  // 2. Get Profiles
  const dataProfili = ss.getSheetByName('PROFILI').getDataRange().getValues();
  const headerProfili = dataProfili.shift();
  const profili = dataProfili.map(row => {
    let obj = {};
    headerProfili.forEach((col, idx) => obj[col] = row[idx]);
    return obj;
  });

  // 3. Get Apps
  const dataApps = ss.getSheetByName('WEB_APPS').getDataRange().getValues();
  const headerApps = dataApps.shift();
  const apps = dataApps.map(row => {
    let obj = {};
    headerApps.forEach((col, idx) => obj[col] = row[idx]);
    return obj;
  });

  // 4. Get Permissions
  const dataPerms = ss.getSheetByName('PERMESSI_APP').getDataRange().getValues();
  const headerPerms = dataPerms.shift();
  const permessi = dataPerms.map(row => {
    let obj = {};
    headerPerms.forEach((col, idx) => obj[col] = row[idx]);
    return obj;
  });

  // 5. Get Nomi dipendenti liberi da app Personale (per UI Admin)
  let dipendentiDisponibili = [];
  try {
    const ssPersonale = SpreadsheetApp.openById('1PNaA_ummrQMev-aijzIzVPyvzSWzvLABXUriV-nwxAw');
    const shDip = ssPersonale.getSheetByName('DIPENDENTI');
    if (shDip) {
      const dipData = shDip.getDataRange().getValues();
      const dipHeader = dipData.shift().map(h => String(h).toUpperCase());
      const idxDipNome = dipHeader.indexOf('NOME');
      const idxDipAttivo = dipHeader.indexOf('ATTIVO');
      
      const inUseNames = utenti.map(u => String(u['NOME'] || '').trim().toUpperCase());
      
      dipData.forEach(row => {
        let nome = String(row[idxDipNome] || '').trim();
        let att = String(row[idxDipAttivo] || '').toUpperCase();
        if (nome && att !== 'NO' && att !== 'FALSE') {
          if (!inUseNames.includes(nome.toUpperCase())) {
            dipendentiDisponibili.push(nome);
          }
        }
      });
    }
  } catch(e) {}

  return createJsonResponse({
    status: 'success',
    utenti: utenti,
    profili: profili,
    apps: apps,
    permessi: permessi,
    dipendentiDisponibili: dipendentiDisponibili
  });
}

function handleSaveAdminData(request) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  try {
    // Aggiorna Utenti
    if (request.utenti_aggiornati && request.utenti_aggiornati.length > 0) {
      const sheetUtenti = ss.getSheetByName('UTENTI');
      const dataUtenti = sheetUtenti.getDataRange().getValues();
      const headerUtenti = dataUtenti[0];
      const newDatiUtenti = request.utenti_aggiornati;

      // Crea matrice 2D da rimpiazzare da riga 2
      const matrix = newDatiUtenti.map(u => {
        return headerUtenti.map(h => {
          // Convert string "true"/"false" to boolean
          let val = u[h];
          if (val === 'true') return true;
          if (val === 'false') return false;
          return val;
        });
      });

      // Clear from row 2
      if(sheetUtenti.getLastRow() > 1) {
        sheetUtenti.getRange(2, 1, sheetUtenti.getLastRow() - 1, sheetUtenti.getLastColumn()).clearContent();
      }
      if (matrix.length > 0) {
        sheetUtenti.getRange(2, 1, matrix.length, matrix[0].length).setValues(matrix);
      }
    }

    // Aggiorna Web Apps se modificato nel pannello Admin
    if (request.apps_aggiornate && request.apps_aggiornate.length > 0) {
      const sheetApps = ss.getSheetByName('WEB_APPS');
      const dataApps = sheetApps.getDataRange().getValues();
      const headerApps = dataApps[0];
      const newDatiApps = request.apps_aggiornate;

      const matrixApps = newDatiApps.map(a => {
        return headerApps.map(h => {
          let val = a[h];
          if (val === 'true') return true;
          if (val === 'false') return false;
          return val;
        });
      });

      if(sheetApps.getLastRow() > 1) {
        sheetApps.getRange(2, 1, sheetApps.getLastRow() - 1, sheetApps.getLastColumn()).clearContent();
      }
      if (matrixApps.length > 0) {
        sheetApps.getRange(2, 1, matrixApps.length, matrixApps[0].length).setValues(matrixApps);
      }
    }

    // Aggiorna Permessi
    if (request.permessi_aggiornati) { // puo essere array vuoto se tolgono tutti i permessi
      const sheetPerms = ss.getSheetByName('PERMESSI_APP');
      const dataPerms = sheetPerms.getDataRange().getValues();
      const headerPerms = dataPerms[0];
      const newPerms = request.permessi_aggiornati;

      const matrixPerms = newPerms.map(p => {
        return headerPerms.map(h => {
          let val = p[h];
          if (val === 'true') return true;
          if (val === 'false') return false;
          return val;
        });
      });

      if(sheetPerms.getLastRow() > 1) {
        sheetPerms.getRange(2, 1, sheetPerms.getLastRow() - 1, sheetPerms.getLastColumn()).clearContent();
      }
      if (matrixPerms.length > 0) {
        sheetPerms.getRange(2, 1, matrixPerms.length, matrixPerms[0].length).setValues(matrixPerms);
      }
    }

    return createJsonResponse({ status: 'success', message: 'Dati aggiornati correttamente' });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

// ================= TIMBRATURE PERSONALI HANDLER ================= //
function handleGetMyTimbrature(request) {
  const nomeUtente = String(request.nome || '').trim().toUpperCase();
  if (!nomeUtente) return createJsonResponse({status: 'error', message: 'Nome utente mancante.'});

  try {
    const FILE_TIMBRATURE_ID = '1PNaA_ummrQMev-aijzIzVPyvzSWzvLABXUriV-nwxAw';
    const ssPersonale = SpreadsheetApp.openById(FILE_TIMBRATURE_ID);
    
    // Cerca ID del dipendente dal foglio
    const shDip = ssPersonale.getSheetByName('DIPENDENTI');
    if (!shDip) return createJsonResponse({status: 'error', message: 'Impossibile accedere al database Dipendenti.'});
    
    const dipData = shDip.getDataRange().getValues();
    const dipHeader = dipData.shift().map(h => String(h).toUpperCase());
    const idxDipId = dipHeader.indexOf('ID');
    const idxDipNome = dipHeader.indexOf('NOME');
    
    let userDipId = null;
    let actualName = "";
    for (let i = 0; i < dipData.length; i++) {
       if (String(dipData[i][idxDipNome]).trim().toUpperCase() === nomeUtente) {
           userDipId = String(dipData[i][idxDipId]).trim();
           actualName = String(dipData[i][idxDipNome]).trim();
           break;
       }
    }

    if (!userDipId) {
      return createJsonResponse({status: 'error', message: 'Non disponibile: il tuo account non è abbinato a un utente che effettua timbrature sul gestionale.'});
    }

    // Leggi TIMBRATURE
    const shTimb = ssPersonale.getSheetByName('TIMBRATURE');
    if (!shTimb) return createJsonResponse({status: 'error', message: 'Foglio TIMBRATURE non trovato database limit.'});
    
    const tData = shTimb.getDataRange().getValues();
    const tHeader = tData.shift().map(h => String(h).toUpperCase());
    const idxTimbId = tHeader.indexOf('ID');

    let idxTimbDate = tHeader.indexOf('DATA/ORA');
    if (idxTimbDate === -1) idxTimbDate = tHeader.indexOf('TIMESTAMP');
    if (idxTimbDate === -1) idxTimbDate = tHeader.indexOf('DATE');
    
    const now = new Date();
    const tz = Session.getScriptTimeZone() || 'Europe/Rome';
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    
    let rawTimbrature = [];
    
    // Trova le timbrature del mese corrente
    for(let r = 0; r < tData.length; r++) {
       let currId = String(tData[r][idxTimbId]).trim();
       if (currId === userDipId) {
           let d = tData[r][idxTimbDate];
           if (d && Object.prototype.toString.call(d) === '[object Date]' && !isNaN(d.getTime())) {
               if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
                   rawTimbrature.push(d);
               }
           }
       }
    }
    
    // Ordina in senso cronologico
    rawTimbrature.sort((a,b) => a.getTime() - b.getTime());
    
    // Logica Pulizia (<15 minuti, "bip" duplicati)
    let cleaned = [];
    if (rawTimbrature.length > 0) {
      let lastAdmitted = rawTimbrature[0];
      cleaned.push(lastAdmitted);
      for (let i = 1; i < rawTimbrature.length; i++) {
        let curr = rawTimbrature[i];
        let diffMin = (curr.getTime() - lastAdmitted.getTime()) / 60000;
        if (diffMin >= 15) {
          cleaned.push(curr);
          lastAdmitted = curr;
        }
      }
    }
    
    // Struttura a Mappa per giorno
    let outputMap = {};
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
       let dateObj = new Date(currentYear, currentMonth, d, 12, 0, 0); // midi avoid tz shifts
       let key = Utilities.formatDate(dateObj, tz, 'dd/MM/yyyy');
       outputMap[key] = { day: d, stamps: [] };
    }
    
    // Popola
    cleaned.forEach(ct => {
       let k = Utilities.formatDate(ct, tz, 'dd/MM/yyyy');
       let hm = Utilities.formatDate(ct, tz, 'HH:mm');
       if (outputMap[k]) {
          outputMap[k].stamps.push(hm);
       }
    });

    let daysArray = Object.keys(outputMap).map(k => ({
       key: k,
       day: outputMap[k].day,
       stamps: outputMap[k].stamps
    })).sort((a,b) => a.day - b.day);

    return createJsonResponse({
       status: 'success',
       nome: actualName,
       anno: currentYear,
       mese: currentMonth + 1, // 1-12
       giorni: daysArray
    });

  } catch (e) {
    return createJsonResponse({status: 'error', message: 'Errore estrazione timbrature. ' + e.toString()});
  }
}

// ================= MONITORAGGIO GAS SCANNER ================= //

/**
 * Endpoint per la PWA per recuperare i dati del monitoraggio
 */
function handleGetMonitorData(request) {
  if (request.profile !== 'ADMIN') {
     return createJsonResponse({ status: 'error', message: 'Accesso negato.' });
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('MONITOR_SISTEMA');
  
  if (!sheet) {
    return createJsonResponse({ status: 'error', message: 'Dati monitoraggio non ancora inizializzati. Esegui una scansione manuale.' });
  }

  const data = sheet.getDataRange().getValues();
  const lastUpdated = data[0][1]; // Assumiamo in A1 c'è "Ultimo Aggiornamento" e in B1 il valore
  
  const header = data[1];
  const appsData = [];
  for (let i = 2; i < data.length; i++) {
    let obj = {};
    header.forEach((col, idx) => obj[col] = data[i][idx]);
    appsData.push(obj);
  }

  // Quota Email Rimanente
  const emailQuota = MailApp.getRemainingDailyQuota();

  return createJsonResponse({
    status: 'success',
    lastUpdated: lastUpdated,
    apps: appsData,
    emailQuota: emailQuota,
    limits: {
      runtime: 360,     // min/giorno (6h)
      emails: 1500,     // msg/giorno
      urlFetch: 100000, // calls/giorno
      triggers: 20      // per script
    }
  });
}

/**
 * Funzione principale dello scanner (da attivare con trigger orario)
 */
function scanner_hourlyAudit() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('MONITOR_SISTEMA');
  if (!sheet) {
    sheet = ss.insertSheet('MONITOR_SISTEMA');
    sheet.getRange("A1").setValue("Ultimo Aggiornamento");
    sheet.getRange("A2:H2").setValues([["NOME", "ID", "POSIZIONE", "URL", "ESECUZIONI_7G", "ERRORI_7G", "ERROR_RATE", "ULTIMO_RUN"]]);
    sheet.getRange("A2:H2").setFontWeight("bold").setBackground("#f1f5f9");
  }

  const results = [];
  const now = new Date();
  
  // 1. Cerca tutti i file Script nel Drive
  const query = "mimeType = 'application/vnd.google-apps.script' and trashed = false";
  const files = DriveApp.searchFiles(query);
  
  while (files.hasNext()) {
    const file = files.next();
    const id = file.getId();
    const name = file.getName();
    const url = `https://script.google.com/home/projects/${id}/edit`;
    
    // Costruisci il percorso Drive
    const path = scanner_getPath(file);
    
    // Tenta di recuperare metriche tramite Apps Script API (Script.projects.getMetrics)
    // Nota: richiede servizio avanzato Script abilitato o UrlFetchApp a endpoints API
    let metrics = { total: 0, failed: 0 };
    try {
      metrics = scanner_getMetricsFromAPI(id);
    } catch(e) {
      console.warn("Impossibile recuperare metriche per " + name + ": " + e.message);
    }
    
    const errorRate = metrics.total > 0 ? (metrics.failed / metrics.total * 100).toFixed(1) : 0;
    
    results.push([
      name, 
      id, 
      path, 
      url, 
      metrics.total, 
      metrics.failed, 
      errorRate + "%",
      now
    ]);
  }

  // 2. Aggiorna il foglio
  sheet.getRange(1, 2).setValue(now);
  if (sheet.getLastRow() > 2) {
    sheet.getRange(3, 1, sheet.getLastRow() - 2, sheet.getLastColumn()).clearContent();
  }
  if (results.length > 0) {
    sheet.getRange(3, 1, results.length, results[0].length).setValues(results);
  }
}

/**
 * Helper per risalire alle cartelle
 */
function scanner_getPath(file) {
  const path = [];
  let currentParent = file.getParents();
  
  while (currentParent.hasNext()) {
    const p = currentParent.next();
    path.unshift(p.getName());
    // Per semplicità prendiamo solo il primo ramo se presente in più cartelle
    currentParent = p.getParents();
  }
  
  return path.length > 0 ? "Mio Drive > " + path.join(" > ") : "Mio Drive";
}

/**
 * Chiama l'Apps Script API per ottenere metriche di esecuzione
 */
function scanner_getMetricsFromAPI(scriptId) {
  const token = ScriptApp.getOAuthToken();
  const url = `https://script.googleapis.com/v1/projects/${scriptId}/metrics`;
  
  const options = {
    method: "get",
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) return { total: 0, failed: 0 };
  
  const json = JSON.parse(response.getContentText());
  
  // Somma le esecuzioni totali e fallite dai dati ritornati (solitamente ultimi 7 giorni in serie temporale)
  let total = 0;
  let failed = 0;
  
  if (json.totalExecutions) {
    json.totalExecutions.forEach(m => total += parseInt(m.value || 0));
  }
  if (json.failedExecutions) {
    json.failedExecutions.forEach(m => failed += parseInt(m.value || 0));
  }
  
  return { total: total, failed: failed };
}

/**
 * Funzione di setup iniziale (da lanciare una volta a mano)
 */
function scanner_setupTrigger() {
  // Elimina vecchi trigger simili
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'scanner_hourlyAudit') ScriptApp.deleteTrigger(t);
  });
  
  // Crea nuovo trigger orario
  ScriptApp.newTrigger('scanner_hourlyAudit')
    .timeBased()
    .everyHours(1)
    .create();
    
  // Esegui prima scansione subito
  scanner_hourlyAudit();
  
  return "Trigger impostato e prima scansione completata!";
}

