document.addEventListener('DOMContentLoaded', function() {
    const playerForm = document.getElementById('playerForm');
    const playersTableBody = document.getElementById('playersTableBody');
    const editProfileForm = document.getElementById('editProfileForm');
    const editProfileSection = document.getElementById('editProfileSection');

    // إضافة أو تعديل لاعب
    playerForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const playerId = document.getElementById('playerId').value;
        const formData = new FormData(playerForm);
        const url = playerId ? `/edit-player/${playerId}` : '/add-player';

        fetch(url, {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert(data.message);
                location.reload();
            } else {
                alert('حدث خطأ: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('حدث خطأ أثناء معالجة الطلب');
        });
    });

    // حذف لاعب
    playersTableBody.addEventListener('click', function(e) {
        if (e.target.classList.contains('delete-player')) {
            const playerId = e.target.dataset.playerId;
            if (confirm('هل أنت متأكد من حذف هذا اللاعب؟')) {
                fetch(`/delete-player/${playerId}`, {
                    method: 'DELETE'
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert(data.message);
                        e.target.closest('tr').remove();
                    } else {
                        alert('حدث خطأ: ' + data.message);
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('حدث خطأ أثناء حذف اللاعب');
                });
            }
        }
    });

    // تعبئة نموذج تعديل اللاعب
    playersTableBody.addEventListener('click', function(e) {
        if (e.target.classList.contains('edit-player')) {
            const playerId = e.target.dataset.playerId;
            const row = e.target.closest('tr');
            document.getElementById('playerId').value = playerId;
            document.getElementById('playerName').value = row.cells[0].textContent;
            document.getElementById('playerPosition').value = row.cells[1].textContent;
            document.getElementById('contractDuration').value = parseInt(row.cells[2].textContent);
            document.getElementById('modalTitle').textContent = 'تعديل بيانات اللاعب';
            openModal();
        }
    });

    // تحديث معلومات النادي
    editProfileForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);

        fetch('/update-club-profile', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('تم تحديث المعلومات بنجاح');
                location.reload();
            } else {
                alert('حدث خطأ أثناء تحديث المعلومات');
            }
        })
        .catch(() => alert('حدث خطأ أثناء تحديث المعلومات'));
    });
});

function toggleEditProfile() {
    const editProfileSection = document.getElementById('editProfileSection');
    editProfileSection.style.display = editProfileSection.style.display === 'none' ? 'block' : 'none';
}

function openModal() {
    document.getElementById('playerModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('playerModal').style.display = 'none';
    document.getElementById('playerForm').reset();
    document.getElementById('playerId').value = '';
    document.getElementById('modalTitle').textContent = 'إضافة لاعب جديد';
}


// أضف هذا الكود في نهاية ملف club-profile.ejs أو في ملف JavaScript منفصل

function showAddPlayerModal() {
    document.getElementById('addPlayerModal').style.display = 'block';
  }
  
  function closeAddPlayerModal() {
    document.getElementById('addPlayerModal').style.display = 'none';
  }
  
  document.getElementById('addPlayerForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(this);
  
    fetch('/add-player', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        alert(data.message);
        // إضافة اللاعب الجديد إلى الجدول
        const playersTableBody = document.getElementById('playersTableBody');
        const newRow = playersTableBody.insertRow();
        newRow.dataset.playerId = data.playerId;
        newRow.innerHTML = `
          <td>${formData.get('name')}</td>
          <td>${formData.get('position')}</td>
          <td>${formData.get('contract_duration')} سنة</td>
          <td>
            <button class="btn btn-secondary" onclick="editPlayer(${data.playerId})">تعديل</button>
            <button class="btn btn-danger" onclick="deletePlayer(${data.playerId})">حذف</button>
          </td>
        `;
        closeAddPlayerModal();
        this.reset(); // إعادة تعيين النموذج
      } else {
        alert(data.message || 'حدث خطأ أثناء إضافة اللاعب');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      alert('حدث خطأ أثناء إضافة اللاعب');
    });
  });
  
  // تأكد من إضافة زر لفتح النافذة المنبثقة في مكان مناسب في الصفحة
  // <button onclick="showAddPlayerModal()" class="btn btn-primary">إضافة لاعب جديد</button>