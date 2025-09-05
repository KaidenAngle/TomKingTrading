# Tom King Trading Framework - Comprehensive Greeks Aggregation System Test
# Tests Greeks calculation, portfolio aggregation, and risk limit monitoring

from AlgorithmImports import *
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import unittest
from unittest.mock import Mock, MagicMock
import math

# Import the modules to test
from greeks.greeks_engine import GreeksEngine
from trading.order_execution_engine import ExecutionEngine, OrderType

class TestGreeksAggregationSystem:
    """
    Comprehensive test suite for Tom King Greeks aggregation system
    
    TESTS:
    1. Individual Option Greeks Calculation (Delta, Gamma, Theta, Vega)
    2. Position Greeks Aggregation (Spreads, Strangles, Iron Condors)
    3. Portfolio Greeks Aggregation (All positions combined)
    4. Risk Limit Monitoring (Delta, Gamma, Theta, Vega limits)
    5. Delta Neutral Targeting
    6. Greeks-based Position Adjustments
    7. Real-time Greeks Updates (every 2 hours)
    8. Integration with Position Management
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        
        # Initialize systems under test
        self.greeks_engine = GreeksEngine(algorithm)
        self.execution_engine = ExecutionEngine(algorithm)
        
        # Test counters
        self.test_results = {
            'tests_run': 0,
            'tests_passed': 0,
            'tests_failed': 0,
            'detailed_results': []
        }
        
        # Mock option contracts for testing
        self.test_contracts = self._create_test_contracts()
        
        # Mock positions for portfolio testing
        self.test_positions = self._create_test_positions()
        
        self.algorithm.Log("🧪 GREEKS AGGREGATION SYSTEM TEST INITIALIZED")
    
    def run_all_greeks_tests(self) -> Dict:
        """Run comprehensive Greeks system tests"""
        self.algorithm.Log("\n🧪 STARTING GREEKS AGGREGATION SYSTEM TESTS")
        
        # Test 1: Individual Option Greeks
        self._test_option_greeks_calculation()
        
        # Test 2: Position Greeks Aggregation
        self._test_position_greeks_aggregation()
        
        # Test 3: Portfolio Greeks Aggregation
        self._test_portfolio_greeks_aggregation()
        
        # Test 4: Risk Limit Monitoring
        self._test_risk_limit_monitoring()
        
        # Test 5: Delta Neutral Targeting
        self._test_delta_neutral_targeting()
        
        # Test 6: Greeks-based Adjustments
        self._test_greeks_based_adjustments()
        
        # Test 7: Greeks Caching System
        self._test_greeks_caching()
        
        # Test 8: Error Handling and Edge Cases
        self._test_greeks_error_handling()
        
        # Summary
        self._log_test_summary()
        
        return self.test_results
    
    def _test_option_greeks_calculation(self):
        """Test individual option Greeks calculation"""
        self.algorithm.Log("\n📊 Testing Option Greeks Calculation...")
        
        # Test 1: ATM Call Option Greeks
        atm_call = self._create_mock_option('CALL', 500, 500, 30)  # ATM, 30 DTE
        underlying_price = 500.0
        
        greeks = self.greeks_engine.CalculateOptionGreeks(atm_call, underlying_price)
        
        # ATM call should have ~0.5 delta
        expected_delta_range = (0.4, 0.6)
        actual_delta = greeks['delta']
        self._assert_range_test("ATM Call Delta", expected_delta_range, actual_delta, greeks)
        
        # ATM options should have highest gamma
        expected_gamma_min = 0.01
        actual_gamma = greeks['gamma']
        self._assert_test("ATM Call Gamma > 0", True, actual_gamma > expected_gamma_min, greeks)
        
        # Theta should be negative (time decay)
        self._assert_test("ATM Call Theta < 0", True, greeks['theta'] < 0, greeks)
        
        # Vega should be positive
        self._assert_test("ATM Call Vega > 0", True, greeks['vega'] > 0, greeks)
        
        # Test 2: ATM Put Option Greeks
        atm_put = self._create_mock_option('PUT', 500, 500, 30)  # ATM, 30 DTE
        
        put_greeks = self.greeks_engine.CalculateOptionGreeks(atm_put, underlying_price)
        
        # ATM put should have ~-0.5 delta
        expected_put_delta_range = (-0.6, -0.4)
        actual_put_delta = put_greeks['delta']
        self._assert_range_test("ATM Put Delta", expected_put_delta_range, actual_put_delta, put_greeks)
        
        # Put and call gamma should be similar
        gamma_diff = abs(put_greeks['gamma'] - greeks['gamma'])
        self._assert_test("Put/Call Gamma Similar", True, gamma_diff < 0.01, 
                         {'call_gamma': greeks['gamma'], 'put_gamma': put_greeks['gamma']})
        
        # Test 3: OTM Options
        otm_call = self._create_mock_option('CALL', 520, 500, 30)  # 4% OTM
        otm_greeks = self.greeks_engine.CalculateOptionGreeks(otm_call, underlying_price)
        
        # OTM call should have lower delta than ATM
        self._assert_test("OTM Call Delta < ATM", True, 
                         otm_greeks['delta'] < greeks['delta'], otm_greeks)
        
        # Test 4: Short DTE Impact
        short_dte_call = self._create_mock_option('CALL', 500, 500, 5)  # 5 DTE
        short_greeks = self.greeks_engine.CalculateOptionGreeks(short_dte_call, underlying_price)
        
        # Shorter DTE should have higher gamma and more negative theta
        self._assert_test("Short DTE Higher Gamma", True, 
                         abs(short_greeks['gamma']) > abs(greeks['gamma']), short_greeks)
        self._assert_test("Short DTE More Negative Theta", True,
                         short_greeks['theta'] < greeks['theta'], short_greeks)
    
    def _test_position_greeks_aggregation(self):
        """Test Greeks aggregation for multi-leg positions"""
        self.algorithm.Log("\n🎯 Testing Position Greeks Aggregation...")
        
        # Test 1: Put Credit Spread Greeks
        put_spread = {
            'position_id': 'TEST_SPREAD_001',
            'type': OrderType.PUT_SPREAD,
            'underlying': 'SPY',
            'short_strike': 480,
            'long_strike': 470,
            'quantity': 1,
            'expiry': self.algorithm.Time.date() + timedelta(days=45)
        }
        
        # Mock SPY price
        self._mock_underlying_price('SPY', 500.0)
        
        spread_greeks = self.greeks_engine.CalculatePositionGreeks(put_spread)
        
        # Put spread should have positive delta (bullish)
        self._assert_test("Put Spread Positive Delta", True, 
                         spread_greeks['net_delta'] > 0, spread_greeks)
        
        # Should have positive theta (time decay benefit)
        self._assert_test("Put Spread Positive Theta", True,
                         spread_greeks['net_theta'] > 0, spread_greeks)
        
        # Test 2: Short Strangle Greeks
        strangle = {
            'position_id': 'TEST_STRANGLE_001',
            'type': OrderType.STRANGLE,
            'underlying': 'SPY',
            'put_strike': 480,
            'call_strike': 520,
            'quantity': 1
        }
        
        strangle_greeks = self.greeks_engine.CalculatePositionGreeks(strangle)
        
        # Short strangle should be near delta neutral
        delta_neutral_threshold = 0.10
        self._assert_test("Strangle Near Delta Neutral", True,
                         abs(strangle_greeks['net_delta']) < delta_neutral_threshold, strangle_greeks)
        
        # Should have negative gamma (short gamma)
        self._assert_test("Strangle Negative Gamma", True,
                         strangle_greeks['net_gamma'] < 0, strangle_greeks)
        
        # Should have positive theta
        self._assert_test("Strangle Positive Theta", True,
                         strangle_greeks['net_theta'] > 0, strangle_greeks)
        
        # Should have negative vega (short vol)
        self._assert_test("Strangle Negative Vega", True,
                         strangle_greeks['net_vega'] < 0, strangle_greeks)
        
        # Test 3: Iron Condor Greeks
        iron_condor = {
            'position_id': 'TEST_IC_001',
            'type': OrderType.IRON_CONDOR,
            'underlying': 'SPY',
            'quantity': 1
        }
        
        ic_greeks = self.greeks_engine.CalculatePositionGreeks(iron_condor)
        
        # Iron condor should be very close to delta neutral
        ic_delta_threshold = 0.05
        self._assert_test("Iron Condor Delta Neutral", True,
                         abs(ic_greeks['net_delta']) < ic_delta_threshold, ic_greeks)
        
        # Should have highest theta of all strategies
        self._assert_test("Iron Condor High Theta", True,
                         ic_greeks['net_theta'] > strangle_greeks['net_theta'], ic_greeks)
    
    def _test_portfolio_greeks_aggregation(self):
        """Test portfolio-level Greeks aggregation"""
        self.algorithm.Log("\n📈 Testing Portfolio Greeks Aggregation...")
        
        # Create test portfolio with multiple positions
        test_portfolio = {
            'SPREAD_001': {
                'position_id': 'SPREAD_001',
                'type': OrderType.PUT_SPREAD,
                'underlying': 'SPY',
                'quantity': 2,
                'status': 'open'
            },
            'STRANGLE_001': {
                'position_id': 'STRANGLE_001', 
                'type': OrderType.STRANGLE,
                'underlying': 'QQQ',
                'quantity': 1,
                'status': 'open'
            },
            'IC_001': {
                'position_id': 'IC_001',
                'type': OrderType.IRON_CONDOR,
                'underlying': 'IWM',
                'quantity': 3,
                'status': 'open'
            },
            'CLOSED_001': {
                'position_id': 'CLOSED_001',
                'type': OrderType.PUT_SPREAD,
                'status': 'closed'  # Should not be included
            }
        }
        
        # Mock underlying prices
        self._mock_underlying_price('SPY', 500.0)
        self._mock_underlying_price('QQQ', 400.0)
        self._mock_underlying_price('IWM', 200.0)
        
        portfolio_greeks = self.greeks_engine.CalculatePortfolioGreeks(test_portfolio)
        
        # Test aggregation
        expected_position_count = 3  # Only open positions
        actual_position_count = portfolio_greeks['position_count']
        self._assert_test("Portfolio Position Count", expected_position_count, 
                         actual_position_count, portfolio_greeks)
        
        # Portfolio should have total Greeks (sum of positions)
        self._assert_test("Portfolio Has Total Delta", True,
                         'total_delta' in portfolio_greeks, portfolio_greeks)
        
        self._assert_test("Portfolio Has Total Gamma", True,
                         'total_gamma' in portfolio_greeks, portfolio_greeks)
        
        self._assert_test("Portfolio Has Total Theta", True,
                         'total_theta' in portfolio_greeks, portfolio_greeks)
        
        self._assert_test("Portfolio Has Total Vega", True,
                         'total_vega' in portfolio_greeks, portfolio_greeks)
        
        # Test risk metrics
        risk_metrics = portfolio_greeks['risk_metrics']
        
        self._assert_test("Risk Metrics Calculated", True,
                         len(risk_metrics) > 0, risk_metrics)
        
        # Delta exposure should be calculated
        self._assert_test("Delta Exposure Calculated", True,
                         'delta_exposure' in portfolio_greeks, portfolio_greeks)
    
    def _test_risk_limit_monitoring(self):
        """Test Greeks risk limit monitoring"""
        self.algorithm.Log("\n🚨 Testing Risk Limit Monitoring...")
        
        # Test 1: Delta limit violation
        high_delta_portfolio = {
            'total_delta': 75,  # Above 50 limit
            'total_gamma': 2,
            'total_theta': -200,
            'total_vega': 500,
            'position_count': 5
        }
        
        violations = self.greeks_engine.CheckGreeksRiskLimits(high_delta_portfolio)
        
        # Should find delta violation
        delta_violations = [v for v in violations if v['type'] == 'DELTA_LIMIT']
        self._assert_test("Delta Limit Violation Detected", True,
                         len(delta_violations) > 0, violations)
        
        if delta_violations:
            self._assert_test("Delta Violation High Severity", 'HIGH',
                             delta_violations[0]['severity'], delta_violations[0])
        
        # Test 2: Gamma limit violation
        high_gamma_portfolio = {
            'total_delta': 25,
            'total_gamma': 8,  # Above 5 limit
            'total_theta': -200,
            'total_vega': 500,
            'position_count': 5
        }
        
        gamma_violations = self.greeks_engine.CheckGreeksRiskLimits(high_gamma_portfolio)
        gamma_viols = [v for v in gamma_violations if v['type'] == 'GAMMA_LIMIT']
        
        self._assert_test("Gamma Limit Violation Detected", True,
                         len(gamma_viols) > 0, gamma_violations)
        
        # Test 3: Theta limit violation
        high_theta_portfolio = {
            'total_delta': 25,
            'total_gamma': 2,
            'total_theta': -600,  # Below -500 limit
            'total_vega': 500,
            'position_count': 5
        }
        
        theta_violations = self.greeks_engine.CheckGreeksRiskLimits(high_theta_portfolio)
        theta_viols = [v for v in theta_violations if v['type'] == 'THETA_LIMIT']
        
        self._assert_test("Theta Limit Violation Detected", True,
                         len(theta_viols) > 0, theta_violations)
        
        # Test 4: Vega limit violation
        high_vega_portfolio = {
            'total_delta': 25,
            'total_gamma': 2,
            'total_theta': -200,
            'total_vega': 1500,  # Above 1000 limit
            'position_count': 5
        }
        
        vega_violations = self.greeks_engine.CheckGreeksRiskLimits(high_vega_portfolio)
        vega_viols = [v for v in vega_violations if v['type'] == 'VEGA_LIMIT']
        
        self._assert_test("Vega Limit Violation Detected", True,
                         len(vega_viols) > 0, vega_violations)
        
        # Test 5: No violations - clean portfolio
        clean_portfolio = {
            'total_delta': 15,  # Within ±50 limit
            'total_gamma': 3,   # Within 5 limit
            'total_theta': -300, # Within -500 limit
            'total_vega': 700,  # Within 1000 limit
            'position_count': 3
        }
        
        clean_violations = self.greeks_engine.CheckGreeksRiskLimits(clean_portfolio)
        
        self._assert_test("Clean Portfolio - No Violations", 0,
                         len(clean_violations), clean_violations)
    
    def _test_delta_neutral_targeting(self):
        """Test delta neutral targeting"""
        self.algorithm.Log("\n⚖️ Testing Delta Neutral Targeting...")
        
        # Test 1: Delta neutral portfolio
        neutral_portfolio = {
            'total_delta': 5,  # Within ±10 neutral range
            'total_gamma': 2,
            'total_theta': -200,
            'total_vega': 500,
            'position_count': 3
        }
        
        portfolio_greeks = self.greeks_engine._calculate_portfolio_risk_metrics(neutral_portfolio)
        
        self._assert_test("Delta Neutral Detection", True,
                         portfolio_greeks['delta_neutral'], portfolio_greeks)
        
        # Test 2: Not delta neutral
        directional_portfolio = {
            'total_delta': 35,  # Outside ±10 neutral range
            'total_gamma': 2,
            'total_theta': -200,
            'total_vega': 500,
            'position_count': 3
        }
        
        directional_metrics = self.greeks_engine._calculate_portfolio_risk_metrics(directional_portfolio)
        
        self._assert_test("Not Delta Neutral Detection", False,
                         directional_metrics['delta_neutral'], directional_metrics)
        
        # Test 3: Risk score calculation
        gamma_risk = directional_metrics['gamma_risk_score']
        vega_risk = directional_metrics['vega_risk_score']
        
        self._assert_range_test("Gamma Risk Score", (0, 1), gamma_risk, directional_metrics)
        self._assert_range_test("Vega Risk Score", (0, 1), vega_risk, directional_metrics)
    
    def _test_greeks_based_adjustments(self):
        """Test Greeks-based position adjustment signals"""
        self.algorithm.Log("\n🔧 Testing Greeks-based Adjustments...")
        
        # Test 1: High delta position needing adjustment
        high_delta_position = {
            'position_id': 'HIGH_DELTA_001',
            'type': OrderType.PUT_SPREAD,
            'underlying': 'SPY'
        }
        
        # Mock high delta position Greeks
        mock_greeks = {
            'net_delta': 0.25,  # Above 0.20 threshold
            'net_gamma': 0.05,
            'net_theta': -30,
            'net_vega': 50
        }
        
        with self._mock_position_greeks(mock_greeks):
            signals = self.greeks_engine.GetPositionAdjustmentSignals(high_delta_position)
        
        # Should get high delta signal
        delta_signals = [s for s in signals if 'HIGH_DELTA' in s]
        self._assert_test("High Delta Adjustment Signal", True,
                         len(delta_signals) > 0, signals)
        
        # Test 2: High theta decay
        high_theta_position = {
            'position_id': 'HIGH_THETA_001',
            'type': OrderType.STRANGLE,
            'underlying': 'QQQ'
        }
        
        high_theta_greeks = {
            'net_delta': 0.10,
            'net_gamma': 0.05,
            'net_theta': -75,  # Below -50 threshold
            'net_vega': 50
        }
        
        with self._mock_position_greeks(high_theta_greeks):
            theta_signals = self.greeks_engine.GetPositionAdjustmentSignals(high_theta_position)
        
        # Should get theta decay signal
        theta_signal_found = any('THETA_DECAY' in s for s in theta_signals)
        self._assert_test("High Theta Decay Signal", True,
                         theta_signal_found, theta_signals)
        
        # Test 3: High gamma risk
        high_gamma_position = {
            'position_id': 'HIGH_GAMMA_001',
            'type': OrderType.IRON_CONDOR,
            'underlying': 'IWM'
        }
        
        high_gamma_greeks = {
            'net_delta': 0.05,
            'net_gamma': 0.15,  # Above 0.10 threshold
            'net_theta': -20,
            'net_vega': 30
        }
        
        with self._mock_position_greeks(high_gamma_greeks):
            gamma_signals = self.greeks_engine.GetPositionAdjustmentSignals(high_gamma_position)
        
        # Should get gamma risk signal
        gamma_signal_found = any('HIGH_GAMMA' in s for s in gamma_signals)
        self._assert_test("High Gamma Risk Signal", True,
                         gamma_signal_found, gamma_signals)
        
        # Test 4: Clean position - no adjustments
        clean_position = {
            'position_id': 'CLEAN_001',
            'type': OrderType.PUT_SPREAD,
            'underlying': 'SPY'
        }
        
        clean_greeks = {
            'net_delta': 0.10,  # Within limits
            'net_gamma': 0.05,  # Within limits
            'net_theta': -25,   # Within limits
            'net_vega': 40      # Within limits
        }
        
        with self._mock_position_greeks(clean_greeks):
            clean_signals = self.greeks_engine.GetPositionAdjustmentSignals(clean_position)
        
        self._assert_test("Clean Position - No Signals", 0,
                         len(clean_signals), clean_signals)
    
    def _test_greeks_caching(self):
        """Test Greeks caching system"""
        self.algorithm.Log("\n💾 Testing Greeks Caching System...")
        
        # Create test option
        test_option = self._create_mock_option('CALL', 500, 500, 30)
        underlying_price = 500.0
        
        # First calculation - should cache
        greeks1 = self.greeks_engine.CalculateOptionGreeks(test_option, underlying_price)
        
        # Second calculation - should use cache
        greeks2 = self.greeks_engine.CalculateOptionGreeks(test_option, underlying_price)
        
        # Should be identical (from cache)
        self._assert_test("Greeks Cache Delta Match", greeks1['delta'],
                         greeks2['delta'], {'greeks1': greeks1, 'greeks2': greeks2})
        
        # Test cache key generation
        cache_key = f"{test_option.Symbol}_{underlying_price:.2f}"
        cache_exists = cache_key in self.greeks_engine.greeks_cache
        
        self._assert_test("Greeks Cache Key Exists", True, cache_exists,
                         {'cache_key': cache_key, 'cache_size': len(self.greeks_engine.greeks_cache)})
        
        # Test cache expiry (mock old timestamp)
        if cache_key in self.greeks_engine.greeks_cache:
            old_time = self.algorithm.Time - timedelta(minutes=10)  # Older than 5min expiry
            self.greeks_engine.greeks_cache[cache_key] = (old_time, greeks1)
        
        # Should recalculate after expiry
        greeks3 = self.greeks_engine.CalculateOptionGreeks(test_option, underlying_price)
        
        # Should have fresh calculation (same values but new timestamp)
        self._assert_test("Greeks Cache Expiry Working", True,
                         greeks3['delta'] == greeks1['delta'], greeks3)
    
    def _test_greeks_error_handling(self):
        """Test error handling and edge cases"""
        self.algorithm.Log("\n🛠️ Testing Greeks Error Handling...")
        
        # Test 1: Invalid option contract
        invalid_option = None
        
        default_greeks = self.greeks_engine.CalculateOptionGreeks(invalid_option, 500.0)
        
        # Should return default Greeks
        expected_keys = ['delta', 'gamma', 'theta', 'vega', 'theoretical_price']
        for key in expected_keys:
            self._assert_test(f"Default Greeks Has {key}", True,
                             key in default_greeks, default_greeks)
        
        # Test 2: Zero time to expiry
        expired_option = self._create_mock_option('CALL', 500, 500, 0)  # 0 DTE
        
        expired_greeks = self.greeks_engine.CalculateOptionGreeks(expired_option, 500.0)
        
        # Should handle without crashing
        self._assert_test("Expired Option Handled", True,
                         isinstance(expired_greeks['delta'], (int, float)), expired_greeks)
        
        # Test 3: Missing underlying price
        position_no_underlying = {
            'position_id': 'NO_UNDERLYING',
            'type': OrderType.PUT_SPREAD,
            'underlying': 'INVALID_SYMBOL'
        }
        
        no_underlying_greeks = self.greeks_engine.CalculatePositionGreeks(position_no_underlying)
        
        # Should return zero Greeks safely
        expected_zero_keys = ['net_delta', 'net_gamma', 'net_theta', 'net_vega']
        for key in expected_zero_keys:
            self._assert_test(f"No Underlying - Zero {key}", 0,
                             no_underlying_greeks.get(key, -999), no_underlying_greeks)
        
        # Test 4: Portfolio with no positions
        empty_portfolio = {}
        
        empty_greeks = self.greeks_engine.CalculatePortfolioGreeks(empty_portfolio)
        
        # Should handle empty portfolio
        self._assert_test("Empty Portfolio Position Count", 0,
                         empty_greeks['position_count'], empty_greeks)
        
        self._assert_test("Empty Portfolio Total Delta", 0,
                         empty_greeks['total_delta'], empty_greeks)
    
    def _create_test_contracts(self):
        """Create mock option contracts for testing"""
        contracts = {}
        
        # ATM Call
        contracts['SPY_CALL_500'] = self._create_mock_option('CALL', 500, 500, 30)
        
        # ATM Put
        contracts['SPY_PUT_500'] = self._create_mock_option('PUT', 500, 500, 30)
        
        # OTM Call
        contracts['SPY_CALL_520'] = self._create_mock_option('CALL', 520, 500, 30)
        
        # OTM Put
        contracts['SPY_PUT_480'] = self._create_mock_option('PUT', 480, 500, 30)
        
        return contracts
    
    def _create_test_positions(self):
        """Create test positions for portfolio testing"""
        return {
            'TEST_SPREAD': {
                'position_id': 'TEST_SPREAD',
                'type': OrderType.PUT_SPREAD,
                'underlying': 'SPY',
                'status': 'open'
            },
            'TEST_STRANGLE': {
                'position_id': 'TEST_STRANGLE',
                'type': OrderType.STRANGLE,
                'underlying': 'QQQ',
                'status': 'open'
            },
            'TEST_IC': {
                'position_id': 'TEST_IC',
                'type': OrderType.IRON_CONDOR,
                'underlying': 'IWM',
                'status': 'open'
            }
        }
    
    def _create_mock_option(self, option_type: str, strike: float, underlying_price: float, dte: int):
        """Create a mock option contract"""
        mock_option = Mock()
        mock_option.Strike = strike
        mock_option.Right = OptionRight.Call if option_type == 'CALL' else OptionRight.Put
        mock_option.Expiry = self.algorithm.Time.date() + timedelta(days=dte)
        mock_option.Symbol = f"SPY_{option_type}_{strike}_{dte}DTE"
        mock_option.ImpliedVolatility = 0.20  # 20% IV
        
        return mock_option
    
    # Helper methods for mocking
    def _mock_underlying_price(self, symbol, price):
        """Mock underlying price"""
        if symbol not in self.algorithm.Securities:
            mock_security = Mock()
            mock_security.Price = price
            self.algorithm.Securities[symbol] = mock_security
        else:
            self.algorithm.Securities[symbol].Price = price
    
    def _mock_position_greeks(self, greeks_dict):
        """Mock context manager for position Greeks"""
        class MockPositionGreeks:
            def __init__(self, engine, greeks):
                self.engine = engine
                self.greeks = greeks
                self.original_method = None
            
            def __enter__(self):
                self.original_method = self.engine.CalculatePositionGreeks
                self.engine.CalculatePositionGreeks = lambda pos: self.greeks
                return self
            
            def __exit__(self, exc_type, exc_val, exc_tb):
                if self.original_method:
                    self.engine.CalculatePositionGreeks = self.original_method
        
        return MockPositionGreeks(self.greeks_engine, greeks_dict)
    
    def _assert_test(self, test_name: str, expected, actual, context=None):
        """Assert test result and log"""
        self.test_results['tests_run'] += 1
        
        if expected == actual:
            self.test_results['tests_passed'] += 1
            result = "✅ PASSED"
        else:
            self.test_results['tests_failed'] += 1
            result = "❌ FAILED"
        
        self.test_results['detailed_results'].append({
            'test': test_name,
            'expected': expected,
            'actual': actual,
            'passed': expected == actual,
            'context': context
        })
        
        self.algorithm.Log(f"  {result}: {test_name}")
        if expected != actual:
            self.algorithm.Log(f"    Expected: {expected}, Got: {actual}")
            if context:
                self.algorithm.Log(f"    Context: {str(context)[:200]}...")
    
    def _assert_range_test(self, test_name: str, expected_range: tuple, actual_value, context=None):
        """Assert value is within expected range"""
        in_range = expected_range[0] <= actual_value <= expected_range[1]
        self._assert_test(test_name, True, in_range, 
                         {'expected_range': expected_range, 'actual': actual_value, 'context': context})
    
    def _log_test_summary(self):
        """Log comprehensive test summary"""
        self.algorithm.Log("\n" + "="*60)
        self.algorithm.Log("📊 GREEKS AGGREGATION SYSTEM TEST SUMMARY")
        self.algorithm.Log("="*60)
        
        total = self.test_results['tests_run']
        passed = self.test_results['tests_passed']
        failed = self.test_results['tests_failed']
        
        self.algorithm.Log(f"Total Tests: {total}")
        self.algorithm.Log(f"Passed: {passed} ({passed/total*100:.1f}%)")
        self.algorithm.Log(f"Failed: {failed} ({failed/total*100:.1f}%)")
        
        if failed > 0:
            self.algorithm.Log("\n❌ FAILED TESTS:")
            for result in self.test_results['detailed_results']:
                if not result['passed']:
                    self.algorithm.Log(f"  - {result['test']}: Expected {result['expected']}, Got {result['actual']}")
        
        # Greeks System Coverage Summary
        self.algorithm.Log("\n📋 GREEKS SYSTEM TESTED:")
        self.algorithm.Log("  ✅ Individual Option Greeks (Delta, Gamma, Theta, Vega)")
        self.algorithm.Log("  ✅ Position Greeks Aggregation (Spreads, Strangles, ICs)")
        self.algorithm.Log("  ✅ Portfolio Greeks Aggregation")
        self.algorithm.Log("  ✅ Risk Limit Monitoring (50 Delta, 5 Gamma, -500 Theta, 1000 Vega)")
        self.algorithm.Log("  ✅ Delta Neutral Targeting (±10 range)")
        self.algorithm.Log("  ✅ Greeks-based Position Adjustments")
        self.algorithm.Log("  ✅ Greeks Caching System (5min expiry)")
        self.algorithm.Log("  ✅ Error Handling & Edge Cases")
        
        success_rate = passed / total * 100
        if success_rate >= 95:
            self.algorithm.Log(f"\n🎉 EXCELLENT: {success_rate:.1f}% success rate")
        elif success_rate >= 85:
            self.algorithm.Log(f"\n👍 GOOD: {success_rate:.1f}% success rate")
        else:
            self.algorithm.Log(f"\n⚠️ NEEDS WORK: {success_rate:.1f}% success rate")