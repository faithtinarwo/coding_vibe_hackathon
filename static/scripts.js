// Global variables
let currentUser = null;
let currentStock = null;
let isLoggedIn = false;

// API base URL
const API_BASE = 'http://localhost:5000/api';

// --- Speech Synthesis Functions ---

function speak(text) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(utterance);
  } else {
    console.log('Speech synthesis not supported');
  }
}

// --- Speech Recognition / Voice Assistant Class ---

class VoiceAssistant {
  constructor() {
    this.recognition = null;
    this.initSpeechRecognition();
    this.initUIElements(); // Assuming this function exists elsewhere or needs to be added
  }

  initSpeechRecognition() {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.interimResults = false;
      this.recognition.continuous = false;
      this.recognition.lang = 'en-US';
      this.setupRecognitionEvents();
    } else {
      console.warn('Speech recognition not supported in this browser');
    }
  }

  // Placeholder for initUIElements, adjust as needed based on your actual UI setup
  initUIElements() {
    if (this.recognition) {
      const micButton = document.createElement('button');
      micButton.textContent = '🎤 Start Listening';
      document.body.appendChild(micButton);
      micButton.addEventListener('click', () => this.startListening());

      const voiceFeedback = document.createElement('div');
      voiceFeedback.id = 'voiceFeedback';
      document.body.appendChild(voiceFeedback);
    }
  }

  setupRecognitionEvents() {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      console.log('Voice recognition started...');
      document.getElementById('voiceFeedback').textContent = 'Listening...';
    };

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      document.getElementById('voiceFeedback').textContent = `You said: "${transcript}"`;
      console.log('Transcript:', transcript);
      this.processVoiceCommand(transcript);
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      document.getElementById('voiceFeedback').textContent = `Error: ${event.error}`;
    };

    this.recognition.onend = () => {
      console.log('Voice recognition ended.');
      document.getElementById('voiceFeedback').textContent = '';
    };
  }

  startListening() {
    if (this.recognition) {
      this.recognition.start();
    } else {
      speak('Speech recognition is not supported in your browser.');
    }
  }

  processVoiceCommand(transcript) {
    // Convert transcript to lowercase for easier matching
    const lowerTranscript = transcript.toLowerCase();

    // Navigation commands
    if (lowerTranscript.includes('show dashboard')) {
      showSection('dashboard');
      speak('Showing dashboard.');
      return;
    }
    if (lowerTranscript.includes('show portfolio')) {
      showSection('portfolio');
      speak('Showing portfolio.');
      return;
    }
    if (lowerTranscript.includes('show watchlist')) {
      showSection('watchlist');
      speak('Showing watchlist.');
      return;
    }
    if (lowerTranscript.includes('show history')) {
      showSection('history');
      speak('Showing trade history.');
      return;
    }
    if (lowerTranscript.includes('go to trading')) {
      showSection('trading');
      speak('Navigating to trading section.');
      return;
    }

    // Authentication commands
    if (lowerTranscript.includes('login')) {
      showLogin();
      speak('Opening login form.');
      return;
    }
    if (lowerTranscript.includes('register')) {
      showRegister();
      speak('Opening registration form.');
      return;
    }
    if (lowerTranscript.includes('logout')) {
      logout();
      speak('Logging out.');
      return;
    }

    // Stock search command
    const searchRegex = /(?:search for|find stock|what is)\s+([A-Za-z]{1,5})/i;
    let match = lowerTranscript.match(searchRegex);
    if (match) {
      const symbol = match[1].toUpperCase();
      document.getElementById('stockSymbol').value = symbol;
      searchStock();
      speak(`Searching for ${symbol}.`);
      return;
    }

    // Add to watchlist command
    const addWatchlistRegex = /(?:add|put)\s+([A-Za-z]{1,5})\s+to watchlist/i;
    match = lowerTranscript.match(addWatchlistRegex);
    if (match) {
      const symbol = match[1].toUpperCase();
      document.getElementById('watchlistSymbol').value = symbol;
      addToWatchlist();
      speak(`Adding ${symbol} to your watchlist.`);
      return;
    }

    // Remove from watchlist command
    const removeWatchlistRegex = /(?:remove|delete)\s+([A-Za-z]{1,5})\s+from watchlist/i;
    match = lowerTranscript.match(removeWatchlistRegex);
    if (match) {
      const symbol = match[1].toUpperCase();
      removeFromWatchlist(symbol);
      speak(`Removing ${symbol} from your watchlist.`);
      return;
    }

    // Trading commands (buy/sell)
    if (this.handleTrading(lowerTranscript)) {
      return; // Handled by specific trade function
    }
    
    // Fallback if no command is recognized
    speak(voiceConfig.feedback.commandNotFound);
  }

  handleTrading(transcript) {
    const tradeRegex = /^(buy|sell)\s+(\d{1,5})\s+(?:shares\s+of\s+)?([A-Za-z]{1,5})$/i;
    const match = transcript.match(tradeRegex);

    if (match) {
      const [, action, quantity, symbol] = match;
      if (!isLoggedIn) {
        speak('Please log in to trade.');
        return true;
      }

      // Validate numeric quantity
      if (isNaN(quantity)) {
        speak('Please specify a valid number of shares.');
        return true;
      }

      document.getElementById('stockSymbol').value = symbol.toUpperCase();

      // Ensure searchStock completes before attempting to trade
      searchStock().then(() => {
        if (!currentStock) {
          speak(`Could not find stock ${symbol}.`);
          return;
        }

        document.getElementById('tradeQuantity').value = quantity;
        executeTrade(action.toUpperCase());
        speak(`${action}ing ${quantity} shares of ${symbol}.`);
      }).catch(error => {
        console.error("Error during voice trade search:", error);
        speak("There was an issue processing your trade. Please try again.");
      });

      return true;
    }
    return false;
  }
}

