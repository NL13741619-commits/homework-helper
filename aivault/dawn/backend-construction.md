# Dawn Backend Construction

Target project: svtkpdmqemidlasowqew only.
Executor: GPT with connected Supabase tools.
Do not request or commit secret keys.

## Purpose
Prepare schema, RLS, and function contracts so Dawn runtime can operate tasks on base-002.

## Execution order
1. Confirm project is ACTIVE_HEALTHY.
2. List existing tables, policies, and edge functions.
3. Apply schema changes from this branch (if any).
4. Deploy or update edge functions only under aivault-dawn-* names.
5. Verify with a test task: submit, status, result, cleanup.

## Verification
- Read back created objects.
- Submit a disposable test task and confirm status transitions.
- Delete the test task.
- Report: objects changed, test result, remaining blockers.

## Constraints
- Project ref: svtkpdmqemidlasowqew
- Do not touch perfsipperncvjocznhl
- Do not enable paid services
- Do not delete existing data
