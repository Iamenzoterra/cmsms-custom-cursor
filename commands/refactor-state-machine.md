Execute the structural refactor described in `TASK-refactor-state-machine.md`.

## Pre-flight

1. Read `TASK-refactor-state-machine.md` fully before starting
2. Read `docs/00-CONTEXT.md` for project orientation  
3. Read `docs/12-REF-BODY-CLASSES.md` for the body class state machine
4. Read `docs/13-REF-EFFECTS.md` for effect formula magic numbers
5. Read `docs/09-MAP-DEPENDENCY.md` for function line numbers in `custom-cursor.js`

## Execution

1. Create backup: `cp custom-cursor.js custom-cursor.js.pre-refactor`
2. Execute **Phase 1**: Extract all magic numbers into named constants section
3. Execute **Phase 2**: Create CursorState object, replace all body class manipulation
4. Run verification grep from the task document to confirm no stray classList calls
5. Invoke agents in order: security-sentinel → render-engine → css-compat → memory-guardian → doc-keeper → qa-strategist → code-quality

## Critical Rules

- **ZERO behavioral changes** — this is a pure structural refactor
- Every magic number must keep its exact original value
- CursorState must NOT be called from inside render() — only from event handlers
- Do NOT touch the sanitizer, postMessage validation, or singleton guard
- Do NOT modify CSS files or PHP files — this task is JS only
- Line numbers in the task doc are approximate — verify against actual file
