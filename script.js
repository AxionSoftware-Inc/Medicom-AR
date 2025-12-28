// --- SOZLAMALAR ---
// --- SOZLAMALAR ---
let CURRENT_QR_FLOOR = 1; // Default
const TOTAL_FLOORS = 5; // Jami qavatlar soni

// Xonalar bazasi (JSON orqali yuklanadi)
let roomsData = [];

let initialHeading = null; // Qulflangan kompas yo'nalishi

// 1. Tizimni ishga tushirish (Scan & Start)
async function initSystem() {
    // 0. URL dan qavatni olish (masalan, ?floor=2)
    const urlParams = new URLSearchParams(window.location.search);
    const floorParam = parseInt(urlParams.get('floor'));

    if (floorParam && floorParam > 0 && floorParam <= TOTAL_FLOORS) {
        CURRENT_QR_FLOOR = floorParam;
    }

    // A. JSON ma'lumotlarni yuklash (floor1.json, floor2.json, ...)
    try {
        const fileName = `floor${CURRENT_QR_FLOOR}.json`;
        console.log("Yuklanmoqda:", fileName);

        const response = await fetch(fileName);
        if (!response.ok) throw new Error("Fayl topilmadi");

        roomsData = await response.json();
    } catch (error) {
        console.error("JSON yuklashda xatolik:", error);
        alert("Xonalar ro'yxatini yuklab bo'lmadi!");
        return;
    }

    // 1. Sensor ruxsati (iOS uchun)
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') return alert("Sensor ruxsati berilmadi!");
    }

    // 2. Kompasni 'Lock' qilish (Birinchi marta olingan qiymat langar bo'ladi)
    window.addEventListener('deviceorientation', (e) => {
        if (initialHeading === null) {
            // Android: alpha, iOS: webkitCompassHeading
            initialHeading = e.webkitCompassHeading || e.alpha;
            console.log("Heading Locked:", initialHeading);
        }
    }, { once: true });

    // 3. Kamerani yoqish
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        document.getElementById('bg-video').srcObject = stream;
    } catch (err) {
        console.error("Kamera xatosi:", err);
    }

    // 4. UI ni ochish
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'block';

    // Menyuni chizamiz
    renderRooms();
}

// 2. Xonalar ro'yxatini chiqarish
function renderRooms() {
    const list = document.getElementById('rooms-list');
    list.innerHTML = '';

    roomsData.forEach(room => {
        const btn = document.createElement('button');
        btn.className = 'room-btn';

        // Agar xona boshqa qavatda bo'lsa, ogohlantirish belgisi qo'shamiz
        let floorInfo = room.floor === CURRENT_QR_FLOOR ? '' : `⚠️ ${room.floor}-qavat`;

        btn.innerHTML = `<b>${room.name}</b><br><small>${floorInfo || (room.side === 'left' ? 'Chapda' : 'O\'ngda')}</small>`;

        // Bosilganda
        btn.onclick = () => selectRoom(room);
        list.appendChild(btn);
    });
}

// 3. Xona tanlash va mantiqiy tekshiruv
function selectRoom(room) {
    // A) Qavat tekshiruvi
    if (room.floor !== CURRENT_QR_FLOOR) {
        alert(`Siz hozir ${CURRENT_QR_FLOOR}-qavatdasiz. \n"${room.name}" ga borish uchun ${room.floor}-qavatga chiqing va o'sha yerdagi QR kodni skanerlang.`);
        return; // Strelka chizilmaydi
    }

    // B) Menyuni yig'ish (Collapse)
    const menu = document.getElementById('rooms-menu');
    menu.classList.remove('menu-expanded');
    menu.classList.add('menu-collapsed');

    // Headerdagi matnni o'zgartirish
    document.getElementById('current-target').innerText = "Borilmoqda: " + room.name;
    document.getElementById('toggle-icon').innerText = "▲";

    // C) UI elementlarni yangilash
    document.getElementById('hud-info').style.display = 'block';
    document.getElementById('target-name').innerText = room.name;

    // Turn Indicator (2D) ni ko'rsatish
    showTurnIndicator(room.side);

    // D) AR Yo'lni chizish
    drawPath(room.side, room.distance, room.name);
}

// Yangi funksiya: 2D Burilish ko'rsatkichi
function showTurnIndicator(side) {
    const indicator = document.getElementById('turn-indicator');
    const arrow = document.getElementById('turn-arrow');
    const text = document.getElementById('turn-text');

    indicator.style.display = 'block';

    if (side === 'left') {
        arrow.style.transform = "scaleX(-1)"; // Chapga o'girish
        arrow.style.animation = "blinkMoveLeft 1.5s infinite";
        text.innerText = "Chapga buriling";
    } else {
        arrow.style.transform = "scaleX(1)"; // O'ngga (default)
        arrow.style.animation = "blinkMove 1.5s infinite";
        text.innerText = "O'ngga buriling";
    }

    // 5 sekunddan keyin o'chirish
    setTimeout(() => {
        indicator.style.display = 'none';
        // Qayta ko'rinish beradigan bo'lsa animatsiya buzilmasligi uchun tozalash shart emas, chunki style override bo'ladi
    }, 5000); // 5 sekund turadi
}

// 4. AR Chizish (Qayta tanlaganda eskisi o'chib yangisi chiziladi)
function drawPath(side, distance, roomName) {
    const root = document.getElementById('world-root');
    root.innerHTML = ''; // Eskij chizmalarni tozalash

    // Sozlamalar: 
    // step = 0.3 (zichroq)
    // masofani sun'iy ravishda oshiramiz (+3m)
    const step = 0.3;
    const startOffset = 1.0;
    const drawDistance = distance + 3;
    const numSteps = Math.floor(drawDistance / step);

    // Strelkalar zanjiri
    for (let i = 0; i < numSteps; i++) {
        const arrow = document.createElement('a-entity');

        let currentDist = startOffset + (i * step);
        let posX = (side === 'left') ? -currentDist : currentDist;
        let rotZ = (side === 'left') ? 90 : -90;

        // Y = 0.01 (yerga yaqinroq)
        arrow.setAttribute('position', `${posX} 0.01 0`);
        arrow.setAttribute('rotation', `-90 0 ${rotZ}`);

        // Kichikroq va orasi ochilgan uchburchaklar
        // Uzunlik 0.2m, step 0.3m -> orasida 0.1m joy qoladi
        arrow.innerHTML = `
            <a-triangle 
                vertex-a="0 0.1 0" 
                vertex-b="-0.08 -0.1 0" 
                vertex-c="0.08 -0.1 0" 
                color="#00d2ff" 
                material="opacity: 0.8; side: double"
                animation="property: material.opacity; from: 1; to: 0.2; dur: 800; dir: alternate; loop: true; delay: ${i * 30}">
            </a-triangle>
        `;
        root.appendChild(arrow);
    }
}

// 5. Menyuni ochib-yopish (Header bosilganda)
function toggleMenu() {
    const menu = document.getElementById('rooms-menu');
    const isCollapsed = menu.classList.contains('menu-collapsed');

    if (isCollapsed) {
        menu.classList.remove('menu-collapsed');
        menu.classList.add('menu-expanded');
        document.getElementById('toggle-icon').innerText = "▼";
    } else {
        // Faqat xona tanlangan bo'lsagina yopilishi mumkin
        // Agar hali xona tanlanmagan bo'lsa, yopilmaydi (UX qoidasi)
        if (document.getElementById('world-root').children.length > 0) {
            menu.classList.remove('menu-expanded');
            menu.classList.add('menu-collapsed');
            document.getElementById('toggle-icon').innerText = "▲";
        }
    }
}