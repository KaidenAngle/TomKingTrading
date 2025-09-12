# Correlation Group Risk Manager for LEAN
# Implements Tom King's correlation limits
from AlgorithmImports import *
from typing import Dict, List, Set

class CorrelationManager:
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Define correlation groups per Tom King methodology
        self.correlation_groups = {
            'EQUITY_INDICES': {
                'symbols': ['SPY', 'QQQ', 'IWM', 'DIA'],
                'max_positions': 3,
                'current': set()
            },
            'ENERGY': {
                'symbols': ['USO', 'XLE', 'MCL', 'CL'],
                'max_positions': 2,
                'current': set()
            },
            'METALS': {
                'symbols': ['GLD', 'SLV', 'MGC', 'GC'],
                'max_positions': 2,
                'current': set()
            },
            'VOLATILITY': {
                'symbols': ['VXX', 'UVXY', 'SVXY'],
                'max_positions': 1,
                'current': set()
            },
            'BONDS': {
                'symbols': ['TLT', 'IEF', 'SHY', 'AGG'],
                'max_positions': 2,
                'current': set()
            },
            'CURRENCIES': {
                'symbols': ['UUP', 'FXE', 'FXY'],
                'max_positions': 2,
                'current': set()
            }
        }
        
        # VIX-based regime limits
        self.vix_regimes = {
            'LOW': {'vix_max': 16, 'bp_usage': 0.45, 'max_total_positions': 8},
            'NORMAL': {'vix_max': 20, 'bp_usage': 0.65, 'max_total_positions': 12},
            'ELEVATED': {'vix_max': 25, 'bp_usage': 0.75, 'max_total_positions': 15},
            'HIGH': {'vix_max': 30, 'bp_usage': 0.80, 'max_total_positions': 15},
            'EXTREME': {'vix_max': 100, 'bp_usage': 0.80, 'max_total_positions': 10}
        }
        
        self.current_regime = 'NORMAL'
        self.total_positions = 0
    
    def UpdateRegime(self):
        """Update VIX regime and position limits"""
        vix_price = self.algo.Securities["VIX"].Price
        
        for regime_name, params in self.vix_regimes.items():
            if vix_price <= params['vix_max']:
                self.current_regime = regime_name
                break
        
        return self.current_regime
    
    def CanOpenPosition(self, symbol: str) -> bool:
        """Check if new position can be opened based on correlation limits"""
        # Update regime first
        self.UpdateRegime()
        
        # Check total position limit
        regime_params = self.vix_regimes[self.current_regime]
        if self.total_positions >= regime_params['max_total_positions']:
            self.algo.Log(f"Max positions reached: {self.total_positions}/{regime_params['max_total_positions']}")
            return False
        
        # Check buying power usage
        current_bp_usage = self.algo.Portfolio.TotalMarginUsed / self.algo.Portfolio.TotalPortfolioValue
        if current_bp_usage >= regime_params['bp_usage']:
            self.algo.Log(f"Max BP usage reached: {current_bp_usage:.2%}/{regime_params['bp_usage']:.2%}")
            return False
        
        # Find correlation group for symbol
        group = self.GetCorrelationGroup(symbol)
        if not group:
            # Symbol not in any group - allow but warn
            self.algo.Log(f"Warning: {symbol} not in any correlation group")
            return True
        
        # Check group limit
        if len(group['current']) >= group['max_positions']:
            self.algo.Log(f"Correlation limit reached for {symbol}: {len(group['current'])}/{group['max_positions']}")
            return False
        
        return True
    
    def GetCorrelationGroup(self, symbol: str) -> Dict:
        """Get correlation group for a symbol"""
        for group_name, group_data in self.correlation_groups.items():
            if symbol in group_data['symbols']:
                return group_data
        return None
    
    def RegisterPosition(self, symbol: str):
        """Register a new position"""
        group = self.GetCorrelationGroup(symbol)
        if group:
            group['current'].add(symbol)
        
        self.total_positions += 1
        self.algo.Log(f"Position registered: {symbol} (Total: {self.total_positions})")
    
    def UnregisterPosition(self, symbol: str):
        """Remove a closed position"""
        group = self.GetCorrelationGroup(symbol)
        if group and symbol in group['current']:
            group['current'].remove(symbol)
        
        self.total_positions = max(0, self.total_positions - 1)
        self.algo.Log(f"Position unregistered: {symbol} (Total: {self.total_positions})")
    
    def GetCurrentExposure(self) -> Dict:
        """Get current exposure by correlation group"""
        exposure = {}
        for group_name, group_data in self.correlation_groups.items():
            exposure[group_name] = {
                'current': len(group_data['current']),
                'max': group_data['max_positions'],
                'symbols': list(group_data['current'])
            }
        return exposure
    
    def EmergencyVIXProtocol(self, vix_price: float) -> str:
        """Emergency protocol for VIX spikes"""
        if vix_price > 40:
            self.algo.Log(f"EMERGENCY: VIX spike to {vix_price} - initiating emergency protocol")
            return "CLOSE_ALL_0DTE"
        elif vix_price > 35:
            self.algo.Log(f"WARNING: VIX elevated to {vix_price} - reducing exposure")
            return "REDUCE_EXPOSURE"
        elif vix_price > 30:
            self.algo.Log(f"CAUTION: VIX high at {vix_price} - no new positions")
            return "NO_NEW_POSITIONS"
        return "NORMAL"
    
    def ShouldDefend(self, position_info: Dict) -> bool:
        """Check if position needs defensive action at 21 DTE - ABSOLUTE RULE"""
        days_to_expiry = position_info.get('dte', 999)
        
        # Tom King's 21 DTE rule - NO CONDITIONS, NO EXCEPTIONS
        # From CRITICAL_DO_NOT_CHANGE.md: "Exit all positions at 21 DTE to avoid gamma risk"
        if days_to_expiry <= 21:
            self.algo.Log(f"21 DTE absolute defense triggered for {position_info['symbol']} (DTE: {days_to_expiry})")
            return True
        
        return False
    
    def CalculateKellyCriterion(self, win_rate: float, avg_win: float, avg_loss: float) -> float:
        """Calculate Kelly Criterion for position sizing"""
        if avg_loss == 0:
            return 0.02  # Default 2% if no loss data
        
        # Kelly formula: f = (p*b - q) / b
        # where p = win rate, q = loss rate, b = win/loss ratio
        p = win_rate
        q = 1 - win_rate
        b = avg_win / avg_loss
        
        kelly_fraction = (p * b - q) / b
        
        # Tom King conservative approach: use 25% of Kelly
        conservative_kelly = kelly_fraction * 0.25
        
        # Cap at 5% per trade (Tom King max risk)
        return min(conservative_kelly, 0.05)
    
    def GetRiskMetrics(self) -> Dict:
        """Get current risk metrics"""
        portfolio = self.algo.Portfolio
        
        return {
            'regime': self.current_regime,
            'vix': self.algo.Securities["VIX"].Price,
            'total_positions': self.total_positions,
            'bp_usage': portfolio.TotalMarginUsed / portfolio.TotalPortfolioValue,
            'cash_available': portfolio.Cash,
            'portfolio_value': portfolio.TotalPortfolioValue,
            'margin_used': portfolio.TotalMarginUsed,
            'exposure_by_group': self.GetCurrentExposure()
        }
