function add12Hours(dateString) {
  // Parse the input date string
  const parts = dateString.split(/\s+/);
  const monthName = parts[0];
  const day = parseInt(parts[1]);
  const year = parseInt(parts[2]);
  const timeString = parts[3];
  const timezone = parts[4];
  
  // Parse time components
  const timeParts = timeString.split(':');
  let hour = parseInt(timeParts[0]);
  const minute = parseInt(timeParts[1].replace(/[apm]/g, ''));
  const ampm = timeParts[1].includes('pm') ? 'pm' : 'am';
  
  // Convert to 24-hour format
  if (ampm === 'pm' && hour !== 12) {
    hour += 12;
  } else if (ampm === 'am' && hour === 12) {
    hour = 0;
  }
  
  // Create a Date object (JavaScript will handle timezone internally)
  // We'll create it as if it's in the local timezone for calculation purposes
  const date = new Date(year, getMonthIndex(monthName), day, hour, minute);
  
  // Add 12 hours
  date.setHours(date.getHours() + 12);
  
  // Format the result back to the required format
  const resultMonth = getMonthName(date.getMonth());
  const resultDay = date.getDate();
  const resultYear = date.getFullYear();
  
  // Convert back to 12-hour format with am/pm
  let resultHour = date.getHours();
  let resultAmpm = 'am';
  
  if (resultHour === 0) {
    resultHour = 12;
  } else if (resultHour === 12) {
    resultAmpm = 'pm';
  } else if (resultHour > 12) {
    resultHour -= 12;
    resultAmpm = 'pm';
  }
  
  const resultMinute = date.getMinutes().toString().padStart(2, '0');
  
  return `${resultMonth} ${resultDay} ${resultYear} ${resultHour}:${resultMinute}${resultAmpm} ${timezone}`;
}

function getMonthIndex(monthName) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months.indexOf(monthName);
}

function getMonthName(monthIndex) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[monthIndex];
}
