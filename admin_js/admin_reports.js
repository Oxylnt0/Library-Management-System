(() => {
    let currentData = [];
    let currentReportTitle = "";
    let currentReportId = "";
    let currentColumns = [];

    const reportConfig = {
        circulation: [
            { id: 'active_loans', label: 'Active Loans', title: 'Active Loans Report' },
            { id: 'overdue', label: 'Overdue & Delinquency', title: 'Overdue & Delinquency Report (Due < Today)' },
            { id: 'top_borrowed', label: 'Top Borrowed Materials', title: 'Top Borrowed Analytics' }
        ],
        inventory: [
            { id: 'inventory_summary', label: 'Master Inventory', title: 'Master Inventory Summary' },
            { id: 'weeding', label: 'Weeding Report', title: 'Weeding Report (Outdated/Obsolete)' },
            { id: 'donations', label: 'Donation Ledger', title: 'Donation Ledger (Inbound/Outbound)' }
        ],
        financials: [
            { id: 'revenue_collection', label: 'Revenue Collection', title: 'Revenue Collection Report' },
            { id: 'revenue_daily', label: 'Daily Revenue (Grouped)', title: 'Total Revenue Collection Grouped by Date' },
            { id: 'outstanding', label: 'Outstanding Balances', title: 'Outstanding Balances Report' }
        ],
        users: [
            { id: 'registration_queue', label: 'Registration Queue', title: 'Registration Approval Queue' },
            { id: 'disciplinary', label: 'Disciplinary History', title: 'Disciplinary & Ban History' }
        ],
        audits: [
            { id: 'audit_all', label: 'All Audits', title: 'System-Wide Audit Log' },
            { id: 'audit_admin', label: 'Admin Audits', title: 'Administrator Actions Log' },
            { id: 'audit_user', label: 'User Audits', title: 'User Activity Log' },
            { id: 'audit_guardian', label: 'Guardian Audits', title: 'Guardian Activity Log' }
        ]
    };

    function switchTab(tabId) {
        // Update Tab UI
        const allTabs = document.querySelectorAll('button[id^="tab-"]');
        if (allTabs) {
            allTabs.forEach(btn => {
                if (btn && btn.classList) {
                    btn.classList.remove('text-[#183B5B]', 'border-[#183B5B]', 'font-bold');
                    btn.classList.add('text-slate-500', 'border-transparent', 'font-medium');
                }
            });
        }
        
        const activeBtn = document.getElementById(`tab-${tabId}`);
        if (activeBtn && activeBtn.classList) {
            activeBtn.classList.add('text-[#183B5B]', 'border-[#183B5B]', 'font-bold');
            activeBtn.classList.remove('text-slate-500', 'border-transparent', 'font-medium');
        }

        // Load Summary Cards
        loadDomainStats(tabId);

        // Render Sub-Report Chips
        const selector = document.getElementById('report-selector');
        if (!selector) return; // Prevent errors if DOM is not fully ready
        selector.innerHTML = '';
        
        const reports = reportConfig[tabId] || [];
        reports.forEach((rep, index) => {
            const btn = document.createElement('button');
            btn.className = `px-4 py-2 rounded-full text-xs font-bold border transition-colors ${index === 0 ? 'bg-[#183B5B] text-[#D6A84A] border-[#183B5B]' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}`;
            btn.innerText = rep.label;
            btn.onclick = () => {
                // Reset other chips
                if (selector && selector.children) {
                    Array.from(selector.children).forEach(c => {
                        if (c) c.className = 'px-4 py-2 rounded-full text-xs font-bold border transition-colors bg-white text-slate-600 border-slate-300 hover:bg-slate-100';
                    });
                }
                // Highlight this one
                btn.className = 'px-4 py-2 rounded-full text-xs font-bold border transition-colors bg-[#183B5B] text-[#D6A84A] border-[#183B5B]';
                currentReportId = rep.id;
                loadReportData(rep.id, rep.title);
            };
            selector.appendChild(btn);
        });

        // Load first report of the tab automatically
        if (reports.length > 0) {
            loadReportData(reports[0].id, reports[0].title);
        }
    }

    async function loadDomainStats(domain) {
        const container = document.getElementById('summary-cards');
        if (!container) return;
        container.innerHTML = '<div class="col-span-full text-center text-slate-400 text-xs">Loading stats...</div>';

        try {
            const response = await fetch(`http://localhost:3000/api/reports/stats?domain=${domain}`);
            const result = await response.json();

            if (result.success) {
                container.innerHTML = '';
                result.stats.forEach(stat => {
                    const card = `
                        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <p class="text-xs text-slate-500 uppercase font-bold">${stat.label}</p>
                            <h3 class="text-2xl font-bold text-${stat.color}-600 mt-1">${stat.value}</h3>
                        </div>
                    `;
                    container.insertAdjacentHTML('beforeend', card);
                });
            }
        } catch (e) {
            console.error("Stats Error:", e);
        }
    }

    async function loadReportData(reportId, title) {
        const tbody = document.getElementById('table-body');
        const thead = document.getElementById('table-header');
        const titleEl = document.getElementById('table-title');
        const countEl = document.getElementById('record-count');
        
        if (!tbody || !thead || !titleEl || !countEl) return;

        titleEl.innerText = title;
        currentReportTitle = title;
        tbody.innerHTML = '<tr><td colspan="10" class="p-4 text-center text-slate-500">Loading data...</td></tr>';
        countEl.innerText = '';

        const startDate = document.getElementById('date-start').value;
        const endDate = document.getElementById('date-end').value;

        try {
            let url = `http://localhost:3000/api/reports/view?type=${reportId}`;
            if (reportId.startsWith('audit_')) {
                const filter = reportId.replace('audit_', '');
                url = `http://localhost:3000/api/admin/audit-logs?filter=${filter}`; // Reuse existing audit endpoint
            } else {
                url += `&startDate=${startDate}&endDate=${endDate}`;
            }

            const response = await fetch(url);
            const result = await response.json();

            if (result.success) {
                currentData = result.data;
                renderTable(currentData);
            } else {
                tbody.innerHTML = `<tr><td colspan="10" class="p-4 text-center text-red-500">Error: ${result.message}</td></tr>`;
            }
        } catch (error) {
            console.error("Report Error:", error);
            tbody.innerHTML = '<tr><td colspan="10" class="p-4 text-center text-red-500">Network Error</td></tr>';
        }
    }

    function renderTable(data) {
        const tbody = document.getElementById('table-body');
        const thead = document.getElementById('table-header');
        const countEl = document.getElementById('record-count');

        tbody.innerHTML = '';
        thead.innerHTML = '';
        
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="p-4 text-center text-slate-400 italic">No records found for this period.</td></tr>';
            countEl.innerText = '0 records';
            return;
        }

        countEl.innerText = `${data.length} records`;

        // Dynamic Columns based on first row keys
        const columns = Object.keys(data[0]);
        currentColumns = columns;

        // Render Header
        columns.forEach(col => {
            const th = document.createElement('th');
            th.className = "px-4 py-3 border-b";
            // Format header: "fine_amount" -> "Fine Amount"
            th.innerText = col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            thead.appendChild(th);
        });

        // Render Body
        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 transition-colors";
            
            columns.forEach(col => {
                const td = document.createElement('td');
                td.className = "px-4 py-3 border-b";
                let val = row[col];
                
                // Simple formatting
                if (col === 'date_time') {
                    try { val = new Date(val).toLocaleString(); } catch(e){}
                } else if (col.includes('date') || col.endsWith('_at')) {
                    try { val = new Date(val).toLocaleDateString(); } catch(e){}
                }
                if (col.includes('amount') || col.includes('price') || col.includes('revenue')) {
                    val = `₱${parseFloat(val).toFixed(2)}`;
                }

                td.innerText = val !== null ? val : '-';
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async function exportData(format) {
        if (currentData.length === 0) {
            alert("No data to export.");
            return;
        }

        if (format === 'pdf') {
            const btn = document.getElementById('btn-export-pdf');
            const origText = btn ? btn.innerHTML : 'PDF';
            if (btn) { btn.innerHTML = 'Generating...'; btn.disabled = true; }

            try {
                if (!window.jspdf) {
                    await loadScript("https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js");
                }
                if (!window.jspdf.jsPDF.API.autoTable) {
                    await loadScript("https://unpkg.com/jspdf-autotable@3.5.31/dist/jspdf.plugin.autotable.min.js");
                }

                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                const dateStr = new Date().toLocaleDateString();

                doc.setFontSize(18);
                doc.text(currentReportTitle, 14, 20);
                doc.setFontSize(10);
                doc.text(`Generated on: ${dateStr}`, 14, 28);
                
                const headers = currentColumns.map(c => c.replace(/_/g, ' ').toUpperCase());
                const rows = currentData.map(row => currentColumns.map(col => row[col]));

                doc.autoTable({ 
                    startY: 35,
                    head: [headers],
                    body: rows,
                    theme: 'grid',
                    headStyles: { fillColor: [24, 59, 91] }
                });

                doc.save(`${currentReportTitle.replace(/\s+/g, '_')}.pdf`);
            } catch (err) {
                console.error("PDF Generation Error:", err);
                alert("Failed to generate PDF. Please check your internet connection and try again.");
            } finally {
                if (btn) { btn.innerHTML = origText; btn.disabled = false; }
            }
        } else {
            // CSV
            const headers = currentColumns.join(",");
            const rows = currentData.map(row => 
                currentColumns.map(col => `"${String(row[col] || '').replace(/"/g, '""')}"`).join(",")
            );
            const csvContent = [headers, ...rows].join("\n");
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `${currentReportTitle.replace(/\s+/g, '_')}.csv`;
            link.click();
        }
    }

    function initReports() {
        console.log("🚀 Initializing Reports Module...");
        // Set default dates (First day of month to Today)
        const date = new Date();
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        
        const startEl = document.getElementById('date-start');
        const endEl = document.getElementById('date-end');
        
        if (startEl && endEl) {
            startEl.valueAsDate = firstDay;
            endEl.valueAsDate = date;
            
            // Auto-reload report when date is changed
            const reloadCurrent = () => {
                if (currentReportId) loadReportData(currentReportId, currentReportTitle);
            };
            startEl.addEventListener('change', reloadCurrent);
            endEl.addEventListener('change', reloadCurrent);
        }

        // Load default tab
        switchTab('circulation');
    }

    window.switchTab = switchTab;
    window.exportData = exportData;
    window.initReports = initReports;

    // Initialize immediately as the script is loaded dynamically after HTML injection
    initReports();
})();
