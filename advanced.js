/**
 * ChronoMaster Pro - Advanced Date Manipulation Suite
 * Professional JavaScript with modern ES6+ features
 * @version 1.0.0
 * @author ChronoMaster Team
 */

// ==========================================================================
// CONSTANTS & CONFIGURATION
// ==========================================================================

const CONFIG = {
    API_BASE_URL: window.location.origin,
    DATE_FORMAT: 'MMMM d yyyy h:mma',
    SUPPORTED_TIMEZONES: ['EST', 'PST', 'CST', 'MST', 'UTC', 'GMT'],
    MAX_HISTORY_ITEMS: 50,
    ANIMATION_DURATION: 300,
    DEBOUNCE_DELAY: 300
};

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const TIMEZONE_OFFSETS = {
    'EST': -5, 'PST': -8, 'CST': -6, 'MST': -7, 'UTC': 0, 'GMT': 0
};

// ==========================================================================
// STATE MANAGEMENT
// ==========================================================================

class AppState {
    constructor() {
        this.history = JSON.parse(localStorage.getItem('chronoHistory') || '[]');
        this.currentResult = null;
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';
        this.apiStatus = 'disconnected';
    }

    addToHistory(item) {
        this.history.unshift({
            ...item,
            timestamp: new Date().toISOString()
        });
        
        if (this.history.length > CONFIG.MAX_HISTORY_ITEMS) {
            this.history = this.history.slice(0, CONFIG.MAX_HISTORY_ITEMS);
        }
        
        localStorage.setItem('chronoHistory', JSON.stringify(this.history));
    }

    toggleDarkMode() {
        this.isDarkMode = !this.isDarkMode;
        localStorage.setItem('darkMode', this.isDarkMode);
        document.documentElement.setAttribute('data-theme', this.isDarkMode ? 'dark' : 'light');
    }
}

const appState = new AppState();

// ==========================================================================
// DATE MANIPULATION CORE
// ==========================================================================

class DateManipulator {
    /**
     * Parse date string in format "March 6 2009 7:30pm EST"
     */
    static parseDateString(dateString) {
        try {
            const parts = dateString.trim().split(/\s+/);
            if (parts.length < 5) throw new Error('Invalid date format');

            const monthName = parts[0];
            const day = parseInt(parts[1]);
            const year = parseInt(parts[2]);
            const timeString = parts[3];
            const timezone = parts[4];

            // Parse time
            const timeMatch = timeString.match(/(\d{1,2}):(\d{2})(am|pm)/i);
            if (!timeMatch) throw new Error('Invalid time format');

            let [, hour, minute, ampm] = timeMatch;
            hour = parseInt(hour);
            minute = parseInt(minute);

            // Convert to 24-hour format
            if (ampm.toLowerCase() === 'pm' && hour !== 12) {
                hour += 12;
            } else if (ampm.toLowerCase() === 'am' && hour === 12) {
                hour = 0;
            }

            // Validate components
            if (!MONTHS.includes(monthName)) throw new Error('Invalid month');
            if (day < 1 || day > 31) throw new Error('Invalid day');
            if (!CONFIG.SUPPORTED_TIMEZONES.includes(timezone)) throw new Error('Unsupported timezone');

            return {
                year, month: MONTHS.indexOf(monthName), day, hour, minute, timezone,
                originalString: dateString
            };
        } catch (error) {
            throw new Error(`Date parsing failed: ${error.message}`);
        }
    }

    /**
     * Add hours to parsed date
     */
    static addHours(parsedDate, hoursToAdd) {
        const { year, month, day, hour, minute, timezone } = parsedDate;
        
        // Create date object (JavaScript handles date arithmetic including leap years)
        const date = new Date(year, month, day, hour, minute);
        
        // Add hours
        date.setHours(date.getHours() + hoursToAdd);
        
        return {
            original: parsedDate,
            newDate: date,
            hoursAdded: hoursToAdd,
            timezone: timezone
        };
    }

