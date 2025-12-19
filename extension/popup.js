// popup.js - Simple and clean popup for ViewLoop extension

document.addEventListener('DOMContentLoaded', function() {
    const primaryBtn = document.querySelector('.primary-btn');

    // Primary button: Show instructions
    primaryBtn.addEventListener('click', function() {
        alert('للبدء في كسب النقاط:\n\n1. افتح يوتيوب\n2. شغل فيديو\n3. ابدأ المشاهدة الطبيعية\n\nالنظام سيتتبع تلقائيًا!');
    });

    // Set default values for read-only dashboard
    document.querySelector('.user-name').textContent = 'أهلاً، يا مستخدم';
    document.querySelector('.points-text').textContent = 'النقاط ستظهر هنا';
    document.querySelector('.profile-pic').src = 'https://via.placeholder.com/40';
});
