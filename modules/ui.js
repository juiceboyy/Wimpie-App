export function switchTab(tab) {
    ['presence', 'reports', 'export'].forEach(t => {
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
        list.innerHTML = '<span class="text-xs text-slate-400">Nog geen verslagen.</span>';
    } else {
        datums.forEach(d => {
            const delen = d.split('-');
            const nlDatum = `${delen[2]}-${delen[1]}`;

            const badge = document.createElement('button');
            badge.className = "px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded-full text-xs font-medium text-slate-700 transition-colors";
            badge.innerText = nlDatum;
            badge.onclick = () => onSelectCallback(d);
            list.appendChild(badge);
        });
    }
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