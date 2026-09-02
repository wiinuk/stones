# AGENTS.md

## Repository instructions

- Prefer the smallest correct fix.
- Before concluding work, run the repository validation commands that apply to the change.
- If the user request includes code changes, verify with the relevant checks before finishing.
- Use the project scripts instead of ad hoc commands where possible.

## Required validation commands

For TypeScript / React changes:

- `npm run typecheck`
- `npm run lint`
- `npm run format:check`

For a full repository validation, run:

- `npm run check`

## Automatic behavior expectations

- When making or modifying code, run the relevant checks as part of the normal completion flow.
- Do not wait for explicit instructions to run validation after a code change.
- If formatting is needed, run `npm run format` before finalizing.
- If lint issues are caused by the patch, fix them before finishing.
- If TypeScript errors appear, resolve them before completion.

## Preferred workflow

1. Make the minimal code change.
2. Run targeted validation if available.
3. Run the repo check command when the change could affect multiple files or the validation is lightweight enough.
4. Report the actual results, including any remaining issues.
