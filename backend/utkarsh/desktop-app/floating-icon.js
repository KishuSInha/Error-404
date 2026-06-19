const { ipcRenderer } = require('electron');

const iconBtn = document.getElementById('iconBtn');
const leftEye = document.getElementById('leftEye');
const rightEye = document.getElementById('rightEye');

if (iconBtn) {
    iconBtn.addEventListener('click', () => {
        ipcRenderer.send('restore-main-window');
    });

    // Hover effect
    iconBtn.addEventListener('mousedown', () => {
        iconBtn.style.transform = 'scale(0.95)';
    });

    iconBtn.addEventListener('mouseup', () => {
        iconBtn.style.transform = 'scale(1.05)';
    });
}

/**
 * Handle eye tracking based on cursor position
 * Coordinates are sent from the main process
 */
ipcRenderer.on('cursor-move', (event, { x, y }) => {
    // Current screen resolution and window position (approximate for now)
    // The icon is set at x: 40, y: screenHeight - 80 - 40
    
    // We can get more precise by using the window's own screen coordinates
    // but since it's a small window, relative to its center is fine
    const iconWidth = 60;
    const iconHeight = 60;
    
    // Approximate absolute center of the ghost on screen
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    
    // Ghost center (approximate) - Icon is at x=30, y=screenHeight - 60 - 30
    const centerX = 30 + (iconWidth / 2);
    const centerY = screenHeight - 30 - (iconHeight / 2);
    
    // Calculate vector from center to cursor
    const dx = x - centerX;
    const dy = y - centerY;
    
    const distance = Math.sqrt(dx*dx + dy*dy);
    const maxMove = 2; // Subtle movement for a cute icon
    
    // Limit movement distance
    const moveDist = Math.min(distance / 40, maxMove);
    const angle = Math.atan2(dy, dx);
    
    const moveX = Math.cos(angle) * moveDist;
    const moveY = Math.sin(angle) * moveDist;
    
    if (leftEye) leftEye.style.transform = `translate(${moveX}px, ${moveY}px)`;
    if (rightEye) rightEye.style.transform = `translate(${moveX}px, ${moveY}px)`;
});
