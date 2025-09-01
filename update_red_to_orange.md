# Red to Orange Conversion - Complete Change List

## Files to Update:

### 1. Frontend Types (frontend/src/types/game.ts)
- ✅ PlayerColor.RED → PlayerColor.ORANGE
- ✅ 'red' → 'orange'

### 2. Backend Types (backend/src/types/game.ts)  
- ✅ PlayerColor.RED → PlayerColor.ORANGE
- ✅ 'red' → 'orange'

### 3. LudoBoard.tsx - Variable Names
- ✅ redDiscs → orangeDiscs
- ✅ setRedDiscs → setOrangeDiscs  
- ✅ redPath → orangePath
- ✅ redSquares → orangeSquares

### 4. LudoBoard.tsx - PlayerColor References
- ✅ PlayerColor.RED → PlayerColor.ORANGE (in getDieColor)
- ✅ PlayerColor.RED → PlayerColor.ORANGE (in getColorData)
- ✅ PlayerColor.RED → PlayerColor.ORANGE (in finalSquare cases)
- ❌ PlayerColor.RED → PlayerColor.ORANGE (in handleDiscClick)
- ❌ PlayerColor.RED → PlayerColor.ORANGE (in startingPositions)
- ❌ PlayerColor.RED → PlayerColor.ORANGE (in colors array)
- ❌ PlayerColor.RED → PlayerColor.ORANGE (in collision detection)
- ❌ PlayerColor.RED → PlayerColor.ORANGE (in victory logic)

### 5. LudoBoard.tsx - String References
- ❌ 'red' → 'orange' (in player color checks)
- ❌ 'red' → 'orange' (in CSS class names)

### 6. CSS Classes (LudoBoard.css)
- ✅ .red-disc → .orange-disc (background colors updated)
- ❌ .red-corner → .orange-corner
- ❌ .red-square → .orange-square  
- ❌ .red-arrow → .orange-arrow
- ❌ .red-name → .orange-name
- ❌ .red-home-pill → .orange-home-pill
- ❌ .red-placeholder → .orange-placeholder
- ❌ .final-square-red → .final-square-orange

### 7. Other Components
- ❌ ColorSelection.tsx: PlayerColor.RED → PlayerColor.ORANGE
- ❌ StarterSelection.tsx: PlayerColor.RED → PlayerColor.ORANGE, 'red' → 'orange'
- ❌ App.tsx: PlayerColor.RED → PlayerColor.ORANGE

### 8. CSS Color Values
- ❌ #ff6b6b → #ff9500 (orange)
- ❌ #fa5252 → #ff8c00 (orange)
- ❌ #e03131 → #ff7f00 (orange)

## Remaining Work:
Need to systematically update all remaining references to complete the conversion.
