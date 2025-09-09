# Tom King Trading Framework v17 - Greeks Calculation Engine
# Comprehensive Greeks monitoring and portfolio balance system
# Target: Real-time Delta/Gamma/Theta/Vega tracking with risk alerts

from AlgorithmImports import *
from datetime import datetime, timedelta
import numpy as np
from scipy.stats import norm
from math import log, sqrt, exp

class GreeksEngine:
    """Advanced Greeks calculation and monitoring system for Tom King Framework"""
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.portfolio_greeks = {
            'total_delta': 0.0,
            'total_gamma': 0.0, 
            'total_theta': 0.0,
            'total_vega': 0.0
        }
        self.position_greeks = {}
        self.greek_targets = {
            'delta_neutral_range': (-50, 50),  # Target delta neutral range
            'max_gamma_per_position': 100,     # Maximum gamma per position
            'min_theta_daily': 50,             # Minimum daily theta income target
            'max_vega_exposure': 1000          # Maximum portfolio vega
        }
        self.risk_alerts = []
        self.greeks_history = []
        self.last_update_time = None
        
    def UpdateGreeks(self):
        """Calculate and update Greeks for all positions"""
        self.portfolio_greeks = {'total_delta': 0.0, 'total_gamma': 0.0, 'total_theta': 0.0, 'total_vega': 0.0}
        self.position_greeks = {}
        self.risk_alerts = []
        
        for kvp in self.algo.Portfolio:
            symbol = kvp.Key
            holding = kvp.Value
            
            if holding.Quantity == 0:
                continue
                
            # Calculate Greeks for this position
            position_greeks = self.CalculatePositionGreeks(symbol, holding)
            if position_greeks:
                self.position_greeks[str(symbol)] = position_greeks
                
                # Add to portfolio totals
                self.portfolio_greeks['total_delta'] += position_greeks['delta']
                self.portfolio_greeks['total_gamma'] += position_greeks['gamma']
                self.portfolio_greeks['total_theta'] += position_greeks['theta']
                self.portfolio_greeks['total_vega'] += position_greeks['vega']
                
        # Check for risk alerts
        self.CheckGreeksRiskLevels()
        
        # Store historical data
        self.StoreGreeksHistory()
        
        self.last_update_time = self.algo.Time
        
    def CalculatePositionGreeks(self, symbol, holding):
        """Calculate Greeks for individual position using Black-Scholes"""
        try:
            security = self.algo.Securities[symbol]
            
            # Handle different security types
            if security.Type == SecurityType.Option:
                return self.CalculateOptionGreeks(symbol, holding, security)
            elif security.Type == SecurityType.Future:
                return self.CalculateFutureGreeks(symbol, holding, security)
            else:
                # Equity positions have simpler Greeks
                return self.CalculateEquityGreeks(symbol, holding, security)
                
        except Exception as e:
            self.algo.Debug(f"Greeks calculation error for {symbol}: {e}")
            return None
            
    def CalculateOptionGreeks(self, symbol, holding, security):
        """Calculate full option Greeks using Black-Scholes model"""
        try:
            option = security
            underlying_price = self.GetUnderlyingPrice(symbol)
            
            if underlying_price <= 0:
                return None
                
            # Option parameters
            strike = float(option.StrikePrice)
            time_to_expiry = self.GetTimeToExpiry(option.Expiry)
            
            if time_to_expiry <= 0:
                # Handle expired options
                return {
                    'delta': 0.0, 'gamma': 0.0, 'theta': 0.0, 'vega': 0.0,
                    'expired': True, 'underlying_price': underlying_price, 'strike': strike
                }
                
            # Risk-free rate (approximate)
            risk_free_rate = 0.05
            
            # Get implied volatility or estimate
            implied_vol = self.GetImpliedVolatility(symbol, underlying_price, strike, time_to_expiry)
            
            if implied_vol <= 0:
                implied_vol = 0.20  # Fallback volatility
            
            # Black-Scholes calculations
            d1 = (log(underlying_price / strike) + (risk_free_rate + 0.5 * implied_vol**2) * time_to_expiry) / (implied_vol * sqrt(time_to_expiry))
            d2 = d1 - implied_vol * sqrt(time_to_expiry)
            
            # Calculate Greeks
            if option.Right == OptionRight.Call:
                delta = norm.cdf(d1)
                theta = -(underlying_price * norm.pdf(d1) * implied_vol) / (2 * sqrt(time_to_expiry)) - risk_free_rate * strike * exp(-risk_free_rate * time_to_expiry) * norm.cdf(d2)
            else:  # Put
                delta = -norm.cdf(-d1)
                theta = -(underlying_price * norm.pdf(d1) * implied_vol) / (2 * sqrt(time_to_expiry)) + risk_free_rate * strike * exp(-risk_free_rate * time_to_expiry) * norm.cdf(-d2)
                
            gamma = norm.pdf(d1) / (underlying_price * implied_vol * sqrt(time_to_expiry))
            vega = underlying_price * norm.pdf(d1) * sqrt(time_to_expiry) * 0.01  # Per 1% vol change
            
            # Scale by position size (100 shares per option contract)
            quantity = float(holding.Quantity)
            
            return {
                'delta': delta * quantity * 100,  # Per contract (100 shares)
                'gamma': gamma * quantity * 100,
                'theta': theta * quantity / 365,  # Daily theta
                'vega': vega * quantity,
                'implied_vol': implied_vol,
                'time_to_expiry': time_to_expiry,
                'underlying_price': underlying_price,
                'strike': strike,
                'option_type': 'Call' if option.Right == OptionRight.Call else 'Put',
                'expired': False
            }
            
        except Exception as e:
            self.algo.Debug(f"Option Greeks calculation error for {symbol}: {e}")
            return None
            
    def CalculateFutureGreeks(self, symbol, holding, security):
        """Calculate futures Greeks (simplified - mainly delta and gamma)"""
        try:
            # Futures have delta of approximately 1.0 per contract
            quantity = float(holding.Quantity)
            price = float(security.Price)
            
            # Contract multiplier varies by future type
            multiplier = self.GetFutureMultiplier(symbol)
            
            return {
                'delta': quantity * multiplier,  # Full delta exposure
                'gamma': 0.0,  # Futures have no gamma
                'theta': 0.0,  # No time decay
                'vega': 0.0,   # No vol exposure
                'price': price,
                'multiplier': multiplier,
                'type': 'Future'
            }
            
        except Exception as e:
            self.algo.Debug(f"Future Greeks calculation error for {symbol}: {e}")
            return None
            
    def CalculateEquityGreeks(self, symbol, holding, security):
        """Calculate equity Greeks (simple - mainly delta)"""
        try:
            quantity = float(holding.Quantity)
            price = float(security.Price)
            
            return {
                'delta': quantity,  # 1 delta per share
                'gamma': 0.0,
                'theta': 0.0,
                'vega': 0.0,
                'price': price,
                'type': 'Equity'
            }
            
        except Exception as e:
            self.algo.Debug(f"Equity Greeks calculation error for {symbol}: {e}")
            return None
            
    def GetUnderlyingPrice(self, option_symbol):
        """Get underlying price for option symbol"""
        try:
            underlying_symbol = option_symbol.Underlying
            if underlying_symbol in self.algo.Securities:
                return float(self.algo.Securities[underlying_symbol].Price)
            return 0.0
        except:
            return 0.0
            
    def GetTimeToExpiry(self, expiry_date):
        """Calculate time to expiry in years"""
        try:
            current_time = self.algo.Time
            time_diff = expiry_date - current_time
            years = time_diff.total_seconds() / (365 * 24 * 3600)
            return max(0, years)  # Ensure non-negative
        except:
            return 0.0
            
    def GetImpliedVolatility(self, symbol, underlying_price, strike, time_to_expiry):
        """Get or estimate implied volatility"""
        try:
            # Try to get from QuantConnect if available
            if hasattr(self.algo.Securities[symbol], 'ImpliedVolatility'):
                iv = self.algo.Securities[symbol].ImpliedVolatility
                if iv > 0:
                    return iv
                    
            # Fallback: estimate based on VIX or historical volatility
            vix_symbol = self.algo.AddIndex("VIX", Resolution.Minute).Symbol
            if vix_symbol in self.algo.Securities:
                vix_value = float(self.algo.Securities[vix_symbol].Price)
                return vix_value / 100.0  # Convert VIX to decimal
                
            # Final fallback based on moneyness
            moneyness = underlying_price / strike
            if 0.9 <= moneyness <= 1.1:  # ATM
                return 0.25
            elif moneyness < 0.9:  # ITM puts, OTM calls
                return 0.30
            else:  # OTM puts, ITM calls
                return 0.35
                
        except:
            return 0.20  # Default volatility
            
    def GetFutureMultiplier(self, symbol):
        """Get contract multiplier for futures"""
        symbol_str = str(symbol).upper()
        
        # Common futures multipliers
        multipliers = {
            'ES': 50,     # E-mini S&P 500
            'MES': 5,     # Micro E-mini S&P 500
            'NQ': 20,     # E-mini NASDAQ
            'MNQ': 2,     # Micro E-mini NASDAQ
            'CL': 1000,   # Crude Oil
            'MCL': 100,   # Micro Crude Oil
            'GC': 100,    # Gold
            'MGC': 10,    # Micro Gold
            'SI': 5000,   # Silver
            '6E': 125000, # Euro
            'M6E': 12500, # Micro Euro
            '6A': 100000, # Australian Dollar
            'ZB': 1000,   # 30-Year Treasury Bond
            'RTY': 50     # Russell 2000
        }
        
        for code, mult in multipliers.items():
            if code in symbol_str:
                return mult
                
        return 1  # Default multiplier
        
    def CheckGreeksRiskLevels(self):
        """Check Greeks against risk limits and generate alerts"""
        # Check portfolio delta neutrality
        total_delta = self.portfolio_greeks['total_delta']
        delta_range = self.greek_targets['delta_neutral_range']
        
        if total_delta < delta_range[0] or total_delta > delta_range[1]:
            self.risk_alerts.append({
                'type': 'DELTA_IMBALANCE',
                'severity': 'HIGH',
                'message': f'Portfolio delta {total_delta:.1f} outside neutral range {delta_range}',
                'action_required': 'Consider delta hedging',
                'timestamp': self.algo.Time
            })
            
        # Check individual position gamma
        for symbol, greeks in self.position_greeks.items():
            if abs(greeks['gamma']) > self.greek_targets['max_gamma_per_position']:
                self.risk_alerts.append({
                    'type': 'HIGH_GAMMA',
                    'severity': 'MEDIUM',
                    'symbol': symbol,
                    'message': f'Position {symbol} gamma {greeks["gamma"]:.1f} exceeds limit',
                    'action_required': 'Monitor position closely - high gamma risk',
                    'timestamp': self.algo.Time
                })
                
        # Check daily theta income
        total_theta = self.portfolio_greeks['total_theta']
        if total_theta < self.greek_targets['min_theta_daily']:
            self.risk_alerts.append({
                'type': 'LOW_THETA',
                'severity': 'LOW',
                'message': f'Daily theta income ${total_theta:.2f} below target',
                'action_required': 'Consider additional theta-generating positions',
                'timestamp': self.algo.Time
            })
            
        # Check vega exposure
        total_vega = abs(self.portfolio_greeks['total_vega'])
        if total_vega > self.greek_targets['max_vega_exposure']:
            self.risk_alerts.append({
                'type': 'HIGH_VEGA',
                'severity': 'HIGH',
                'message': f'Portfolio vega exposure {total_vega:.1f} exceeds limit',
                'action_required': 'Consider volatility hedging or position reduction',
                'timestamp': self.algo.Time
            })
            
        # Check for concentrated gamma risk
        gamma_by_expiry = {}
        for symbol, greeks in self.position_greeks.items():
            if 'time_to_expiry' in greeks:
                dte = int(greeks['time_to_expiry'] * 365)
                if dte not in gamma_by_expiry:
                    gamma_by_expiry[dte] = 0
                gamma_by_expiry[dte] += abs(greeks['gamma'])
                
        for dte, gamma_total in gamma_by_expiry.items():
            if dte <= 7 and gamma_total > 200:  # High gamma risk near expiration
                self.risk_alerts.append({
                    'type': 'CONCENTRATED_GAMMA',
                    'severity': 'HIGH',
                    'message': f'High gamma concentration ({gamma_total:.0f}) with {dte} DTE',
                    'action_required': 'Consider reducing gamma exposure before expiration',
                    'timestamp': self.algo.Time
                })
    
    def StoreGreeksHistory(self):
        """Store historical Greeks data for trend analysis"""
        history_entry = {
            'timestamp': self.algo.Time,
            'portfolio_value': float(self.algo.Portfolio.TotalPortfolioValue),
            'total_delta': self.portfolio_greeks['total_delta'],
            'total_gamma': self.portfolio_greeks['total_gamma'],
            'total_theta': self.portfolio_greeks['total_theta'],
            'total_vega': self.portfolio_greeks['total_vega'],
            'position_count': len(self.position_greeks),
            'alert_count': len(self.risk_alerts),
            'delta_dollar': self.GetPortfolioDeltaDollar(),
            'neutrality_score': self.CalculateNeutralityScore()
        }
        
        self.greeks_history.append(history_entry)
        
        # Keep only last 30 days of history
        cutoff_date = self.algo.Time - timedelta(days=30)
        self.greeks_history = [h for h in self.greeks_history if h['timestamp'] > cutoff_date]
        
    def GetPortfolioDeltaDollar(self):
        """Calculate portfolio delta in dollar terms"""
        total_delta_dollars = 0.0
        
        for symbol, greeks in self.position_greeks.items():
            if 'underlying_price' in greeks:
                # For options: delta * underlying_price gives delta dollar exposure
                delta_dollars = greeks['delta'] * greeks['underlying_price']
                total_delta_dollars += delta_dollars
            elif 'price' in greeks and greeks.get('type') == 'Future':
                # For futures: already in dollar terms via multiplier
                total_delta_dollars += greeks['delta']
            elif 'price' in greeks:
                # For equities: delta * price
                delta_dollars = greeks['delta'] * greeks['price']
                total_delta_dollars += delta_dollars
                
        return total_delta_dollars
        
    def GetGreeksByStrategy(self):
        """Get Greeks breakdown by trading strategy"""
        strategy_greeks = {
            'IRON_CONDOR_0DTE': {'delta': 0, 'gamma': 0, 'theta': 0, 'vega': 0},
            'LT112': {'delta': 0, 'gamma': 0, 'theta': 0, 'vega': 0},
            'FUTURES_STRANGLE': {'delta': 0, 'gamma': 0, 'theta': 0, 'vega': 0},
            'IPMCC': {'delta': 0, 'gamma': 0, 'theta': 0, 'vega': 0},
            'LEAP_LADDER': {'delta': 0, 'gamma': 0, 'theta': 0, 'vega': 0},
            'OTHER': {'delta': 0, 'gamma': 0, 'theta': 0, 'vega': 0}
        }
        
        # Map positions to strategies (simplified)
        for symbol, greeks in self.position_greeks.items():
            strategy = 'OTHER'  # Default
            
            # Would need to map symbols to strategies based on position tracking
            # This is a simplified implementation
            if '0DTE' in str(symbol).upper() or 'IC' in str(symbol).upper():
                strategy = 'IRON_CONDOR_0DTE'
            elif 'LT112' in str(symbol).upper():
                strategy = 'LT112'
            elif any(fut in str(symbol).upper() for fut in ['ES', 'CL', 'GC', 'MES', 'MCL', 'MGC']):
                strategy = 'FUTURES_STRANGLE'
            elif 'LEAP' in str(symbol).upper():
                if 'LADDER' in str(symbol).upper():
                    strategy = 'LEAP_LADDER'
                else:
                    strategy = 'IPMCC'
            
            # Add to strategy totals
            strategy_greeks[strategy]['delta'] += greeks['delta']
            strategy_greeks[strategy]['gamma'] += greeks['gamma']
            strategy_greeks[strategy]['theta'] += greeks['theta']
            strategy_greeks[strategy]['vega'] += greeks['vega']
            
        return strategy_greeks
        
    def GetGreeksSummary(self):
        """Get comprehensive Greeks summary for reporting"""
        return {
            'portfolio_greeks': self.portfolio_greeks.copy(),
            'position_count': len(self.position_greeks),
            'delta_dollar': self.GetPortfolioDeltaDollar(),
            'alerts': self.risk_alerts.copy(),
            'risk_status': self.GetOverallRiskStatus(),
            'theta_annualized': self.portfolio_greeks['total_theta'] * 365,
            'neutrality_score': self.CalculateNeutralityScore(),
            'strategy_breakdown': self.GetGreeksByStrategy(),
            'last_update': self.last_update_time,
            'gamma_risk_level': self.GetGammaRiskLevel(),
            'vega_risk_level': self.GetVegaRiskLevel()
        }
        
    def GetOverallRiskStatus(self):
        """Determine overall risk status based on alerts"""
        if not self.risk_alerts:
            return 'LOW'
            
        severity_counts = {'HIGH': 0, 'MEDIUM': 0, 'LOW': 0}
        for alert in self.risk_alerts:
            severity_counts[alert['severity']] += 1
            
        if severity_counts['HIGH'] > 0:
            return 'HIGH'
        elif severity_counts['MEDIUM'] > 1:
            return 'HIGH'
        elif severity_counts['MEDIUM'] > 0 or severity_counts['LOW'] > 2:
            return 'MEDIUM'
        else:
            return 'LOW'
            
    def CalculateNeutralityScore(self):
        """Calculate portfolio neutrality score (0-100)"""
        # Based on delta neutrality and Greeks balance
        delta_score = max(0, 100 - abs(self.portfolio_greeks['total_delta']) * 2)
        
        # Vega balance (prefer some positive vega for income)
        vega_target = 200  # Moderate positive vega target
        vega_diff = abs(self.portfolio_greeks['total_vega'] - vega_target)
        vega_score = max(0, 100 - vega_diff / 10)
        
        # Theta income (should be positive)
        theta_score = min(100, max(0, self.portfolio_greeks['total_theta'] * 2))
        
        # Gamma balance (avoid excessive gamma)
        gamma_penalty = min(50, abs(self.portfolio_greeks['total_gamma']) / 10)
        gamma_score = max(0, 100 - gamma_penalty)
        
        # Weighted average
        neutrality_score = (
            delta_score * 0.40 + 
            vega_score * 0.25 + 
            theta_score * 0.20 + 
            gamma_score * 0.15
        )
        
        return max(0, min(100, neutrality_score))
    
    def GetGammaRiskLevel(self):
        """Assess gamma risk level"""
        total_gamma = abs(self.portfolio_greeks['total_gamma'])
        
        if total_gamma < 50:
            return 'LOW'
        elif total_gamma < 150:
            return 'MEDIUM'
        else:
            return 'HIGH'
    
    def GetVegaRiskLevel(self):
        """Assess vega risk level"""
        total_vega = abs(self.portfolio_greeks['total_vega'])
        
        if total_vega < 300:
            return 'LOW'
        elif total_vega < 700:
            return 'MEDIUM'
        else:
            return 'HIGH'
        
    def SuggestGreeksAdjustments(self):
        """Provide Greeks adjustment recommendations"""
        suggestions = []
        
        total_delta = self.portfolio_greeks['total_delta']
        if total_delta > 50:
            suggestions.append({
                'type': 'DELTA_HEDGE',
                'action': 'SELL',
                'description': f'Sell {total_delta-25:.0f} delta to neutralize portfolio',
                'priority': 'HIGH',
                'urgency': 'IMMEDIATE' if total_delta > 100 else 'MODERATE'
            })
        elif total_delta < -50:
            suggestions.append({
                'type': 'DELTA_HEDGE', 
                'action': 'BUY',
                'description': f'Buy {abs(total_delta)-25:.0f} delta to neutralize portfolio',
                'priority': 'HIGH',
                'urgency': 'IMMEDIATE' if total_delta < -100 else 'MODERATE'
            })
            
        # Theta enhancement suggestions
        if self.portfolio_greeks['total_theta'] < 100:
            suggestions.append({
                'type': 'THETA_ENHANCEMENT',
                'action': 'SELL_PREMIUM',
                'description': 'Consider selling additional premium for theta income',
                'priority': 'MEDIUM',
                'urgency': 'ROUTINE'
            })
            
        # Gamma risk mitigation
        if abs(self.portfolio_greeks['total_gamma']) > 200:
            suggestions.append({
                'type': 'GAMMA_REDUCTION',
                'action': 'REDUCE_POSITIONS',
                'description': 'Reduce high-gamma positions to manage risk',
                'priority': 'HIGH',
                'urgency': 'MODERATE'
            })
            
        # Vega risk management
        if abs(self.portfolio_greeks['total_vega']) > 800:
            suggestions.append({
                'type': 'VEGA_HEDGE',
                'action': 'VOLATILITY_HEDGE',
                'description': 'Consider volatility hedge to reduce vega exposure',
                'priority': 'MEDIUM',
                'urgency': 'MODERATE'
            })
            
        return suggestions
    
    def GetGreeksReport(self):
        """Generate comprehensive Greeks report"""
        summary = self.GetGreeksSummary()
        suggestions = self.SuggestGreeksAdjustments()
        
        report = {
            'timestamp': self.algo.Time,
            'portfolio_value': self.algo.Portfolio.TotalPortfolioValue,
            'summary': summary,
            'suggestions': suggestions,
            'risk_breakdown': {
                'delta_risk': 'HIGH' if abs(summary['portfolio_greeks']['total_delta']) > 75 else 'MEDIUM' if abs(summary['portfolio_greeks']['total_delta']) > 40 else 'LOW',
                'gamma_risk': self.GetGammaRiskLevel(),
                'theta_income': 'HIGH' if summary['portfolio_greeks']['total_theta'] > 150 else 'MEDIUM' if summary['portfolio_greeks']['total_theta'] > 75 else 'LOW',
                'vega_risk': self.GetVegaRiskLevel()
            },
            'performance_metrics': {
                'neutrality_score': summary['neutrality_score'],
                'theta_annualized': summary['theta_annualized'],
                'delta_dollar_exposure': summary['delta_dollar'],
                'active_alerts': len(summary['alerts'])
            }
        }
        
        return report
    
    def LogGreeksSummary(self):
        """Log current Greeks summary to algorithm console"""
        summary = self.GetGreeksSummary()
        
        self.algo.Log("=" * 50)
        self.algo.Log("GREEKS PORTFOLIO ANALYSIS")
        self.algo.Log("=" * 50)
        self.algo.Log(f"Total Delta: {summary['portfolio_greeks']['total_delta']:.1f}")
        self.algo.Log(f"Total Gamma: {summary['portfolio_greeks']['total_gamma']:.1f}")
        self.algo.Log(f"Daily Theta: ${summary['portfolio_greeks']['total_theta']:.2f}")
        self.algo.Log(f"Total Vega: {summary['portfolio_greeks']['total_vega']:.1f}")
        self.algo.Log(f"Delta Dollar: ${summary['delta_dollar']:,.0f}")
        self.algo.Log(f"Neutrality Score: {summary['neutrality_score']:.1f}/100")
        self.algo.Log(f"Risk Status: {summary['risk_status']}")
        self.algo.Log(f"Active Positions: {summary['position_count']}")
        
        if summary['alerts']:
            self.algo.Log("\nRISK ALERTS:")
            for alert in summary['alerts'][-5:]:  # Show last 5 alerts
                self.algo.Log(f"  {alert['severity']}: {alert['message']}")
        
        self.algo.Log("=" * 50)