// Instantiate the VoiceAssistant
const voiceAssistant = new VoiceAssistant();

// Voice Assistant Configuration
const voiceConfig = {
  feedback: {
    welcome: 'Welcome to the dashboard. How can I assist you today?',
    needLogin: 'Please log in to perform this action.',
    commandNotFound: 'Sorry, I didn\'t understand that command. Please try again.',
    // Add more specific feedback messages as needed
  },
  // Add more configuration, e.g., supported commands, synonyms
};


// --- Global Variables (Already defined at the top) ---
// let currentUser = null;
// let currentStock = null;
// let isLoggedIn = false;
// const API_BASE = 'http://localhost:5000/api';

// --- Mock Data (for development) ---

function getMockIndexData(symbol) {
  const mockData = {
    '^GSPC': {
      symbol: 'S&P 500',
      price: 4756.50,
      change: 12.35,
      changePercent: 0.26,
      volume: 3500000000
    },
    '^DJI': {
      symbol: 'Dow Jones',
      price: 37863.80,
      change: -45.20,
      changePercent: -0.12,
      volume: 285000000
    },
    '^IXIC': {
      symbol: 'NASDAQ',
      price: 14944.83,
      change: 67.12,
      changePercent: 0.45,
      volume: 4200000000
    }
  };

  return mockData[symbol] || {
    symbol: symbol,
    price: 100.00,
    change: 0.00,
    changePercent: 0.00,
    volume: 1000000
  };
}

// --- Initialization and Event Listeners ---

document.addEventListener('DOMContentLoaded', async function() {
  // Check backend connection
  const backendAvailable = await checkBackendConnection();

  if (!backendAvailable) {
    showMessage('Demo Mode: Backend server not connected. Some features may be limited.', 'info');
  }

  initializeApp();
  setupEventListeners();
  loadMarketIndices();
  initializeUIEnhancements(); // Call UI enhancements here
  speak(voiceConfig.feedback.welcome); // Speak welcome message on page load
});

function initializeApp() {
  // Check if user is logged in (in a real app, you'd check session/token)
  // Only show dashboard if the element exists
  if (document.getElementById('dashboard')) {
    showSection('dashboard');
  }

  // Load initial data if user is logged in
  if (isLoggedIn) {
    loadDashboard();
  }
}

function setupEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const section = this.dataset.section;
      showSection(section);
    });
  });

  // Forms - check if elements exist before adding listeners
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }

  // Stock symbol input
  const stockSymbol = document.getElementById('stockSymbol');
  if (stockSymbol) {
    stockSymbol.addEventListener('input', function() {
      if (this.value.length > 0) {
        this.value = this.value.toUpperCase();
      }
    });
  }

  // Trade quantity input
  const tradeQuantity = document.getElementById('tradeQuantity');
  if (tradeQuantity) {
    tradeQuantity.addEventListener('input', updateEstimatedTotal);
  }

  // Close modals when clicking outside
  window.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
      e.target.style.display = 'none';
    }
  });

  // Attach searchStock to a button if it exists
  const searchStockButton = document.getElementById('searchStockButton');
  if (searchStockButton) {
    searchStockButton.addEventListener('click', searchStock);
  }

  // Attach executeTrade to buy and sell buttons
  const buyButton = document.getElementById('buyButton');
  if (buyButton) {
    buyButton.addEventListener('click', () => executeTrade('BUY'));
  }

  const sellButton = document.getElementById('sellButton');
  if (sellButton) {
    sellButton.addEventListener('click', () => executeTrade('SELL'));
  }

  // Attach addToWatchlist to a button if it exists
  const addToWatchlistButton = document.getElementById('addToWatchlistButton');
  if (addToWatchlistButton) {
    addToWatchlistButton.addEventListener('click', addToWatchlist);
  }

  // Attach logout button
  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', logout);
  }
}

// --- Navigation Functions ---

function showSection(sectionName) {
  // Hide all sections
  document.querySelectorAll('.section').forEach(section => {
    section.classList.remove('active');
  });

  // Show selected section
  const targetSection = document.getElementById(sectionName);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  // Update navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });

  const navLink = document.querySelector(`[data-section="${sectionName}"]`);
  if (navLink) {
    navLink.classList.add('active');
  }

  // Load section-specific data
  switch (sectionName) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'portfolio':
      loadPortfolio();
      break;
    case 'watchlist':
      loadWatchlist();
      break;
    case 'history':
      loadTradeHistory();
      break;
  }
}

// --- Authentication Functions ---

function showLogin() {
  document.getElementById('loginModal').style.display = 'block';
}

function showRegister() {
  document.getElementById('registerModal').style.display = 'block';
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

function switchToLogin() {
  closeModal('registerModal');
  showLogin();
}

function switchToRegister() {
  closeModal('loginModal');
  showRegister();
}

async function handleLogin(e) {
  e.preventDefault();

  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        username,
        password
      })
    });

    const data = await response.json();

    if (response.ok) {
      isLoggedIn = true;
      currentUser = {
        id: data.user_id,
        username
      };
      closeModal('loginModal');
      updateUIForLoggedInUser();
      showMessage('Login successful!', 'success');
      loadDashboard();
    } else {
      showMessage(data.error || 'Login failed', 'error');
    }
  } catch (error) {
    showMessage('Network error. Please try again.', 'error');
    console.error('Login error:', error);
  }
}

async function handleRegister(e) {
  e.preventDefault();

  const username = document.getElementById('registerUsername').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;

  try {
    const response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        username,
        email,
        password
      })
    });

    const data = await response.json();

    if (response.ok) {
      isLoggedIn = true;
      currentUser = {
        id: data.user_id,
        username
      };
      closeModal('registerModal');
      updateUIForLoggedInUser();
      showMessage('Registration successful!', 'success');
      loadDashboard();
    } else {
      showMessage(data.error || 'Registration failed', 'error');
    }
  } catch (error) {
    showMessage('Network error. Please try again.', 'error');
    console.error('Registration error:', error);
  }
}

async function logout() {
  try {
    await fetch(`${API_BASE}/logout`, {
      method: 'POST',
      credentials: 'include'
    });

    isLoggedIn = false;
    currentUser = null;
    updateUIForLoggedOutUser();
    showMessage('Logged out successfully', 'success');
    showSection('dashboard');
  } catch (error) {
    console.error('Logout error:', error);
  }
}