    /**
     * Format date back to string format
     */
    static formatDate(date, timezone) {
        const month = MONTHS[date.getMonth()];
        const day = date.getDate();
        const year = date.getFullYear();
        
        // Convert to 12-hour format
        let hour = date.getHours();
        const minute = date.getMinutes();
        let ampm = 'am';
        
        if (hour === 0) {
            hour = 12;
        } else if (hour === 12) {
            ampm = 'pm';
        } else if (hour > 12) {
            hour -= 12;
            ampm = 'pm';
        }
        
        const minutePadded = minute.toString().padStart(2, '0');
        
        return `${month} ${day} ${year} ${hour}:${minutePadded}${ampm} ${timezone}`;
    }

    /**
     * Convert between timezones
     */
    static convertTimezone(dateString, sourceTz, targetTz) {
        const parsed = this.parseDateString(dateString);
        const sourceOffset = TIMEZONE_OFFSETS[sourceTz];
        const targetOffset = TIMEZONE_OFFSETS[targetTz];
        
        const date = new Date(parsed.year, parsed.month, parsed.day, parsed.hour, parsed.minute);
        const hourDiff = targetOffset - sourceOffset;
        
        date.setHours(date.getHours() + hourDiff);
        
        return this.formatDate(date, targetTz);
    }
}

// ==========================================================================
// API SERVICE
// ==========================================================================

class APIService {
    constructor() {
        this.baseURL = CONFIG.API_BASE_URL;
        this.retryAttempts = 3;
        this.timeout = 10000;
    }

    async calculateDate(dateString, hoursToAdd, timezone) {
        try {
            const response = await this.makeRequest('/api/calculate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    date_string: dateString,
                    hours_to_add: hoursToAdd,
                    timezone: timezone
                })
            });

            return await response.json();
        } catch (error) {
            console.warn('API failed, falling back to client-side calculation:', error);
            return this.fallbackCalculation(dateString, hoursToAdd, timezone);
        }
    }

    async validateDate(dateString) {
        try {
            const response = await this.makeRequest('/api/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ date_string: dateString })
            });

            return await response.json();
        } catch (error) {
            console.warn('API validation failed, falling back to client-side validation:', error);
            return this.fallbackValidation(dateString);
        }
    }

    async makeRequest(endpoint, options) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    fallbackCalculation(dateString, hoursToAdd, timezone) {
        try {
            const parsed = DateManipulator.parseDateString(dateString);
            const result = DateManipulator.addHours(parsed, hoursToAdd);
            const formatted = DateManipulator.formatDate(result.newDate, timezone);
            
            return {
                success: true,
                original_date: dateString,
                new_date: formatted,
                hours_added: hoursToAdd,
                timezone: timezone,
                timestamp: new Date().toISOString(),
                method: 'client-side'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                method: 'client-side'
            };
        }
    }

    fallbackValidation(dateString) {
        try {
            DateManipulator.parseDateString(dateString);
            return {
                success: true,
                valid: true,
                message: 'Date format is valid'
            };
        } catch (error) {
            return {
                success: true,
                valid: false,
                message: error.message
            };
        }
    }
}

const apiService = new APIService();

// ==========================================================================
// UI COMPONENTS
// ==========================================================================

class UIComponents {
    static showLoading(message = 'Processing...') {
        const overlay = document.getElementById('loadingOverlay');
        const spinner = overlay.querySelector('.loading-spinner');
        spinner.innerHTML = `
            <i class="fas fa-clock fa-spin"></i>
            <p>${message}</p>
        `;
        overlay.classList.add('active');
    }

