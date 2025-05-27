#!/usr/bin/env python3
"""
TradeJoy - Voice-First AI Business Companion
Flask backend server for lightweight storefront management
"""

from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime, timedelta
import sqlite3
import json
import os
import logging
from typing import Dict, List, Optional
import re
from dataclasses import dataclass, asdict

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configuration
DATABASE_PATH = 'tradejoy.db'
UPLOAD_FOLDER = 'uploads'
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file upload

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@dataclass
class Transaction:
    """Transaction data model"""
    id: Optional[int] = None
    user_id: str = "demo_user"
    type: str = ""  # 'sale' or 'expense'
    amount: float = 0.0
    description: str = ""
    category: str = ""
    timestamp: str = ""
    date: str = ""

@dataclass
class BusinessStats:
    """Business statistics model"""
    today_profit: float = 0.0
    total_sales: float = 0.0
    total_expenses: float = 0.0
    net_profit: float = 0.0
    total_transactions: int = 0

class DatabaseManager:
    """Handles all database operations"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize database tables"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create transactions table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS transactions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id TEXT NOT NULL,
                        type TEXT NOT NULL,
                        amount REAL NOT NULL,
                        description TEXT NOT NULL,
                        category TEXT NOT NULL,
                        timestamp TEXT NOT NULL,
                        date TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Create milestones table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS milestones (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id TEXT NOT NULL,
                        milestone_type TEXT NOT NULL,
                        achieved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(user_id, milestone_type)
                    )
                ''')
                
                # Create business_profiles table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS business_profiles (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id TEXT UNIQUE NOT NULL,
                        business_name TEXT,
                        business_type TEXT,
                        daily_target REAL DEFAULT 500.0,
                        weekly_target REAL DEFAULT 3500.0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                conn.commit()
                logger.info("Database initialized successfully")
                
        except Exception as e:
            logger.error(f"Database initialization error: {e}")
            raise
    
    def add_transaction(self, transaction: Transaction) -> int:
        """Add a new transaction"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO transactions 
                    (user_id, type, amount, description, category, timestamp, date)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    transaction.user_id,
                    transaction.type,
                    transaction.amount,
                    transaction.description,
                    transaction.category,
                    transaction.timestamp,
                    transaction.date
                ))
                
                transaction_id = cursor.lastrowid
                conn.commit()
                logger.info(f"Transaction added: ID {transaction_id}")
                return transaction_id
                
        except Exception as e:
            logger.error(f"Error adding transaction: {e}")
            raise
    
    def get_transactions(self, user_id: str, limit: int = 50) -> List[Dict]:
        """Get user transactions"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT id, type, amount, description, category, timestamp, date
                    FROM transactions 
                    WHERE user_id = ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                ''', (user_id, limit))
                
                columns = ['id', 'type', 'amount', 'description', 'category', 'timestamp', 'date']
                transactions = [dict(zip(columns, row)) for row in cursor.fetchall()]
                
                return transactions
                
        except Exception as e:
            logger.error(f"Error fetching transactions: {e}")
            return []
    
    def delete_transaction(self, transaction_id: int, user_id: str) -> bool:
        """Delete a transaction"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    DELETE FROM transactions 
                    WHERE id = ? AND user_id = ?
                ''', (transaction_id, user_id))
                
                deleted = cursor.rowcount > 0
                conn.commit()
                logger.info(f"Transaction {transaction_id} deleted: {deleted}")
                return deleted
                
        except Exception as e:
            logger.error(f"Error deleting transaction: {e}")
            return False
    
    def get_business_stats(self, user_id: str) -> BusinessStats:
        """Calculate business statistics"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Get today's date
                today = datetime.now().strftime('%Y-%m-%d')
                
                # Total sales
                cursor.execute('''
                    SELECT COALESCE(SUM(amount), 0) FROM transactions
                    WHERE user_id = ? AND type = 'sale'
                ''', (user_id,))
                total_sales = cursor.fetchone()[0]
                
                # Total expenses
                cursor.execute('''
                    SELECT COALESCE(SUM(amount), 0) FROM transactions
                    WHERE user_id = ? AND type = 'expense'
                ''', (user_id,))
                total_expenses = cursor.fetchone()[0]
                
                # Today's sales
                cursor.execute('''
                    SELECT COALESCE(SUM(amount), 0) FROM transactions
                    WHERE user_id = ? AND type = 'sale' AND date = ?
                ''', (user_id, today))
                today_sales = cursor.fetchone()[0]
                
                # Today's expenses
                cursor.execute('''
                    SELECT COALESCE(SUM(amount), 0) FROM transactions
                    WHERE user_id = ? AND type = 'expense' AND date = ?
                ''', (user_id, today))
                today_expenses = cursor.fetchone()[0]
                
                # Total transactions count
                cursor.execute('''
                    SELECT COUNT(*) FROM transactions WHERE user_id = ?
                ''', (user_id,))
                total_transactions = cursor.fetchone()[0]
                
                return BusinessStats(
                    today_profit=today_sales - today_expenses,
                    total_sales=total_sales,
                    total_expenses=total_expenses,
                    net_profit=total_sales - total_expenses,
                    total_transactions=total_transactions
                )
                
        except Exception as e:
            logger.error(f"Error calculating stats: {e}")
            return BusinessStats()
    
    def get_business_profile(self, user_id: str) -> Optional[Dict]:
        """Get business profile"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT business_name, business_type, daily_target, weekly_target
                    FROM business_profiles WHERE user_id = ?
                ''', (user_id,))
                
                row = cursor.fetchone()
                if row:
                    return {
                        'business_name': row[0],
                        'business_type': row[1],
                        'daily_target': row[2],
                        'weekly_target': row[3]
                    }
                return None
                
        except Exception as e:
            logger.error(f"Error fetching business profile: {e}")
            return None
    
    def update_business_profile(self, user_id: str, profile_data: Dict) -> bool:
        """Update or create business profile"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT OR REPLACE INTO business_profiles 
                    (user_id, business_name, business_type, daily_target, weekly_target, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    user_id,
                    profile_data.get('business_name'),
                    profile_data.get('business_type'),
                    profile_data.get('daily_target', 500.0),
                    profile_data.get('weekly_target', 3500.0),
                    datetime.now().isoformat()
                ))
                
                conn.commit()
                logger.info(f"Business profile updated for user: {user_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error updating business profile: {e}")
            return False

class VoiceProcessor:
    """Processes voice commands and extracts transaction data"""
    
    @staticmethod
    def process_voice_command(command: str) -> Optional[Transaction]:
        """Process voice command and extract transaction details"""
        command_lower = command.lower()
        
        # Extract amounts (supports various formats)
        amount_patterns = [
            r'(\d+(?:\.\d{2})?)\s*(?:rupees?|rs?\.?|₹)',
            r'(?:rupees?|rs?\.?|₹)\s*(\d+(?:\.\d{2})?)',
            r'(\d+(?:\.\d{2})?)\s*(?:dollars?|\$)',
            r'for\s*(\d+(?:\.\d{2})?)',
            r'(\d+(?:\.\d{2})?)\s*(?:bucks?)'
        ]
        
        amount = None
        for pattern in amount_patterns:
            match = re.search(pattern, command_lower)
            if match:
                amount = float(match.group(1))
                break
        
        if not amount:
            return None
        
        # Determine transaction type
        sale_keywords = ['sold', 'sale', 'earned', 'received', 'got', 'made']
        expense_keywords = ['bought', 'spent', 'paid', 'purchased', 'expense', 'cost']
        
        transaction_type = None
        if any(keyword in command_lower for keyword in sale_keywords):
            transaction_type = 'sale'
        elif any(keyword in command_lower for keyword in expense_keywords):
            transaction_type = 'expense'
        
        if not transaction_type:
            return None
        
        # Extract description
        description = VoiceProcessor._extract_description(command, transaction_type)
        
        # Determine category
        category = VoiceProcessor._categorize_transaction(command, transaction_type)
        
        return Transaction(
            type=transaction_type,
            amount=amount,
            description=description,
            category=category,
            timestamp=datetime.now().isoformat(),
            date=datetime.now().strftime('%Y-%m-%d')
        )
    
    @staticmethod
    def _extract_description(command: str, transaction_type: str) -> str:
        """Extract description from voice command"""
        command_lower = command.lower()
        
        if transaction_type == 'sale':
            # Look for items sold
            patterns = [
                r'sold\s+(.+?)\s+for',
                r'sale\s+of\s+(.+?)\s+for',
                r'earned\s+from\s+(.+?)\s+',
            ]
        else:
            # Look for items bought
            patterns = [
                r'bought\s+(.+?)\s+for',
                r'spent\s+on\s+(.+?)\s+',
                r'paid\s+for\s+(.+?)\s+',
            ]
        
        for pattern in patterns:
            match = re.search(pattern, command_lower)
            if match:
                return match.group(1).strip().title()
        
        # Fallback descriptions
        return f"Voice recorded {transaction_type}"
    
    @staticmethod
    def _categorize_transaction(command: str, transaction_type: str) -> str:
        """Categorize transaction based on content"""
        command_lower = command.lower()
        
        # Category keywords
        categories = {
            'product-sale': ['vegetables', 'fruits', 'food', 'products', 'items', 'goods'],
            'service': ['service', 'repair', 'consultation', 'work'],
            'supplies': ['supplies', 'materials', 'inventory', 'stock'],
            'transport': ['transport', 'taxi', 'bus', 'fuel', 'petrol', 'gas'],
            'food': ['food', 'lunch', 'dinner', 'snacks', 'tea', 'coffee'],
            'utilities': ['electricity', 'water', 'phone', 'internet', 'rent']
        }
        
        for category, keywords in categories.items():
            if any(keyword in command_lower for keyword in keywords):
                return category
        
        # Default categories
        return 'product-sale' if transaction_type == 'sale' else 'supplies'

class BusinessCoach:
    """AI Business Coach for providing tips and insights"""
    
    @staticmethod
    def get_personalized_tip(stats: BusinessStats, recent_transactions: List[Dict]) -> str:
        """Generate personalized business tip"""
        
        if stats.total_transactions == 0:
            return "Welcome! Start by recording your first sale or expense to begin tracking your business."
        
        if stats.today_profit > 500:
            return f"Excellent! You're ₹{stats.today_profit:.2f} in profit today. You're exceeding your daily target!"
        
        if stats.today_profit > 0:
            return f"Good work! You're ₹{stats.today_profit:.2f} in profit today. Keep it up!"
        
        if stats.net_profit > 0:
            return f"Overall, you're ₹{stats.net_profit:.2f} in profit. Focus on increasing daily sales!"
        
        tips = [
            "Track every small transaction - they add up quickly!",
            "Try using voice commands for faster data entry.",
            "Set a daily target to stay motivated.",
            "Review your expenses weekly to find savings.",
            "Celebrate small wins to stay motivated!"
        ]
        
        import random
        return random.choice(tips)

# Initialize database
db_manager = DatabaseManager(DATABASE_PATH)

# Routes
@app.route('/')
def index():
    """Serve the main application"""
    return render_template('index.html')

@app.route('/styles.css')
def styles():
    """Serve CSS file"""
    return send_from_directory('.', 'styles.css')

@app.route('/scripts.js')
def script():
    """Serve JavaScript file"""
    return send_from_directory('.', 'scripts.js')

@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    """Get user transactions"""
    user_id = request.args.get('user_id', 'demo_user')
    limit = int(request.args.get('limit', 50))
    
    try:
        transactions = db_manager.get_transactions(user_id, limit)
        return jsonify({
            'success': True,
            'transactions': transactions
        })
    except Exception as e:
        logger.error(f"Error fetching transactions: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch transactions'
        }), 500

@app.route('/api/transactions', methods=['POST'])
def add_transaction():
    """Add new transaction"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['type', 'amount', 'description', 'category']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }), 400
        
        # Create transaction
        transaction = Transaction(
            user_id=data.get('user_id', 'demo_user'),
            type=data['type'],
            amount=float(data['amount']),
            description=data['description'],
            category=data['category'],
            timestamp=datetime.now().isoformat(),
            date=datetime.now().strftime('%Y-%m-%d')
        )
        
        # Add to database
        transaction_id = db_manager.add_transaction(transaction)
        
        return jsonify({
            'success': True,
            'transaction_id': transaction_id,
            'message': 'Transaction added successfully'
        })
        
    except Exception as e:
        logger.error(f"Error adding transaction: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to add transaction'
        }), 500

