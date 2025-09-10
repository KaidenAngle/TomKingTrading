"""VIX Term Structure Analysis for volatility regime detection"""

from AlgorithmImports import *
from datetime import timedelta
import numpy as np

class VIXTermStructure:
    """Analyze VIX futures term structure for contango/backwardation signals"""
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Add VIX futures for term structure analysis
        self.vix_futures = {}
        self.term_structure_data = {}
        self.historical_ratios = []
        
        # Initialize VIX futures contracts
        self.InitializeVIXFutures()
    
    def InitializeVIXFutures(self):
        """Initialize VIX futures for term structure monitoring"""
        # Add VIX futures with different expiries
        vx = self.algo.AddFuture(
            Futures.Indices.VIX,
            Resolution.Minute
        )
        
        # Set filter to get front 3 months
        vx.SetFilter(0, 90)
        
        # Track the main VIX future symbol
        self.vix_future_symbol = vx.Symbol
        
        self.algo.Debug("VIX Term Structure analyzer initialized")
    
    def UpdateTermStructure(self):
        """Update VIX term structure data"""
        # Get current VIX spot price
        vix_spot = self.algo.Securities["VIX"].Price if "VIX" in self.algo.Securities else 20
        
        # Get VIX futures chain
        chains = self.algo.CurrentSlice.FutureChains
        if self.vix_future_symbol not in chains:
            return
        
        chain = chains[self.vix_future_symbol]
        if not chain:
            return
        
        # Sort contracts by expiry
        contracts = sorted(chain, key=lambda x: x.Expiry)
        
        if len(contracts) >= 2:
            # Get front month and second month
            front_month = contracts[0]
            second_month = contracts[1]
            
            self.term_structure_data = {
                'spot': vix_spot,
                'front_month': {
                    'price': front_month.LastPrice,
                    'expiry': front_month.Expiry,
                    'dte': (front_month.Expiry - self.algo.Time).days
                },
                'second_month': {
                    'price': second_month.LastPrice,
                    'expiry': second_month.Expiry,
                    'dte': (second_month.Expiry - self.algo.Time).days
                },
                'contango': front_month.LastPrice < second_month.LastPrice,
                'ratio': second_month.LastPrice / front_month.LastPrice if front_month.LastPrice > 0 else 1,
                'spread': second_month.LastPrice - front_month.LastPrice,
                'timestamp': self.algo.Time
            }
            
            # Store historical ratio
            self.historical_ratios.append(self.term_structure_data['ratio'])
            if len(self.historical_ratios) > 20:
                self.historical_ratios.pop(0)
    
    def GetTermStructureSignal(self):
        """
        Get trading signal based on VIX term structure
        
        Returns:
            Dictionary with signal and confidence
        """
        if not self.term_structure_data:
            return {'signal': 'NEUTRAL', 'confidence': 0}
        
        data = self.term_structure_data
        signal = 'NEUTRAL'
        confidence = 0
        
        # Strong contango (VX1 < VX2) - bullish for equities
        if data['contango'] and data['ratio'] > 1.05:
            signal = 'BULLISH'
            confidence = min((data['ratio'] - 1.0) * 100, 90)
            
        # Backwardation (VX1 > VX2) - bearish/fear in market
        elif not data['contango'] and data['ratio'] < 0.95:
            signal = 'BEARISH'
            confidence = min((1.0 - data['ratio']) * 100, 90)
        
        # Analyze term structure steepness
        if abs(data['spread']) > 3:
            confidence += 10
        
        return {
            'signal': signal,
            'confidence': min(confidence, 100),
            'contango': data['contango'],
            'ratio': data['ratio'],
            'spread': data['spread']
        }
    
    def ShouldIncreaseVolatilityPositions(self):
        """
        Determine if we should increase volatility-based positions
        
        Returns:
            Boolean indicating if volatility positions should be increased
        """
        if not self.term_structure_data:
            return False
        
        # Increase vol positions when:
        # 1. Strong backwardation (market fear)
        # 2. Flat or inverted term structure
        # 3. VIX spot > front month (extreme fear)
        
        data = self.term_structure_data
        
        # Check for backwardation
        if not data['contango'] and data['ratio'] < 0.98:
            self.algo.Debug("VIX Term Structure: Backwardation detected - increase vol positions")
            return True
        
        # Check if spot > front month (extreme fear)
        if data['spot'] > data['front_month']['price'] * 1.02:
            self.algo.Debug("VIX Term Structure: Spot > Front month - extreme fear")
            return True
        
        return False
    
    def GetVolatilityRegimeFromStructure(self):
        """
        Determine volatility regime from term structure
        
        Returns:
            String describing the volatility regime
        """
        if not self.term_structure_data:
            return 'UNKNOWN'
        
        data = self.term_structure_data
        
        # Define regimes based on term structure
        if data['contango'] and data['ratio'] > 1.10:
            return 'COMPLACENT'  # Strong contango, low fear
        elif data['contango'] and data['ratio'] > 1.03:
            return 'NORMAL'  # Normal contango
        elif data['ratio'] > 0.97 and data['ratio'] < 1.03:
            return 'TRANSITIONAL'  # Flat structure
        elif not data['contango'] and data['ratio'] > 0.90:
            return 'STRESSED'  # Mild backwardation
        else:
            return 'CRISIS'  # Strong backwardation
    
    def GetTradingRecommendations(self):
        """
        Get specific trading recommendations based on term structure
        
        Returns:
            List of recommendations
        """
        recommendations = []
        
        if not self.term_structure_data:
            return recommendations
        
        regime = self.GetVolatilityRegimeFromStructure()
        data = self.term_structure_data
        
        if regime == 'COMPLACENT':
            recommendations.append({
                'action': 'SELL_VOLATILITY',
                'strategy': 'Short VIX calls or sell strangles',
                'confidence': 85,
                'reason': 'Strong contango indicates declining volatility ahead'
            })
            recommendations.append({
                'action': 'INCREASE_0DTE',
                'strategy': 'Increase Friday 0DTE positions',
                'confidence': 80,
                'reason': 'Low volatility environment favorable for premium selling'
            })
        
        elif regime == 'NORMAL':
            recommendations.append({
                'action': 'MAINTAIN',
                'strategy': 'Continue normal Tom King strategies',
                'confidence': 70,
                'reason': 'Normal market conditions'
            })
        
        elif regime == 'TRANSITIONAL':
            recommendations.append({
                'action': 'REDUCE_SIZE',
                'strategy': 'Reduce position sizes by 25%',
                'confidence': 60,
                'reason': 'Flat structure indicates potential regime change'
            })
        
        elif regime == 'STRESSED':
            recommendations.append({
                'action': 'DEFENSIVE',
                'strategy': 'Close challenged short puts, reduce 0DTE',
                'confidence': 75,
                'reason': 'Backwardation indicates rising fear'
            })
            recommendations.append({
                'action': 'BUY_PROTECTION',
                'strategy': 'Consider LEAP put ladders for protection',
                'confidence': 70,
                'reason': 'Hedge against potential volatility spike'
            })
        
        elif regime == 'CRISIS':
            recommendations.append({
                'action': 'EMERGENCY',
                'strategy': 'Close all 0DTE, reduce exposure by 50%',
                'confidence': 90,
                'reason': 'Strong backwardation indicates market crisis'
            })
            recommendations.append({
                'action': 'LONG_VOLATILITY',
                'strategy': 'Consider long VIX calls as hedge',
                'confidence': 85,
                'reason': 'Extreme fear may persist or increase'
            })
        
        return recommendations
    
    def LogTermStructure(self):
        """
        Log current term structure to debug console
        """
        if not self.term_structure_data:
            self.algo.Debug("No VIX term structure data available")
            return
        
        data = self.term_structure_data
        regime = self.GetVolatilityRegimeFromStructure()
        
        self.algo.Debug("=== VIX TERM STRUCTURE ===")
        self.algo.Debug(f"Spot VIX: {data['spot']:.2f}")
        self.algo.Debug(f"Front Month: {data['front_month']['price']:.2f} ({data['front_month']['dte']} DTE)")
        self.algo.Debug(f"Second Month: {data['second_month']['price']:.2f} ({data['second_month']['dte']} DTE)")
        self.algo.Debug(f"Structure: {'CONTANGO' if data['contango'] else 'BACKWARDATION'}")
        self.algo.Debug(f"Ratio (M2/M1): {data['ratio']:.3f}")
        self.algo.Debug(f"Spread: {data['spread']:.2f}")
        self.algo.Debug(f"Regime: {regime}")
        
        # Log recommendations
        recommendations = self.GetTradingRecommendations()
        if recommendations:
            self.algo.Debug("Recommendations:")
            for rec in recommendations:
                self.algo.Debug(f"  - {rec['action']}: {rec['strategy']} ({rec['confidence']}% confidence)")
    
    def GetHistoricalVolatilityMetrics(self):
        """
        Calculate historical volatility metrics
        
        Returns:
            Dictionary with volatility metrics
        """
        if len(self.historical_ratios) < 5:
            return None
        
        ratios = np.array(self.historical_ratios)
        
        return {
            'mean_ratio': np.mean(ratios),
            'std_ratio': np.std(ratios),
            'min_ratio': np.min(ratios),
            'max_ratio': np.max(ratios),
            'current_percentile': self.GetPercentile(ratios[-1], ratios),
            'trend': 'STEEPENING' if ratios[-1] > ratios[-5] else 'FLATTENING'
        }
    
    def GetPercentile(self, value, array):
        """
        Get percentile rank of value in array
        """
        return (np.sum(array <= value) / len(array)) * 100
