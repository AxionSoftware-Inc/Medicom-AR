// --- SOZLAMALAR ---
const CURRENT_QR_FLOOR = 1; // QR kod turgan qavat (O'zgartirishingiz mumkin)

// Xonalar bazasi (JSON)
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

    // C) HUD (Pastdagi yozuv) ni yangilash
    document.getElementById('hud-info').style.display = 'block';
    document.getElementById('target-name').innerText = room.name;

    // D) AR Yo'lni chizish
    drawPath(room.side, room.distance, room.name);
}

// 4. AR Chizish (Qayta tanlaganda eskisi o'chib yangisi chiziladi)
function drawPath(side, distance, roomName) {
    const root = document.getElementById('world-root');
    root.innerHTML = ''; // Eskij chizmalarni tozalash

    // Strelkalar zanjiri
    for (let i = 2; i <= distance; i++) {
        const arrow = document.createElement('a-entity');

        // Koordinatalar: Side (X), Height (Y), Forward (Z)
        // Chap (-X), O'ng (+X). Oldinga har doim -Z (chunki ARda -Z bu old tomon)
        // Bu yerda biz oddiy chiziq emas, "Egilib borish" effektini beramiz
        // Lekin sizning talabingiz bo'yicha oddiy versiya:

        let posX = (side === 'left') ? -i : i;
        let rotZ = (side === 'left') ? 90 : -90;

        // Eslatma: Bu "Static" yo'l. Foydalanuvchi yursa ham strelka qimirlamaydi (faqat buriladi).
        arrow.setAttribute('position', `${posX} 0 -2`); // Sal oldinroqda turadi
        arrow.setAttribute('rotation', `0 0 ${rotZ}`);

        arrow.innerHTML = `
            <a-cone radius-bottom="0.1" height="0.4" color="#00ff66"></a-cone>
            <a-text value="${i}m" position="0 0.5 0" rotation="0 0 ${-rotZ}" align="center" scale="2 2 2" color="white"></a-text>
        `;
        root.appendChild(arrow);
    }

    // Manzil
    const goal = document.createElement('a-entity');
    let goalX = (side === 'left') ? -(distance + 1) : (distance + 1);
    goal.setAttribute('position', `${goalX} 0.5 -2`);
    goal.innerHTML = `
        <a-sphere radius="0.4" color="yellow" animation="property: scale; to: 1.2 1.2 1.2; dir: alternate; loop: true"></a-sphere>
        <a-text value="${roomName}" position="0 1 0" align="center" scale="4 4 4" color="yellow" side="double"></a-text>
    `;
    root.appendChild(goal);
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