@app.route('/api/transactions/<int:transaction_id>', methods=['DELETE'])
def delete_transaction(transaction_id):
    """Delete transaction"""
    user_id = request.args.get('user_id', 'demo_user')
    
    try:
        success = db_manager.delete_transaction(transaction_id, user_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Transaction deleted successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Transaction not found'
            }), 404
            
    except Exception as e:
        logger.error(f"Error deleting transaction: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to delete transaction'
        }), 500

@app.route('/api/voice-command', methods=['POST'])
def process_voice_command():
    """Process voice command and extract transaction"""
    try:
        data = request.get_json()
        command = data.get('command', '')
        
        if not command:
            return jsonify({
                'success': False,
                'error': 'No voice command provided'
            }), 400
        
        # Process voice command
        transaction = VoiceProcessor.process_voice_command(command)
        
        if not transaction:
            return jsonify({
                'success': False,
                'error': 'Could not extract transaction from voice command',
                'suggestions': [
                    'Try: "I sold apples for 50 rupees"',
                    'Try: "Bought supplies for ₹200"',
                    'Try: "Made 300 from service"'
                ]
            })
        
        # Set user ID
        transaction.user_id = data.get('user_id', 'demo_user')
        
        # Add to database
        transaction_id = db_manager.add_transaction(transaction)
        transaction.id = transaction_id
        
        return jsonify({
            'success': True,
            'transaction': asdict(transaction),
            'message': 'Transaction extracted and added successfully'
        })
        
    except Exception as e:
        logger.error(f"Error processing voice command: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to process voice command'
        }), 500

