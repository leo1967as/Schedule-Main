// เพิ่มฟังก์ชันนี้แทนการอ้างอิง window
function getCurrentUser() {
  return localStorage.getItem('currentScheduleAppUser');
}

// อ่าน subjectName จาก query string
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

// ลบ import firebase และ firestore ออก
// import firebase from 'firebase/compat/app';
// import 'firebase/compat/firestore';

// ใช้ window.firebase และ window.env แทน
const firebase = window.firebase;
// const firebaseConfig = window.env;
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
    if (doc.exists) {
      return doc.data().todos || [];
    }
    return [];
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

async function renderTodos() {
  try {
    const todos = await getTodos();
    console.log('renderTodos:', todos);
    todoList.innerHTML = '';
    todos.forEach((todo, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${todo.text} <small>(${todo.due})</small></span> <button data-idx="${idx}" class="button-danger">ลบ</button>`;
      todoList.appendChild(li);
    });
  } catch (err) {
    console.error('Error rendering todos:', err);
    alert('เกิดข้อผิดพลาดในการแสดง ToDo');
  }
}

addTodoForm && addTodoForm.addEventListener('submit', async (e) => {
  console.log('submit event fired');
  try {
    e.preventDefault();
    const text = todoInput.value.trim();
    const due = todoDue.value;
    console.log('submit values:', {text, due});
    if (!text || !due) {
      alert('กรุณากรอกข้อมูลให้ครบ');
      return;
    }
    const todos = await getTodos();
    todos.push({ text, due });
    await saveTodos(todos);
    await renderTodos();
    addTodoForm.reset();
  } catch (err) {
    console.error('Error in submit handler:', err);
    alert('เกิดข้อผิดพลาดขณะเพิ่ม ToDo');
  }
});

todoList && todoList.addEventListener('click', async (e) => {
  if (e.target.tagName === 'BUTTON') {
    try {
      const idx = e.target.getAttribute('data-idx');
      const todos = await getTodos();
      todos.splice(idx, 1);
      await saveTodos(todos);
      await renderTodos();
    } catch (err) {
      console.error('Error in delete handler:', err);
      alert('เกิดข้อผิดพลาดขณะลบ ToDo');
    }
  }
});

backBtn && backBtn.addEventListener('click', () => {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = '/';
  }
});

// ตั้งชื่อวิชา
subjectTitle.textContent = subjectName ? `ToDo: ${subjectName}` : 'ToDo วิชา';

renderTodos(); 