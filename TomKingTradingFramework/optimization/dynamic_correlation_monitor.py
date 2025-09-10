#!/usr/bin/env python3
"""
Dynamic Correlation Monitor - Phase 4 Optimization
Real-time correlation tracking with rolling windows and alerts
"""

import numpy as np
from typing import Dict, List, Tuple, Optional
from collections import deque
from datetime import datetime, timedelta

class DynamicCorrelationMonitor:
    """
    Advanced correlation monitoring with real-time updates
    Tracks correlations between positions and market factors
    """
    
    def __init__(self, algorithm, window_size: int = 20, update_frequency: int = 30):
        self.algo = algorithm
        self.window_size = window_size  # Rolling window for correlation calculation
        self.update_frequency = update_frequency  # Minutes between updates
        
        # Price history for correlation calculation
        self.price_history: Dict[str, deque] = {}
        self.returns_history: Dict[str, deque] = {}
        
        # Correlation matrices
        self.correlation_matrix: Dict[Tuple[str, str], float] = {}
        self.correlation_groups: Dict[str, List[str]] = {
            'tech': ['QQQ', 'AAPL', 'MSFT', 'GOOGL', 'META', 'NVDA'],
            'financials': ['XLF', 'JPM', 'BAC', 'WFC', 'GS'],
            'energy': ['XLE', 'XOM', 'CVX', 'COP'],
            'defensive': ['XLP', 'XLU', 'PG', 'KO', 'JNJ'],
            'volatility': ['VIX', 'VXX', 'UVXY'],
            'bonds': ['TLT', 'IEF', 'SHY', 'AGG']
        }
        
        # Correlation thresholds
        self.high_correlation_threshold = 0.7
        self.extreme_correlation_threshold = 0.85
        
        # Tracking metrics
        self.last_update = self.algo.Time
        self.correlation_breaches = []
        
    def update_price_data(self, symbol: str, price: float):
        """Update price data for correlation calculation"""
        if symbol not in self.price_history:
            self.price_history[symbol] = deque(maxlen=self.window_size + 1)
            self.returns_history[symbol] = deque(maxlen=self.window_size)
        
        # Add new price
        self.price_history[symbol].append(price)
        
        # Calculate return if we have enough data
        if len(self.price_history[symbol]) >= 2:
            return_val = (self.price_history[symbol][-1] / self.price_history[symbol][-2] - 1)
            self.returns_history[symbol].append(return_val)
    
    def calculate_correlations(self) -> Dict[Tuple[str, str], float]:
        """Calculate correlation matrix for all tracked symbols"""
        # Only update if enough time has passed
        if (self.algo.Time - self.last_update).seconds < self.update_frequency * 60:
            return self.correlation_matrix
        
        self.last_update = self.algo.Time
        symbols_with_data = [s for s in self.returns_history 
                            if len(self.returns_history[s]) >= self.window_size]
        
        # Calculate pairwise correlations
        new_correlations = {}
        for i, symbol1 in enumerate(symbols_with_data):
            for symbol2 in symbols_with_data[i+1:]:
                corr = self._calculate_correlation(symbol1, symbol2)
                if corr is not None:
                    new_correlations[(symbol1, symbol2)] = corr
                    new_correlations[(symbol2, symbol1)] = corr
        
        self.correlation_matrix = new_correlations
        
        # Check for correlation breaches
        self._check_correlation_limits()
        
        return self.correlation_matrix
    
    def _calculate_correlation(self, symbol1: str, symbol2: str) -> Optional[float]:
        """Calculate correlation between two symbols"""
        try:
            returns1 = np.array(list(self.returns_history[symbol1]))
            returns2 = np.array(list(self.returns_history[symbol2]))
            
            if len(returns1) != len(returns2) or len(returns1) < self.window_size:
                return None
            
            # Calculate correlation coefficient
            correlation = np.corrcoef(returns1, returns2)[0, 1]
            
            return correlation
            
        except Exception as e:
            self.algo.Debug(f"Error calculating correlation between {symbol1} and {symbol2}: {e}")
            return None
    
    def _check_correlation_limits(self):
        """Check for correlation limit breaches"""
        self.correlation_breaches.clear()
        
        for (symbol1, symbol2), correlation in self.correlation_matrix.items():
            if abs(correlation) > self.extreme_correlation_threshold:
                self.correlation_breaches.append({
                    'symbols': (symbol1, symbol2),
                    'correlation': correlation,
                    'level': 'EXTREME',
                    'timestamp': self.algo.Time
                })
                self.algo.Log(f"[CORRELATION] EXTREME correlation detected: "
                            f"{symbol1}-{symbol2} = {correlation:.3f}")
            elif abs(correlation) > self.high_correlation_threshold:
                self.correlation_breaches.append({
                    'symbols': (symbol1, symbol2),
                    'correlation': correlation,
                    'level': 'HIGH',
                    'timestamp': self.algo.Time
                })
    
    def get_position_correlations(self, positions: List[str]) -> Dict:
        """Get correlation analysis for current positions"""
        position_correlations = {
            'average_correlation': 0.0,
            'max_correlation': 0.0,
            'correlation_pairs': [],
            'diversification_score': 0.0
        }
        
        if len(positions) < 2:
            position_correlations['diversification_score'] = 100.0
            return position_correlations
        
        # Calculate average correlation between positions
        correlations = []
        for i, pos1 in enumerate(positions):
            for pos2 in positions[i+1:]:
                if (pos1, pos2) in self.correlation_matrix:
                    corr = self.correlation_matrix[(pos1, pos2)]
                    correlations.append(abs(corr))
                    position_correlations['correlation_pairs'].append({
                        'pair': (pos1, pos2),
                        'correlation': corr
                    })
        
        if correlations:
            position_correlations['average_correlation'] = np.mean(correlations)
            position_correlations['max_correlation'] = max(correlations)
            
            # Calculate diversification score (0-100, higher is better)
            # Low correlation = high diversification
            position_correlations['diversification_score'] = max(0, 100 * (1 - position_correlations['average_correlation']))
        else:
            position_correlations['diversification_score'] = 50.0  # Neutral if no data
        
        return position_correlations
    
    def suggest_diversification(self, current_positions: List[str], 
                               candidate_symbol: str) -> Dict:
        """Suggest whether adding a symbol improves diversification"""
        suggestion = {
            'add_symbol': False,
            'improves_diversification': False,
            'correlation_with_portfolio': 0.0,
            'reasoning': ''
        }
        
        if not current_positions:
            suggestion['add_symbol'] = True
            suggestion['improves_diversification'] = True
            suggestion['reasoning'] = "First position in portfolio"
            return suggestion
        
        # Calculate average correlation with existing positions
        correlations = []
        for position in current_positions:
            if (position, candidate_symbol) in self.correlation_matrix:
                correlations.append(abs(self.correlation_matrix[(position, candidate_symbol)]))
        
        if not correlations:
            suggestion['reasoning'] = "No correlation data available"
            return suggestion
        
        avg_correlation = np.mean(correlations)
        suggestion['correlation_with_portfolio'] = avg_correlation
        
        # Decision logic
        if avg_correlation < 0.3:
            suggestion['add_symbol'] = True
            suggestion['improves_diversification'] = True
            suggestion['reasoning'] = f"Low correlation ({avg_correlation:.2f}) improves diversification"
        elif avg_correlation < 0.5:
            suggestion['add_symbol'] = True
            suggestion['improves_diversification'] = True
            suggestion['reasoning'] = f"Moderate correlation ({avg_correlation:.2f}) acceptable"
        elif avg_correlation < 0.7:
            suggestion['add_symbol'] = False
            suggestion['improves_diversification'] = False
            suggestion['reasoning'] = f"High correlation ({avg_correlation:.2f}) reduces diversification"
        else:
            suggestion['add_symbol'] = False
            suggestion['improves_diversification'] = False
            suggestion['reasoning'] = f"Extreme correlation ({avg_correlation:.2f}) - avoid"
        
        return suggestion
    
    def get_correlation_report(self) -> Dict:
        """Generate comprehensive correlation report"""
        report = {
            'timestamp': self.algo.Time,
            'symbols_tracked': len(self.returns_history),
            'correlations_calculated': len(self.correlation_matrix),
            'high_correlations': [],
            'extreme_correlations': [],
            'sector_correlations': {},
            'recommendations': []
        }
        
        # Categorize correlations
        for (symbol1, symbol2), correlation in self.correlation_matrix.items():
            if abs(correlation) > self.extreme_correlation_threshold:
                report['extreme_correlations'].append({
                    'pair': (symbol1, symbol2),
                    'correlation': correlation
                })
            elif abs(correlation) > self.high_correlation_threshold:
                report['high_correlations'].append({
                    'pair': (symbol1, symbol2),
                    'correlation': correlation
                })
        
        # Calculate sector correlations
        for sector, symbols in self.correlation_groups.items():
            sector_corrs = []
            for i, sym1 in enumerate(symbols):
                for sym2 in symbols[i+1:]:
                    if (sym1, sym2) in self.correlation_matrix:
                        sector_corrs.append(self.correlation_matrix[(sym1, sym2)])
            
            if sector_corrs:
                report['sector_correlations'][sector] = {
                    'average': np.mean(sector_corrs),
                    'max': max(sector_corrs),
                    'min': min(sector_corrs)
                }
        
        # Generate recommendations
        if len(report['extreme_correlations']) > 0:
            report['recommendations'].append("Reduce position concentration in highly correlated assets")
        
        if report['sector_correlations']:
            high_corr_sectors = [s for s, data in report['sector_correlations'].items() 
                               if data['average'] > 0.7]
            if high_corr_sectors:
                report['recommendations'].append(f"Diversify away from sectors: {', '.join(high_corr_sectors)}")
        
        return report
    
    def get_market_regime(self) -> str:
        """Detect market regime based on correlation patterns"""
        # Check volatility correlations
        vix_correlations = []
        spy_correlation = None
        
        if 'VIX' in self.returns_history and 'SPY' in self.returns_history:
            if ('VIX', 'SPY') in self.correlation_matrix:
                spy_correlation = self.correlation_matrix[('VIX', 'SPY')]
        
        # Determine regime
        if spy_correlation is not None:
            if spy_correlation < -0.7:
                return "NORMAL"  # Strong negative VIX-SPY correlation
            elif spy_correlation < -0.3:
                return "TRANSITIONAL"  # Weakening correlation
            elif spy_correlation < 0.3:
                return "STRESSED"  # Correlation breakdown
            else:
                return "CRISIS"  # Positive VIX-SPY correlation
        
        return "UNKNOWN"