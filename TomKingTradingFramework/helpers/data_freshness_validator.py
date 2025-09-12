# Data Freshness Validator - Ensures option chain data is recent and valid
# Critical for preventing trades on stale data

from AlgorithmImports import *
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

class DataFreshnessValidator:
    """
    Validates that option chain and market data is fresh
    Prevents trading on stale or suspicious data
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Maximum data age thresholds (in seconds)
        self.max_age_thresholds = {
            'option_chain': 60,      # 1 minute for option chains
            'underlying_price': 30,   # 30 seconds for underlying
            'bid_ask': 45,           # 45 seconds for bid/ask
            'greeks': 120,           # 2 minutes for Greeks (less critical)
            'iv': 180                # 3 minutes for IV
        }
        
        # Staleness tracking
        self.last_update_times = {}
        self.stale_data_counts = {}
        self.validation_history = []
        
    def validate_option_chain(self, chain, underlying_symbol: str) -> Tuple[bool, List[str]]:
        """
        Validate entire option chain freshness
        Returns (is_valid, list_of_issues)
        """
        issues = []
        
        if not chain:
            issues.append(f"Empty option chain for {underlying_symbol}")
            return False, issues
            
        current_time = self.algo.Time
        
        # Check chain update time
        chain_key = f"chain_{underlying_symbol}"
        if chain_key in self.last_update_times:
            age = (current_time - self.last_update_times[chain_key]).total_seconds()
            if age > self.max_age_thresholds['option_chain']:
                issues.append(f"Stale option chain: {age:.1f}s old (max: {self.max_age_thresholds['option_chain']}s)")
        
        # Validate individual contracts
        valid_contracts = 0
        total_contracts = 0
        
        for contract in chain:
            total_contracts += 1
            contract_issues = self.validate_option_contract(contract)
            
            if not contract_issues:
                valid_contracts += 1
            else:
                # Only log first few issues to avoid spam
                if len(issues) < 5:
                    issues.extend(contract_issues[:2])
                    
        # Check valid contract ratio
        if total_contracts > 0:
            valid_ratio = valid_contracts / total_contracts
            if valid_ratio < 0.8:  # Less than 80% valid
                issues.append(f"Low valid contract ratio: {valid_ratio:.1%} ({valid_contracts}/{total_contracts})")
                
        # Update tracking
        self.last_update_times[chain_key] = current_time
        
        is_valid = len(issues) == 0
        
        # Log validation result
        self.validation_history.append({
            'timestamp': current_time,
            'underlying': underlying_symbol,
            'is_valid': is_valid,
            'issues': issues,
            'contracts_checked': total_contracts,
            'valid_contracts': valid_contracts
        })
        
        # Alert if persistent staleness
        if not is_valid:
            self.stale_data_counts[underlying_symbol] = self.stale_data_counts.get(underlying_symbol, 0) + 1
            
            if self.stale_data_counts[underlying_symbol] >= 3:
                self.algo.Error(f"CRITICAL: Persistent stale data for {underlying_symbol}")
                if hasattr(self.algo, 'manual_mode'):
                    self.algo.manual_mode.activate_manual_mode(f"Stale data detected for {underlying_symbol}")
        else:
            self.stale_data_counts[underlying_symbol] = 0
            
        return is_valid, issues
        
    def validate_option_contract(self, contract) -> List[str]:
        """Validate individual option contract data"""
        issues = []
        
        try:
            if hasattr(contract, 'BidPrice') and hasattr(contract, 'AskPrice'):
                bid = contract.BidPrice
        ask = contract.AskPrice
        except Exception as e:

            # Check bid/ask spread
                
                # Check for valid bid/ask
                if bid <= 0 or ask <= 0:
                    issues.append(f"Invalid bid/ask: {bid}/{ask}")
                elif ask < bid:
                    issues.append(f"Inverted bid/ask: {bid}/{ask}")
                else:
                    # Check for excessive spread
                    spread = ask - bid
                    mid = (bid + ask) / 2
                    if mid > 0:
                        spread_pct = spread / mid
                        if spread_pct > 0.5:  # 50% spread
                            issues.append(f"Excessive spread: {spread_pct:.1%}")
                            
            # Check last trade time if available
            if hasattr(contract, 'LastUpdated'):
                age = (self.algo.Time - contract.LastUpdated).total_seconds()
                if age > self.max_age_thresholds['bid_ask']:
                    issues.append(f"Stale quote: {age:.1f}s old")
                    
            # Check volume/OI if available
            if hasattr(contract, 'Volume') and hasattr(contract, 'OpenInterest'):
                if contract.Volume == 0 and contract.OpenInterest < 10:
                    issues.append("No volume and low OI")
                    
        except Exception as e:
            issues.append(f"Validation error: {str(e)}")
            
        return issues
        
    def validate_underlying_price(self, symbol) -> Tuple[bool, float, str]:
        """
        Validate underlying price is fresh
        Returns (is_valid, price, issue_description)
        """
        try:
            pass
        except Exception as e:

            if symbol not in self.algo.Securities:
                return False, 0, f"{symbol} not in Securities"
                
            security = self.algo.Securities[symbol]
            price = security.Price
            
            # Check price validity
            if price <= 0:
                return False, price, "Invalid price <= 0"
                
            # Check last update time
            if hasattr(security, 'LocalTime'):
                age = (self.algo.Time - security.LocalTime).total_seconds()
                if age > self.max_age_thresholds['underlying_price']:
                    return False, price, f"Stale price: {age:.1f}s old"
                    
            # Check for market hours (if equity)
            if security.Type == SecurityType.Equity:
                if not self.algo.IsMarketOpen(symbol):
                    # Price might be stale outside market hours
                    return True, price, "Market closed (price may be stale)"
                    
            return True, price, ""
            
        except Exception as e:
            return False, 0, f"Error validating price: {str(e)}"
            
    def validate_greeks(self, greeks: Dict) -> Tuple[bool, List[str]]:
        """
        Validate Greeks calculations are reasonable
        Returns (is_valid, list_of_issues)
        """
        issues = []
        
        # Check delta bounds (-1 to 1 for single option)
        if 'delta' in greeks:
            if abs(greeks['delta']) > 1.1:  # Allow small numerical error
                issues.append(f"Delta out of bounds: {greeks['delta']}")
                
        # Check gamma bounds (should be positive and reasonable)
        if 'gamma' in greeks:
            if greeks['gamma'] < -0.01:  # Should never be significantly negative
                issues.append(f"Negative gamma: {greeks['gamma']}")
            elif greeks['gamma'] > 1:  # Extremely high gamma
                issues.append(f"Excessive gamma: {greeks['gamma']}")
                
        # Check theta (should generally be negative for long options)
        if 'theta' in greeks:
            if greeks['theta'] > 1:  # Positive theta unusual for single long option
                issues.append(f"Unusual positive theta: {greeks['theta']}")
                
        # Check vega (should be positive for long options)
        if 'vega' in greeks:
            if greeks['vega'] < -0.01:  # Should not be significantly negative
                issues.append(f"Negative vega: {greeks['vega']}")
                
        # Check IV bounds
        if 'iv' in greeks:
            if greeks['iv'] <= 0:
                issues.append("Invalid IV <= 0")
            elif greeks['iv'] > 5:  # 500% IV unrealistic
                issues.append(f"Excessive IV: {greeks['iv']:.1%}")
                
        return len(issues) == 0, issues
        
    def check_market_conditions(self) -> Dict:
        """Check overall market data conditions"""
        
        conditions = {
            'is_market_open': False,
            'spy_data_fresh': False,
            'vix_data_fresh': False,
            'options_tradeable': False,
            'data_quality_score': 0,
            'issues': []
        }
        
        # Check SPY
        spy_valid, spy_price, spy_issue = self.validate_underlying_price("SPY")
        conditions['spy_data_fresh'] = spy_valid
        if not spy_valid:
            conditions['issues'].append(f"SPY: {spy_issue}")
            
        # Check VIX if used
        if "VIX" in self.algo.Securities:
            vix_valid, vix_price, vix_issue = self.validate_underlying_price("VIX")
            conditions['vix_data_fresh'] = vix_valid
            if not vix_valid:
                conditions['issues'].append(f"VIX: {vix_issue}")
        else:
            conditions['vix_data_fresh'] = True  # Not using VIX
            
        # Check market hours
        conditions['is_market_open'] = self.algo.IsMarketOpen("SPY")
        
        # Check if options are tradeable
        current_time = self.algo.Time
        if current_time.hour >= 9 and current_time.hour < 16:
            if current_time.hour == 9 and current_time.minute < 30:
                conditions['options_tradeable'] = False
                conditions['issues'].append("Options market not yet open")
            else:
                conditions['options_tradeable'] = True
        else:
            conditions['options_tradeable'] = False
            conditions['issues'].append("Outside options trading hours")
            
        # Calculate data quality score
        score = 0
        if conditions['spy_data_fresh']: score += 40
        if conditions['vix_data_fresh']: score += 20
        if conditions['is_market_open']: score += 20
        if conditions['options_tradeable']: score += 20
        
        conditions['data_quality_score'] = score
        
        return conditions
        
    def get_status(self) -> Dict:
        """Get current data validation status (alias for get_statistics for compatibility)"""
        return self.get_statistics()
        
    def get_statistics(self) -> Dict:
        """Get data validation statistics"""
        
        stats = {
            'total_validations': len(self.validation_history),
            'stale_data_symbols': list(self.stale_data_counts.keys()),
            'last_validation': None,
            'recent_issues': []
        }
        
        if self.validation_history:
            # Last validation
            last = self.validation_history[-1]
            stats['last_validation'] = {
                'timestamp': last['timestamp'],
                'underlying': last['underlying'],
                'is_valid': last['is_valid'],
                'issues_count': len(last['issues'])
            }
            
            # Recent issues (last 10 validations)
            for validation in self.validation_history[-10:]:
                if not validation['is_valid']:
                    stats['recent_issues'].extend(validation['issues'][:2])
                    
        # Current market conditions
        stats['market_conditions'] = self.check_market_conditions()
        
        return stats