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
$current_month = (int)date('m');  // Convert to integer
$current_month_name = date('F');
$current_date = date('Y-m-d');

// Get filter parameters
$filter_year = isset($_GET['year']) ? intval($_GET['year']) : $current_year;
$filter_month = isset($_GET['month']) ? intval($_GET['month']) : $current_month;  // Force to integer
$filter_type = isset($_GET['filter_type']) ? $_GET['filter_type'] : 'monthly'; // monthly, yearly, custom
$start_date = isset($_GET['start_date']) ? $_GET['start_date'] : date('Y-m-01');
$end_date = isset($_GET['end_date']) ? $_GET['end_date'] : date('Y-m-t');

// Validate month and year
if ($filter_month < 1 || $filter_month > 12) $filter_month = $current_month;
if ($filter_year < 2020 || $filter_year > $current_year + 1) $filter_year = $current_year;

// Calculate date ranges based on filter type
if ($filter_type == 'monthly') {
    $start_date = date("$filter_year-$filter_month-01");
    $end_date = date("$filter_year-$filter_month-t", strtotime($start_date));
} elseif ($filter_type == 'yearly') {
    $start_date = date("$filter_year-01-01");
    $end_date = date("$filter_year-12-31");
}

// Previous and next month navigation
if (isset($_GET['nav']) && $_GET['nav'] == 'prev') {
    if ($filter_type == 'monthly') {
        $filter_month--;
        if ($filter_month < 1) {
            $filter_month = 12;
            $filter_year--;
        }
    } elseif ($filter_type == 'yearly') {
        $filter_year--;
    }
    // Redirect with page parameter
   echo "<script>window.location = '?page=reports/balancesheet&year=$filter_year&month=$filter_month&filter_type=$filter_type';</script>";
    exit();
}

if (isset($_GET['nav']) && $_GET['nav'] == 'next') {
    if ($filter_type == 'monthly') {
        $filter_month++;
        if ($filter_month > 12) {
            $filter_month = 1;
            $filter_year++;
        }
    } elseif ($filter_type == 'yearly') {
        $filter_year++;
    }
    // Redirect with page parameter
    echo "<script>window.location = '?page=reports/balancesheet&year=$filter_year&month=$filter_month&filter_type=$filter_type';</script>";
    exit();
}

// Reset filter
if (isset($_GET['reset'])) {
    echo "<script>window.location = '?page=reports/balancesheet';</script>";
    exit();
}

