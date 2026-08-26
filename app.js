// ==========================================
// 1. CONFIGURACIÓN DE FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyA8R3L7URqOX6pYCWJjWDTJhXBIUR5dn9k",
  authDomain: "lared-6db02.firebaseapp.com",
  databaseURL: "https://lared-6db02-default-rtdb.firebaseio.com",
  projectId: "lared-6db02",
  storageBucket: "lared-6db02.firebasestorage.app",
  messagingSenderId: "146469241721",
  appId: "1:145469241721:web:aa75af74720b4e7e3617a8"
};

firebase.initializeApp(firebaseConfig);
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

    // Navegación entre pestañas
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

    // Inicializar funciones principales
    initLocation();
    loadGames();
    loadPolls();
    
    // Escuchar en tiempo real en Realtime Database
    listenUsers();
    listenMessages();
});

// ==========================================
// PRESENCIA EN TIEMPO REAL (ONLINE / OFFLINE)
// ==========================================
function setupPresence() {
    if (!currentUser) return;

    // Sanitizar nombre para usar como clave en la BD
    const cleanUserKey = currentUser.replace(/[.#$\[\]]/g, "_");
    const userStatusRef = rtdb.ref('/status/' + cleanUserKey);

    const isOffline = {
        state: 'offline',
        username: currentUser,
        last_changed: firebase.database.ServerValue.TIMESTAMP
    };

    const isOnline = {
        state: 'online',
        username: currentUser,
        last_changed: firebase.database.ServerValue.TIMESTAMP
    };

    rtdb.ref('.info/connected').on('value', snapshot => {
        if (snapshot.val() === false) return;

        // Si se cierra la app/pestaña, pasa automáticamente a offline
        userStatusRef.onDisconnect().set(isOffline).then(() => {
            userStatusRef.set(isOnline);
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
    });
}

// ==========================================
// CHAT EN TIEMPO REAL (BURBUJAS)
// ==========================================
function listenMessages() {
    rtdb.ref('/messages').on('value', snapshot => {
        const container = document.getElementById('phrases-list');
        if (!container) return;

        container.innerHTML = '';
        const messagesData = snapshot.val() || {};

        // Recorrer y renderizar los mensajes
        Object.keys(messagesData).forEach(key => {
            const msg = messagesData[key];
            const isMine = msg.author === currentUser;

            const div = document.createElement('div');
            
            // Estilos generales del contenedor del mensaje
            div.style.display = 'flex';
            div.style.flexDirection = 'column';
            div.style.maxWidth = '75%';
            div.style.marginBottom = '10px';
            div.style.padding = '10px 14px';
            div.style.borderRadius = '16px';
            div.style.wordBreak = 'break-word';

            if (isMine) {
                // Mensaje ENVIADO por mí (Derecha, Azul/Color primario)
                div.style.alignSelf = 'flex-end';
                div.style.backgroundColor = 'var(--primary-color, #007AFF)';
                div.style.color = '#FFFFFF';
                div.style.borderBottomRightRadius = '4px';
            } else {
                // Mensaje RECIBIDO de otros (Izquierda, Burbuja gris)
                div.style.alignSelf = 'flex-start';
                div.style.backgroundColor = '#2C2C2E';
                div.style.color = '#FFFFFF';
                div.style.borderBottomLeftRadius = '4px';
            }

            const timeStr = msg.timestamp ? obtenerTiempoRelativo(msg.timestamp) : '';

            div.innerHTML = `
                <span style="font-size: 0.75rem; font-weight: bold; margin-bottom: 3px; color: ${isMine ? 'rgba(255,255,255,0.9)' : '#8E8E93'};">
                    ${msg.author}
                </span>
                <span style="font-size: 0.95rem; line-height: 1.3;">${msg.text}</span>
                <span style="font-size: 0.68rem; align-self: flex-end; margin-top: 4px; opacity: 0.6;">
                    ${timeStr}
                </span>
            `;
            container.appendChild(div);
        });

        // Auto-scroll al fondo
        container.scrollTop = container.scrollHeight;
    });
}

function handleAddPhrase(e) {
    e.preventDefault();
    const input = document.getElementById('phrase-input');
    const text = input.value.trim();

    if (text && currentUser) {
        // Enviar nuevo mensaje a Realtime Database
        rtdb.ref('/messages').push({
            author: currentUser,
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        input.value = '';
    }
}

// ==========================================
// VISTAS Y NAVEGACIÓN
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

    if (diffSegundos < 60) return "ahora";
    if (diffMinutos < 60) return `hace ${diffMinutos} min`;
    if (diffHoras < 24) return `hace ${diffHoras} h`;
    return `${fechaMensaje.getDate()}/${fechaMensaje.getMonth() + 1}`;
}

// ==========================================
// UBICACIÓN
// ==========================================
function initLocation() {
    const btnUpdate = document.getElementById('btn-update-location');
    if (btnUpdate) btnUpdate.addEventListener('click', updateLocation);
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
            localStorage.setItem('userLocation', JSON.stringify({ lat, lon, timestamp }));
            displayMap(lat, lon, timestamp);
        },
        (error) => {
            status.style.display = "block";
            iframe.style.display = "none";
            status.textContent = "No se pudo obtener la ubicación.";
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
        } catch(e) {}
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
// JUEGOS Y ENCUESTAS (LOCALSTORAGE)
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
            <div class="game-icon">${game.icon ? `<img src="${game.icon}" style="width:100%; height:100%; border-radius:12px;">` : game.name.charAt(0).toUpperCase()}</div>
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
    alert(`${currentUser} quiere jugar ${gameName} 🎮`);
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
        div.innerHTML = `<div class="poll-question">${poll.question}</div>${optionsHtml}`;
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
        polls.push({ question, options, isMulti, createdBy: currentUser, votes: {} });
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
    if (userVotes.includes(optIndex)) {
        userVotes.splice(userVotes.indexOf(optIndex), 1);
        poll.options[optIndex].votes--;
    } else {
        userVotes.push(optIndex);
        poll.options[optIndex].votes++;
    }

    localStorage.setItem('appPolls', JSON.stringify(polls));
    loadPolls();
};// ==========================================
// 1. CONFIGURACIÓN DE FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "TU_API_KEY_REAL", // <-- Pon tu API Key real aquí
  authDomain: "lared-6db02.firebaseapp.com",
  databaseURL: "https://lared-6db02-default-rtdb.firebaseio.com",
  projectId: "lared-6db02",
  storageBucket: "lared-6db02.firebasestorage.app",
  messagingSenderId: "146469241721",
  appId: "1:146469241721:web:..."
};

firebase.initializeApp(firebaseConfig);
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

    // Navegación entre pestañas
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

    // Inicializar funciones principales
    initLocation();
    loadGames();
    loadPolls();
    
    // Escuchar en tiempo real en Realtime Database
    listenUsers();
    listenMessages();
});

// ==========================================
// PRESENCIA EN TIEMPO REAL (ONLINE / OFFLINE)
// ==========================================
function setupPresence() {
    if (!currentUser) return;

    // Sanitizar nombre para usar como clave en la BD
    const cleanUserKey = currentUser.replace(/[.#$\[\]]/g, "_");
    const userStatusRef = rtdb.ref('/status/' + cleanUserKey);

    const isOffline = {
        state: 'offline',
        username: currentUser,
        last_changed: firebase.database.ServerValue.TIMESTAMP
    };

    const isOnline = {
        state: 'online',
        username: currentUser,
        last_changed: firebase.database.ServerValue.TIMESTAMP
    };

    rtdb.ref('.info/connected').on('value', snapshot => {
        if (snapshot.val() === false) return;

        // Si se cierra la app/pestaña, pasa automáticamente a offline
        userStatusRef.onDisconnect().set(isOffline).then(() => {
            userStatusRef.set(isOnline);
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
    });
}

// ==========================================
// CHAT EN TIEMPO REAL (BURBUJAS)
// ==========================================
function listenMessages() {
    rtdb.ref('/messages').on('value', snapshot => {
        const container = document.getElementById('phrases-list');
        if (!container) return;

        container.innerHTML = '';
        const messagesData = snapshot.val() || {};

        // Recorrer y renderizar los mensajes
        Object.keys(messagesData).forEach(key => {
            const msg = messagesData[key];
            const isMine = msg.author === currentUser;

            const div = document.createElement('div');
            
            // Estilos generales del contenedor del mensaje
            div.style.display = 'flex';
            div.style.flexDirection = 'column';
            div.style.maxWidth = '75%';
            div.style.marginBottom = '10px';
            div.style.padding = '10px 14px';
            div.style.borderRadius = '16px';
            div.style.wordBreak = 'break-word';

            if (isMine) {
                // Mensaje ENVIADO por mí (Derecha, Azul/Color primario)
                div.style.alignSelf = 'flex-end';
                div.style.backgroundColor = 'var(--primary-color, #007AFF)';
                div.style.color = '#FFFFFF';
                div.style.borderBottomRightRadius = '4px';
            } else {
                // Mensaje RECIBIDO de otros (Izquierda, Burbuja gris)
                div.style.alignSelf = 'flex-start';
                div.style.backgroundColor = '#2C2C2E';
                div.style.color = '#FFFFFF';
                div.style.borderBottomLeftRadius = '4px';
            }

            const timeStr = msg.timestamp ? obtenerTiempoRelativo(msg.timestamp) : '';

            div.innerHTML = `
                <span style="font-size: 0.75rem; font-weight: bold; margin-bottom: 3px; color: ${isMine ? 'rgba(255,255,255,0.9)' : '#8E8E93'};">
                    ${msg.author}
                </span>
                <span style="font-size: 0.95rem; line-height: 1.3;">${msg.text}</span>
                <span style="font-size: 0.68rem; align-self: flex-end; margin-top: 4px; opacity: 0.6;">
                    ${timeStr}
                </span>
            `;
            container.appendChild(div);
        });

        // Auto-scroll al fondo
        container.scrollTop = container.scrollHeight;
    });
}

function handleAddPhrase(e) {
    e.preventDefault();
    const input = document.getElementById('phrase-input');
    const text = input.value.trim();

    if (text && currentUser) {
        // Enviar nuevo mensaje a Realtime Database
        rtdb.ref('/messages').push({
            author: currentUser,
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        input.value = '';
    }
}

// ==========================================
// VISTAS Y NAVEGACIÓN
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

    if (diffSegundos < 60) return "ahora";
    if (diffMinutos < 60) return `hace ${diffMinutos} min`;
    if (diffHoras < 24) return `hace ${diffHoras} h`;
    return `${fechaMensaje.getDate()}/${fechaMensaje.getMonth() + 1}`;
}

// ==========================================
// UBICACIÓN
// ==========================================
function initLocation() {
    const btnUpdate = document.getElementById('btn-update-location');
    if (btnUpdate) btnUpdate.addEventListener('click', updateLocation);
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
            localStorage.setItem('userLocation', JSON.stringify({ lat, lon, timestamp }));
            displayMap(lat, lon, timestamp);
        },
        (error) => {
            status.style.display = "block";
            iframe.style.display = "none";
            status.textContent = "No se pudo obtener la ubicación.";
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
        } catch(e) {}
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
// JUEGOS Y ENCUESTAS (LOCALSTORAGE)
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
            <div class="game-icon">${game.icon ? `<img src="${game.icon}" style="width:100%; height:100%; border-radius:12px;">` : game.name.charAt(0).toUpperCase()}</div>
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
    alert(`${currentUser} quiere jugar ${gameName} 🎮`);
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
        div.innerHTML = `<div class="poll-question">${poll.question}</div>${optionsHtml}`;
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
        polls.push({ question, options, isMulti, createdBy: currentUser, votes: {} });
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
    if (userVotes.includes(optIndex)) {
        userVotes.splice(userVotes.indexOf(optIndex), 1);
        poll.options[optIndex].votes--;
    } else {
        userVotes.push(optIndex);
        poll.options[optIndex].votes++;
    }

    localStorage.setItem('appPolls', JSON.stringify(polls));
    loadPolls();
};
