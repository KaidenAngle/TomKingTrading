# AGGRESSIVE CLEANUP PLAN - FINAL MINIMIZATION

## 🚨 CURRENT PROBLEM
TomKingTrader has **22 directories** - WAY TOO MANY!
Most are development artifacts, tests, demos, and outputs that are NOT needed to run the trading system.

## 🎯 ESSENTIAL DIRECTORIES ONLY (Keep these)
```
TomKingTrader/
├── src/           # Core trading modules (42 files) - ESSENTIAL
├── core/          # Unified modules (3 files) - ESSENTIAL  
├── public/        # Web dashboard - ESSENTIAL
├── reporting/     # Report generation - KEEP
├── utils/         # Utilities - KEEP
└── node_modules/  # Dependencies - ESSENTIAL
```

## 🗑️ TO ARCHIVE IMMEDIATELY (16 directories!)

### Development/Test Artifacts (NOT needed for production)
- `tests/` - Test files, not needed to RUN the system
- `test-reports/` - Test output
- `demo_output/` - Demo artifacts
- `demo_results/` - More demo stuff
- `PROOF_OF_REAL_EXECUTION/` - Demo proof files
- `examples/` - Example code
- `docs/` - Development documentation
- `templates/` - Templates

### Data/Output Directories (Can recreate as needed)
- `data/` - Will be created when needed
- `historical_data/` - Can download when needed
- `exports/` - Export output, recreated on demand
- `reports/` - Report output, recreated on demand
- `output/` - General output
- `logs/` - Log files, recreated automatically
- `config/` - Appears empty or minimal

### Already Archived (Can be DELETED)
- `ARCHIVE_EXECUTORS/` - Already archived executors
- `ARCHIVE_REDUNDANT/` - Already archived files

## 📁 ROOT CLAUDE FOLDER CLEANUP

### Can Archive
- `demo_results/` - Demo proof files, not needed

### Keep (For Now)
- `API Documentation/` - Useful reference
- `.git/` - Version control
- `.claude/` - Claude config
- `ARCHIVE_REFERENCE/` - Already archived docs

## 📊 SPACE SAVINGS ESTIMATE
- Tests & demos: ~2MB
- Data folders: ~10MB  
- Archive folders: ~1MB
- **Total: ~13MB savings**

## 🏗️ FINAL MINIMAL STRUCTURE
```
Claude/
├── TomKingTrader/
│   ├── index.js           # Entry point
│   ├── package.json       # Dependencies
│   ├── credentials.config.js
│   ├── .env
│   ├── src/              # Core modules (42 files)
│   ├── core/             # Unified modules (3 files)
│   ├── public/           # Dashboard
│   ├── reporting/        # Reports
│   ├── utils/            # Utilities
│   └── node_modules/     # Dependencies
├── API Documentation/    # Reference
├── ARCHIVE_ALL/         # Everything else moved here
└── [Key .txt/.md files] # Framework docs only
```

## ⚡ EXECUTE CLEANUP
```bash
# Create mega archive
mkdir -p D:/OneDrive/Trading/Claude/ARCHIVE_ALL

# Move all non-essential TomKingTrader folders
cd D:/OneDrive/Trading/Claude/TomKingTrader
mv tests test-reports demo_output demo_results PROOF_OF_REAL_EXECUTION examples docs templates data historical_data exports reports output logs config ARCHIVE_EXECUTORS ARCHIVE_REDUNDANT ../../ARCHIVE_ALL/

# Move root demo folder
cd D:/OneDrive/Trading/Claude
mv demo_results ARCHIVE_ALL/

# Result: Clean, minimal structure!
```

## ✅ BENEFITS
1. **70% fewer directories** (22 → 6)
2. **Faster navigation** for Claude
3. **No confusion** about what's important
4. **Can restore** from ARCHIVE_ALL if needed
5. **Production ready** minimal structure

## 🔒 PREVENTION MEASURES NEEDED
1. **No test files in src/** - Tests go in archived tests/
2. **No demo/proof files** - Not needed for production
3. **No duplicate modules** - Use unified ones
4. **No output in repo** - Generate to temp locations
5. **Regular cleanup** - Archive anything not used in 30 days