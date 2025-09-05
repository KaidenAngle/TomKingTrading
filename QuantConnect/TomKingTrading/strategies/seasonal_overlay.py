# region imports
from AlgorithmImports import *
# endregion
"""
Tom King Trading Framework - Seasonal Overlay System
Month-by-month allocation and sector rotation protocols

Key Features:
1. Seasonal Position Sizing: Adjust allocation based on historical market seasonality
2. Sector Rotation: Monthly rotation based on seasonal sector performance
3. VIX Seasonal Patterns: VIX-based adjustments for seasonal volatility
4. Strategy Emphasis: Monthly emphasis on different Tom King strategies
5. Risk Adjustment: Seasonal risk adjustment protocols

Seasonal Framework:
- Q1 (Jan-Mar): Recovery and Growth Phase
- Q2 (Apr-Jun): Steady Growth and Expansion
- Q3 (Jul-Sep): Summer Volatility and Defensive
- Q4 (Oct-Dec): Year-end rally and Tax Considerations

Reference: Tom King methodology - Sector rotation protocols (SEASONAL)
Author: Tom King Trading System Implementation
Version: 1.0.0 - Seasonal Overlay Module
"""

from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from enum import Enum
import numpy as np

class Season(Enum):
    """Market seasons for allocation adjustments"""
    WINTER = "WINTER"  # Dec-Feb: Defensive/Recovery
    SPRING = "SPRING"  # Mar-May: Growth/Expansion
    SUMMER = "SUMMER"  # Jun-Aug: Volatility/Caution
    AUTUMN = "AUTUMN"  # Sep-Nov: Harvest/Positioning

class MarketMonth(Enum):
    """Specific month classifications for detailed allocation"""
    JANUARY = 1    # New Year Effect
    FEBRUARY = 2   # Earnings Season
    MARCH = 3      # Quarter End
    APRIL = 4      # Tax Season End
    MAY = 5        # "Sell in May"
    JUNE = 6       # Summer Start
    JULY = 7       # Summer Doldrums
    AUGUST = 8     # Vacation/Low Volume
    SEPTEMBER = 9  # Back to School/Volatility
    OCTOBER = 10   # Spooky Season
    NOVEMBER = 11  # Thanksgiving Rally
    DECEMBER = 12  # Santa Rally

class SectorRotation(Enum):
    """Sector rotation emphasis by season"""
    TECHNOLOGY = "TECH"
    FINANCIALS = "FINANCIALS"
    ENERGY = "ENERGY"
    HEALTHCARE = "HEALTHCARE"
    CONSUMER_DISCRETIONARY = "CONSUMER_DISC"
    CONSUMER_STAPLES = "CONSUMER_STAPLES"
    INDUSTRIALS = "INDUSTRIALS"
    UTILITIES = "UTILITIES"
    REAL_ESTATE = "REAL_ESTATE"

