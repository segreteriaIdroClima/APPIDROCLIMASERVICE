const SPREADSHEET_ID = '1bIPwd5a99ed_hhOjXeCwpzm2WnBMCe7uJ0oYEwijMn8';
const FILE_TIMBRATURE_ID = '1PNaA_ummrQMev-aijzIzVPyvzSWzvLABXUriV-nwxAw';



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
    } else if (action === 'GET_DRIVE_FILES') {
      return handleGetDriveFiles(request);
    } else if (action === 'SAVE_PROCEDURE_KEYWORDS') {
      return handleSaveProcedureKeywords(request);
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

function isAdminRequest(request) {
  const adminUserId = request.adminUserId;
  if (!adminUserId) {
    return request.profile === 'ADMIN';
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetUtenti = ss.getSheetByName('UTENTI');
  const dataUtenti = sheetUtenti.getDataRange().getValues();
  const headerUtenti = dataUtenti[0];
  const idxIdUtente = headerUtenti.indexOf('ID_UTENTE');
  const idxAdmin = headerUtenti.indexOf('IS_ADMIN');
  const idxAttivo = headerUtenti.indexOf('ATTIVO');

  for (let i = 1; i < dataUtenti.length; i++) {
    const row = dataUtenti[i];
    const isSameUser = String(row[idxIdUtente]) === String(adminUserId);
    const isAdmin = row[idxAdmin] === true || row[idxAdmin] === 'TRUE' || row[idxAdmin] === 'Vero' || row[idxAdmin] === 'SI' || row[idxAdmin] === 'SÌ';
    const isActive = row[idxAttivo] === true || row[idxAttivo] === 'TRUE' || row[idxAttivo] === 'Vero' || row[idxAttivo] === 'SI' || row[idxAttivo] === 'SÌ';
    if (isSameUser && isAdmin && isActive) {
      return true;
    }
  }

  return false;
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
  const idxCanEditProc = headerUtenti.indexOf('CAN_EDIT_PROCEDURE');

  for (let i = 1; i < dataUtenti.length; i++) {
    const row = dataUtenti[i];
    if (row[idxUser] === username && row[idxPass] === password) {
      if (row[idxAttivo] !== true && row[idxAttivo] !== 'TRUE' && row[idxAttivo] !== 'Vero' && row[idxAttivo] !== 'SÃŒ') {
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
          isAdmin: row[idxAdmin],
          canEditProcedure: idxCanEditProc > -1 ? (row[idxCanEditProc] === true || row[idxCanEditProc] === 'TRUE' || row[idxCanEditProc] === 'Vero' || row[idxCanEditProc] === 'SÃŒ') : false
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

  // 2. Recupera il profilo dell'utente dalla tabella UTENTI (se serve ad altri scopi)
  const sheetUsers = ss.getSheetByName('UTENTI');
  const dataUsers = sheetUsers.getDataRange().getValues();
  const headerUsers = dataUsers.shift();
  const idxUserId = headerUsers.indexOf('ID_UTENTE');
  const idxUserProfile = headerUsers.indexOf('PROFILO');
  
  let userProfile = "";
  for (let i = 0; i < dataUsers.length; i++) {
    if (dataUsers[i][idxUserId] === userId) {
      userProfile = dataUsers[i][idxUserProfile];
      break;
    }
  }

  // 3. Get permessi (ora basati su ID_UTENTE)
  const sheetPerms = ss.getSheetByName('PERMESSI_APP');
  const dataPerms = sheetPerms.getDataRange().getValues();
  const headerPerms = dataPerms.shift();

  const idxPermUser = headerPerms.indexOf('ID_UTENTE');
  const idxPermApp = headerPerms.indexOf('ID_APP');
  const idxPermAbil = headerPerms.indexOf('ABILITATO');

  // Quali app sono abilitate per questo UTENTE?
  const allowedAppIds = [];
  dataPerms.forEach(row => {
    if (row[idxPermUser] === userId) { // Controllo su ID_UTENTE invece che profilo
      let isAbilitato = row[idxPermAbil];
      if (isAbilitato === true || isAbilitato === 'TRUE' || isAbilitato === 'Vero' || isAbilitato === 'SÃŒ') {
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
  if (!isAdminRequest(request)) {
     return createJsonResponse({ status: 'error', message: 'Accesso negato.' });
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  try { syncDipendentiToUtenti(ss); } catch(e) {}
  
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
  if (!isAdminRequest(request)) {
    return createJsonResponse({ status: 'error', message: 'Accesso negato.' });
  }

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

    // Aggiorna Profili / Gruppi
    if (request.profili_aggiornati) {
      const sheetProfili = ss.getSheetByName('PROFILI');
      const dataProfili = sheetProfili.getDataRange().getValues();
      const headerProfili = dataProfili[0];
      const newDatiProfili = request.profili_aggiornati;

      const matrixProfili = newDatiProfili.map(p => {
        return headerProfili.map(h => p[h]);
      });

      if(sheetProfili.getLastRow() > 1) {
        sheetProfili.getRange(2, 1, sheetProfili.getLastRow() - 1, sheetProfili.getLastColumn()).clearContent();
      }
      if (matrixProfili.length > 0) {
        sheetProfili.getRange(2, 1, matrixProfili.length, matrixProfili[0].length).setValues(matrixProfili);
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

function helper_findHeaderIndex(headerRow, possibleNames) {
  for (let i = 0; i < possibleNames.length; i++) {
    let idx = headerRow.indexOf(possibleNames[i].toUpperCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

function handleGetMyTimbrature(request) {
  const nomeUtente = String(request.nome || '').trim().toUpperCase();
  if (!nomeUtente) return createJsonResponse({status: 'error', message: 'Nome utente mancante.'});

  try {
    const ssPersonale = SpreadsheetApp.openById(FILE_TIMBRATURE_ID);
    
    // 1. Cerca ID e RUOLO del dipendente
    const shDip = ssPersonale.getSheetByName('DIPENDENTI');
    if (!shDip) return createJsonResponse({status: 'error', message: 'Impossibile accedere al database Dipendenti.'});
    
    const dipData = shDip.getDataRange().getValues();
    const dipHeader = dipData.shift().map(h => String(h).toUpperCase());
    const idxDipId = helper_findHeaderIndex(dipHeader, ['ID', 'ID_UTENTE', 'ID DIPENDENTE', 'UTENTE']);
    const idxDipNome = helper_findHeaderIndex(dipHeader, ['NOME', 'DIPENDENTE', 'NOME COGNOME']);
    const idxDipRuolo = helper_findHeaderIndex(dipHeader, ['RUOLO', 'MANSIONE', 'TIPO']);
    const idxDipPausa = helper_findHeaderIndex(dipHeader, ['OFFSET_PAUSA', 'OFFSET PAUSA', 'PAUSA', 'MINUTI PAUSA']);
    
    if (idxDipId === -1 || idxDipNome === -1) {
      return createJsonResponse({status: 'error', message: 'Colonne ID o NOME non trovate nel foglio DIPENDENTI.'});
    }

    let userDipId = null;
    let actualName = "";
    let userRuolo = "OPERATIVO";
    let userPausaOffset = null; // Se null, usa la logica standard
    
    for (let i = 0; i < dipData.length; i++) {
       if (String(dipData[i][idxDipNome]).trim().toUpperCase() === nomeUtente) {
           userDipId = String(dipData[i][idxDipId]).trim();
           actualName = String(dipData[i][idxDipNome]).trim();
           if (idxDipRuolo !== -1) {
               userRuolo = String(dipData[i][idxDipRuolo] || "OPERATIVO").toUpperCase();
           }
           if (idxDipPausa !== -1) {
               let val = String(dipData[i][idxDipPausa]).trim();
               if (val !== "" && !isNaN(parseInt(val))) {
                   userPausaOffset = parseInt(val);
               }
           }
           break;
       }
    }

    if (!userDipId) {
      return createJsonResponse({status: 'error', message: 'PWA: Account non abbinato a un utente registrato nel foglio Personale.'});
    }

    // 2. Leggi TIMBRATURE
    const shTimb = ssPersonale.getSheetByName('TIMBRATURE');
    if (!shTimb) return createJsonResponse({status: 'error', message: 'Impossibile accedere al foglio TIMBRATURE.'});
    
    const tDataRaw = shTimb.getDataRange().getValues();
    const tHeader = tDataRaw.shift().map(h => String(h).toUpperCase());
    
    const idxTimbId = helper_findHeaderIndex(tHeader, ['ID', 'ID_UTENTE', 'ID DIPENDENTE', 'NOME', 'DIPENDENTE']);
    const idxTimbDate = helper_findHeaderIndex(tHeader, ['DATA/ORA', 'TIMESTAMP', 'DATE', 'DATA', 'ORARIO']);
    
    if (idxTimbId === -1 || idxTimbDate === -1) {
      return createJsonResponse({status: 'error', message: 'Colonne ID o DATA/ORA non trovate in TIMBRATURE.'});
    }

    const now = new Date();
    const tz = Session.getScriptTimeZone() || 'Europe/Rome';
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    let dailyRawMap = {};

    for(let r = 0; r < tDataRaw.length; r++) {
       if (String(tDataRaw[r][idxTimbId]).trim() === userDipId || String(tDataRaw[r][idxTimbId]).trim().toUpperCase() === nomeUtente) {
           let rawDate = tDataRaw[r][idxTimbDate];
           let d = (rawDate instanceof Date) ? rawDate : new Date(rawDate);
           if (d && !isNaN(d.getTime())) {
               if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
                   let dayKey = Utilities.formatDate(d, tz, 'dd/MM/yyyy');
                   if (!dailyRawMap[dayKey]) dailyRawMap[dayKey] = [];
                   dailyRawMap[dayKey].push(d);
               }
           }
       }
    }
    
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    let daysArray = [];

    for (let d = 1; d <= daysInMonth; d++) {
       let dateObj = new Date(currentYear, currentMonth, d, 12, 0, 0);
       let key = Utilities.formatDate(dateObj, tz, 'dd/MM/yyyy');
       
       let rawStamps = dailyRawMap[key] || [];
       let cleaned = helper_cleanStamps(rawStamps.sort((a,b) => a - b));
       
       let summary = helper_computeWorkSummaryManual(userDipId, key, cleaned, userRuolo, userPausaOffset);

       daysArray.push({
          key: key,
          day: d,
          stamps: cleaned.map(t => Utilities.formatDate(t, tz, 'HH:mm')),
          pauseMin: summary.pauseMin,
          pauseType: summary.pauseType, // "offset" o "timbrata"
          hoursWorked: summary.hoursWorked,
          overtime: summary.overtime
       });
    }

    return createJsonResponse({
       status: 'success',
       nome: actualName,
       anno: currentYear,
       mese: currentMonth + 1,
       giorni: daysArray
    });

  } catch (e) {
    return createJsonResponse({status: 'error', message: 'Errore: ' + e.toString()});
  }
}

/**
 * Pulisce timbrature entro 15 minuti
 */
function helper_cleanStamps(stamps) {
  if (stamps.length <= 1) return stamps;
  const cleaned = [];
  let last = stamps[0];
  cleaned.push(last);
  for (let i = 1; i < stamps.length; i++) {
    if ((stamps[i].getTime() - last.getTime()) / 60000 >= 15) {
      cleaned.push(stamps[i]);
      last = stamps[i];
    }
  }
  return cleaned;
}

/**
 * Calcolo lavoro giornaliero (Pausa, Ore, Straordinario)
 * Porting della logica dall'app Personale
 */
function helper_computeWorkSummaryManual(id, dayKey, stamps, ruolo, userPausaOffset) {
    const WORK_START_HOUR = 8;
    const isOperativo = (ruolo === "OPERATIVO");
    const isUfficio = (ruolo === "UFFICIO");
    const ufficioContinuato = (isUfficio && id !== "ID1" && id !== "ID99"); 

    let pauseMin = userPausaOffset !== null ? userPausaOffset : (ufficioContinuato ? 0 : 60);
    let pauseType = "offset";
    let hoursWorked = 0;
    let overtime = 0;

    if (stamps.length >= 2) {
        const first = stamps[0];
        const last = stamps[stamps.length - 1];
        
        // Regola 08:00
        let startEff = first;
        let workStart = new Date(first.getFullYear(), first.getMonth(), first.getDate(), WORK_START_HOUR, 0, 0);
        if (isOperativo && first.getTime() < workStart.getTime()) {
            startEff = workStart;
        }

        // Calcolo Pausa se ci sono 4 timbrature (entro range 30-100 min)
        if (stamps.length >= 4) {
            let pStart = stamps[1];
            let pEnd = stamps[2];
            let rawPause = Math.round((pEnd - pStart) / 60000);
            if (rawPause >= 30 && rawPause <= 100) {
               pauseMin = Math.ceil(rawPause);
               pauseType = "timbrata";
            }
        }

        let totalTimeHour = (last - startEff) / 3600000;
        hoursWorked = Math.max(0, totalTimeHour - (pauseMin / 60));
        
        // Straordinario oltre le 8h
        overtime = Math.max(0, hoursWorked - 8);
    }

    return {
        pauseMin: Math.round(pauseMin),
        pauseType: pauseType,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        overtime: Math.round(overtime * 100) / 100
    };
}

// ================= MONITORAGGIO GAS SCANNER ================= //

/**
 * Endpoint per la PWA per recuperare i dati del monitoraggio
 */
function handleGetMonitorData(request) {
  if (request.profile !== 'ADMIN') {
     return createJsonResponse({ status: 'error', message: 'Accesso negato.' });
  }

  const response = {
    status: 'success',
    lastUpdated: '-',
    apps: [],
    emailQuota: -1,
    limits: {
      runtime: 360,
      emails: 1500,
      urlFetch: 100000,
      triggers: 20
    }
  };

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('MONITOR_SISTEMA');
    
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      if (data.length > 0) response.lastUpdated = data[0][1];
      
      if (data.length > 1) {
        const header = data[1];
        for (let i = 2; i < data.length; i++) {
          let obj = {};
          header.forEach((col, idx) => obj[col] = data[i][idx]);
          response.apps.push(obj);
        }
      }
    }
  } catch (e) {
    console.error("Errore lettura foglio monitor: " + e.message);
  }

  // Quota Email separata per non bloccare tutto
  try {
    response.emailQuota = MailApp.getRemainingDailyQuota();
  } catch(e) {
    response.emailQuota = -1;
  }

  return createJsonResponse(response);
}

/**
 * Funzione principale dello scanner (da attivare con trigger orario)
 */
function scanner_hourlyAudit() {
  // Forza la richiesta di permessi email se eseguito a mano
  try { MailApp.getRemainingDailyQuota(); } catch(e) {}
  
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
    let metrics = { total: 0, failed: 0, date: now };
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
      metrics.date
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
    // Per semplicitÃ  prendiamo solo il primo ramo se presente in piÃ¹ cartelle
    currentParent = p.getParents();
  }
  
  return path.length > 0 ? "Mio Drive > " + path.join(" > ") : "Mio Drive";
}

/**
 * Chiama l'Apps Script API per ottenere metriche di esecuzione
 */
function scanner_getMetricsFromAPI(scriptId) {
  const token = ScriptApp.getOAuthToken();
  const url = `https://script.googleapis.com/v1/projects/${scriptId}/metrics?metricsGranularity=DAILY`;
  
  const options = {
    method: "get",
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) return { total: 0, failed: 0, date: new Date() };
  
  const json = JSON.parse(response.getContentText());
  
  let totalUsage = 0;
  let failedUsage = 0;
  let lastDate = new Date();
  
  // Cerchiamo l'ultimo giorno che contiene dati (Google spesso ha 0 per l'ultimo giorno corrente)
  if (json.totalExecutions && json.totalExecutions.length > 0) {
    // Ordiniamo per data decrescente (i piÃ¹ recenti prima)
    const sortedMetrics = json.totalExecutions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    
    // Proviamo a prendere ieri (indice 1) o il primo giorno con valore > 0
    let bestMetric = sortedMetrics.find(m => parseInt(m.value) > 0) || sortedMetrics[0];
    
    if (bestMetric) {
      totalUsage = parseInt(bestMetric.value || 0);
      lastDate = new Date(bestMetric.startTime);
      
      // Cerchiamo lo stesso giorno per i fallimenti
      if (json.failedExecutions) {
        let failedMetric = json.failedExecutions.find(f => f.startTime === bestMetric.startTime);
        if (failedMetric) failedUsage = parseInt(failedMetric.value || 0);
      }
    }
  }
  
  return { total: totalUsage, failed: failedUsage, date: lastDate };
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


// ================= DRIVE VIEWER & KEYWORDS HANDLERS ================= //

function handleGetDriveFiles(request) {
  const type = request.type; // 'procedure' o 'comunicazioni'
  let folderId = '';

  if (type === 'procedure') {
    folderId = '1zCoTkAXzG5FN6QMh_xtPrXN0uYblqoVo';
  } else if (type === 'comunicazioni') {
    folderId = '1JgP7BPMIMrLvTLa-o4GesdpOGcb-Vxay';
  } else {
    return createJsonResponse({ status: 'error', message: 'Tipo file non supportato.' });
  }

  try {
    const folder = DriveApp.getFolderById(folderId);
    const filesIterator = folder.getFiles();
    const files = [];

    while (filesIterator.hasNext()) {
      const file = filesIterator.next();
      files.push({
        id: file.getId(),
        name: file.getName(),
        url: file.getUrl(),
        mimeType: file.getMimeType(),
        lastUpdated: file.getLastUpdated().getTime(),
        keywords: [] // Verranno popolate dopo per le procedure
      });
    }

    // Se è procedure, cerchiamo le keyword nel database
    if (type === 'procedure') {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      let sheetKw = ss.getSheetByName('PROCEDURE_KEYWORDS');
      
      // Crea il foglio se non esiste
      if (!sheetKw) {
        sheetKw = ss.insertSheet('PROCEDURE_KEYWORDS');
        sheetKw.appendRow(['FILE_ID', 'KEYWORDS']);
        sheetKw.getRange('A1:B1').setFontWeight('bold');
      }

      const dataKw = sheetKw.getDataRange().getValues();
      if (dataKw.length > 1) {
        // Salto l'intestazione
        const kwMap = {};
        for (let i = 1; i < dataKw.length; i++) {
          const fId = String(dataKw[i][0]).trim();
          let kwString = String(dataKw[i][1] || '').trim();
          if (fId) {
            kwMap[fId] = kwString ? kwString.split(',').map(k => k.trim()).filter(k => k) : [];
          }
        }

        // Assegno le keyword ai file
        files.forEach(f => {
          if (kwMap[f.id]) {
            f.keywords = kwMap[f.id];
          }
        });
      }
    }

    // Ordina i file per data di aggiornamento decrescente
    files.sort((a, b) => b.lastUpdated - a.lastUpdated);

    return createJsonResponse({ status: 'success', files: files });
  } catch (error) {
    return createJsonResponse({ status: 'error', message: 'Impossibile accedere alla cartella Drive: ' + error.toString() });
  }
}

function handleSaveProcedureKeywords(request) {
  const fileId = request.fileId;
  const keywords = request.keywords; // Array di stringhe

  if (!fileId) {
    return createJsonResponse({ status: 'error', message: 'ID file mancante.' });
  }

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheetKw = ss.getSheetByName('PROCEDURE_KEYWORDS');
    
    if (!sheetKw) {
      sheetKw = ss.insertSheet('PROCEDURE_KEYWORDS');
      sheetKw.appendRow(['FILE_ID', 'KEYWORDS']);
      sheetKw.getRange('A1:B1').setFontWeight('bold');
    }

    const dataKw = sheetKw.getDataRange().getValues();
    let rowIndex = -1;

    for (let i = 1; i < dataKw.length; i++) {
      if (String(dataKw[i][0]).trim() === fileId) {
        rowIndex = i + 1; // +1 perché getValues() è 0-indexed, ma getRange() è 1-indexed
        break;
      }
    }

    const keywordsString = Array.isArray(keywords) ? keywords.join(', ') : '';

    if (rowIndex > -1) {
      // Aggiorna riga esistente
      sheetKw.getRange(rowIndex, 2).setValue(keywordsString);
    } else {
      // Aggiungi nuova riga
      sheetKw.appendRow([fileId, keywordsString]);
    }

    return createJsonResponse({ status: 'success', message: 'Keyword salvate correttamente.' });
  } catch (error) {
    return createJsonResponse({ status: 'error', message: 'Errore durante il salvataggio: ' + error.toString() });
  }
}


function syncDipendentiToUtenti(ssApp) {
  const ssTimbr = SpreadsheetApp.openById(FILE_TIMBRATURE_ID);
  const shDip = ssTimbr.getSheetByName('DIPENDENTI');
  const shUt = ssApp.getSheetByName('UTENTI');
  if (!shDip || !shUt) return;

  const dipData = shDip.getDataRange().getValues();
  const dipHeaders = dipData.shift().map(h => String(h).toUpperCase());
  const dipIdIdx = dipHeaders.indexOf('ID');
  const dipNomeIdx = dipHeaders.indexOf('NOME');
  const dipAttivoIdx = dipHeaders.indexOf('ATTIVO');
  
  if (dipIdIdx === -1 || dipNomeIdx === -1) return;

  const utData = shUt.getDataRange().getValues();
  const utHeaders = utData.shift().map(h => String(h).toUpperCase());
  const utIdIdx = utHeaders.indexOf('ID_UTENTE');
  const utAttivoIdx = utHeaders.indexOf('ATTIVO');

  const existingUtentiMap = {};
  utData.forEach((r, i) => {
    existingUtentiMap[String(r[utIdIdx]).trim()] = i + 2;
  });

  dipData.forEach(row => {
    let id = String(row[dipIdIdx]).trim();
    let nome = String(row[dipNomeIdx]).trim();
    let attivoRaw = String(row[dipAttivoIdx] || '').toUpperCase();
    let isAttivo = (attivoRaw === 'SI' || attivoRaw === 'TRUE' || attivoRaw === 'VERO' || attivoRaw === 'S�');
    
    if (id && isAttivo) {
      if (!existingUtentiMap[id]) {
        let chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let randomPass = '';
        for(let i=0; i<5; i++) randomPass += chars.charAt(Math.floor(Math.random() * chars.length));
        
        let username = nome.replace(/[^a-zA-Z0-9]/g, '.').toLowerCase();
        
        let newRow = new Array(utHeaders.length).fill('');
        newRow[utIdIdx] = id;
        if(utHeaders.indexOf('NOME') > -1) newRow[utHeaders.indexOf('NOME')] = nome;
        if(utHeaders.indexOf('USERNAME') > -1) newRow[utHeaders.indexOf('USERNAME')] = username;
        if(utHeaders.indexOf('PASSWORD_HASH') > -1) newRow[utHeaders.indexOf('PASSWORD_HASH')] = randomPass;
        if(utHeaders.indexOf('PROFILO') > -1) newRow[utHeaders.indexOf('PROFILO')] = 'DEFAULT';
        if(utHeaders.indexOf('ATTIVO') > -1) newRow[utHeaders.indexOf('ATTIVO')] = true;
        
        shUt.appendRow(newRow);
      }
    } else if (id && !isAttivo && existingUtentiMap[id]) {
      let riga = existingUtentiMap[id];
      if (utAttivoIdx > -1) {
         shUt.getRange(riga, utAttivoIdx + 1).setValue(false);
      }
    }
  });
}
