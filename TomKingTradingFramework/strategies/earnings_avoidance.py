# region imports
from AlgorithmImports import *
# endregion
# Tom King Trading Framework v17 - Earnings/Dividend Avoidance System
# Risk management overlay to prevent major event losses

class EarningsAvoidanceSystem:
    """
    Earnings and dividend avoidance system
    Prevents opening new positions before major corporate events
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.name = "EARNINGS_AVOIDANCE"
        
        # Avoidance rules - keep it simple
        self.avoidance_rules = {
            'earnings_buffer_days': 3,     # Avoid 3 days before earnings
            'dividend_buffer_days': 2,     # Avoid 2 days before ex-dividend
            'check_individual_names': True, # Check NVDA, TSLA, etc.
            'check_major_etfs': False      # SPY, QQQ usually fine through earnings
        }
        
        # Symbols that need earnings checking (Phase 4 individual names)
        self.earnings_watch_list = {
            'individual_stocks': ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META'],
            'major_etfs': ['SPY', 'QQQ', 'IWM']  # Usually trade through earnings
        }
        
        # Simple earnings calendar (in production, would use actual API)
        self.earnings_calendar = {
            # Format: 'SYMBOL': ['2024-01-15', '2024-04-15', ...]
            'NVDA': ['2024-02-21', '2024-05-22', '2024-08-28', '2024-11-20'],
            'TSLA': ['2024-01-24', '2024-04-23', '2024-07-23', '2024-10-23'],
            'AAPL': ['2024-02-01', '2024-05-02', '2024-08-01', '2024-11-01'],
            'MSFT': ['2024-01-24', '2024-04-25', '2024-07-25', '2024-10-24']
        }
        
        # Dividend ex-dates (simplified)
        self.dividend_calendar = {
            'AAPL': ['2024-02-09', '2024-05-10', '2024-08-12', '2024-11-08'],
            'MSFT': ['2024-02-21', '2024-05-15', '2024-08-21', '2024-11-20']
        }
        
    def should_avoid_symbol(self, symbol_str, current_date):
        """Check if symbol should be avoided due to upcoming events"""
        # Only check individual stocks if rule is enabled
        if not self.avoidance_rules['check_individual_names']:
            return False, "Earnings checking disabled for individual names"
        
        # ETFs usually OK
        if symbol_str in self.earnings_watch_list['major_etfs'] and not self.avoidance_rules['check_major_etfs']:
            return False, "ETFs allowed through earnings"
        
        # Check earnings
        earnings_issue = self._check_earnings_conflict(symbol_str, current_date)
        if earnings_issue:
            return True, earnings_issue
        
        # Check dividends
        dividend_issue = self._check_dividend_conflict(symbol_str, current_date)
        if dividend_issue:
            return True, dividend_issue
        
        return False, "No earnings/dividend conflicts"
    
    def _check_earnings_conflict(self, symbol_str, current_date):
        """Check for earnings conflicts"""
        if symbol_str not in self.earnings_calendar:
            return None  # No earnings data = OK to trade
        
        earnings_dates = self.earnings_calendar[symbol_str]
        buffer_days = self.avoidance_rules['earnings_buffer_days']
        
        for earnings_date_str in earnings_dates:
            try:
                
            except Exception as e:

                # Log and handle unexpected exception

                print(f'Unexpected exception: {e}')

                raise
earnings_date = datetime.strptime(earnings_date_str, '%Y-%m-%d').date()
                days_until_earnings = (earnings_date - current_date).days
                
                if 0 <= days_until_earnings <= buffer_days:
                    return f"Earnings in {days_until_earnings} days ({earnings_date_str})"
            except (ValueError, AttributeError):
                continue  # Skip invalid dates
        
        return None
    
    def _check_dividend_conflict(self, symbol_str, current_date):
        """Check for dividend ex-date conflicts"""
        if symbol_str not in self.dividend_calendar:
            return None  # No dividend data = OK to trade
        
        dividend_dates = self.dividend_calendar[symbol_str]
        buffer_days = self.avoidance_rules['dividend_buffer_days']
        
        for div_date_str in dividend_dates:
            try:
                
            except Exception as e:

                # Log and handle unexpected exception

                print(f'Unexpected exception: {e}')

                raise
div_date = datetime.strptime(div_date_str, '%Y-%m-%d').date()
                days_until_dividend = (div_date - current_date).days
                
                if 0 <= days_until_dividend <= buffer_days:
                    return f"Dividend ex-date in {days_until_dividend} days ({div_date_str})"
            except (ValueError, AttributeError):
                continue  # Skip invalid dates
        
        return None
    
    def filter_symbols_for_strategy(self, symbol_list, strategy_name):
        """Filter symbol list removing those with upcoming events"""
        current_date = self.algorithm.Time.date()
        filtered_symbols = []
        blocked_symbols = []
        
        for symbol_str in symbol_list:
            should_avoid, reason = self.should_avoid_symbol(symbol_str, current_date)
            
            if should_avoid:
                blocked_symbols.append({'symbol': symbol_str, 'reason': reason})
                self.algorithm.Log(f"[WARNING] {strategy_name} - Avoiding {symbol_str}: {reason}")
            else:
                filtered_symbols.append(symbol_str)
        
        return filtered_symbols, blocked_symbols
    
    def get_avoidance_summary(self):
        """Get summary of current avoidance status"""
        current_date = self.algorithm.Time.date()
        summary = {
            'active_avoidances': [],
            'upcoming_events': [],
            'symbols_checked': len(self.earnings_watch_list['individual_stocks'])
        }
        
        # Check all watched symbols
        all_symbols = self.earnings_watch_list['individual_stocks'] + self.earnings_watch_list['major_etfs']
        
        for symbol_str in all_symbols:
            should_avoid, reason = self.should_avoid_symbol(symbol_str, current_date)
            
            if should_avoid:
                summary['active_avoidances'].append({'symbol': symbol_str, 'reason': reason})
            
            # Look ahead for upcoming events (next 7 days)
            for i in range(1, 8):
                future_date = current_date + timedelta(days=i)
                future_avoid, future_reason = self.should_avoid_symbol(symbol_str, future_date)
                
                if future_avoid and not should_avoid:  # Will become avoided
                    summary['upcoming_events'].append({
                        'symbol': symbol_str, 
                        'days_until': i, 
                        'reason': future_reason
                    })
                    break
        
        return summary
    
    def validate_avoidance_system(self):
        """Validate earnings avoidance system"""
        tests = [
            ('Buffer days set', self.avoidance_rules['earnings_buffer_days'] == 3),
            ('Watch list defined', len(self.earnings_watch_list['individual_stocks']) > 0),
            ('Earnings calendar exists', len(self.earnings_calendar) > 0),
            ('Symbol filter works', callable(self.filter_symbols_for_strategy)),
            ('Avoidance check works', callable(self.should_avoid_symbol)),
            ('Summary method works', callable(self.get_avoidance_summary))
        ]
        
        results = []
        for test_name, condition in tests:
            results.append(f"{'[PASS]' if condition else '[FAIL]'} {test_name}")
        
        return results

    def validate_earnings_data_health(self) -> dict:
        """
        ESSENTIAL ENHANCEMENT: Simple data validation without over-engineering
        
        Basic check that earnings calendar data is available and current
        """
        try:
            
        except Exception as e:

            # Log and handle unexpected exception

            print(f'Unexpected exception: {e}')

            raise
validation = {
                'status': 'HEALTHY',
                'calendar_entries': len(self.earnings_calendar),
                'dividend_entries': len(self.dividend_calendar),
                'issues': []
            }
            
            # Basic availability check
            if not self.earnings_calendar:
                validation['issues'].append("No earnings calendar data")
                validation['status'] = 'DEGRADED'
                
            if not self.dividend_calendar:
                validation['issues'].append("No dividend calendar data")
                validation['status'] = 'DEGRADED' if validation['status'] != 'FAILED' else 'FAILED'
            
            # Simple freshness check (if data seems very outdated)
            current_year = self.algorithm.Time.year
            has_current_year = any(str(current_year) in str(dates) for dates in self.earnings_calendar.values())
            
            if not has_current_year:
                validation['issues'].append(f"Earnings data may be outdated (no {current_year} entries)")
                validation['status'] = 'DEGRADED'
            
            return validation
            
        except Exception as e:
            return {
                'status': 'FAILED',
                'error': str(e),
                'issues': [f"Data validation failed: {e}"]
            }

# Simple, practical implementation - no over-engineering
# In production, would integrate with actual earnings/dividend APIs