// Helper voor maandnamen
const monthNames = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
export function getDisplayMonth(monthStr) {
    const mIndex = parseInt(monthStr, 10) - 1;
    return (mIndex >= 0 && mIndex < 12) ? monthNames[mIndex] : monthStr;
}