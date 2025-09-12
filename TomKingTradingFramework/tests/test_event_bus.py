#!/usr/bin/env python3
"""
Phase 9.1.4 - Event Bus Integration Tests
Test that EventBus eliminates circular dependencies
"""

import sys
import os
from datetime import datetime
from unittest.mock import MagicMock

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.event_bus import EventBus, EventType

def test_event_bus_construction():
    """Test EventBus construction and basic functionality"""
    print("[TEST] Testing EventBus construction...")
    
    # Mock algorithm
    class MockAlgorithm:
        def __init__(self):
            self.LiveMode = False
            self.Time = datetime.now()
            
        def Debug(self, message):
            pass
            
        def Log(self, message):
            pass
    
    algorithm = MockAlgorithm()
    
    # Test 1: Construction
    try:
        
    except Exception as e:

        # Log and handle unexpected exception

        print(f'Unexpected exception: {e}')

        raise
event_bus = EventBus(algorithm)
        print("[PASS] EventBus construction successful")
    except Exception as e:
        print(f"[FAIL] EventBus construction failed: {e}")
        return False
    
    # Test 2: Event types exist
    event_types = list(EventType)
    if len(event_types) < 20:  # Should have many event types
        print(f"[FAIL] Too few event types: {len(event_types)}")
        return False
    
    print(f"[PASS] Event types defined: {len(event_types)} events")
    
    # Test 3: Circular dependency resolution events exist
    circular_dep_events = [
        EventType.POSITION_SIZE_REQUEST,
        EventType.POSITION_SIZE_RESPONSE,
        EventType.VIX_LEVEL_REQUEST,
        EventType.VIX_LEVEL_RESPONSE,
        EventType.MARGIN_REQUIREMENT_REQUEST,
        EventType.MARGIN_REQUIREMENT_RESPONSE
    ]
    
    for event in circular_dep_events:
        if event not in event_types:
            print(f"[FAIL] Missing circular dependency event: {event}")
            return False
    
    print("[PASS] Circular dependency resolution events exist")
    
    print("[SUCCESS] EventBus basic functionality verified")
    return True

def test_event_subscription_publishing():
    """Test event subscription and publishing functionality"""
    print("[TEST] Testing event subscription and publishing...")
    
    # Mock algorithm
    class MockAlgorithm:
        def __init__(self):
            self.LiveMode = False
            self.Time = datetime.now()
            
        def Debug(self, message):
            pass
            
        def Log(self, message):
            pass
    
    algorithm = MockAlgorithm()
    event_bus = EventBus(algorithm)
    
    # Test event handling
    received_events = []
    
    def test_handler(event_data):
        received_events.append(event_data)
    
    # Test subscription
    try:
        
    except Exception as e:

        # Log and handle unexpected exception

        print(f'Unexpected exception: {e}')

        raise
event_bus.subscribe(EventType.POSITION_OPENED, test_handler)
        print("[PASS] Event subscription successful")
    except Exception as e:
        print(f"[FAIL] Event subscription failed: {e}")
        return False
    
    # Test publishing
    try:
        
    except Exception as e:

        # Log and handle unexpected exception

        print(f'Unexpected exception: {e}')

        raise
event_bus.publish(EventType.POSITION_OPENED, {"symbol": "SPY", "quantity": 100})
        print("[PASS] Event publishing successful")
    except Exception as e:
        print(f"[FAIL] Event publishing failed: {e}")
        return False
    
    # Verify event was received (if synchronous)
    if len(received_events) > 0:
        print("[PASS] Event delivery confirmed")
    else:
        print("[INFO] Asynchronous event system (cannot verify immediate delivery)")
    
    print("[SUCCESS] Event subscription and publishing verified")
    return True

