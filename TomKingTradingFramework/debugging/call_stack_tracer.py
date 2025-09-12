# Call Stack Tracer - Enhanced debugging for method signature issues
# Provides clear call flow tracking to identify root causes faster

from AlgorithmImports import *
from typing import Dict, List, Optional, Any, Callable
from functools import wraps
import traceback
import time
from dataclasses import dataclass
from datetime import datetime

@dataclass
class CallRecord:
    """Record of a method call"""
    timestamp: datetime
    component: str
    method: str
    caller: str
    args_info: str
    success: bool
    error: Optional[str] = None
    duration_ms: float = 0.0

class CallStackTracer:
    """
    Enhanced debugging system that tracks method calls and provides
    clear error reporting with call flow context
    """
    
    def __init__(self, algorithm, max_history: int = 1000):
        self.algo = algorithm
        self.max_history = max_history
        self.call_history = []
        self.active_calls = {}
        self.error_patterns = {}
        
        # Component call tracking
        self.component_stats = {}
        self.frequent_errors = {}
        
    def trace_method_call(self, component_name: str, method_name: str):
        """Decorator to trace method calls with enhanced error reporting"""
        
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                call_id = f"{component_name}.{method_name}_{time.time()}"
                start_time = time.time()
                
                # Get caller information
                caller_frame = traceback.extract_stack()[-2]
                caller_info = f"{caller_frame.filename}:{caller_frame.lineno}"
                
                # Prepare arguments info (safely)
                try:
                    args_info = f"args={len(args)-1}, kwargs={list(kwargs.keys())}"  # -1 to exclude 'self'
                except:
                    args_info = "args=unknown"
                
                # Record call start
                call_record = CallRecord(
                    timestamp=self.algo.Time,
                    component=component_name,
                    method=method_name,
                    caller=caller_info,
                    args_info=args_info,
                    success=False
                )\n                
                self.active_calls[call_id] = call_record
                
                try:
                    # Execute the method
                    result = func(*args, **kwargs)
                    
                    # Record successful completion
                    call_record.success = True
                    call_record.duration_ms = (time.time() - start_time) * 1000
                    
                    return result
                    
                except Exception as e:
                    # Record error with full context
                    call_record.success = False
                    call_record.error = str(e)
                    call_record.duration_ms = (time.time() - start_time) * 1000
                    
                    # Enhanced error reporting
                    self._report_method_error(component_name, method_name, e, caller_info)
                    
                    # Track error patterns
                    error_key = f"{component_name}.{method_name}"
                    if error_key not in self.frequent_errors:
                        self.frequent_errors[error_key] = []
                    self.frequent_errors[error_key].append(str(e))
                    
                    raise
                    
                finally:
                    # Move to history and cleanup
                    if call_id in self.active_calls:
                        final_record = self.active_calls.pop(call_id)
                        self.call_history.append(final_record)
                        
                        # Maintain history size
                        if len(self.call_history) > self.max_history:
                            self.call_history.pop(0)
                        
                        # Update component statistics
                        self._update_component_stats(component_name, method_name, final_record.success)
            
            return wrapper
        return decorator
    
    def _report_method_error(self, component: str, method: str, error: Exception, caller: str):
        """Enhanced error reporting with call flow context"""
        
        error_msg = str(error)
        
        # Check for common error patterns
        if "has no attribute" in error_msg:
            self._report_missing_method_error(component, method, error_msg, caller)
        elif "takes" in error_msg and "positional arguments" in error_msg:
            self._report_signature_mismatch_error(component, method, error_msg, caller)
        elif "module" in error_msg and "not found" in error_msg:
            self._report_import_error(component, method, error_msg, caller)
        else:
            self._report_generic_error(component, method, error_msg, caller)
    
    def _report_missing_method_error(self, component: str, method: str, error_msg: str, caller: str):
        """Report missing method error with helpful context"""
        
        self.algo.Error(f"[CallTracer] 🔍 METHOD NOT FOUND ERROR")
        self.algo.Error(f"[CallTracer] Component: {component}")
        self.algo.Error(f"[CallTracer] Method: {method}")
        self.algo.Error(f"[CallTracer] Called from: {caller}")
        self.algo.Error(f"[CallTracer] Error: {error_msg}")
        
        # Get recent call history for context
        recent_calls = self.get_recent_calls(limit=5)
        if recent_calls:
            self.algo.Error(f"[CallTracer] Recent call flow:")
            for call in recent_calls:
                status = "✅" if call.success else "❌"
                self.algo.Error(f"[CallTracer]   {status} {call.component}.{call.method} from {call.caller}")
        
        # Suggest solution
        self.algo.Error(f"[CallTracer] 💡 SOLUTION: Add missing method '{method}' to {component} component")
        self.algo.Error(f"[CallTracer] 💡 OR: Check if method name is correct in the calling code")
    
    def _report_signature_mismatch_error(self, component: str, method: str, error_msg: str, caller: str):
        """Report method signature mismatch error"""
        
        self.algo.Error(f"[CallTracer] 📝 METHOD SIGNATURE MISMATCH")
        self.algo.Error(f"[CallTracer] Component: {component}")
        self.algo.Error(f"[CallTracer] Method: {method}")
        self.algo.Error(f"[CallTracer] Called from: {caller}")
        self.algo.Error(f"[CallTracer] Error: {error_msg}")
        self.algo.Error(f"[CallTracer] 💡 SOLUTION: Check method parameters - expected vs actual arguments")
    
    def _report_import_error(self, component: str, method: str, error_msg: str, caller: str):
        """Report import/module error"""
        
        self.algo.Error(f"[CallTracer] 📦 IMPORT ERROR")
        self.algo.Error(f"[CallTracer] Component: {component}")
        self.algo.Error(f"[CallTracer] Error: {error_msg}")
        self.algo.Error(f"[CallTracer] 💡 SOLUTION: Check import statements and file paths")
    
    def _report_generic_error(self, component: str, method: str, error_msg: str, caller: str):
        """Report generic error with context"""
        
        self.algo.Error(f"[CallTracer] ❌ COMPONENT ERROR")
        self.algo.Error(f"[CallTracer] Component: {component}")
        self.algo.Error(f"[CallTracer] Method: {method}")
        self.algo.Error(f"[CallTracer] Called from: {caller}")
        self.algo.Error(f"[CallTracer] Error: {error_msg}")
    
    def _update_component_stats(self, component: str, method: str, success: bool):
        """Update component call statistics"""
        
        key = f"{component}.{method}"
        if key not in self.component_stats:
            self.component_stats[key] = {'calls': 0, 'errors': 0, 'success_rate': 0.0}
        
        stats = self.component_stats[key]
        stats['calls'] += 1
        
        if not success:
            stats['errors'] += 1
        
        stats['success_rate'] = (stats['calls'] - stats['errors']) / stats['calls']
    
    def get_recent_calls(self, limit: int = 10) -> List[CallRecord]:
        \"\"\"Get recent call history\"\"\"\n        return self.call_history[-limit:] if self.call_history else []\n    \n    def get_error_hotspots(self) -> Dict[str, Dict]:\n        \"\"\"Get methods with highest error rates\"\"\"\n        \n        hotspots = {}\n        for method_key, stats in self.component_stats.items():\n            if stats['errors'] > 0:\n                hotspots[method_key] = {\n                    'error_rate': 1.0 - stats['success_rate'],\n                    'total_errors': stats['errors'],\n                    'total_calls': stats['calls'],\n                    'recent_errors': self.frequent_errors.get(method_key, [])\n                }\n        \n        # Sort by error rate\n        return dict(sorted(hotspots.items(), key=lambda x: x[1]['error_rate'], reverse=True))\n    \n    def generate_debugging_report(self) -> str:\n        \"\"\"Generate comprehensive debugging report\"\"\"\n        \n        report = \"# DEBUGGING REPORT - Call Stack Analysis\\n\"\n        report += f\"Generated: {datetime.now()}\\n\\n\"\n        \n        # Recent calls\n        report += \"## Recent Method Calls\\n\"\n        recent = self.get_recent_calls(10)\n        for call in recent:\n            status = \"✅\" if call.success else \"❌\"\n            report += f\"{status} {call.timestamp} - {call.component}.{call.method}\\n\"\n            if call.error:\n                report += f\"   Error: {call.error}\\n\"\n        report += \"\\n\"\n        \n        # Error hotspots\n        report += \"## Error Hotspots\\n\"\n        hotspots = self.get_error_hotspots()\n        for method, stats in list(hotspots.items())[:5]:\n            report += f\"- {method}: {stats['error_rate']:.1%} error rate ({stats['total_errors']}/{stats['total_calls']})\\n\"\n        report += \"\\n\"\n        \n        # Component health\n        report += \"## Component Health\\n\"\n        component_health = {}\n        for method_key, stats in self.component_stats.items():\n            component = method_key.split('.')[0]\n            if component not in component_health:\n                component_health[component] = {'calls': 0, 'errors': 0}\n            \n            component_health[component]['calls'] += stats['calls']\n            component_health[component]['errors'] += stats['errors']\n        \n        for component, health in component_health.items():\n            error_rate = health['errors'] / health['calls'] if health['calls'] > 0 else 0\n            status = \"🔴\" if error_rate > 0.1 else \"🟡\" if error_rate > 0.05 else \"🟢\"\n            report += f\"{status} {component}: {error_rate:.1%} error rate ({health['errors']}/{health['calls']})\\n\"\n        \n        return report\n    \n    def create_method_tracer(self, component_name: str):\n        \"\"\"Create a method tracer for a specific component\"\"\"\n        \n        def trace_component_method(method_name: str):\n            return self.trace_method_call(component_name, method_name)\n        \n        return trace_component_method\n    \n    def get_call_flow_for_error(self, error_timestamp: datetime, context_minutes: int = 5) -> List[CallRecord]:\n        \"\"\"Get call flow around a specific error for debugging\"\"\"\n        \n        # Find calls within context window of error\n        context_calls = []\n        for call in self.call_history:\n            time_diff = abs((call.timestamp - error_timestamp).total_seconds() / 60)\n            if time_diff <= context_minutes:\n                context_calls.append(call)\n        \n        return sorted(context_calls, key=lambda x: x.timestamp)\n    \n    def get_debugging_dashboard(self) -> Dict:\n        \"\"\"Get debugging dashboard data\"\"\"\n        \n        return {\n            'total_calls': len(self.call_history),\n            'active_calls': len(self.active_calls),\n            'recent_calls': [{\n                'timestamp': str(call.timestamp),\n                'method': f\"{call.component}.{call.method}\",\n                'success': call.success,\n                'duration_ms': call.duration_ms,\n                'error': call.error\n            } for call in self.get_recent_calls(5)],\n            'error_hotspots': self.get_error_hotspots(),\n            'component_stats': self.component_stats\n        }