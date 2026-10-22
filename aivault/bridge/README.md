# AIVAULT Bridge Intake (dry-run only)

Implementation: `intake.mjs`. Reviewed additive backend SQL:
`sql/bridge-intake.sql`. Mapping, security review, validation and remaining host
integration: `../../docs/AIVAULT-BRIDGE-MAPPING.md`.

Run the fixed local suite from repository root:

```sh
node --test aivault/bridge/test/intake.test.mjs
```

`test/database.sql` uses only synthetic mock tasks on the authorized second
base, and records evidence. Use BEGIN/ROLLBACK for nonpersistent rehearsal.
It must never run on any Safe Reunion project.

The module exports createIntake and supabaseRpc but does not start a server.
A future authorized private host must supply distinct ≥32-byte sender/runner
credentials, the second-base server credential, mutable enabled() state, local
bind address, TLS proxy and durable redacted audit sink. Never put server
credentials in frontend source, Issues, PRs or the command envelope.

Transport routes are POST /commands, /claim, /finish. Only /commands accepts
base1; only /claim and /finish accept the runner credential. Bodies and actor
are validated again in the database. Claims and finishes identify task_id;
finish also requires the returned string fencing_token. No arbitrary result,
shell command, model selection, deployment or merge field is supported.
