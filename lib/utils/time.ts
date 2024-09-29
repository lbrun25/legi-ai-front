// Function to format the time in "1h04" or "13 min" format
export const formatTimeSaved = (timeSavedInSeconds: number) => {
  const hours = Math.floor(timeSavedInSeconds / 3600);
  const minutes = Math.floor((timeSavedInSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h${minutes.toString().padStart(2, '0')}`;  // e.g., "1h04"
  } else {
    return `${minutes} min`;  // e.g., "13 min"
  }
};
