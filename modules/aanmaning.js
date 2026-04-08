import { fetchAanmaningen, postStuurAanmaning } from './api.js';
import { setButtonState } from './ui.js';
import { runSafe } from './utils.js';

export async function controleerAanmaningen() {
    const btn = document.getElementById('btn-controleer-aanmaningen');
    setButtonState(btn, 'loading', { text: 'Facturen controleren...', disabled: true });

    const aanmaningen = await runSafe(
        () => fetchAanmaningen(),
        () => setButtonState(btn, 'error', { text: 'Fout bij ophalen', disabled: false })
    );

    if (aanmaningen === null || aanmaningen === undefined) return;

    setButtonState(btn, 'default', { text: 'Controleer aanmaningen', icon: 'bell-ring', disabled: false });
    renderAanmaningBlock(aanmaningen);
}

function renderAanmaningBlock(lijst) {
    let container = document.getElementById('aanmaningContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'aanmaningContainer';
        document.getElementById('view-export').appendChild(container);
    }

    if (lijst.length === 0) {
        container.innerHTML = `
            <div class="ios-card p-6">
                <div class="flex items-center gap-3 p-4 bg-green-50 border-2 border-green-200 rounded-lg text-green-700 font-medium">
                    <i data-lucide="check-circle" class="w-5 h-5"></i>
                    Geen openstaande facturen — alles is op tijd betaald.
                </div>
            </div>`;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    const kaartjes = lijst.map(f => {
        const kleurKlasse = f.dagenTeLaat >= 30
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-orange-50 border-orange-200 text-orange-800';
        const badgeKlasse = f.dagenTeLaat >= 30
            ? 'bg-red-100 text-red-700'
            : 'bg-orange-100 text-orange-700';
        const btnId = `btn-aanmaning-${f.factuurnummer.replace('.', '-')}`;

        const verzendKnop = f.heeftEmail
            ? `<button id="${btnId}" class="flex items-center px-4 py-2 border-2 rounded-lg text-sm font-semibold bg-white border-slate-200 text-slate-700 hover:bg-slate-50 transition-all" onclick="window._stuurAanmaning('${btnId}', ${JSON.stringify(f).replace(/'/g, "\\'")})" >
                   <i data-lucide="send" class="w-4 h-4 mr-2"></i> Verstuur aanmaning
               </button>`
            : `<p class="text-xs text-slate-500 italic">Geen e-mailadres beschikbaar — stuur handmatig een aanmaning.</p>`;

        return `
            <div class="ios-card p-5 border-2 ${kleurKlasse}">
                <div class="flex items-start justify-between gap-4">
                    <div class="space-y-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-bold text-base">${f.factuurnummer}</span>
                            <span class="text-sm font-medium">${f.klant_naam}</span>
                            <span class="px-2 py-0.5 rounded-full text-xs font-bold ${badgeKlasse}">${f.dagenTeLaat} dagen te laat</span>
                        </div>
                        <div class="text-sm">${f.omschrijving}</div>
                        <div class="text-xs text-slate-500">Factuurdatum: ${f.datumFactuur} &nbsp;·&nbsp; Vervaldatum: ${f.vervalDatumStr} &nbsp;·&nbsp; Bedrag: € ${f.bedrag}</div>
                    </div>
                </div>
                <div class="mt-3">
                    ${verzendKnop}
                </div>
            </div>`;
    }).join('');

    container.innerHTML = `
        <div class="ios-card p-6 space-y-4">
            <h3 class="font-bold text-slate-800">Openstaande facturen (${lijst.length})</h3>
            ${kaartjes}
        </div>`;

    if (window.lucide) window.lucide.createIcons();
}

// Globale helper zodat inline onclick toegang heeft tot de sluitvariabele
window._stuurAanmaning = async function(btnId, factuur) {
    const btn = document.getElementById(btnId);
    setButtonState(btn, 'loading', { text: 'Versturen...', disabled: true, iconSize: 'w-4 h-4', spacing: 'mr-2' });

    const result = await runSafe(
        () => postStuurAanmaning(factuur),
        () => setButtonState(btn, 'error', { text: 'Fout — probeer opnieuw', disabled: false, iconSize: 'w-4 h-4', spacing: 'mr-2' })
    );

    if (result) {
        setButtonState(btn, 'success', { text: 'Aanmaning verstuurd', disabled: true, iconSize: 'w-4 h-4', spacing: 'mr-2' });
    }
};
