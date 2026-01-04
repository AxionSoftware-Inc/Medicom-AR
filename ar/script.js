// --- SOZLAMALAR ---
const ARROW_SPACING = 1.2; // Strelkalar orasi (metrda)

// URL dan qavatni olamiz
const urlParams = new URLSearchParams(window.location.search);
const currentFloor = urlParams.get('floor') || "1";

// DOM Elementlar
const uiContainer = document.getElementById('ui-container');
const startScreen = document.getElementById('start-screen');
const roomListContainer = document.getElementById('room-list-container');
const roomList = document.getElementById('room-list');
const hud = document.getElementById('hud');
const distVal = document.getElementById('dist-val');
const hudHint = document.getElementById('hud-hint');
const btnReset = document.getElementById('btn-reset');
const arWorld = document.getElementById('ar-world');

// Holat
let targetData = null;
let isNavigating = false;

// Qavat ma'lumotini ko'rsatish
document.getElementById('floor-indicator').innerText = `${currentFloor}-qavat yuklanmoqda...`;

// 1. MA'LUMOTLARNI YUKLASH
fetch('../data.json')
    .then(response => response.json())
    .then(data => {
        const rooms = data[currentFloor];
        if (!rooms) {
            document.getElementById('floor-indicator').innerText = "Bu qavat bo'sh.";
            return;
        }
        document.getElementById('floor-indicator').innerText = `${currentFloor}-qavat. Xonalar: ${rooms.length}`;
        renderRooms(rooms);
    })
    .catch(err => {
        console.error(err);
        document.getElementById('floor-indicator').innerText = "Baza xatosi!";
    });

// 2. RO'YXATNI CHIZISH
function renderRooms(rooms) {
    roomList.innerHTML = '';
    rooms.forEach(room => {
        const div = document.createElement('div');
        div.className = 'room-item';
        // side ga qarab strelka ikonkasini o'zgartiramiz
        const arrowIcon = room.side === 'left' ? '⬅️' : '➡️';
        
        div.innerHTML = `
            <div>
                <div class="room-title">${room.title}</div>
                <div class="room-desc">${room.desc || ''}</div>
            </div>
            <div class="room-arrow" style="font-size:1.5rem">${arrowIcon}</div>
        `;
        div.onclick = () => startNavigation(room);
        roomList.appendChild(div);
    });
}

// 3. START TUGMASI (AR SESSUYANI BOSHLASH)
document.getElementById('start-btn').onclick = async () => {
    try {
        const scene = document.querySelector('a-scene');
        // WebXR local-floor rejimida ishga tushadi (0 nuqta = Start bosilgan joy)
        await scene.enterAR();

        startScreen.style.display = 'none';
        roomListContainer.style.display = 'block'; 
    } catch (e) {
        alert("AR Xatolik: " + e.message);
    }
};

// 4. NAVIGATSIYANI BOSHLASH
function startNavigation(room) {
    targetData = room;
    isNavigating = true;

    // UI almashinuvi
    roomListContainer.style.display = 'none';
    hud.style.display = 'block';
    btnReset.style.display = 'block';

    // KATTA HINT: Qaysi tomonga burilish kerak?
    const turnText = room.side === 'left' ? "CHAPGA BURILING ⬅️" : "O'NGGA BURILING ➡️";
    hudHint.innerText = turnText;
    hudHint.style.color = "#ffff00"; // Sariq rangda ogohlantirish
    hudHint.style.fontSize = "1.2rem";

    // Sahnani tozalash
    arWorld.innerHTML = '';

    // Yo'lni chizish
    drawPath(room);
}

