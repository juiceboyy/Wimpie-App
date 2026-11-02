export function switchTab(tab) {
    ['presence', 'reports', 'performances', 'export'].forEach(t => {
        document.getElementById(`view-${t}`).classList.add('hidden');
        document.getElementById(`tab-${t}`).classList.remove('bg-white', 'shadow-sm', 'text-slate-800');
        document.getElementById(`tab-${t}`).classList.add('text-slate-500');
    });
    document.getElementById(`view-${tab}`).classList.remove('hidden');
    document.getElementById(`tab-${tab}`).classList.add('bg-white', 'shadow-sm', 'text-slate-800');
    document.getElementById(`tab-${tab}`).classList.remove('text-slate-500');
}

export function renderParticipants(data, presenceState) {
    const container = document.getElementById('participantsList');
    container.innerHTML = '';
    
    data.forEach((p, index) => {
        const isActive = presenceState[index];
        const activeClass = isActive ? 'ring-2 ring-blue-500' : '';
        const btnColor = isActive ? 'bg-blue-500' : 'bg-slate-200';

        const html = `
        <div class="ios-card p-4 flex items-center justify-between transition-all cursor-pointer ${activeClass}" id="card-${index}" onclick="togglePresence(${index})">
            <div>
                <div class="font-bold text-slate-800">${p.naam}</div>
                <div class="text-xs text-slate-500">${p.organisatie}</div>
            </div>
            <div class="flex items-center gap-3">
                <select id="dagdelen-${index}" onclick="event.stopPropagation()" class="bg-slate-100 rounded text-sm p-2 outline-none">
                    <option value="2">2 Dagdelen</option>
                    <option value="1">1 Dagdeel</option>
                </select>
                <div id="btn-${index}" 
                    class="w-10 h-10 rounded-full ${btnColor} flex items-center justify-center transition-colors">
                    <i data-lucide="check" class="w-5 h-5 text-white"></i>
                </div>
            </div>
        </div>`;
        container.innerHTML += html;
    });
    
    if (window.lucide) window.lucide.createIcons();
}

export function updatePresenceVisuals(index, isPresent) {
    const btn = document.getElementById(`btn-${index}`);
    const card = document.getElementById(`card-${index}`);

    if (!isPresent) {
        btn.classList.remove('bg-blue-500');
        btn.classList.add('bg-slate-200');
        card.classList.remove('ring-2', 'ring-blue-500');
    } else {
        btn.classList.remove('bg-slate-200');
        btn.classList.add('bg-blue-500');
        card.classList.add('ring-2', 'ring-blue-500');
    }
}

export function fillSelect(data) {
    const select = document.getElementById('reportParticipant');
    select.innerHTML = '<option>Selecteer...</option>';
    data.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.naam;
        opt.innerText = p.naam;
        select.appendChild(opt);
    });
}

