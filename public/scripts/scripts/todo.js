function getCurrentUser() {
  return localStorage.getItem('currentScheduleAppUser');
}

function getSubjectName() {
  const params = new URLSearchParams(window.location.search);
  return params.get('name');
}

const subjectName = getSubjectName();
const subjectTitle = document.getElementById('subject-title');
const todoList = document.getElementById('todo-list');
const addTodoForm = document.getElementById('add-todo-form');
const todoInput = document.getElementById('todo-input');
const todoDue = document.getElementById('todo-due');
const backBtn = document.getElementById('back-btn');

const firebase = window.firebase;
if (!firebaseConfig || !firebaseConfig.projectId) {
  alert('Firebase config (env.js) ไม่ถูกโหลดหรือไม่มีค่า projectId');
}
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

console.log('typeof getCurrentUser:', typeof getCurrentUser);
console.log('getCurrentUser:', getCurrentUser);
console.log('window:', window);
console.log('todo.js loaded');
console.log('subjectName:', subjectName);
console.log('subjectTitle:', subjectTitle);
console.log('todoList:', todoList);
console.log('addTodoForm:', addTodoForm);
console.log('todoInput:', todoInput);
console.log('todoDue:', todoDue);
console.log('backBtn:', backBtn);
console.log('db:', db);
console.log('currentUser:', getCurrentUser());

if (!addTodoForm) {
  alert('ไม่พบฟอร์มเพิ่ม ToDo (addTodoForm)!');
}
if (!todoInput) {
  alert('ไม่พบ input todoInput!');
}
if (!todoDue) {
  alert('ไม่พบ input todoDue!');
}

async function getTodos() {
  try {
    const currentUser = getCurrentUser();
    if (!db || !currentUser || !subjectName) {
      console.error('getTodos: missing db/currentUser/subjectName', {db, currentUser, subjectName});
      return [];
    }
    const doc = await db.collection('users').doc(currentUser).collection('todos').doc(subjectName).get();
    let todos = [];
    if (doc.exists) {
      todos = doc.data().todos || [];
    }
    // Ensure all todos have the new fields
    todos = todos.map(todo => ({
      text: todo.text || '',
      due: todo.due || '',
      priority: todo.priority || 'medium',
      category: todo.category || 'assignment',
      notes: todo.notes || '',
      completed: typeof todo.completed === 'boolean' ? todo.completed : false,
      reminders: Array.isArray(todo.reminders) ? todo.reminders : [24,6,3]
    }));
    return todos;
  } catch (err) {
    console.error('Error loading todos:', err);
    alert('เกิดข้อผิดพลาดในการโหลด ToDo');
    return [];
  }
}

async function saveTodos(todos) {
  try {
    const currentUser = getCurrentUser();
    if (!db || !currentUser || !subjectName) {
      console.error('saveTodos: missing db/currentUser/subjectName', {db, currentUser, subjectName});
      return;
    }
    await db.collection('users').doc(currentUser).collection('todos').doc(subjectName).set({ todos });
  } catch (err) {
    console.error('Error saving todos:', err);
    alert('เกิดข้อผิดพลาดในการบันทึก ToDo');
  }
}

