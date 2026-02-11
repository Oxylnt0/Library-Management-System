const path = require('path');
const { db } = require(path.join(__dirname, '../db_config.js'));

document.addEventListener('DOMContentLoaded', () => {
    // Live Preview Logic
    const firstNameInput = document.getElementById('inp-first-name');
    const lastNameInput = document.getElementById('inp-last-name');
    const emailInput = document.getElementById('inp-email');
    const previewName = document.getElementById('preview-name');
    const previewEmail = document.getElementById('preview-email');

    function updatePreview() {
        const first = firstNameInput.value || 'New';
        const last = lastNameInput.value || 'User';
        previewName.textContent = `${first} ${last}`;
        previewEmail.textContent = emailInput.value || 'user@email.com';
    }

    if (firstNameInput) firstNameInput.addEventListener('input', updatePreview);
    if (lastNameInput) lastNameInput.addEventListener('input', updatePreview);
    if (emailInput) emailInput.addEventListener('input', updatePreview);

    // Save Button Logic
    const btnSave = document.getElementById('btn-save');
    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            const firstName = document.getElementById('inp-first-name').value;
            const lastName = document.getElementById('inp-last-name').value;
            const middleInitial = document.getElementById('inp-middle-initial').value;
            const email = document.getElementById('inp-email').value;
            const contact = document.getElementById('inp-contact').value;
            const address = document.getElementById('inp-address').value;
            const birthDate = document.getElementById('inp-birth-date').value;
            const password = document.getElementById('inp-password').value;

            if (!firstName || !lastName || !email || !password) {
                alert("Please fill in all required fields (*)");
                return;
            }

            // Visual feedback
            const originalText = btnSave.innerHTML;
            btnSave.innerHTML = '<span></span> Saving...';
            btnSave.disabled = true;

            try {
                const query = `
                    INSERT INTO USER (first_name, last_name, middle_initial, email, contact_number, address, birth_date, password)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;
                
                await db.execute({
                    sql: query,
                    args: [firstName, lastName, middleInitial, email, contact, address, birthDate, password]
                });

                alert("User added successfully!");
                window.location.href = 'admin_users.html';
            } catch (error) {
                console.error("Error adding user:", error);
                alert("Failed to add user: " + error.message);
                btnSave.innerHTML = originalText;
                btnSave.disabled = false;
            }
        });
    }
});