@app.route('/api/stats', methods=['GET'])
def get_business_stats():
    """Get business statistics"""
    user_id = request.args.get('user_id', 'demo_user')
    
    try:
        stats = db_manager.get_business_stats(user_id)
        return jsonify({
            'success': True,
            'stats': asdict(stats)
        })
    except Exception as e:
        logger.error(f"Error fetching stats: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch statistics'
        }), 500

@app.route('/api/coach-tip', methods=['GET'])
def get_coach_tip():
    """Get personalized business coaching tip"""
    user_id = request.args.get('user_id', 'demo_user')
    
    try:
        stats = db_manager.get_business_stats(user_id)
        recent_transactions = db_manager.get_transactions(user_id, 10)
        tip = BusinessCoach.get_personalized_tip(stats, recent_transactions)
        
        return jsonify({
            'success': True,
            'tip': tip,
            'stats': asdict(stats)
        })
    except Exception as e:
        logger.error(f"Error generating tip: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to generate tip'
        }), 500

@app.route('/api/profile', methods=['GET'])
def get_business_profile():
    """Get business profile"""
    user_id = request.args.get('user_id', 'demo_user')
    
    try:
        profile = db_manager.get_business_profile(user_id)
        return jsonify({
            'success': True,
            'profile': profile
        })
    except Exception as e:
        logger.error(f"Error fetching profile: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch profile'
        }), 500