// Function to execute query and fetch results
function executeQuery($conn, $sql) {
    try {
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch(PDOException $e) {
        // Log error but continue
        error_log("Query Error: " . $e->getMessage());
        return [];
    }
}

// Get all reports with date filters
$reports = [];

// 1. Customer Business Ledger - With Date Filter and Opening Balance Carry Forward
// First check if opening_balance column exists
$checkColumnSQL = "SHOW COLUMNS FROM client_list LIKE 'opening_balance'";
$columnExists = executeQuery($conn, $checkColumnSQL);

if (!empty($columnExists)) {
    // Column exists - use the original query
    $customerLedgerSQL = "
        SELECT 
            c.id as 'client_id',
            CONCAT(c.firstname, ' ', COALESCE(c.middlename, ''), ' ', c.lastname) as 'customer_name',
            c.contact as 'contact',
            -- Opening Balance (carry forward from before start_date)
            (
                COALESCE(c.opening_balance, 0) 
                + COALESCE((SELECT SUM(t.amount) 
                           FROM transaction_list t 
                           WHERE t.client_name = c.id 
                           AND t.status IN (3,5)
                           AND t.date_created < '$start_date'), 0)
                - COALESCE((SELECT SUM(p.amount) 
                           FROM client_payments p 
                           WHERE p.client_id = c.id
                           AND p.payment_date < '$start_date'), 0)
            ) as 'opening_balance',
            
            -- Repair amount in selected period
            COALESCE((SELECT SUM(t.amount) 
             FROM transaction_list t 
             WHERE t.client_name = c.id AND t.status IN (3,5)
             AND t.date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'total_repair_amount',
            
            -- Payment received in selected period
            COALESCE((SELECT SUM(p.amount) 
             FROM client_payments p 
             WHERE p.client_id = c.id
             AND p.payment_date BETWEEN '$start_date' AND '$end_date'), 0) as 'total_payment',
            
            -- Current Balance (Opening + Current Period Transactions)
            (
                (
                    COALESCE(c.opening_balance, 0) 
                    + COALESCE((SELECT SUM(t.amount) 
                               FROM transaction_list t 
                               WHERE t.client_name = c.id 
                               AND t.status IN (3,5)
                               AND t.date_created < '$start_date'), 0)
                    - COALESCE((SELECT SUM(p.amount) 
                               FROM client_payments p 
                               WHERE p.client_id = c.id
                               AND p.payment_date < '$start_date'), 0)
                )
                + 
                COALESCE((SELECT SUM(t.amount) 
                 FROM transaction_list t 
                 WHERE t.client_name = c.id AND t.status IN (3,5)
                 AND t.date_created BETWEEN '$start_date' AND '$end_date'), 0)
                - 
                COALESCE((SELECT SUM(p.amount) 
                 FROM client_payments p 
                 WHERE p.client_id = c.id
                 AND p.payment_date BETWEEN '$start_date' AND '$end_date'), 0)
            ) as 'current_balance',
            
            -- Additional info: Total transactions before period (for reference)
            COALESCE((SELECT COUNT(*) 
                     FROM transaction_list t 
                     WHERE t.client_name = c.id 
                     AND t.status IN (3,5)
                     AND t.date_created < '$start_date'), 0) as 'previous_transactions',
            
            -- Additional info: Total payments before period (for reference)
            COALESCE((SELECT COUNT(*) 
                     FROM client_payments p 
                     WHERE p.client_id = c.id
                     AND p.payment_date < '$start_date'), 0) as 'previous_payments'
            
        FROM client_list c
        WHERE c.delete_flag = 0
        HAVING (total_repair_amount > 0 OR total_payment > 0 OR ABS(current_balance) > 0)
        ORDER BY total_repair_amount DESC
    ";
} else {
    // Column doesn't exist - use alternative query without opening_balance
    $customerLedgerSQL = "
        SELECT 
            c.id as 'client_id',
            CONCAT(c.firstname, ' ', COALESCE(c.middlename, ''), ' ', c.lastname) as 'customer_name',
            c.contact as 'contact',
            -- Opening Balance (from transactions before start_date only)
            (
                COALESCE((SELECT SUM(t.amount) 
                         FROM transaction_list t 
                         WHERE t.client_name = c.id 
                         AND t.status IN (3,5)
                         AND t.date_created < '$start_date'), 0)
                - COALESCE((SELECT SUM(p.amount) 
                           FROM client_payments p 
                           WHERE p.client_id = c.id
                           AND p.payment_date < '$start_date'), 0)
            ) as 'opening_balance',
            
            -- Repair amount in selected period
            COALESCE((SELECT SUM(t.amount) 
             FROM transaction_list t 
             WHERE t.client_name = c.id AND t.status IN (3,5)
             AND t.date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'total_repair_amount',
            
            -- Payment received in selected period
            COALESCE((SELECT SUM(p.amount) 
             FROM client_payments p 
             WHERE p.client_id = c.id
             AND p.payment_date BETWEEN '$start_date' AND '$end_date'), 0) as 'total_payment',
            
            -- Current Balance (Opening + Current Period Transactions)
            (
                (
                    COALESCE((SELECT SUM(t.amount) 
                             FROM transaction_list t 
                             WHERE t.client_name = c.id 
                             AND t.status IN (3,5)
                             AND t.date_created < '$start_date'), 0)
                    - COALESCE((SELECT SUM(p.amount) 
                               FROM client_payments p 
                               WHERE p.client_id = c.id
                               AND p.payment_date < '$start_date'), 0)
                )
                + 
                COALESCE((SELECT SUM(t.amount) 
                 FROM transaction_list t 
                 WHERE t.client_name = c.id AND t.status IN (3,5)
                 AND t.date_created BETWEEN '$start_date' AND '$end_date'), 0)
                - 
                COALESCE((SELECT SUM(p.amount) 
                 FROM client_payments p 
                 WHERE p.client_id = c.id
                 AND p.payment_date BETWEEN '$start_date' AND '$end_date'), 0)
            ) as 'current_balance',
            
            -- Additional info: Total transactions before period (for reference)
            COALESCE((SELECT COUNT(*) 
                     FROM transaction_list t 
                     WHERE t.client_name = c.id 
                     AND t.status IN (3,5)
                     AND t.date_created < '$start_date'), 0) as 'previous_transactions',
            
            -- Additional info: Total payments before period (for reference)
            COALESCE((SELECT COUNT(*) 
                     FROM client_payments p 
                     WHERE p.client_id = c.id
                     AND p.payment_date < '$start_date'), 0) as 'previous_payments'
            
        FROM client_list c
        WHERE c.delete_flag = 0
        HAVING (total_repair_amount > 0 OR total_payment > 0 OR ABS(current_balance) > 0)
        ORDER BY total_repair_amount DESC
    ";
}
$reports['customer_ledger'] = executeQuery($conn, $customerLedgerSQL);

// 2. Technician/Mechanic Ledger - With Date Filter and Carry Forward
$mechanicLedgerSQL = "
    SELECT 
        m.id as 'mechanic_id',
        CONCAT(m.firstname, ' ', COALESCE(m.middlename, ''), ' ', m.lastname) as 'mechanic_name',
        m.daily_salary as 'daily_salary',
        m.commission_percent as 'commission_percent',
        
        -- Total Advance (including before period)
        COALESCE((SELECT SUM(a.amount) FROM advance_payments a WHERE a.mechanic_id = m.id
         AND a.date_paid <= '$end_date'), 0) as 'total_advance_amount',
        
        -- Advance in selected period only
        COALESCE((SELECT SUM(a.amount) FROM advance_payments a WHERE a.mechanic_id = m.id
         AND a.date_paid BETWEEN '$start_date' AND '$end_date'), 0) as 'advance_in_period',
        
        -- Total Attendance Days (including before period)
        COALESCE((SELECT COUNT(DISTINCT al.curr_date) 
         FROM attendance_list al 
         WHERE al.mechanic_id = m.id AND al.status IN (1,3)
         AND al.curr_date <= '$end_date'), 0) as 'total_attendance_days',
        
        -- Attendance Days in selected period only
        COALESCE((SELECT COUNT(DISTINCT al.curr_date) 
         FROM attendance_list al 
         WHERE al.mechanic_id = m.id AND al.status IN (1,3)
         AND al.curr_date BETWEEN '$start_date' AND '$end_date'), 0) as 'attendance_in_period',
        
        -- Total Salary Due (including before period)
        (COALESCE((SELECT COUNT(DISTINCT al.curr_date) 
          FROM attendance_list al 
          WHERE al.mechanic_id = m.id AND al.status IN (1,3)
          AND al.curr_date <= '$end_date'), 0) * m.daily_salary) as 'total_salary_due',
        
        -- Salary Due in selected period only
        (COALESCE((SELECT COUNT(DISTINCT al.curr_date) 
          FROM attendance_list al 
          WHERE al.mechanic_id = m.id AND al.status IN (1,3)
          AND al.curr_date BETWEEN '$start_date' AND '$end_date'), 0) * m.daily_salary) as 'salary_due_in_period',
        
        -- Balance Amount (including carry forward)
        ((COALESCE((SELECT COUNT(DISTINCT al.curr_date) 
           FROM attendance_list al 
           WHERE al.mechanic_id = m.id AND al.status IN (1,3)
           AND al.curr_date <= '$end_date'), 0) * m.daily_salary) 
         - COALESCE((SELECT SUM(a.amount) FROM advance_payments a WHERE a.mechanic_id = m.id
          AND a.date_paid <= '$end_date'), 0)) as 'balance_amount'
    FROM mechanic_list m
    WHERE m.delete_flag = 0
    HAVING (balance_amount != 0 OR attendance_in_period > 0)
";
$reports['mechanic_ledger'] = executeQuery($conn, $mechanicLedgerSQL);

// 3. Stock Inventory Summary
$stockInventorySQL = "
    SELECT 
        p.id as 'product_id',
        p.name as 'product_name',
        p.description as 'description',
        p.price as 'sale_price',
        COALESCE(SUM(i.quantity), 0) as 'total_stock',
        COALESCE((SELECT SUM(dsi.qty) 
         FROM direct_sale_items dsi 
         JOIN direct_sales ds ON ds.id = dsi.sale_id
         WHERE dsi.product_id = p.id
         AND ds.date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'sold_quantity',
        (COALESCE(SUM(i.quantity), 0) 
         - COALESCE((SELECT SUM(dsi.qty) 
          FROM direct_sale_items dsi 
          JOIN direct_sales ds ON ds.id = dsi.sale_id
          WHERE dsi.product_id = p.id
          AND ds.date_created BETWEEN '$start_date' AND '$end_date'), 0)) as 'remaining_stock',
        (COALESCE(SUM(i.quantity), 0) * p.price) as 'stock_value'
    FROM product_list p
    LEFT JOIN inventory_list i ON i.product_id = p.id
    WHERE p.delete_flag = 0
    GROUP BY p.id, p.name, p.description, p.price
    HAVING (sold_quantity > 0 OR total_stock > 0)
    ORDER BY sold_quantity DESC, total_stock DESC
";
$reports['stock_inventory'] = executeQuery($conn, $stockInventorySQL);

// 4. Income Summary - With Date Filter
$incomeSQL = "
    SELECT 
        'रिपेयर आय' as 'description',
        COALESCE((SELECT SUM(amount) FROM transaction_list 
         WHERE status IN (3,5) 
         AND date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'amount'
    UNION ALL
    SELECT 
        'सीधी बिक्री' as 'description',
        COALESCE((SELECT SUM(total_amount) FROM direct_sales 
         WHERE date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'amount'
";
$reports['income_summary'] = executeQuery($conn, $incomeSQL);

// 5. Expense Summary - With Date Filter
$expenseSQL = "
    SELECT 
        category as 'expense_category',
        COALESCE(SUM(amount), 0) as 'amount'
    FROM expense_list
    WHERE date_created BETWEEN '$start_date' AND '$end_date'
    GROUP BY category
    ORDER BY COALESCE(SUM(amount), 0) DESC
";
$reports['expense_summary'] = executeQuery($conn, $expenseSQL);

// 6. Monthly Transaction Summary - With Date Filter
$monthlySummarySQL = "
    SELECT 
        DATE_FORMAT(t.date_created, '%Y-%m') as 'month',
        COUNT(t.id) as 'total_jobs',
        COALESCE(SUM(CASE WHEN t.status IN (3,5) THEN t.amount ELSE 0 END), 0) as 'repair_income',
        COUNT(DISTINCT t.client_name) as 'total_customers',
        COALESCE((SELECT SUM(e.amount) 
         FROM expense_list e 
         WHERE DATE_FORMAT(e.date_created, '%Y-%m') = DATE_FORMAT(t.date_created, '%Y-%m')
         AND e.date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'total_expenses'
    FROM transaction_list t
    WHERE t.date_created BETWEEN '$start_date' AND '$end_date'
    GROUP BY DATE_FORMAT(t.date_created, '%Y-%m')
    ORDER BY DATE_FORMAT(t.date_created, '%Y-%m') DESC
";
$reports['monthly_summary'] = executeQuery($conn, $monthlySummarySQL);

// 7. Top Customers - With Date Filter (Updated with carry forward)
// Check column existence again for this query
if (!empty($columnExists)) {
    $topCustomersSQL = "
        SELECT 
            c.id as 'client_id',
            CONCAT(c.firstname, ' ', COALESCE(c.middlename, ''), ' ', c.lastname) as 'customer_name',
            c.contact as 'contact',
            -- Previous transactions count
            COALESCE((SELECT COUNT(*) 
             FROM transaction_list t 
             WHERE t.client_name = c.id AND t.status IN (3,5)
             AND t.date_created < '$start_date'), 0) as 'previous_jobs',
            
            -- Current period transactions
            COALESCE((SELECT COUNT(*) 
             FROM transaction_list t 
             WHERE t.client_name = c.id AND t.status IN (3,5)
             AND t.date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'total_jobs',
            
            -- Total amount in current period
            COALESCE((SELECT SUM(t.amount) 
             FROM transaction_list t 
             WHERE t.client_name = c.id AND t.status IN (3,5)
             AND t.date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'total_amount',
            
            -- Payments in current period
            COALESCE((SELECT SUM(p.amount) 
             FROM client_payments p 
             WHERE p.client_id = c.id
             AND p.payment_date BETWEEN '$start_date' AND '$end_date'), 0) as 'total_payment_amount',
            
            -- Balance carry forward from before period
            (
                COALESCE(c.opening_balance, 0) 
                + COALESCE((SELECT SUM(t.amount) 
                           FROM transaction_list t 
                           WHERE t.client_name = c.id 
                           AND t.status IN (3,5)
                           AND t.date_created < '$start_date'), 0)
                - COALESCE((SELECT SUM(p.amount) 
                           FROM client_payments p 
                           WHERE p.client_id = c.id
                           AND p.payment_date < '$start_date'), 0)
            ) as 'opening_balance',
            
            -- Current balance including carry forward
            (
                (
                    COALESCE(c.opening_balance, 0) 
                    + COALESCE((SELECT SUM(t.amount) 
                               FROM transaction_list t 
                               WHERE t.client_name = c.id 
                               AND t.status IN (3,5)
                               AND t.date_created < '$start_date'), 0)
                    - COALESCE((SELECT SUM(p.amount) 
                               FROM client_payments p 
                               WHERE p.client_id = c.id
                               AND p.payment_date < '$start_date'), 0)
                )
                + 
                COALESCE((SELECT SUM(t.amount) 
                 FROM transaction_list t 
                 WHERE t.client_name = c.id AND t.status IN (3,5)
                 AND t.date_created BETWEEN '$start_date' AND '$end_date'), 0)
                - 
                COALESCE((SELECT SUM(p.amount) 
                 FROM client_payments p 
                 WHERE p.client_id = c.id
                 AND p.payment_date BETWEEN '$start_date' AND '$end_date'), 0)
            ) as 'current_balance'
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
            -- Previous transactions count
            COALESCE((SELECT COUNT(*) 
             FROM transaction_list t 
             WHERE t.client_name = c.id AND t.status IN (3,5)
             AND t.date_created < '$start_date'), 0) as 'previous_jobs',
            
            -- Current period transactions
            COALESCE((SELECT COUNT(*) 
             FROM transaction_list t 
             WHERE t.client_name = c.id AND t.status IN (3,5)
             AND t.date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'total_jobs',
            
            -- Total amount in current period
            COALESCE((SELECT SUM(t.amount) 
             FROM transaction_list t 
             WHERE t.client_name = c.id AND t.status IN (3,5)
             AND t.date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'total_amount',
            
            -- Payments in current period
            COALESCE((SELECT SUM(p.amount) 
             FROM client_payments p 
             WHERE p.client_id = c.id
             AND p.payment_date BETWEEN '$start_date' AND '$end_date'), 0) as 'total_payment_amount',
            
            -- Balance carry forward from before period
            (
                COALESCE((SELECT SUM(t.amount) 
                         FROM transaction_list t 
                         WHERE t.client_name = c.id 
                         AND t.status IN (3,5)
                         AND t.date_created < '$start_date'), 0)
                - COALESCE((SELECT SUM(p.amount) 
                           FROM client_payments p 
                           WHERE p.client_id = c.id
                           AND p.payment_date < '$start_date'), 0)
            ) as 'opening_balance',
            
            -- Current balance including carry forward
            (
                (
                    COALESCE((SELECT SUM(t.amount) 
                             FROM transaction_list t 
                             WHERE t.client_name = c.id 
                             AND t.status IN (3,5)
                             AND t.date_created < '$start_date'), 0)
                    - COALESCE((SELECT SUM(p.amount) 
                               FROM client_payments p 
                               WHERE p.client_id = c.id
                               AND p.payment_date < '$start_date'), 0)
                )
                + 
                COALESCE((SELECT SUM(t.amount) 
                 FROM transaction_list t 
                 WHERE t.client_name = c.id AND t.status IN (3,5)
                 AND t.date_created BETWEEN '$start_date' AND '$end_date'), 0)
                - 
                COALESCE((SELECT SUM(p.amount) 
                 FROM client_payments p 
                 WHERE p.client_id = c.id
                 AND p.payment_date BETWEEN '$start_date' AND '$end_date'), 0)
            ) as 'current_balance'
        FROM client_list c
        WHERE c.delete_flag = 0
        HAVING total_amount > 0 OR ABS(current_balance) > 0
        ORDER BY total_amount DESC
        LIMIT 10
    ";
}
$reports['top_customers'] = executeQuery($conn, $topCustomersSQL);

// 8. Loan Ledger - With Date Filter and Carry Forward
$loanLedgerSQL = "
    SELECT 
        l.id as 'loan_id',
        l.fullname as 'lender_name',
        l.contact as 'contact',
        l.loan_amount as 'loan_amount',
        l.interest_rate as 'interest_rate',
        l.tenure_months as 'tenure_months',
        l.emi_amount as 'emi_amount',
        l.start_date as 'start_date',
        CASE l.status 
            WHEN 1 THEN 'सक्रिय'
            WHEN 2 THEN 'पूर्ण'
            ELSE 'अन्य'
        END as 'status',
        
        -- Total paid up to end_date
        COALESCE((SELECT SUM(lp.amount_paid) 
         FROM loan_payments lp 
         WHERE lp.lender_id = l.id
         AND lp.payment_date <= '$end_date'), 0) as 'total_paid',
        
        -- Paid in current period only
        COALESCE((SELECT SUM(lp.amount_paid) 
         FROM loan_payments lp 
         WHERE lp.lender_id = l.id
         AND lp.payment_date BETWEEN '$start_date' AND '$end_date'), 0) as 'paid_in_period',
        
        -- Balance amount (carry forward included)
        (l.loan_amount - COALESCE((SELECT SUM(lp.amount_paid) 
                          FROM loan_payments lp 
                          WHERE lp.lender_id = l.id
                          AND lp.payment_date <= '$end_date'), 0)) as 'balance_amount',
        
        -- Payments made before this period
        COALESCE((SELECT SUM(lp.amount_paid) 
         FROM loan_payments lp 
         WHERE lp.lender_id = l.id
         AND lp.payment_date < '$start_date'), 0) as 'previous_payments',
        
        -- Remaining EMIs
        CASE 
            WHEN l.emi_amount > 0 THEN 
                CEIL((l.loan_amount - COALESCE((SELECT SUM(lp.amount_paid) 
                              FROM loan_payments lp 
                              WHERE lp.lender_id = l.id), 0)) / l.emi_amount)
            ELSE 0
        END as 'remaining_emis'
    FROM lender_list l
    WHERE l.start_date <= '$end_date'
    GROUP BY l.id
    HAVING (total_paid > 0 OR balance_amount > 0)
";
$reports['loan_ledger'] = executeQuery($conn, $loanLedgerSQL);

// 9. Business Health Dashboard - With Date Filter
$businessHealthSQL = "
    SELECT 
        COALESCE((SELECT COUNT(DISTINCT t.client_name) 
         FROM transaction_list t 
         WHERE t.date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'active_customers',
        COALESCE((SELECT COUNT(*) FROM transaction_list 
         WHERE status IN (3,5) 
         AND date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'completed_jobs',
        COALESCE((SELECT COUNT(*) FROM transaction_list 
         WHERE status = 0 
         AND date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'pending_jobs',
        COALESCE((SELECT COUNT(*) FROM transaction_list 
         WHERE status = 1 
         AND date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'inprogress_jobs',
        COALESCE((SELECT COUNT(*) FROM transaction_list 
         WHERE status = 2 
         AND date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'ready_jobs',
        COALESCE((SELECT SUM(amount) FROM transaction_list 
         WHERE status IN (3,5) 
         AND date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'total_income',
        COALESCE((SELECT SUM(amount) FROM expense_list 
         WHERE date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'total_expenses',
        COALESCE((SELECT SUM(amount) FROM client_payments 
         WHERE payment_date BETWEEN '$start_date' AND '$end_date'), 0) as 'total_payments_received',
        COALESCE((SELECT COUNT(*) FROM product_list WHERE delete_flag = 0), 0) as 'total_products',
        COALESCE((SELECT COUNT(*) FROM transaction_list 
         WHERE date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'total_all_jobs',
        COALESCE((SELECT SUM(total_amount) FROM direct_sales 
         WHERE date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'direct_sales'
    FROM dual
";
$reports['business_health'] = executeQuery($conn, $businessHealthSQL);

// Calculate totals for business health
if (!empty($reports['business_health'])) {
    $businessHealth = $reports['business_health'][0];
    $net_income = $businessHealth['total_income'] - $businessHealth['total_expenses'];
} else {
    $businessHealth = [
        'active_customers' => 0,
        'completed_jobs' => 0,
        'pending_jobs' => 0,
        'inprogress_jobs' => 0,
        'ready_jobs' => 0,
        'total_income' => 0,
        'total_expenses' => 0,
        'total_payments_received' => 0,
        'total_products' => 0,
        'total_all_jobs' => 0,
        'direct_sales' => 0
    ];
    $net_income = 0;
}

// Get total pending amount from customers for selected period (INCLUDING CARRY FORWARD)
if (!empty($columnExists)) {
    $pendingAmountSQL = "
        SELECT 
            COALESCE(SUM(
                (
                    COALESCE(c.opening_balance, 0) 
                    + COALESCE((SELECT SUM(t.amount) 
                               FROM transaction_list t 
                               WHERE t.client_name = c.id 
                               AND t.status IN (3,5)
                               AND t.date_created <= '$end_date'), 0)
                    - COALESCE((SELECT SUM(p.amount) 
                               FROM client_payments p 
                               WHERE p.client_id = c.id
                               AND p.payment_date <= '$end_date'), 0)
                )
            ), 0) as total_pending
        FROM client_list c
        WHERE c.delete_flag = 0
        HAVING (
            COALESCE(c.opening_balance, 0) != 0 
            OR COALESCE((SELECT SUM(t.amount) 
                FROM transaction_list t 
                WHERE t.client_name = c.id 
                AND t.status IN (3,5)
                AND t.date_created <= '$end_date'), 0) != 0
            OR COALESCE((SELECT SUM(p.amount) 
                FROM client_payments p 
                WHERE p.client_id = c.id
                AND p.payment_date <= '$end_date'), 0) != 0
        )
    ";
} else {
    $pendingAmountSQL = "
        SELECT 
            COALESCE(SUM(
                (
                    COALESCE((SELECT SUM(t.amount) 
                             FROM transaction_list t 
                             WHERE t.client_name = c.id 
                             AND t.status IN (3,5)
                             AND t.date_created <= '$end_date'), 0)
                    - COALESCE((SELECT SUM(p.amount) 
                               FROM client_payments p 
                               WHERE p.client_id = c.id
                               AND p.payment_date <= '$end_date'), 0)
                )
            ), 0) as total_pending
        FROM client_list c
        WHERE c.delete_flag = 0
        HAVING (
            COALESCE((SELECT SUM(t.amount) 
                FROM transaction_list t 
                WHERE t.client_name = c.id 
                AND t.status IN (3,5)
                AND t.date_created <= '$end_date'), 0) != 0
            OR COALESCE((SELECT SUM(p.amount) 
                FROM client_payments p 
                WHERE p.client_id = c.id
                AND p.payment_date <= '$end_date'), 0) != 0
        )
    ";
}
$pendingAmountResult = executeQuery($conn, $pendingAmountSQL);
$total_pending_amount = $pendingAmountResult[0]['total_pending'] ?? 0;

// Get total advance given to mechanics for selected period (including before)
$totalAdvanceSQL = "
    SELECT COALESCE(SUM(amount), 0) as total 
    FROM advance_payments 
    WHERE date_paid <= '$end_date'
";
$totalAdvanceResult = executeQuery($conn, $totalAdvanceSQL);
$total_advance_given = $totalAdvanceResult[0]['total'] ?? 0;

// Get total salary payable to mechanics for selected period (including before)
$totalSalarySQL = "
    SELECT 
        COALESCE(SUM(
            (COALESCE((SELECT COUNT(DISTINCT al.curr_date) 
             FROM attendance_list al 
             WHERE al.mechanic_id = m.id AND al.status IN (1,3)
             AND al.curr_date <= '$end_date'), 0) * m.daily_salary)
        ), 0) as total_salary_payable
    FROM mechanic_list m
    WHERE m.delete_flag = 0
";
$totalSalaryResult = executeQuery($conn, $totalSalarySQL);
$total_salary_payable = $totalSalaryResult[0]['total_salary_payable'] ?? 0;

// Calculate total opening balance from customers (before start_date)
if (!empty($columnExists)) {
    $totalOpeningBalanceSQL = "
        SELECT 
            COALESCE(SUM(
                COALESCE(c.opening_balance, 0) 
                + COALESCE((SELECT SUM(t.amount) 
                           FROM transaction_list t 
                           WHERE t.client_name = c.id 
                           AND t.status IN (3,5)
                           AND t.date_created < '$start_date'), 0)
                - COALESCE((SELECT SUM(p.amount) 
                           FROM client_payments p 
                           WHERE p.client_id = c.id
                           AND p.payment_date < '$start_date'), 0)
            ), 0) as total_opening_balance
        FROM client_list c
        WHERE c.delete_flag = 0
    ";
} else {
    $totalOpeningBalanceSQL = "
        SELECT 
            COALESCE(SUM(
                COALESCE((SELECT SUM(t.amount) 
                         FROM transaction_list t 
                         WHERE t.client_name = c.id 
                         AND t.status IN (3,5)
                         AND t.date_created < '$start_date'), 0)
                - COALESCE((SELECT SUM(p.amount) 
                           FROM client_payments p 
                           WHERE p.client_id = c.id
                           AND p.payment_date < '$start_date'), 0)
            ), 0) as total_opening_balance
        FROM client_list c
        WHERE c.delete_flag = 0
    ";
}
$totalOpeningBalanceResult = executeQuery($conn, $totalOpeningBalanceSQL);
$total_opening_balance = $totalOpeningBalanceResult[0]['total_opening_balance'] ?? 0;

// Format month name in Hindi
$month_names = [
    1 => 'जनवरी', 2 => 'फरवरी', 3 => 'मार्च', 4 => 'अप्रैल',
    5 => 'मई', 6 => 'जून', 7 => 'जुलाई', 8 => 'अगस्त',
    9 => 'सितंबर', 10 => 'अक्टूबर', 11 => 'नवंबर', 12 => 'दिसंबर'
];

// Ensure $filter_month is an integer to avoid array key issues
$filter_month_int = (int)$filter_month;
$current_month_name_hindi = isset($month_names[$filter_month_int]) ? $month_names[$filter_month_int] : $month_names[$current_month];
?>

<!DOCTYPE html>
<html lang="hi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>व्यापार रिपोर्ट्स - V-Tech</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.8.1/font/bootstrap-icons.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">
    <style>
        body {
            background-color: #f8f9fa;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .navbar {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .report-card {
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.3s;
            margin-bottom: 20px;
        }
        .report-card:hover {
            transform: translateY(-5px);
        }
        .health-card {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
        }
        .income-card {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
        }
        .expense-card {
            background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
            color: white;
        }
        .warning-card {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
        }
        .success-card {
            background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
            color: white;
        }
        .table-container {
            max-height: 400px;
            overflow-y: auto;
        }
        .section-title {
            border-left: 4px solid #667eea;
            padding-left: 15px;
            margin: 25px 0 15px 0;
            color: #333;
        }
        .positive {
            color: #28a745;
            font-weight: bold;
        }
        .negative {
            color: #dc3545;
            font-weight: bold;
        }
        .sticky-header {
            position: sticky;
            top: 0;
            background: white;
            z-index: 100;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stat-number {
            font-size: 1.8rem;
            font-weight: bold;
        }
        .stat-label {
            font-size: 0.85rem;
            opacity: 0.9;
        }
        .nav-tabs .nav-link.active {
            background-color: #667eea;
            color: white;
            border-color: #667eea;
        }
        .tab-content {
            background: white;
            padding: 20px;
            border-radius: 0 0 10px 10px;
            border: 1px solid #dee2e6;
            border-top: none;
        }
        .filter-container {
            background: white;
            padding: 15px;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .date-range-display {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 10px 15px;
            border-radius: 8px;
            margin-bottom: 15px;
        }
        .nav-buttons .btn {
            margin: 2px;
        }
        .flatpickr-input {
            background-color: white !important;
        }
        .info-badge {
            background-color: #17a2b8;
            color: white;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
        }
        .error-message {
            background-color: #f8d7da;
            color: #721c24;
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 10px;
            border: 1px solid #f5c6cb;
        }
    </style>
</head>
<body>
    <!-- Navigation -->
    <nav class="navbar navbar-expand-lg navbar-dark">
        <div class="container">
            <a class="navbar-brand" href="#">
                <i class="bi bi-graph-up"></i> V-Tech व्यापार रिपोर्ट्स
            </a>
            <div class="navbar-text text-white">
                <small>फिल्टर: 
                    <?php 
                    if ($filter_type == 'monthly') {
                        echo isset($month_names[$filter_month_int]) ? $month_names[$filter_month_int] . " $filter_year" : $filter_month . " $filter_year";
                    } elseif ($filter_type == 'yearly') {
                        echo "वर्ष $filter_year";
                    } else {
                        echo date('d/m/Y', strtotime($start_date)) . " से " . date('d/m/Y', strtotime($end_date));
                    }
                    ?>
                </small>
            </div>
        </div>
    </nav>

    <div class="container mt-4">
        <!-- Date Filter Section -->
        <div class="filter-container">
            <div class="date-range-display">
                <h5 class="mb-0">
                    <i class="bi bi-calendar-range"></i> 
                    <?php 
                    if ($filter_type == 'monthly') {
                        echo "महीना: <strong>" . (isset($month_names[$filter_month_int]) ? $month_names[$filter_month_int] : $filter_month) . " $filter_year</strong>";
                    } elseif ($filter_type == 'yearly') {
                        echo "वर्ष: <strong>$filter_year</strong>";
                    } else {
                        echo "कस्टम रेंज: <strong>" . date('d/m/Y', strtotime($start_date)) . " से " . date('d/m/Y', strtotime($end_date)) . "</strong>";
                    }
                    ?>
                </h5>
                <small>डेटा रेंज: <?php echo date('d/m/Y', strtotime($start_date)); ?> से <?php echo date('d/m/Y', strtotime($end_date)); ?></small>
                <br>
                <small class="text-warning">
                    <i class="bi bi-info-circle"></i> 
                    पिछली अवधि का बैलेंस शामिल किया गया है (कैरी फॉरवर्ड)
                </small>
            </div>
            
            <form method="GET" action="" class="row g-3">
                <!-- Hidden input to preserve page parameter -->
                <input type="hidden" name="page" value="reports/balancesheet">
                
                <div class="col-md-3">
                    <label for="filter_type" class="form-label">फिल्टर प्रकार</label>
                    <select class="form-select" id="filter_type" name="filter_type" onchange="this.form.submit()">
                        <option value="monthly" <?php echo $filter_type == 'monthly' ? 'selected' : ''; ?>>मासिक</option>
                        <option value="yearly" <?php echo $filter_type == 'yearly' ? 'selected' : ''; ?>>वार्षिक</option>
                        <option value="custom" <?php echo $filter_type == 'custom' ? 'selected' : ''; ?>>कस्टम रेंज</option>
                    </select>
                </div>
                
                <?php if ($filter_type == 'monthly'): ?>
                <div class="col-md-3">
                    <label for="month" class="form-label">महीना</label>
                    <select class="form-select" id="month" name="month">
                        <?php foreach ($month_names as $num => $name): ?>
                            <option value="<?php echo $num; ?>" <?php echo $filter_month_int == $num ? 'selected' : ''; ?>>
                                <?php echo $name; ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <?php endif; ?>
                
                <div class="col-md-3">
                    <label for="year" class="form-label">वर्ष</label>
                    <select class="form-select" id="year" name="year">
                        <?php for ($y = 2020; $y <= $current_year + 1; $y++): ?>
                            <option value="<?php echo $y; ?>" <?php echo $filter_year == $y ? 'selected' : ''; ?>>
                                <?php echo $y; ?>
                            </option>
                        <?php endfor; ?>
                    </select>
                </div>
                
                <?php if ($filter_type == 'custom'): ?>
                <div class="col-md-3">
                    <label for="start_date" class="form-label">शुरू तारीख</label>
                    <input type="date" class="form-control" id="start_date" name="start_date" 
                           value="<?php echo $start_date; ?>">
                </div>
                <div class="col-md-3">
                    <label for="end_date" class="form-label">समाप्ति तारीख</label>
                    <input type="date" class="form-control" id="end_date" name="end_date" 
                           value="<?php echo $end_date; ?>">
                </div>
                <?php endif; ?>
                
                <div class="col-md-12">
                    <div class="btn-group nav-buttons" role="group">
                        <!-- Previous Button -->
                        <a href="?page=reports/balancesheet&year=<?php echo $filter_year; ?>&month=<?php echo $filter_month_int; ?>&filter_type=<?php echo $filter_type; ?>&nav=prev" 
                           class="btn btn-outline-primary">
                            <i class="bi bi-chevron-left"></i> पिछला
                        </a>
                        
                        <!-- Apply Filter Button -->
                        <button type="submit" class="btn btn-primary">
                            <i class="bi bi-filter"></i> फिल्टर लागू करें
                        </button>
                        
                        <!-- Reset Button -->
                        <a href="?page=reports/balancesheet&reset=1" class="btn btn-outline-danger">
                            <i class="bi bi-arrow-counterclockwise"></i> रीसेट
                        </a>
                        
                        <!-- Current Month/Year Button -->
                        <a href="?page=reports/balancesheet&year=<?php echo $current_year; ?>&month=<?php echo $current_month; ?>&filter_type=monthly" 
                           class="btn btn-outline-success">
                            <i class="bi bi-calendar-check"></i> वर्तमान
                        </a>
                        
                        <!-- Next Button -->
                        <a href="?page=reports/balancesheet&year=<?php echo $filter_year; ?>&month=<?php echo $filter_month_int; ?>&filter_type=<?php echo $filter_type; ?>&nav=next" 
                           class="btn btn-outline-primary">
                            अगला <i class="bi bi-chevron-right"></i>
                        </a>
                    </div>
                    
                    <div class="btn-group mt-2" role="group">
                        <!-- Quick Filters -->
                        <a href="?page=reports/balancesheet&year=<?php echo $filter_year; ?>&month=<?php echo $filter_month_int; ?>&filter_type=monthly" 
                           class="btn btn-sm btn-outline-info <?php echo $filter_type == 'monthly' ? 'active' : ''; ?>">
                            इस महीने
                        </a>
                        <a href="?page=reports/balancesheet&year=<?php echo $filter_year; ?>&filter_type=yearly" 
                           class="btn btn-sm btn-outline-info <?php echo $filter_type == 'yearly' ? 'active' : ''; ?>">
                            इस साल
                        </a>
                        <a href="?page=reports/balancesheet&year=<?php echo $filter_year; ?>&month=<?php echo ($filter_month_int-1); ?>&filter_type=monthly" 
                           class="btn btn-sm btn-outline-secondary">
                            पिछला महीना
                        </a>
                        <a href="?page=reports/balancesheet&year=<?php echo ($filter_year-1); ?>&month=<?php echo $filter_month_int; ?>&filter_type=monthly" 
                           class="btn btn-sm btn-outline-secondary">
                            पिछला साल
                        </a>
                    </div>
                </div>
            </form>
        </div>

        <!-- Database Info Alert -->
        <?php if (empty($columnExists)): ?>
        <div class="alert alert-warning">
            <i class="bi bi-exclamation-triangle"></i>
            <strong>नोट:</strong> 
            <code>client_list</code> टेबल में <code>opening_balance</code> कॉलम नहीं मिला। 
            पिछले बैलेंस की गणना केवल पिछले लेनदेन से की जा रही है।
        </div>
        <?php endif; ?>

        <!-- Business Health Dashboard -->
        <div id="dashboard">
            <h2 class="section-title">
                <i class="bi bi-speedometer2"></i> व्यापार स्वास्थ्य डैशबोर्ड 
                <small class="text-muted">
                    (<?php echo date('d/m/Y', strtotime($start_date)); ?> से <?php echo date('d/m/Y', strtotime($end_date)); ?>)
                </small>
                <span class="info-badge float-end">बैलेंस कैरी फॉरवर्ड</span>
            </h2>
            
            <div class="row">
                <!-- Opening Balance (Carry Forward) -->
                <div class="col-md-3 col-sm-6 mb-3">
                    <div class="card report-card bg-secondary text-white">
                        <div class="card-body text-center">
                            <h5 class="card-title"><i class="bi bi-box-arrow-in-right"></i> शुरुआती बैलेंस</h5>
                            <div class="stat-number">₹<?php echo number_format($total_opening_balance, 2); ?></div>
                            <div class="stat-label">
                                <?php echo date('d/m/Y', strtotime($start_date)); ?> से पहले का बैलेंस
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- कुल आय -->
                <div class="col-md-3 col-sm-6 mb-3">
                    <div class="card report-card income-card">
                        <div class="card-body text-center">
                            <h5 class="card-title"><i class="bi bi-cash-coin"></i> कुल आय</h5>
                            <div class="stat-number">₹<?php echo number_format($businessHealth['total_income'], 2); ?></div>
                            <div class="stat-label">
                                रिपेयर: ₹<?php echo number_format($businessHealth['total_income'], 2); ?><br>
                                बिक्री: ₹<?php echo number_format($businessHealth['direct_sales'], 2); ?>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- शुद्ध आय -->
                <div class="col-md-3 col-sm-6 mb-3">
                    <div class="card report-card <?php echo $net_income >= 0 ? 'success-card' : 'warning-card'; ?>">
                        <div class="card-body text-center">
                            <h5 class="card-title"><i class="bi bi-graph-up-arrow"></i> शुद्ध आय</h5>
                            <div class="stat-number">₹<?php echo number_format($net_income, 2); ?></div>
                            <div class="stat-label">
                                आय: ₹<?php echo number_format($businessHealth['total_income'], 2); ?><br>
                                व्यय: ₹<?php echo number_format($businessHealth['total_expenses'], 2); ?>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- लंबित राशि -->
                <div class="col-md-3 col-sm-6 mb-3">
                    <div class="card report-card warning-card">
                        <div class="card-body text-center">
                            <h5 class="card-title"><i class="bi bi-clock-history"></i> कुल लंबित राशि</h5>
                            <div class="stat-number">₹<?php echo number_format($total_pending_amount, 2); ?></div>
                            <div class="stat-label">
                                ग्राहकों से कुल प्राप्त करना है<br>
                                (कैरी फॉरवर्ड सहित)
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Second Row -->
            <div class="row">
                <!-- सक्रिय ग्राहक -->
                <div class="col-md-3 col-sm-6 mb-3">
                    <div class="card report-card health-card">
                        <div class="card-body text-center">
                            <h5 class="card-title"><i class="bi bi-people"></i> सक्रिय ग्राहक</h5>
                            <div class="stat-number"><?php echo $businessHealth['active_customers']; ?></div>
                            <div class="stat-label">
                                इस अवधि में लेनदेन किए
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- कुल जॉब -->
                <div class="col-md-3 col-sm-6 mb-3">
                    <div class="card report-card bg-info text-white">
                        <div class="card-body text-center">
                            <h5 class="card-title"><i class="bi bi-briefcase"></i> कुल जॉब</h5>
                            <div class="stat-number"><?php echo $businessHealth['total_all_jobs']; ?></div>
                            <div class="stat-label">
                                पूर्ण: <?php echo $businessHealth['completed_jobs']; ?><br>
                                लंबित: <?php echo $businessHealth['pending_jobs']; ?>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- वेतन देय -->
                <div class="col-md-3 col-sm-6 mb-3">
                    <div class="card report-card bg-danger text-white">
                        <div class="card-body text-center">
                            <h5 class="card-title"><i class="bi bi-cash-stack"></i> कुल वेतन देय</h5>
                            <div class="stat-number">₹<?php echo number_format($total_salary_payable, 2); ?></div>
                            <div class="stat-label">
                                अडवांस: ₹<?php echo number_format($total_advance_given, 2); ?><br>
                                शेष: ₹<?php echo number_format($total_salary_payable - $total_advance_given, 2); ?>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- भुगतान प्राप्त -->
                <div class="col-md-3 col-sm-6 mb-3">
                    <div class="card report-card bg-success text-white">
                        <div class="card-body text-center">
                            <h5 class="card-title"><i class="bi bi-wallet2"></i> भुगतान प्राप्त</h5>
                            <div class="stat-number">₹<?php echo number_format($businessHealth['total_payments_received'], 2); ?></div>
                            <div class="stat-label">
                                इस अवधि में प्राप्त भुगतान
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Third Row - Summary -->
            <div class="row">
                <div class="col-md-12">
                    <div class="card report-card">
                        <div class="card-header bg-dark text-white">
                            <h5 class="mb-0"><i class="bi bi-calculator"></i> कुल बैलेंस सारांश</h5>
                        </div>
                        <div class="card-body">
                            <div class="row text-center">
                                <div class="col-md-4">
                                    <div class="p-3 border rounded bg-light">
                                        <h6>शुरुआती बैलेंस</h6>
                                        <h4 class="<?php echo $total_opening_balance >= 0 ? 'text-success' : 'text-danger'; ?>">
                                            ₹<?php echo number_format($total_opening_balance, 2); ?>
                                        </h4>
                                        <small class="text-muted"><?php echo date('d/m/Y', strtotime($start_date)); ?> से पहले</small>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="p-3 border rounded bg-light">
                                        <h6>इस अवधि में शुद्ध आय</h6>
                                        <h4 class="<?php echo $net_income >= 0 ? 'text-success' : 'text-danger'; ?>">
                                            ₹<?php echo number_format($net_income, 2); ?>
                                        </h4>
                                        <small class="text-muted">इस अवधि में</small>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="p-3 border rounded bg-light">
                                        <h6>कुल संचित बैलेंस</h6>
                                        <h4 class="<?php echo ($total_opening_balance + $net_income) >= 0 ? 'text-success' : 'text-danger'; ?>">
                                            ₹<?php echo number_format($total_opening_balance + $net_income, 2); ?>
                                        </h4>
                                        <small class="text-muted">शुरुआती + इस अवधि</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Tabs for different reports -->
        <div class="mt-5">
            <ul class="nav nav-tabs" id="reportTabs" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active" id="customers-tab" data-bs-toggle="tab" data-bs-target="#customers" type="button">
                        <i class="bi bi-people"></i> ग्राहक
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="stock-tab" data-bs-toggle="tab" data-bs-target="#stock" type="button">
                        <i class="bi bi-box"></i> स्टॉक
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="finance-tab" data-bs-toggle="tab" data-bs-target="#finance" type="button">
                        <i class="bi bi-cash-stack"></i> वित्त
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="employees-tab" data-bs-toggle="tab" data-bs-target="#employees" type="button">
                        <i class="bi bi-person-badge"></i> कर्मचारी
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="loans-tab" data-bs-toggle="tab" data-bs-target="#loans" type="button">
                        <i class="bi bi-bank"></i> लोन
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="monthly-tab" data-bs-toggle="tab" data-bs-target="#monthly" type="button">
                        <i class="bi bi-calendar-month"></i> मासिक
                    </button>
                </li>
            </ul>
            
            <div class="tab-content" id="reportTabsContent">
                
                <!-- Customers Tab -->
                <div class="tab-pane fade show active" id="customers" role="tabpanel">
                    <h4 class="mb-3">
                        <i class="bi bi-people"></i> ग्राहक रिपोर्ट्स 
                        <small class="text-muted">
                            (<?php echo date('d/m/Y', strtotime($start_date)); ?> से <?php echo date('d/m/Y', strtotime($end_date)); ?>)
                        </small>
                        <span class="info-badge float-end">बैलेंस कैरी फॉरवर्ड</span>
                    </h4>
                    
                    <!-- Top Customers -->
                    <div class="card report-card mb-4">
                        <div class="card-header bg-primary text-white">
                            <h5 class="mb-0">
                                <i class="bi bi-trophy"></i> शीर्ष 10 ग्राहक (कुल बैलेंस)
                                <span class="float-end badge bg-light text-dark">
                                    <?php echo count($reports['top_customers']); ?> ग्राहक
                                </span>
                            </h5>
                        </div>
                        <div class="card-body">
                            <?php if (empty($reports['top_customers'])): ?>
                                <div class="alert alert-info text-center">
                                    <i class="bi bi-info-circle"></i> कोई ग्राहक डेटा उपलब्ध नहीं है।
                                </div>
                            <?php else: ?>
                                <?php if (empty($columnExists)): ?>
                                <div class="alert alert-warning">
                                    <i class="bi bi-exclamation-triangle"></i> 
                                    <strong>नोट:</strong> Opening Balance कॉलम नहीं मिला। बैलेंस की गणना केवल पिछले लेनदेन से की जा रही है।
                                </div>
                                <?php else: ?>
                                <div class="alert alert-info">
                                    <i class="bi bi-info-circle"></i> 
                                    <strong>नोट:</strong> बैलेंस में पिछली अवधि का शेष भी शामिल है।
                                </div>
                                <?php endif; ?>
                                <div class="table-container">
                                    <table class="table table-hover table-sm">
                                        <thead class="sticky-header">
                                            <tr>
                                                <th>#</th>
                                                <th>ग्राहक नाम</th>
                                                <th>संपर्क</th>
                                                <th>शुरुआती<br>बैलेंस</th>
                                                <th>इस अवधि में<br>जॉब</th>
                                                <th>इस अवधि में<br>राशि</th>
                                                <th>इस अवधि में<br>भुगतान</th>
                                                <th>वर्तमान<br>शेष</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <?php 
                                            $customer_counter = 1;
                                            $top_customers_opening = 0;
                                            $top_customers_total = 0;
                                            $top_customers_paid = 0;
                                            $top_customers_balance = 0;
                                            ?>
                                            <?php foreach($reports['top_customers'] as $customer): ?>
                                                <?php 
                                                    $top_customers_opening += $customer['opening_balance'];
                                                    $top_customers_total += $customer['total_amount'];
                                                    $top_customers_paid += $customer['total_payment_amount'];
                                                    $top_customers_balance += $customer['current_balance'];
                                                ?>
                                                <tr>
                                                    <td><?php echo $customer_counter++; ?></td>
                                                    <td><strong><?php echo $customer['customer_name']; ?></strong></td>
                                                    <td><?php echo $customer['contact']; ?></td>
                                                    <td class="<?php echo $customer['opening_balance'] >= 0 ? 'positive' : 'negative'; ?>">
                                                        ₹<?php echo number_format($customer['opening_balance'], 2); ?>
                                                    </td>
                                                    <td><span class="badge bg-info"><?php echo $customer['total_jobs']; ?></span></td>
                                                    <td>₹<?php echo number_format($customer['total_amount'], 2); ?></td>
                                                    <td>₹<?php echo number_format($customer['total_payment_amount'], 2); ?></td>
                                                    <td class="<?php echo $customer['current_balance'] >= 0 ? 'positive' : 'negative'; ?>">
                                                        ₹<?php echo number_format($customer['current_balance'], 2); ?>
                                                    </td>
                                                </tr>
                                            <?php endforeach; ?>
                                            <!-- Totals Row -->
                                            <tr class="table-dark">
                                                <td colspan="3"><strong>कुल:</strong></td>
                                                <td class="<?php echo $top_customers_opening >= 0 ? 'positive' : 'negative'; ?>">
                                                    <strong>₹<?php echo number_format($top_customers_opening, 2); ?></strong>
                                                </td>
                                                <td><strong>-</strong></td>
                                                <td><strong>₹<?php echo number_format($top_customers_total, 2); ?></strong></td>
                                                <td><strong>₹<?php echo number_format($top_customers_paid, 2); ?></strong></td>
                                                <td class="<?php echo $top_customers_balance >= 0 ? 'positive' : 'negative'; ?>">
                                                    <strong>₹<?php echo number_format($top_customers_balance, 2); ?></strong>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            <?php endif; ?>
                        </div>
                    </div>

                    <!-- Customer Ledger -->
                    <div class="card report-card">
                        <div class="card-header bg-success text-white">
                            <h5 class="mb-0">
                                <i class="bi bi-journal-text"></i> ग्राहक खाता बही (कुल बैलेंस वाले)
                                <span class="float-end badge bg-light text-dark">
                                    <?php echo count($reports['customer_ledger']); ?> ग्राहक
                                </span>
                            </h5>
                        </div>
                        <div class="card-body">
                            <?php if (empty($reports['customer_ledger'])): ?>
                                <div class="alert alert-info text-center">
                                    <i class="bi bi-info-circle"></i> कोई ग्राहक लेनदेन नहीं हुआ है।
                                </div>
                            <?php else: ?>
                                <?php if (empty($columnExists)): ?>
                                <div class="alert alert-warning">
                                    <i class="bi bi-exclamation-triangle"></i> 
                                    <strong>नोट:</strong> Opening Balance कॉलम नहीं मिला। शुरुआती बैलेंस की गणना केवल पिछले लेनदेन से की जा रही है।
                                </div>
                                <?php else: ?>
                                <div class="alert alert-info">
                                    <i class="bi bi-info-circle"></i> 
                                    <strong>शुरुआती बैलेंस:</strong> <?php echo date('d/m/Y', strtotime($start_date)); ?> से पहले का बैलेंस<br>
                                    <strong>वर्तमान शेष:</strong> शुरुआती बैलेंस + इस अवधि में लेनदेन
                                </div>
                                <?php endif; ?>
                                <div class="table-container">
                                    <table class="table table-hover table-sm">
                                        <thead class="sticky-header">
                                            <tr>
                                                <th>ग्राहक नाम</th>
                                                <th>शुरुआती<br>बैलेंस</th>
                                                <th>पिछली<br>लेनदेन</th>
                                                <th>रिपेयर<br>राशि</th>
                                                <th>भुगतान</th>
                                                <th>वर्तमान<br>शेष</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <?php 
                                            $ledger_total_opening = 0;
                                            $ledger_total_previous = 0;
                                            $ledger_total_repair = 0;
                                            $ledger_total_payment = 0;
                                            $ledger_total_balance = 0;
                                            ?>
                                            <?php foreach($reports['customer_ledger'] as $ledger): ?>
                                                <?php 
                                                    $previous_transactions = $ledger['previous_transactions'] + $ledger['previous_payments'];
                                                    $ledger_total_opening += $ledger['opening_balance'];
                                                    $ledger_total_previous += $previous_transactions;
                                                    $ledger_total_repair += $ledger['total_repair_amount'];
                                                    $ledger_total_payment += $ledger['total_payment'];
                                                    $ledger_total_balance += $ledger['current_balance'];
                                                ?>
                                                <tr>
                                                    <td><?php echo $ledger['customer_name']; ?></td>
                                                    <td class="<?php echo $ledger['opening_balance'] >= 0 ? 'positive' : 'negative'; ?>">
                                                        ₹<?php echo number_format($ledger['opening_balance'], 2); ?>
                                                    </td>
                                                    <td><span class="badge bg-secondary"><?php echo $previous_transactions; ?></span></td>
                                                    <td>₹<?php echo number_format($ledger['total_repair_amount'], 2); ?></td>
                                                    <td>₹<?php echo number_format($ledger['total_payment'], 2); ?></td>
                                                    <td class="<?php echo $ledger['current_balance'] >= 0 ? 'positive' : 'negative'; ?>">
                                                        ₹<?php echo number_format($ledger['current_balance'], 2); ?>
                                                    </td>
                                                </tr>
                                            <?php endforeach; ?>
                                            <!-- Totals Row -->
                                            <tr class="table-dark">
                                                <td><strong>कुल:</strong></td>
                                                <td class="<?php echo $ledger_total_opening >= 0 ? 'positive' : 'negative'; ?>">
                                                    <strong>₹<?php echo number_format($ledger_total_opening, 2); ?></strong>
                                                </td>
                                                <td><strong><span class="badge bg-secondary"><?php echo $ledger_total_previous; ?></span></strong></td>
                                                <td><strong>₹<?php echo number_format($ledger_total_repair, 2); ?></strong></td>
                                                <td><strong>₹<?php echo number_format($ledger_total_payment, 2); ?></strong></td>
                                                <td class="<?php echo $ledger_total_balance >= 0 ? 'positive' : 'negative'; ?>">
                                                    <strong>₹<?php echo number_format($ledger_total_balance, 2); ?></strong>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="mt-3 text-muted">
                                    <small>
                                        <i class="bi bi-info-circle"></i> 
                                        सकारात्मक शेष = हमें देना है | नकारात्मक शेष = ग्राहक को देना है
                                    </small>
                                </div>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
                
                <!-- Stock Tab -->
                <div class="tab-pane fade" id="stock" role="tabpanel">
                    <h4 class="mb-3">
                        <i class="bi bi-box"></i> स्टॉक रिपोर्ट्स
                        <small class="text-muted">
                            (<?php echo date('d/m/Y', strtotime($start_date)); ?> से <?php echo date('d/m/Y', strtotime($end_date)); ?> में बिक्री)
                        </small>
                    </h4>
                    
                    <div class="card report-card">
                        <div class="card-header bg-warning">
                            <h5 class="mb-0">
                                <i class="bi bi-boxes"></i> स्टॉक इन्वेंटरी सारांश
                                <span class="float-end badge bg-light text-dark">
                                    <?php echo count($reports['stock_inventory']); ?> उत्पाद
                                </span>
                            </h5>
                        </div>
                        <div class="card-body">
                            <?php if (empty($reports['stock_inventory'])): ?>
                                <div class="alert alert-info text-center">
                                    <i class="bi bi-info-circle"></i> कोई स्टॉक उपलब्ध नहीं है।
                                </div>
                            <?php else: ?>
                                <div class="table-container">
                                    <table class="table table-hover table-sm">
                                        <thead class="sticky-header">
                                            <tr>
                                                <th>उत्पाद नाम</th>
                                                <th>विक्रय मूल्य</th>
                                                <th>कुल स्टॉक</th>
                                                <th>बिक्री गई</th>
                                                <th>शेष स्टॉक</th>
                                                <th>स्टॉक मूल्य</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <?php 
                                            $total_stock_value = 0;
                                            $total_items_stock = 0;
                                            $total_items_sold = 0;
                                            $total_items_remaining = 0;
                                            ?>
                                            <?php foreach($reports['stock_inventory'] as $stock): ?>
                                                <?php 
                                                    $total_stock_value += $stock['stock_value'];
                                                    $total_items_stock += $stock['total_stock'];
                                                    $total_items_sold += $stock['sold_quantity'];
                                                    $total_items_remaining += $stock['remaining_stock'];
                                                ?>
                                                <tr>
                                                    <td><?php echo $stock['product_name']; ?></td>
                                                    <td>₹<?php echo number_format($stock['sale_price'], 2); ?></td>
                                                    <td><span class="badge bg-primary"><?php echo $stock['total_stock']; ?></span></td>
                                                    <td><span class="badge bg-success"><?php echo $stock['sold_quantity']; ?></span></td>
                                                    <td>
                                                        <span class="badge <?php echo $stock['remaining_stock'] > 0 ? 'bg-info' : 'bg-danger'; ?>">
                                                            <?php echo $stock['remaining_stock']; ?>
                                                        </span>
                                                    </td>
                                                    <td>₹<?php echo number_format($stock['stock_value'], 2); ?></td>
                                                </tr>
                                            <?php endforeach; ?>
                                            <!-- Totals Row -->
                                            <tr class="table-dark">
                                                <td><strong>कुल:</strong></td>
                                                <td><strong>-</strong></td>
                                                <td><strong><span class="badge bg-primary"><?php echo $total_items_stock; ?></span></strong></td>
                                                <td><strong><span class="badge bg-success"><?php echo $total_items_sold; ?></span></strong></td>
                                                <td><strong><span class="badge bg-info"><?php echo $total_items_remaining; ?></span></strong></td>
                                                <td><strong>₹<?php echo number_format($total_stock_value, 2); ?></strong></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="mt-3">
                                    <div class="row">
                                        <div class="col-md-6">
                                            <div class="alert alert-info">
                                                <h6><i class="bi bi-info-circle"></i> स्टॉक विश्लेषण</h6>
                                                <small>
                                                    कुल उत्पाद: <?php echo $businessHealth['total_products']; ?><br>
                                                    कुल स्टॉक आइटम: <?php echo $total_items_stock; ?><br>
                                                    इस अवधि में बिक्री: <?php echo $total_items_sold; ?><br>
                                                    उपलब्ध आइटम: <?php echo $total_items_remaining; ?>
                                                </small>
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="alert alert-warning">
                                                <h6><i class="bi bi-exclamation-triangle"></i> स्टॉक मूल्य</h6>
                                                <small>
                                                    कुल स्टॉक मूल्य: ₹<?php echo number_format($total_stock_value, 2); ?><br>
                                                    औसत मूल्य प्रति आइटम: ₹<?php echo $total_items_stock > 0 ? number_format($total_stock_value / $total_items_stock, 2) : '0.00'; ?>
                                                </small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
                
                <!-- Finance Tab -->
                <div class="tab-pane fade" id="finance" role="tabpanel">
                    <h4 class="mb-3">
                        <i class="bi bi-cash-stack"></i> वित्तीय रिपोर्ट्स
                        <small class="text-muted">
                            (<?php echo date('d/m/Y', strtotime($start_date)); ?> से <?php echo date('d/m/Y', strtotime($end_date)); ?>)
                        </small>
                        <span class="info-badge float-end">बैलेंस कैरी फॉरवर्ड</span>
                    </h4>
                    
                    <div class="row">
                        <!-- Opening Balance Summary -->
                        <div class="col-md-12 mb-4">
                            <div class="card report-card">
                                <div class="card-header bg-secondary text-white">
                                    <h5 class="mb-0"><i class="bi bi-box-arrow-in-right"></i> शुरुआती बैलेंस सारांश</h5>
                                </div>
                                <div class="card-body">
                                    <div class="row">
                                        <div class="col-md-6">
                                            <div class="alert alert-info">
                                                <h6><i class="bi bi-people"></i> ग्राहक शुरुआती बैलेंस</h6>
                                                <p class="stat-number mb-0 <?php echo $total_opening_balance >= 0 ? 'positive' : 'negative'; ?>">
                                                    ₹<?php echo number_format($total_opening_balance, 2); ?>
                                                </p>
                                                <small>
                                                    <?php echo date('d/m/Y', strtotime($start_date)); ?> से पहले का बैलेंस<br>
                                                    (शुरुआती + पिछली लेनदेन)
                                                </small>
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="alert alert-warning">
                                                <h6><i class="bi bi-person-badge"></i> कर्मचारी शुरुआती बैलेंस</h6>
                                                <p class="stat-number mb-0 <?php echo ($total_salary_payable - $total_advance_given) >= 0 ? 'positive' : 'negative'; ?>">
                                                    ₹<?php echo number_format($total_salary_payable - $total_advance_given, 2); ?>
                                                </p>
                                                <small>
                                                    कर्मचारियों का शेष बैलेंस<br>
                                                    (वेतन देय - अडवांस)
                                                </small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Income Summary -->
                        <div class="col-md-6">
                            <div class="card report-card mb-4">
                                <div class="card-header bg-info text-white">
                                    <h5 class="mb-0"><i class="bi bi-arrow-up-circle"></i> इस अवधि में आय</h5>
                                </div>
                                <div class="card-body">
                                    <?php 
                                    $total_income = 0;
                                    if (!empty($reports['income_summary'])) {
                                        foreach($reports['income_summary'] as $income):
                                            $total_income += $income['amount'];
                                        endforeach;
                                    }
                                    ?>
                                    
                                    <?php if ($total_income == 0): ?>
                                        <div class="alert alert-info text-center">
                                            <i class="bi bi-info-circle"></i> इस अवधि में कोई आय नहीं हुई है।
                                        </div>
                                    <?php else: ?>
                                        <table class="table">
                                            <tbody>
                                                <?php foreach($reports['income_summary'] as $income): ?>
                                                <tr>
                                                    <td><?php echo $income['description']; ?></td>
                                                    <td class="text-end positive">₹<?php echo number_format($income['amount'], 2); ?></td>
                                                </tr>
                                                <?php endforeach; ?>
                                                <tr class="table-success">
                                                    <td><strong>कुल आय (इस अवधि)</strong></td>
                                                    <td class="text-end"><strong>₹<?php echo number_format($total_income, 2); ?></strong></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    <?php endif; ?>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Expense Summary -->
                        <div class="col-md-6">
                            <div class="card report-card mb-4">
                                <div class="card-header bg-danger text-white">
                                    <h5 class="mb-0"><i class="bi bi-arrow-down-circle"></i> इस अवधि में व्यय</h5>
                                </div>
                                <div class="card-body">
                                    <?php 
                                    $total_expenses = 0;
                                    if (!empty($reports['expense_summary'])) {
                                        foreach($reports['expense_summary'] as $expense):
                                            $total_expenses += $expense['amount'];
                                        endforeach;
                                    }
                                    ?>
                                    
                                    <?php if ($total_expenses == 0): ?>
                                        <div class="alert alert-info text-center">
                                            <i class="bi bi-info-circle"></i> इस अवधि में कोई व्यय नहीं हुआ है।
                                        </div>
                                    <?php else: ?>
                                        <table class="table">
                                            <tbody>
                                                <?php foreach($reports['expense_summary'] as $expense): ?>
                                                <tr>
                                                    <td><?php echo $expense['expense_category']; ?></td>
                                                    <td class="text-end negative">₹<?php echo number_format($expense['amount'], 2); ?></td>
                                                </tr>
                                                <?php endforeach; ?>
                                                <tr class="table-danger">
                                                    <td><strong>कुल व्यय (इस अवधि)</strong></td>
                                                    <td class="text-end"><strong>₹<?php echo number_format($total_expenses, 2); ?></strong></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    <?php endif; ?>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Financial Summary Card -->
                    <div class="card report-card mb-4">
                        <div class="card-header bg-dark text-white">
                            <h5 class="mb-0"><i class="bi bi-pie-chart"></i> कुल वित्तीय सारांश (कैरी फॉरवर्ड सहित)</h5>
                        </div>
                        <div class="card-body">
                            <div class="row text-center">
                                <div class="col-md-3">
                                    <div class="p-3 border rounded bg-light">
                                        <h6>शुरुआती बैलेंस</h6>
                                        <h4 class="<?php echo $total_opening_balance >= 0 ? 'text-success' : 'text-danger'; ?>">
                                            ₹<?php echo number_format($total_opening_balance, 2); ?>
                                        </h4>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="p-3 border rounded bg-light">
                                        <h6>इस अवधि में आय</h6>
                                        <h4 class="text-success">₹<?php echo number_format($total_income, 2); ?></h4>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="p-3 border rounded bg-light">
                                        <h6>इस अवधि में व्यय</h6>
                                        <h4 class="text-danger">₹<?php echo number_format($total_expenses, 2); ?></h4>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="p-3 border rounded bg-light">
                                        <h6>कुल संचित बैलेंस</h6>
                                        <h4 class="<?php echo ($total_opening_balance + $net_income) >= 0 ? 'text-success' : 'text-danger'; ?>">
                                            ₹<?php echo number_format($total_opening_balance + $net_income, 2); ?>
                                        </h4>
                                    </div>
                                </div>
                            </div>
                            <?php if (($total_opening_balance + $total_income) > 0): ?>
                            <div class="mt-3">
                                <div class="progress" style="height: 25px;">
                                    <?php if ($total_opening_balance > 0): ?>
                                    <div class="progress-bar bg-secondary" role="progressbar" 
                                         style="width: <?php echo abs($total_opening_balance) / (abs($total_opening_balance) + $total_income) * 100; ?>%">
                                        शुरुआती: <?php echo number_format(abs($total_opening_balance) / (abs($total_opening_balance) + $total_income) * 100, 1); ?>%
                                    </div>
                                    <?php endif; ?>
                                    <div class="progress-bar bg-success" role="progressbar" 
                                         style="width: <?php echo ($total_income - $total_expenses) / (abs($total_opening_balance) + $total_income) * 100; ?>%">
                                        शुद्ध आय: <?php echo number_format(($total_income - $total_expenses) / (abs($total_opening_balance) + $total_income) * 100, 1); ?>%
                                    </div>
                                    <div class="progress-bar bg-danger" role="progressbar" 
                                         style="width: <?php echo $total_expenses / (abs($total_opening_balance) + $total_income) * 100; ?>%">
                                        व्यय: <?php echo number_format($total_expenses / (abs($total_opening_balance) + $total_income) * 100, 1); ?>%
                                    </div>
                                </div>
                            </div>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
                
                <!-- Employees Tab -->
                <div class="tab-pane fade" id="employees" role="tabpanel">
                    <h4 class="mb-3">
                        <i class="bi bi-person-badge"></i> कर्मचारी/तकनीशियन रिपोर्ट
                        <small class="text-muted">
                            (<?php echo date('d/m/Y', strtotime($start_date)); ?> से <?php echo date('d/m/Y', strtotime($end_date)); ?>)
                        </small>
                        <span class="info-badge float-end">बैलेंस कैरी फॉरवर्ड</span>
                    </h4>
                    
                    <div class="card report-card">
                        <div class="card-header bg-dark text-white">
                            <h5 class="mb-0">
                                <i class="bi bi-person-badge"></i> तकनीशियन/मैकेनिक लेजर
                                <span class="float-end badge bg-light text-dark">
                                    <?php echo count($reports['mechanic_ledger']); ?> तकनीशियन
                                </span>
                            </h5>
                        </div>
                        <div class="card-body">
                            <?php if (empty($reports['mechanic_ledger'])): ?>
                                <div class="alert alert-info text-center">
                                    <i class="bi bi-info-circle"></i> कोई तकनीशियन डेटा उपलब्ध नहीं है।
                                </div>
                            <?php else: ?>
                                <div class="alert alert-info">
                                    <i class="bi bi-info-circle"></i> 
                                    <strong>कुल वेतन देय:</strong> <?php echo date('d/m/Y', strtotime($end_date)); ?> तक का कुल वेतन<br>
                                    <strong>शेष राशि:</strong> कुल वेतन देय - कुल अडवांस
                                </div>
                                <div class="table-container">
                                    <table class="table table-hover table-sm">
                                        <thead class="sticky-header">
                                            <tr>
                                                <th>तकनीशियन</th>
                                                <th>दैनिक<br>वेतन</th>
                                                <th>कुल<br>अडवांस</th>
                                                <th>इस अवधि में<br>अडवांस</th>
                                                <th>कुल<br>उपस्थिति</th>
                                                <th>इस अवधि में<br>उपस्थिति</th>
                                                <th>कुल वेतन<br>देय</th>
                                                <th>शेष<br>राशि</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <?php 
                                            $total_advance_all = 0;
                                            $total_advance_period = 0;
                                            $total_days_all = 0;
                                            $total_days_period = 0;
                                            $total_salary_all = 0;
                                            $total_balance_all = 0;
                                            ?>
                                            <?php foreach($reports['mechanic_ledger'] as $mechanic): ?>
                                                <?php 
                                                    $total_advance_all += $mechanic['total_advance_amount'];
                                                    $total_advance_period += $mechanic['advance_in_period'];
                                                    $total_days_all += $mechanic['total_attendance_days'];
                                                    $total_days_period += $mechanic['attendance_in_period'];
                                                    $total_salary_all += $mechanic['total_salary_due'];
                                                    $total_balance_all += $mechanic['balance_amount'];
                                                ?>
                                                <tr>
                                                    <td><strong><?php echo $mechanic['mechanic_name']; ?></strong></td>
                                                    <td>₹<?php echo number_format($mechanic['daily_salary'], 2); ?></td>
                                                    <td class="negative">₹<?php echo number_format($mechanic['total_advance_amount'], 2); ?></td>
                                                    <td class="negative">
                                                        <span class="badge bg-warning">₹<?php echo number_format($mechanic['advance_in_period'], 2); ?></span>
                                                    </td>
                                                    <td><span class="badge bg-info"><?php echo $mechanic['total_attendance_days']; ?></span></td>
                                                    <td><span class="badge bg-success"><?php echo $mechanic['attendance_in_period']; ?></span></td>
                                                    <td class="positive">₹<?php echo number_format($mechanic['total_salary_due'], 2); ?></td>
                                                    <td class="<?php echo $mechanic['balance_amount'] >= 0 ? 'positive' : 'negative'; ?>">
                                                        ₹<?php echo number_format($mechanic['balance_amount'], 2); ?>
                                                    </td>
                                                </tr>
                                            <?php endforeach; ?>
                                            <!-- Totals Row -->
                                            <tr class="table-dark">
                                                <td><strong>कुल:</strong></td>
                                                <td><strong>-</strong></td>
                                                <td class="negative"><strong>₹<?php echo number_format($total_advance_all, 2); ?></strong></td>
                                                <td class="negative">
                                                    <strong><span class="badge bg-warning">₹<?php echo number_format($total_advance_period, 2); ?></span></strong>
                                                </td>
                                                <td><strong><span class="badge bg-info"><?php echo $total_days_all; ?></span></strong></td>
                                                <td><strong><span class="badge bg-success"><?php echo $total_days_period; ?></span></strong></td>
                                                <td class="positive"><strong>₹<?php echo number_format($total_salary_all, 2); ?></strong></td>
                                                <td class="<?php echo $total_balance_all >= 0 ? 'positive' : 'negative'; ?>">
                                                    <strong>₹<?php echo number_format($total_balance_all, 2); ?></strong>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="mt-3 alert alert-warning">
                                    <small>
                                        <i class="bi bi-info-circle"></i> 
                                        <strong>नोट:</strong> शेष राशि = (कुल वेतन देय - कुल अडवांस)<br>
                                        सकारात्मक शेष = हमें देना है | नकारात्मक शेष = तकनीशियन को देना है
                                    </small>
                                </div>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
                
                <!-- Loans Tab -->
                <div class="tab-pane fade" id="loans" role="tabpanel">
                    <h4 class="mb-3">
                        <i class="bi bi-bank"></i> लोन/उधार रिपोर्ट
                        <small class="text-muted">
                            (<?php echo date('d/m/Y', strtotime($start_date)); ?> से <?php echo date('d/m/Y', strtotime($end_date)); ?>)
                        </small>
                        <span class="info-badge float-end">बैलेंस कैरी फॉरवर्ड</span>
                    </h4>
                    
                    <div class="card report-card">
                        <div class="card-header bg-warning">
                            <h5 class="mb-0">
                                <i class="bi bi-bank"></i> लोन/उधार लेजर
                                <span class="float-end badge bg-light text-dark">
                                    <?php echo count($reports['loan_ledger']); ?> लोन
                                </span>
                            </h5>
                        </div>
                        <div class="card-body">
                            <?php if (empty($reports['loan_ledger'])): ?>
                                <div class="alert alert-info text-center">
                                    <i class="bi bi-info-circle"></i> कोई लोन डेटा उपलब्ध नहीं है।
                                </div>
                            <?php else: ?>
                                <div class="alert alert-info">
                                    <i class="bi bi-info-circle"></i> 
                                    <strong>कुल भुगतान:</strong> <?php echo date('d/m/Y', strtotime($end_date)); ?> तक का कुल भुगतान<br>
                                    <strong>शेष राशि:</strong> उधार राशि - कुल भुगतान
                                </div>
                                <div class="table-container">
                                    <table class="table table-hover table-sm">
                                        <thead class="sticky-header">
                                            <tr>
                                                <th>उधारदाता</th>
                                                <th>उधार<br>राशि</th>
                                                <th>ब्याज<br>दर %</th>
                                                <th>मासिक<br>किस्त</th>
                                                <th>शुरू<br>तारीख</th>
                                                <th>पिछला<br>भुगतान</th>
                                                <th>इस अवधि में<br>भुगतान</th>
                                                <th>कुल<br>भुगतान</th>
                                                <th>शेष<br>राशि</th>
                                                <th>शेष<br>EMI</th>
                                                <th>स्थिति</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <?php 
                                            $total_loan_amount = 0;
                                            $total_loan_previous = 0;
                                            $total_loan_paid = 0;
                                            $total_loan_balance = 0;
                                            $total_remaining_emis = 0;
                                            ?>
                                            <?php foreach($reports['loan_ledger'] as $loan): ?>
                                                <?php 
                                                    $total_loan_amount += $loan['loan_amount'];
                                                    $total_loan_previous += $loan['previous_payments'];
                                                    $total_loan_paid += $loan['total_paid'];
                                                    $total_loan_balance += $loan['balance_amount'];
                                                    $total_remaining_emis += $loan['remaining_emis'];
                                                ?>
                                                <tr>
                                                    <td><strong><?php echo $loan['lender_name']; ?></strong></td>
                                                    <td>₹<?php echo number_format($loan['loan_amount'], 2); ?></td>
                                                    <td><?php echo $loan['interest_rate']; ?>%</td>
                                                    <td>₹<?php echo number_format($loan['emi_amount'], 2); ?></td>
                                                    <td><?php echo $loan['start_date']; ?></td>
                                                    <td class="positive">₹<?php echo number_format($loan['previous_payments'], 2); ?></td>
                                                    <td class="positive">
                                                        <span class="badge bg-success">₹<?php echo number_format($loan['paid_in_period'], 2); ?></span>
                                                    </td>
                                                    <td class="positive">₹<?php echo number_format($loan['total_paid'], 2); ?></td>
                                                    <td class="<?php echo $loan['balance_amount'] > 0 ? 'negative' : 'positive'; ?>">
                                                        ₹<?php echo number_format($loan['balance_amount'], 2); ?>
                                                    </td>
                                                    <td>
                                                        <span class="badge bg-warning"><?php echo $loan['remaining_emis']; ?></span>
                                                    </td>
                                                    <td>
                                                        <span class="badge <?php echo $loan['status'] == 'सक्रिय' ? 'bg-warning' : 'bg-success'; ?>">
                                                            <?php echo $loan['status']; ?>
                                                        </span>
                                                    </td>
                                                </tr>
                                            <?php endforeach; ?>
                                            <!-- Totals Row -->
                                            <tr class="table-dark">
                                                <td><strong>कुल:</strong></td>
                                                <td><strong>₹<?php echo number_format($total_loan_amount, 2); ?></strong></td>
                                                <td><strong>-</strong></td>
                                                <td><strong>-</strong></td>
                                                <td><strong>-</strong></td>
                                                <td class="positive"><strong>₹<?php echo number_format($total_loan_previous, 2); ?></strong></td>
                                                <td class="positive">
                                                    <strong><span class="badge bg-success">₹<?php echo number_format($total_loan_paid - $total_loan_previous, 2); ?></span></strong>
                                                </td>
                                                <td class="positive"><strong>₹<?php echo number_format($total_loan_paid, 2); ?></strong></td>
                                                <td class="<?php echo $total_loan_balance > 0 ? 'negative' : 'positive'; ?>">
                                                    <strong>₹<?php echo number_format($total_loan_balance, 2); ?></strong>
                                                </td>
                                                <td>
                                                    <strong><span class="badge bg-warning"><?php echo $total_remaining_emis; ?></span></strong>
                                                </td>
                                                <td><strong>-</strong></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="mt-3">
                                    <div class="alert alert-info">
                                        <h6><i class="bi bi-calculator"></i> लोन विश्लेषण</h6>
                                        <small>
                                            कुल उधार राशि: ₹<?php echo number_format($total_loan_amount, 2); ?><br>
                                            पिछला भुगतान: ₹<?php echo number_format($total_loan_previous, 2); ?><br>
                                            इस अवधि में भुगतान: ₹<?php echo number_format($total_loan_paid - $total_loan_previous, 2); ?><br>
                                            कुल भुगतान: ₹<?php echo number_format($total_loan_paid, 2); ?><br>
                                            शेष राशि: ₹<?php echo number_format($total_loan_balance, 2); ?><br>
                                            भुगतान प्रतिशत: <?php echo $total_loan_amount > 0 ? number_format($total_loan_paid / $total_loan_amount * 100, 2) : '0'; ?>%<br>
                                            शेष EMI: <?php echo $total_remaining_emis; ?>
                                        </small>
                                    </div>
                                </div>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
                
                <!-- Monthly Summary Tab -->
                <div class="tab-pane fade" id="monthly" role="tabpanel">
                    <h4 class="mb-3">
                        <i class="bi bi-calendar-month"></i> मासिक लेन-देन सारांश
                        <small class="text-muted">
                            (<?php echo date('d/m/Y', strtotime($start_date)); ?> से <?php echo date('d/m/Y', strtotime($end_date)); ?>)
                        </small>
                    </h4>
                    
                    <div class="card report-card mb-4">
                        <div class="card-header bg-secondary text-white">
                            <h5 class="mb-0"><i class="bi bi-calendar-month"></i> मासिक लेन-देन सारांश</h5>
                        </div>
                        <div class="card-body">
                            <?php if (empty($reports['monthly_summary'])): ?>
                                <div class="alert alert-info text-center">
                                    <i class="bi bi-info-circle"></i> इस अवधि में कोई लेनदेन नहीं हुआ है।
                                </div>
                            <?php else: ?>
                                <div class="table-container">
                                    <table class="table table-hover table-sm">
                                        <thead class="sticky-header">
                                            <tr>
                                                <th>महीना</th>
                                                <th>कुल जॉब</th>
                                                <th>रिपेयर आय</th>
                                                <th>कुल ग्राहक</th>
                                                <th>कुल व्यय</th>
                                                <th>शुद्ध आय</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <?php 
                                            $monthly_total_jobs = 0;
                                            $monthly_total_income = 0;
                                            $monthly_total_customers = 0;
                                            $monthly_total_expenses = 0;
                                            $monthly_total_net = 0;
                                            ?>
                                            <?php foreach($reports['monthly_summary'] as $monthly): ?>
                                                <?php 
                                                    $net_income_monthly = $monthly['repair_income'] - $monthly['total_expenses'];
                                                    
                                                    $monthly_total_jobs += $monthly['total_jobs'];
                                                    $monthly_total_income += $monthly['repair_income'];
                                                    $monthly_total_customers += $monthly['total_customers'];
                                                    $monthly_total_expenses += $monthly['total_expenses'];
                                                    $monthly_total_net += $net_income_monthly;
                                                ?>
                                                <tr>
                                                    <td><strong><?php echo $monthly['month']; ?></strong></td>
                                                    <td><span class="badge bg-primary"><?php echo $monthly['total_jobs']; ?></span></td>
                                                    <td class="positive">₹<?php echo number_format($monthly['repair_income'], 2); ?></td>
                                                    <td><span class="badge bg-info"><?php echo $monthly['total_customers']; ?></span></td>
                                                    <td class="negative">₹<?php echo number_format($monthly['total_expenses'], 2); ?></td>
                                                    <td class="<?php echo $net_income_monthly >= 0 ? 'positive' : 'negative'; ?>">
                                                        ₹<?php echo number_format($net_income_monthly, 2); ?>
                                                    </td>
                                                </tr>
                                            <?php endforeach; ?>
                                            <!-- Totals Row -->
                                            <tr class="table-dark">
                                                <td><strong>कुल:</strong></td>
                                                <td><strong><span class="badge bg-primary"><?php echo $monthly_total_jobs; ?></span></strong></td>
                                                <td class="positive"><strong>₹<?php echo number_format($monthly_total_income, 2); ?></strong></td>
                                                <td><strong><span class="badge bg-info"><?php echo $monthly_total_customers; ?></span></strong></td>
                                                <td class="negative"><strong>₹<?php echo number_format($monthly_total_expenses, 2); ?></strong></td>
                                                <td class="<?php echo $monthly_total_net >= 0 ? 'positive' : 'negative'; ?>">
                                                    <strong>₹<?php echo number_format($monthly_total_net, 2); ?></strong>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="mt-5 mb-4 text-center">
            <hr>
            <p class="text-muted">
                <i class="bi bi-clock"></i> रिपोर्ट जनरेट समय: <?php echo date('d-m-Y H:i:s'); ?> |
                <i class="bi bi-database"></i> डेटाबेस: <?php echo $dbname; ?> |
                <i class="bi bi-funnel"></i> फिल्टर: 
                <?php 
                if ($filter_type == 'monthly') {
                    echo isset($month_names[$filter_month_int]) ? $month_names[$filter_month_int] . " $filter_year" : $filter_month . " $filter_year";
                } elseif ($filter_type == 'yearly') {
                    echo "वर्ष $filter_year";
                } else {
                    echo date('d/m/Y', strtotime($start_date)) . " से " . date('d/m/Y', strtotime($end_date));
                }
                ?>
                |
                <i class="bi bi-info-circle"></i> बैलेंस कैरी फॉरवर्ड: हाँ
            </p>
            <div class="btn-group" role="group">
                <button onclick="window.print()" class="btn btn-primary">
                    <i class="bi bi-printer"></i> प्रिंट रिपोर्ट
                </button>
                <button onclick="location.reload()" class="btn btn-success">
                    <i class="bi bi-arrow-clockwise"></i> रिफ्रेश करें
                </button>
                <a href="?page=reports/balancesheet&reset=1" class="btn btn-danger">
                    <i class="bi bi-x-circle"></i> सभी फिल्टर रीसेट
                </a>
                <a href="?page=reports/balancesheet&year=<?php echo $current_year; ?>&month=<?php echo $current_month; ?>&filter_type=monthly" 
                   class="btn btn-info">
                    <i class="bi bi-calendar-check"></i> वर्तमान महीना
                </a>
            </div>
            
            <!-- Export Options -->
            <div class="mt-3">
                <div class="btn-group" role="group">
                    <button type="button" class="btn btn-outline-secondary btn-sm" onclick="exportData('pdf')">
                        <i class="bi bi-file-pdf"></i> PDF
                    </button>
                    <button type="button" class="btn btn-outline-secondary btn-sm" onclick="exportData('excel')">
                        <i class="bi bi-file-excel"></i> Excel
                    </button>
                    <button type="button" class="btn btn-outline-secondary btn-sm" onclick="exportData('csv')">
                        <i class="bi bi-file-text"></i> CSV
                    </button>
                    <button type="button" class="btn btn-outline-secondary btn-sm" onclick="copyToClipboard()">
                        <i class="bi bi-clipboard"></i> कॉपी
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
    <script>
        // Initialize date pickers
        if (document.getElementById('start_date')) {
            flatpickr("#start_date", {
                dateFormat: "Y-m-d",
                maxDate: "today"
            });
        }
        
        if (document.getElementById('end_date')) {
            flatpickr("#end_date", {
                dateFormat: "Y-m-d",
                maxDate: "today"
            });
        }

        // Auto-refresh every 15 minutes
        setTimeout(function() {
            if(confirm('रिपोर्ट को रिफ्रेश करें? नई डेटा दिखाई देगी।')) {
                window.location.reload();
            }
        }, 900000); // 15 minutes

        // Export functions
        function exportData(type) {
            let url = window.location.href;
            let exportUrl = url + (url.includes('?') ? '&' : '?') + 'export=' + type;
            
            if (type === 'pdf') {
                window.open(exportUrl, '_blank');
            } else if (type === 'excel' || type === 'csv') {
                // For Excel/CSV, you would typically make an AJAX call
                alert(type.toUpperCase() + ' एक्सपोर्ट की सुविधा जल्द ही उपलब्ध होगी।');
            }
        }

        function copyToClipboard() {
            // Copy summary data to clipboard
            let text = `व्यापार रिपोर्ट - ${document.title}\n`;
            text += `अवधि: ${document.querySelector('.date-range-display').textContent}\n`;
            text += `बैलेंस कैरी फॉरवर्ड: हाँ\n\n`;
            
            // Add dashboard stats
            const stats = document.querySelectorAll('.stat-number');
            stats.forEach((stat, index) => {
                const title = stat.closest('.card').querySelector('.card-title').textContent.trim();
                text += `${title}: ${stat.textContent.trim()}\n`;
            });
            
            navigator.clipboard.writeText(text).then(() => {
                alert('सारांश क्लिपबोर्ड में कॉपी किया गया!');
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            // Ctrl + P for print
            if (e.ctrlKey && e.key === 'p') {
                e.preventDefault();
                window.print();
            }
            // Ctrl + R for refresh
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                location.reload();
            }
            // Ctrl + F for filter focus
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                document.querySelector('#filter_type').focus();
            }
        });

        // Tab persistence
        document.addEventListener('DOMContentLoaded', function() {
            // Store active tab in localStorage
            const tabEls = document.querySelectorAll('button[data-bs-toggle="tab"]');
            tabEls.forEach(tab => {
                tab.addEventListener('shown.bs.tab', function (event) {
                    localStorage.setItem('activeTab', event.target.getAttribute('data-bs-target'));
                });
            });

            // Get active tab from localStorage
            const activeTab = localStorage.getItem('activeTab');
            if (activeTab) {
                const tabTrigger = new bootstrap.Tab(document.querySelector(`[data-bs-target="${activeTab}"]`));
                tabTrigger.show();
            }

            // Update URL with tab hash
            const tabButtons = document.querySelectorAll('.nav-tabs button');
            tabButtons.forEach(button => {
                button.addEventListener('click', function() {
                    const tabId = this.getAttribute('data-bs-target').substring(1);
                    history.replaceState(null, null, '#' + tabId);
                });
            });

            // Check for hash in URL
            if (window.location.hash) {
                const hash = window.location.hash;
                const tabButton = document.querySelector(`[data-bs-target="${hash}"]`);
                if (tabButton) {
                    const tab = new bootstrap.Tab(tabButton);
                    tab.show();
                }
            }
        });
    </script>
</body>
</html>