# Global Strategy Coordinator - Prevents strategy conflicts and interference
# Ensures orderly execution and resource allocation

from AlgorithmImports import *
from typing import Dict, List, Optional, Set
from datetime import datetime, timedelta
from enum import Enum
from core.unified_vix_manager import UnifiedVIXManager


# SYSTEM LEVERAGE OPPORTUNITY:
# This file could leverage vix_manager from unified system
# Consider delegating to: self.algo.vix_manager.{method}()
# See Implementation Audit Protocol for systematic integration patterns

class StrategyPriority(Enum):
    """Strategy execution priority levels"""
    CRITICAL = 1    # Exit rules, risk management
    HIGH = 2        # 0DTE, expiring positions
    MEDIUM = 3      # Regular trading strategies
    LOW = 4         # Opportunistic trades
    IDLE = 5        # Background monitoring

class StrategyCoordinator:
    """
    Coordinates multiple strategies to prevent conflicts
    Manages execution order, resource allocation, and mutual exclusion
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Strategy registration
        self.registered_strategies = {}
        self.active_strategies = set()
        self.blocked_strategies = set()
        
        # Execution queue by priority
        self.execution_queue = {
            StrategyPriority.CRITICAL: [],
            StrategyPriority.HIGH: [],
            StrategyPriority.MEDIUM: [],
            StrategyPriority.LOW: [],
            StrategyPriority.IDLE: []
        }
        
        # Resource locks (prevents simultaneous access)
        self.resource_locks = {
            'order_placement': None,
            'option_chain': None,
            'margin': None,
            'spy_positions': None,
            'vix_data': None
        }
        
        # Strategy dependencies and conflicts
        self.strategy_conflicts = {
            'zero_day_theta': ['futures_strangle', 'leap_ladder'],  # Don't mix 0DTE with long-term
            'naked_put_selling': ['in_perpetuity_calls'],  # Avoid conflicting SPY positions
            'lt112_management': ['naked_put_selling'],  # Both use puts
            'futures_strangle': ['zero_day_theta'],  # Different time horizons
            'emergency_exit': []  # Can override everything
        }
        
        # Execution windows (when strategies can run)
        self.execution_windows = {
            'zero_day_theta': {'start': (9, 30), 'end': (15, 45)},
            'futures_strangle': {'start': (9, 30), 'end': (15, 0)},
            'naked_put_selling': {'start': (9, 45), 'end': (15, 30)},
            'lt112_management': {'start': (10, 0), 'end': (15, 0)},
            'leap_ladder': {'start': (10, 0), 'end': (14, 30)},
            'in_perpetuity_calls': {'start': (10, 15), 'end': (14, 45)},
            'emergency_exit': {'start': (9, 0), 'end': (16, 15)}  # Extended hours
        }
        
        # Track execution history
        self.execution_history = []
        self.conflict_log = []
        
    def register_strategy(self, name: str, priority: StrategyPriority = StrategyPriority.MEDIUM):
        """Register a strategy with the coordinator"""
        
        if name in self.registered_strategies:
            self.algo.Debug(f"Strategy {name} already registered")
            return False
            
        self.registered_strategies[name] = {
            'priority': priority,
            'registered_at': self.algo.Time,
            'executions': 0,
            'last_execution': None,
            'status': 'IDLE'
        }
        
        self.algo.Log(f"Registered strategy: {name} (Priority: {priority.name})")
        return True
        
    def request_execution(self, strategy_name: str, callback_func, 
                         exclusive: bool = False) -> bool:
        """
        Request permission to execute a strategy
        Returns True if execution allowed, False if blocked
        """
        
        # Check if strategy is registered
        if strategy_name not in self.registered_strategies:
            self.algo.Error(f"Strategy {strategy_name} not registered")
            return False
            
        # Check execution window
        if not self.is_in_execution_window(strategy_name):
            self.algo.Debug(f"Strategy {strategy_name} outside execution window")
            return False
            
        # Check for conflicts
        conflicts = self.check_conflicts(strategy_name)
        if conflicts:
            self.conflict_log.append({
                'timestamp': self.algo.Time,
                'strategy': strategy_name,
                'blocked_by': conflicts,
                'exclusive': exclusive
            })
            
            # Allow critical strategies to override
            priority = self.registered_strategies[strategy_name]['priority']
            if priority == StrategyPriority.CRITICAL:
                self.algo.Log(f"OVERRIDE: Critical strategy {strategy_name} overriding conflicts")
                self.pause_strategies(conflicts)
            else:
                self.algo.Debug(f"Strategy {strategy_name} blocked by: {conflicts}")
                return False
                
        # Handle exclusive execution
        if exclusive:
            self.acquire_exclusive_lock(strategy_name)
            
        # Add to active strategies
        self.active_strategies.add(strategy_name)
        self.registered_strategies[strategy_name]['status'] = 'EXECUTING'
        
        # Execute callback
        try:
            pass
        except Exception as e:

            result = callback_func()
            
            # Record execution
            self.execution_history.append({
                'timestamp': self.algo.Time,
                'strategy': strategy_name,
                'priority': self.registered_strategies[strategy_name]['priority'].name,
                'exclusive': exclusive,
                'success': True
            })
            
            # Update strategy info
            self.registered_strategies[strategy_name]['executions'] += 1
            self.registered_strategies[strategy_name]['last_execution'] = self.algo.Time
            
            return True
            
        except Exception as e:
            self.algo.Error(f"Strategy {strategy_name} execution failed: {str(e)}")
            
            self.execution_history.append({
                'timestamp': self.algo.Time,
                'strategy': strategy_name,
                'error': str(e)
            })
            
            return False
            
        finally:
            # Clean up
            self.release_execution(strategy_name, exclusive)
            
    def release_execution(self, strategy_name: str, was_exclusive: bool = False):
        """Release execution lock for a strategy"""
        
        if strategy_name in self.active_strategies:
            self.active_strategies.remove(strategy_name)
            
        if strategy_name in self.registered_strategies:
            self.registered_strategies[strategy_name]['status'] = 'IDLE'
            
        if was_exclusive:
            self.release_exclusive_lock(strategy_name)
            
    def check_conflicts(self, strategy_name: str) -> List[str]:
        """Check if strategy conflicts with active strategies"""
        
        conflicts = []
        
        if strategy_name in self.strategy_conflicts:
            conflicting_strategies = self.strategy_conflicts[strategy_name]
            
            for active in self.active_strategies:
                if active in conflicting_strategies:
                    conflicts.append(active)
                    
        return conflicts
        
    def acquire_exclusive_lock(self, strategy_name: str):
        """Acquire exclusive lock, pausing other strategies"""
        
        # Pause all non-critical strategies
        for active in list(self.active_strategies):
            if active != strategy_name:
                priority = self.registered_strategies[active]['priority']
                if priority != StrategyPriority.CRITICAL:
                    self.blocked_strategies.add(active)
                    
        self.algo.Log(f"Exclusive lock acquired by {strategy_name}")
        
    def release_exclusive_lock(self, strategy_name: str):
        """Release exclusive lock"""
        
        # Unblock strategies
        self.blocked_strategies.clear()
        self.algo.Debug(f"Exclusive lock released by {strategy_name}")
        
    def pause_strategies(self, strategy_names: List[str]):
        """Temporarily pause strategies"""
        
        for name in strategy_names:
            if name in self.active_strategies:
                self.blocked_strategies.add(name)
                self.algo.Log(f"Paused strategy: {name}")
                
    def acquire_resource_lock(self, resource: str, strategy_name: str, 
                            timeout_seconds: int = 5) -> bool:
        """
        Acquire lock on a shared resource
        Prevents race conditions on critical resources
        """
        
        if resource not in self.resource_locks:
            self.algo.Error(f"Unknown resource: {resource}")
            return False
            
        # Check if resource is free or owned by same strategy
        current_owner = self.resource_locks[resource]
        if current_owner is None or current_owner['strategy'] == strategy_name:
            self.resource_locks[resource] = {
                'strategy': strategy_name,
                'acquired_at': self.algo.Time
            }
            return True
            
        # Check for stale lock
        if current_owner:
            age = (self.algo.Time - current_owner['acquired_at']).total_seconds()
            if age > timeout_seconds:
                self.algo.Log(f"Breaking stale lock on {resource} (held by {current_owner['strategy']})")
                self.resource_locks[resource] = {
                    'strategy': strategy_name,
                    'acquired_at': self.algo.Time
                }
                return True
                
        return False
        
    def release_resource_lock(self, resource: str, strategy_name: str):
        """Release resource lock"""
        
        if resource in self.resource_locks:
            current = self.resource_locks[resource]
            if current and current['strategy'] == strategy_name:
                self.resource_locks[resource] = None
                
    def is_in_execution_window(self, strategy_name: str) -> bool:
        """Check if strategy is within its execution window"""
        
        if strategy_name not in self.execution_windows:
            return True  # No restriction
            
        window = self.execution_windows[strategy_name]
        current_time = self.algo.Time
        
        start_hour, start_min = window['start']
        end_hour, end_min = window['end']
        
        current_minutes = current_time.hour * 60 + current_time.minute
        start_minutes = start_hour * 60 + start_min
        end_minutes = end_hour * 60 + end_min
        
        return start_minutes <= current_minutes <= end_minutes
        
    def get_execution_order(self) -> List[str]:
        """Get recommended execution order based on priority"""
        
        self.algo.Error(f"[COORDINATOR] GET_EXECUTION_ORDER START - Registered strategies: {list(self.registered_strategies.keys())}")
        self.algo.Error(f"[COORDINATOR] Blocked strategies: {list(self.blocked_strategies)}")
        
        order = []
        
        for priority in [StrategyPriority.CRITICAL, StrategyPriority.HIGH, 
                        StrategyPriority.MEDIUM, StrategyPriority.LOW]:
            self.algo.Error(f"[COORDINATOR] Checking priority {priority}")
            
            for name, info in self.registered_strategies.items():
                self.algo.Error(f"[COORDINATOR] Strategy {name}: priority={info['priority']}, blocked={name in self.blocked_strategies}")
                
                if info['priority'] == priority and name not in self.blocked_strategies:
                    in_window = self.is_in_execution_window(name)
                    self.algo.Error(f"[COORDINATOR] Strategy {name}: in_execution_window={in_window}")
                    
                    if in_window:
                        order.append(name)
                        self.algo.Error(f"[COORDINATOR] ADDED {name} to execution order")
                    else:
                        self.algo.Error(f"[COORDINATOR] BLOCKED {name} - outside execution window")
                        
        self.algo.Error(f"[COORDINATOR] FINAL EXECUTION ORDER: {order}")
        return order
        
    def should_throttle_strategy(self, strategy_name: str, 
                                min_interval_minutes: int = 5) -> bool:
        """Check if strategy should be throttled to prevent over-execution"""
        
        if strategy_name not in self.registered_strategies:
            return True
            
        last_execution = self.registered_strategies[strategy_name]['last_execution']
        if last_execution:
            time_since = (self.algo.Time - last_execution).total_seconds() / 60
            if time_since < min_interval_minutes:
                return True
                
        return False
        
    def get_statistics(self) -> Dict:
        """Get coordination statistics"""
        
        stats = {
            'registered_strategies': len(self.registered_strategies),
            'active_strategies': list(self.active_strategies),
            'blocked_strategies': list(self.blocked_strategies),
            'total_executions': len(self.execution_history),
            'total_conflicts': len(self.conflict_log),
            'resource_locks': {}
        }
        
        # Add resource lock status
        for resource, lock in self.resource_locks.items():
            if lock:
                stats['resource_locks'][resource] = {
                    'owner': lock['strategy'],
                    'held_seconds': (self.algo.Time - lock['acquired_at']).total_seconds()
                }
                
        # Add execution counts by strategy
        stats['executions_by_strategy'] = {}
        for name, info in self.registered_strategies.items():
            stats['executions_by_strategy'][name] = {
                'count': info['executions'],
                'last': info['last_execution'],
                'status': info['status']
            }
            
        return stats
        
    def log_status(self):
        """Log current coordination status"""
        
        self.algo.Log("=" * 60)
        self.algo.Log("STRATEGY COORDINATION STATUS")
        self.algo.Log("-" * 60)
        
        # Active strategies
        if self.active_strategies:
            self.algo.Log(f"Active: {', '.join(self.active_strategies)}")
        else:
            self.algo.Log("Active: None")
            
        # Blocked strategies
        if self.blocked_strategies:
            self.algo.Log(f"Blocked: {', '.join(self.blocked_strategies)}")
            
        # Resource locks
        locked_resources = [(r, l['strategy']) for r, l in self.resource_locks.items() if l]
        if locked_resources:
            self.algo.Log("Resource Locks:")
            for resource, owner in locked_resources:
                self.algo.Log(f"  {resource}: {owner}")
                
        # Recent conflicts
        if self.conflict_log:
            recent = self.conflict_log[-3:]
            self.algo.Log("Recent Conflicts:")
            for conflict in recent:
                self.algo.Log(f"  {conflict['strategy']} blocked by {conflict['blocked_by']}")
                
        self.algo.Log("=" * 60)
    
    def record_execution(self, strategy_name: str):
        """Record strategy execution - called from main.py after strategy.execute()
        
        This method tracks that a strategy completed its execute() method
        and updates execution statistics.
        """
        
        if strategy_name not in self.registered_strategies:
            self.algo.Error(f"[Coordinator] Cannot record execution for unregistered strategy: {strategy_name}")
            return
            
        try:
            self.registered_strategies[strategy_name]['executions'] += 1
        self.registered_strategies[strategy_name]['last_execution'] = self.algo.Time
        self.registered_strategies[strategy_name]['status'] = 'COMPLETED'
        except Exception as e:

            # Update execution count
            
            # Log execution
            self.execution_history.append({
                'timestamp': self.algo.Time,
                'strategy': strategy_name,
                'priority': self.registered_strategies[strategy_name]['priority'].name,
                'method': 'execute',
                'success': True
            })
            
            self.algo.Debug(f"[Coordinator] Recorded execution for {strategy_name}")
            
        except Exception as e:
            self.algo.Error(f"[Coordinator] Error recording execution for {strategy_name}: {e}")
    
    def execute_strategies(self, data, context: Dict):
        """
        CRITICAL MISSING METHOD: Execute all registered strategies in priority order
        
        This method was being called from main.py but didn't exist, causing all
        strategy execution to fail silently. This is the PRIMARY cause of no
        position opening across ALL strategies.
        
        Args:
            data: Market data from OnData
            context: Context dict with VIX, regime, time, etc.
        """
        
        self.algo.Debug(f"[COORDINATOR] === EXECUTING STRATEGIES ===")
        self.algo.Debug(f"[COORDINATOR] Context: VIX={context.get('vix', 'N/A')}, Regime={context.get('regime', 'N/A')}, Time={context.get('time', 'N/A')}")
        
        # Get execution order by priority
        execution_order = self.get_execution_order()
        
        if not execution_order:
            self.algo.Debug("[COORDINATOR] No strategies ready for execution")
            return
            
        self.algo.Debug(f"[COORDINATOR] Executing {len(execution_order)} strategies in order: {execution_order}")
        
        executed_count = 0
        
        for strategy_name in execution_order:
            try:
                pass
            except Exception as e:

                self.algo.Debug(f"[COORDINATOR] === EXECUTING {strategy_name} ===")
                
                # Check if strategy should be throttled
                if self.should_throttle_strategy(strategy_name):
                    self.algo.Debug(f"[COORDINATOR] {strategy_name} throttled - too soon since last execution")
                    continue
                
                # Get strategy instance from main algorithm
                if not hasattr(self.algo, 'strategies') or strategy_name not in self.algo.strategies:
                    self.algo.Error(f"[COORDINATOR] Strategy {strategy_name} not found in algo.strategies")
                    continue
                
                strategy_instance = self.algo.strategies[strategy_name]
                
                # Check if strategy has execute method
                if not hasattr(strategy_instance, 'execute'):
                    self.algo.Error(f"[COORDINATOR] Strategy {strategy_name} missing execute() method")
                    continue
                
                # Set strategy as active
                if strategy_name not in self.active_strategies:
                    self.active_strategies.add(strategy_name)
                    
                self.registered_strategies[strategy_name]['status'] = 'EXECUTING'
                
                # Execute strategy with error handling
                self.algo.Debug(f"[COORDINATOR] Calling {strategy_name}.execute()")
                strategy_instance.execute()
                
                # Record successful execution
                self.record_execution(strategy_name)
                executed_count += 1
                
                self.algo.Debug(f"[COORDINATOR] {strategy_name} executed successfully")
                
            except Exception as e:
                self.algo.Error(f"[COORDINATOR] EXECUTION ERROR in {strategy_name}: {e}")
                
                # Record failed execution
                self.execution_history.append({
                    'timestamp': self.algo.Time,
                    'strategy': strategy_name,
                    'error': str(e),
                    'success': False
                })
                
                # Remove from active strategies
                if strategy_name in self.active_strategies:
                    self.active_strategies.remove(strategy_name)
                    
                # Set strategy status to error
                if strategy_name in self.registered_strategies:
                    self.registered_strategies[strategy_name]['status'] = 'ERROR'
                    
            finally:
                # Clean up active status
                if strategy_name in self.active_strategies:
                    self.active_strategies.remove(strategy_name)
                    
                # Reset status to idle if not in error
                if (strategy_name in self.registered_strategies and 
                    self.registered_strategies[strategy_name]['status'] != 'ERROR'):
                    self.registered_strategies[strategy_name]['status'] = 'IDLE'
        
        self.algo.Debug(f"[COORDINATOR] === EXECUTION COMPLETE: {executed_count}/{len(execution_order)} strategies executed ===")
        
        # Log status if no strategies executed
        if executed_count == 0:
            self.algo.Error("[COORDINATOR] *** CRITICAL: NO STRATEGIES EXECUTED! ***")
            self.log_detailed_status()
    
    def log_detailed_status(self):
        """Log detailed status for debugging position opening failures"""
        
        self.algo.Error("=" * 80)
        self.algo.Error("DETAILED COORDINATOR STATUS FOR DEBUGGING")
        self.algo.Error("=" * 80)
        
        # Registered strategies
        self.algo.Error(f"Registered Strategies ({len(self.registered_strategies)}):")
        for name, info in self.registered_strategies.items():
            window_status = "IN WINDOW" if self.is_in_execution_window(name) else "OUTSIDE WINDOW"
            self.algo.Error(f"  {name}: Status={info['status']}, Priority={info['priority'].name}, "
                          f"Executions={info['executions']}, Last={info['last_execution']}, {window_status}")
        
        # Active and blocked strategies
        self.algo.Error(f"Active Strategies: {list(self.active_strategies)}")
        self.algo.Error(f"Blocked Strategies: {list(self.blocked_strategies)}")
        
        # Resource locks
        self.algo.Error("Resource Locks:")
        for resource, lock in self.resource_locks.items():
            if lock:
                age = (self.algo.Time - lock['acquired_at']).total_seconds()
                self.algo.Error(f"  {resource}: LOCKED by {lock['strategy']} ({age:.1f}s)")
            else:
                self.algo.Error(f"  {resource}: FREE")
        
        # Recent execution history
        if self.execution_history:
            recent_executions = self.execution_history[-5:]
            self.algo.Error("Recent Execution History:")
            for exec_info in recent_executions:
                status = "SUCCESS" if exec_info.get('success', False) else f"FAILED: {exec_info.get('error', 'Unknown')}"
                self.algo.Error(f"  {exec_info['timestamp']}: {exec_info['strategy']} - {status}")
        else:
            self.algo.Error("No execution history found!")
        
        # Conflict log
        if self.conflict_log:
            recent_conflicts = self.conflict_log[-3:]
            self.algo.Error("Recent Conflicts:")
            for conflict in recent_conflicts:
                self.algo.Error(f"  {conflict['timestamp']}: {conflict['strategy']} blocked by {conflict['blocked_by']}")
        
        self.algo.Error("=" * 80)