export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  try {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Intl.DateTimeFormat('fr-FR', options).format(date);
  } catch (error) {
    console.error(`could not parse date "${dateString}":`, error);
    return "";
  }
};

export function formatDateToInput(date: string): string {
  if (!date) return '';
  const [day, month, year] = date.split('/');
  if (!day || !month || !year) return '';
  return `${year}-${month}-${day}`;
}
