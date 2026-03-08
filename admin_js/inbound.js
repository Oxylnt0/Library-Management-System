function toggleDonorInput() {
    const type = document.querySelector('input[name="donor_type"]:checked').value;
    const userNameInput = document.getElementById('inp-user-name');
    const userIdDiv = document.getElementById('input-user-id');
    const donorNameDiv = document.getElementById('input-donor-name');
    
    if (type === 'registered') {
        userIdDiv.classList.remove('hidden');
        donorNameDiv.classList.add('hidden');
    } else {
        userIdDiv.classList.add('hidden');
        donorNameDiv.classList.remove('hidden');
    }

    // Clear inputs when toggling
    document.getElementById('inp-user-id').value = '';
    if (userNameInput) userNameInput.value = '';
    document.getElementById('inp-donor-name').value = '';
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('inbound-form');
    const sessionLog = document.getElementById('session-log');
    const sessionCount = document.getElementById('session-count');
    const btnScan = document.getElementById('btn-scan-qr');
    const scannerModal = document.getElementById('qr-scanner-modal');
    const btnCloseScanner = document.getElementById('btn-close-scanner');
    const html5QrCode = new Html5Qrcode("qr-reader");

    // --- QR SCANNER LOGIC ---
    const onScanSuccess = async (decodedText, decodedResult) => {
        console.log(`Code matched = ${decodedText}`, decodedResult);
        
        // Stop scanning
        await html5QrCode.stop();
        scannerModal.classList.add('hidden');

        try {
            const qrData = JSON.parse(decodedText);
            const userId = qrData.id;

            if (!userId) {
                throw new Error("QR code does not contain a valid user ID.");
            }

            // Fetch user data from server
            const response = await fetch(`http://localhost:3000/api/user/${userId}`);
            const result = await response.json();

            if (result.success) {
                const user = result.data;
                const fullName = `${user.first_name} ${user.last_name}`;
                
                document.getElementById('inp-user-name').value = fullName;
                document.getElementById('inp-user-id').value = user.user_id; // The hidden input
            } else {
                throw new Error(result.message);
            }

        } catch (error) {
            console.error("Error processing QR code:", error);
            alert("Failed to process QR code: " + error.message);
            // Clear fields on error
            document.getElementById('inp-user-name').value = '';
            document.getElementById('inp-user-id').value = '';
        }
    };

    const onScanFailure = (error) => {
        // This callback is called frequently, so we keep it quiet.
        // console.warn(`Code scan error = ${error}`);
    };

    btnScan.addEventListener('click', () => {
        scannerModal.classList.remove('hidden');
        html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            onScanSuccess,
            onScanFailure
        ).catch(err => {
            alert("Could not start QR scanner. Ensure camera permissions are granted. " + err);
            scannerModal.classList.add('hidden');
        });
    });

    btnCloseScanner.addEventListener('click', () => html5QrCode.stop().then(() => scannerModal.classList.add('hidden')));

    // --- QUEUE LOGIC ---
    let donationQueue = [];
    const entryForm = document.getElementById('entry-form');
    const btnRecordAll = document.getElementById('btn-record-all');
    const emptyLogMsg = document.getElementById('empty-log-msg');
    
    // 1. Add to Log (Local)
    if (entryForm) {
        entryForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const donorType = document.querySelector('input[name="donor_type"]:checked').value;
            const userId = document.getElementById('inp-user-id').value; // Hidden input
            const userName = document.getElementById('inp-user-name').value; // Readonly name input
            const donorName = document.getElementById('inp-donor-name').value;
            const bookTitle = document.getElementById('inp-book-title').value;
            const category = document.getElementById('inp-category').value;
            const quantity = document.getElementById('inp-quantity').value;

            // Validation
            if (!bookTitle) {
                alert("Please enter a book title.");
                return;
            }

            // Create Item Object
            const item = {
                user_id: (donorType === 'registered' && userId) ? userId : null,
                donor_name: (donorType === 'walkin' && donorName) ? donorName : null,
                donor_display: (donorType === 'registered') ? (userName || `ID: ${userId}`) : (donorName || 'Guest'),
                book_title: bookTitle,
                category: category,
                quantity: parseInt(quantity)
            };

            // Add to Queue
            donationQueue.push(item);
            updateLogUI();

            // Clear Book Fields (Keep Donor Info)
            document.getElementById('inp-book-title').value = '';
            document.getElementById('inp-quantity').value = '1';
            document.getElementById('inp-book-title').focus();
        });
    }

    // 2. Update UI Function
    function updateLogUI() {
        // Update Count
        sessionCount.textContent = donationQueue.length;

        // Toggle Empty Message
        if (donationQueue.length > 0) {
            if (emptyLogMsg) emptyLogMsg.classList.add('hidden');
            btnRecordAll.disabled = false;
        } else {
            if (emptyLogMsg) emptyLogMsg.classList.remove('hidden');
            btnRecordAll.disabled = true;
        }

        // Render List (Re-render last item or all? Let's prepend the newest)
        // To keep it simple and correct, let's clear and re-render or just prepend the last one.
        // Prepending the last added item is more efficient.
        const latestItem = donationQueue[donationQueue.length - 1];
        
        const logItem = document.createElement('li');
        logItem.className = "border-b border-[#D6A84A]/20 pb-2 mb-2 last:border-0 last:mb-0 animate-book-entry";
        logItem.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="font-bold text-[#183B5B] leading-tight text-sm">${latestItem.book_title}</div>
                <div class="text-xs font-bold bg-slate-100 px-1.5 rounded text-slate-600">x${latestItem.quantity}</div>
            </div>
            <div class="flex justify-between items-center mt-1">
                <span class="text-slate-500 text-[10px] font-normal">${latestItem.category}</span>
                <span class="text-[10px] text-slate-400 italic">From: ${latestItem.donor_display}</span>
            </div>
        `;
        
        // Insert after the empty message (which is hidden)
        sessionLog.insertBefore(logItem, sessionLog.firstChild.nextSibling);
    }

    // 3. Record All (Server Submit)
    if (btnRecordAll) {
        btnRecordAll.addEventListener('click', async () => {
            if (donationQueue.length === 0) return;

            const originalText = btnRecordAll.innerText;
            btnRecordAll.innerText = "Processing...";
            btnRecordAll.disabled = true;

            let successCount = 0;
            let failCount = 0;

            try {
                // Loop through queue and submit individually
                // (Ideally backend supports batch, but loop works for now)
                for (const item of donationQueue) {
                    const adminId = localStorage.getItem('adminId');
                    const response = await fetch('http://localhost:3000/api/donations/inbound', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                        body: JSON.stringify({
                            user_id: item.user_id,
                            donor_name: item.donor_name,
                            book_title: item.book_title,
                            category: item.category,
                            quantity: item.quantity,
                            adminId: adminId
                        })
                    });
                    
                    const result = await response.json();
                    if (result.success) successCount++;
                    else failCount++;
                }

                if (failCount === 0) {
                    alert(`Success! Recorded ${successCount} donations.`);
                    
                    // Reset Everything
                    donationQueue = [];
                    sessionLog.innerHTML = '<li id="empty-log-msg" class="italic text-slate-400 text-center mt-4">Log is empty...</li>';
                    sessionCount.textContent = '0';
                    btnRecordAll.disabled = true;
                    
                    // Reset Form
                    entryForm.reset();
                    toggleDonorInput();
                    document.getElementById('inp-user-name').value = '';
                } else {
                    alert(`Completed with issues.\nSuccess: ${successCount}\nFailed: ${failCount}`);
                    // In a real app, we'd keep failed items in the list. 
                    // For now, we clear to prevent duplicates on retry.
                    donationQueue = []; 
                    sessionLog.innerHTML = '<li id="empty-log-msg" class="italic text-slate-400 text-center mt-4">Log is empty...</li>';
                    sessionCount.textContent = '0';
                    btnRecordAll.disabled = true;
                }

            } catch (error) {
                console.error("Batch submission error:", error);
                alert("Network Error: " + error.message);
            } finally {
                btnRecordAll.innerText = originalText;
                if (donationQueue.length > 0) btnRecordAll.disabled = false;
                    }
        });
    }
});