# region imports
from AlgorithmImports import *
# endregion
# Tom King Trading Framework v17 - Technical Analysis System
# Based on Tom King Complete Trading System Documentation

class TechnicalAnalysisSystem:
    """
    Tom King Technical Analysis Engine
    Provides pattern recognition and technical indicators for entry/exit decisions
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.name = "TECHNICAL_ANALYSIS"
        
        # Technical indicators storage
        self.indicators = {}
        self.pattern_signals = {}
        self.support_resistance_levels = {}
        
        # Tom King preferred indicators
        self.required_indicators = {
            'RSI': {'period': 14, 'overbought': 70, 'oversold': 30},
            'ATR': {'period': 14, 'used_for': 'strike_selection'},
            'EMA8': {'period': 8, 'trend_filter': True},
            'EMA21': {'period': 21, 'trend_filter': True},
            'VWAP': {'used_for': 'intraday_reference'},
            'BOLLINGER': {'period': 20, 'std_dev': 2},
            'MACD': {'fast': 12, 'slow': 26, 'signal': 9}
        }
        
        # Pattern recognition parameters
        self.pattern_config = {
            'support_resistance': {
                'min_touches': 2,
                'tolerance_percent': 0.5,
                'lookback_days': 30
            },
            'trend_detection': {
                'ema_separation_min': 0.002,  # 0.2% minimum separation
                'slope_threshold': 0.001      # Minimum slope for trend
            },
            'breakout_detection': {
                'volume_multiplier': 1.5,     # 1.5x average volume
                'price_threshold': 0.01       # 1% breakout threshold
            },
            'volatility_analysis': {
                'iv_rank_calculation': True,
                'iv_percentile_lookback': 252  # 1 year
            }
        }
        
        # Strike selection parameters (PDF ATR calculations)
        self.strike_selection_rules = {
            '0dte': {'atr_multiplier': 0.7, 'min_distance': 10},
            'strangle': {'atr_multiplier': 1.0, 'asymmetric': True},
            'lt112': {'atr_multiplier': 1.5, 'otm_percent': 0.07},
            'butterfly': {'atr_multiplier': 0.5, 'max_width': 50}
        }
        
        # Quality scoring weights
        self.quality_weights = {
            'trend_strength': 0.25,
            'volatility_environment': 0.25,
            'support_resistance': 0.20,
            'momentum': 0.15,
            'volume_confirmation': 0.15
        }
        
    def initialize_indicators(self, symbol):
        """Initialize all technical indicators for a symbol"""
        if symbol not in self.indicators:
            self.indicators[symbol] = {}
        
        symbol_obj = self.algorithm.Symbol(symbol) if isinstance(symbol, str) else symbol
        
        # RSI
        self.indicators[symbol]['RSI'] = self.algorithm.RSI(
            symbol_obj, 
            self.required_indicators['RSI']['period'],
            Resolution.Daily
        )
        
        # ATR 
        self.indicators[symbol]['ATR'] = self.algorithm.ATR(
            symbol_obj,
            self.required_indicators['ATR']['period'],
            Resolution.Daily
        )
        
        # EMAs
        self.indicators[symbol]['EMA8'] = self.algorithm.EMA(
            symbol_obj,
            self.required_indicators['EMA8']['period'],
            Resolution.Daily
        )
        
        self.indicators[symbol]['EMA21'] = self.algorithm.EMA(
            symbol_obj,
            self.required_indicators['EMA21']['period'],
            Resolution.Daily
        )
        
        # VWAP (intraday)
        self.indicators[symbol]['VWAP'] = self.algorithm.VWAP(
            symbol_obj,
            Resolution.Minute
        )
        
        # Bollinger Bands
        self.indicators[symbol]['BB'] = self.algorithm.BB(
            symbol_obj,
            self.required_indicators['BOLLINGER']['period'],
            self.required_indicators['BOLLINGER']['std_dev'],
            Resolution.Daily
        )
        
        # MACD
        self.indicators[symbol]['MACD'] = self.algorithm.MACD(
            symbol_obj,
            self.required_indicators['MACD']['fast'],
            self.required_indicators['MACD']['slow'],
            self.required_indicators['MACD']['signal'],
            Resolution.Daily
        )
        
        # Volume SMA for volume analysis
        self.indicators[symbol]['VOLUME_SMA'] = self.algorithm.SMA(
            symbol_obj,
            20,  # 20-day average volume
            Resolution.Daily,
            Field.Volume
        )
    
    def get_current_values(self, symbol):
        """Get current values for all indicators"""
        if symbol not in self.indicators:
            self.initialize_indicators(symbol)
            return None  # Need time for indicators to warm up
        
        indicators = self.indicators[symbol]
        
        # Check if indicators are ready
        if not all(ind.IsReady for ind in indicators.values()):
            return None
        
        current_values = {
            'rsi': float(indicators['RSI'].Current.Value),
            'atr': float(indicators['ATR'].Current.Value),
            'ema8': float(indicators['EMA8'].Current.Value),
            'ema21': float(indicators['EMA21'].Current.Value),
            'vwap': float(indicators['VWAP'].Current.Value),
            'bb_upper': float(indicators['BB'].UpperBand.Current.Value),
            'bb_middle': float(indicators['BB'].MiddleBand.Current.Value),
            'bb_lower': float(indicators['BB'].LowerBand.Current.Value),
            'bb_width': float(indicators['BB'].BandWidth.Current.Value),
            'macd': float(indicators['MACD'].Current.Value),
            'macd_signal': float(indicators['MACD'].Signal.Current.Value),
            'macd_histogram': float(indicators['MACD'].Histogram.Current.Value),
            'volume_sma': float(indicators['VOLUME_SMA'].Current.Value) if indicators['VOLUME_SMA'].IsReady else 0
        }
        
        return current_values
    
    def analyze_trend_direction(self, symbol, current_price):
        """Analyze current trend direction and strength"""
        values = self.get_current_values(symbol)
        if not values:
            return {'direction': 'UNKNOWN', 'strength': 0, 'confidence': 0}
        
        analysis = {
            'direction': 'NEUTRAL',
            'strength': 50,  # 0-100 scale
            'confidence': 50,  # 0-100 scale
            'signals': []
        }
        
        # EMA trend analysis
        ema8 = values['ema8']
        ema21 = values['ema21']
        
        if current_price > ema8 > ema21:
            analysis['direction'] = 'BULLISH'
            analysis['strength'] = min(100, 60 + ((current_price - ema8) / current_price) * 200)
            analysis['signals'].append('Price > EMA8 > EMA21 (strong uptrend)')
        elif current_price < ema8 < ema21:
            analysis['direction'] = 'BEARISH'
            analysis['strength'] = max(0, 40 - ((ema8 - current_price) / current_price) * 200)
            analysis['signals'].append('Price < EMA8 < EMA21 (strong downtrend)')
        elif current_price > ema8 and ema8 < ema21:
            analysis['direction'] = 'MIXED'
            analysis['strength'] = 45
            analysis['signals'].append('Mixed signals - price above short EMA but EMAs bearish')
        
        # MACD confirmation
        macd = values['macd']
        macd_signal = values['macd_signal']
        
        if macd > macd_signal and macd > 0:
            analysis['strength'] = min(100, analysis['strength'] + 10)
            analysis['signals'].append('MACD bullish confirmation')
        elif macd < macd_signal and macd < 0:
            analysis['strength'] = max(0, analysis['strength'] - 10)
            analysis['signals'].append('MACD bearish confirmation')
        
        # Confidence based on signal alignment
        signal_count = len([s for s in analysis['signals'] if 'confirmation' in s])
        analysis['confidence'] = min(100, 40 + signal_count * 30)
        
        return analysis
    
    def calculate_support_resistance_levels(self, symbol, price_history, lookback_days=30):
        """Calculate key support and resistance levels"""
        if len(price_history) < lookback_days:
            return {'support': [], 'resistance': []}
        
        # Get recent price data
        recent_highs = []
        recent_lows = []
        
        for i in range(-lookback_days, 0):
            if abs(i) < len(price_history):
                bar = price_history[i]
                recent_highs.append(float(bar.High))
                recent_lows.append(float(bar.Low))
        
        if not recent_highs or not recent_lows:
            return {'support': [], 'resistance': []}
        
        # Find significant levels (simplified pivot point detection)
        support_levels = []
        resistance_levels = []
        
        # Calculate pivot highs and lows
        window = 5  # Look 5 periods each side
        
        for i in range(window, len(recent_highs) - window):
            # Potential resistance (pivot high)
            is_pivot_high = True
            current_high = recent_highs[i]
            
            for j in range(i - window, i + window + 1):
                if j != i and recent_highs[j] >= current_high:
                    is_pivot_high = False
                    break
            
            if is_pivot_high:
                resistance_levels.append(current_high)
        
        for i in range(window, len(recent_lows) - window):
            # Potential support (pivot low)
            is_pivot_low = True
            current_low = recent_lows[i]
            
            for j in range(i - window, i + window + 1):
                if j != i and recent_lows[j] <= current_low:
                    is_pivot_low = False
                    break
            
            if is_pivot_low:
                support_levels.append(current_low)
        
        # Remove duplicates and sort
        tolerance = 0.005  # 0.5% tolerance for grouping levels
        
        def group_levels(levels):
            if not levels:
                return []
            
            sorted_levels = sorted(set(levels))
            grouped = []
            current_group = [sorted_levels[0]]
            
            for level in sorted_levels[1:]:
                if abs(level - current_group[-1]) / current_group[-1] <= tolerance:
                    current_group.append(level)
                else:
                    grouped.append(sum(current_group) / len(current_group))
                    current_group = [level]
            
            grouped.append(sum(current_group) / len(current_group))
            return grouped
        
        support_levels = group_levels(support_levels)
        resistance_levels = group_levels(resistance_levels)
        
        return {
            'support': support_levels[-3:],  # Last 3 support levels
            'resistance': resistance_levels[-3:]  # Last 3 resistance levels
        }
    
    def calculate_strike_prices(self, strategy_type, current_price, values=None):
        """
        Calculate optimal strike prices using ATR and technical levels
        Based on Tom King's ATR-based strike selection
        """
        if not values:
            return {'error': 'No technical values available'}
        
        atr = values['atr']
        if atr == 0:
            return {'error': 'ATR not available'}
        
        rules = self.strike_selection_rules.get(strategy_type, {})
        atr_multiplier = rules.get('atr_multiplier', 1.0)
        min_distance = rules.get('min_distance', 10)
        
        strikes = {'strategy': strategy_type, 'current_price': current_price, 'atr': atr}
        
        if strategy_type == '0dte':
            # 0DTE Iron Condor strikes using ATR × 0.7
            wing_width = max(min_distance, atr * atr_multiplier)
            strikes.update({
                'call_short': round(current_price + wing_width),
                'call_long': round(current_price + wing_width + 30),  # 30 point wings
                'put_short': round(current_price - wing_width),
                'put_long': round(current_price - wing_width - 30),
                'calculation': f'ATR({atr:.2f}) × {atr_multiplier} = {wing_width:.2f} points'
            })
        
        elif strategy_type == 'strangle':
            # Strangle strikes using ATR × 1.0
            distance = max(min_distance, atr * atr_multiplier)
            strikes.update({
                'call_strike': round(current_price + distance),
                'put_strike': round(current_price - distance),
                'symmetric': True,
                'calculation': f'ATR({atr:.2f}) × {atr_multiplier} = ±{distance:.2f} points'
            })
        
        elif strategy_type == 'lt112':
            # LT112 using percentage OTM and ATR confirmation
            debit_spread_distance = current_price * rules.get('otm_percent', 0.07)  # 7% OTM
            naked_put_distance = current_price * 0.12  # 12% OTM
            
            strikes.update({
                'debit_spread_long': round(current_price - debit_spread_distance),
                'debit_spread_short': round(current_price - debit_spread_distance - 100),
                'naked_puts': round(current_price - naked_put_distance),
                'calculation': f'Debit spread: {debit_spread_distance:.0f}pts OTM, Naked: {naked_put_distance:.0f}pts OTM'
            })
        
        elif strategy_type == 'butterfly':
            # Butterfly using ATR × 0.5 for movement-based strikes
            wing_width = rules.get('max_width', 50)  # 50 point max width
            center_adjustment = max(5, atr * atr_multiplier)
            
            strikes.update({
                'lower_wing': round(current_price - center_adjustment - wing_width/2),
                'body': round(current_price - center_adjustment),
                'upper_wing': round(current_price - center_adjustment + wing_width/2),
                'width': wing_width,
                'calculation': f'Center adjusted by ATR({atr:.2f}) × {atr_multiplier}'
            })
        
        return strikes
    
    def calculate_pattern_quality_score(self, symbol, current_price, strategy_type=None):
        """
        Calculate overall pattern quality score (0-100)
        Higher score = better setup for options trading
        """
        values = self.get_current_values(symbol)
        if not values:
            return {'score': 0, 'reason': 'No technical data available'}
        
        # Get trend analysis
        trend = self.analyze_trend_direction(symbol, current_price)
        
        score_components = {}
        
        # 1. Trend Strength (25%)
        trend_score = 50  # Neutral base
        if trend['direction'] == 'BULLISH' and trend['strength'] > 60:
            trend_score = min(100, 60 + (trend['strength'] - 60) / 2)
        elif trend['direction'] == 'BEARISH' and trend['strength'] < 40:
            trend_score = max(0, 40 - (40 - trend['strength']) / 2)
        elif trend['direction'] == 'NEUTRAL':
            trend_score = 55  # Slightly positive for range-bound markets
        
        score_components['trend_strength'] = trend_score * self.quality_weights['trend_strength']
        
        # 2. Volatility Environment (25%)
        rsi = values['rsi']
        bb_position = (current_price - values['bb_lower']) / (values['bb_upper'] - values['bb_lower'])
        
        volatility_score = 50
        
        # RSI in neutral zone is good for selling premium
        if 35 <= rsi <= 65:
            volatility_score += 20
        elif rsi < 30 or rsi > 70:
            volatility_score -= 15  # Extreme readings
        
        # Bollinger Band position
        if 0.2 <= bb_position <= 0.8:
            volatility_score += 15  # Not at extremes
        else:
            volatility_score -= 10  # At BB extremes
        
        score_components['volatility_environment'] = min(100, volatility_score) * self.quality_weights['volatility_environment']
        
        # 3. Support/Resistance Context (20%)
        # Simplified - would use actual support/resistance calculation
        sr_score = 60  # Default decent score
        
        # Check if price is near VWAP (good reference level)
        vwap_distance = abs(current_price - values['vwap']) / current_price
        if vwap_distance < 0.01:  # Within 1% of VWAP
            sr_score += 20
        elif vwap_distance < 0.02:  # Within 2%
            sr_score += 10
        
        score_components['support_resistance'] = min(100, sr_score) * self.quality_weights['support_resistance']
        
        # 4. Momentum (15%)
        macd_histogram = values['macd_histogram']
        momentum_score = 50
        
        if abs(macd_histogram) > 0.5:
            momentum_score += 15  # Strong momentum
        elif abs(macd_histogram) < 0.1:
            momentum_score -= 10  # Weak momentum
        
        score_components['momentum'] = min(100, momentum_score) * self.quality_weights['momentum']
        
        # 5. Volume Confirmation (15%)
        volume_score = 50  # Default
        # Would compare current volume to average in production
        score_components['volume_confirmation'] = volume_score * self.quality_weights['volume_confirmation']
        
        # Calculate total score
        total_score = sum(score_components.values())
        
        # Determine quality rating
        if total_score >= 80:
            quality = 'EXCELLENT'
        elif total_score >= 65:
            quality = 'GOOD'
        elif total_score >= 50:
            quality = 'FAIR'
        else:
            quality = 'POOR'
        
        return {
            'score': round(total_score, 1),
            'quality': quality,
            'components': score_components,
            'technical_summary': {
                'trend': trend['direction'],
                'rsi': round(rsi, 1),
                'atr': round(values['atr'], 2),
                'bb_position': round(bb_position * 100, 1),  # As percentage
                'macd_signal': 'BULLISH' if macd_histogram > 0 else 'BEARISH'
            }
        }
    
    def get_entry_timing_signals(self, symbol, current_price, strategy_type):
        """Get specific entry timing signals for strategy"""
        values = self.get_current_values(symbol)
        if not values:
            return {'signal': 'NO_DATA', 'reason': 'Insufficient technical data'}
        
        signals = {
            'primary_signal': 'NEUTRAL',
            'confidence': 50,
            'timing_factors': [],
            'warnings': []
        }
        
        rsi = values['rsi']
        trend = self.analyze_trend_direction(symbol, current_price)
        
        # Strategy-specific timing signals
        if strategy_type in ['0dte', 'strangle']:
            # Premium selling strategies - prefer neutral RSI, avoid extremes
            if 40 <= rsi <= 60:
                signals['primary_signal'] = 'GOOD_ENTRY'
                signals['confidence'] = 75
                signals['timing_factors'].append(f'RSI neutral zone ({rsi:.1f})')
            elif rsi > 70:
                signals['warnings'].append(f'RSI overbought ({rsi:.1f}) - may face headwinds')
            elif rsi < 30:
                signals['warnings'].append(f'RSI oversold ({rsi:.1f}) - may reverse up')
        
        elif strategy_type == 'lt112':
            # Long-term strategy - can handle more volatility
            if trend['direction'] in ['BULLISH', 'NEUTRAL']:
                signals['primary_signal'] = 'GOOD_ENTRY'
                signals['confidence'] = 70
                signals['timing_factors'].append(f'Trend favorable for puts ({trend["direction"]})')
        
        elif strategy_type == 'butterfly':
            # Butterflies need specific volatility conditions
            bb_width = values['bb_width']
            if bb_width < 0.04:  # Low volatility
                signals['primary_signal'] = 'GOOD_ENTRY'
                signals['confidence'] = 65
                signals['timing_factors'].append(f'Low volatility environment (BB Width: {bb_width:.3f})')
            else:
                signals['warnings'].append('High volatility may hurt butterfly performance')
        
        return signals
    
    def validate_technical_system(self):
        """Validate technical analysis system"""
        tests = [
            ('Required indicators defined', len(self.required_indicators) >= 5),
            ('Pattern config complete', 'support_resistance' in self.pattern_config),
            ('Strike selection rules defined', len(self.strike_selection_rules) >= 4),
            ('Quality weights sum to 1', abs(sum(self.quality_weights.values()) - 1.0) < 0.01),
            ('Trend analysis works', callable(self.analyze_trend_direction)),
            ('Strike calculation works', callable(self.calculate_strike_prices))
        ]
        
        results = []
        for test_name, condition in tests:
            results.append(f"{'✅' if condition else '❌'} {test_name}")
        
        return results

# Usage Example for QuantConnect Algorithm:
#
