<?php
// business_reports_with_filters.php

// Start session only if not already started
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

// Database connection
$host = '127.0.0.1';
$dbname = 'vikram_db';
$username = 'root';
$password = '';

try {
    $conn = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    die("Connection failed: " . $e->getMessage());
}

// Date Filter Handling
$current_year = date('Y');
$current_month = (int)date('m');
$current_month_name = date('F');
$current_date = date('Y-m-d');

// Get filter parameters
$filter_year = isset($_GET['year']) ? intval($_GET['year']) : $current_year;
$filter_month = isset($_GET['month']) ? intval($_GET['month']) : $current_month;
$filter_type = isset($_GET['filter_type']) ? $_GET['filter_type'] : 'monthly';
$start_date = isset($_GET['start_date']) ? $_GET['start_date'] : date('Y-m-01');
$end_date = isset($_GET['end_date']) ? $_GET['end_date'] : date('Y-m-t');

// Validate month and year
if ($filter_month < 1 || $filter_month > 12) $filter_month = $current_month;
if ($filter_year < 2020 || $filter_year > $current_year + 1) $filter_year = $current_year;

// Calculate date ranges
if ($filter_type == 'monthly') {
    $start_date = date("$filter_year-$filter_month-01");
    $end_date = date("$filter_year-$filter_month-t", strtotime($start_date));
} elseif ($filter_type == 'yearly') {
    $start_date = date("$filter_year-01-01");
    $end_date = date("$filter_year-12-31");
}

// Navigation Logic
if (isset($_GET['nav']) && $_GET['nav'] == 'prev') {
    if ($filter_type == 'monthly') {
        $filter_month--;
        if ($filter_month < 1) { $filter_month = 12; $filter_year--; }
    } elseif ($filter_type == 'yearly') {
        $filter_year--;
    }
    echo "<script>window.location = '?page=reports/balancesheet&year=$filter_year&month=$filter_month&filter_type=$filter_type';</script>";
    exit();
}

if (isset($_GET['nav']) && $_GET['nav'] == 'next') {
    if ($filter_type == 'monthly') {
        $filter_month++;
        if ($filter_month > 12) { $filter_month = 1; $filter_year++; }
    } elseif ($filter_type == 'yearly') {
        $filter_year++;
    }
    echo "<script>window.location = '?page=reports/balancesheet&year=$filter_year&month=$filter_month&filter_type=$filter_type';</script>";
    exit();
}

if (isset($_GET['reset'])) {
    echo "<script>window.location = '?page=reports/balancesheet';</script>";
    exit();
}