export function renderHistoryList(datums, onSelectCallback) {
    const list = document.getElementById('historyList');
    list.innerHTML = '';

    if (datums.length === 0) {
        list.className = "flex flex-wrap gap-2";
        list.innerHTML = '<span class="text-xs text-slate-400">Nog geen verslagen.</span>';
        return;
    }

    if (datums.length <= 10) {
        list.className = "flex flex-wrap gap-2";
        datums.forEach(d => {
            const delen = d.split('-');
            const nlDatum = `${delen[2]}-${delen[1]}`;

            const badge = document.createElement('button');
            badge.className = "px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded-full text-xs font-medium text-slate-700 transition-colors";
            badge.innerText = nlDatum;
            badge.onclick = () => onSelectCallback(d);
            list.appendChild(badge);
        });
        return;
    }

    list.className = "space-y-4 w-full";

    const monthNames = {
        '01': 'Januari', '02': 'Februari', '03': 'Maart', '04': 'April',
        '05': 'Mei', '06': 'Juni', '07': 'Juli', '08': 'Augustus',
        '09': 'September', '10': 'Oktober', '11': 'November', '12': 'December'
    };

    const years = {};
    const yearKeys = [];

    datums.forEach(d => {
        const [year, month] = d.split('-');
        if (!years[year]) {
            years[year] = { months: {}, monthKeys: [] };
            yearKeys.push(year);
        }
        if (!years[year].months[month]) {
            years[year].months[month] = [];
            years[year].monthKeys.push(month);
        }
        years[year].months[month].push(d);
    });

    const totalUniqueMonths = yearKeys.reduce((acc, y) => acc + years[y].monthKeys.length, 0);
    const useYearHierarchy = yearKeys.length > 1 || totalUniqueMonths > 6;

    const createBadge = (d) => {
        const delen = d.split('-');
        const nlDatum = `${delen[2]}-${delen[1]}`;
        const badge = document.createElement('button');
        badge.className = "px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded-full text-xs font-medium text-slate-700 transition-colors";
        badge.innerText = nlDatum;
        badge.onclick = () => onSelectCallback(d);
        return badge;
    };

    const attachToggle = (header, targetContainer, iconSelector) => {
        header.onclick = () => {
            const isHidden = targetContainer.classList.toggle('hidden');
            const icon = header.querySelector(iconSelector);
            if (icon) {
                icon.classList.toggle('rotate-90', !isHidden);
            }
        };
    };

    if (useYearHierarchy) {
        yearKeys.forEach(year => {
            const yearSection = document.createElement('div');
            yearSection.className = "space-y-2";

            const yearHeader = document.createElement('div');
            yearHeader.className = "flex items-center gap-1.5 cursor-pointer select-none text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors mt-1 py-1 w-fit";
            yearHeader.innerHTML = `
                <i data-lucide="chevron-right" class="w-3.5 h-3.5 transition-transform duration-200"></i>
                <span class="tracking-wider uppercase">${year}</span>
            `;

            const monthsContainer = document.createElement('div');
            monthsContainer.className = "space-y-3 pl-3 border-l-2 border-slate-100 hidden";
            attachToggle(yearHeader, monthsContainer, '[data-lucide="chevron-right"]');

            years[year].monthKeys.forEach(month => {
                const monthSection = document.createElement('div');
                monthSection.className = "space-y-1.5";

                const monthName = monthNames[month] || month;
                const monthHeader = document.createElement('div');
                monthHeader.className = "flex items-center gap-1.5 cursor-pointer select-none text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors py-0.5 w-fit";
                monthHeader.innerHTML = `
                    <i data-lucide="chevron-right" class="w-3 h-3 transition-transform duration-200"></i>
                    <span class="tracking-wider uppercase">${monthName}</span>
                `;

                const badgesContainer = document.createElement('div');
                badgesContainer.className = "flex flex-wrap gap-2 pl-4 hidden";
                attachToggle(monthHeader, badgesContainer, '[data-lucide="chevron-right"]');

                years[year].months[month].forEach(d => badgesContainer.appendChild(createBadge(d)));

                monthSection.appendChild(monthHeader);
                monthSection.appendChild(badgesContainer);
                monthsContainer.appendChild(monthSection);
            });

            yearSection.appendChild(yearHeader);
            yearSection.appendChild(monthsContainer);
            list.appendChild(yearSection);
        });
    } else {
        const year = yearKeys[0];
        years[year].monthKeys.forEach(month => {
            const section = document.createElement('div');
            section.className = "space-y-2";

            const monthName = monthNames[month] || month;
            const header = document.createElement('div');
            header.className = "flex items-center gap-1.5 cursor-pointer select-none text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors mt-1 py-1 w-fit";
            header.innerHTML = `
                <i data-lucide="chevron-right" class="w-3.5 h-3.5 transition-transform duration-200"></i>
                <span class="tracking-wider uppercase">${monthName} ${year}</span>
            `;

            const badgesContainer = document.createElement('div');
            badgesContainer.className = "flex flex-wrap gap-2 hidden";
            attachToggle(header, badgesContainer, '[data-lucide="chevron-right"]');

            years[year].months[month].forEach(d => badgesContainer.appendChild(createBadge(d)));

            section.appendChild(header);
            section.appendChild(badgesContainer);
            list.appendChild(section);
        });
    }

    if (window.lucide) window.lucide.createIcons();
}

export function updateReportView(text, placeholder, isLoading) {
    const textarea = document.getElementById('reportText');
    const loader = document.getElementById('reportLoading');

    if (isLoading) {
        textarea.value = "";
        textarea.placeholder = placeholder || "Laden...";
        textarea.disabled = true;
        loader.classList.remove('hidden');
    } else {
        textarea.value = text || "";
        textarea.placeholder = placeholder || "Typ hier je verslag...";
        textarea.disabled = false;
        loader.classList.add('hidden');
        textarea.focus();
    }
}

