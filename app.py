from flask import Flask, render_template, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import sqlite3
import hashlib
import secrets
import datetime
import yfinance as yf
import pandas as pd
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(16)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///tradewise.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
CORS(app)

# Database Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    balance = db.Column(db.Float, default=10000.0)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class Portfolio(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    symbol = db.Column(db.String(10), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    avg_price = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class Trade(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    symbol = db.Column(db.String(10), nullable=False)
    action = db.Column(db.String(4), nullable=False)  # BUY or SELL
    quantity = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Float, nullable=False)
    total = db.Column(db.Float, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class Watchlist(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    symbol = db.Column(db.String(10), nullable=False)
    added_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        
        if User.query.filter_by(username=username).first():
            return jsonify({'error': 'Username already exists'}), 400
        
        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'Email already exists'}), 400
        
        password_hash = generate_password_hash(password)
        user = User(username=username, email=email, password_hash=password_hash)
        db.session.add(user)
        db.session.commit()
        
        session['user_id'] = user.id
        return jsonify({'success': True, 'user_id': user.id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        user = User.query.filter_by(username=username).first()
        if user and check_password_hash(user.password_hash, password):
            session['user_id'] = user.id
            return jsonify({'success': True, 'user_id': user.id}), 200
        
        return jsonify({'error': 'Invalid credentials'}), 401
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    return jsonify({'success': True}), 200

@app.route('/api/stock/<symbol>')
def get_stock_data(symbol):
    try:
        stock = yf.Ticker(symbol.upper())
        info = stock.info
        hist = stock.history(period="1d", interval="1m")
        
        current_price = info.get('currentPrice', 0)
        if current_price == 0 and not hist.empty:
            current_price = hist['Close'].iloc[-1]
        
        return jsonify({
            'symbol': symbol.upper(),
            'price': round(current_price, 2),
            'change': round(info.get('regularMarketChange', 0), 2),
            'changePercent': round(info.get('regularMarketChangePercent', 0), 2),
            'volume': info.get('volume', 0),
            'marketCap': info.get('marketCap', 0),
            'dayHigh': round(info.get('dayHigh', 0), 2),
            'dayLow': round(info.get('dayLow', 0), 2)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/portfolio')
def get_portfolio():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        user_id = session['user_id']
        portfolio = Portfolio.query.filter_by(user_id=user_id).all()
        
        portfolio_data = []
        total_value = 0
        
        for item in portfolio:
            try:
                stock = yf.Ticker(item.symbol)
                current_price = stock.info.get('currentPrice', item.avg_price)
                value = current_price * item.quantity
                total_value += value
                
                portfolio_data.append({
                    'symbol': item.symbol,
                    'quantity': item.quantity,
                    'avgPrice': item.avg_price,
                    'currentPrice': current_price,
                    'value': round(value, 2),
                    'pnl': round((current_price - item.avg_price) * item.quantity, 2)
                })
            except:
                value = item.avg_price * item.quantity
                total_value += value
                portfolio_data.append({
                    'symbol': item.symbol,
                    'quantity': item.quantity,
                    'avgPrice': item.avg_price,
                    'currentPrice': item.avg_price,
                    'value': round(value, 2),
                    'pnl': 0
                })
        
        user = User.query.get(user_id)
        return jsonify({
            'portfolio': portfolio_data,
            'totalValue': round(total_value, 2),
            'cash': round(user.balance, 2)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/trade', methods=['POST'])
def execute_trade():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        data = request.get_json()
        user_id = session['user_id']
        symbol = data.get('symbol').upper()
        action = data.get('action').upper()
        quantity = int(data.get('quantity'))
        
        # Get current stock price
        stock = yf.Ticker(symbol)
        current_price = stock.info.get('currentPrice', 0)
        if current_price == 0:
            return jsonify({'error': 'Unable to get stock price'}), 400
        
        total_cost = current_price * quantity
        user = User.query.get(user_id)
        
        if action == 'BUY':
            if user.balance < total_cost:
                return jsonify({'error': 'Insufficient funds'}), 400
            
            # Update user balance
            user.balance -= total_cost
            
            # Update portfolio
            existing = Portfolio.query.filter_by(user_id=user_id, symbol=symbol).first()
            if existing:
                total_quantity = existing.quantity + quantity
                total_cost_basis = (existing.avg_price * existing.quantity) + (current_price * quantity)
                existing.avg_price = total_cost_basis / total_quantity
                existing.quantity = total_quantity
            else:
                portfolio_item = Portfolio(
                    user_id=user_id,
                    symbol=symbol,
                    quantity=quantity,
                    avg_price=current_price
                )
                db.session.add(portfolio_item)
        
        elif action == 'SELL':
            existing = Portfolio.query.filter_by(user_id=user_id, symbol=symbol).first()
            if not existing or existing.quantity < quantity:
                return jsonify({'error': 'Insufficient shares'}), 400
            
            # Update user balance
            user.balance += total_cost
            
            # Update portfolio
            existing.quantity -= quantity
            if existing.quantity == 0:
                db.session.delete(existing)
        
        # Record trade
        trade = Trade(
            user_id=user_id,
            symbol=symbol,
            action=action,
            quantity=quantity,
            price=current_price,
            total=total_cost
        )
        db.session.add(trade)
        db.session.commit()
        
        return jsonify({'success': True, 'message': f'{action} order executed successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/watchlist')
def get_watchlist():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        user_id = session['user_id']
        watchlist = Watchlist.query.filter_by(user_id=user_id).all()
        
        watchlist_data = []
        for item in watchlist:
            try:
                stock = yf.Ticker(item.symbol)
                info = stock.info
                current_price = info.get('currentPrice', 0)
                
                watchlist_data.append({
                    'symbol': item.symbol,
                    'price': round(current_price, 2),
                    'change': round(info.get('regularMarketChange', 0), 2),
                    'changePercent': round(info.get('regularMarketChangePercent', 0), 2)
                })
            except:
                watchlist_data.append({
                    'symbol': item.symbol,
                    'price': 0,
                    'change': 0,
                    'changePercent': 0
                })
        
        return jsonify(watchlist_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/watchlist/add', methods=['POST'])
def add_to_watchlist():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        data = request.get_json()
        user_id = session['user_id']
        symbol = data.get('symbol').upper()
        
        existing = Watchlist.query.filter_by(user_id=user_id, symbol=symbol).first()
        if existing:
            return jsonify({'error': 'Stock already in watchlist'}), 400
        
        watchlist_item = Watchlist(user_id=user_id, symbol=symbol)
        db.session.add(watchlist_item)
        db.session.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/trades')
def get_trades():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        user_id = session['user_id']
        trades = Trade.query.filter_by(user_id=user_id).order_by(Trade.timestamp.desc()).limit(50).all()
        
        trades_data = []
        for trade in trades:
            trades_data.append({
                'symbol': trade.symbol,
                'action': trade.action,
                'quantity': trade.quantity,
                'price': trade.price,
                'total': trade.total,
                'timestamp': trade.timestamp.strftime('%Y-%m-%d %H:%M:%S')
            })
        
        return jsonify(trades_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/health', methods=['GET'])
def health_check():
    return {"status": "ok"}, 200

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=5000)