@app.route('/api/profile', methods=['POST'])
def update_business_profile():
    """Update business profile"""
    try:
        data = request.get_json()
        user_id = data.get('user_id', 'demo_user')
        
        success = db_manager.update_business_profile(user_id, data)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Profile updated successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to update profile'
            }), 500
            
    except Exception as e:
        logger.error(f"Error updating profile: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to update profile'
        }), 500

@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    """Get business analytics data"""
    user_id = request.args.get('user_id', 'demo_user')
    days = int(request.args.get('days', 7))
    
    try:
        with sqlite3.connect(DATABASE_PATH) as conn:
            cursor = conn.cursor()
            
            # Get daily data for the last N days
            start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
            
            cursor.execute('''
                SELECT date, 
                       SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END) as sales,
                       SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
                FROM transactions 
                WHERE user_id = ? AND date >= ?
                GROUP BY date
                ORDER BY date
            ''', (user_id, start_date))
            
            daily_data = []
            for row in cursor.fetchall():
                daily_data.append({
                    'date': row[0],
                    'sales': row[1],
                    'expenses': row[2],
                    'profit': row[1] - row[2]
                })
            
            # Get category breakdown
            cursor.execute('''
                SELECT category, SUM(amount) as total
                FROM transactions 
                WHERE user_id = ? AND type = 'sale'
                GROUP BY category
                ORDER BY total DESC
            ''', (user_id,))
            
            category_data = [{'category': row[0], 'amount': row[1]} for row in cursor.fetchall()]
            
            return jsonify({
                'success': True,
                'analytics': {
                    'daily_data': daily_data,
                    'category_breakdown': category_data
                }
            })
            
    except Exception as e:
        logger.error(f"Error fetching analytics: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch analytics'
        }), 500

