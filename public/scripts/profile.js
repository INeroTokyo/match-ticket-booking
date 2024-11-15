document.addEventListener('DOMContentLoaded', function() {
    // تحديث المعلومات الشخصية
    document.getElementById('personalInfoForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        fetch('/update-personal-info', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert(data.message, 'success');
            } else {
                showAlert(data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('حدث خطأ أثناء تحديث المعلومات الشخصية', 'error');
        });
    });

    // تحديث الصورة الشخصية
    document.getElementById('profilePictureForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        fetch('/change-profile-picture', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert(data.message, 'success');
                document.getElementById('avatarPreview').src = data.newAvatarUrl + '?t=' + new Date().getTime();
            } else {
                showAlert(data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('حدث خطأ أثناء تحديث الصورة الشخصية', 'error');
        });
    });

    // معاينة الصورة قبل الرفع
    document.getElementById('profilePicture').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('avatarPreview').src = e.target.result;
            }
            reader.readAsDataURL(file);
        }
    });

    // جلب سجل المعاملات المالية
    fetch('/transaction-history')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const transactionList = document.getElementById('transactionHistory');
                data.transactions.forEach(transaction => {
                    const li = document.createElement('li');
                    li.textContent = `${transaction.amount} ريال - ${new Date(transaction.created_at).toLocaleString('ar-SA')}`;
                    transactionList.appendChild(li);
                });
            }
        })
        .catch(error => console.error('Error fetching transaction history:', error));
});

function showAlert(message, type) {
    const alertContainer = document.getElementById('alertContainer');
    const alertElement = document.createElement('div');
    alertElement.className = `alert alert-${type}`;
    alertElement.textContent = message;
    alertContainer.innerHTML = '';
    alertContainer.appendChild(alertElement);

    setTimeout(() => {
        alertElement.remove();
    }, 3000);
}

function printTicket(ticketId) {
    window.open(`/print-ticket/${ticketId}`, '_blank');
}