async function renderTodos(filter = 'all', sort = 'date-asc', search = '') {
  try {
    let todos = await getTodos();
    if (filter === 'pending') todos = todos.filter(t => !t.completed && !isOverdue(t.due));
    else if (filter === 'completed') todos = todos.filter(t => t.completed);
    else if (filter === 'overdue') todos = todos.filter(t => !t.completed && isOverdue(t.due));
    if (search) {
      const s = search.toLowerCase();
      todos = todos.filter(t => t.text.toLowerCase().includes(s) || (t.notes && t.notes.toLowerCase().includes(s)));
    }
    if (sort === 'date-asc') todos.sort((a, b) => a.due.localeCompare(b.due));
    else if (sort === 'date-desc') todos.sort((a, b) => b.due.localeCompare(a.due));
    else if (sort === 'priority-desc') todos.sort((a, b) => priorityValue(b.priority) - priorityValue(a.priority));
    else if (sort === 'alphabetical') todos.sort((a, b) => a.text.localeCompare(b.text));

    todoList.innerHTML = '';
    if (todos.length === 0) {
      document.getElementById('empty-state').style.display = '';
    } else {
      document.getElementById('empty-state').style.display = 'none';
      todos.forEach((todo, idx) => {
        const li = document.createElement('li');
        li.className = todo.completed ? 'completed' : '';
        // สร้างข้อความ reminder
        let reminderText = '';
        if (todo.reminders && todo.reminders.length) {
          const sorted = [...todo.reminders].sort((a,b)=>b-a);
          const labelMap = {3:'3 ชม.',6:'6 ชม.',24:'1 วัน',48:'2 วัน',72:'3 วัน',168:'7 วัน'};
          reminderText = '<small class="todo-reminders">แจ้งเตือน: ' + sorted.map(h=>labelMap[h]||h+'ชม.').join(', ') + ' ก่อน</small>';
        }
        li.innerHTML = `
          <span class="todo-main">
            <input type="checkbox" class="todo-completed" data-idx="${idx}" ${todo.completed ? 'checked' : ''}>
            <span class="todo-text">${todo.text}</span>
            <span class="todo-category">[${categoryLabel(todo.category)}]</span>
            <span class="todo-priority priority-${todo.priority}">${priorityLabel(todo.priority)}</span>
            <small class="todo-due">${formatDue(todo.due)}</small>
            ${reminderText}
          </span>
          <span class="todo-actions">
            <button data-idx="${idx}" class="button-danger btn-delete">ลบ</button>
          </span>
          ${todo.notes ? `<div class="todo-notes">${todo.notes}</div>` : ''}
        `;
        todoList.appendChild(li);
      });
    }
    updateProgressAndStats();
  } catch (err) {
    console.error('Error rendering todos:', err);
    alert('เกิดข้อผิดพลาดในการแสดง ToDo');
  }
}

function isOverdue(due) {
  if (!due) return false;
  return new Date(due) < new Date() && !isToday(due);
}
function isToday(due) {
  if (!due) return false;
  const d = new Date(due), now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
function priorityValue(p) {
  if (p === 'high') return 3;
  if (p === 'medium') return 2;
  return 1;
}
function priorityLabel(p) {
  if (p === 'high') return '⭐';
  if (p === 'medium') return '⬆';
  return '⬇';
}
function categoryLabel(c) {
  const map = {assignment:'การบ้าน',exam:'สอบ',project:'โปรเจค',reading:'อ่าน',other:'อื่นๆ'};
  return map[c] || c;
}
function formatDue(due) {
  if (!due) return '';
  const d = new Date(due);
  return d.toLocaleString('th-TH', {dateStyle:'medium', timeStyle:'short'});
}
function updateProgressAndStats() {
  getTodos().then(allTodos => {
    const total = allTodos.length;
    const completed = allTodos.filter(t => t.completed).length;
    const today = allTodos.filter(t => isToday(t.due) && !t.completed).length;
    const overdue = allTodos.filter(t => isOverdue(t.due) && !t.completed).length;
    const upcoming = allTodos.filter(t => {
      if (!t.due || t.completed) return false;
      const d = new Date(t.due), now = new Date();
      return d > now && (d-now)<=(3*24*60*60*1000);
    }).length;
    const fill = document.getElementById('progress-fill');
    if (fill) fill.style.width = total ? (completed/total*100)+'%' : '0%';
    document.getElementById('completed-count').textContent = completed;
    document.getElementById('total-count').textContent = total;
    document.getElementById('today-count').textContent = today;
    document.getElementById('overdue-count').textContent = overdue;
    document.getElementById('upcoming-count').textContent = upcoming;
  });
}

// ฟังก์ชัน schedule notification สำหรับ ToDo
function scheduleTodoReminders(todo) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = Date.now();
  if (!todo.due || !todo.reminders) return;
  const dueTime = new Date(todo.due).getTime();
  todo.reminders.forEach(hoursBefore => {
    const notifyTime = dueTime - hoursBefore * 60 * 60 * 1000;
    if (notifyTime > now) {
      const timeout = notifyTime - now;
      setTimeout(() => {
        new Notification('แจ้งเตือน ToDo', {
          body: `${todo.text} (${hoursBefore >= 24 ? (hoursBefore/24)+' วัน' : hoursBefore+' ชม.'} ก่อนถึงกำหนดส่ง)`
        });
      }, timeout);
    }
  });
}

