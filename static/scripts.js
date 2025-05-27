// TradeWise JavaScript - Voice-First Business Companion

// Global variables
let isRecording = false;
let recognition = null;
let currentTransactionType = '';
let cameraStream = null;
let businessData = {
    totalSales: 0,
    totalExpenses: 0,
    netProfit: 0,
    todayProfit: 0,
    transactions: []
};

// Coach tips
const coachTips = [
    "Track your daily sales to see your progress!",
    "Great job! Your profit is increasing. Keep it up!",
    "Consider categorizing your expenses for better insights.",
    "Voice commands make tracking so much easier!",
    "Every rands counts - track those small sales too!",
    "Your business is growing! Time to celebrate! 🎉",
    "Regular tracking leads to better business decisions.",
    "Keep your receipts organized for tax season."
];

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupSpeechRecognition();
    loadBusinessData();
});

// Initialize app
function initializeApp() {
    console.log('TradeWise initialized');
    showToast('Welcome to TradeWise! 👋', 'success');
    
    // Load demo data if empty
    if (businessData.transactions.length === 0) {
        loadDemoData();
    }
}

// Load demo data
function loadDemoData() {
    const demoTransactions = [
        {
            id: 1,
            type: 'sale',
            amount: 250,
            description: 'Sold vegetables',
            category: 'product-sale',
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString()
        },
        {
            id: 2,
            type: 'expense',
            amount: 50,
            description: 'Bus fare',
            category: 'transport',
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString()
        }
    ];
    
    businessData.transactions = demoTransactions;
    updateStats();
    renderTransactions();
}

// Setup speech recognition
function setupSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = function() {
            console.log('Voice recognition started');
            document.getElementById('voiceFeedback').innerHTML = '<div class="processing"></div> Listening...';
        };

        recognition.onresult = function(event) {
            const command = event.results[0][0].transcript;
            console.log('Voice command:', command);
            processVoiceCommand(command);
        };

        recognition.onerror = function(event) {
            console.error('Speech recognition error:', event.error);
            document.getElementById('voiceFeedback').textContent = 'Sorry, I couldn\'t hear you clearly. Please try again.';
            stopRecording();
        };

        recognition.onend = function() {
            stopRecording();
        };
    } else {
        console.warn('Speech recognition not supported');
        document.getElementById('voiceFeedback').textContent = 'Voice recognition not supported in this browser';
    }
}