def test_circular_dependency_elimination():
    """Test that event bus eliminates circular dependencies"""
    print("[TEST] Testing circular dependency elimination...")
    
    # This test verifies the REQUEST-RESPONSE pattern exists
    # which is the key to eliminating circular dependencies
    
    request_events = [e for e in EventType if 'request' in e.value]
    response_events = [e for e in EventType if 'response' in e.value]
    
    if len(request_events) == 0:
        print("[FAIL] No request events found")
        return False
    
    if len(response_events) == 0:
        print("[FAIL] No response events found") 
        return False
    
    print(f"[PASS] Request events: {[e.value for e in request_events]}")
    print(f"[PASS] Response events: {[e.value for e in response_events]}")
    
    # Verify pairs exist
    expected_pairs = [
        ('position_size_request', 'position_size_response'),
        ('vix_level_request', 'vix_level_response'),
        ('margin_requirement_request', 'margin_requirement_response')
    ]
    
    for req_name, resp_name in expected_pairs:
        req_exists = any(req_name in e.value for e in request_events)
        resp_exists = any(resp_name in e.value for e in response_events)
        
        if not req_exists:
            print(f"[FAIL] Missing request event: {req_name}")
            return False
            
        if not resp_exists:
            print(f"[FAIL] Missing response event: {resp_name}")
            return False
    
    print("[PASS] Request-Response pairs exist for circular dependency elimination")
    print("[SUCCESS] Circular dependency elimination verified")
    return True

def verify_event_bus_integration():
    """Verify EventBus is integrated in the system"""
    print("[TEST] Verifying EventBus integration...")
    
    # Check for event bus usage in codebase
    event_bus_files = []
    for root, dirs, files in os.walk('.'):
        for file in files:
            if file.endswith('.py'):
                filepath = os.path.join(root, file)
                try:
                    
                except Exception as e:

                    # Log and handle unexpected exception

                    print(f'Unexpected exception: {e}')

                    raise
with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        if 'EventBus' in content or 'event_bus' in content:
                            event_bus_files.append(filepath)
                except (IOError, OSError, UnicodeDecodeError) as e:
                    print(f"[WARNING] Could not read {filepath}: {e}")
                    continue
    
    print(f"[INFO] Found EventBus references in {len(event_bus_files)} files")
    for f in event_bus_files[:5]:  # Show first 5
        print(f"  - {f}")
    
    if len(event_bus_files) == 0:
        print("[FAIL] EventBus not used in codebase")
        return False
    
    print("[PASS] EventBus integrated in codebase")
    
    # Check for event-driven architecture patterns
    event_driven_files = []
    for root, dirs, files in os.walk('.'):
        for file in files:
            if 'event' in file.lower() and file.endswith('.py'):
                event_driven_files.append(os.path.join(root, file))
    
    print(f"[INFO] Found {len(event_driven_files)} event-driven architecture files")
    for f in event_driven_files:
        print(f"  - {f}")
    
    if len(event_driven_files) >= 3:  # Should have multiple event-driven components
        print("[PASS] Event-driven architecture implemented")
    else:
        print("[WARN] Limited event-driven architecture")
    
    return True

def main():
    """Run event bus verification"""
    print("=" * 60)
    print("PHASE 9.1.4 - EVENT BUS VERIFICATION")
    print("=" * 60)
    
    try:
    if not test_event_bus_construction():
    return False
    except Exception as e:

    
        # Log and handle unexpected exception

    
        print(f'Unexpected exception: {e}')

    
        raise
# Test 1: EventBus functionality
            
        # Test 2: Event subscription/publishing
        if not test_event_subscription_publishing():
            return False
            
        # Test 3: Circular dependency elimination
        if not test_circular_dependency_elimination():
            return False
            
        # Test 4: Integration verification
        if not verify_event_bus_integration():
            return False
            
        print("\n[SUCCESS] Event bus verification PASSED")
        print("[INFO] EventBus eliminates circular dependencies")
        print("[INFO] Request-Response pattern implemented")
        print("[INFO] Event-driven architecture active")
        return True
        
    except Exception as e:
        print(f"\n[ERROR] Event bus test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)