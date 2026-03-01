function toggleDonorInput() {
    const type = document.querySelector('input[name="donor_type"]:checked').value;
    const userIdDiv = document.getElementById('input-user-id');
    const donorNameDiv = document.getElementById('input-donor-name');
    
    if (type === 'registered') {
        userIdDiv.classList.remove('hidden');
        donorNameDiv.classList.add('hidden');
    } else {
        userIdDiv.classList.add('hidden');
        donorNameDiv.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('inbound-form');
    
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const donorType = document.querySelector('input[name="donor_type"]:checked').value;
            const userId = document.getElementById('inp-user-id').value;
            const donorName = document.getElementById('inp-donor-name').value;
            const bookTitle = document.getElementById('inp-book-title').value;
            const category = document.getElementById('inp-category').value;
            const quantity = document.getElementById('inp-quantity').value;

            // Prepare payload based on donor type
            const payload = {
                user_id: (donorType === 'registered' && userId) ? userId : null,
                donor_name: (donorType === 'walkin' && donorName) ? donorName : null,
                book_title: bookTitle,
                category: category,
                quantity: parseInt(quantity)
            };

            try {
                const response = await fetch('http://localhost:3000/api/donations/inbound', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (result.success) {
                    alert("Donation recorded successfully! Ready for cataloging.");
                    form.reset();
                } else {
                    alert("Error: " + result.message);
                }
            } catch (error) {
                console.error("Submission error:", error);
                if (error.message.includes('Failed to fetch')) {
                    alert("Connection Error: The backend server is not running.\nPlease restart the app or run 'node server.js'.");
                } else {
                    alert("Failed to submit donation. " + error.message);
                }
            }
        });
    }
});