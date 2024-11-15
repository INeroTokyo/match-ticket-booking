document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('bookingModal');
    const bookButtons = document.querySelectorAll('.book-btn');
    const closeBtn = document.querySelector('.close');
    const bookingForm = document.getElementById('bookingForm');
    const matchIdInput = document.getElementById('matchId');
    const filterButtons = document.querySelectorAll('.filter-btn');

    // فتح النافذة المنبثقة عند النقر على زر الحجز
    bookButtons.forEach(button => {
        button.addEventListener('click', function() {
            const matchId = this.getAttribute('data-match-id');
            matchIdInput.value = matchId;
            modal.style.display = 

 'block';
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
        });
    });

    // إغلاق النافذة المنبثقة
    closeBtn.addEventListener('click', closeModal);

    // إغلاق النافذة المنبثقة عند النقر خارجها
    window.addEventListener('click', function(event) {
        if (event.target == modal) {
            closeModal();
        }
    });

    function closeModal() {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }

    // معالجة نموذج الحجز
    bookingForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const matchId = matchIdInput.value;
        const seats = document.getElementById('seats').value;
        const seatType = document.getElementById('seatType').value;

        // هنا يمكنك إضافة كود لإرسال طلب الحجز إلى الخادم
        fetch('/book', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ matchId, seats, seatType }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('تم الحجز بنجاح!');
                closeModal();
                // يمكنك هنا تحديث عرض التذاكر المتاحة إذا لزم الأمر
            } else {
                alert('حدث خطأ أثناء الحجز. الرجاء المحاولة مرة أخرى.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('حدث خطأ أثناء الحجز. الرجاء المحاولة مرة أخرى.');
        });

        // إعادة تعيين النموذج
        this.reset();
    });

    // تصفية المباريات
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            filterMatches(filter);
            
            // تحديث الزر النشط
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
        });
    });

    function filterMatches(filter) {
        const matchCards = document.querySelectorAll('.match-card');
        const today = new Date().toISOString().split('T')[0];
        const oneWeekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        matchCards.forEach(card => {
            const matchDate = card.getAttribute('data-date');
            if (filter === 'all' || 
                (filter === 'today' && matchDate === today) ||
                (filter === 'week' && matchDate >= today && matchDate <= oneWeekLater)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }
});