// Toggle voice recording
function toggleVoiceRecording() {
    if (!recognition) {
        showToast('Voice recognition not available', 'error');
        return;
    }

    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

// Start recording
function startRecording() {
    isRecording = true;
    const voiceBtn = document.getElementById('voiceBtn');
    const voiceIcon = document.getElementById('voiceIcon');
    const voiceText = document.getElementById('voiceText');

    voiceBtn.classList.add('recording');
    voiceIcon.className = 'fas fa-stop';
    voiceText.textContent = 'Recording...';

    recognition.start();
}

// Stop recording
function stopRecording() {
    isRecording = false;
    const voiceBtn = document.getElementById('voiceBtn');
    const voiceIcon = document.getElementById('voiceIcon');
    const voiceText = document.getElementById('voiceText');

    voiceBtn.classList.remove('recording');
    voiceIcon.className = 'fas fa-microphone';
    voiceText.textContent = 'Tap to speak';

    if (recognition) {
        recognition.stop();
    }
}

// Process voice command
function processVoiceCommand(command) {
    try {
        document.getElementById('voiceFeedback').innerHTML = '<div class="processing"></div> Processing: "' + command + '"';

        // Parse the voice command using NLP-like logic
        const result = parseVoiceCommand(command.toLowerCase());

        if (result.success) {
            // Add transaction to business data
            const transaction = {
                id: Date.now(),
                type: result.type,
                amount: result.amount,
                description: result.description,
                category: result.category,
                timestamp: new Date().toISOString(),
                date: new Date().toLocaleDateString()
            };

            businessData.transactions.unshift(transaction);
            updateStats();
            renderTransactions();

            document.getElementById('voiceFeedback').innerHTML = 
                `✅ Added: ${transaction.description} - R${transaction.amount}`;
            
            showToast(`Transaction recorded: R${transaction.amount}`, 'success');
            
            // Show celebration for sales
            if (transaction.type === 'sale' && transaction.amount >= 100) {
                showCelebration('Great Sale! 🎉', `You earned R${transaction.amount}!`);
            }
        } else {
            document.getElementById('voiceFeedback').innerHTML = `❌ ${result.error}`;
            
            if (result.suggestions) {
                const suggestionHtml = result.suggestions.map(s => `<small>• ${s}</small>`).join('<br>');
                document.getElementById('voiceFeedback').innerHTML += '<br><br>' + suggestionHtml;
            }
        }
    } catch (error) {
        console.error('Error processing voice command:', error);
        document.getElementById('voiceFeedback').textContent = 'Error processing command. Please try again.';
    }
}

// Parse voice command using simple NLP
function parseVoiceCommand(command) {
    // Keywords for sales
    const saleKeywords = ['sold', 'sale', 'earned', 'received', 'got', 'made'];
    // Keywords for expenses
    const expenseKeywords = ['bought', 'spent', 'paid', 'expense', 'cost'];
    
    // Extract amount
    const amountMatch = command.match(/(\d+(?:\.\d+)?)/);
    if (!amountMatch) {
        return {
            success: false,
            error: "I couldn't find an amount in your command.",
            suggestions: [
                "Try: 'I sold apples for 50 rands'",
                "Try: 'Spent 200 on supplies'",
                "Try: 'Made 150 from sale'"
            ]
        };
    }

    const amount = parseFloat(amountMatch[1]);
    
    // Determine transaction type
    let type = '';
    let category = 'other';
    
    const isSale = saleKeywords.some(keyword => command.includes(keyword));
    const isExpense = expenseKeywords.some(keyword => command.includes(keyword));
    
    if (isSale) {
        type = 'sale';
        category = 'product-sale';
    } else if (isExpense) {
        type = 'expense';
        // Try to categorize expense
        if (command.includes('transport') || command.includes('bus') || command.includes('auto')) {
            category = 'transport';
        } else if (command.includes('food') || command.includes('lunch') || command.includes('dinner')) {
            category = 'food';
        } else if (command.includes('supplies') || command.includes('material')) {
            category = 'supplies';
        }
    } else {
        return {
            success: false,
            error: "I couldn't understand if this was a sale or expense.",
            suggestions: [
                "Try: 'I sold something for X rands'",
                "Try: 'I spent X rands on something'",
                "Try: 'Bought supplies for X'"
            ]
        };
    }

    // Extract description
    let description = command.replace(/(\d+(?:\.\d+)?)/g, '').trim();
    description = description.replace(/(rands?|rs\.?|R)/gi, '').trim();
    description = description.replace(/^(i |for |on )/i, '').trim();
    
    if (description.length < 3) {
        description = type === 'sale' ? 'Product sale' : 'Business expense';
    }

    return {
        success: true,
        type: type,
        amount: amount,
        description: description,
        category: category
    };
}

// Load business data
function loadBusinessData() {
    updateStats();
    renderTransactions();
    updateCoachTip();
}

// Update statistics
function updateStats() {
    const sales = businessData.transactions
        .filter(t => t.type === 'sale')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = businessData.transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const today = new Date().toLocaleDateString();
    const todayTransactions = businessData.transactions.filter(t => t.date === today);
    const todaySales = todayTransactions
        .filter(t => t.type === 'sale')
        .reduce((sum, t) => sum + t.amount, 0);
    const todayExpenses = todayTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    businessData.totalSales = sales;
    businessData.totalExpenses = expenses;
    businessData.netProfit = sales - expenses;
    businessData.todayProfit = todaySales - todayExpenses;

    // Update UI
    document.getElementById('totalSales').textContent = `R${sales}`;
    document.getElementById('totalExpenses').textContent = `R${expenses}`;
    document.getElementById('netProfit').textContent = `R${businessData.netProfit}`;
    document.getElementById('todayProfit').textContent = `R${businessData.todayProfit}`;
}

// Render transactions
function renderTransactions() {
    const container = document.getElementById('transactionsList');
    
    if (businessData.transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-list"></i>
                <p>No transactions yet. Start by recording your first sale!</p>
            </div>
        `;
        return;
    }

    const transactionsHtml = businessData.transactions
        .slice(0, 10) // Show last 10 transactions
        .map(transaction => `
            <div class="transaction-item ${transaction.type}">
                <div class="transaction-info">
                    <h4>${transaction.description}</h4>
                    <p>${transaction.category} • ${transaction.date}</p>
                </div>
                <div class="transaction-amount ${transaction.type === 'sale' ? 'positive' : 'negative'}">
                    ${transaction.type === 'sale' ? '+' : '-'}R${transaction.amount}
                </div>
            </div>
        `).join('');

    container.innerHTML = transactionsHtml;
}

// Show transaction modal
function showTransactionModal(type) {
    currentTransactionType = type;
    document.getElementById('modalTitle').textContent = 
        type === 'sale' ? 'Record Sale' : 'Add Expense';
    document.getElementById('submitBtn').textContent = 
        type === 'sale' ? 'Record Sale' : 'Add Expense';
    
    // Clear form
    document.getElementById('transactionForm').reset();
    
    // Show modal
    document.getElementById('transactionModal').style.display = 'block';
}

// Close transaction modal
function closeTransactionModal() {
    document.getElementById('transactionModal').style.display = 'none';
}

// Submit transaction
function submitTransaction(event) {
    event.preventDefault();
    
    const amount = parseFloat(document.getElementById('amount').value);
    const description = document.getElementById('description').value;
    const category = document.getElementById('category').value;

    const transaction = {
        id: Date.now(),
        type: currentTransactionType,
        amount: amount,
        description: description,
        category: category,
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString()
    };

    businessData.transactions.unshift(transaction);
    updateStats();
    renderTransactions();
    closeTransactionModal();

    showToast(`${currentTransactionType === 'sale' ? 'Sale' : 'Expense'} recorded successfully!`, 'success');

    // Show celebration for big sales
    if (currentTransactionType === 'sale' && amount >= 500) {
        showCelebration('Excellent Sale! 🎉', `You earned R${amount}! Keep up the great work!`);
    }
}

// Open camera
function openCamera() {
    document.getElementById('cameraModal').style.display = 'block';
    
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            cameraStream = stream;
            document.getElementById('cameraFeed').srcObject = stream;
        })
        .catch(error => {
            console.error('Camera access denied:', error);
            document.getElementById('processingResult').innerHTML = 
                '<p style="color: #e74c3c;">Camera access denied. Please use the upload option instead.</p>';
        });
}

// Close camera modal
function closeCameraModal() {
    document.getElementById('cameraModal').style.display = 'none';
    
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
}

// Capture photo
function capturePhoto() {
    const video = document.getElementById('cameraFeed');
    const canvas = document.getElementById('cameraCanvas');
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(blob => {
        processImageData(blob);
    });
}

// Process image
function processImage(event) {
    const file = event.target.files[0];
    if (file) {
        processImageData(file);
    }
}

// Process image data (mock OCR)
function processImageData(imageData) {
    const resultDiv = document.getElementById('processingResult');
    resultDiv.innerHTML = '<div class="processing"></div> Processing receipt...';

    // Mock OCR processing
    setTimeout(() => {
        const mockResults = [
            { description: 'Grocery supplies', amount: 250, category: 'supplies' },
            { description: 'Transportation', amount: 50, category: 'transport' },
            { description: 'Office materials', amount: 180, category: 'supplies' }
        ];

        const randomResult = mockResults[Math.floor(Math.random() * mockResults.length)];
        
        resultDiv.innerHTML = `
            <h4>Receipt Processed Successfully!</h4>
            <p><strong>Description:</strong> ${randomResult.description}</p>
            <p><strong>Amount:</strong> R${randomResult.amount}</p>
            <p><strong>Category:</strong> ${randomResult.category}</p>
            <button onclick="addScannedTransaction('${randomResult.description}', ${randomResult.amount}, '${randomResult.category}')" 
                    class="submit-btn" style="margin-top: 10px;">
                Add as Expense
            </button>
        `;
    }, 2000);
}

// Add scanned transaction
function addScannedTransaction(description, amount, category) {
    const transaction = {
        id: Date.now(),
        type: 'expense',
        amount: amount,
        description: description,
        category: category,
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString()
    };

    businessData.transactions.unshift(transaction);
    updateStats();
    renderTransactions();
    closeCameraModal();

    showToast('Scanned expense added successfully!', 'success');
}

// Show coach tip
function showCoachTip() {
    const tips = getPersonalizedTips();
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    document.getElementById('coachTip').textContent = randomTip;
    
    showToast('New business tip! 💡', 'success');
}

// Get personalized tips
function getPersonalizedTips() {
    const baseTips = [...coachTips];
    
    if (businessData.netProfit > 1000) {
        baseTips.push("Wow! You've crossed R1000 profit! Consider investing in growth.");
    }
    
    if (businessData.transactions.length > 10) {
        baseTips.push("You're a tracking champion! Your consistency is paying off.");
    }
    
    const todayTransactions = businessData.transactions.filter(
        t => t.date === new Date().toLocaleDateString()
    ).length;
    
    if (todayTransactions > 5) {
        baseTips.push("Busy day! You've recorded " + todayTransactions + " transactions today.");
    }
    
    return baseTips;
}

// Update coach tip
function updateCoachTip() {
    const tips = getPersonalizedTips();
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    document.getElementById('coachTip').textContent = randomTip;
}

// Show celebration modal
function showCelebration(title, message) {
    document.getElementById('celebrationTitle').textContent = title;
    document.getElementById('celebrationMessage').textContent = message;
    document.getElementById('celebrationModal').style.display = 'block';
    
    // Auto close after 5 seconds
    setTimeout(() => {
        closeCelebration();
    }, 5000);
}

// Close celebration modal
function closeCelebration() {
    document.getElementById('celebrationModal').style.display = 'none';
}

// Show toast notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Close modals when clicking outside
window.onclick = function(event) {
    const transactionModal = document.getElementById('transactionModal');
    const cameraModal = document.getElementById('cameraModal');
    const celebrationModal = document.getElementById('celebrationModal');
    
    if (event.target === transactionModal) {
        closeTransactionModal();
    }
    if (event.target === cameraModal) {
        closeCameraModal();
    }
    if (event.target === celebrationModal) {
        closeCelebration();
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Press 'S' for sale
    if (event.key.toLowerCase() === 's' && !event.target.matches('input, textarea')) {
        showTransactionModal('sale');
    }
    // Press 'E' for expense
    if (event.key.toLowerCase() === 'e' && !event.target.matches('input, textarea')) {
        showTransactionModal('expense');
    }
    // Press 'Space' for voice
    if (event.key === ' ' && !event.target.matches('input, textarea')) {
        event.preventDefault();
        toggleVoiceRecording();
    }
    // Press 'Escape' to close modals
    if (event.key === 'Escape') {
        closeTransactionModal();
        closeCameraModal();
        closeCelebration();
    }
});

// Auto-update coach tip every 30 seconds
setInterval(updateCoachTip, 30000);

// Show tips about keyboard shortcuts
setTimeout(() => {
    showToast('💡 Tip: Press S for Sale, E for Expense, Space for Voice!', 'success');
}, 10000);