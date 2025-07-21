function getCurrentUser() {
    return localStorage.getItem('currentScheduleAppUser');
}
function setCurrentUser(userId) {
    localStorage.setItem('currentScheduleAppUser', userId);
}
function clearCurrentUser() {
    localStorage.removeItem('currentScheduleAppUser');
}
// Attach to window for global access
window.getCurrentUser = getCurrentUser;
window.setCurrentUser = setCurrentUser;
window.clearCurrentUser = clearCurrentUser; 