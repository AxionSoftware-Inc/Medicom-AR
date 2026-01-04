// --- SOZLAMALAR ---
const urlParams = new URLSearchParams(window.location.search);
const currentFloor = urlParams.get('floor') || "1";

// Elementlar
const startScreen = document.getElementById('start-screen');
const roomListContainer = document.getElementById('room-list-container');
const roomList = document.getElementById('room-list');
const btnReset = document.getElementById('btn-reset');
const worldRoot = document.getElementById('world-root');
const videoElement = document.getElementById('bg-video');
const navHintBox = document.getElementById('nav-hint-box');
const navHintText = document.getElementById('nav-hint-text');

let initialHeading = null; // Boshlang'ich burilish burchagi

// 1. MA'LUMOTNI YUKLASH
fetch('../floors.json')
    .then(res => res.json())
    .then(data => {
        const rooms = data[currentFloor];
        if (rooms) renderRooms(rooms);
        else roomList.innerHTML = '<div style="color:white; text-align:center">Ma\'lumot topilmadi</div>';
    })
    .catch(err => {
        console.error(err);
        roomList.innerHTML = '<div style="color:red; text-align:center">Internet yoki fayl xatosi</div>';
    });

function renderRooms(rooms) {
    roomList.innerHTML = '';
    rooms.forEach(room => {
        const div = document.createElement('div');
        div.className = 'room-item';
        const dirText = room.corridor === 'left' ? "Chap yo'lak" : "O'ng yo'lak";
        div.innerHTML = `<b>Xona ${room.id}</b><br><small>${dirText}, ${room.x}m</small>`;
        div.onclick = () => startNavigation(room);
        roomList.appendChild(div);
    });
}

// 2. KAMERA VA SENSORLARNI ISHGA TUSHIRISH
document.getElementById('start-btn').onclick = async () => {
    // A. Kamerani yoqish
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        videoElement.srcObject = stream;
    } catch (err) {
        alert("Kameraga ruxsat berilmadi!");
        return;
    }

    // B. Kompas (DeviceOrientation) ruxsati (iOS uchun)
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            const permission = await DeviceOrientationEvent.requestPermission();
            if (permission !== 'granted') {
                alert("Sensorga ruxsat kerak!");
            }
        } catch (e) {
            console.log("Permission request error", e);
        }
    }

    // C. Hozirgi yo'nalishni 'lock' qilish
    window.addEventListener('deviceorientation', setInitialHeading, { once: true });

    // UI o'zgarishi
    startScreen.style.display = 'none';
    roomListContainer.style.display = 'block';
};

// Birinchi marta olingan ma'lumot biz uchun "Oldinga" yo'nalishi bo'ladi
function setInitialHeading(e) {
    // iOS: webkitCompassHeading, Android: alpha
    let heading = e.webkitCompassHeading || e.alpha;
    if (heading !== null && heading !== undefined) {
        initialHeading = heading;
        const cam = document.getElementById('cam');
        // A-Frame rotation Y o'qi
        cam.setAttribute('rotation', `0 ${heading} 0`);
    }
}

// 3. NAVIGATSIYA CHIZMASI
function startNavigation(room) {
    roomListContainer.style.display = 'none';
    btnReset.style.display = 'block';
    navHintBox.style.display = 'block';

    worldRoot.innerHTML = ''; // Tozalash

    // Hint matni
    const turnText = room.corridor === 'left' ? "CHAPGA BURILING" : "O'NGGA BURILING";
    navHintText.innerText = `${turnText} VA YURING`;

    // 3DoF da biz foydalanuvchi yurganini bilmaymiz.
    // Shuning uchun shunchaki yo'nalish ko'rsatuvchi "yo'lak" chizamiz.
    // Biz yo'lakni foydalanuvchi "burilgandan keyingi" qarashi bo'yicha chizamiz (Z o'qi bo'ylab oldinga).

    const distance = room.x; // Masofa

    // Eshik joylashuvi: left -> chap tomonda, right -> o'ng tomonda
    // Agar biz yo'lak bo'ylab ketayotgan bo'lsak, eshik chapda yoki o'ngda bo'ladi.
    const doorOffset = room.door === 'left' ? -1.0 : 1.0;

    // A. Strelkalar (Geometrik shakl)
    for (let i = 1.0; i < distance; i += 1.5) {
        const arrow = document.createElement('a-entity');
        // Uchburchak strelka
        arrow.setAttribute('geometry', 'primitive: triangle; vertexA: 0 0 0; vertexB: -0.2 0.3 0; vertexC: 0.2 0.3 0');
        arrow.setAttribute('material', 'color: #00d2ff; shader: flat; side: double; transparent: true; opacity: 0.8');

        // Yerga yotqizish (-90 X), va oldinga qaratish (turnirda -Z ga qarab chiziladi)
        // Triangle vertexA is top (0,0), B/C is bottom.
        // We want vertexA pointing -Z (forward).
        // Default plane faces +Z.
        // Rotation -90 on X puts it flat on ground.
        // Then we need to rotate it to point forward?

        arrow.setAttribute('rotation', '-90 0 180'); // 180 Z rotation to flip it if needed or adjust vertexes.
        // Let's use simpler plane arrow or just correct rotation.
        // If vertexA (0,0,0) is tip, and B/C are base.
        // Position: 0, -1 (below eye), -i (forward).
        arrow.setAttribute('position', `0 -1 -${i}`);

        // Animatsiya
        arrow.setAttribute('animation', `property: scale; from: 1 1 1; to: 1.2 1.2 1.2; dir: alternate; loop: true; dur: 800`);

        worldRoot.appendChild(arrow);
    }

    // B. Manzil belgisi
    const pin = document.createElement('a-entity');
    pin.setAttribute('geometry', 'primitive: cylinder; radius: 0.05; height: 2'); // ustun
    pin.setAttribute('material', 'color: lime');
    pin.setAttribute('position', `${doorOffset} 0 -${distance}`);

    const cone = document.createElement('a-entity');
    cone.setAttribute('geometry', 'primitive: cone; radiusBottom: 0.3; height: 0.5'); // tepasi
    cone.setAttribute('material', 'color: lime');
    cone.setAttribute('position', '0 1 0');
    pin.appendChild(cone);

    // Manzil yozuvi
    const text = document.createElement('a-text');
    text.setAttribute('value', `Xona ${room.id}`);
    text.setAttribute('align', 'center');
    text.setAttribute('scale', '3 3 3');
    text.setAttribute('position', `0 1.5 0`);
    // Matnni aylantiramiz shunda userga qaraydi
    text.setAttribute('rotation', '0 0 0');

    pin.appendChild(text);
    worldRoot.appendChild(pin);
}

// 4. QAYTA BOSHLASH
window.resetApp = function () {
    worldRoot.innerHTML = '';
    btnReset.style.display = 'none';
    navHintBox.style.display = 'none';
    roomListContainer.style.display = 'block';
}