Owner Portal MVP — Smoke Tests

1) Locked ownerIds (non-admin)
- Attempt to update restaurants/{id}.ownerIds as a non-admin → expect PERMISSION_DENIED.

2) Proof privacy
- Upload proofs under owner_claims/{claimId}/proofs/*.
- Requester and admins can read/write; others denied.

3) Admin approve
- Visit /admin/claims as admin.
- See pending claims; Approve adds uid to restaurants/{id}.ownerIds and sets claim status=approved.

4) Hamburger badge
- As owner, open menu → label shows “For Restaurants • Owner access”.

5) Cache TTL
- Call analytics twice within <6h → restaurant_stats.lastUpdated unchanged.
- After >6h or force=true → updated.

6) Redirect preservation
- Logged out → /owner?claim=XYZ → redirected to /login?redirect=...
- After login/profile creation → lands on /owner?claim=XYZ; claim panel open with prefilled ID.

7) Claim submit
- Submit claim with proofs → creates owner_claims doc, uploads under owner_claims/{claimId}/proofs/*, updates claim with proofUrls, shows success toast.