function executeQuery($conn, $sql) {
    try {
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch(PDOException $e) {
        error_log("Query Error: " . $e->getMessage());
        return [];
    }
}

$reports = [];

// 1. Customer Business Ledger (Updated with DISCOUNT Logic)
// Opening Balance Logic: (Manual Opening + Old Repair) - (Old Payments + Old Discounts)
$checkColumnSQL = "SHOW COLUMNS FROM client_list LIKE 'opening_balance'";
$columnExists = executeQuery($conn, $checkColumnSQL);

if (!empty($columnExists)) {
    $customerLedgerSQL = "
        SELECT 
            c.id as 'client_id',
            CONCAT(c.firstname, ' ', COALESCE(c.middlename, ''), ' ', c.lastname) as 'customer_name',
            c.contact as 'contact',
            
            -- CORRECTED OPENING BALANCE (Subtracting Amount + Discount)
            (
                COALESCE(c.opening_balance, 0) 
                + COALESCE((SELECT SUM(t.amount) 
                           FROM transaction_list t 
                           WHERE t.client_name = c.id 
                           AND t.status IN (3,5)
                           AND t.date_created < '$start_date'), 0)
                - COALESCE((SELECT SUM(p.amount + COALESCE(p.discount, 0)) 
                           FROM client_payments p 
                           WHERE p.client_id = c.id
                           AND p.payment_date < '$start_date'), 0)
            ) as 'opening_balance',
            
            -- Repair amount in selected period
            COALESCE((SELECT SUM(t.amount) 
             FROM transaction_list t 
             WHERE t.client_name = c.id AND t.status IN (3,5)
             AND t.date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'total_repair_amount',
            
            -- Payment received in selected period (CASH ONLY)
            COALESCE((SELECT SUM(p.amount) 
             FROM client_payments p 
             WHERE p.client_id = c.id
             AND p.payment_date BETWEEN '$start_date' AND '$end_date'), 0) as 'total_payment',

            -- Discount given in selected period
            COALESCE((SELECT SUM(COALESCE(p.discount, 0)) 
             FROM client_payments p 
             WHERE p.client_id = c.id
             AND p.payment_date BETWEEN '$start_date' AND '$end_date'), 0) as 'total_discount',
            
            -- Current Balance Calculation
            (
                (
                    COALESCE(c.opening_balance, 0) 
                    + COALESCE((SELECT SUM(t.amount) FROM transaction_list t WHERE t.client_name = c.id AND t.status IN (3,5) AND t.date_created < '$start_date'), 0)
                    - COALESCE((SELECT SUM(p.amount + COALESCE(p.discount, 0)) FROM client_payments p WHERE p.client_id = c.id AND p.payment_date < '$start_date'), 0)
                )
                + 
                COALESCE((SELECT SUM(t.amount) FROM transaction_list t WHERE t.client_name = c.id AND t.status IN (3,5) AND t.date_created BETWEEN '$start_date' AND '$end_date'), 0)
                - 
                COALESCE((SELECT SUM(p.amount + COALESCE(p.discount, 0)) FROM client_payments p WHERE p.client_id = c.id AND p.payment_date BETWEEN '$start_date' AND '$end_date'), 0)
            ) as 'current_balance',
            
            COALESCE((SELECT COUNT(*) FROM transaction_list t WHERE t.client_name = c.id AND t.status IN (3,5) AND t.date_created < '$start_date'), 0) as 'previous_transactions'
            
        FROM client_list c
        WHERE c.delete_flag = 0
        HAVING (total_repair_amount > 0 OR total_payment > 0 OR total_discount > 0 OR ABS(current_balance) > 0)
        ORDER BY total_repair_amount DESC
    ";
} else {
    // Fallback if opening_balance column is missing (Subtracting Amount + Discount)
    $customerLedgerSQL = "
        SELECT 
            c.id as 'client_id',
            CONCAT(c.firstname, ' ', COALESCE(c.middlename, ''), ' ', c.lastname) as 'customer_name',
            c.contact as 'contact',
            (
                COALESCE((SELECT SUM(t.amount) FROM transaction_list t WHERE t.client_name = c.id AND t.status IN (3,5) AND t.date_created < '$start_date'), 0)
                - COALESCE((SELECT SUM(p.amount + COALESCE(p.discount, 0)) FROM client_payments p WHERE p.client_id = c.id AND p.payment_date < '$start_date'), 0)
            ) as 'opening_balance',
            COALESCE((SELECT SUM(t.amount) FROM transaction_list t WHERE t.client_name = c.id AND t.status IN (3,5) AND t.date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'total_repair_amount',
            COALESCE((SELECT SUM(p.amount) FROM client_payments p WHERE p.client_id = c.id AND p.payment_date BETWEEN '$start_date' AND '$end_date'), 0) as 'total_payment',
            COALESCE((SELECT SUM(COALESCE(p.discount, 0)) FROM client_payments p WHERE p.client_id = c.id AND p.payment_date BETWEEN '$start_date' AND '$end_date'), 0) as 'total_discount',
            (
                (
                    COALESCE((SELECT SUM(t.amount) FROM transaction_list t WHERE t.client_name = c.id AND t.status IN (3,5) AND t.date_created < '$start_date'), 0)
                    - COALESCE((SELECT SUM(p.amount + COALESCE(p.discount, 0)) FROM client_payments p WHERE p.client_id = c.id AND p.payment_date < '$start_date'), 0)
                )
                + 
                COALESCE((SELECT SUM(t.amount) FROM transaction_list t WHERE t.client_name = c.id AND t.status IN (3,5) AND t.date_created BETWEEN '$start_date' AND '$end_date'), 0)
                - 
                COALESCE((SELECT SUM(p.amount + COALESCE(p.discount, 0)) FROM client_payments p WHERE p.client_id = c.id AND p.payment_date BETWEEN '$start_date' AND '$end_date'), 0)
            ) as 'current_balance',
            COALESCE((SELECT COUNT(*) FROM transaction_list t WHERE t.client_name = c.id AND t.status IN (3,5) AND t.date_created < '$start_date'), 0) as 'previous_transactions'
        FROM client_list c
        WHERE c.delete_flag = 0
        HAVING (total_repair_amount > 0 OR total_payment > 0 OR total_discount > 0 OR ABS(current_balance) > 0)
        ORDER BY total_repair_amount DESC
    ";
}
$reports['customer_ledger'] = executeQuery($conn, $customerLedgerSQL);

// 2. Technician Ledger (No change needed)
$mechanicLedgerSQL = "
    SELECT 
        m.id as 'mechanic_id',
        CONCAT(m.firstname, ' ', COALESCE(m.middlename, ''), ' ', m.lastname) as 'mechanic_name',
        m.daily_salary as 'daily_salary',
        COALESCE((SELECT SUM(a.amount) FROM advance_payments a WHERE a.mechanic_id = m.id AND a.date_paid <= '$end_date'), 0) as 'total_advance_amount',
        COALESCE((SELECT SUM(a.amount) FROM advance_payments a WHERE a.mechanic_id = m.id AND a.date_paid BETWEEN '$start_date' AND '$end_date'), 0) as 'advance_in_period',
        COALESCE((SELECT COUNT(DISTINCT al.curr_date) FROM attendance_list al WHERE al.mechanic_id = m.id AND al.status IN (1,3) AND al.curr_date <= '$end_date'), 0) as 'total_attendance_days',
        COALESCE((SELECT COUNT(DISTINCT al.curr_date) FROM attendance_list al WHERE al.mechanic_id = m.id AND al.status IN (1,3) AND al.curr_date BETWEEN '$start_date' AND '$end_date'), 0) as 'attendance_in_period',
        (COALESCE((SELECT COUNT(DISTINCT al.curr_date) FROM attendance_list al WHERE al.mechanic_id = m.id AND al.status IN (1,3) AND al.curr_date <= '$end_date'), 0) * m.daily_salary) as 'total_salary_due',
        ((COALESCE((SELECT COUNT(DISTINCT al.curr_date) FROM attendance_list al WHERE al.mechanic_id = m.id AND al.status IN (1,3) AND al.curr_date <= '$end_date'), 0) * m.daily_salary) 
         - COALESCE((SELECT SUM(a.amount) FROM advance_payments a WHERE a.mechanic_id = m.id AND a.date_paid <= '$end_date'), 0)) as 'balance_amount'
    FROM mechanic_list m
    WHERE m.delete_flag = 0
    HAVING (balance_amount != 0 OR attendance_in_period > 0)
";
$reports['mechanic_ledger'] = executeQuery($conn, $mechanicLedgerSQL);

// 3. Stock Inventory (No change needed)
$stockInventorySQL = "
    SELECT 
        p.id as 'product_id',
        p.name as 'product_name',
        p.price as 'sale_price',
        COALESCE(SUM(i.quantity), 0) as 'total_stock',
        COALESCE((SELECT SUM(dsi.qty) FROM direct_sale_items dsi JOIN direct_sales ds ON ds.id = dsi.sale_id WHERE dsi.product_id = p.id AND ds.date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'sold_quantity',
        (COALESCE(SUM(i.quantity), 0) - COALESCE((SELECT SUM(dsi.qty) FROM direct_sale_items dsi JOIN direct_sales ds ON ds.id = dsi.sale_id WHERE dsi.product_id = p.id AND ds.date_created BETWEEN '$start_date' AND '$end_date'), 0)) as 'remaining_stock',
        (COALESCE(SUM(i.quantity), 0) * p.price) as 'stock_value'
    FROM product_list p
    LEFT JOIN inventory_list i ON i.product_id = p.id
    WHERE p.delete_flag = 0
    GROUP BY p.id, p.name, p.price
    HAVING (sold_quantity > 0 OR total_stock > 0)
    ORDER BY sold_quantity DESC
";
$reports['stock_inventory'] = executeQuery($conn, $stockInventorySQL);

// 4. Income Summary
$incomeSQL = "
    SELECT 'रिपेयर आय' as 'description', COALESCE((SELECT SUM(amount) FROM transaction_list WHERE status IN (3,5) AND date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'amount'
    UNION ALL
    SELECT 'सीधी बिक्री' as 'description', COALESCE((SELECT SUM(total_amount) FROM direct_sales WHERE date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'amount'
";
$reports['income_summary'] = executeQuery($conn, $incomeSQL);

// 5. Expense Summary
$expenseSQL = "SELECT category as 'expense_category', COALESCE(SUM(amount), 0) as 'amount' FROM expense_list WHERE date_created BETWEEN '$start_date' AND '$end_date' GROUP BY category ORDER BY COALESCE(SUM(amount), 0) DESC";
$reports['expense_summary'] = executeQuery($conn, $expenseSQL);

// 6. Monthly Transaction Summary (Updated Expense Logic)
$monthlySummarySQL = "
    SELECT 
        DATE_FORMAT(t.date_created, '%Y-%m') as 'month',
        COUNT(t.id) as 'total_jobs',
        COALESCE(SUM(CASE WHEN t.status IN (3,5) THEN t.amount ELSE 0 END), 0) as 'repair_income',
        COUNT(DISTINCT t.client_name) as 'total_customers',
        COALESCE((SELECT SUM(e.amount) FROM expense_list e WHERE DATE_FORMAT(e.date_created, '%Y-%m') = DATE_FORMAT(t.date_created, '%Y-%m')), 0) as 'total_expenses'
    FROM transaction_list t
    WHERE t.date_created BETWEEN '$start_date' AND '$end_date'
    GROUP BY DATE_FORMAT(t.date_created, '%Y-%m')
    ORDER BY DATE_FORMAT(t.date_created, '%Y-%m') DESC
";
$reports['monthly_summary'] = executeQuery($conn, $monthlySummarySQL);

// 7. Top Customers (Updated with DISCOUNT Logic for Balance)
if (!empty($columnExists)) {
    $topCustomersSQL = "
        SELECT 
            c.id as 'client_id',
            CONCAT(c.firstname, ' ', COALESCE(c.middlename, ''), ' ', c.lastname) as 'customer_name',
            c.contact as 'contact',
            -- Balance logic corrected: Deduct (Amount + Discount)
            (
                (COALESCE(c.opening_balance, 0) 
                + COALESCE((SELECT SUM(t.amount) FROM transaction_list t WHERE t.client_name = c.id AND t.status IN (3,5) AND t.date_created < '$start_date'), 0)
                - COALESCE((SELECT SUM(p.amount + COALESCE(p.discount, 0)) FROM client_payments p WHERE p.client_id = c.id AND p.payment_date < '$start_date'), 0))
                + 
                COALESCE((SELECT SUM(t.amount) FROM transaction_list t WHERE t.client_name = c.id AND t.status IN (3,5) AND t.date_created BETWEEN '$start_date' AND '$end_date'), 0)
                - 
                COALESCE((SELECT SUM(p.amount + COALESCE(p.discount, 0)) FROM client_payments p WHERE p.client_id = c.id AND p.payment_date BETWEEN '$start_date' AND '$end_date'), 0)
            ) as 'current_balance',
            
            COALESCE((SELECT SUM(t.amount) FROM transaction_list t WHERE t.client_name = c.id AND t.status IN (3,5) AND t.date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'total_amount',
            COALESCE((SELECT SUM(p.amount) FROM client_payments p WHERE p.client_id = c.id AND p.payment_date BETWEEN '$start_date' AND '$end_date'), 0) as 'total_payment_amount',
            COALESCE((SELECT SUM(COALESCE(p.discount, 0)) FROM client_payments p WHERE p.client_id = c.id AND p.payment_date BETWEEN '$start_date' AND '$end_date'), 0) as 'total_discount',
            COALESCE((SELECT COUNT(*) FROM transaction_list t WHERE t.client_name = c.id AND t.status IN (3,5) AND t.date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'total_jobs'
        FROM client_list c
        WHERE c.delete_flag = 0
        HAVING total_amount > 0 OR ABS(current_balance) > 0
        ORDER BY total_amount DESC
        LIMIT 10
    ";
} else {
    $topCustomersSQL = "
        SELECT 
            c.id as 'client_id',
            CONCAT(c.firstname, ' ', COALESCE(c.middlename, ''), ' ', c.lastname) as 'customer_name',
            c.contact as 'contact',
            (
                (COALESCE((SELECT SUM(t.amount) FROM transaction_list t WHERE t.client_name = c.id AND t.status IN (3,5) AND t.date_created < '$start_date'), 0)
                - COALESCE((SELECT SUM(p.amount + COALESCE(p.discount, 0)) FROM client_payments p WHERE p.client_id = c.id AND p.payment_date < '$start_date'), 0))
                + 
                COALESCE((SELECT SUM(t.amount) FROM transaction_list t WHERE t.client_name = c.id AND t.status IN (3,5) AND t.date_created BETWEEN '$start_date' AND '$end_date'), 0)
                - 
                COALESCE((SELECT SUM(p.amount + COALESCE(p.discount, 0)) FROM client_payments p WHERE p.client_id = c.id AND p.payment_date BETWEEN '$start_date' AND '$end_date'), 0)
            ) as 'current_balance',
            COALESCE((SELECT SUM(t.amount) FROM transaction_list t WHERE t.client_name = c.id AND t.status IN (3,5) AND t.date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'total_amount',
            COALESCE((SELECT SUM(p.amount) FROM client_payments p WHERE p.client_id = c.id AND p.payment_date BETWEEN '$start_date' AND '$end_date'), 0) as 'total_payment_amount',
            COALESCE((SELECT SUM(COALESCE(p.discount, 0)) FROM client_payments p WHERE p.client_id = c.id AND p.payment_date BETWEEN '$start_date' AND '$end_date'), 0) as 'total_discount',
            COALESCE((SELECT COUNT(*) FROM transaction_list t WHERE t.client_name = c.id AND t.status IN (3,5) AND t.date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'total_jobs'
        FROM client_list c
        WHERE c.delete_flag = 0
        HAVING total_amount > 0 OR ABS(current_balance) > 0
        ORDER BY total_amount DESC
        LIMIT 10
    ";
}
$reports['top_customers'] = executeQuery($conn, $topCustomersSQL);

// 8. Loan Ledger
$loanLedgerSQL = "
    SELECT 
        l.id as 'loan_id',
        l.fullname as 'lender_name',
        l.contact as 'contact',
        l.loan_amount as 'loan_amount',
        l.interest_rate as 'interest_rate',
        l.emi_amount as 'emi_amount',
        l.start_date as 'start_date',
        CASE l.status WHEN 1 THEN 'सक्रिय' WHEN 2 THEN 'पूर्ण' ELSE 'अन्य' END as 'status',
        COALESCE((SELECT SUM(lp.amount_paid) FROM loan_payments lp WHERE lp.lender_id = l.id AND lp.payment_date <= '$end_date'), 0) as 'total_paid',
        COALESCE((SELECT SUM(lp.amount_paid) FROM loan_payments lp WHERE lp.lender_id = l.id AND lp.payment_date BETWEEN '$start_date' AND '$end_date'), 0) as 'paid_in_period',
        (l.loan_amount - COALESCE((SELECT SUM(lp.amount_paid) FROM loan_payments lp WHERE lp.lender_id = l.id AND lp.payment_date <= '$end_date'), 0)) as 'balance_amount',
        COALESCE((SELECT SUM(lp.amount_paid) FROM loan_payments lp WHERE lp.lender_id = l.id AND lp.payment_date < '$start_date'), 0) as 'previous_payments',
        CASE WHEN l.emi_amount > 0 THEN CEIL((l.loan_amount - COALESCE((SELECT SUM(lp.amount_paid) FROM loan_payments lp WHERE lp.lender_id = l.id), 0)) / l.emi_amount) ELSE 0 END as 'remaining_emis'
    FROM lender_list l
    WHERE l.start_date <= '$end_date'
    GROUP BY l.id
    HAVING (total_paid > 0 OR balance_amount > 0)
";
$reports['loan_ledger'] = executeQuery($conn, $loanLedgerSQL);

// 9. Business Health Dashboard (Adding Discount Stat)
$businessHealthSQL = "
    SELECT 
        COALESCE((SELECT COUNT(DISTINCT t.client_name) FROM transaction_list t WHERE t.date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'active_customers',
        COALESCE((SELECT COUNT(*) FROM transaction_list WHERE status IN (3,5) AND date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'completed_jobs',
        COALESCE((SELECT COUNT(*) FROM transaction_list WHERE status = 0 AND date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'pending_jobs',
        COALESCE((SELECT SUM(amount) FROM transaction_list WHERE status IN (3,5) AND date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'total_income',
        COALESCE((SELECT SUM(amount) FROM expense_list WHERE date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'total_expenses',
        COALESCE((SELECT SUM(amount) FROM client_payments WHERE payment_date BETWEEN '$start_date' AND '$end_date'), 0) as 'total_payments_received',
        COALESCE((SELECT SUM(COALESCE(discount, 0)) FROM client_payments WHERE payment_date BETWEEN '$start_date' AND '$end_date'), 0) as 'total_discounts_given',
        COALESCE((SELECT COUNT(*) FROM product_list WHERE delete_flag = 0), 0) as 'total_products',
        COALESCE((SELECT COUNT(*) FROM transaction_list WHERE date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'total_all_jobs',
        COALESCE((SELECT SUM(total_amount) FROM direct_sales WHERE date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'direct_sales'
    FROM dual
";
$reports['business_health'] = executeQuery($conn, $businessHealthSQL);

// Totals Calculation
$businessHealth = !empty($reports['business_health']) ? $reports['business_health'][0] : [];
$net_income = ($businessHealth['total_income'] ?? 0) - ($businessHealth['total_expenses'] ?? 0);

// Total Pending Amount (Corrected with Discount)
if (!empty($columnExists)) {
    $pendingAmountSQL = "SELECT COALESCE(SUM(COALESCE(c.opening_balance, 0) + COALESCE((SELECT SUM(t.amount) FROM transaction_list t WHERE t.client_name = c.id AND t.status IN (3,5) AND t.date_created <= '$end_date'), 0) - COALESCE((SELECT SUM(p.amount + COALESCE(p.discount, 0)) FROM client_payments p WHERE p.client_id = c.id AND p.payment_date <= '$end_date'), 0)), 0) as total_pending FROM client_list c WHERE c.delete_flag = 0";
} else {
    $pendingAmountSQL = "SELECT COALESCE(SUM(COALESCE((SELECT SUM(t.amount) FROM transaction_list t WHERE t.client_name = c.id AND t.status IN (3,5) AND t.date_created <= '$end_date'), 0) - COALESCE((SELECT SUM(p.amount + COALESCE(p.discount, 0)) FROM client_payments p WHERE p.client_id = c.id AND p.payment_date <= '$end_date'), 0)), 0) as total_pending FROM client_list c WHERE c.delete_flag = 0";
}
$pendingAmountResult = executeQuery($conn, $pendingAmountSQL);
$total_pending_amount = $pendingAmountResult[0]['total_pending'] ?? 0;

// Total Opening Balance (Corrected with Discount)
if (!empty($columnExists)) {
    $totalOpeningBalanceSQL = "SELECT COALESCE(SUM(COALESCE(c.opening_balance, 0) + COALESCE((SELECT SUM(t.amount) FROM transaction_list t WHERE t.client_name = c.id AND t.status IN (3,5) AND t.date_created < '$start_date'), 0) - COALESCE((SELECT SUM(p.amount + COALESCE(p.discount, 0)) FROM client_payments p WHERE p.client_id = c.id AND p.payment_date < '$start_date'), 0)), 0) as total_opening_balance FROM client_list c WHERE c.delete_flag = 0";
} else {
    $totalOpeningBalanceSQL = "SELECT COALESCE(SUM(COALESCE((SELECT SUM(t.amount) FROM transaction_list t WHERE t.client_name = c.id AND t.status IN (3,5) AND t.date_created < '$start_date'), 0) - COALESCE((SELECT SUM(p.amount + COALESCE(p.discount, 0)) FROM client_payments p WHERE p.client_id = c.id AND p.payment_date < '$start_date'), 0)), 0) as total_opening_balance FROM client_list c WHERE c.delete_flag = 0";
}
$totalOpeningBalanceResult = executeQuery($conn, $totalOpeningBalanceSQL);
$total_opening_balance = $totalOpeningBalanceResult[0]['total_opening_balance'] ?? 0;

// Mechanic Advance/Salary
$totalAdvanceResult = executeQuery($conn, "SELECT COALESCE(SUM(amount), 0) as total FROM advance_payments WHERE date_paid <= '$end_date'");
$total_advance_given = $totalAdvanceResult[0]['total'] ?? 0;

$totalSalarySQL = "SELECT COALESCE(SUM((COALESCE((SELECT COUNT(DISTINCT al.curr_date) FROM attendance_list al WHERE al.mechanic_id = m.id AND al.status IN (1,3) AND al.curr_date <= '$end_date'), 0) * m.daily_salary)), 0) as total_salary_payable FROM mechanic_list m WHERE m.delete_flag = 0";
$totalSalaryResult = executeQuery($conn, $totalSalarySQL);
$total_salary_payable = $totalSalaryResult[0]['total_salary_payable'] ?? 0;

$month_names = [1 => 'जनवरी', 2 => 'फरवरी', 3 => 'मार्च', 4 => 'अप्रैल', 5 => 'मई', 6 => 'जून', 7 => 'जुलाई', 8 => 'अगस्त', 9 => 'सितंबर', 10 => 'अक्टूबर', 11 => 'नवंबर', 12 => 'दिसंबर'];
$filter_month_int = (int)$filter_month;
?>

<!DOCTYPE html>
<html lang="hi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>व्यापार रिपोर्ट्स (Updated)</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.8.1/font/bootstrap-icons.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">
    <style>
        body { background-color: #f8f9fa; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        .navbar { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .report-card { border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .health-card { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; }
        .income-card { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; }
        .warning-card { background: linear-gradient(135deg, #ffc3a0 0%, #ffafbd 100%); color: white; } /* Light Red for Discount */
        .section-title { border-left: 4px solid #667eea; padding-left: 15px; margin: 25px 0 15px 0; color: #333; }
        .positive { color: #28a745; font-weight: bold; }
        .negative { color: #dc3545; font-weight: bold; }
        .discount-text { color: #d63384; font-weight: bold; }
        .sticky-header { position: sticky; top: 0; background: white; z-index: 100; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stat-number { font-size: 1.8rem; font-weight: bold; }
        .stat-label { font-size: 0.85rem; opacity: 0.9; }
        .date-range-display { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 10px 15px; border-radius: 8px; margin-bottom: 15px; }
        .table-container { max-height: 500px; overflow-y: auto; }
    </style>
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark">
        <div class="container">
            <a class="navbar-brand" href="#"><i class="bi bi-graph-up"></i> V-Tech रिपोर्ट्स (Discount Fixed)</a>
        </div>
    </nav>

    <div class="container mt-4">
        <div class="date-range-display">
            <h5>
                <i class="bi bi-calendar-range"></i> 
                <?php echo ($filter_type == 'monthly') ? (isset($month_names[$filter_month_int]) ? $month_names[$filter_month_int] : $filter_month) . " $filter_year" : "वर्ष $filter_year"; ?>
            </h5>
            <small>Data Range: <?php echo date('d/m/Y', strtotime($start_date)); ?> to <?php echo date('d/m/Y', strtotime($end_date)); ?></small>
        </div>
        
        <div class="card p-3 mb-4 shadow-sm">
            <form method="GET" action="" class="row g-3">
                <input type="hidden" name="page" value="reports/balancesheet">
                <div class="col-md-3">
                    <label>फिल्टर प्रकार</label>
                    <select class="form-select" name="filter_type" onchange="this.form.submit()">
                        <option value="monthly" <?php echo $filter_type == 'monthly' ? 'selected' : ''; ?>>मासिक</option>
                        <option value="yearly" <?php echo $filter_type == 'yearly' ? 'selected' : ''; ?>>वार्षिक</option>
                    </select>
                </div>
                <?php if ($filter_type == 'monthly'): ?>
                <div class="col-md-3">
                    <label>महीना</label>
                    <select class="form-select" name="month">
                        <?php foreach ($month_names as $num => $name): ?>
                            <option value="<?php echo $num; ?>" <?php echo $filter_month_int == $num ? 'selected' : ''; ?>><?php echo $name; ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <?php endif; ?>
                <div class="col-md-3">
                    <label>वर्ष</label>
                    <select class="form-select" name="year">
                        <?php for ($y = 2020; $y <= $current_year + 1; $y++): ?>
                            <option value="<?php echo $y; ?>" <?php echo $filter_year == $y ? 'selected' : ''; ?>><?php echo $y; ?></option>
                        <?php endfor; ?>
                    </select>
                </div>
                <div class="col-md-3 d-flex align-items-end">
                    <button type="submit" class="btn btn-primary w-100"><i class="bi bi-filter"></i> देखे</button>
                </div>
            </form>
        </div>

        <div class="row">
            <div class="col-md-3 mb-3">
                <div class="card report-card income-card">
                    <div class="card-body text-center">
                        <h5 class="card-title">कुल आय (Gross)</h5>
                        <div class="stat-number">₹<?php echo number_format($businessHealth['total_income'], 2); ?></div>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card report-card bg-success text-white">
                    <div class="card-body text-center">
                        <h5 class="card-title">नकद प्राप्त (Cash)</h5>
                        <div class="stat-number">₹<?php echo number_format($businessHealth['total_payments_received'], 2); ?></div>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card report-card warning-card"> <div class="card-body text-center">
                        <h5 class="card-title">कुल डिस्काउंट दिया</h5>
                        <div class="stat-number">₹<?php echo number_format($businessHealth['total_discounts_given'], 2); ?></div>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card report-card bg-danger text-white">
                    <div class="card-body text-center">
                        <h5 class="card-title">कुल लंबित (Pending)</h5>
                        <div class="stat-number">₹<?php echo number_format($total_pending_amount, 2); ?></div>
                        <small>बैलेंस कैरी फॉरवर्ड सहित</small>
                    </div>
                </div>
            </div>
        </div>

        <h4 class="section-title"><i class="bi bi-person-lines-fill"></i> ग्राहक खाता बही (Customer Ledger)</h4>
        <div class="card report-card">
            <div class="card-body">
                <div class="table-container">
                    <table class="table table-hover table-bordered table-sm">
                        <thead class="sticky-header table-dark">
                            <tr>
                                <th>ग्राहक नाम</th>
                                <th class="text-end">शुरुआती बैलेंस</th>
                                <th class="text-end">रिपेयर राशि</th>
                                <th class="text-end">नकद जमा</th>
                                <th class="text-end text-warning">डिस्काउंट</th>
                                <th class="text-end">वर्तमान शेष</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php 
                            $tot_opening = 0; $tot_repair = 0; $tot_pay = 0; $tot_disc = 0; $tot_bal = 0;
                            foreach($reports['customer_ledger'] as $row): 
                                $tot_opening += $row['opening_balance'];
                                $tot_repair += $row['total_repair_amount'];
                                $tot_pay += $row['total_payment'];
                                $tot_disc += $row['total_discount'];
                                $tot_bal += $row['current_balance'];
                            ?>
                            <tr>
                                <td><?php echo $row['customer_name']; ?></td>
                                <td class="text-end <?php echo $row['opening_balance'] > 0 ? 'text-danger' : 'text-success'; ?>">
                                    ₹<?php echo number_format($row['opening_balance'], 2); ?>
                                </td>
                                <td class="text-end">₹<?php echo number_format($row['total_repair_amount'], 2); ?></td>
                                <td class="text-end text-success">₹<?php echo number_format($row['total_payment'], 2); ?></td>
                                <td class="text-end discount-text">₹<?php echo number_format($row['total_discount'], 2); ?></td>
                                <td class="text-end <?php echo $row['current_balance'] > 0 ? 'text-danger' : 'text-success'; ?>">
                                    <strong>₹<?php echo number_format($row['current_balance'], 2); ?></strong>
                                </td>
                            </tr>
                            <?php endforeach; ?>
                            <tr class="table-secondary fw-bold">
                                <td>कुल योग</td>
                                <td class="text-end">₹<?php echo number_format($tot_opening, 2); ?></td>
                                <td class="text-end">₹<?php echo number_format($tot_repair, 2); ?></td>
                                <td class="text-end text-success">₹<?php echo number_format($tot_pay, 2); ?></td>
                                <td class="text-end discount-text">₹<?php echo number_format($tot_disc, 2); ?></td>
                                <td class="text-end">₹<?php echo number_format($tot_bal, 2); ?></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="text-center mt-4 mb-5">
            <button onclick="window.print()" class="btn btn-dark"><i class="bi bi-printer"></i> प्रिंट रिपोर्ट</button>
        </div>
    </div>
</body>
</html>