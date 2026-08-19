# V-TECH PRO v4.2 — Complete User Guide

> **For:** Shop owners, staff, and clients
> **Last Updated:** August 2026

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Daily Work](#2-daily-work)
3. [Inventory](#3-inventory)
4. [Finance](#4-finance)
5. [People](#5-people)
6. [Reports](#6-reports)
7. [System Settings](#7-system-settings)
8. [Client Portal](#8-client-portal)
9. [Public Pages](#9-public-pages)
10. [Tips and Shortcuts](#10-tips-and-shortcuts)

---

## 1. Getting Started

### What is V-TECH PRO?

V-TECH PRO is a **complete shop management system** for electronics repair businesses. It handles:

- **Jobs** -- Track every repair from intake to delivery
- **Inventory** -- Manage spare parts stock with locations
- **Clients** -- Customer database with payment history
- **Staff** -- Attendance, salary, commission tracking
- **Finance** -- Payments, expenses, loans, profit tracking
- **Reports** -- Business analytics and insights

### First Time Setup

1. Open the app. You will see the **Setup Wizard**
2. Enter your **business name**, **email**, and **password**
3. This creates your **admin account**
4. Login with your email and password

### Understanding Roles

| Role | Can Do |
|------|--------|
| **Admin** | Everything -- full access to all features |
| **Staff** | Daily work -- jobs, clients, attendance (no settings/reports) |
| **Client** | View own repairs, payments, and ledger only |

### Login

1. Go to the app. The **Login page** appears
2. Enter **email** and **password**
3. Click **Login**
4. You will land on the **Dashboard**

**Tip:** If you forget your password, ask your admin to reset it from System > Users.

---

## 2. Daily Work

These are the features you will use **every day**. They appear at the top of the sidebar for quick access.

---

### 2.1 Dashboard

**URL:** `/dashboard`

**What it shows:** A bird's-eye view of your entire business.

| Section | What It Means |
|---------|---------------|
| Total Revenue | Money earned this month (repairs + sales) |
| Pending Jobs | Jobs waiting to be worked on |
| Completed Today | Jobs finished today |
| Low Stock Alerts | Products running out of stock |
| Revenue Chart | Monthly revenue bar graph |
| Status Pie Chart | Breakdown of jobs by status |
| Recent Jobs | Latest 5 jobs added |
| Recent Payments | Latest 5 payments received |
| AI Alerts | Smart alerts about your business |

**How to use:**
- Check this page **every morning** to see what needs attention
- Click on any job/payment card to go to its detail page
- The **QR Code** button shares your shop's public page

---

### 2.2 Attendance

**URL:** `/attendance`

**What it does:** Track when your staff checks in and out each day.

#### Daily Tab

| Feature | How to Use |
|---------|------------|
| Mark Present | Click the checkbox next to a staff member's name |
| Mark Half-Day | Select "Half Day" from the dropdown |
| Mark Absent | Default -- anyone not checked in is automatically Absent |
| Check-In Time | Recorded automatically when staff marks present |
| Check-Out Time | Staff clicks "Check Out" when leaving |
| GPS Location | Captured on check-in (if enabled) |

#### Monthly Report Tab

| Feature | How to Use |
|---------|------------|
| Month Picker | Select any month to view attendance |
| Present Count | Days marked present |
| Absent Count | Days not checked in |
| Half-Day Count | Days with half-day status |
| Export CSV | Download attendance data as Excel file |

**Why it matters:** Attendance data feeds into **salary calculation** -- present days x daily salary = base pay.

---

### 2.3 Jobs

**URL:** `/jobs`

**What it does:** This is the **heart of your business** -- every repair job lives here.

#### Jobs List Page

| Feature | How to Use |
|---------|------------|
| Search | Type job ID, item name, client name, or fault |
| Status Filter | Click status buttons to filter |
| Date Range | Pick start/end date to filter jobs |
| Client Filter | Filter by specific client |
| Bulk Select | Check multiple jobs then WhatsApp, print, or change status |
| Add Job | Click "+ New Job" button (top right) |

#### Job Status Meanings

| Status | Color | Meaning |
|--------|-------|---------|
| Pending | Grey | Job received, waiting to start |
| In Progress | Blue | Being worked on |
| Done | Teal | Repair complete, awaiting payment |
| Paid | Green | Paid but not yet delivered |
| Delivered | Purple | Handed back to customer |
| Cancelled | Red | Job cancelled |

#### Creating a New Job

**Step by step:**

1. **Select Client** -- Choose from dropdown or add new client
2. **Item Name** -- What device? (e.g., "Samsung Galaxy S23")
3. **Fault Description** -- What is wrong? (e.g., "Screen broken, touch not working")
4. **Assign Mechanic** -- Who will fix it?
5. **Add Services** -- What work will be done? (e.g., "Screen Replacement")
6. **Add Products** -- What parts are needed? (e.g., "Screen Assembly")
7. **Amount** -- Auto-calculated from services + products, or enter manually
8. **Location** -- Where is the device stored? (Zone/Rack/Bin/Box)
9. Click **Save** -- Job is created with a unique Job ID

**After creating:**
- Job appears in the Jobs list with "Pending" status
- You can send a **WhatsApp confirmation** to the client
- Status changes as the job progresses: Pending > In Progress > Done > Paid > Delivered

#### Job Detail View

**URL:** `/jobs/[id]/view`

| Feature | What It Does |
|---------|--------------|
| Status Timeline | Visual history of every status change |
| Activity Log | Who did what and when |
| Upload Images | Add photos of the device (before/after repair) |
| Print Invoice | Generate a printable repair invoice |
| WhatsApp | Send status update to client |
| Edit | Change job details |
| Delete | Remove the job (admin only) |

#### Bulk Actions (from Jobs list)

1. Check multiple jobs using checkboxes
2. A **bulk action bar** appears at the bottom
3. Options:
   - **Change Status** -- Set all selected jobs to a new status
   - **Send WhatsApp** -- Send status update to all selected clients
   - **Print** -- Print invoices for all selected jobs
   - **Export CSV** -- Download job data as spreadsheet

#### Other Job Pages

| Page | URL | Purpose |
|------|-----|---------|
| Bulk Create | `/jobs/bulk` | Create multiple jobs at once for one client |
| Bulk Edit | `/jobs/bulk-edit` | Reassign client or mechanic for multiple jobs |
| Combined Invoice | `/jobs/combined-invoice` | Print one invoice for multiple jobs of same client |

---

### 2.4 Sales (Direct Sales)

**URL:** `/direct-sales`

**What it does:** Record **walk-in product sales** (no repair involved).

#### When to Use
- Customer buys a product directly (accessory, spare part, etc.)
- No repair job is needed -- just a sale

#### Creating a Sale

1. Go to **Sales** > **+ New Sale**
2. (Optional) Select a client
3. Add products with quantity and price
4. Choose payment mode: Cash, UPI, or PhonePe/GPay
5. Add remarks if needed
6. Click **Save**

#### Sale Detail View

| Feature | What It Does |
|---------|--------------|
| Print Invoice | Generate printable sales invoice |
| WhatsApp | Send invoice to client via WhatsApp |
| Edit | Modify the sale |

---

### 2.5 Clients

**URL:** `/clients`

**What it does:** Your **customer database** -- every person who brings work to your shop.

#### Clients List

| Feature | How to Use |
|---------|------------|
| Search | Find client by name, contact, or address |
| Sort | Click column headers to sort |
| Bulk Select | Select multiple clients for WhatsApp or export |
| Balance Chart | Visual bar chart of client balances |
| Add Client | Click "+ New Client" |

#### Client Detail View

**URL:** `/clients/[id]` or `/clients/[id]/view`

| Section | What It Shows |
|---------|---------------|
| Profile | Name, contact, email, address, photo |
| Jobs | All repair jobs for this client |
| Payments | All payments received |
| Sales | Direct product sales |
| Loans | Loans given to this client |
| Ledger | Running balance (what they owe) |

#### Adding a Payment for a Client

1. Go to client's profile
2. Click **Add Payment**
3. Enter **amount**, **date**, **payment mode** (Cash/UPI/PhonePe)
4. Optionally add **discount**
5. Click **Save**

**Why it matters:** This keeps track of who has paid and who still owes money.

---

## 3. Inventory

**URL:** `/inventory` (via sidebar)

Manage your spare parts, products, and stock levels.

---

### 3.1 Stock Overview

**URL:** `/inventory`

**What it shows:** All products with their current stock levels.

| Feature | How to Use |
|---------|------------|
| Barcode Scanner | Scan a product barcode to find it instantly |
| Stock Status | Green = in stock, Yellow = low, Red = out |
| Stock In | Add stock to a product |
| Stock Out | Remove stock from a product |
| Location | See where the product is stored |
| Barcode Print | Print barcode labels for products |

#### Adding Stock (Stock In)

1. Find the product (search or scan barcode)
2. Click **Stock In**
3. Enter **quantity**, **purchase cost**, **supplier** (optional)
4. Enter **location** (Zone > Rack > Bin > Box)
5. Click **Save**

#### Why Track Stock?
- Know what you have and what you need
- Avoid buying parts you already have
- Track which supplier provided which parts
- Calculate profit margin accurately

---

### 3.2 Product Detail

**URL:** `/inventory/[id]`

| Feature | What It Does |
|---------|--------------|
| Stock History | Every stock-in and stock-out entry |
| Usage History | Where this product was used (jobs + sales) |
| Locations | Which shelf/box it is stored at |
| Edit Product | Change name, price, barcode, image |
| Barcode Print | Print labels |

---

### 3.3 Products (Catalog)

**URL:** `/products`

**What it does:** Manage your product catalog -- the list of all products you sell or use.

#### Adding a Product

1. Click **+ Add Product**
2. Fill in:
   - **Name** -- Product name (e.g., "Samsung Screen Assembly")
   - **Description** -- Details about the product
   - **Cost Price** -- What you pay for it
   - **Selling Price** -- What you charge the customer
   - **HSN Code** -- For GST invoicing
   - **Barcode** -- Scan or type the barcode number
   - **Alert Quantity** -- Minimum stock level (triggers low-stock alert)
   - **Image** -- Upload a photo
3. Click **Save**

---

### 3.4 Suppliers

**URL:** `/suppliers`

**What it does:** Directory of all your suppliers/vendor contacts.

#### Adding a Supplier

1. Click **+ Add Supplier**
2. Enter **name**, **contact**, **email**, **address**
3. Click **Save**

#### Supplier Detail

**URL:** `/suppliers/[id]`

Shows the supplier profile and their **Purchase Order history** -- all orders you have placed with them.

---

### 3.5 Purchase Orders

**URL:** `/inventory/purchase-orders`

**What it does:** Create and track orders placed with suppliers.

#### Workflow

```
Pending -> Ordered -> Received
                 \-> Cancelled
```

#### Creating a Purchase Order

1. Click **+ New PO**
2. Select **supplier**
3. Add **products** with quantity and cost
4. Set **expected delivery date**
5. Click **Save** -- status is "Pending"

#### Receiving Stock

1. Open the PO
2. Click **Receive**
3. Confirm quantities received
4. Stock is **automatically added** to inventory
5. Status changes to "Received"

---

### 3.6 Locations

**URL:** `/inventory/locations`

**What it does:** Manage physical storage locations in your shop.

#### Location Hierarchy

```
Zone (area) > Rack/Shelf (almari) > Bin (section) > Box (dibba)
```

Example: `Ground Floor > Rack A > Bin 3 > Box 2`

#### Why Use Locations?
- Find parts quickly -- no more searching
- Assign products to specific spots
- Use the **Spare Finder** to locate any product instantly
- Print QR codes for each location

#### Managing Locations

| Feature | How to Use |
|---------|------------|
| Add Location | Enter Zone, Rack, Bin, Box |
| Edit | Click edit icon on any location |
| Toggle | Enable/disable a location |
| QR Code | Generate and print QR code for a location |

---

### 3.7 Spare Finder

**URL:** `/inventory/locate`

**What it does:** Quickly find **where a product is stored**.

#### How to Use

1. **Scan barcode** or **type product name**
2. The app shows all locations where that product is stored
3. See exact shelf/box path
4. Copy the location path to clipboard

**Use case:** Customer asks for a specific part. Scan it, know exactly where to go.

---

## 4. Finance

**URL:** Via sidebar (admin only)

Track all money coming in and going out.

---

### 4.1 Finance Overview

**URL:** `/back-office`

**What it shows:** Quick links to all finance sub-pages with descriptions.

---

### 4.2 Payments

**URL:** `/payments`

**What it does:** List of **all payments received** from clients.

| Feature | How to Use |
|---------|------------|
| Month Filter | View payments for a specific month |
| Search | Find payment by client name or amount |
| Add Payment | Record a new payment |
| Edit/Delete | Modify or remove a payment |
| Export CSV | Download payment data |
| Print | Print payment list |

---

### 4.3 Expenses

**URL:** `/expenses`

**What it does:** Track **business expenses** (money going out).

#### Common Expense Categories
- Rent
- Electricity
- Spare Parts Purchase
- Transport/Courier
- Staff Food
- Internet/Phone
- Other

#### Adding an Expense

1. Click **+ Add Expense**
2. Select **category**
3. Enter **amount** and **date**
4. Add **remarks** (what it was for)
5. Click **Save**

**Why track expenses?** You cannot calculate **real profit** without knowing your expenses.

---

### 4.4 Salary

**URL:** `/mechanics/salary`

**What it does:** Calculate monthly salary for all staff members.

#### How Salary is Calculated

```
Base Salary = Present Days x Daily Salary
+ Commission (from jobs)
- Advance Deductions
= Net Salary
```

#### Features

| Feature | How to Use |
|---------|------------|
| Month Picker | Select the salary month |
| Auto-Calculate | System auto-fills present days and commission |
| Print Slip | Generate printable salary slip for each staff |
| Manual Override | Adjust amounts if needed |

---

### 4.5 Advance

**URL:** `/advance`

**What it does:** Track **advance payments** given to staff (deducted from salary later).

#### Adding an Advance

1. Click **+ Add Advance**
2. Select **staff member**
3. Enter **amount** and **date**
4. Add **reason** (optional)
5. Click **Save**

---

### 4.6 Client Ledger

**URL:** `/clients-admin`

**What it does:** Admin view of **all client balances** -- who owes what.

| Feature | How to Use |
|---------|------------|
| Opening Balance | Set initial balance for new clients |
| Total Balance | See combined balance of all clients |
| Edit Balance | Manually adjust a client's opening balance |

---

### 4.7 Client Loans

**URL:** `/client-loans`

**What it does:** Manage **loans given to clients** (installment-based).

#### Creating a Loan

1. Click **+ New Loan**
2. Select **client**
3. Enter **principal amount**, **interest rate**, **loan period** (months)
4. System auto-calculates **EMI amount** and **total payable**
5. Click **Save**

#### Loan Status

| Status | Meaning |
|--------|---------|
| Active | Loan is running, EMIs being paid |
| Closed | Loan fully paid |

---

### 4.8 Lenders

**URL:** `/lenders`

**What it does:** Track **loans taken from external lenders** (banks, friends, etc.).

This is the **reverse** of Client Loans -- here YOU are borrowing money.

---

## 5. People

Manage your staff and service catalog.

---

### 5.1 Staff (Mechanics)

**URL:** `/mechanics`

**What it does:** Directory of all your technicians/staff.

#### Adding Staff

1. Click **+ Add Staff**
2. Fill in:
   - **Name** (First + Last)
   - **Contact** number
   - **Designation** (Mechanic, Senior Mechanic, etc.)
   - **Daily Salary** -- how much they earn per day
   - **Commission %** -- percentage of job amount they earn
   - **Photo** -- upload a picture
3. Click **Save**

#### Staff Detail

**URL:** `/mechanics/[id]`

| Section | What It Shows |
|---------|---------------|
| Profile | Name, contact, designation, photo |
| Jobs Worked | All jobs assigned to this person |
| Attendance | Check-in/check-out history |
| Salary History | Past salary payments |
| Commission | Earned commission from jobs |

---

### 5.2 Commission

**URL:** `/mechanics/commission`

**What it does:** See how much **commission each staff member earned** in a given month.

#### How Commission Works

- When a job is marked "Paid" or "Delivered", the assigned mechanic earns commission
- Commission = Job Amount x Commission %
- This is shown in the monthly commission report

---

### 5.3 Service Catalog

**URL:** `/services`

**What it does:** Manage the **list of services** your shop offers (with prices).

#### Adding a Service

1. Click **+ Add Service**
2. Enter **name** (e.g., "Screen Replacement"), **description**, **price**, **HSN code**
3. Click **Save**

**Why it matters:** When creating a job, you select from this list -- no need to type service details every time.

---

## 6. Reports

**URL:** `/reports` (via sidebar)

**What it does:** View **business analytics** -- how is your shop performing?

---

### 6.1 Overview Reports

#### All Reports (`/reports`)

A directory page with links to every report. Use this as a starting point.

#### Vyapar Darpan (`/reports/vyapar-darpan`)

**What it does:** Monthly **Profit and Loss** summary.

Shows:
- Total Revenue (repairs + sales)
- Total Expenses
- Commission Paid
- Salary Paid
- **Net Profit**

Pick a date range and see your business health at a glance.

---

### 6.2 Financial Reports

| Report | URL | What It Shows |
|--------|-----|---------------|
| Balance Sheet | `/reports/balancesheet` | Client balances + staff dues + stock value |
| Cash Flow | `/reports/cash-flow` | Money in vs money out with charts |
| Business Ledger | `/reports/ledger` | Complete transaction ledger |
| Monthly Profit | `/reports/monthly-profit` | Month-by-month profit analysis |
| Yearly Report | `/reports/yearly` | Full year P and L by month |
| Loan Report | `/reports/loan` | Status of all client loans |

---

### 6.3 Sales and Service Reports

| Report | URL | What It Shows |
|--------|-----|---------------|
| Daily Sales | `/reports/daily-sales` | Product sales for a specific date |
| Daily Service | `/reports/daily-service` | Jobs serviced on a specific date |
| Monthly Sales | `/reports/monthly-sales` | All product sales for a month |
| Custom Sales | `/reports/custom-sales` | Sales for a custom date range |
| Custom Service | `/reports/custom-service` | Services for a custom date range |

---

### 6.4 Customer Reports

| Report | URL | What It Shows |
|--------|-----|---------------|
| Top Customers | `/reports/top-customers` | Highest-spending clients ranked |
| Delivered Report | `/reports/delivered` | All delivered jobs in date range |
| Due Reminders | `/reports/due-reminders` | Clients with pending dues (send WhatsApp reminders) |
| Pending Jobs | `/reports/pending-jobs` | All open/in-progress jobs |

---

### 6.5 Audit

| Report | URL | What It Shows |
|--------|-----|---------------|
| Activity Log | `/activity-logs` | Who did what and when (full audit trail) |

**How to use:** Filter by user, action type, or module. Click "View" to see the related job/client/staff.

---

### How to Use Reports Effectively

| When | What to Check |
|------|---------------|
| **Every Morning** | Dashboard + Pending Jobs |
| **Weekly** | Daily Sales, Cash Flow, Due Reminders |
| **Monthly** | Vyapar Darpan, Monthly Profit, Salary |
| **Quarterly** | Balance Sheet, Yearly Report |
| **When Needed** | Activity Log (to investigate something) |

---

## 7. System Settings

**URL:** Via sidebar (admin only)

---

### 7.1 Users

**URL:** `/users`

**What it does:** Manage **user accounts** -- who can log in to the system.

#### Adding a User

1. Click **+ New User**
2. Enter **name**, **email**, **password**
3. Select **role**: Admin, Staff, Developer, or Client
4. (Optional) Link to a **staff member** (mechanic)
5. Click **Save**

#### Role Permissions

| Role | Access |
|------|--------|
| Admin | Full access to everything |
| Developer | Same as admin + developer portal |
| Staff | Jobs, clients, attendance only |
| Client | Own repairs, payments, ledger only |

---

### 7.2 Settings

**URL:** `/settings`

**What it does:** Configure your **shop information**.

| Setting | What It Does |
|---------|--------------|
| Business Name | Your shop name (appears on invoices) |
| Address | Shop address |
| Phone | Contact number |
| Email | Business email |
| Logo | Upload your shop logo (appears on invoices) |
| GST Number | For tax invoicing |

---

### 7.3 Login Throttle

**URL:** `/settings/throttle`

**What it does:** Shows accounts that are **locked out** due to too many failed login attempts.

**How to use:** If someone is locked out, click **Unlock** to restore access.

---

### 7.4 WhatsApp Templates

**URL:** `/settings/whatsapp-templates`

**What it does:** Customize the **WhatsApp messages** sent to clients.

You can edit templates for:
- Job status updates
- Payment confirmations
- Delivery notifications

---

### 7.5 Backup

**URL:** `/backup`

**What it does:** **Backup and restore** your entire database.

| Feature | How to Use |
|---------|------------|
| Export All | Download all data as a JSON file |
| Import | Restore from a previously exported file |
| Table Status | See row count for each table |

**Important:** Backup regularly! At least once a week.

---

### 7.6 MariaDB Sync

**URL:** `/sync`

**What it does:** Sync data between Supabase (new system) and MariaDB (legacy system).

**When to use:** If you still have old data in MariaDB that needs to be synced.

---

### 7.7 Image Manager

**URL:** `/images`

**What it does:** View and manage **all uploaded images** in the system.

| Feature | How to Use |
|---------|------------|
| Browse | View images by bucket (client photos, job images, etc.) |
| Delete | Remove orphan images |
| Copy URL | Get the direct link to an image |

---

## 8. Client Portal

**URL:** `/my-account` (after client login)

**What it does:** A **limited view** for clients to track their own repairs and payments.

### Available Pages

| Page | What It Shows |
|------|---------------|
| Meri Repairs | List of all your repair jobs with status |
| Meri Payments | Payment history -- what you have paid |
| Meri Ledger | Running balance -- what you owe |

### How Clients Get Access

1. Admin creates a client account with **Login Allowed** enabled
2. Client receives their login credentials
3. Client logs in through the **Client** tab on the login page
4. They see only their own data -- no access to other clients or shop features

---

## 9. Public Pages

These pages are visible to **everyone** -- no login required.

| Page | URL | What It Does |
|------|-----|--------------|
| Home | `/` | Marketing page with services and contact info |
| About | `/about` | Business information and testimonials |
| Contact | `/contact` | Inquiry form -- potential clients can send messages |
| Job Status | `/job-status` | Anyone can check repair status by entering Job ID |
| Stage Lighting | `/stage-lighting` | Stage lighting repair services showcase |
| Industrial | `/industrial` | Industrial electronics repair services |
| Power Supply | `/power-supply` | Power supply repair services |

### Job Status Checker

**URL:** `/job-status`

**How it works:**
1. Enter your **Job ID** (e.g., "28102")
2. See the **current status** of your repair
3. View **amount** and **estimated completion**
4. Click **WhatsApp** to message the shop directly

---

## 10. Tips and Shortcuts

### Keyboard Shortcuts

| Shortcut | What It Does |
|----------|--------------|
| Ctrl + K | Open universal search |
| Escape | Close search or modal |

### Universal Search (Ctrl + K)

- Searches across **Clients, Jobs, Products, Staff, and Sales** simultaneously
- Type any name, job ID, or product name
- Click a result to jump directly to that page

### WhatsApp Integration

WhatsApp buttons are available on:
- Job detail pages (send status updates)
- Client profiles (send payment reminders)
- Due Reminders report (bulk send reminders)
- Pending Jobs report (notify clients)
- Jobs list (bulk send for selected jobs)

### Printing

Almost every list page has a **Print** button. This generates a **printer-friendly** version of the data. Use it for:
- Invoices
- Salary slips
- Ledger statements
- Reports

### Best Practices

| Practice | Why |
|----------|-----|
| Create jobs immediately | Never lose track of a repair |
| Update status regularly | Clients see status in real-time |
| Record every payment | Keep accounts accurate |
| Stock in parts on arrival | Always know what you have |
| Backup weekly | Protect against data loss |
| Check dashboard daily | Stay on top of your business |

### Daily Workflow

```
Morning:
  1. Check Dashboard for alerts
  2. Staff marks Attendance
  3. Review Pending Jobs

During Day:
  4. Create new Jobs as repairs come in
  5. Update job status as work progresses
  6. Record Sales for walk-in purchases
  7. Stock in new parts as they arrive

End of Day:
  8. Record any Payments received
  9. Check Due Reminders
  10. Review tomorrow's pending work
```

---

> **V-TECH PRO v4.2** -- Built for electronics repair shops.
> For support, contact your system administrator.