@app.errorhandler(404)
def not_found(error):
    # If the requested URL is for a static file, let Flask try to serve it normally
    if request.path.startswith('/static/'):
        # Try to serve the static file manually or return the default 404
        filename = request.path[len('/static/'):]
        return send_from_directory('static', filename)

    return jsonify({
        'success': False,
        'error': 'Endpoint not found'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return jsonify({
        'success': False,
        'error': 'Internal server error'
    }), 500


@app.route('/routes')
def list_routes():
    routes = []
    for rule in app.url_map.iter_rules():
        routes.append({
            'endpoint': rule.endpoint,
            'methods': list(rule.methods),
            'url': str(rule)
        })
    return jsonify(routes)


if __name__ == '__main__':
    # Create demo data if database is empty
    try:
        stats = db_manager.get_business_stats('demo_user')
        if stats.total_transactions == 0:
            logger.info("Creating demo data...")
            
            # Add some demo transactions
            demo_transactions = [
                Transaction(
                    user_id='demo_user',
                    type='sale',
                    amount=150.0,
                    description='Vegetables Sale',
                    category='product-sale',
                    timestamp=(datetime.now() - timedelta(hours=2)).isoformat(),
                    date=datetime.now().strftime('%Y-%m-%d')
                ),
                Transaction(
                    user_id='demo_user',
                    type='expense',
                    amount=50.0,
                    description='Transport Cost',
                    category='transport',
                    timestamp=(datetime.now() - timedelta(hours=3)).isoformat(),
                    date=datetime.now().strftime('%Y-%m-%d')
                ),
                Transaction(
                    user_id='demo_user',
                    type='sale',
                    amount=200.0,
                    description='Service Charge',
                    category='service',
                    timestamp=(datetime.now() - timedelta(hours=4)).isoformat(),
                    date=datetime.now().strftime('%Y-%m-%d')
                )
            ]
            
            for transaction in demo_transactions:
                db_manager.add_transaction(transaction)
            
            logger.info("Demo data created successfully")
    
    except Exception as e:
        logger.error(f"Error creating demo data: {e}")
    
    # Run the application
    app.run(debug=True, host='0.0.0.0', port=5000)