addTodoForm && addTodoForm.addEventListener('submit', async (e) => {
  console.log('submit event fired');
  try {
    e.preventDefault();
    const text = todoInput.value.trim();
    const due = todoDue.value;
    // New fields
    const priority = document.getElementById('todo-priority')?.value || 'medium';
    const category = document.getElementById('todo-category')?.value || 'assignment';
    const notes = document.getElementById('todo-notes')?.value || '';
    // ดึง reminders จาก checkbox
    const reminderCheckboxes = document.querySelectorAll('.reminder-checkbox');
    const reminders = Array.from(reminderCheckboxes).filter(cb => cb.checked).map(cb => parseInt(cb.value));
    console.log('submit values:', {text, due, priority, category, notes, reminders});
    if (!text || !due) {
      alert('กรุณากรอกข้อมูลให้ครบ');
      return;
    }
    const todos = await getTodos();
    todos.push({ text, due, priority, category, notes, completed: false, reminders });
    await saveTodos(todos);
    await renderTodos();
    addTodoForm.reset();
    // รีเซ็ต reminder เป็น default
    reminderCheckboxes.forEach(cb => {
      cb.checked = cb.value==='24'||cb.value==='6'||cb.value==='3';
    });
    // schedule notification สำหรับ ToDo ที่เพิ่มล่าสุด
    scheduleTodoReminders(todos[todos.length-1]);
  } catch (err) {
    console.error('Error in submit handler:', err);
    alert('เกิดข้อผิดพลาดขณะเพิ่ม ToDo');
  }
});