export function setupDynamicUI() {
    // Taak 2 & 3: Verberg bestaande AMSTA Excel knop en voeg AMSTA PDF knop toe
    const amstaExcelBtn = document.querySelector('button[onclick="downloadExport(\'amsta\')"]');
    if (amstaExcelBtn) {
        amstaExcelBtn.style.display = 'none'; // Verberg de oude
        
        // Maak de nieuwe AMSTA factuur knop
        const newAmstaPdfBtn = document.createElement('button');
        // Uniform Design Systeem: Paars
        newAmstaPdfBtn.className = 'flex items-center justify-start text-left p-4 w-full border-2 rounded-lg transition-all bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 font-semibold';
        newAmstaPdfBtn.innerHTML = '<i data-lucide="file-text" class="w-5 h-5 mr-3"></i> Genereer AMSTA Factuur (PDF)';
        newAmstaPdfBtn.onclick = () => window.downloadExport('amsta-factuur');
        
        amstaExcelBtn.parentNode.insertBefore(newAmstaPdfBtn, amstaExcelBtn.nextSibling);
    }

    // 1. Cordaan (Oranje)
    const cordaanBtn = document.querySelector('button[onclick="downloadExport(\'cordaan\')"]');
    if (cordaanBtn) {
        cordaanBtn.className = 'flex items-center justify-start text-left p-4 w-full border-2 rounded-lg transition-all bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 font-semibold';
        cordaanBtn.innerHTML = '<i data-lucide="file-spreadsheet" class="w-5 h-5 mr-3"></i> Genereer Cordaan Urendeclaratie (Excel)';
    }

    // 2. Thomashuis (Geel/Goud)
    const thomashuisBtn = document.querySelector('button[onclick="downloadExport(\'thomashuis\')"]');
    if (thomashuisBtn) {
        thomashuisBtn.className = 'flex items-center justify-start text-left p-4 w-full border-2 rounded-lg transition-all bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100 font-semibold';
        thomashuisBtn.innerHTML = '<i data-lucide="file-text" class="w-5 h-5 mr-3"></i> Genereer Thomashuis Factuur (PDF)';
    }

    // 3. Aanmaningen (Rood)
    const aanmaningBtn = document.getElementById('btn-controleer-aanmaningen');
    if (aanmaningBtn) {
        aanmaningBtn.className = 'flex items-center justify-start text-left p-4 w-full border-2 rounded-lg transition-all bg-red-50 border-red-200 text-red-700 hover:bg-red-100 font-semibold';
        aanmaningBtn.innerHTML = '<i data-lucide="bell-ring" class="w-5 h-5 mr-3"></i> Controleer aanmaningen';
    }

    // 4. Oefenruimte (Blauw/Grijs - Slate)
    const expenseBtn = document.getElementById('btn-calc-expenses');
    if (expenseBtn) {
        expenseBtn.className = 'flex items-center justify-start text-left p-4 w-full border-2 rounded-lg transition-all bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold';
        expenseBtn.innerHTML = '<i data-lucide="calculator" class="w-5 h-5 mr-3"></i> Bereken Huur Oefenruimte';
    }
    
    // 4. Aanwezigheid Opslaan (Blauw)
    const saveAttendanceBtn = document.getElementById('btn-save-attendance');
    if (saveAttendanceBtn) {
        saveAttendanceBtn.className = 'flex items-center justify-center p-4 w-full border-2 rounded-lg transition-all bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 font-semibold';
        saveAttendanceBtn.innerHTML = '<i data-lucide="save" class="w-5 h-5 mr-3"></i> Opslaan';
    }

    // 5. Verslag Versturen (Groen)
    const saveReportBtn = document.getElementById('btn-save-report');
    if (saveReportBtn) {
        saveReportBtn.className = 'flex items-center justify-center p-4 w-full border-2 rounded-lg transition-all bg-green-50 border-green-200 text-green-700 hover:bg-green-100 font-semibold';
        saveReportBtn.innerHTML = '<i data-lucide="send" class="w-5 h-5 mr-3"></i> Verslag Versturen';
    }

    // 6. AI Verbetering (Paars)
    const aiBtn = document.getElementById('btn-ai-improve');
    if (aiBtn) {
        aiBtn.className = 'mt-3 flex items-center justify-center p-3 w-full border-2 rounded-lg transition-all bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed';
        aiBtn.innerHTML = '<i data-lucide="sparkles" class="w-4 h-4 mr-2"></i> AI Verbetering';
    }

    // 7. Optredens Opslaan (Indigo)
    const savePerformancesBtn = document.getElementById('btn-save-performances');
    if (savePerformancesBtn) {
        savePerformancesBtn.className = 'flex items-center justify-center p-4 w-full border-2 rounded-lg transition-all bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-semibold';
        savePerformancesBtn.innerHTML = '<i data-lucide="save" class="w-5 h-5 mr-3"></i> Opslaan';
    }

    // 8. Jaarverslag Exporteren (Violet)
    const annualReportBtn = document.getElementById('btn-generate-annual-report');
    if (annualReportBtn) {
        annualReportBtn.className = 'flex items-center justify-center p-4 w-full border-2 rounded-lg transition-all bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100 font-semibold';
        annualReportBtn.innerHTML = '<i data-lucide="file-text" class="w-5 h-5 mr-3"></i> Genereer Jaarverslag (Word .doc)';
    }

    if (window.lucide) window.lucide.createIcons();
}

export function setButtonState(btnId, state, options = {}) {
    const btn = typeof btnId === 'string' ? document.getElementById(btnId) : btnId;
    if (!btn) return;

    const { text, icon, disabled, iconSize = "w-5 h-5", spacing = "mr-3" } = options;

    if (disabled !== undefined) {
        btn.disabled = disabled;
    }

    if (state === 'loading') {
        btn.innerHTML = `<span class="animate-spin ${spacing}">⏳</span> ${text || 'Laden...'}`;
    } else if (state === 'success') {
        btn.innerHTML = `<i data-lucide="check" class="${iconSize} ${spacing}"></i> ${text || 'Succes'}`;
    } else if (state === 'error') {
        btn.innerHTML = `<i data-lucide="alert-circle" class="${iconSize} ${spacing}"></i> ${text || 'Fout'}`;
    } else {
        if (icon) {
            btn.innerHTML = `<i data-lucide="${icon}" class="${iconSize} ${spacing}"></i> ${text}`;
        } else {
            btn.innerHTML = text;
        }
    }

    if (window.lucide) window.lucide.createIcons();
}