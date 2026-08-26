// ==========================================
// 1. CONFIGURACIÓN DE FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyA8R3L7URqOX6pYCWJjWDTJhXBIUR5dn9k",
  authDomain: "lared-6db02.firebaseapp.com",
  databaseURL: "https://lared-6db02-default-rtdb.firebaseio.com", // Reemplaza si tu URL es diferente
  projectId: "lared-6db02",
  storageBucket: "lared-6db02.firebasestorage.app",
  messagingSenderId: "146469241721",
  appId: "1:145469241721:web:aa75af74720b4e7e3617a8"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const rtdb = firebase.database();

// ==========================================
// ESTADO GLOBAL
// ==========================================
let currentUser = null;
let currentTabIndex = 0;

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    
    // Desactivar Service Worker previo durante desarrollo
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            for (let registration of registrations) {
                registration.unregister();
            }
        });
    }

    // Modo Oscuro
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.remove('dark-mode');
    } else {
        document.body.classList.add('dark-mode');
        if (!savedTheme) localStorage.setItem('theme', 'dark');
    }

    // Verificar sesión local activa
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = savedUser;
        setupPresence();
        showApp();
    }

    // Login Form
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        if (username) {
            currentUser = username;
            localStorage.setItem('currentUser', username);
            setupPresence();
            showApp();
        }
    });

    // Navegación
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.getAttribute('data-target');
            const targetIndex = parseInt(item.getAttribute('data-index'));
            switchTab(targetId, targetIndex);
        });
    });

    // Modales y botones flotantes
    document.getElementById('btn-add-game').addEventListener('click', () => document.getElementById('modal-game').classList.add('active'));
    document.getElementById('btn-add-poll').addEventListener('click', () => document.getElementById('modal-poll').classList.add('active'));
    
    // Formularios
    document.getElementById('form-add-game').addEventListener('submit', handleAddGame);
    document.getElementById('form-add-poll').addEventListener('submit', handleAddPoll);
    document.getElementById('phrase-form').addEventListener('submit', handleAddPhrase);

    // Inicializar secciones y escuchadores en tiempo real
    initLocation();
    loadGames();
    listenPhrases(); // Chat global en tiempo real
    loadPolls();
    listenUsers();   // Presencia online en tiempo real
});

