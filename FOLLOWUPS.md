# Follow-ups

## SCRUM-311 follow-up — factory location
If a third factory pattern emerges in `scripts/configs/`, extract `make*Runner` functions
to a dedicated `scripts/configs/helpers/scriptFactory.ts` file. Currently co-located with
their underlying library functions for minimal diff, but this mixes library logic with
entrypoint glue. Acceptable for two; revisit at three.

## SCRUM-311 follow-up — ALL_MANAGED_FEATURE_SPECS type annotation
`ALL_MANAGED_FEATURE_SPECS` in `scripts/configs/helpers/featureFlagSpecs.ts` is annotated
as `OrderTypeFeatureSpec[]` but contains `ModuleFeatureSpec` entries (non-order-type specs
like GASLESS, JIT, SUBACCOUNT, etc.). Fix: change the annotation to `ManagedFeatureSpec[]`.
Pre-existing error; out of scope for SCRUM-311.