    static hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        overlay.classList.remove('active');
    }

    static showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'}-circle"></i>
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        `;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => notification.classList.add('show'), 100);

        // Auto remove
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);

        // Manual close
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        });
    }

    static updateResults(data) {
        if (!data.success) {
            this.showNotification(data.error, 'error');
            return;
        }

        // Animate results
        const resultCards = document.querySelectorAll('.result-card');
        resultCards.forEach((card, index) => {
            card.style.animation = 'none';
            setTimeout(() => {
                card.style.animation = `slideIn 0.5s ease ${index * 0.1}s both`;
            }, 100);
        });

        // Update content
        document.getElementById('originalDate').textContent = data.original_date;
        document.getElementById('originalTimestamp').textContent = 
            `Parsed: ${new Date().toLocaleString()}`;
        
        document.getElementById('timeAdded').textContent = `${data.hours_added} hours`;
        document.getElementById('timeAddedDetails').textContent = 
            data.hours_added > 0 ? 'Added to original' : 'Subtracted from original';
        
        document.getElementById('newDate').textContent = data.new_date;
        document.getElementById('newTimestamp').textContent = 
            `Calculated: ${new Date(data.timestamp).toLocaleString()}`;

        // Update validation status
        this.updateValidationStatus(true, 'Calculation successful');
    }

    static updateValidationStatus(success, message) {
        const status = document.getElementById('validationStatus');
        status.className = `status-indicator ${success ? 'success' : 'error'}`;
        status.innerHTML = `
            <i class="fas fa-${success ? 'check' : 'exclamation'}-circle"></i>
            <span>${message}</span>
        `;
    }

    static addToHistory(item) {
        const historyContainer = document.getElementById('dateHistory');
        const emptyMessage = historyContainer.querySelector('.empty-history');
        
        if (emptyMessage) {
            emptyMessage.remove();
        }

        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${item.original_date}</strong>
                    <div style="font-size: 0.75rem; opacity: 0.8;">
                        +${item.hours_added}h → ${item.new_date}
                    </div>
                </div>
                <div style="font-size: 0.75rem; opacity: 0.6;">
                    ${new Date(item.timestamp).toLocaleTimeString()}
                </div>
            </div>
        `;

        historyItem.addEventListener('click', () => {
            document.getElementById('dateInput').value = item.original_date;
            document.getElementById('hoursToAdd').value = item.hours_added;
            this.showNotification('Date loaded from history', 'success');
        });

        historyContainer.insertBefore(historyItem, historyContainer.firstChild);

        // Limit history items
        const items = historyContainer.querySelectorAll('.history-item');
        if (items.length > CONFIG.MAX_HISTORY_ITEMS) {
            items[items.length - 1].remove();
        }
    }

    static exportData(format) {
        if (!appState.currentResult) {
            this.showNotification('No data to export', 'error');
            return;
        }

        const data = {
            ...appState.currentResult,
            history: appState.history.slice(0, 10) // Include last 10 items
        };

        switch (format) {
            case 'json':
                this.downloadJSON(data, `date-calculation-${Date.now()}.json`);
                break;
            case 'csv':
                this.downloadCSV(data, `date-calculation-${Date.now()}.csv`);
                break;
            case 'pdf':
                this.downloadPDF(data, `date-calculation-${Date.now()}.pdf`);
                break;
        }

        this.showNotification(`Data exported as ${format.toUpperCase()}`, 'success');
    }

    static downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    static downloadCSV(data, filename) {
        const csv = [
            ['Original Date', 'New Date', 'Hours Added', 'Timezone', 'Timestamp'],
            [data.original_date, data.new_date, data.hours_added, data.timezone, data.timestamp]
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    static downloadPDF(data, filename) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(20);
        doc.text('ChronoMaster Pro - Date Calculation Report', 20, 30);
        
        doc.setFontSize(12);
        doc.text(`Original Date: ${data.original_date}`, 20, 50);
        doc.text(`New Date: ${data.new_date}`, 20, 65);
        doc.text(`Hours Added: ${data.hours_added}`, 20, 80);
        doc.text(`Timezone: ${data.timezone}`, 20, 95);
        doc.text(`Calculation Method: ${data.method}`, 20, 110);
        doc.text(`Timestamp: ${new Date(data.timestamp).toLocaleString()}`, 20, 125);
        
        doc.save(filename);
    }
}

// ==========================================================================
// EVENT HANDLERS
// ==========================================================================

class EventHandlers {
    static init() {
        this.setupCalculateButton();
        this.setupThemeToggle();
        this.setupExportButtons();
        this.setupTimezoneConverter();
        this.setupValidation();
        this.setupHistory();
        this.setupKeyboardShortcuts();
        this.setupRealTimeValidation();
    }

