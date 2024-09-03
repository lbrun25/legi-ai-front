export function generateFormattedRandomNumber(min: number, max: number): string {
    const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
    return randomNumber.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
