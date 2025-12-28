// --- SOZLAMALAR ---
const CURRENT_QR_FLOOR = 1; // QR kod turgan qavat (O'zgartirishingiz mumkin)

// Xonalar bazasi (JSON orqali yuklanadi)
let roomsData = [];

let initialHeading = null; // Qulflangan kompas yo'nalishi

// 1. Tizimni ishga tushirish (Scan & Start)
async function initSystem() {
    // 0. JSON ma'lumotlarni yuklash
    try {
        const response = await fetch('floor1.json');
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
// 4. AR Chizish (Qayta tanlaganda eskisi o'chib yangisi chiziladi)
function drawPath(side, distance, roomName) {
    const root = document.getElementById('world-root');
    root.innerHTML = ''; // Eskij chizmalarni tozalash

    // Sozlamalar
    const step = 0.5; // Har 50smdan bitta arrow (konuslar zich edi, arrowlar kattaroq bo'lishi mumkin)
    const startOffset = 1.5; // Telefondan 1.5 metr uzoqlikdan boshlanadi
    const numSteps = Math.floor(distance / step);

    // Strelkalar zanjiri
    for (let i = 0; i < numSteps; i++) {
        const arrow = document.createElement('a-entity');

        let currentDist = startOffset + (i * step);

        // Koordinatalar: Side (X), Height (Y), Forward (Z)
        let posX = (side === 'left') ? -currentDist : currentDist;
        let rotZ = (side === 'left') ? 90 : -90;

        // "Yerga yopishib tursin" -> Y = 0.05
        arrow.setAttribute('position', `${posX} 0.05 0`);

        // Rotation: X=-90 (yerda yotish), Z=rotZ (burilish)
        arrow.setAttribute('rotation', `-90 0 ${rotZ}`);

        // Animatsiya (Yonib o'chish)
        // Ko'k rang #00d2ff
        // Triangle ishlatamiz
        arrow.innerHTML = `
            <a-triangle 
                vertex-a="0 0.5 0" 
                vertex-b="-0.25 -0.25 0" 
                vertex-c="0.25 -0.25 0" 
                color="#00d2ff" 
                material="opacity: 0.8; side: double"
                animation="property: material.opacity; from: 1; to: 0.2; dur: 800; dir: alternate; loop: true">
            </a-triangle>
        `;
        root.appendChild(arrow);
    }

    // Manzil shari olib tashlandi (Foydalanuvchi talabi: "oxirida hechnima kerakmas")
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