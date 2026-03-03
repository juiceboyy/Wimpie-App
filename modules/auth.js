const TOEGANGSCODE = '1055';

export function verifyAccess() {
    const invoer = prompt("Wat is de toegangscode voor Wimpie?");
    if (invoer === TOEGANGSCODE) {
        return true;
    } else {
        document.body.innerHTML = '<div class="flex h-screen items-center justify-center bg-red-50"><div class="text-center p-10"><h1 class="text-2xl font-bold text-red-600 mb-2">Geen Toegang</h1><p class="text-slate-600">Herlaad de pagina.</p></div></div>';
        return false;
    }
}