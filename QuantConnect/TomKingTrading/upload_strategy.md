# Strategy to Upload TomKingTrading in Parts

## The Problem
- Project is 1.4MB (after cleanup)
- QuantConnect API limit is apparently < 1MB
- Cloud has outdated cached version

## Solution: Incremental Upload Strategy

### Step 1: Create Base Project with Just main.py
First, upload a minimal working version that imports nothing.

### Step 2: Add Dependencies One by One
Upload folders individually in order of dependency:

1. **config/** - Configuration files (essential)
2. **core/** - Core state management 
3. **risk/** - Risk management modules
4. **strategies/** - Strategy implementations
5. **helpers/** - Helper utilities
6. **greeks/** - Greeks calculations
7. **Others** - reporting, brokers, etc.

### Step 3: Manual Upload Process

Since the CLI won't work, we'll need to:
1. Use the QuantConnect web editor
2. Create folders manually in the cloud project
3. Copy-paste file contents

## Alternative: Simplified Single-File Version
Create a self-contained main.py with all critical logic embedded.