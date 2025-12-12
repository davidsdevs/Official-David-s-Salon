Branch-specific services
=========================

How services are determined per branch
-------------------------------------

- Services are stored centrally in the `services` collection.
- Each service document can include a `branchPricing` object keyed by branchId.
- A branch "offers" a service if `branchPricing[branchId]` exists (not undefined/null).

Where code fetches branch services
---------------------------------

- Frontend pages that list services for a branch use `getBranchServices(branchId)` (see `src/services/branchServicesService.js`).
- `getBranchServices` fetches active services and filters those that include a `branchPricing` entry for the supplied `branchId`.

UI enforcement
--------------

- `src/pages/public/branch/BranchServicesPage.jsx` was updated to resolve the branch ID from the slug and fetch services with `getBranchServices` so that only services offered by the selected branch are displayed.
- `src/pages/public/branch/ServiceDetailPage.jsx` now validates that a requested service is offered by the selected branch and shows a friendly message when not available.

If you want services to be offered/removed from a branch, update the `branchPricing` object on the service document in Firestore or use the branch manager UI to configure branch prices.