['filter-all','filter-pending','filter-completed','filter-overdue'].forEach(id => {
  const btn = document.getElementById(id);
  if (btn) btn.addEventListener('click', function() {
    document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    let filter = 'all';
    if (id==='filter-pending') filter = 'pending';
    else if (id==='filter-completed') filter = 'completed';
    else if (id==='filter-overdue') filter = 'overdue';
    renderTodos(filter, getSort(), getSearch());
  });
});
function getFilter() {
  const active = document.querySelector('.filter-btn.active');
  if (!active) return 'all';
  if (active.id==='filter-pending') return 'pending';
  if (active.id==='filter-completed') return 'completed';
  if (active.id==='filter-overdue') return 'overdue';
  return 'all';
}
const sortSelect = document.getElementById('sort-select');
if (sortSelect) sortSelect.addEventListener('change', ()=>renderTodos(getFilter(), getSort(), getSearch()));
function getSort() {
  return sortSelect ? sortSelect.value : 'date-asc';
}
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
if (searchInput) {
  searchInput.addEventListener('input', ()=>{
    renderTodos(getFilter(), getSort(), getSearch());
    clearSearchBtn.style.display = searchInput.value ? '' : 'none';
  });
}
if (clearSearchBtn) {
  clearSearchBtn.addEventListener('click', ()=>{
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    renderTodos(getFilter(), getSort(), '');
  });
}
function getSearch() {
  return searchInput ? searchInput.value.trim() : '';
}
if (todoList) {
  todoList.addEventListener('change', async (e) => {
    if (e.target.classList.contains('todo-completed')) {
      const idx = e.target.getAttribute('data-idx');
      const todos = await getTodos();
      todos[idx].completed = e.target.checked;
      await saveTodos(todos);
      await renderTodos(getFilter(), getSort(), getSearch());
    }
  });
}
if (todoList) {
  todoList.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-delete')) {
      const idx = e.target.getAttribute('data-idx');
      console.log('btn-delete clicked, idx:', idx);
      showModal('ยืนยันการลบ', 'คุณต้องการลบ ToDo นี้หรือไม่?', async () => {
        console.log('onConfirm called for delete');
        const todos = await getTodos();
        console.log('todos before splice:', todos);
        todos.splice(idx, 1);
        console.log('todos after splice:', todos);
        await saveTodos(todos);
        await renderTodos(getFilter(), getSort(), getSearch());
      });
    }
  });
}
const quickAddBtn = document.getElementById('quick-add-btn');
if (quickAddBtn) quickAddBtn.addEventListener('click', async ()=>{
  const text = todoInput.value.trim();
  if (!text) return alert('กรุณากรอกสิ่งที่ต้องทำ');
  const todos = await getTodos();
  todos.push({ text, due: '', priority: 'medium', category: 'other', notes: '', completed: false });
  await saveTodos(todos);
  await renderTodos(getFilter(), getSort(), getSearch());
  addTodoForm.reset();
});
const exportBtn = document.getElementById('export-btn');
if (exportBtn) exportBtn.addEventListener('click', async ()=>{
  const todos = await getTodos();
  const blob = new Blob([JSON.stringify(todos, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `todos-${subjectName||'all'}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showNotification('ส่งออกข้อมูลสำเร็จ');
});
const clearCompletedBtn = document.getElementById('clear-completed-btn');
if (clearCompletedBtn) clearCompletedBtn.addEventListener('click', async ()=>{
  showModal('ยืนยันการลบ', 'คุณต้องการลบ ToDo ที่เสร็จแล้วทั้งหมดหรือไม่?', async () => {
    let todos = await getTodos();
    todos = todos.filter(t => !t.completed);
    await saveTodos(todos);
    await renderTodos(getFilter(), getSort(), getSearch());
  });
});
function showModal(title, message, onConfirm) {
  const overlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalMsg = document.getElementById('modal-message');
  const confirmBtn = document.getElementById('modal-confirm');
  const cancelBtn = document.getElementById('modal-cancel');
  if (!overlay) return onConfirm();
  modalTitle.textContent = title;
  modalMsg.textContent = message;
  overlay.style.display = '';
  function cleanup() {
    overlay.style.display = 'none';
    confirmBtn.removeEventListener('click', onOk);
    cancelBtn.removeEventListener('click', onCancel);
  }
  function onOk() {
    console.log('modal confirm clicked');
    cleanup();
    onConfirm();
  }
  function onCancel() { cleanup(); }
  confirmBtn.addEventListener('click', onOk);
  cancelBtn.addEventListener('click', onCancel);
}
function showNotification(msg, type='success') {
  const container = document.getElementById('notification-container');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'notification'+(type==='error' ? ' error' : type==='warning' ? ' warning' : '');
  div.textContent = msg;
  container.appendChild(div);
  setTimeout(()=>div.remove(), 3000);
}

backBtn && backBtn.addEventListener('click', () => {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = '/';
  }
});

subjectTitle.textContent = subjectName ? `ToDo: ${subjectName}` : 'ToDo วิชา';

(async function() {
  const appContainer = document.getElementById('todo-app-container');
  const loadingOverlay = document.getElementById('loading-overlay');
  if (appContainer) appContainer.style.display = 'none';
  if (loadingOverlay) loadingOverlay.style.display = 'flex';

  await renderTodos();

  if (appContainer) appContainer.style.display = '';
  if (loadingOverlay) loadingOverlay.style.display = 'none';
})();

// Event: ปุ่มทดสอบแจ้งเตือน
const testReminderBtn = document.getElementById('test-reminder-btn');
if (testReminderBtn) testReminderBtn.addEventListener('click', () => {
  const text = todoInput.value.trim() || 'ตัวอย่าง ToDo';
  const due = todoDue.value || new Date(Date.now() + 60*60*1000).toISOString().slice(0,16); // default 1 ชม.ข้างหน้า
  const priority = document.getElementById('todo-priority')?.value || 'medium';
  const category = document.getElementById('todo-category')?.value || 'assignment';
  const notes = document.getElementById('todo-notes')?.value || '';
  const reminderCheckboxes = document.querySelectorAll('.reminder-checkbox');
  const reminders = Array.from(reminderCheckboxes).filter(cb => cb.checked).map(cb => parseInt(cb.value));
  if (!reminders.length) return alert('กรุณาเลือกช่วงเวลาแจ้งเตือนอย่างน้อย 1 ตัวเลือก');
  // สร้าง todo จำลอง
  const todo = { text, due, priority, category, notes, completed: false, reminders };
  scheduleTodoReminders(todo);
  showNotification('ทดสอบแจ้งเตือนถูกตั้งค่าแล้ว (จะเด้งตามเวลาที่เลือก)', 'success');
}); 