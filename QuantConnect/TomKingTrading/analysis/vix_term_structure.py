"""VIX Term Structure Analysis for volatility regime detection"""

from AlgorithmImports import *
from datetime import timedelta, datetime
import numpy as np
from typing import Dict, List, Optional, Any

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
        """Update VIX term structure data with comprehensive fallbacks"""
        try:
            # Get current VIX spot price with multiple fallbacks
            vix_spot = self._GetVIXSpotWithFallback()
            
            # Try to get VIX futures chain
            futures_data = self._GetVIXFuturesWithFallback()
            
            if futures_data['success']:
                # Use actual futures data
                self.term_structure_data = {
                    'spot': vix_spot,
                    'front_month': futures_data['front_month'],
                    'second_month': futures_data['second_month'],
                    'contango': futures_data['front_month']['price'] < futures_data['second_month']['price'],
                    'ratio': futures_data['second_month']['price'] / futures_data['front_month']['price'] 
                             if futures_data['front_month']['price'] > 0 else 1.05,  # Default contango
                    'spread': futures_data['second_month']['price'] - futures_data['front_month']['price'],
                    'timestamp': self.algo.Time,
                    'data_source': 'FUTURES_CHAIN',
                    'confidence': 0.95
                }
            else:
                # Use synthetic term structure based on VIX spot
                synthetic_data = self._GenerateSyntheticTermStructure(vix_spot)
                self.term_structure_data = synthetic_data
                
                self.algo.Debug(f"[WARNING] Using synthetic VIX term structure (VIX: {vix_spot:.2f})")
            
            # Validate and clean data
            self._ValidateTermStructureData()
            
            # Store historical ratio for trend analysis
            if self.term_structure_data and 'ratio' in self.term_structure_data:
                ratio = self.term_structure_data['ratio']
                # Sanity check: ratios should be between 0.8 and 1.3
                if 0.8 <= ratio <= 1.3:
                    self.historical_ratios.append(ratio)
                    if len(self.historical_ratios) > 50:  # Keep more history for better analysis
                        self.historical_ratios.pop(0)
                
        except Exception as e:
            self.algo.Error(f"Error updating VIX term structure: {e}")
            # Use emergency fallback
            self._UseEmergencyFallback()
    
    def _GetVIXSpotWithFallback(self) -> float:
        """Get VIX spot price with multiple fallback sources"""
        try:
            # Primary: Direct VIX security
            if "VIX" in self.algo.Securities:
                vix_price = self.algo.Securities["VIX"].Price
                if vix_price > 0:
                    return vix_price
                    
            # Fallback 1: Try CBOE VIX index
            if "CBOE:VIX" in self.algo.Securities:
                vix_price = self.algo.Securities["CBOE:VIX"].Price
                if vix_price > 0:
                    return vix_price
            
            # Fallback 2: Try alternative VIX symbols
            alternative_symbols = ["VX", "VIX9D", "VIXCLS"]
            for symbol in alternative_symbols:
                try:
                    if symbol in self.algo.Securities:
                        price = self.algo.Securities[symbol].Price
                        if price > 0:
                            self.algo.Debug(f"Using {symbol} as VIX proxy: {price:.2f}")
                            return price
                except:
                    continue
            
            # Fallback 3: Calculate implied VIX from SPY options (simplified)
            spy_implied_vol = self._EstimateImpliedVolFromSPY()
            if spy_implied_vol > 0:
                estimated_vix = spy_implied_vol * 100  # Convert to VIX scale
                self.algo.Debug(f"Estimated VIX from SPY options: {estimated_vix:.2f}")
                return estimated_vix
            
            # Fallback 4: Use historical average based on market conditions
            return self._GetHistoricalVIXFallback()
            
        except Exception as e:
            self.algo.Debug(f"Error getting VIX spot: {e}")
            return 20.0  # Long-term VIX average
    
    def _GetVIXFuturesWithFallback(self) -> Dict:
        """Get VIX futures data with fallback methods"""
        try:
            # Primary: Try to get actual VIX futures chain
            chains = self.algo.CurrentSlice.FutureChains
            if self.vix_future_symbol in chains:
                chain = chains[self.vix_future_symbol]
                if chain and len(chain) >= 2:
                    contracts = sorted(chain, key=lambda x: x.Expiry)
                    
                    front_month = contracts[0]
                    second_month = contracts[1]
                    
                    # Validate prices are reasonable
                    if (front_month.LastPrice > 0 and second_month.LastPrice > 0 and
                        5 < front_month.LastPrice < 100 and 5 < second_month.LastPrice < 100):
                        
                        return {
                            'success': True,
                            'front_month': {
                                'price': front_month.LastPrice,
                                'expiry': front_month.Expiry,
                                'dte': (front_month.Expiry - self.algo.Time).days
                            },
                            'second_month': {
                                'price': second_month.LastPrice,
                                'expiry': second_month.Expiry,
                                'dte': (second_month.Expiry - self.algo.Time).days
                            }
                        }
            
            # Fallback: Try to get individual VIX future symbols
            try:
                from datetime import datetime, timedelta
                
                # Try to construct VIX future symbols for current and next month
                current_month_symbol = self._ConstructVIXFutureSymbol(0)  # Current month
                next_month_symbol = self._ConstructVIXFutureSymbol(1)     # Next month
                
                if (current_month_symbol in self.algo.Securities and 
                    next_month_symbol in self.algo.Securities):
                    
                    front_price = self.algo.Securities[current_month_symbol].Price
                    second_price = self.algo.Securities[next_month_symbol].Price
                    
                    if front_price > 0 and second_price > 0:
                        return {
                            'success': True,
                            'front_month': {
                                'price': front_price,
                                'expiry': self._GetNextVIXExpiry(0),
                                'dte': self._GetDaysToVIXExpiry(0)
                            },
                            'second_month': {
                                'price': second_price,
                                'expiry': self._GetNextVIXExpiry(1),
                                'dte': self._GetDaysToVIXExpiry(1)
                            }
                        }
            except Exception as construct_error:
                self.algo.Debug(f"VIX future symbol construction failed: {construct_error}")
            
            return {'success': False, 'reason': 'No VIX futures data available'}
            
        except Exception as e:
            self.algo.Debug(f"Error getting VIX futures: {e}")
            return {'success': False, 'reason': f'Error: {e}'}
    
    def _GenerateSyntheticTermStructure(self, vix_spot: float) -> Dict:
        """Generate synthetic term structure when futures data unavailable"""
        try:
            # Use historical relationships to estimate term structure
            # VIX term structure typically shows contango (upward sloping)
            
            # Base the synthetic structure on current VIX level and historical patterns
            if vix_spot < 15:  # Low vol environment
                # Typically steep contango
                front_month_premium = 1.02  # 2% premium to spot
                second_month_premium = 1.08  # 8% premium to spot
            elif vix_spot < 25:  # Normal environment
                # Moderate contango
                front_month_premium = 1.01
                second_month_premium = 1.04
            elif vix_spot < 35:  # Elevated volatility
                # Flat or slight contango
                front_month_premium = 1.00
                second_month_premium = 1.01
            else:  # Crisis/panic levels
                # Backwardation (downward sloping)
                front_month_premium = 0.98
                second_month_premium = 0.95
            
            front_month_price = vix_spot * front_month_premium
            second_month_price = vix_spot * second_month_premium
            
            # Calculate synthetic expiry dates (VIX futures expire on Wednesdays)
            front_expiry = self._GetNextVIXExpiry(0)
            second_expiry = self._GetNextVIXExpiry(1)
            
            return {
                'spot': vix_spot,
                'front_month': {
                    'price': front_month_price,
                    'expiry': front_expiry,
                    'dte': (front_expiry - self.algo.Time).days
                },
                'second_month': {
                    'price': second_month_price,
                    'expiry': second_expiry,
                    'dte': (second_expiry - self.algo.Time).days
                },
                'contango': front_month_price < second_month_price,
                'ratio': second_month_price / front_month_price if front_month_price > 0 else 1.02,
                'spread': second_month_price - front_month_price,
                'timestamp': self.algo.Time,
                'data_source': 'SYNTHETIC',
                'confidence': 0.6  # Lower confidence for synthetic data
            }
            
        except Exception as e:
            self.algo.Error(f"Error generating synthetic term structure: {e}")
            return self._GetDefaultTermStructure(vix_spot)
    
    def _EstimateImpliedVolFromSPY(self) -> float:
        """Estimate implied volatility from SPY options as VIX proxy with comprehensive fallbacks"""
        try:
            # Method 1: Try to get SPY from securities
            if "SPY" not in self.algo.Securities:
                try:
                    self.algo.AddEquity("SPY", Resolution.Minute)
                    self.algo.Debug("[ADDED] Added SPY for VIX proxy calculation")
                except:
                    pass
            
            spy_price = 0
            if "SPY" in self.algo.Securities:
                spy_price = self.algo.Securities["SPY"].Price
            
            # Method 2: Use QuantConnect's ImpliedVolatilityRankIndicator if available
            if hasattr(self.algo, 'ImpliedVolatility'):
                spy_iv_data = self.algo.ImpliedVolatility.get("SPY")
                if spy_iv_data and spy_iv_data.Current.Value > 0:
                    iv_value = spy_iv_data.Current.Value
                    self.algo.Debug(f"[SUCCESS] Got SPY IV from indicator: {iv_value:.3f}")
                    return iv_value
            
            # Method 3: Try to get SPY options chain and calculate ATM IV
            if hasattr(self.algo, 'CurrentSlice') and self.algo.CurrentSlice:
                option_chains = self.algo.CurrentSlice.OptionChains
                for kvp in option_chains:
                    chain = kvp.Value
                    if chain.Underlying.Symbol.Value == "SPY":
                        # Find ATM options
                        calls = [x for x in chain if x.Right == OptionRight.Call and abs(x.Strike - spy_price) < 5]
                        if calls:
                            atm_call = min(calls, key=lambda x: abs(x.Strike - spy_price))
                            if hasattr(atm_call, 'ImpliedVolatility') and atm_call.ImpliedVolatility > 0:
                                iv_value = atm_call.ImpliedVolatility
                                self.algo.Debug(f"[SUCCESS] Got SPY ATM IV from options: {iv_value:.3f}")
                                return iv_value
            
            # Method 4: Historical volatility estimation using SPY price movements
            if spy_price > 0:
                try:
                    # Get historical data if available
                    if hasattr(self.algo, 'History'):
                        history = self.algo.History("SPY", 30, Resolution.Daily)  # 30 days
                        if not history.empty:
                            returns = history['close'].pct_change().dropna()
                            if len(returns) > 10:
                                historical_vol = returns.std() * (252 ** 0.5)  # Annualized
                                # VIX typically 0.8-1.2x historical vol
                                estimated_vix = historical_vol * 1.0
                                self.algo.Debug(f"[SUCCESS] Calculated SPY historical vol as VIX proxy: {estimated_vix:.3f}")
                                return max(0.10, min(estimated_vix, 0.80))  # Cap between 10%-80%
                except Exception as hist_error:
                    self.algo.Debug(f"Error calculating historical volatility: {hist_error}")
            
            # Method 5: Market regime-based estimation
            current_hour = self.algo.Time.hour
            if current_hour < 10:  # Pre-market usually higher vol
                base_vol = 0.22
            elif current_hour > 15:  # Late day usually higher vol
                base_vol = 0.24
            else:  # Mid-day usually lower vol
                base_vol = 0.20
            
            # Add market stress indicator if VIX data is stale
            if hasattr(self.algo, 'Portfolio'):
                portfolio_change = self.algo.Portfolio.TotalPortfolioValue / self.algo.Portfolio.StartingCash - 1.0
                if portfolio_change < -0.02:  # 2% portfolio decline suggests stress
                    base_vol *= 1.25  # Increase vol assumption
            
            self.algo.Debug(f"[DATA] Using regime-based VIX estimate: {base_vol:.3f}")
            return max(0.12, min(base_vol, 0.60))  # Reasonable bounds
            
        except Exception as e:
            self.algo.Debug(f"Error in comprehensive SPY IV estimation: {e}")
            # Final fallback: Use market open/close volatility difference
            current_hour = self.algo.Time.hour
            if 9 <= current_hour <= 16:  # Market hours
                return 0.18  # Lower vol during market hours
            else:
                return 0.25  # Higher vol during pre/post market
    
    def _GetHistoricalVIXFallback(self) -> float:
        """Get VIX fallback based on historical patterns and current market"""
        try:
            # Use current market conditions to estimate VIX
            current_time = self.algo.Time
            
            # Check if we have SPY for market stress indicator
            if "SPY" in self.algo.Securities:
                spy_price = self.algo.Securities["SPY"].Price
                
                # Very rough approximation based on market levels
                if spy_price > 450:  # High market levels (2024+ levels)
                    return 16.0  # Typically lower VIX
                elif spy_price > 400:
                    return 18.0
                elif spy_price > 350:
                    return 22.0
                else:
                    return 28.0  # Market stress
            
            # Default based on time of year (seasonal patterns)
            month = current_time.month
            if month in [1, 10, 11, 12]:  # Historically higher vol months
                return 22.0
            elif month in [6, 7, 8]:  # Summer doldrums
                return 16.0
            else:
                return 19.0  # Average
                
        except Exception as e:
            self.algo.Debug(f"Error with historical VIX fallback: {e}")
            return 20.0  # Long-term average
    
    def _ConstructVIXFutureSymbol(self, months_out: int) -> str:
        """Construct VIX future symbol for given months ahead"""
        try:
            # VIX futures typically use format like VX followed by expiry info
            # This is simplified - real implementation would use proper symbol construction
            base_symbol = "VX"
            current_date = self.algo.Time
            
            # Add months to current date
            target_month = current_date.month + months_out
            target_year = current_date.year
            
            if target_month > 12:
                target_month -= 12
                target_year += 1
            
            # Simplified symbol construction - real implementation would be more precise
            return f"{base_symbol}{target_year}{target_month:02d}"
            
        except Exception as e:
            self.algo.Debug(f"Error constructing VIX symbol: {e}")
            return "VX"
    
    def _GetNextVIXExpiry(self, months_out: int) -> datetime:
        """Get next VIX expiry date (typically 3rd Wednesday of month)"""
        try:
            from datetime import datetime, timedelta
            
            current_date = self.algo.Time
            target_month = current_date.month + months_out
            target_year = current_date.year
            
            if target_month > 12:
                target_month -= 12
                target_year += 1
            
            # Find 3rd Wednesday of target month (simplified)
            first_day = datetime(target_year, target_month, 1)
            
            # Find first Wednesday
            days_to_wednesday = (2 - first_day.weekday()) % 7
            first_wednesday = first_day + timedelta(days=days_to_wednesday)
            
            # Third Wednesday is 14 days later
            third_wednesday = first_wednesday + timedelta(days=14)
            
            return third_wednesday
            
        except Exception as e:
            self.algo.Debug(f"Error calculating VIX expiry: {e}")
            return self.algo.Time + timedelta(days=30)  # Fallback
    
    def _GetDaysToVIXExpiry(self, months_out: int) -> int:
        """Get days to VIX expiry"""
        try:
            expiry_date = self._GetNextVIXExpiry(months_out)
            return (expiry_date - self.algo.Time).days
        except:
            return 30 + (months_out * 30)  # Rough estimate
    
    def _ValidateTermStructureData(self) -> None:
        """Validate and clean term structure data"""
        try:
            if not self.term_structure_data:
                return
            
            data = self.term_structure_data
            
            # Validate prices are reasonable
            if 'front_month' in data and 'second_month' in data:
                front_price = data['front_month']['price']
                second_price = data['second_month']['price']
                
                # Sanity checks
                if front_price <= 0 or front_price > 200:
                    self.algo.Debug(f"[WARNING] Invalid front month price: {front_price}")
                    data['front_month']['price'] = data['spot'] * 1.01
                
                if second_price <= 0 or second_price > 200:
                    self.algo.Debug(f"[WARNING] Invalid second month price: {second_price}")
                    data['second_month']['price'] = data['spot'] * 1.03
                
                # Recalculate derived values
                data['contango'] = data['front_month']['price'] < data['second_month']['price']
                data['ratio'] = (data['second_month']['price'] / data['front_month']['price'] 
                               if data['front_month']['price'] > 0 else 1.02)
                data['spread'] = data['second_month']['price'] - data['front_month']['price']
                
        except Exception as e:
            self.algo.Error(f"Error validating term structure data: {e}")
    
    def _UseEmergencyFallback(self) -> None:
        """Use emergency fallback when all else fails"""
        try:
            emergency_vix = 20.0  # Long-term VIX average
            
            self.term_structure_data = self._GetDefaultTermStructure(emergency_vix)
            self.algo.Debug(f"[EMERGENCY] Using emergency VIX term structure fallback (VIX: {emergency_vix})")
            
        except Exception as e:
            self.algo.Error(f"Emergency fallback failed: {e}")
    
    def _GetDefaultTermStructure(self, vix_spot: float) -> Dict:
        """Get default term structure based on long-term averages"""
        try:
            # Default to normal market conditions with slight contango
            front_price = vix_spot * 1.01
            second_price = vix_spot * 1.03
            
            return {
                'spot': vix_spot,
                'front_month': {
                    'price': front_price,
                    'expiry': self.algo.Time + timedelta(days=21),
                    'dte': 21
                },
                'second_month': {
                    'price': second_price,
                    'expiry': self.algo.Time + timedelta(days=51),
                    'dte': 51
                },
                'contango': True,
                'ratio': 1.02,
                'spread': second_price - front_price,
                'timestamp': self.algo.Time,
                'data_source': 'DEFAULT_FALLBACK',
                'confidence': 0.3  # Low confidence
            }
            
        except Exception as e:
            self.algo.Error(f"Error creating default term structure: {e}")
            return {}
    
    def GetDataQuality(self) -> Dict:
        """Get data quality metrics for term structure"""
        try:
            if not self.term_structure_data:
                return {'quality': 'NO_DATA', 'confidence': 0.0, 'source': 'NONE'}
            
            data_source = self.term_structure_data.get('data_source', 'UNKNOWN')
            confidence = self.term_structure_data.get('confidence', 0.5)
            
            # Determine quality rating
            if data_source == 'FUTURES_CHAIN' and confidence >= 0.9:
                quality = 'EXCELLENT'
            elif data_source == 'FUTURES_CHAIN' and confidence >= 0.7:
                quality = 'GOOD'
            elif data_source == 'SYNTHETIC' and confidence >= 0.6:
                quality = 'FAIR'
            elif data_source in ['DEFAULT_FALLBACK', 'EMERGENCY']:
                quality = 'POOR'
            else:
                quality = 'UNKNOWN'
            
            age_minutes = (self.algo.Time - self.term_structure_data.get('timestamp', self.algo.Time)).total_seconds() / 60
            
            return {
                'quality': quality,
                'confidence': confidence,
                'source': data_source,
                'age_minutes': age_minutes,
                'staleness': 'FRESH' if age_minutes < 5 else 'STALE' if age_minutes < 60 else 'VERY_STALE'
            }
            
        except Exception as e:
            self.algo.Debug(f"Error getting data quality: {e}")
            return {'quality': 'ERROR', 'confidence': 0.0, 'source': 'ERROR'}
    
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
        Get specific trading recommendations based on term structure with confidence weighting
        
        Returns:
            List of recommendations with data quality considerations
        """
        recommendations = []
        
        if not self.term_structure_data:
            # No data available - provide conservative recommendation
            recommendations.append({
                'action': 'MAINTAIN',
                'strategy': 'Use conservative position sizing due to no VIX data',
                'confidence': 30,
                'reason': 'No VIX term structure data available - avoid aggressive strategies',
                'data_quality': 'NO_DATA'
            })
            return recommendations
        
        regime = self.GetVolatilityRegimeFromStructure()
        data = self.term_structure_data
        data_quality = self.GetDataQuality()
        
        # Adjust confidence based on data quality
        quality_multiplier = {
            'EXCELLENT': 1.0,
            'GOOD': 0.9,
            'FAIR': 0.7,
            'POOR': 0.5,
            'NO_DATA': 0.3,
            'ERROR': 0.2
        }.get(data_quality['quality'], 0.5)
        
        if regime == 'COMPLACENT':
            recommendations.append({
                'action': 'SELL_VOLATILITY',
                'strategy': 'Short VIX calls or sell strangles',
                'confidence': int(85 * quality_multiplier),
                'reason': 'Strong contango indicates declining volatility ahead',
                'data_quality': data_quality['quality'],
                'term_structure_ratio': data.get('ratio', 1.02)
            })
            recommendations.append({
                'action': 'INCREASE_0DTE',
                'strategy': 'Increase Friday 0DTE positions',
                'confidence': int(80 * quality_multiplier),
                'reason': 'Low volatility environment favorable for premium selling',
                'data_quality': data_quality['quality']
            })
        
        elif regime == 'NORMAL':
            recommendations.append({
                'action': 'MAINTAIN',
                'strategy': 'Continue normal Tom King strategies',
                'confidence': int(70 * quality_multiplier),
                'reason': 'Normal market conditions',
                'data_quality': data_quality['quality']
            })
        
        elif regime == 'TRANSITIONAL':
            recommendations.append({
                'action': 'REDUCE_SIZE',
                'strategy': 'Reduce position sizes by 25%',
                'confidence': int(60 * quality_multiplier),
                'reason': 'Flat structure indicates potential regime change',
                'data_quality': data_quality['quality']
            })
        
        elif regime == 'STRESSED':
            recommendations.append({
                'action': 'DEFENSIVE',
                'strategy': 'Close challenged short puts, reduce 0DTE',
                'confidence': int(75 * quality_multiplier),
                'reason': 'Backwardation indicates rising fear',
                'data_quality': data_quality['quality']
            })
            recommendations.append({
                'action': 'BUY_PROTECTION',
                'strategy': 'Consider LEAP put ladders for protection',
                'confidence': int(70 * quality_multiplier),
                'reason': 'Hedge against potential volatility spike',
                'data_quality': data_quality['quality']
            })
        
        elif regime == 'CRISIS':
            recommendations.append({
                'action': 'EMERGENCY',
                'strategy': 'Close all 0DTE, reduce exposure by 50%',
                'confidence': int(90 * quality_multiplier),
                'reason': 'Strong backwardation indicates market crisis',
                'data_quality': data_quality['quality']
            })
            recommendations.append({
                'action': 'LONG_VOLATILITY',
                'strategy': 'Consider long VIX calls as hedge',
                'confidence': int(85 * quality_multiplier),
                'reason': 'Extreme fear may persist or increase',
                'data_quality': data_quality['quality']
            })
        
        # Add data quality warning if needed
        if data_quality['quality'] in ['POOR', 'NO_DATA', 'ERROR']:
            recommendations.append({
                'action': 'DATA_WARNING',
                'strategy': f"VIX data quality is {data_quality['quality']} - use extra caution",
                'confidence': 95,
                'reason': f"Data source: {data_quality.get('source', 'UNKNOWN')}, Confidence: {data_quality.get('confidence', 0):.0%}",
                'data_quality': data_quality['quality']
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
        data_quality = self.GetDataQuality()
        
        self.algo.Debug("=== VIX TERM STRUCTURE ===")
        self.algo.Debug(f"Spot VIX: {data['spot']:.2f}")
        self.algo.Debug(f"Front Month: {data['front_month']['price']:.2f} ({data['front_month']['dte']} DTE)")
        self.algo.Debug(f"Second Month: {data['second_month']['price']:.2f} ({data['second_month']['dte']} DTE)")
        self.algo.Debug(f"Structure: {'CONTANGO' if data['contango'] else 'BACKWARDATION'}")
        self.algo.Debug(f"Ratio (M2/M1): {data['ratio']:.3f}")
        self.algo.Debug(f"Spread: {data['spread']:.2f}")
        self.algo.Debug(f"Regime: {regime}")
        self.algo.Debug(f"Data Source: {data.get('data_source', 'UNKNOWN')}")
        self.algo.Debug(f"Data Quality: {data_quality['quality']} (Confidence: {data_quality.get('confidence', 0):.0%})")
        
        # Show historical context if available
        hist_metrics = self.GetHistoricalVolatilityMetrics()
        if hist_metrics and hist_metrics['quality'] != 'ERROR':
            self.algo.Debug(f"Historical Context: {hist_metrics['current_percentile']:.0f}th percentile, Trend: {hist_metrics['trend']}")
        
        # Log recommendations
        recommendations = self.GetTradingRecommendations()
        if recommendations:
            self.algo.Debug("Recommendations:")
            for rec in recommendations:
                quality_note = f" [Data: {rec.get('data_quality', 'UNKNOWN')}]" if rec.get('data_quality') else ""
                self.algo.Debug(f"  - {rec['action']}: {rec['strategy']} ({rec['confidence']}% confidence){quality_note}")
    
    def ForceRefresh(self) -> bool:
        """
        Force refresh of term structure data
        
        Returns:
            True if refresh successful
        """
        try:
            self.algo.Debug(" Forcing VIX term structure refresh...")
            
            # Clear old data
            old_data = self.term_structure_data.copy() if self.term_structure_data else {}
            
            # Update with fresh data
            self.UpdateTermStructure()
            
            # Check if we got new data
            if self.term_structure_data:
                new_timestamp = self.term_structure_data.get('timestamp', self.algo.Time)
                old_timestamp = old_data.get('timestamp', datetime.min)
                
                if new_timestamp > old_timestamp:
                    self.algo.Debug(f"[SUCCESS] VIX term structure refreshed successfully")
                    return True
                else:
                    self.algo.Debug(f"[WARNING] VIX term structure refresh - no new data")
                    return False
            else:
                self.algo.Debug(f" VIX term structure refresh failed")
                return False
                
        except Exception as e:
            self.algo.Error(f"Error forcing VIX refresh: {e}")
            return False
    
    def GetHistoricalVolatilityMetrics(self):
        """
        Calculate historical volatility metrics with fallbacks
        
        Returns:
            Dictionary with volatility metrics
        """
        try:
            if len(self.historical_ratios) < 2:
                # Insufficient data - return default metrics
                return {
                    'mean_ratio': 1.02,  # Typical contango
                    'std_ratio': 0.05,   # Low volatility of ratios
                    'min_ratio': 0.95,   # Mild backwardation
                    'max_ratio': 1.15,   # Strong contango
                    'current_percentile': 50.0,  # Median
                    'trend': 'STABLE',
                    'data_points': len(self.historical_ratios),
                    'quality': 'INSUFFICIENT_DATA'
                }
            
            ratios = np.array(self.historical_ratios)
            
            # Calculate current percentile
            current_percentile = self.GetPercentile(ratios[-1], ratios) if len(ratios) > 1 else 50.0
            
            # Determine trend
            trend = 'STABLE'
            if len(ratios) >= 5:
                recent_avg = np.mean(ratios[-3:])
                older_avg = np.mean(ratios[-6:-3]) if len(ratios) >= 6 else np.mean(ratios[:-3])
                
                if recent_avg > older_avg + 0.01:
                    trend = 'STEEPENING'  # Moving toward contango
                elif recent_avg < older_avg - 0.01:
                    trend = 'FLATTENING'  # Moving toward backwardation
            elif len(ratios) >= 3:
                if ratios[-1] > ratios[-3]:
                    trend = 'STEEPENING'
                elif ratios[-1] < ratios[-3]:
                    trend = 'FLATTENING'
            
            # Quality assessment
            if len(ratios) >= 20:
                quality = 'HIGH'
            elif len(ratios) >= 10:
                quality = 'MEDIUM'
            elif len(ratios) >= 5:
                quality = 'LOW'
            else:
                quality = 'VERY_LOW'
            
            return {
                'mean_ratio': float(np.mean(ratios)),
                'std_ratio': float(np.std(ratios)),
                'min_ratio': float(np.min(ratios)),
                'max_ratio': float(np.max(ratios)),
                'current_percentile': current_percentile,
                'trend': trend,
                'data_points': len(ratios),
                'quality': quality,
                'current_ratio': float(ratios[-1]) if len(ratios) > 0 else 1.02,
                'volatility_of_structure': float(np.std(ratios)) if len(ratios) > 1 else 0.05
            }
            
        except Exception as e:
            self.algo.Error(f"Error calculating volatility metrics: {e}")
            # Return safe fallback metrics
            return {
                'mean_ratio': 1.02,
                'std_ratio': 0.05,
                'min_ratio': 0.95,
                'max_ratio': 1.15,
                'current_percentile': 50.0,
                'trend': 'STABLE',
                'data_points': 0,
                'quality': 'ERROR',
                'error': str(e)
            }
    
    def GetPercentile(self, value, array):
        """
        Get percentile rank of value in array
        """
        # Safe division for percentile calculation
        try:
            if len(array) == 0:
                return 50.0  # Default to median if no data
            
            # Convert to numpy array if not already
            if not isinstance(array, np.ndarray):
                array = np.array(array)
            
            if len(array) == 1:
                return 50.0  # Single data point is at median
            
            # Calculate percentile rank
            percentile = (np.sum(array <= value) / len(array)) * 100
            
            # Ensure reasonable bounds
            return max(0.0, min(100.0, percentile))
            
        except Exception as e:
            self.algo.Debug(f"Error calculating percentile: {e}")
            return 50.0  # Safe fallback