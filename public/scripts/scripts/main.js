import { saveScheduleToFirestore, loadScheduleFromFirestore, saveTokenToFirestore } from './firestore.js';
import { openModal, closeModal } from './modal.js';
import { updateCountdown, formatTime } from './countdown.js';
import { initializeDragAndDrop } from './dragdrop.js';
import { shareSchedule, copyUrl } from './share.js';
import { setupNotifications, updateNotificationButton, cancelNotifications } from './notification.js';
import { getCurrentUser, setCurrentUser, clearCurrentUser } from './session.js';
import { init } from './init.js';

const hideLoadingOverlay = () => {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.style.display = 'none';
};

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. การตั้งค่า Firebase ---
    const firebaseConfig = {
        apiKey: window.env.FIREBASE_API_KEY,
        authDomain: window.env.FIREBASE_AUTH_DOMAIN,
        projectId: window.env.FIREBASE_PROJECT_ID,
        storageBucket: window.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: window.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: window.env.FIREBASE_APP_ID,
        measurementId: window.env.FIREBASE_MEASUREMENT_ID
    };

    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    // --- 2. ส่วนของ DOM Elements ---
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');
    const loginForm = document.getElementById('login-form');
    const userIdInput = document.getElementById('user-id-input');
    const currentUserDisplay = document.getElementById('current-user-display');
    const logoutBtn = document.getElementById('logout-btn');
    const editModeSwitch = document.getElementById('edit-mode-switch');
    
    const modal = document.getElementById('add-class-modal');
    const addClassBtn = document.getElementById('add-class-btn');
    const closeBtn = modal.querySelector('.close-btn');
    const form = document.getElementById('add-class-form');
    const deleteBtn = document.getElementById('delete-btn');
    
    const tableContainer = document.querySelector('.table-container');
    const scheduleBody = document.getElementById('schedule-body');
    
    const currentClassContainer = document.getElementById('current-class-container');
    const currentClassTitle = document.getElementById('current-class-title');
    const currentClassTimer = document.getElementById('current-class-timer');
    const nextClassContainer = document.getElementById('next-class-container');
    const nextClassTitle = document.getElementById('next-class-title');
    const nextClassTimer = document.getElementById('next-class-timer');

    const shareBtn = document.getElementById('share-btn');
    const shareModal = document.getElementById('share-modal');
    const shareUrlInput = document.getElementById('share-url-input');
    const copyUrlBtn = document.getElementById('copy-url-btn');
    
    const viewerBanner = document.getElementById('viewer-mode-banner');
    const viewingUserName = document.getElementById('viewing-user-name');
    const exitViewerModeBtn = document.getElementById('exit-viewer-mode-btn');

    const notificationsBtn = document.getElementById('notifications-btn');
    // เพิ่มปุ่ม Cancel Notification
    let cancelNotificationsBtn = document.getElementById('cancel-notifications-btn');
    if (!cancelNotificationsBtn) {
        cancelNotificationsBtn = document.createElement('button');
        cancelNotificationsBtn.id = 'cancel-notifications-btn';
        cancelNotificationsBtn.className = 'button-secondary notification';
        cancelNotificationsBtn.textContent = 'ยกเลิกแจ้งเตือน';
        notificationsBtn.parentNode.insertBefore(cancelNotificationsBtn, notificationsBtn.nextSibling);
    }
    // เพิ่มปุ่ม Test-Noti
    let testNotiBtn = document.getElementById('test-noti-btn');
    if (!testNotiBtn) {
        testNotiBtn = document.createElement('button');
        testNotiBtn.id = 'test-noti-btn';
        testNotiBtn.className = 'button-secondary notification';
        testNotiBtn.textContent = 'Test-Noti';
        cancelNotificationsBtn.parentNode.insertBefore(testNotiBtn, cancelNotificationsBtn.nextSibling);
    }

    // --- 3. State Variables ---
    let currentUser = null;
    let blockIdCounter = 0;
    let ghostBlock = null;
    let isEditMode = false;
    let messaging = null;

    // --- ฟังก์ชัน wrapper สำหรับบันทึกตาราง ---
    function saveSchedule(scheduleBody) {
        const user = getCurrentUser();
        console.log('saveSchedule: user=', user, 'db=', db, 'scheduleBody=', scheduleBody);
        return saveScheduleToFirestore(db, user, scheduleBody);
    }

    // --- 4. ฟังก์ชันจัดการข้อมูล (CRUD + Firestore) ---
    // async function saveScheduleToFirestore() {
    //     if (!currentUser) return;
    //     const allBlocks = document.querySelectorAll('.class-block');
    //     const scheduleData = Array.from(allBlocks).map(block => ({ ...block.dataset }));
    //     const userDocRef = db.collection('users').doc(currentUser);
    //     try {
    //         await userDocRef.set({ schedule: scheduleData });
    //         console.log("Schedule saved for", currentUser);
    //     } catch (error) {
    //         console.error("Error saving schedule: ", error);
    //         alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    //     }
    // }

    // async function loadScheduleFromFirestore(userId) {
    //     scheduleBody.querySelectorAll('.class-block').forEach(block => block.remove());
    //     const userDocRef = db.collection('users').doc(userId);
    //     try {
    //         const doc = await userDocRef.get();
    //         if (doc.exists) {
    //             const data = doc.data();
    //             const scheduleData = data.schedule || [];
    //             let maxId = 0;
    //             scheduleData.forEach(item => {
    //                 createClassBlock(item);
    //                 const idNum = parseInt(item.id.split('-').pop());
    //                 if (idNum > maxId) maxId = idNum;
    //             });
    //             blockIdCounter = maxId;
    //         } else {
    //             console.log("No schedule found for this user, creating a new one.");
    //             blockIdCounter = 0;
    //         }
    //     } catch (error) {
    //         console.error("Error loading schedule: ", error);
    //         alert("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    //     }
    // }

    function createClassBlock(data) {
        const [startHour, startMinute] = data.startTime.split(':').map(Number);
        const [endHour, endMinute] = data.endTime.split(':').map(Number);
        const durationMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
        if (durationMinutes <= 0) return;
        const targetRow = scheduleBody.querySelector(`tr[data-time="${startHour}"]`);
        if (!targetRow) return;
        const targetCell = targetRow.cells[parseInt(data.day)];
        if (!targetCell) return;
        const block = document.createElement('div');
        block.id = data.id;
        block.className = `class-block ${data.colorClass}`;
        // **แก้ไข HTML ให้ถูกต้อง: ปิดแท็ก strong และ h4**
        block.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center;">
            <strong><h3 style="margin: 0;">${data.name}</h3></strong>
            <span>${data.startTime} - ${data.endTime}</span>
            <span>${data.location || ''}</span>
            </div>
        `;
        Object.assign(block.dataset, data);
        const cellHeight = 67;
        const topPosition = (startMinute / 60) * cellHeight;
        const blockHeight = (durationMinutes / 60) * cellHeight;
        block.style.top = `${topPosition}px`;
        block.style.height = `${blockHeight - 4}px`;
        targetCell.appendChild(block);
    }
window.createClassBlock = createClassBlock;
window.getFirestoreDB = () => db;
window.getCurrentUser = () => getCurrentUser();
window.getScheduleBody = () => document.getElementById('schedule-body');
window.saveScheduleToFirestore = () => {
  const db = window.getFirestoreDB();
  const currentUser = window.getCurrentUser();
  const scheduleBody = window.getScheduleBody();
  return saveScheduleToFirestore(db, currentUser, scheduleBody);
};
window.updateCountdown = updateCountdown;
window.scheduleBody = scheduleBody;
window.currentClassContainer = currentClassContainer;
window.currentClassTitle = currentClassTitle;
window.currentClassTimer = currentClassTimer;
window.nextClassContainer = nextClassContainer;
window.nextClassTitle = nextClassTitle;
window.nextClassTimer = nextClassTimer;
window.db = db;

    // --- 5. ฟังก์ชันจัดการ UI และ Event Listeners ---
    // const openModal = () => modal.classList.add('show');
    // const closeModal = () => {
    //     modal.classList.remove('show');
    //     form.reset();
    //     document.getElementById('editing-block-id').value = '';
    //     deleteBtn.classList.remove('visible');
    // };
    
    addClassBtn.addEventListener('click', () => {
        form.reset();
        deleteBtn.classList.remove('visible');
        openModal(modal);
    });
    closeBtn.addEventListener('click', () => closeModal(modal, form, deleteBtn));
    
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const startTimeStr = document.getElementById('start-time').value;
        const endTimeStr = document.getElementById('end-time').value;
        const startTime = new Date(`1970-01-01T${startTimeStr}`);
        const endTime = new Date(`1970-01-01T${endTimeStr}`);
        if (endTime <= startTime) {
            alert('เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้นเสมอ!');
            return;
        }
        const editingBlockId = document.getElementById('editing-block-id').value;
        const classData = {
            id: editingBlockId || `class-block-${++blockIdCounter}`,
            name: document.getElementById('subject-name').value,
            day: document.getElementById('day').value,
            startTime: startTimeStr,
            endTime: endTimeStr,
            location: document.getElementById('location').value,
            colorClass: document.getElementById('subject-color').value,
        };
        if (editingBlockId) document.getElementById(editingBlockId)?.remove();
        createClassBlock(classData);
        closeModal(modal, form, deleteBtn);
        await saveSchedule(scheduleBody);
        updateCountdown(scheduleBody, currentClassContainer, currentClassTitle, currentClassTimer, nextClassContainer, nextClassTitle, nextClassTimer);
    });

    deleteBtn.addEventListener('click', async () => {
        const editingBlockId = document.getElementById('editing-block-id').value;
        if (editingBlockId && confirm('คุณต้องการลบรายวิชานี้ใช่หรือไม่?')) {
            document.getElementById(editingBlockId)?.remove();
            closeModal(modal, form, deleteBtn);
            await saveSchedule(scheduleBody);
            updateCountdown(scheduleBody, currentClassContainer, currentClassTitle, currentClassTimer, nextClassContainer, nextClassTitle, nextClassTimer);
        }
    });

    tableContainer.addEventListener('click', (e) => {
        if (!isEditMode) return; 
        const block = e.target.closest('.class-block');
        if (block) {
            const data = block.dataset;
            document.getElementById('editing-block-id').value = data.id;
            document.getElementById('subject-name').value = data.name;
            document.getElementById('day').value = data.day;
            document.getElementById('start-time').value = data.startTime;
            document.getElementById('end-time').value = data.endTime;
            document.getElementById('location').value = data.location;
            document.getElementById('subject-color').value = data.colorClass;
            deleteBtn.classList.add('visible');
            openModal(modal);
        }
    });

    // --- 6. ระบบ Countdown Timer ---
    // function updateCountdown() {
    //     const now = new Date();
    //     const todayDay = now.getDay() === 0 ? 7 : now.getDay();
    //     const allClassesToday = Array.from(document.querySelectorAll('.class-block'))
    //         .map(block => {
    //             const [startH, startM] = block.dataset.startTime.split(':');
    //             const [endH, endM] = block.dataset.endTime.split(':');
    //             return {
    //                 name: block.dataset.name,
    //                 day: parseInt(block.dataset.day),
    //                 location: block.dataset.location,
    //                 startTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), startH, startM),
    //                 endTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM)
    //             };
    //         })
    //         .filter(cls => cls.day === todayDay)
    //         .sort((a, b) => a.startTime - b.startTime);
    //     let currentClass = allClassesToday.find(cls => now >= cls.startTime && now < cls.endTime);
    //     let nextClass = allClassesToday.find(cls => now < cls.startTime);
    //     if (currentClass) {
    //         currentClassContainer.classList.remove('hidden');
    //         const diff = currentClass.endTime - now;
    //         const { hours, minutes, seconds } = formatTime(diff);
    //         currentClassTitle.innerHTML = `<div class="countdown-subject-info"><strong>${currentClass.name}</strong><span><br>${currentClass.startTime.toTimeString().substring(0, 5)} - ${currentClass.endTime.toTimeString().substring(0, 5)}</span><span><br><strong><u> > ${currentClass.location || ''}</u></span></div><small>จะสิ้นสุดใน</small>`;
    //         currentClassTimer.textContent = `${hours}:${minutes}:${seconds}`;
    //     } else {
    //         currentClassContainer.classList.add('hidden');
    //     }
    //     if (nextClass) {
    //         nextClassContainer.classList.remove('hidden');
    //         const diff = nextClass.startTime - now;
    //         const { hours, minutes, seconds } = formatTime(diff);
    //         nextClassTitle.innerHTML = `<div class="countdown-subject-info"><strong>${nextClass.name}</strong><span><br>${nextClass.startTime.toTimeString().substring(0, 5)} - ${nextClass.endTime.toTimeString().substring(0, 5)}</span><span><br><strong><u> > ${nextClass.location || ''}</u></span></div><small>จะเริ่มใน</small>`;
    //         nextClassTimer.textContent = `${hours}:${minutes}:${seconds}`;
    //     } else {
    //         nextClassContainer.classList.add('hidden');
    //     }
    // }

    // function formatTime(ms) {
    //     if (ms < 0) ms = 0;
    //     const totalSeconds = Math.floor(ms / 1000);
    //     const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    //     const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    //     const seconds = String(totalSeconds % 60).padStart(2, '0');
    //     return { hours, minutes, seconds };
    // }
    
    // --- 7. ระบบ Drag & Drop ด้วย Interact.js ---
    // function initializeDragAndDrop() {
    //     interact('.class-block').draggable({
    //         listeners: {
    //             start(event) {
    //                 const block = event.target;
    //                 block.classList.add('dragging');
    //                 ghostBlock = document.createElement('div');
    //                 ghostBlock.className = 'ghost-block';
    //                 ghostBlock.style.height = `${block.offsetHeight}px`;
    //                 ghostBlock.style.width = `${block.offsetWidth}px`;
    //                 tableContainer.appendChild(ghostBlock);
    //             },
    //             move(event) {
    //                 const currentCell = document.elementsFromPoint(event.clientX, event.clientY).find(el => el.tagName === 'TD' && el.parentElement.hasAttribute('data-time'));
    //                 if (currentCell && ghostBlock) {
    //                     const parentRow = currentCell.parentElement;
    //                     const cellHeight = 60;
    //                     const containerRect = tableContainer.getBoundingClientRect();
    //                     const yInCell = event.clientY - parentRow.getBoundingClientRect().top;
    //                     const minutes = Math.round((yInCell / cellHeight) * 60 / 30) * 30;
    //                     const snappedHour = parseInt(parentRow.dataset.time) + Math.floor(minutes / 60);
    //                     const snappedMinute = minutes % 60;
    //                     const snappedTop = (parentRow.getBoundingClientRect().top - containerRect.top) + ((snappedMinute / 60) * cellHeight);
    //                     const snappedLeft = currentCell.getBoundingClientRect().left - containerRect.left;
    //                     ghostBlock.style.transform = `translate(${snappedLeft}px, ${snappedTop}px)`;
    //                     ghostBlock.dataset.newDay = currentCell.cellIndex;
    //                     ghostBlock.dataset.newStartHour = snappedHour;
    //                     ghostBlock.dataset.newStartMinute = snappedMinute;
    //                     ghostBlock.dataset.isValidTarget = "true";
    //                 } else if (ghostBlock) {
    //                     ghostBlock.style.transform = 'scale(0)';
    //                     ghostBlock.dataset.isValidTarget = "false";
    //                 }
    //             },
    //             end: async (event) => {
    //                 const block = event.target;
    //                 block.classList.remove('dragging');
    //                 if (ghostBlock && ghostBlock.dataset.isValidTarget === "true") {
    //                     const newDay = ghostBlock.dataset.newDay;
    //                     const newStartHour = parseInt(ghostBlock.dataset.newStartHour);
    //                     const newStartMinute = parseInt(ghostBlock.dataset.newStartMinute);
    //                     const durationMinutes = (parseInt(block.dataset.endTime.split(':')[0]) * 60 + parseInt(block.dataset.endTime.split(':')[1])) - (parseInt(block.dataset.startTime.split(':')[0]) * 60 + parseInt(block.dataset.startTime.split(':')[1]));
    //                     const endTotalMinutes = newStartHour * 60 + newStartMinute + durationMinutes;
    //                     const newEndHour = Math.floor(endTotalMinutes / 60);
    //                     const newEndMinute = endTotalMinutes % 60;
    //                     const newClassData = {
    //                         ...block.dataset,
    //                         day: newDay,
    //                         startTime: `${String(newStartHour).padStart(2, '0')}:${String(newStartMinute).padStart(2, '0')}`,
    //                         endTime: `${String(newEndHour).padStart(2, '0')}:${String(newEndMinute).padStart(2, '0')}`,
    //                     };
    //                     block.remove();
    //                     createClassBlock(newClassData);
    //                     await saveScheduleToFirestore();
    //                     updateCountdown();
    //                 }
    //                 if (ghostBlock) {
    //                     ghostBlock.remove();
    //                     ghostBlock = null;
    //                 }
    //             }
    //         },
    //         inertia: false
    //     });
    // }

    // --- 8. ระบบแชร์ (Share System) ---
    shareBtn.addEventListener('click', () => {
        const allBlocks = document.querySelectorAll('.class-block');
        const scheduleData = Array.from(allBlocks).map(block => ({ ...block.dataset }));
        const jsonString = JSON.stringify(scheduleData);
        const encodedData = btoa(unescape(encodeURIComponent(jsonString)));
        const shareUrl = `${window.location.origin}${window.location.pathname}?view=${encodedData}&user=${encodeURIComponent(currentUser)}`;
        shareUrlInput.value = shareUrl;
        shareModal.querySelector('.close-btn').onclick = () => shareModal.classList.remove('show');
        shareModal.classList.add('show');
    });

    copyUrlBtn.addEventListener('click', () => {
        shareUrlInput.select();
        document.execCommand('copy');
        copyUrlBtn.textContent = 'คัดลอกแล้ว!';
        setTimeout(() => { copyUrlBtn.textContent = 'คัดลอกลิงก์'; }, 2000);
    });

    exitViewerModeBtn.addEventListener('click', () => {
        window.location.href = `${window.location.origin}${window.location.pathname}`;
    });

    // --- 9. หัวใจหลัก: ระบบจัดการ User Session และการเริ่มต้นแอป ---
    
    // **ฟังก์ชันสำหรับสลับโหมด View/Edit**
    function setEditMode(enabled) {
        isEditMode = enabled;
        appContainer.classList.toggle('view-mode', !enabled);
        appContainer.classList.toggle('edit-mode', enabled);

        // **แก้ไขวิธีการเปิด/ปิด Drag & Drop ที่ปลอดภัยกว่า**
        // เราจะตั้งค่า draggable ใหม่ทั้งหมดเมื่อมีการสลับโหมด
        initializeDragAndDrop(
            window.interact,
            tableContainer,
            createClassBlock,
            saveSchedule, // ส่งฟังก์ชันนี้เข้าไป
            updateCountdown,
            scheduleBody,
            currentClassContainer,
            currentClassTitle,
            currentClassTimer,
            nextClassContainer,
            nextClassTitle,
            nextClassTimer
        ); 
        window.interact('.class-block').draggable(enabled);
        
        editModeSwitch.checked = enabled;
    }

    editModeSwitch.addEventListener('change', (event) => {
        setEditMode(event.target.checked);
    });

    // async function init() {
    //     const urlParams = new URLSearchParams(window.location.search);
    //     const viewData = urlParams.get('view');
    //     const viewingUser = urlParams.get('user');

    //     if (viewData) {
    //         appContainer.classList.add('read-only');
    //         loginScreen.style.display = 'none';
    //         appContainer.style.display = 'block';
    //         viewerBanner.classList.remove('hidden');
    //         viewingUserName.textContent = decodeURIComponent(viewingUser) || 'ไม่ระบุชื่อ';
    //         try {
    //             const decodedData = decodeURIComponent(escape(atob(viewData)));
    //             const scheduleData = JSON.parse(decodedData);
    //             scheduleData.forEach(data => createClassBlock(data));
    //         } catch (e) {
    //             console.error("Error parsing shared data:", e);
    //             alert("ไม่สามารถโหลดข้อมูลที่แชร์มาได้ อาจเป็นเพราะลิงก์ไม่ถูกต้อง");
    //         }
    //         setInterval(updateCountdown, 1000);
    //         updateCountdown();
    //     } else {
    //         currentUser = localStorage.getItem('currentScheduleAppUser');
    //         if (currentUser) {
    //             loginScreen.style.display = 'none';
    //             appContainer.style.display = 'block';
    //             currentUserDisplay.textContent = currentUser;
                
    //             await loadScheduleFromFirestore(currentUser);
    //                     await setupNotifications(); 

    //             // **เริ่มต้นแอปใน View Mode เสมอ**
    //             setEditMode(false); 
                
    //             setInterval(updateCountdown, 1000);
    //             updateCountdown();
    //         } else {
    //             loginScreen.style.display = 'flex';
    //             appContainer.style.display = 'none';
    //         }
    //     }
    // }

    // --- 5. ฟังก์ชันจัดการ UI และ Event Listeners ---

// **ฟังก์ชันใหม่: จัดการการขออนุญาต Notification**
// async function setupNotifications() {
//     messaging = firebase.messaging();

//     // 1. ขอ Token จากเบราว์เซอร์
//     try {
//         const currentToken = await messaging.getToken({ vapidKey: 'BCj5cczKbYfHuJnCKjZ3hLsa4DpIMD6r_S7dNbNVr5pKqUw1oMv_V0F_ujv4XeH5QG8kwZSOb6augSU6Ya-k0HE	' }); // **สำคัญมาก!**
//         if (currentToken) {
//             console.log('FCM Token:', currentToken);
//             // 2. ส่ง Token ไปบันทึกที่ Firestore
//             await saveTokenToFirestore(currentToken);
//             // 3. อัปเดต UI
//             updateNotificationButton(true);
//         } else {
//             // ผู้ใช้ยังไม่ได้ให้สิทธิ์
//             console.log('No registration token available. Request permission to generate one.');
//             updateNotificationButton(false);
//         }
//     } catch (err) {
//         console.error('An error occurred while retrieving token. ', err);
//         notificationsBtn.textContent = 'การแจ้งเตือนมีปัญหา';
//         notificationsBtn.disabled = true;
//     }
// }

// **ฟังก์ชันใหม่: บันทึก Token ลง Firestore**
// async function saveTokenToFirestore(token) {
//     if (!currentUser) return;
//     const userDocRef = db.collection('users').doc(currentUser);
//     try {
//         // ใช้ arrayUnion เพื่อเพิ่ม Token ใหม่เข้าไปโดยไม่ซ้ำกับของเดิม
//         await userDocRef.update({
//             notificationTokens: firebase.firestore.FieldValue.arrayUnion(token)
//         });
//         console.log('Token saved to Firestore.');
//     } catch (error) {
//         // ถ้ายังไม่มี document หรือ field นี้ ให้สร้างใหม่
//         if (error.code === 'not-found' || error.code === 'invalid-argument') {
//             await userDocRef.set({
//                 notificationTokens: [token]
//             }, { merge: true });
//             console.log('Token field created and token saved.');
//         } else {
//             console.error('Error saving token: ', error);
//         }
//     }
// }

// **ฟังก์ชันใหม่: อัปเดตหน้าตาปุ่ม**
// function updateNotificationButton(isSubscribed) {
//     if (isSubscribed) {
//         notificationsBtn.textContent = 'ปิดการแจ้งเตือน';
//         notificationsBtn.disabled = true; // ทำให้เป็นแบบ One-way subscribe ก่อนเพื่อความง่าย
//     } else {
//         notificationsBtn.textContent = 'เปิดการแจ้งเตือน';
//         notificationsBtn.disabled = false;
//     }
// }

// **เพิ่ม Event Listener ให้ปุ่ม**
    const _firebase = window.firebase || firebase;
    notificationsBtn.addEventListener('click', async () => {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            await setupNotifications(_firebase, db, getCurrentUser(), notificationsBtn, saveTokenToFirestore, updateNotificationButton);
        } else {
            console.log('Unable to get permission to notify.');
            alert('คุณต้องอนุญาตการแจ้งเตือนในตั้งค่าของเบราว์เซอร์');
        }
    });
    cancelNotificationsBtn.addEventListener('click', async () => {
        await cancelNotifications(_firebase, db, getCurrentUser(), notificationsBtn, updateNotificationButton);
    });

    // ฟังก์ชันสำหรับแสดง Notification ผ่าน Service Worker ถ้าได้, ถ้าไม่ได้ fallback เป็น Notification API
    async function showNotification(title, body) {
        if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) {
                reg.showNotification(title, {
                    body,
                    icon: '/icons/android-chrome-192x192.png',
                    badge: '/icons/android-chrome-192x192.png',
                });
                return;
            }
        }
        // fallback
        if (window.Notification && Notification.permission === 'granted') {
            new Notification(title, {
                body,
                icon: '/icons/android-chrome-192x192.png',
            });
        }
    }

    testNotiBtn.addEventListener('click', async () => {
        // ดึง class-block ทั้งหมด
        const allBlocks = Array.from(document.querySelectorAll('.class-block'));
        if (allBlocks.length === 0) {
            alert('ยังไม่มีรายวิชาในตาราง');
            return;
        }
        // สุ่ม 3 วิชา (ถ้าน้อยกว่า 3 ก็ใช้เท่าที่มี)
        const shuffled = allBlocks.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, Math.min(3, allBlocks.length));
        for (let i = 0; i < selected.length; i++) {
            const block = selected[i];
            const data = block.dataset;
            const title = data.name || 'วิชา';
            const body = `${data.startTime} - ${data.endTime} @ ${data.location || ''}`;
            await showNotification(title, body);
            // เว้นระยะ 500ms ระหว่างแต่ละ noti
            if (i < selected.length - 1) {
                await new Promise(res => setTimeout(res, 500));
            }
        }
    });

    // ฟังก์ชันสำหรับสุ่มแจ้งเตือนวิชาเดียว (Test)
    async function testRandomNotification() {
        const allBlocks = Array.from(document.querySelectorAll('.class-block'));
        if (allBlocks.length === 0) {
            alert('ยังไม่มีรายวิชาในตาราง');
            return;
        }
        const block = allBlocks[Math.floor(Math.random() * allBlocks.length)];
        const data = block.dataset;
        const title = `[Test] ${data.name || 'วิชา'}`;
        const body = `${data.startTime} - ${data.endTime} @ ${data.location || ''}`;
        await showNotification(title, body);
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const userId = userIdInput.value.trim();
        if (userId) {
            localStorage.setItem('currentScheduleAppUser', userId);
            location.reload();
        }
    });

    logoutBtn.addEventListener('click', () => {
        if (confirm('คุณต้องการออกจากระบบและกลับไปหน้าเลือกผู้ใช้?')) {
            localStorage.removeItem('currentScheduleAppUser');
            location.reload();
        }
    });

    // ** เริ่มการทำงานของแอปพลิเคชัน **
    // เรียก init() แล้วซ่อน loading overlay เมื่อเสร็จ
    (async () => {
        await init({
            appContainer,
            loginScreen,
            currentUserDisplay,
            scheduleBody,
            currentClassContainer,
            currentClassTitle,
            currentClassTimer,
            nextClassContainer,
            nextClassTitle,
            nextClassTimer,
            viewerBanner,
            viewingUserName,
            editModeSwitch,
            setEditMode,
            loadScheduleFromFirestore,
            setupNotifications,
            updateCountdown,
            getCurrentUser,
            db,
            createClassBlock,
            setBlockIdCounter: (val) => { blockIdCounter = val; },
            firebase: _firebase,
            notificationsBtn,
            saveTokenToFirestore,
            updateNotificationButton
        });
        hideLoadingOverlay();
    })();

    // ฟังก์ชันแจ้งเตือนจริงสำหรับคาบเรียน
    async function checkAndSendClassNotifications() {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        const now = new Date();
        const todayDay = now.getDay() === 0 ? 7 : now.getDay();
        const allBlocks = Array.from(document.querySelectorAll('.class-block'));
        if (allBlocks.length === 0) return;
        // ดึงเฉพาะคาบของวันนี้
        const classesToday = allBlocks
            .map(block => {
                const [startH, startM] = block.dataset.startTime.split(':');
                const [endH, endM] = block.dataset.endTime.split(':');
                return {
                    name: block.dataset.name,
                    day: parseInt(block.dataset.day),
                    location: block.dataset.location,
                    startTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), startH, startM),
                    endTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM)
                };
            })
            .filter(cls => cls.day === todayDay)
            .sort((a, b) => a.startTime - b.startTime);
        if (classesToday.length === 0) return;
        // หาคาบปัจจุบันและคาบถัดไป
        let currentClass = classesToday.find(cls => now >= cls.startTime && now < cls.endTime);
        let nextClass = classesToday.find(cls => now < cls.startTime);
        // แจ้งเตือนจะหมดเวลาเรียนคาบนี้อีก 15 นาที
        if (currentClass) {
            const diffMs = currentClass.endTime - now;
            const diffMin = Math.floor(diffMs / 60000);
            if (diffMin === 15) {
                await showNotification('ใกล้หมดเวลาเรียน',
                    `จะหมดเวลาเรียนวิชา ${currentClass.name} (${currentClass.startTime.toTimeString().substring(0,5)}-${currentClass.endTime.toTimeString().substring(0,5)}) อีก 15 นาที${currentClass.location ? ' @ ' + currentClass.location : ''}`
                );
            }
        } else if (nextClass) {
            // ถ้าไม่มีคาบปัจจุบัน ให้แจ้งเตือนก่อนถึงคาบถัดไป 10 นาที
            const diffMs = nextClass.startTime - now;
            const diffMin = Math.floor(diffMs / 60000);
            if (diffMin === 10) {
                await showNotification('ใกล้ถึงเวลาเรียน',
                    `จะถึงเวลาเรียนวิชา ${nextClass.name} (${nextClass.startTime.toTimeString().substring(0,5)}-${nextClass.endTime.toTimeString().substring(0,5)}) อีก 10 นาที${nextClass.location ? ' @ ' + nextClass.location : ''}`
                );
            }
        }
    }
    // เรียกทุก 30 วินาที
    setInterval(checkAndSendClassNotifications, 30000);
});