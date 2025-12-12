Booking flow improvements
========================

What changed
------------
- Before clients confirm a booking, the app now shows a breakdown of the appointment (branch, service, stylist, duration and per-service price) inside the confirmation modal.
- The Total Price is labeled as ESTIMATED (yellow badge) and a short note warns that the final price may change depending on hair length/type or additional work.
- The booking flow performs a branch-validation check so only services offered for the selected branch (by `branchPricing`) can be selected and booked. If the service no longer has a price for the branch, the booking will be rejected and the user asked to reselect.

Where to look
-------------
- UI: `src/pages/client/Appointments.jsx` (breakdown and summary modal)
 - UI: `src/pages/client/Appointments.jsx` (breakdown and summary modal)

Clickable appointment cards
-------------------------

- Appointment cards are now clickable across the app where supported. Clicking a card opens the appointment details modal.
- Code: `src/components/appointment/AppointmentCard.jsx` and `src/components/appointment/AppointmentDetails.jsx`.
- Service availability lookup: `src/services/branchServicesService.js` (getBranchServices and getServiceById)

Client Transaction History
--------------------------

- New page: `src/pages/client/Transactions.jsx` — lists paid transactions for the current user and shows a details modal with items, totals and payment method. Searchable by id/branch/item.

Products UX
-----------

- Product cards are now fully clickable and keyboard accessible on `src/pages/client/Products.jsx`.
- Price selection follows this priority: `otcPrice` (client retail) -> `price` -> `salonUsePrice`. Product detail modal shows full fields (name, brand, category, description, prices, UPC, shelf life).

Testing notes
-------------
1. Start the app and choose a branch that has some services set up in Firestore (services must include `branchPricing[branchId]`).
2. Try to book a service under that branch — you should see the booking breakdown and an ESTIMATED badge before confirming.
3. Try removing the service's `branchPricing[branchId]` entry in Firestore and re-try — the UI should surface an error and prevent confirmation.

Future improvements
-------------------
- Add server-side validation on appointment create (appointmentService already checks some scenarios; consider adding a final branch/service validation to protect from race conditions).
- Add a shared helper for mapping slug -> branchId and reuse across components.