    static setupCalculateButton() {
        const calculateBtn = document.getElementById('calculateBtn');
        const dateInput = document.getElementById('dateInput');
        const hoursToAdd = document.getElementById('hoursToAdd');
        const timezone = document.getElementById('timezone');

        calculateBtn.addEventListener('click', async () => {
            UIComponents.showLoading('Calculating new date...');
            
            try {
                const result = await apiService.calculateDate(
                    dateInput.value,
                    parseInt(hoursToAdd.value),
                    timezone.value
                );

                appState.currentResult = result;
                UIComponents.updateResults(result);
                
                if (result.success) {
                    appState.addToHistory(result);
                    UIComponents.addToHistory(result);
                }
            } catch (error) {
                UIComponents.showNotification(`Calculation failed: ${error.message}`, 'error');
            } finally {
                UIComponents.hideLoading();
            }
        });

        // Auto-calculate on input change
        [dateInput, hoursToAdd, timezone].forEach(input => {
            input.addEventListener('change', () => {
                if (dateInput.value && this.validateInput(dateInput.value)) {
                    calculateBtn.click();
                }
            });
        });
    }

    static setupThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        const icon = themeToggle.querySelector('i');
        
        // Set initial theme
        document.documentElement.setAttribute('data-theme', appState.isDarkMode ? 'dark' : 'light');
        icon.className = appState.isDarkMode ? 'fas fa-sun' : 'fas fa-moon';

        themeToggle.addEventListener('click', () => {
            appState.toggleDarkMode();
            icon.className = appState.isDarkMode ? 'fas fa-sun' : 'fas fa-moon';
            
            // Add animation
            themeToggle.style.transform = 'rotate(360deg)';
            setTimeout(() => {
                themeToggle.style.transform = 'rotate(0deg)';
            }, 300);
        });
    }

    static setupExportButtons() {
        document.getElementById('exportJSON').addEventListener('click', () => {
            UIComponents.exportData('json');
        });

        document.getElementById('exportCSV').addEventListener('click', () => {
            UIComponents.exportData('csv');
        });

        document.getElementById('exportPDF').addEventListener('click', () => {
            UIComponents.exportData('pdf');
        });
    }

    static setupTimezoneConverter() {
        const convertBtn = document.getElementById('convertTimezone');
        const sourceTz = document.getElementById('sourceTimezone');
        const targetTz = document.getElementById('targetTimezone');
        const dateInput = document.getElementById('dateInput');

        convertBtn.addEventListener('click', () => {
            try {
                const converted = DateManipulator.convertTimezone(
                    dateInput.value,
                    sourceTz.value,
                    targetTz.value
                );
                
                dateInput.value = converted;
                document.getElementById('timezone').value = targetTz.value;
                
                UIComponents.showNotification(
                    `Converted from ${sourceTz.value} to ${targetTz.value}`, 
                    'success'
                );
                
                // Auto-recalculate
                document.getElementById('calculateBtn').click();
            } catch (error) {
                UIComponents.showNotification(`Conversion failed: ${error.message}`, 'error');
            }
        });
    }

    static setupValidation() {
        const validateBtn = document.getElementById('runTests');
        validateBtn.addEventListener('click', () => {
            this.runTestSuite();
        });
    }

    static async runTestSuite() {
        UIComponents.showLoading('Running test suite...');
        
        const tests = [
            { input: "March 6 2009 7:30pm EST", hours: 12, expected: "March 7 2009 7:30am EST" },
            { input: "January 17 2017 11:43am EST", hours: 12, expected: "January 17 2017 11:43pm EST" },
            { input: "February 29 2004 9:15pm EST", hours: 12, expected: "March 1 2004 9:15am EST" },
            { input: "February 28 1999 3:15pm EST", hours: 12, expected: "March 1 1999 3:15am EST" },
            { input: "December 31 2020 1:45pm EST", hours: 12, expected: "January 1 2021 1:45am EST" }
        ];

        const results = [];
        
        for (const test of tests) {
            try {
                const result = await apiService.calculateDate(test.input, test.hours, 'EST');
                const passed = result.success && result.new_date === test.expected;
                results.push({ test, result, passed });
            } catch (error) {
                results.push({ test, error: error.message, passed: false });
            }
        }

        this.displayTestResults(results);
        UIComponents.hideLoading();
    }

    static displayTestResults(results) {
        const container = document.getElementById('testResults');
        const passed = results.filter(r => r.passed).length;
        const total = results.length;
        
        container.innerHTML = `
            <div class="test-summary">
                <h4>Test Results: ${passed}/${total} Passed</h4>
                <div class="test-progress">
                    <div class="progress-bar" style="width: ${(passed/total)*100}%"></div>
                </div>
            </div>
            <div class="test-details">
                ${results.map((result, index) => `
                    <div class="test-item ${result.passed ? 'passed' : 'failed'}">
                        <div class="test-header">
                            <span>Test ${index + 1}: ${result.passed ? '✓' : '✗'}</span>
                            <span>${result.passed ? 'PASSED' : 'FAILED'}</span>
                        </div>
                        <div class="test-details">
                            Input: ${result.test.input} +${result.test.hours}h
                            ${!result.passed ? `<br>Expected: ${result.test.expected}<br>Got: ${result.result?.new_date || 'Error'}` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        UIComponents.updateValidationStatus(passed === total, 
            passed === total ? 'All tests passed!' : `${total - passed} tests failed`);
    }

    static setupHistory() {
        // Load existing history
        const historyContainer = document.getElementById('dateHistory');
        if (appState.history.length > 0) {
            historyContainer.innerHTML = '';
            appState.history.forEach(item => {
                UIComponents.addToHistory(item);
            });
        }
    }

    static setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Enter to calculate
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('calculateBtn').click();
            }
            
            // Ctrl/Cmd + D to toggle dark mode
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                document.getElementById('themeToggle').click();
            }
        });
    }

    static setupRealTimeValidation() {
        const dateInput = document.getElementById('dateInput');
        let validationTimeout;

        dateInput.addEventListener('input', () => {
            clearTimeout(validationTimeout);
            validationTimeout = setTimeout(() => {
                this.validateInput(dateInput.value);
            }, CONFIG.DEBOUNCE_DELAY);
        });
    }

    static validateInput(value) {
        if (!value.trim()) {
            UIComponents.updateValidationStatus(true, 'Ready for input');
            return true;
        }

        try {
            DateManipulator.parseDateString(value);
            UIComponents.updateValidationStatus(true, 'Valid date format');
            return true;
        } catch (error) {
            UIComponents.updateValidationStatus(false, error.message);
            return false;
        }
    }
}

