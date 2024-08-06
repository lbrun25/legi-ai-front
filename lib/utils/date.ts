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