function updateUIForLoggedInUser() {
  const authButtons = document.getElementById('authButtons');
  const userInfo = document.getElementById('userInfo');
  const usernameDisplay = document.getElementById('usernameDisplay');

  if (authButtons) authButtons.style.display = 'none';
  if (userInfo) userInfo.style.display = 'flex';
  if (usernameDisplay) usernameDisplay.textContent = currentUser.username;
}

function updateUIForLoggedOutUser() {
  const authButtons = document.getElementById('authButtons');
  const userInfo = document.getElementById('userInfo');

  if (authButtons) authButtons.style.display = 'flex';
  if (userInfo) userInfo.style.display = 'none';

  // Clear dashboard data - check if elements exist
  const totalValue = document.getElementById('totalValue');
  const totalGain = document.getElementById('totalGain');
  const cashBalance = document.getElementById('cashBalance');
  const totalPositions = document.getElementById('totalPositions');

  if (totalValue) totalValue.textContent = '$0.00';
  if (totalGain) totalGain.textContent = '$0.00';
  if (cashBalance) cashBalance.textContent = '$0.00';
  if (totalPositions) totalPositions.textContent = '0';
}

// --- Dashboard Functions ---

async function loadDashboard() {
  if (!isLoggedIn) return;

  try {
    const response = await fetch(`${API_BASE}/portfolio`, {
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      updateDashboardStats(data);
    }
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

function updateDashboardStats(data) {
  const totalValue = data.totalValue + data.cash;
  let totalGain = 0;

  data.portfolio.forEach(item => {
    totalGain += item.pnl;
  });

  document.getElementById('totalValue').textContent = `$${totalValue.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
  document.getElementById('totalGain').textContent = `$${totalGain.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
  document.getElementById('cashBalance').textContent = `$${data.cash.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
  document.getElementById('totalPositions').textContent = data.portfolio.length.toString();
  document.getElementById('userBalance').textContent = `$${data.cash.toLocaleString('en-US', {minimumFractionDigits: 2})}`;

  // Update gain/loss color
  const gainElement = document.getElementById('totalGain');
  gainElement.className = totalGain >= 0 ? 'positive' : 'negative';
}

async function loadMarketIndices() {
  const indices = ['^GSPC', '^DJI', '^IXIC'];

  for (const symbol of indices) {
    try {
      const response = await fetch(`${API_BASE}/stock/${symbol}`);
      if (response.ok) {
        const data = await response.json();
        updateIndexCard(symbol, data);
      }
    } catch (error) {
      console.warn(`Backend not available for ${symbol}. Using mock data.`);
      // Use mock data when backend is not available
      const mockData = getMockIndexData(symbol);
      updateIndexCard(symbol, mockData);
    }
  }
}

function updateIndexCard(symbol, data) {
  const card = document.querySelector(`[data-symbol="${symbol}"]`);
  if (card) {
    const priceElement = card.querySelector('.price');
    const changeElement = card.querySelector('.change');

    priceElement.textContent = data.price.toLocaleString('en-US', {
      minimumFractionDigits: 2
    });

    const changeText = `${data.change >= 0 ? '+' : ''}${data.change.toFixed(2)} (${data.changePercent.toFixed(2)}%)`;
    changeElement.textContent = changeText;
    changeElement.className = `change ${data.change >= 0 ? 'positive' : 'negative'}`;
  }
}

// --- Portfolio Functions ---

async function loadPortfolio() {
  if (!isLoggedIn) {
    document.getElementById('portfolioTableBody').innerHTML = '<tr class="no-data"><td colspan="7">Please login to view your portfolio</td></tr>';
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/portfolio`, {
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      updatePortfolioTable(data.portfolio);
    } else {
      throw new Error('Failed to load portfolio');
    }
  } catch (error) {
    console.error('Error loading portfolio:', error);
    document.getElementById('portfolioTableBody').innerHTML = '<tr class="no-data"><td colspan="7">Error loading portfolio</td></tr>';
  }
}

function updatePortfolioTable(portfolio) {
  const tbody = document.getElementById('portfolioTableBody');

  if (portfolio.length === 0) {
    tbody.innerHTML = '<tr class="no-data"><td colspan="7">No positions found</td></tr>';
    return;
  }

  tbody.innerHTML = portfolio.map(item => `
        <tr>
            <td><strong>${item.symbol}</strong></td>
            <td>${item.quantity}</td>
            <td>$${item.avgPrice.toFixed(2)}</td>
            <td>$${item.currentPrice.toFixed(2)}</td>
            <td>$${item.value.toFixed(2)}</td>
            <td class="${item.pnl >= 0 ? 'positive' : 'negative'}">$${item.pnl.toFixed(2)}</td>
            <td>
                <button onclick="sellStock('${item.symbol}')" class="btn-sell" style="padding: 0.5rem; font-size: 0.8rem;">
                    <i class="fas fa-arrow-down"></i> Sell
                </button>
            </td>
        </tr>
    `).join('');
}

// --- Trading Functions ---

async function searchStock() {
  const symbol = document.getElementById('stockSymbol').value.trim();

  if (!symbol) {
    showMessage('Please enter a stock symbol', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/stock/${symbol}`);

    if (response.ok) {
      const data = await response.json();
      currentStock = data;
      displayStockInfo(data);
    } else {
      const error = await response.json();
      showMessage(error.error || 'Stock not found', 'error');
    }
  } catch (error) {
    showMessage('Error fetching stock data', 'error');
    console.error('Stock search error:', error);
  }
}

function displayStockInfo(stock) {
  document.getElementById('stockSymbolDisplay').textContent = stock.symbol;
  document.getElementById('stockPrice').textContent = `$${stock.price.toFixed(2)}`;

  const changeText = `${stock.change >= 0 ? '+' : ''}$${stock.change.toFixed(2)} (${stock.changePercent.toFixed(2)}%)`;
  const changeElement = document.getElementById('stockChange');
  changeElement.textContent = changeText;
  changeElement.className = `change ${stock.change >= 0 ? 'positive' : 'negative'}`;

  document.getElementById('stockVolume').textContent = stock.volume.toLocaleString();
  document.getElementById('stockHigh').textContent = `$${stock.dayHigh.toFixed(2)}`;
  document.getElementById('stockLow').textContent = `$${stock.dayLow.toFixed(2)}`;
  document.getElementById('stockMarketCap').textContent = stock.marketCap ?
    `$${(stock.marketCap / 1e9).toFixed(2)}B` : 'N/A';

  document.getElementById('stockInfo').style.display = 'block';
  document.getElementById('tradingForm').style.display = 'block';

  updateEstimatedTotal();
}

function updateEstimatedTotal() {
  if (!currentStock) return;

  const quantity = parseInt(document.getElementById('tradeQuantity').value) || 0;
  const total = quantity * currentStock.price;
  document.getElementById('estimatedTotal').textContent = `$${total.toFixed(2)}`;
}

async function executeTrade(action) {
  if (!isLoggedIn) {
    showMessage('Please login to trade', 'error');
    return;
  }

  if (!currentStock) {
    showMessage('Please search for a stock first', 'error');
    return;
  }

  const quantity = parseInt(document.getElementById('tradeQuantity').value);

  if (!quantity || quantity <= 0) {
    showMessage('Please enter a valid quantity', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/trade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        symbol: currentStock.symbol,
        action: action,
        quantity: quantity
      })
    });

    const data = await response.json();

    if (response.ok) {
      showMessage(data.message, 'success');
      loadDashboard();
      loadPortfolio();
      // Clear the form
      document.getElementById('tradeQuantity').value = '';
      updateEstimatedTotal();
    } else {
      showMessage(data.error || 'Trade failed', 'error');
    }
  } catch (error) {
    showMessage('Network error. Please try again.', 'error');
    console.error('Trade error:', error);
  }
}

function sellStock(symbol) {
  document.getElementById('stockSymbol').value = symbol;
  searchStock().then(() => {
    document.getElementById('tradeAction').value = 'SELL'; // Assuming you have a tradeAction select element
    showSection('trading');
  });
}

// --- Watchlist Functions ---

async function loadWatchlist() {
  if (!isLoggedIn) {
    document.getElementById('watchlistTableBody').innerHTML = '<tr class="no-data"><td colspan="6">Please login to view your watchlist</td></tr>';
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/watchlist`, {
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      updateWatchlistTable(data.watchlist);
    } else {
      throw new Error('Failed to load watchlist');
    }
  } catch (error) {
    console.error('Error loading watchlist:', error);
    document.getElementById('watchlistTableBody').innerHTML = '<tr class="no-data"><td colspan="6">Error loading watchlist</td></tr>';
  }
}

function updateWatchlistTable(watchlist) {
  const tbody = document.getElementById('watchlistTableBody');

  if (watchlist.length === 0) {
    tbody.innerHTML = '<tr class="no-data"><td colspan="6">No stocks in watchlist</td></tr>';
    return;
  }

  tbody.innerHTML = watchlist.map(item => `
        <tr>
            <td><strong>${item.symbol}</strong></td>
            <td>$${item.price.toFixed(2)}</td>
            <td class="${item.change >= 0 ? 'positive' : 'negative'}">
                ${item.change >= 0 ? '+' : ''}$${item.change.toFixed(2)}
            </td>
            <td class="${item.changePercent >= 0 ? 'positive' : 'negative'}">
                ${item.changePercent >= 0 ? '+' : ''}${item.changePercent.toFixed(2)}%
            </td>
            <td>${item.volume.toLocaleString()}</td>
            <td>
                <button onclick="tradeFromWatchlist('${item.symbol}')" class="btn-primary" style="padding: 0.5rem; font-size: 0.8rem; margin-right: 0.5rem;">
                    <i class="fas fa-chart-line"></i> Trade
                </button>
                <button onclick="removeFromWatchlist('${item.symbol}')" class="btn-danger" style="padding: 0.5rem; font-size: 0.8rem;">
                    <i class="fas fa-times"></i> Remove
                </button>
            </td>
        </tr>
    `).join('');
}

async function addToWatchlist() {
  if (!isLoggedIn) {
    showMessage('Please login to add to watchlist', 'error');
    return;
  }

  const symbol = document.getElementById('watchlistSymbol').value.trim().toUpperCase();

  if (!symbol) {
    showMessage('Please enter a stock symbol', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/watchlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        symbol
      })
    });

    const data = await response.json();

    if (response.ok) {
      showMessage(data.message, 'success');
      document.getElementById('watchlistSymbol').value = '';
      loadWatchlist();
    } else {
      showMessage(data.error || 'Failed to add to watchlist', 'error');
    }
  } catch (error) {
    showMessage('Network error. Please try again.', 'error');
    console.error('Add to watchlist error:', error);
  }
}

async function removeFromWatchlist(symbol) {
  if (!isLoggedIn) {
    showMessage('Please login to modify watchlist', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/watchlist/${symbol}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    const data = await response.json();

    if (response.ok) {
      showMessage(data.message, 'success');
      loadWatchlist();
    } else {
      showMessage(data.error || 'Failed to remove from watchlist', 'error');
    }
  } catch (error) {
    showMessage('Network error. Please try again.', 'error');
    console.error('Remove from watchlist error:', error);
  }
}

function tradeFromWatchlist(symbol) {
  document.getElementById('stockSymbol').value = symbol;
  searchStock().then(() => {
    showSection('trading');
  });
}

// --- Trade History Functions ---

async function loadTradeHistory() {
  if (!isLoggedIn) {
    document.getElementById('historyTableBody').innerHTML = '<tr class="no-data"><td colspan="6">Please login to view your trade history</td></tr>';
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/history`, {
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      updateTradeHistoryTable(data.history);
    } else {
      throw new Error('Failed to load trade history');
    }
  } catch (error) {
    console.error('Error loading trade history:', error);
    document.getElementById('historyTableBody').innerHTML = '<tr class="no-data"><td colspan="6">Error loading trade history</td></tr>';
  }
}

function updateTradeHistoryTable(history) {
  const tbody = document.getElementById('historyTableBody');

  if (history.length === 0) {
    tbody.innerHTML = '<tr class="no-data"><td colspan="6">No trade history found</td></tr>';
    return;
  }

  tbody.innerHTML = history.map(trade => `
        <tr>
            <td>${new Date(trade.timestamp).toLocaleString()}</td>
            <td><strong>${trade.symbol}</strong></td>
            <td class="${trade.action === 'BUY' ? 'positive' : 'negative'}">${trade.action}</td>
            <td>${trade.quantity}</td>
            <td>$${trade.price.toFixed(2)}</td>
            <td>$${trade.total.toFixed(2)}</td>
        </tr>
    `).join('');
}

// --- Utility Functions ---

async function checkBackendConnection() {
  try {
    const response = await fetch(`${API_BASE}/health`, {
      method: 'GET',
      timeout: 5000
    });
    return response.ok;
  } catch (error) {
    console.warn('Backend connection not available. Running in demo mode.');
    return false;
  }
}

function showMessage(message, type) {
  // Remove any existing messages
  const existingMessage = document.getElementById('messageContainer');
  if (existingMessage) {
    existingMessage.remove();
  }

  // Create message container
  const messageContainer = document.createElement('div');
  messageContainer.id = 'messageContainer';
  messageContainer.className = `message ${type}`;

  // Set different styles based on type
  const styles = {
    success: 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;',
    error: 'background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;',
    info: 'background: #cce7ff; color: #004085; border: 1px solid #99d6ff;',
    warning: 'background: #fff3cd; color: #856404; border: 1px solid #ffeaa7;'
  };

  messageContainer.style.cssText = `
        ${styles[type] || styles.info}
        padding: 1rem;
        margin: 1rem 0;
        border-radius: 0.375rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: relative;
        z-index: 1000;
    `;

  messageContainer.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; color: inherit; font-size: 1.2rem; cursor: pointer; margin-left: 1rem;">&times;</button>
    `;

  // Add to top of main content or body
  const mainContent = document.querySelector('.main-content') || document.body;
  mainContent.insertBefore(messageContainer, mainContent.firstChild);

  // Auto-remove after 5 seconds for non-error messages
  if (type !== 'error') {
    setTimeout(() => {
      if (messageContainer.parentElement) {
        messageContainer.remove();
      }
    }, 5000);
  }
}

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount);
}

// Format percentage
function formatPercentage(value) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

// --- Periodic Data Refresh ---

setInterval(() => {
  loadMarketIndices();
  if (isLoggedIn) {
    loadDashboard();
    // Refresh current section data
    const activeSection = document.querySelector('.section.active');
    if (activeSection) {
      const sectionId = activeSection.id;
      switch (sectionId) {
        case 'portfolio':
          loadPortfolio();
          break;
        case 'watchlist':
          loadWatchlist();
          break;
      }
    }
  }
}, 60000); // Increased to 60 seconds to reduce server load

// --- Global Event Handlers / UI Enhancements ---

// Handle keyboard shortcuts
document.addEventListener('keydown', function(e) {
  // Escape key to close modals
  if (e.key === 'Escape') {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
      if (modal.style.display === 'block') {
        modal.style.display = 'none';
      }
    });
  }

  // Enter key to search stock when focused on stock symbol input
  if (e.key === 'Enter' && e.target.id === 'stockSymbol') {
    searchStock();
  }

  // Enter key to add to watchlist when focused on watchlist symbol input
  if (e.key === 'Enter' && e.target.id === 'watchlistSymbol') {
    addToWatchlist();
  }
});

// Handle network errors globally
window.addEventListener('unhandledrejection', function(e) {
  console.error('Unhandled promise rejection:', e.reason);
  if (e.reason.message && e.reason.message.includes('fetch')) {
    showMessage('Network error. Please check your connection.', 'error');
  }
});

// Initialize tooltips and other UI enhancements
function initializeUIEnhancements() {
  // Add loading states to buttons
  const buttons = document.querySelectorAll('button');
  buttons.forEach(button => {
    button.addEventListener('click', function() {
      if (this.type === 'submit' || this.onclick) {
        this.style.opacity = '0.7';
        setTimeout(() => {
          this.style.opacity = '1';
        }, 1000);
      }
    });
  });
}