// ==========================================================================
// INITIALIZATION
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 ChronoMaster Pro initializing...');
    
    // Initialize all components
    EventHandlers.init();
    
    // Load initial data
    if (appState.history.length > 0) {
        const lastItem = appState.history[0];
        document.getElementById('dateInput').value = lastItem.original_date;
        document.getElementById('hoursToAdd').value = lastItem.hours_added;
    }
    
    // Auto-run initial calculation
    setTimeout(() => {
        document.getElementById('calculateBtn').click();
    }, 1000);
    
    console.log('✅ ChronoMaster Pro ready!');
});

// ==========================================================================
// NOTIFICATION STYLES (DYNAMIC)
// ==========================================================================

const notificationStyles = `
.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--bg-card);
    color: var(--text-primary);
    padding: 1rem 1.5rem;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    border-left: 4px solid var(--primary-color);
    transform: translateX(400px);
    transition: transform 0.3s ease;
    z-index: 1000;
    max-width: 400px;
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.notification.show {
    transform: translateX(0);
}

.notification-success {
    border-left-color: var(--success-color);
}

.notification-error {
    border-left-color: var(--error-color);
}

.notification-close {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    margin-left: auto;
}

.test-item {
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    border-radius: var(--radius-sm);
    border-left: 4px solid;
}

.test-item.passed {
    background: rgba(72, 187, 120, 0.1);
    border-left-color: var(--success-color);
}

.test-item.failed {
    background: rgba(245, 101, 101, 0.1);
    border-left-color: var(--error-color);
}

.test-header {
    display: flex;
    justify-content: space-between;
    font-weight: 600;
    margin-bottom: 0.5rem;
}

.progress-bar {
    height: 4px;
    background: var(--success-color);
    border-radius: 2px;
    transition: width 0.3s ease;
}
`;

// Add notification styles to head
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);