// 5. YO'L CHIZISH (ENG MUHIM QISM)
function drawPath(room) {
    const dist = room.distance;
    const isLeft = room.side === 'left';
    
    // MANTIQ: 
    // Start nuqtasi (0,0,0). Foydalanuvchi -Z ga qarab turibdi.
    // Yo'lak X o'qi bo'ylab ketgan.
    // Chap = -X, O'ng = +X.
    
    const directionMultiplier = isLeft ? -1 : 1; 
    const numArrows = Math.floor(dist / ARROW_SPACING);

    // A. STRELKALAR (Floor Arrows)
    for (let i = 1; i <= numArrows; i++) {
        const xPos = i * ARROW_SPACING * directionMultiplier;
        
        const arrow = document.createElement('a-entity');
        
        // Uchburchak
        arrow.setAttribute('geometry', 'primitive: triangle; vertexA: 0 0.15 0; vertexB: -0.15 -0.15 0; vertexC: 0.15 -0.15 0');
        arrow.setAttribute('material', 'color: #00d2ff; shader: flat; side: double; transparent: true; opacity: 0.8');
        
        // POZITSIYA:
        // xPos: Yon tomonga siljitish
        // y: 0.1 (Yerdan sal tepada, pol teksturasiga kirib ketmasligi uchun)
        // z: 0 (Start chizig'ida)
        arrow.setAttribute('position', `${xPos} 0.1 0`);
        
        // ROTATSIYA:
        // -90 (Yerga yotqizish)
        // isLeft ? 90 : -90 (Strelka uchini o'ng yoki chapga qaratish)
        // Agar Chap bo'lsa (Negative X), strelka uchi -X ga qarashi kerak -> Z bo'yicha 90 buramiz.
        // Agar O'ng bo'lsa (Positive X), strelka uchi +X ga qarashi kerak -> Z bo'yicha -90 buramiz.
        const zRot = isLeft ? 90 : -90;
        arrow.setAttribute('rotation', `-90 0 ${zRot}`);

        // ANIMATSIYA (Pulsatsiya)
        // Strelka turgan joyidan o'z yo'nalishi bo'yicha sal siljib turadi
        const xTo = xPos + (0.4 * directionMultiplier);
        arrow.setAttribute('animation', `property: position; to: ${xTo} 0.1 0; dir: alternate; loop: true; dur: 1000; easing: easeInOutSine`);

        arWorld.appendChild(arrow);
    }

    // B. MANZIL BELGISI (Pin)
    const pin = document.createElement('a-entity');
    const finalX = dist * directionMultiplier;
    
    pin.setAttribute('geometry', 'primitive: cone; radiusBottom: 0.2; height: 1; segmentsRadial: 10');
    pin.setAttribute('material', 'color: #00ff00; emissive: #00ff00; emissiveIntensity: 0.6');
    pin.setAttribute('position', `${finalX} 1.5 0`); // Z=0, chunki koridor to'g'ri chiziq
    pin.setAttribute('animation', 'property: rotation; to: 0 360 0; loop: true; dur: 3000; easing: linear');
    
    // Xona nomi
    const text = document.createElement('a-text');
    text.setAttribute('value', room.title);
    text.setAttribute('align', 'center');
    text.setAttribute('scale', '2 2 2');
    text.setAttribute('position', `${finalX} 2.2 0`);
    text.setAttribute('look-at', '#cam'); // Doim sizga qarab turadi
    
    arWorld.appendChild(pin);
    arWorld.appendChild(text);

    // C. OLDINGA KO'RSATUVCHI KATTA STRELKA (Start payti ko'rinadigan)
    const guideArrow = document.createElement('a-entity');
    guideArrow.setAttribute('geometry', 'primitive: plane; width: 0.5; height: 0.5');
    guideArrow.setAttribute('material', 'src: #arrow-img; transparent:true; color: yellow'); // Yoki oddiy triangle
    // Bu strelkani keyinroq qo'shsa ham bo'ladi, hozircha HUD dagi yozuv yetarli.
}

// 6. MENYUGA QAYTISH
window.resetNavigation = function() {
    isNavigating = false;
    targetData = null;
    hud.style.display = 'none';
    btnReset.style.display = 'none';
    roomListContainer.style.display = 'block';
    arWorld.innerHTML = '';
}

// 7. NAVIGATSIYA LOJIKASI (Tick)
AFRAME.registerComponent('nav-logic', {
    tick: function () {
        if (!isNavigating || !targetData) return;

        const camPos = this.el.camera.el.object3D.position;
        
        // Biz faqat X o'qi bo'yicha masofani o'lchaymiz (chunki Z=0 koridorda)
        const targetX = targetData.distance * (targetData.side === 'left' ? -1 : 1);
        
        // Pifagor shart emas, faqat X farqi
        const dist = Math.abs(targetX - camPos.x);

        // UI yangilash
        distVal.innerText = dist.toFixed(1);

        // Yo'nalish maslahati (Burilgandan keyin)
        // Agar user burilgan bo'lsa, u endi "To'g'riga" yurayotgan bo'ladi.
        if (dist < 1.5) {
            hudHint.innerText = "YETIB KELDINGIZ! 🏁";
            hudHint.style.color = "#00ff00";
        } else {
            // Agar hali ham 0 nuqtaga yaqin bo'lsa (startda tursa)
            if (Math.abs(camPos.x) < 1.0) {
                 hudHint.innerText = targetData.side === 'left' ? "⬅️ CHAPGA BURILING" : "➡️ O'NGGA BURILING";
            } else {
                 hudHint.innerText = "To'g'riga yuring ⬆️";
                 hudHint.style.color = "#fff";
            }
        }
    }
});

document.querySelector('a-scene').setAttribute('nav-logic', '');