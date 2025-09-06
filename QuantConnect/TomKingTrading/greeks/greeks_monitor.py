# region imports
from AlgorithmImports import *
import numpy as np
from scipy.stats import norm
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
# endregion

class GreeksMonitor:
    """
    Real-time Greeks calculation and monitoring
    Essential for options risk management
    Based on Tom King Trading Framework requirements
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.position_greeks = {}
        self.portfolio_greeks_history = []
        
        # Tom King's Greeks thresholds
        self.alert_thresholds = {
            'delta': 100,    # Max portfolio delta
            'gamma': 20,     # Max portfolio gamma  
            'theta': -500,   # Max daily theta decay
            'vega': 1000,    # Max vega exposure
            'rho': 500       # Max rho exposure
        }
        
        # Phase-based adjustments
        self.phase_multipliers = {
            1: 0.5,   # Phase 1: Conservative
            2: 0.75,  # Phase 2: Moderate
            3: 1.0,   # Phase 3: Standard
            4: 1.25   # Phase 4: Aggressive
        }
        
    def calculate_option_greeks(self, spot: float, strike: float, dte: float, 
                               iv: float, option_type: str, r: float = 0.05) -> Dict:
        """Calculate Black-Scholes Greeks for single option"""
        
        if dte <= 0:
            return {'delta': 0, 'gamma': 0, 'theta': 0, 'vega': 0, 'rho': 0}
            
        T = dte / 365.0
        sqrt_T = np.sqrt(T)
        
        # Prevent division by zero
        if iv <= 0:
            iv = 0.20  # Default 20% IV
            
        d1 = (np.log(spot / strike) + (r + 0.5 * iv ** 2) * T) / (iv * sqrt_T)
        d2 = d1 - iv * sqrt_T
        
        # Calculate Greeks based on option type
        if option_type.upper() == 'CALL':
            delta = norm.cdf(d1)
            theta = (-spot * norm.pdf(d1) * iv / (2 * sqrt_T) 
                    - r * strike * np.exp(-r * T) * norm.cdf(d2)) / 365
            rho = strike * T * np.exp(-r * T) * norm.cdf(d2) / 100
        else:  # PUT
            delta = norm.cdf(d1) - 1
            theta = (-spot * norm.pdf(d1) * iv / (2 * sqrt_T) 
                    + r * strike * np.exp(-r * T) * norm.cdf(-d2)) / 365
            rho = -strike * T * np.exp(-r * T) * norm.cdf(-d2) / 100
            
        # Greeks same for calls and puts
        gamma = norm.pdf(d1) / (spot * iv * sqrt_T)
        vega = spot * norm.pdf(d1) * sqrt_T / 100  # Per 1% IV change
        
        return {
            'delta': delta,
            'gamma': gamma,
            'theta': theta,
            'vega': vega,
            'rho': rho,
            'iv': iv
        }
        
    def calculate_portfolio_greeks(self) -> Dict:
        """Calculate total portfolio Greeks with detailed breakdown"""
        
        portfolio_greeks = {
            'delta': 0,
            'gamma': 0,
            'theta': 0,
            'vega': 0,
            'rho': 0,
            'positions': [],
            'by_underlying': {},
            'by_expiry': {},
            'timestamp': self.algorithm.Time
        }
        
        # Process each position
        for symbol, holding in self.algorithm.Portfolio.items():
            if not holding.Invested:
                continue
                
            # Handle options
            if holding.Type == SecurityType.Option:
                option = holding.Symbol
                underlying = option.Underlying
                
                # Get current data
                if underlying not in self.algorithm.Securities:
                    continue
                    
                spot = self.algorithm.Securities[underlying].Price
                strike = option.ID.StrikePrice
                expiry = option.ID.Date
                dte = (expiry - self.algorithm.Time).days
                
                # Get or estimate IV
                iv = self.get_implied_volatility(option)
                
                option_type = "CALL" if option.ID.OptionRight == OptionRight.Call else "PUT"
                
                # Calculate Greeks
                greeks = self.calculate_option_greeks(spot, strike, dte, iv, option_type)
                
                # Scale by position size (options are 100x multiplier)
                position_size = holding.Quantity
                position_greeks = {
                    'symbol': str(symbol),
                    'underlying': str(underlying),
                    'quantity': position_size,
                    'strike': strike,
                    'dte': dte,
                    'type': option_type,
                    'delta': greeks['delta'] * position_size * 100,
                    'gamma': greeks['gamma'] * position_size * 100,
                    'theta': greeks['theta'] * position_size * 100,
                    'vega': greeks['vega'] * position_size * 100,
                    'rho': greeks['rho'] * position_size * 100,
                    'iv': greeks['iv']
                }
                
                # Add to portfolio totals
                portfolio_greeks['delta'] += position_greeks['delta']
                portfolio_greeks['gamma'] += position_greeks['gamma']
                portfolio_greeks['theta'] += position_greeks['theta']
                portfolio_greeks['vega'] += position_greeks['vega']
                portfolio_greeks['rho'] += position_greeks['rho']
                
                portfolio_greeks['positions'].append(position_greeks)
                
                # Group by underlying
                underlying_str = str(underlying)
                if underlying_str not in portfolio_greeks['by_underlying']:
                    portfolio_greeks['by_underlying'][underlying_str] = {
                        'delta': 0, 'gamma': 0, 'theta': 0, 'vega': 0
                    }
                portfolio_greeks['by_underlying'][underlying_str]['delta'] += position_greeks['delta']
                portfolio_greeks['by_underlying'][underlying_str]['gamma'] += position_greeks['gamma']
                portfolio_greeks['by_underlying'][underlying_str]['theta'] += position_greeks['theta']
                portfolio_greeks['by_underlying'][underlying_str]['vega'] += position_greeks['vega']
                
                # Group by expiry
                expiry_str = expiry.strftime('%Y-%m-%d')
                if expiry_str not in portfolio_greeks['by_expiry']:
                    portfolio_greeks['by_expiry'][expiry_str] = {
                        'delta': 0, 'gamma': 0, 'theta': 0, 'vega': 0, 'positions': 0
                    }
                portfolio_greeks['by_expiry'][expiry_str]['delta'] += position_greeks['delta']
                portfolio_greeks['by_expiry'][expiry_str]['gamma'] += position_greeks['gamma']
                portfolio_greeks['by_expiry'][expiry_str]['theta'] += position_greeks['theta']
                portfolio_greeks['by_expiry'][expiry_str]['vega'] += position_greeks['vega']
                portfolio_greeks['by_expiry'][expiry_str]['positions'] += 1
                
            # Handle stock/ETF positions (delta = 1 per share)
            elif holding.Type == SecurityType.Equity:
                equity_delta = holding.Quantity
                portfolio_greeks['delta'] += equity_delta
                
                position_info = {
                    'symbol': str(symbol),
                    'quantity': holding.Quantity,
                    'type': 'EQUITY',
                    'delta': equity_delta,
                    'gamma': 0,
                    'theta': 0,
                    'vega': 0,
                    'rho': 0
                }
                portfolio_greeks['positions'].append(position_info)
                
        # Store in history
        self.portfolio_greeks_history.append(portfolio_greeks.copy())
        
        return portfolio_greeks
        
    def monitor_greeks_limits(self) -> Tuple[Dict, List[str]]:
        """Check if Greeks exceed safety thresholds"""
        
        greeks = self.calculate_portfolio_greeks()
        alerts = []
        alert_levels = {}
        
        # Get phase-based multiplier
        phase = self.get_account_phase()
        multiplier = self.phase_multipliers.get(phase, 1.0)
        
        # Check each Greek against adjusted threshold
        checks = [
            ('delta', abs(greeks['delta']), self.alert_thresholds['delta'] * multiplier),
            ('gamma', abs(greeks['gamma']), self.alert_thresholds['gamma'] * multiplier),
            ('theta', greeks['theta'], self.alert_thresholds['theta'] * multiplier),
            ('vega', abs(greeks['vega']), self.alert_thresholds['vega'] * multiplier),
            ('rho', abs(greeks['rho']), self.alert_thresholds['rho'] * multiplier)
        ]
        
        for greek_name, value, threshold in checks:
            if greek_name == 'theta':
                # Theta is negative, so check if more negative than threshold
                if value < threshold:
                    severity = abs(value / threshold)
                    alert_levels[greek_name] = 'CRITICAL' if severity > 1.5 else 'WARNING'
                    alerts.append(f"{greek_name.upper()} DECAY: ${value:.2f}/day (limit: ${threshold:.2f})")
            else:
                # Other Greeks check absolute value
                if value > threshold:
                    severity = value / threshold
                    alert_levels[greek_name] = 'CRITICAL' if severity > 1.5 else 'WARNING'
                    
                    if greek_name == 'delta':
                        alerts.append(f"DELTA EXPOSURE: {value:.2f} (limit: {threshold:.0f})")
                    elif greek_name == 'gamma':
                        alerts.append(f"GAMMA RISK: {value:.2f} (limit: {threshold:.0f})")
                    elif greek_name == 'vega':
                        alerts.append(f"VEGA EXPOSURE: ${value:.2f} per 1% IV (limit: ${threshold:.0f})")
                    elif greek_name == 'rho':
                        alerts.append(f"RHO EXPOSURE: ${value:.2f} per 1% rate (limit: ${threshold:.0f})")
                        
        # Log alerts if any
        if alerts:
            self.algorithm.Log("=" * 60)
            self.algorithm.Log(f"GREEKS RISK ALERT - Phase {phase}")
            self.algorithm.Log("-" * 60)
            for alert in alerts:
                level = "CRITICAL" if any('CRITICAL' in str(v) for v in alert_levels.values()) else "WARNING"
                self.algorithm.Log(f"  [{level}] {alert}")
                
            # Log position breakdown
            self.log_position_greeks(greeks)
            
            # Suggest hedges
            hedge_suggestions = self.suggest_hedge(greeks)
            if hedge_suggestions:
                self.algorithm.Log("\nHEDGE SUGGESTIONS:")
                for suggestion in hedge_suggestions:
                    self.algorithm.Log(f"  • {suggestion}")
                    
            self.algorithm.Log("=" * 60)
            
            # Trigger manual mode if critical
            if len([a for a in alert_levels.values() if a == 'CRITICAL']) >= 2:
                if hasattr(self.algorithm, 'manual_mode'):
                    self.algorithm.manual_mode.activate_manual_mode(
                        f"Multiple critical Greeks limits: {', '.join(alerts[:2])}"
                    )
                    
        return greeks, alerts
        
    def suggest_hedge(self, greeks: Dict) -> List[str]:
        """Suggest hedging trades based on Greeks exposure"""
        
        suggestions = []
        
        # Delta hedge
        if abs(greeks['delta']) > 50:
            hedge_shares = -greeks['delta']
            direction = 'Buy' if hedge_shares > 0 else 'Sell'
            suggestions.append(f"Delta Hedge: {direction} {abs(hedge_shares):.0f} SPY shares (neutralize {greeks['delta']:.1f} delta)")
            
        # Gamma hedge
        if abs(greeks['gamma']) > 10:
            if greeks['gamma'] > 0:
                suggestions.append(f"Gamma Hedge: Sell ATM straddle to reduce positive gamma ({greeks['gamma']:.2f})")
            else:
                suggestions.append(f"Gamma Hedge: Buy ATM straddle to reduce negative gamma ({greeks['gamma']:.2f})")
                
        # Theta management
        if greeks['theta'] < -200:
            daily_decay = abs(greeks['theta'])
            monthly_decay = daily_decay * 30
            suggestions.append(f"Theta Alert: Losing ${daily_decay:.0f}/day (${monthly_decay:.0f}/month)")
            suggestions.append(f"Consider: Roll short options or reduce position size")
            
        # Vega hedge
        if abs(greeks['vega']) > 500:
            if greeks['vega'] > 0:
                suggestions.append(f"Vega Hedge: Short volatility - sell OTM options (long ${greeks['vega']:.0f} vega)")
            else:
                suggestions.append(f"Vega Hedge: Long volatility - buy OTM options (short ${abs(greeks['vega']):.0f} vega)")
                
        # Rho considerations
        if abs(greeks['rho']) > 300:
            direction = "rising" if greeks['rho'] > 0 else "falling"
            suggestions.append(f"Rho Alert: ${abs(greeks['rho']):.0f} exposure to {direction} rates")
            
        return suggestions
        
    def get_implied_volatility(self, option) -> float:
        """Get IV from market data or calculate from prices"""
        
        # Try QuantConnect's IV
        if hasattr(option, 'ImpliedVolatility'):
            iv = option.ImpliedVolatility
            if iv > 0:
                return iv
                
        # Try from Greeks if available
        if hasattr(option, 'Greeks') and hasattr(option.Greeks, 'Vega'):
            # Rough IV estimation from vega
            return 0.20  # Default for now
            
        # Calculate from option prices (simplified)
        try:
            if option.BidPrice > 0 and option.AskPrice > 0:
                mid_price = (option.BidPrice + option.AskPrice) / 2
                
                # Very rough IV estimate based on price
                # Would use Newton-Raphson or bisection in production
                underlying_price = self.algorithm.Securities[option.Underlying].Price
                moneyness = option.ID.StrikePrice / underlying_price
                
                if 0.9 < moneyness < 1.1:  # Near ATM
                    return 0.20  # 20% IV
                elif 0.8 < moneyness < 1.2:  # Slightly OTM/ITM
                    return 0.25  # 25% IV
                else:  # Far OTM/ITM
                    return 0.30  # 30% IV
        except:
            pass
            
        # Default IV
        return 0.20
        
    def log_position_greeks(self, greeks: Dict):
        """Log detailed position Greeks breakdown"""
        
        if not greeks['positions']:
            return
            
        self.algorithm.Log("\nPosition Greeks Breakdown:")
        self.algorithm.Log("-" * 60)
        
        # Sort by absolute delta
        sorted_positions = sorted(greeks['positions'], 
                                 key=lambda x: abs(x['delta']), 
                                 reverse=True)
        
        for pos in sorted_positions[:5]:  # Top 5 positions
            if pos['type'] == 'EQUITY':
                self.algorithm.Log(
                    f"  {pos['symbol']:10} | Qty: {pos['quantity']:6.0f} | "
                    f"Delta: {pos['delta']:7.1f}"
                )
            else:
                self.algorithm.Log(
                    f"  {pos['symbol'][:20]:20} | {pos['type']:4} | "
                    f"Qty: {pos['quantity']:4.0f} | Strike: {pos['strike']:6.0f} | "
                    f"DTE: {pos['dte']:3.0f} | Delta: {pos['delta']:6.1f} | "
                    f"Gamma: {pos['gamma']:5.2f}"
                )
                
        # Log by underlying
        if greeks['by_underlying']:
            self.algorithm.Log("\nGreeks by Underlying:")
            for underlying, underlying_greeks in greeks['by_underlying'].items():
                self.algorithm.Log(
                    f"  {underlying:6} | Delta: {underlying_greeks['delta']:7.1f} | "
                    f"Gamma: {underlying_greeks['gamma']:6.2f} | "
                    f"Theta: ${underlying_greeks['theta']:7.0f}"
                )
                
        # Log by expiry
        if greeks['by_expiry']:
            self.algorithm.Log("\nGreeks by Expiry:")
            for expiry, expiry_greeks in sorted(greeks['by_expiry'].items()):
                self.algorithm.Log(
                    f"  {expiry} | Positions: {expiry_greeks['positions']:2.0f} | "
                    f"Delta: {expiry_greeks['delta']:7.1f} | "
                    f"Theta: ${expiry_greeks['theta']:7.0f}"
                )
                
    def get_account_phase(self) -> int:
        """Get current account phase for threshold adjustments"""
        
        portfolio_value = self.algorithm.Portfolio.TotalPortfolioValue
        
        if portfolio_value >= 75000:
            return 4
        elif portfolio_value >= 60000:
            return 3
        elif portfolio_value >= 40000:
            return 2
        else:
            return 1
            
    def calculate_0dte_greeks(self, strike: float, option_type: str, 
                              spot: float = None) -> Dict:
        """Special Greeks calculation for 0DTE options"""
        
        if spot is None:
            spot = self.algorithm.Securities["SPY"].Price if "SPY" in self.algorithm.Securities else 450
            
        # 0DTE has special characteristics
        dte = 0.25  # Fraction of day remaining
        iv = 0.15   # Lower IV for 0DTE
        
        greeks = self.calculate_option_greeks(spot, strike, dte, iv, option_type, r=0.05)
        
        # Adjust for 0DTE characteristics
        greeks['gamma'] *= 2  # Gamma risk amplified
        greeks['theta'] *= 4  # Theta decay accelerated
        
        return greeks
        
    def get_greek_trends(self, lookback_periods: int = 20) -> Dict:
        """Analyze Greeks trends over time"""
        
        if len(self.portfolio_greeks_history) < lookback_periods:
            return {}
            
        recent = self.portfolio_greeks_history[-lookback_periods:]
        
        trends = {
            'delta_trend': 'NEUTRAL',
            'gamma_trend': 'NEUTRAL',
            'theta_trend': 'NEUTRAL',
            'vega_trend': 'NEUTRAL'
        }
        
        # Calculate trends
        for greek in ['delta', 'gamma', 'theta', 'vega']:
            values = [g[greek] for g in recent]
            if len(values) >= 2:
                change = values[-1] - values[0]
                
                if greek == 'theta':
                    # Theta getting more negative is bad
                    if change < -50:
                        trends[f'{greek}_trend'] = 'WORSENING'
                    elif change > 50:
                        trends[f'{greek}_trend'] = 'IMPROVING'
                else:
                    # Other Greeks
                    if abs(change) > 20:
                        trends[f'{greek}_trend'] = 'INCREASING' if change > 0 else 'DECREASING'
                        
        return trends
        
    def get_statistics(self) -> Dict:
        """Get Greeks monitoring statistics"""
        
        current_greeks = self.calculate_portfolio_greeks()
        
        stats = {
            'current_delta': current_greeks['delta'],
            'current_gamma': current_greeks['gamma'],
            'current_theta': current_greeks['theta'],
            'current_vega': current_greeks['vega'],
            'current_rho': current_greeks['rho'],
            'position_count': len(current_greeks['positions']),
            'underlying_count': len(current_greeks['by_underlying']),
            'expiry_count': len(current_greeks['by_expiry']),
            'history_length': len(self.portfolio_greeks_history)
        }
        
        # Add trends if available
        trends = self.get_greek_trends()
        if trends:
            stats.update(trends)
            
        return stats