class SeasonalOverlaySystem:
    """
    Implementation of Tom King's Seasonal Overlay System
    
    Features:
    - Month-by-month position sizing adjustments
    - Seasonal sector rotation protocols
    - VIX seasonal pattern integration
    - Strategy emphasis rotation
    - Risk adjustment by season
    """
    
    def __init__(self, algorithm):
        """Initialize seasonal overlay system"""
        self.algorithm = algorithm
        
        # Seasonal configuration
        self.seasonal_config = self._initialize_seasonal_config()
        self.sector_rotation_calendar = self._initialize_sector_calendar()
        self.vix_seasonal_patterns = self._initialize_vix_patterns()
        
        # Current seasonal state
        self.current_season = None
        self.current_month_config = None
        self.current_sector_emphasis = None
        
        # Performance tracking
        self.seasonal_performance = {}
        self.monthly_adjustments = {}
        
        self.algorithm.Log("🌱 Seasonal Overlay System Initialized")
    
    def _initialize_seasonal_config(self) -> Dict:
        """Initialize seasonal configuration with month-by-month settings"""
        return {
            MarketMonth.JANUARY: {
                'season': Season.WINTER,
                'allocation_multiplier': 1.15,  # January Effect
                'risk_adjustment': 0.95,        # Slightly lower risk
                'preferred_strategies': ['LT112', 'LEAP_LADDER'],
                'sector_emphasis': [SectorRotation.TECHNOLOGY, SectorRotation.FINANCIALS],
                'vix_bias': -2.0,  # Typically lower VIX
                'description': 'January Effect - Strong start to year'
            },
            MarketMonth.FEBRUARY: {
                'season': Season.WINTER,
                'allocation_multiplier': 1.10,
                'risk_adjustment': 0.90,        # Earnings volatility
                'preferred_strategies': ['FRIDAY_0DTE', 'BEAR_TRAP_11X'],
                'sector_emphasis': [SectorRotation.TECHNOLOGY, SectorRotation.HEALTHCARE],
                'vix_bias': 1.5,   # Earnings volatility
                'description': 'Earnings Season - Tactical opportunities'
            },
            MarketMonth.MARCH: {
                'season': Season.SPRING,
                'allocation_multiplier': 1.05,
                'risk_adjustment': 0.92,
                'preferred_strategies': ['LT112', 'FUTURES_STRANGLE'],
                'sector_emphasis': [SectorRotation.FINANCIALS, SectorRotation.INDUSTRIALS],
                'vix_bias': 0.5,
                'description': 'Quarter End - Balanced approach'
            },
            MarketMonth.APRIL: {
                'season': Season.SPRING,
                'allocation_multiplier': 1.20,  # Strong historical performance
                'risk_adjustment': 1.05,        # Increase risk for growth
                'preferred_strategies': ['CALENDARIZED_LT112', 'ADVANCED_0DTE'],
                'sector_emphasis': [SectorRotation.TECHNOLOGY, SectorRotation.CONSUMER_DISCRETIONARY],
                'vix_bias': -1.5,  # Post-tax season calm
                'description': 'Post-tax rally - Growth acceleration'
            },
            MarketMonth.MAY: {
                'season': Season.SPRING,
                'allocation_multiplier': 0.90,  # "Sell in May" effect
                'risk_adjustment': 0.85,        # Reduce risk
                'preferred_strategies': ['FRIDAY_0DTE', 'FUTURES_STRANGLE'],
                'sector_emphasis': [SectorRotation.UTILITIES, SectorRotation.CONSUMER_STAPLES],
                'vix_bias': 2.0,   # Pre-summer uncertainty
                'description': 'Sell in May - Defensive positioning'
            },
            MarketMonth.JUNE: {
                'season': Season.SUMMER,
                'allocation_multiplier': 0.95,
                'risk_adjustment': 0.88,
                'preferred_strategies': ['LT112', 'LEAP_LADDER'],
                'sector_emphasis': [SectorRotation.ENERGY, SectorRotation.CONSUMER_DISCRETIONARY],
                'vix_bias': 1.0,
                'description': 'Summer start - Cautious growth'
            },
            MarketMonth.JULY: {
                'season': Season.SUMMER,
                'allocation_multiplier': 0.85,  # Summer doldrums
                'risk_adjustment': 0.80,        # Lower risk due to low volume
                'preferred_strategies': ['FRIDAY_0DTE', 'FUTURES_STRANGLE'],
                'sector_emphasis': [SectorRotation.UTILITIES, SectorRotation.REAL_ESTATE],
                'vix_bias': 0.0,   # Mixed patterns
                'description': 'Summer doldrums - Conservative approach'
            },
            MarketMonth.AUGUST: {
                'season': Season.SUMMER,
                'allocation_multiplier': 0.70,  # August 2024 protection
                'risk_adjustment': 0.65,        # Highest risk reduction
                'preferred_strategies': ['BEAR_TRAP_11X', 'AUGUST_2024_PROTECTION'],
                'sector_emphasis': [SectorRotation.UTILITIES, SectorRotation.CONSUMER_STAPLES],
                'vix_bias': 5.0,   # August volatility spike protection
                'description': 'August volatility - Maximum protection'
            },
            MarketMonth.SEPTEMBER: {
                'season': Season.AUTUMN,
                'allocation_multiplier': 0.75,  # Historically weakest month
                'risk_adjustment': 0.70,        # High caution
                'preferred_strategies': ['BEAR_TRAP_11X', 'ADVANCED_0DTE'],
                'sector_emphasis': [SectorRotation.HEALTHCARE, SectorRotation.UTILITIES],
                'vix_bias': 3.5,   # Back-to-school volatility
                'description': 'September weakness - Defensive tactics'
            },
            MarketMonth.OCTOBER: {
                'season': Season.AUTUMN,
                'allocation_multiplier': 0.95,  # Post-crash recovery opportunity
                'risk_adjustment': 0.85,
                'preferred_strategies': ['CALENDARIZED_LT112', 'BEAR_TRAP_11X'],
                'sector_emphasis': [SectorRotation.TECHNOLOGY, SectorRotation.FINANCIALS],
                'vix_bias': 2.5,   # October fear factor
                'description': 'October opportunities - Cautious recovery'
            },
            MarketMonth.NOVEMBER: {
                'season': Season.AUTUMN,
                'allocation_multiplier': 1.15,  # Thanksgiving rally
                'risk_adjustment': 1.00,        # Normal risk
                'preferred_strategies': ['LT112', 'ADVANCED_0DTE'],
                'sector_emphasis': [SectorRotation.CONSUMER_DISCRETIONARY, SectorRotation.TECHNOLOGY],
                'vix_bias': -1.0,  # Pre-holiday calm
                'description': 'Thanksgiving rally - Renewed optimism'
            },
            MarketMonth.DECEMBER: {
                'season': Season.WINTER,
                'allocation_multiplier': 1.25,  # Santa rally
                'risk_adjustment': 1.08,        # Slightly higher risk for year-end
                'preferred_strategies': ['CALENDARIZED_LT112', 'FRIDAY_0DTE'],
                'sector_emphasis': [SectorRotation.CONSUMER_DISCRETIONARY, SectorRotation.REAL_ESTATE],
                'vix_bias': -2.5,  # Year-end calm
                'description': 'Santa rally - Year-end strength'
            }
        }
    
    def _initialize_sector_calendar(self) -> Dict:
        """Initialize sector rotation calendar"""
        return {
            'Q1': {
                'primary_sectors': [SectorRotation.TECHNOLOGY, SectorRotation.FINANCIALS],
                'secondary_sectors': [SectorRotation.INDUSTRIALS, SectorRotation.HEALTHCARE],
                'avoid_sectors': [SectorRotation.UTILITIES],
                'rationale': 'New year growth, tech leadership, financial strength'
            },
            'Q2': {
                'primary_sectors': [SectorRotation.CONSUMER_DISCRETIONARY, SectorRotation.TECHNOLOGY],
                'secondary_sectors': [SectorRotation.ENERGY, SectorRotation.INDUSTRIALS],
                'avoid_sectors': [SectorRotation.UTILITIES, SectorRotation.REAL_ESTATE],
                'rationale': 'Consumer spending, spring growth, energy demand'
            },
            'Q3': {
                'primary_sectors': [SectorRotation.UTILITIES, SectorRotation.CONSUMER_STAPLES],
                'secondary_sectors': [SectorRotation.HEALTHCARE, SectorRotation.REAL_ESTATE],
                'avoid_sectors': [SectorRotation.TECHNOLOGY, SectorRotation.CONSUMER_DISCRETIONARY],
                'rationale': 'Defensive summer positioning, utility demand, staples safety'
            },
            'Q4': {
                'primary_sectors': [SectorRotation.CONSUMER_DISCRETIONARY, SectorRotation.FINANCIALS],
                'secondary_sectors': [SectorRotation.TECHNOLOGY, SectorRotation.REAL_ESTATE],
                'avoid_sectors': [SectorRotation.UTILITIES],
                'rationale': 'Holiday spending, year-end positioning, financial strength'
            }
        }
    
    def _initialize_vix_patterns(self) -> Dict:
        """Initialize VIX seasonal patterns"""
        return {
            'monthly_vix_bias': {
                1: -2.0,   # January: Lower VIX
                2: 1.5,    # February: Earnings volatility
                3: 0.5,    # March: Quarter end neutral
                4: -1.5,   # April: Post-tax calm
                5: 2.0,    # May: Pre-summer uncertainty
                6: 1.0,    # June: Summer start
                7: 0.0,    # July: Mixed patterns
                8: 5.0,    # August: Volatility spike risk
                9: 3.5,    # September: Back-to-school volatility
                10: 2.5,   # October: Fear month
                11: -1.0,  # November: Pre-holiday calm
                12: -2.5   # December: Year-end calm
            },
            'seasonal_vix_regime_adjustments': {
                Season.SPRING: {'multiplier': 0.9, 'description': 'Lower spring volatility'},
                Season.SUMMER: {'multiplier': 1.3, 'description': 'Higher summer volatility'},
                Season.AUTUMN: {'multiplier': 1.2, 'description': 'Autumn uncertainty'},
                Season.WINTER: {'multiplier': 0.8, 'description': 'Winter calm'}
            }
        }
    
    def UpdateSeasonalConfiguration(self, current_time: datetime) -> Dict:
        """Update seasonal configuration based on current date"""
        try:
            current_month = MarketMonth(current_time.month)
            
            # Get monthly configuration
            month_config = self.seasonal_config[current_month]
            self.current_month_config = month_config
            self.current_season = month_config['season']
            
            # Get quarterly sector rotation
            quarter = f"Q{((current_time.month - 1) // 3) + 1}"
            sector_config = self.sector_rotation_calendar[quarter]
            self.current_sector_emphasis = sector_config
            
            # Log seasonal transition if changed
            if not hasattr(self, '_last_month') or self._last_month != current_month:
                self.algorithm.Log(f"🌱 SEASONAL TRANSITION: {current_month.name}")
                self.algorithm.Log(f"   • Season: {month_config['season'].value}")
                self.algorithm.Log(f"   • Allocation Multiplier: {month_config['allocation_multiplier']:.2f}x")
                self.algorithm.Log(f"   • Risk Adjustment: {month_config['risk_adjustment']:.2f}x")
                self.algorithm.Log(f"   • Description: {month_config['description']}")
                self.algorithm.Log(f"   • Preferred Strategies: {', '.join(month_config['preferred_strategies'])}")
                self.algorithm.Log(f"   • Primary Sectors: {', '.join([s.value for s in sector_config['primary_sectors']])}")
                self._last_month = current_month
            
            return {
                'month_config': month_config,
                'sector_config': sector_config,
                'season': month_config['season'],
                'updated': True
            }
            
        except Exception as e:
            self.algorithm.Error(f"Error updating seasonal configuration: {e}")
            return {'updated': False, 'error': str(e)}
    
    def GetSeasonalAllocationMultiplier(self, current_time: datetime) -> float:
        """Get seasonal allocation multiplier for position sizing"""
        try:
            if not self.current_month_config:
                self.UpdateSeasonalConfiguration(current_time)
            
            base_multiplier = self.current_month_config['allocation_multiplier']
            
            # Apply VIX seasonal bias if available
            if hasattr(self.algorithm, 'Securities') and 'VIX' in self.algorithm.Securities:
                current_vix = self.algorithm.Securities['VIX'].Price
                seasonal_vix_bias = self.current_month_config['vix_bias']
                expected_vix = current_vix - seasonal_vix_bias
                
                # Adjust multiplier based on VIX deviation from seasonal norm
                if current_vix > expected_vix + 3:  # VIX higher than seasonal norm
                    base_multiplier *= 0.85  # Reduce allocation
                elif current_vix < expected_vix - 3:  # VIX lower than seasonal norm
                    base_multiplier *= 1.15  # Increase allocation
            
            return max(0.5, min(1.5, base_multiplier))  # Cap between 50% and 150%
            
        except Exception as e:
            self.algorithm.Error(f"Error calculating seasonal allocation multiplier: {e}")
            return 1.0  # Default multiplier
    
    def GetSeasonalRiskAdjustment(self, current_time: datetime) -> float:
        """Get seasonal risk adjustment factor"""
        try:
            if not self.current_month_config:
                self.UpdateSeasonalConfiguration(current_time)
            
            return self.current_month_config['risk_adjustment']
            
        except Exception as e:
            self.algorithm.Error(f"Error calculating seasonal risk adjustment: {e}")
            return 1.0  # Default risk adjustment
    
    def GetPreferredStrategies(self, current_time: datetime) -> List[str]:
        """Get preferred strategies for current season"""
        try:
            if not self.current_month_config:
                self.UpdateSeasonalConfiguration(current_time)
            
            return self.current_month_config['preferred_strategies']
            
        except Exception as e:
            self.algorithm.Error(f"Error getting preferred strategies: {e}")
            return ['LT112', 'FRIDAY_0DTE']  # Default strategies
    
    def GetSectorEmphasis(self, current_time: datetime) -> Dict:
        """Get current sector emphasis for allocation"""
        try:
            if not self.current_sector_emphasis:
                self.UpdateSeasonalConfiguration(current_time)
            
            return {
                'primary_sectors': [s.value for s in self.current_sector_emphasis['primary_sectors']],
                'secondary_sectors': [s.value for s in self.current_sector_emphasis['secondary_sectors']],
                'avoid_sectors': [s.value for s in self.current_sector_emphasis['avoid_sectors']],
                'rationale': self.current_sector_emphasis['rationale']
            }
            
        except Exception as e:
            self.algorithm.Error(f"Error getting sector emphasis: {e}")
            return {'primary_sectors': ['TECH'], 'secondary_sectors': [], 'avoid_sectors': []}
    
    def ShouldAdjustStrategy(self, strategy_name: str, current_time: datetime) -> Dict:
        """Determine if strategy should be adjusted based on seasonal patterns"""
        try:
            preferred_strategies = self.GetPreferredStrategies(current_time)
            allocation_multiplier = self.GetSeasonalAllocationMultiplier(current_time)
            risk_adjustment = self.GetSeasonalRiskAdjustment(current_time)
            
            is_preferred = strategy_name.upper() in [s.upper() for s in preferred_strategies]
            
            # Calculate strategy-specific adjustments
            if is_preferred:
                strategy_multiplier = allocation_multiplier * 1.2  # Boost preferred strategies
                strategy_risk = risk_adjustment * 1.1  # Slightly increase risk for preferred
                recommendation = "INCREASE"
            else:
                strategy_multiplier = allocation_multiplier * 0.8  # Reduce non-preferred
                strategy_risk = risk_adjustment * 0.9  # Slightly decrease risk
                recommendation = "DECREASE"
            
            return {
                'should_adjust': True,
                'allocation_multiplier': strategy_multiplier,
                'risk_adjustment': strategy_risk,
                'is_preferred': is_preferred,
                'recommendation': recommendation,
                'seasonal_reason': self.current_month_config['description'] if self.current_month_config else 'Seasonal adjustment'
            }
            
        except Exception as e:
            self.algorithm.Error(f"Error determining strategy adjustment: {e}")
            return {'should_adjust': False, 'error': str(e)}
    
    def GetMonthlyReport(self, current_time: datetime) -> Dict:
        """Generate monthly seasonal overlay report"""
        try:
            month_name = current_time.strftime('%B')
            
            return {
                'month': month_name,
                'season': self.current_season.value if self.current_season else 'Unknown',
                'allocation_multiplier': self.current_month_config['allocation_multiplier'] if self.current_month_config else 1.0,
                'risk_adjustment': self.current_month_config['risk_adjustment'] if self.current_month_config else 1.0,
                'preferred_strategies': self.GetPreferredStrategies(current_time),
                'sector_emphasis': self.GetSectorEmphasis(current_time),
                'vix_bias': self.current_month_config['vix_bias'] if self.current_month_config else 0.0,
                'description': self.current_month_config['description'] if self.current_month_config else 'No description'
            }
            
        except Exception as e:
            self.algorithm.Error(f"Error generating monthly report: {e}")
            return {'error': str(e)}
    
    def ExecuteSeasonalAdjustments(self, current_time: datetime, portfolio_value: float) -> Dict:
        """Execute seasonal adjustments to the portfolio"""
        try:
            # Update seasonal configuration
            config_update = self.UpdateSeasonalConfiguration(current_time)
            if not config_update['updated']:
                return {'executed': False, 'reason': 'Failed to update configuration'}
            
            # Get seasonal parameters
            allocation_multiplier = self.GetSeasonalAllocationMultiplier(current_time)
            risk_adjustment = self.GetSeasonalRiskAdjustment(current_time)
            preferred_strategies = self.GetPreferredStrategies(current_time)
            sector_emphasis = self.GetSectorEmphasis(current_time)
            
            # Log seasonal execution
            self.algorithm.Log(f"🌱 EXECUTING SEASONAL ADJUSTMENTS:")
            self.algorithm.Log(f"   • Portfolio Value: £{portfolio_value:,.0f}")
            self.algorithm.Log(f"   • Allocation Multiplier: {allocation_multiplier:.2f}x")
            self.algorithm.Log(f"   • Risk Adjustment: {risk_adjustment:.2f}x")
            self.algorithm.Log(f"   • Strategy Focus: {', '.join(preferred_strategies)}")
            self.algorithm.Log(f"   • Primary Sectors: {', '.join(sector_emphasis['primary_sectors'])}")
            
            # Store adjustment for tracking
            adjustment_key = f"{current_time.year}-{current_time.month:02d}"
            self.monthly_adjustments[adjustment_key] = {
                'date': current_time,
                'portfolio_value': portfolio_value,
                'allocation_multiplier': allocation_multiplier,
                'risk_adjustment': risk_adjustment,
                'preferred_strategies': preferred_strategies,
                'sector_emphasis': sector_emphasis
            }
            
            return {
                'executed': True,
                'allocation_multiplier': allocation_multiplier,
                'risk_adjustment': risk_adjustment,
                'preferred_strategies': preferred_strategies,
                'sector_emphasis': sector_emphasis,
                'month_description': self.current_month_config['description']
            }
            
        except Exception as e:
            self.algorithm.Error(f"Error executing seasonal adjustments: {e}")
            return {'executed': False, 'error': str(e)}
    
    def GetSeasonalStatus(self) -> Dict:
        """Get current seasonal overlay status"""
        try:
            return {
                'current_season': self.current_season.value if self.current_season else 'Unknown',
                'current_month': self.current_month_config['description'] if self.current_month_config else 'Unknown',
                'allocation_multiplier': self.current_month_config['allocation_multiplier'] if self.current_month_config else 1.0,
                'risk_adjustment': self.current_month_config['risk_adjustment'] if self.current_month_config else 1.0,
                'active_adjustments': len(self.monthly_adjustments),
                'system_active': self.current_month_config is not None
            }
            
        except Exception as e:
            self.algorithm.Error(f"Error getting seasonal status: {e}")
            return {'error': str(e), 'system_active': False}