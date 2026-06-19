const { Notification } = require('electron');
const path = require('path');

/**
 * Show a macOS notification
 * @param {string} title - Notification title
 * @param {string} body - Notification body text
 * @param {string} [subtitle] - Optional subtitle
 */
function showNotification(title, body, subtitle = '') {
    try {
        const notification = new Notification({
            title: title,
            subtitle: subtitle,
            body: body,
            icon: path.join(__dirname, 'assets', 'icon.png'),
            sound: 'default',
            silent: false
        });

        notification.show();

        // Log for debugging
        console.log(`📬 Notification: ${title} - ${body}`);
    } catch (error) {
        console.error('Failed to show notification:', error);
    }
}

module.exports = { showNotification };