// ==========================================
// SISTEMA DE PRESENCIA REALTIME (onDisconnect)
// ==========================================
function setupPresence() {
    if (!currentUser) return;

    // Limpiar caracteres no permitidos en claves de Realtime Database
    const cleanUserKey = currentUser.replace(/[.#$\[\]]/g, "_");
    const userStatusRef = rtdb.ref('/status/' + cleanUserKey);

    const isOfflineForRTDB = {
        state: 'offline',
        username: currentUser,
        last_changed: firebase.database.ServerValue.TIMESTAMP
    };

    const isOnlineForRTDB = {
        state: 'online',
        username: currentUser,
        last_changed: firebase.database.ServerValue.TIMESTAMP
    };

    // Escuchar cambios de conexión del WebSocket
    rtdb.ref('.info/connected').on('value', snapshot => {
        if (snapshot.val() === false) return;

        // Si se desconecta o cierra la pestaña, el servidor pone el estado en offline
        userStatusRef.onDisconnect().set(isOfflineForRTDB).then(() => {
            userStatusRef.set(isOnlineForRTDB);
        });
    });
}

function listenUsers() {
    rtdb.ref('/status').on('value', snapshot => {
        const grid = document.getElementById('users-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        const statuses = snapshot.val() || {};
        
        Object.keys(statuses).forEach(key => {
            const user = statuses[key];
            const estaOnline = user.state === 'online';
            
            const div = document.createElement('div');
            div.className = 'user-card';
            div.innerHTML = `
                <div class="avatar">
                    <span class="initial">${user.username ? user.username.charAt(0).toUpperCase() : 'U'}</span>
                    <div class="status-dot ${estaOnline ? 'online' : 'offline'}"></div>
                </div>
                <h3>${user.username || 'Usuario'}</h3>
                <span class="status-text">${estaOnline ? 'Online' : 'Offline'}</span>
            `;
            grid.appendChild(div);
        });
    }, error => {
        console.error("Error leyendo estados de usuario:", error);
    });
}

// ==========================================
// FRASES (CHAT EN TIEMPO REAL CON FIRESTORE)
// ==========================================
function listenPhrases() {
    // Escucha en tiempo real de mensajes ordenados por fecha
    db.collection('phrases').orderBy('timestamp', 'asc').onSnapshot(snapshot => {
        const container = document.getElementById('phrases-list');
        if (!container) return;

        container.innerHTML = '';

        snapshot.forEach(doc => {
            const phrase = doc.data();
            const isMine = phrase.author === currentUser;
            
            const div = document.createElement('div');
            // Si es propio -> 'mine' (derecha, color principal)
            // Si es de otro -> burbuja gris a la izquierda
            div.className = `chat-bubble ${isMine ? 'mine' : ''}`;
            
            if (!isMine) {
                // Estilo gris para los receptores
                div.style.backgroundColor = 'var(--surface-color, #2C2C2E)';
                div.style.color = '#FFFFFF';
                div.style.alignSelf = 'flex-start';
                div.style.borderRadius = '18px 18px 18px 4px';
            }

            let timeHtml = '';
            if (phrase.timestamp) {
                const dateObj = phrase.timestamp.toDate ? phrase.timestamp.toDate() : new Date(phrase.timestamp);
                const timeStr = obtenerTiempoRelativo(dateObj.getTime());
                const timeColor = isMine ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.5)'; 
                timeHtml = `<div style="color: ${timeColor}; font-size: 0.75em; margin-top: 4px; text-align: right;">${timeStr}</div>`;
            }

            div.innerHTML = `
                <div class="chat-author" style="font-weight: 600; font-size: 0.8em; margin-bottom: 2px; color: ${isMine ? '#FFF' : 'var(--primary-color, #0A84FF)'};">
                    ${phrase.author}
                </div>
                <div>${phrase.text}</div>
                ${timeHtml}
            `;
            container.appendChild(div);
        });

        // Auto-scroll al fondo al recibir o enviar un mensaje
        container.scrollTop = container.scrollHeight;
    }, error => {
        console.error("Error escuchando mensajes:", error);
    });
}

async function handleAddPhrase(e) {
    e.preventDefault();
    const input = document.getElementById('phrase-input');
    const text = input.value.trim();

    if (text && currentUser) {
        try {
            await db.collection('phrases').add({ 
                text: text, 
                author: currentUser,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            input.value = '';
        } catch (error) {
            console.error("Error enviando mensaje:", error);
        }
    }
}

// ==========================================
// GESTIÓN DE VISTAS Y NAVEGACIÓN
// ==========================================
function showApp() {
    document.getElementById('login-view').classList.remove('active');
    document.getElementById('main-view').classList.add('active');
}

function switchTab(targetId, newIndex) {
    if (newIndex === currentTabIndex) return;

    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.nav-item[data-target="${targetId}"]`).classList.add('active');

    const sections = document.querySelectorAll('.tab-section');
    sections.forEach(sec => {
        const secIndex = parseInt(sec.getAttribute('data-index'));
        
        if (secIndex === newIndex) {
            sec.style.transform = newIndex > currentTabIndex ? 'translateX(30px)' : 'translateX(-30px)';
            void sec.offsetWidth; 
            sec.classList.add('active');
            sec.style.transform = 'translateX(0)';
        } else {
            if (sec.classList.contains('active')) {
                sec.style.transform = newIndex > currentTabIndex ? 'translateX(-30px)' : 'translateX(30px)';
                sec.classList.remove('active');
            } else {
                sec.style.transform = secIndex > newIndex ? 'translateX(30px)' : 'translateX(-30px)';
            }
        }
    });

    currentTabIndex = newIndex;
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// ==========================================
// LÓGICA DE UBICACIÓN
// ==========================================
function initLocation() {
    const btnUpdate = document.getElementById('btn-update-location');
    if (btnUpdate) {
        btnUpdate.addEventListener('click', updateLocation);
    }
    loadLastLocation();
}

function updateLocation() {
    const status = document.getElementById('map-status');
    const iframe = document.getElementById('map-iframe');

    if (!navigator.geolocation) {
        status.textContent = "Tu navegador no soporta geolocalización.";
        return;
    }

    status.textContent = "Obteniendo ubicación...";
    status.style.display = "block";
    iframe.style.display = "none";

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            const timestamp = new Date().toLocaleString();

            const locationData = { lat, lon, timestamp };
            localStorage.setItem('userLocation', JSON.stringify(locationData));

            displayMap(lat, lon, timestamp);
        },
        (error) => {
            console.error("Error geolocalización:", error);
            status.style.display = "block";
            iframe.style.display = "none";
            if (error.code === error.PERMISSION_DENIED) {
                status.textContent = "Permiso denegado. Habilítalo en los ajustes de tu navegador.";
            } else {
                status.textContent = "No se pudo obtener la ubicación. Verifica tu conexión.";
            }
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

function loadLastLocation() {
    const saved = localStorage.getItem('userLocation');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            displayMap(data.lat, data.lon, data.timestamp);
        } catch(e) { console.error(e); }
    }
}

function displayMap(lat, lon, timestamp) {
    const status = document.getElementById('map-status');
    const iframe = document.getElementById('map-iframe');
    const timeSpan = document.getElementById('location-time');

    status.style.display = "none";
    iframe.style.display = "block";
    
    iframe.src = `https://maps.google.com/maps?q=${lat},${lon}&z=15&output=embed`;
    timeSpan.textContent = "Actualizado: " + timestamp;
}

// ==========================================
// LÓGICA DE JUEGOS
// ==========================================
function loadGames() {
    const games = JSON.parse(localStorage.getItem('appGames')) || [];
    const container = document.getElementById('games-list');
    container.innerHTML = '';
    
    if (games.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No hay juegos agregados.</p>';
        return;
    }

    games.forEach(game => {
        const div = document.createElement('div');
        div.className = 'game-item';
        div.innerHTML = `
            <div class="game-icon">
                ${game.icon ? `<img src="${game.icon}" style="width:100%; height:100%; border-radius:12px; object-fit:cover;">` : game.name.charAt(0).toUpperCase()}
            </div>
            <div class="game-info" style="flex: 1;">
                <h3 style="font-size:16px;">${game.name}</h3>
                <span style="font-size:13px; color:var(--text-muted);">Por ${game.addedBy}</span>
            </div>
            <button class="btn-play" onclick="requestPlay('${game.name}')">Jugar</button>
        `;
        container.appendChild(div);
    });
}

window.requestPlay = function(gameName) {
    if (navigator.vibrate) navigator.vibrate(50);
    alert(`${currentUser} quiere jugar ${gameName} 🎮\n(La solicitud ha sido enviada)`);
};

function handleAddGame(e) {
    e.preventDefault();
    const name = document.getElementById('game-name').value.trim();
    const icon = document.getElementById('game-icon').value.trim();
    
    if (name) {
        const games = JSON.parse(localStorage.getItem('appGames')) || [];
        games.push({ name, icon, addedBy: currentUser });
        localStorage.setItem('appGames', JSON.stringify(games));
        loadGames();
        closeModal('modal-game');
        e.target.reset();
    }
}

// ==========================================
// TIEMPO RELATIVO
// ==========================================
function obtenerTiempoRelativo(timestamp) {
    if (!timestamp) return "";

    const fechaMensaje = new Date(timestamp);
    const ahora = new Date();
    
    const diffMs = ahora - fechaMensaje;
    const diffSegundos = Math.floor(diffMs / 1000);
    const diffMinutos = Math.floor(diffSegundos / 60);
    const diffHoras = Math.floor(diffMinutos / 60);

    const ayer = new Date(ahora);
    ayer.setDate(ahora.getDate() - 1);
    const esAyer = fechaMensaje.getDate() === ayer.getDate() && 
                   fechaMensaje.getMonth() === ayer.getMonth() && 
                   fechaMensaje.getFullYear() === ayer.getFullYear();

    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

    if (diffSegundos < 60) {
        return "ahora";
    } else if (diffMinutos === 1) {
        return "hace 1 min";
    } else if (diffMinutos < 60) {
        return `hace ${diffMinutos} min`;
    } else if (diffHoras === 1) {
        return "hace 1 h";
    } else if (diffHoras < 24 && !esAyer) {
        return `hace ${diffHoras} h`;
    } else if (esAyer) {
        return "ayer";
    } else {
        return `${fechaMensaje.getDate()} de ${meses[fechaMensaje.getMonth()]}`;
    }
}

// ==========================================
// ENCUESTAS
// ==========================================
function loadPolls() {
    const polls = JSON.parse(localStorage.getItem('appPolls')) || [];
    const container = document.getElementById('polls-list');
    container.innerHTML = '';
    
    if (polls.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No hay encuestas creadas.</p>';
        return;
    }

    polls.forEach((poll, index) => {
        const div = document.createElement('div');
        div.className = 'poll-item';
        
        let optionsHtml = '';
        poll.options.forEach((opt, optIndex) => {
            const isSelected = poll.votes && poll.votes[currentUser] && poll.votes[currentUser].includes(optIndex);
            optionsHtml += `
                <div class="poll-option ${isSelected ? 'selected' : ''}" onclick="votePoll(${index}, ${optIndex})">
                    <span>${opt.text}</span>
                    <span>${opt.votes || 0}</span>
                </div>
            `;
        });

        div.innerHTML = `
            <div class="poll-question">${poll.question}</div>
            ${optionsHtml}
            <div style="font-size:12px; color:var(--text-muted); margin-top:10px;">Creado por ${poll.createdBy}</div>
        `;
        container.appendChild(div);
    });
}

function handleAddPoll(e) {
    e.preventDefault();
    const question = document.getElementById('poll-question').value.trim();
    const optionsRaw = document.getElementById('poll-options').value.trim();
    const isMulti = document.getElementById('poll-multiselect').checked;

    if (question && optionsRaw) {
        const options = optionsRaw.split(',').map(opt => ({ text: opt.trim(), votes: 0 }));
        const polls = JSON.parse(localStorage.getItem('appPolls')) || [];
        
        polls.push({
            question,
            options,
            isMulti,
            createdBy: currentUser,
            votes: {}
        });

        localStorage.setItem('appPolls', JSON.stringify(polls));
        loadPolls();
        closeModal('modal-poll');
        e.target.reset();
    }
}

window.votePoll = function(pollIndex, optIndex) {
    const polls = JSON.parse(localStorage.getItem('appPolls')) || [];
    const poll = polls[pollIndex];

    if (!poll.votes) poll.votes = {};
    if (!poll.votes[currentUser]) poll.votes[currentUser] = [];

    const userVotes = poll.votes[currentUser];

    if (poll.isMulti) {
        const idx = userVotes.indexOf(optIndex);
        if (idx > -1) {
            userVotes.splice(idx, 1);
            poll.options[optIndex].votes--;
        } else {
            userVotes.push(optIndex);
            poll.options[optIndex].votes++;
        }
    } else {
        if (userVotes.includes(optIndex)) {
            userVotes.splice(userVotes.indexOf(optIndex), 1);
            poll.options[optIndex].votes--;
        } else {
            if (userVotes.length > 0) {
                poll.options[userVotes[0]].votes--;
                userVotes.pop();
            }
            userVotes.push(optIndex);
            poll.options[optIndex].votes++;
        }
    }

    localStorage.setItem('appPolls', JSON.stringify(polls));
    loadPolls();
};
