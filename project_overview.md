# David's Salon Management System (DSMS) – Project Overview

## What this project is
- A cloud-based, multi-branch salon management platform for David's Salon.
- Centralizes daily operations for all branches: users, branches, appointments, billing, inventory, clients, reports, promotions, schedules, deposits, content, and commissions.
- Designed to be production-ready with role-based access control and audit logging.

## Who uses it
- **System Admin** – manages global settings, users, roles, and system-wide content.
- **Operational Manager** – oversees branches, performance, and high-level analytics.
- **Overall Inventory Controller** – manages global inventory and stock rules.
- **Branch Manager** – manages a specific branch (staff, services, calendar, reports).
- **Receptionist** – handles appointments, arrivals, billing, and day-to-day front-desk tasks.
- **Inventory Controller** – tracks stock, purchases, and branch-level inventory.
- **Stylist** – views schedules, appointments, and client details.
- **Client** – books and manages appointments and receives promotions.

## Core capabilities (modules)
- **M01 – User & Role Management**  
  User accounts, 7+ roles, authentication (Firebase Auth), profile management, activity logs, email notifications.
- **M02 – Branch Management**  
  Branch CRUD, branch services, operating hours, branch calendar (holidays/closures), branch dashboards.
- **M03 – Appointment Management**  
  Client and receptionist booking flows, real-time availability, double-booking prevention, rescheduling/cancellation, appointment timelines.
- **M04 – Billing & POS**  
  Generating bills, tracking sales, daily summaries for branches.
- **M05 – Inventory Management**  
  Stocks, products, purchase orders, weekly stock records, low-stock alerts.
- **M06 – Client Management (CRM)**  
  Client profiles, visit history, segmentation, and basic analytics.
- **M07 – Reports & Analytics**  
  Operational, sales, and performance reports across branches and roles.
- **M08 – Promotions Management**  
  Managing promotions and sending client-facing promo emails.
- **M09 – Leave Management**  
  Staff leave requests, approvals, and impact on scheduling.
- **M10 – Deposits Management**  
  Bank deposits tracking and reconciliation.
- **M11 – Schedule Management**  
  Staff schedules, availability, and branch calendars.
- **M12 – Content Management**  
  Homepage and branch-specific content (images, text).
- **M13 – Master Products & Suppliers**  
  Global product catalog and supplier information.
- **M14 – Commissions Management**  
  Commission rules and calculations for staff.

For a detailed per-module breakdown, see `MODULES_SUMMARY.md`.

## High-level architecture
- **Frontend:** React 18 single-page application (SPA) built with Vite.
- **Backend / Data layer:** Firebase (Authentication, Firestore, Storage) as backend-as-a-service.
- **External services and APIs:**
  - OpenAI API – AI-powered insights and recommendations for analytics.
  - EmailJS & SendGrid – promotion and system emails.
  - Cloudinary – image storage and optimization.
  - Nager.Date – public holidays lookup for calendar logic.

## How the app is typically used
- System Admin configures roles, users, and global settings.
- Branches are created and configured (services, hours, calendars).
- Receptionists and clients book appointments; the system enforces availability and avoids double-booking.
- Stylists work from their schedules and appointment details.
- Billing, inventory, deposits, and commissions are recorded and reported per branch and across the organization.

## Development basics
- **Tech stack:** React, Vite, Tailwind, Firebase, assorted React libraries.
- **Key scripts (package.json):**
  - `npm run dev` – start the Vite dev server.
  - `npm run build` – build for production.
  - `npm run preview` – preview the production build.
  - `npm run lint` – run ESLint on the `src` directory.

For deeper technical details, see:
- `API_INTEGRATIONS.md` – all external APIs and environment variables.
- `docs/` – detailed module completion reports and implementation notes.

