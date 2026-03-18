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

// Check for detailed ledger request
if (isset($_GET['client_id'])) {
    $client_id = intval($_GET['client_id']);
    // Fetch client data
    $clientSQL = "
        SELECT 
            CONCAT(firstname, ' ', COALESCE(middlename, ''), ' ', lastname) as customer_name" .
            (!empty($columnExists) ? ", opening_balance" : "") . "
        FROM client_list 
        WHERE id = $client_id
    ";
    $client_data = executeQuery($conn, $clientSQL);
    if (!empty($client_data)) {
        $client_data = $client_data[0];
        $reports['client_name'] = $client_data['customer_name'];
        $opening_balance = !empty($columnExists) ? (float)$client_data['opening_balance'] : 0;

        // Fetch full history (no date filter for full ledger)
        $detailedLedgerSQL = "
            SELECT 
                event_date,
                description,
                debit,
                credit
            FROM (
                SELECT 
                    date_created as event_date,
                    CONCAT('Repair Transaction ID: ', id) as description,
                    amount as debit,
                    0 as credit
                FROM transaction_list
                WHERE client_name = $client_id AND status IN (3,5)
                UNION ALL
                SELECT 
                    payment_date as event_date,
                    CONCAT('Payment ID: ', id, ' - ', payment_method) as description,
                    0 as debit,
                    amount as credit
                FROM client_payments
                WHERE client_id = $client_id
            ) as events
            ORDER BY event_date ASC
        ";
        $detailed_entries = executeQuery($conn, $detailedLedgerSQL);

        // Prepare ledger with running balance
        $ledger = [];
        $running_balance = $opening_balance;

        // Add opening balance if non-zero
        if ($opening_balance != 0) {
            $ledger[] = [
                'event_date' => 'Opening',
                'description' => 'Opening Balance',
                'debit' => $opening_balance > 0 ? $opening_balance : 0,
                'credit' => $opening_balance < 0 ? abs($opening_balance) : 0,
                'balance' => $opening_balance
            ];
        }

        foreach ($detailed_entries as $entry) {
            $running_balance += $entry['debit'] - $entry['credit'];
            $entry['balance'] = $running_balance;
            $ledger[] = $entry;
        }

        $reports['detailed_ledger'] = $ledger;
    }
}

// 2. Technician/Mechanic Ledger - With Date Filter and Carry Forward (Corrected for half-days)
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
        
        -- Total Days Worked (including before period)
        COALESCE((SELECT SUM(CASE WHEN al.status = 1 THEN 1 WHEN al.status = 3 THEN 0.5 ELSE 0 END) 
         FROM attendance_list al 
         WHERE al.mechanic_id = m.id 
         AND al.curr_date <= '$end_date'), 0) as 'total_days_worked',
        
        -- Days Worked in selected period only
        COALESCE((SELECT SUM(CASE WHEN al.status = 1 THEN 1 WHEN al.status = 3 THEN 0.5 ELSE 0 END) 
         FROM attendance_list al 
         WHERE al.mechanic_id = m.id 
         AND al.curr_date BETWEEN '$start_date' AND '$end_date'), 0) as 'days_worked_in_period',
        
        -- Total Salary Due (including before period)
        (COALESCE((SELECT SUM(CASE WHEN al.status = 1 THEN 1 WHEN al.status = 3 THEN 0.5 ELSE 0 END) 
          FROM attendance_list al 
          WHERE al.mechanic_id = m.id 
          AND al.curr_date <= '$end_date'), 0) * m.daily_salary) as 'total_salary_due',
        
        -- Salary Due in selected period only
        (COALESCE((SELECT SUM(CASE WHEN al.status = 1 THEN 1 WHEN al.status = 3 THEN 0.5 ELSE 0 END) 
          FROM attendance_list al 
          WHERE al.mechanic_id = m.id 
          AND al.curr_date BETWEEN '$start_date' AND '$end_date'), 0) * m.daily_salary) as 'salary_due_in_period',
        
        -- Balance Amount (including carry forward)
        ((COALESCE((SELECT SUM(CASE WHEN al.status = 1 THEN 1 WHEN al.status = 3 THEN 0.5 ELSE 0 END) 
           FROM attendance_list al 
           WHERE al.mechanic_id = m.id 
           AND al.curr_date <= '$end_date'), 0) * m.daily_salary) 
         - COALESCE((SELECT SUM(a.amount) FROM advance_payments a WHERE a.mechanic_id = m.id
          AND a.date_paid <= '$end_date'), 0)) as 'balance_amount'
    FROM mechanic_list m
    WHERE m.delete_flag = 0
    HAVING (balance_amount != 0 OR days_worked_in_period > 0)
";
$reports['mechanic_ledger'] = executeQuery($conn, $mechanicLedgerSQL);

// 3. Stock Inventory Summary (Corrected for repair products)
$stockInventorySQL = "
    SELECT 
        p.id as 'product_id',
        p.name as 'product_name',
        p.description as 'description',
        p.price as 'sale_price',
        COALESCE(SUM(i.quantity), 0) as 'total_stock_in',
        COALESCE((SELECT SUM(dsi.qty) 
         FROM direct_sale_items dsi 
         JOIN direct_sales ds ON ds.id = dsi.sale_id
         WHERE dsi.product_id = p.id
         AND ds.date_created BETWEEN '$start_date' AND '$end_date'), 0) +
        COALESCE((SELECT SUM(tp.qty) 
         FROM transaction_products tp 
         JOIN transaction_list tl ON tl.id = tp.transaction_id
         WHERE tp.product_id = p.id
         AND tl.status IN (3,5)
         AND tl.date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'sold_quantity',
        (COALESCE(SUM(i.quantity), 0) 
         - COALESCE((SELECT SUM(dsi.qty) 
          FROM direct_sale_items dsi 
          JOIN direct_sales ds ON ds.id = dsi.sale_id
          WHERE dsi.product_id = p.id), 0)
         - COALESCE((SELECT SUM(tp.qty) 
          FROM transaction_products tp 
          JOIN transaction_list tl ON tl.id = tp.transaction_id
          WHERE tp.product_id = p.id
          AND tl.status IN (3,5)), 0)) as 'remaining_stock',
        ((COALESCE(SUM(i.quantity), 0) 
         - COALESCE((SELECT SUM(dsi.qty) 
          FROM direct_sale_items dsi 
          JOIN direct_sales ds ON ds.id = dsi.sale_id
          WHERE dsi.product_id = p.id), 0)
         - COALESCE((SELECT SUM(tp.qty) 
          FROM transaction_products tp 
          JOIN transaction_list tl ON tl.id = tp.transaction_id
          WHERE tp.product_id = p.id
          AND tl.status IN (3,5)), 0)) * p.price) as 'stock_value'
    FROM product_list p
    LEFT JOIN inventory_list i ON i.product_id = p.id
    WHERE p.delete_flag = 0
    GROUP BY p.id, p.name, p.description, p.price
    HAVING (sold_quantity > 0 OR total_stock_in > 0)
    ORDER BY sold_quantity DESC, total_stock_in DESC
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

// 6. Monthly Transaction Summary - With Date Filter (Added direct_income)
$monthlySummarySQL = "
    SELECT 
        DATE_FORMAT(t.date_created, '%Y-%m') as 'month',
        COUNT(t.id) as 'total_jobs',
        COALESCE(SUM(CASE WHEN t.status IN (3,5) THEN t.amount ELSE 0 END), 0) as 'repair_income',
        COUNT(DISTINCT t.client_name) as 'total_customers',
        COALESCE((SELECT SUM(e.amount) 
         FROM expense_list e 
         WHERE DATE_FORMAT(e.date_created, '%Y-%m') = DATE_FORMAT(t.date_created, '%Y-%m')
         AND e.date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'total_expenses',
        COALESCE((SELECT SUM(ds.total_amount) 
         FROM direct_sales ds 
         WHERE DATE_FORMAT(ds.date_created, '%Y-%m') = DATE_FORMAT(t.date_created, '%Y-%m')
         AND ds.date_created BETWEEN '$start_date' AND '$end_date'), 0) as 'direct_income'
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

// 8. Loan Ledger (Assuming this exists from original, if not, add your SQL here)
$loanLedgerSQL = "
    SELECT 
        l.id as 'lender_id',
        l.name as 'lender_name',
        l.loan_amount as 'loan_amount',
        l.interest_rate as 'interest_rate',
        l.emi_amount as 'emi_amount',
        l.start_date as 'start_date',
        -- Previous payments
        COALESCE((SELECT SUM(lp.amount) 
         FROM loan_payments lp 
         WHERE lp.lender_id = l.id
         AND lp.payment_date < '$start_date'), 0) as 'previous_payments',
        
        -- Paid in period
        COALESCE((SELECT SUM(lp.amount) 
         FROM loan_payments lp 
         WHERE lp.lender_id = l.id
         AND lp.payment_date BETWEEN '$start_date' AND '$end_date'), 0) as 'paid_in_period',
        
        -- Total paid
        COALESCE((SELECT SUM(lp.amount) 
         FROM loan_payments lp 
         WHERE lp.lender_id = l.id
         AND lp.payment_date <= '$end_date'), 0) as 'total_paid',
        
        -- Balance amount
        (l.loan_amount - COALESCE((SELECT SUM(lp.amount) 
         FROM loan_payments lp 
         WHERE lp.lender_id = l.id
         AND lp.payment_date <= '$end_date'), 0)) as 'balance_amount',
        
        -- Remaining EMIs (approximate)
        CEIL((l.loan_amount - COALESCE((SELECT SUM(lp.amount) 
         FROM loan_payments lp 
         WHERE lp.lender_id = l.id
         AND lp.payment_date <= '$end_date'), 0)) / l.emi_amount) as 'remaining_emis',
        
        CASE WHEN (l.loan_amount - COALESCE((SELECT SUM(lp.amount) 
              FROM loan_payments lp 
              WHERE lp.lender_id = l.id
              AND lp.payment_date <= '$end_date'), 0)) > 0 THEN 'सक्रिय' ELSE 'समाप्त' END as 'status'
    FROM lender_list l
    WHERE l.delete_flag = 0
    HAVING balance_amount > 0 OR paid_in_period > 0
    ORDER BY balance_amount DESC
";
$reports['loan_ledger'] = executeQuery($conn, $loanLedgerSQL);

?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>व्यापार बैलेंस शीट</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.8.1/font/bootstrap-icons.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css" rel="stylesheet">
    <style>
        /* Add your styles here */
        .report-card { border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
        .positive { color: green; font-weight: bold; }
        .negative { color: red; font-weight: bold; }
        .table-container { overflow-x: auto; max-height: 600px; }
        .sticky-header th { position: sticky; top: 0; background: #f8f9fa; z-index: 10; }
        /* More styles as in original */
    </style>
</head>
<body>
    <div class="container-fluid mt-4 mb-5">
        <!-- Filter Form -->
        <div class="card mb-4">
            <div class="card-header bg-primary text-white">
                <h5 class="mb-0"><i class="bi bi-filter"></i> रिपोर्ट फिल्टर</h5>
            </div>
            <div class="card-body">
                <form method="GET" class="row g-3">
                    <input type="hidden" name="page" value="reports/balancesheet">
                    <div class="col-md-3">
                        <label class="form-label">फिल्टर प्रकार</label>
                        <select name="filter_type" id="filter_type" class="form-select" onchange="toggleFilters(this)">
                            <option value="monthly" <?php echo $filter_type == 'monthly' ? 'selected' : ''; ?>>मासिक</option>
                            <option value="yearly" <?php echo $filter_type == 'yearly' ? 'selected' : ''; ?>>वार्षिक</option>
                            <option value="custom" <?php echo $filter_type == 'custom' ? 'selected' : ''; ?>>कस्टम</option>
                        </select>
                    </div>
                    <div class="col-md-2" id="month_filter" style="<?php echo $filter_type == 'custom' ? 'display:none;' : ''; ?>">
                        <label class="form-label">महीना</label>
                        <select name="month" class="form-select">
                            <?php for($m=1; $m<=12; $m++): ?>
                                <option value="<?php echo $m; ?>" <?php echo $filter_month == $m ? 'selected' : ''; ?>><?php echo date('F', mktime(0,0,0,$m,1)); ?></option>
                            <?php endfor; ?>
                        </select>
                    </div>
                    <div class="col-md-2" id="year_filter" style="<?php echo $filter_type == 'custom' ? 'display:none;' : ''; ?>">
                        <label class="form-label">वर्ष</label>
                        <input type="number" name="year" class="form-control" value="<?php echo $filter_year; ?>" min="2020" max="<?php echo $current_year + 1; ?>">
                    </div>
                    <div class="col-md-3" id="custom_start" style="<?php echo $filter_type != 'custom' ? 'display:none;' : ''; ?>">
                        <label class="form-label">शुरू तारीख</label>
                        <input type="date" name="start_date" id="start_date" class="form-control" value="<?php echo $start_date; ?>">
                    </div>
                    <div class="col-md-3" id="custom_end" style="<?php echo $filter_type != 'custom' ? 'display:none;' : ''; ?>">
                        <label class="form-label">अंत तारीख</label>
                        <input type="date" name="end_date" id="end_date" class="form-control" value="<?php echo $end_date; ?>">
                    </div>
                    <div class="col-md-12 text-end">
                        <button type="submit" class="btn btn-primary"><i class="bi bi-funnel"></i> लागू करें</button>
                        <a href="?page=reports/balancesheet&nav=prev" class="btn btn-secondary"><i class="bi bi-arrow-left"></i> पिछला</a>
                        <a href="?page=reports/balancesheet&nav=next" class="btn btn-secondary"><i class="bi bi-arrow-right"></i> अगला</a>
                        <a href="?page=reports/balancesheet&reset=1" class="btn btn-warning"><i class="bi bi-arrow-counterclockwise"></i> रीसेट</a>
                    </div>
                </form>
            </div>
        </div>

        <!-- Dashboard Stats -->
        <?php
        // Calculate totals for dashboard
        $total_repair_income = 0;
        $total_direct_sales = 0;
        foreach($reports['income_summary'] as $income) {
            if($income['description'] == 'रिपेयर आय') $total_repair_income = $income['amount'];
            if($income['description'] == 'सीधी बिक्री') $total_direct_sales = $income['amount'];
        }
        $total_income = $total_repair_income + $total_direct_sales;
        
        $total_expenses = 0;
        foreach($reports['expense_summary'] as $exp) {
            $total_expenses += $exp['amount'];
        }
        
        $net_profit = $total_income - $total_expenses;
        
        $total_customers = count($reports['customer_ledger']);
        $total_stock_value = 0;
        foreach($reports['stock_inventory'] as $stock) {
            $total_stock_value += $stock['stock_value'];
        }
        
        $total_mechanic_balance = 0;
        foreach($reports['mechanic_ledger'] as $mech) {
            $total_mechanic_balance += $mech['balance_amount'];
        }
        
        $total_loan_balance = 0;
        foreach($reports['loan_ledger'] as $loan) {
            $total_loan_balance += $loan['balance_amount'];
        }
        ?>
        <div class="row mb-4">
            <div class="col-md-3">
                <div class="card text-center report-card">
                    <div class="card-body">
                        <h5 class="card-title">कुल आय</h5>
                        <p class="stat-number positive">₹<?php echo number_format($total_income, 2); ?></p>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card text-center report-card">
                    <div class="card-body">
                        <h5 class="card-title">कुल व्यय</h5>
                        <p class="stat-number negative">₹<?php echo number_format($total_expenses, 2); ?></p>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card text-center report-card">
                    <div class="card-body">
                        <h5 class="card-title">शुद्ध लाभ</h5>
                        <p class="stat-number <?php echo $net_profit >= 0 ? 'positive' : 'negative'; ?>">₹<?php echo number_format($net_profit, 2); ?></p>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card text-center report-card">
                    <div class="card-body">
                        <h5 class="card-title">स्टॉक मूल्य</h5>
                        <p class="stat-number">₹<?php echo number_format($total_stock_value, 2); ?></p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Tabs -->
        <ul class="nav nav-tabs mb-4" role="tablist">
            <li class="nav-item" role="presentation">
                <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#customer" type="button" role="tab"><i class="bi bi-people"></i> ग्राहक लेजर</button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link" data-bs-toggle="tab" data-bs-target="#mechanic" type="button" role="tab"><i class="bi bi-tools"></i> मैकेनिक लेजर</button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link" data-bs-toggle="tab" data-bs-target="#inventory" type="button" role="tab"><i class="bi bi-box-seam"></i> स्टॉक इन्वेंटरी</button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link" data-bs-toggle="tab" data-bs-target="#income" type="button" role="tab"><i class="bi bi-currency-rupee"></i> आय सारांश</button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link" data-bs-toggle="tab" data-bs-target="#expense" type="button" role="tab"><i class="bi bi-wallet"></i> व्यय सारांश</button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link" data-bs-toggle="tab" data-bs-target="#top_customers" type="button" role="tab"><i class="bi bi-star"></i> शीर्ष ग्राहक</button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link" data-bs-toggle="tab" data-bs-target="#loan" type="button" role="tab"><i class="bi bi-bank"></i> लोन लेजर</button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link" data-bs-toggle="tab" data-bs-target="#monthly" type="button" role="tab"><i class="bi bi-calendar-month"></i> मासिक सारांश</button>
            </li>
        </ul>

        <div class="tab-content">
            <!-- Customer Ledger Tab -->
            <div class="tab-pane fade show active" id="customer" role="tabpanel">
                <h4 class="mb-3">
                    <i class="bi bi-people"></i> ग्राहक व्यापार लेजर
                    <small class="text-muted date-range-display">
                        (<?php echo date('d/m/Y', strtotime($start_date)); ?> से <?php echo date('d/m/Y', strtotime($end_date)); ?>)
                    </small>
                </h4>
                
                <div class="card report-card mb-4">
                    <div class="card-header bg-info text-white">
                        <h5 class="mb-0"><i class="bi bi-people"></i> ग्राहक व्यापार लेजर</h5>
                    </div>
                    <div class="card-body">
                        <?php if (empty($reports['customer_ledger'])): ?>
                            <div class="alert alert-info text-center">
                                <i class="bi bi-info-circle"></i> इस अवधि में कोई ग्राहक लेनदेन नहीं हुआ है।
                            </div>
                        <?php else: ?>
                            <div class="table-container">
                                <table class="table table-hover table-sm">
                                    <thead class="sticky-header">
                                        <tr>
                                            <th>ग्राहक नाम</th>
                                            <th>संपर्क</th>
                                            <th>पिछला जॉब</th>
                                            <th>इस अवधि में जॉब</th>
                                            <th>पिछला बैलेंस</th>
                                            <th>इस अवधि में मरम्मत राशि</th>
                                            <th>इस अवधि में प्राप्त भुगतान</th>
                                            <th>वर्तमान बैलेंस</th>
                                            <th>क्रिया</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php 
                                        $total_opening = 0;
                                        $total_repair = 0;
                                        $total_payment = 0;
                                        $total_balance = 0;
                                        $total_prev_jobs = 0;
                                        $total_jobs = 0;
                                        $current_url = $_SERVER['REQUEST_URI'];
                                        ?>
                                        <?php foreach($reports['customer_ledger'] as $customer): ?>
                                            <?php 
                                                $total_opening += $customer['opening_balance'];
                                                $total_repair += $customer['total_repair_amount'];
                                                $total_payment += $customer['total_payment'];
                                                $total_balance += $customer['current_balance'];
                                                $total_prev_jobs += $customer['previous_transactions'];
                                                $total_jobs += ($customer['total_repair_amount'] > 0 ? 1 : 0); // Approximate jobs
                                            ?>
                                            <tr>
                                                <td><strong><?php echo $customer['customer_name']; ?></strong></td>
                                                <td><?php echo $customer['contact']; ?></td>
                                                <td><span class="badge bg-secondary"><?php echo $customer['previous_transactions']; ?></span></td>
                                                <td><span class="badge bg-primary"><?php echo $customer['total_repair_amount'] > 0 ? 1 : 0; ?></span></td> <!-- Adjust if count available -->
                                                <td class="<?php echo $customer['opening_balance'] >= 0 ? 'positive' : 'negative'; ?>">₹<?php echo number_format($customer['opening_balance'], 2); ?></td>
                                                <td class="positive">₹<?php echo number_format($customer['total_repair_amount'], 2); ?></td>
                                                <td class="positive">₹<?php echo number_format($customer['total_payment'], 2); ?></td>
                                                <td class="<?php echo $customer['current_balance'] >= 0 ? 'positive' : 'negative'; ?>">₹<?php echo number_format($customer['current_balance'], 2); ?></td>
                                                <td>
                                                    <a href="<?php echo $current_url . (strpos($current_url, '?') !== false ? '&' : '?') . 'client_id=' . $customer['client_id']; ?>" class="btn btn-sm btn-primary">विवरण देखें</a>
                                                </td>
                                            </tr>
                                        <?php endforeach; ?>
                                        <!-- Totals Row -->
                                        <tr class="table-dark">
                                            <td><strong>कुल:</strong></td>
                                            <td><strong>-</strong></td>
                                            <td><strong><span class="badge bg-secondary"><?php echo $total_prev_jobs; ?></span></strong></td>
                                            <td><strong><span class="badge bg-primary"><?php echo $total_jobs; ?></span></strong></td>
                                            <td class="<?php echo $total_opening >= 0 ? 'positive' : 'negative'; ?>"><strong>₹<?php echo number_format($total_opening, 2); ?></strong></td>
                                            <td class="positive"><strong>₹<?php echo number_format($total_repair, 2); ?></strong></td>
                                            <td class="positive"><strong>₹<?php echo number_format($total_payment, 2); ?></strong></td>
                                            <td class="<?php echo $total_balance >= 0 ? 'positive' : 'negative'; ?>"><strong>₹<?php echo number_format($total_balance, 2); ?></strong></td>
                                            <td><strong>-</strong></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div class="mt-3">
                                <div class="alert alert-info">
                                    <h6><i class="bi bi-calculator"></i> ग्राहक विश्लेषण</h6>
                                    <small>
                                        कुल ग्राहक: <?php echo $total_customers; ?><br>
                                        कुल पिछला बैलेंस: ₹<?php echo number_format($total_opening, 2); ?><br>
                                        कुल मरम्मत राशि: ₹<?php echo number_format($total_repair, 2); ?><br>
                                        कुल प्राप्त भुगतान: ₹<?php echo number_format($total_payment, 2); ?><br>
                                        कुल बैलेंस: ₹<?php echo number_format($total_balance, 2); ?><br>
                                        प्राप्ति प्रतिशत: <?php echo ($total_repair + abs($total_opening)) > 0 ? number_format($total_payment / ($total_repair + abs($total_opening)) * 100, 2) : '0'; ?>%
                                    </small>
                                </div>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>

                <?php if (isset($reports['detailed_ledger'])): ?>
                    <div class="card report-card mb-4">
                        <div class="card-header bg-primary text-white">
                            <h5 class="mb-0"><i class="bi bi-journal-text"></i> <?php echo $reports['client_name']; ?> का पूरा लेजर</h5>
                        </div>
                        <div class="card-body">
                            <?php if (empty($reports['detailed_ledger'])): ?>
                                <div class="alert alert-info text-center">
                                    <i class="bi bi-info-circle"></i> इस ग्राहक का कोई लेनदेन इतिहास नहीं है।
                                </div>
                            <?php else: ?>
                                <div class="table-container">
                                    <table class="table table-hover table-sm">
                                        <thead class="sticky-header">
                                            <tr>
                                                <th>तारीख</th>
                                                <th>विवरण</th>
                                                <th>डेबिट (मरम्मत)</th>
                                                <th>क्रेडिट (भुगतान)</th>
                                                <th>बैलेंस</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <?php foreach($reports['detailed_ledger'] as $entry): ?>
                                                <tr>
                                                    <td><?php echo $entry['event_date']; ?></td>
                                                    <td><?php echo $entry['description']; ?></td>
                                                    <td class="positive">₹<?php echo number_format($entry['debit'], 2); ?></td>
                                                    <td class="positive">₹<?php echo number_format($entry['credit'], 2); ?></td>
                                                    <td class="<?php echo $entry['balance'] >= 0 ? 'positive' : 'negative'; ?>">₹<?php echo number_format($entry['balance'], 2); ?></td>
                                                </tr>
                                            <?php endforeach; ?>
                                        </tbody>
                                    </table>
                                </div>
                            <?php endif; ?>
                            <div class="mt-3 text-end">
                                <a href="<?php echo preg_replace('/&client_id=\d+/', '', $current_url); ?>" class="btn btn-secondary">बंद करें</a>
                            </div>
                        </div>
                    </div>
                <?php endif; ?>
            </div>
            
            <!-- Mechanic Ledger Tab -->
            <div class="tab-pane fade" id="mechanic" role="tabpanel">
                <h4 class="mb-3">
                    <i class="bi bi-tools"></i> मैकेनिक/टेक्निशियन लेजर
                    <small class="text-muted">
                        (<?php echo date('d/m/Y', strtotime($start_date)); ?> से <?php echo date('d/m/Y', strtotime($end_date)); ?>)
                    </small>
                </h4>
                
                <div class="card report-card mb-4">
                    <div class="card-header bg-warning text-white">
                        <h5 class="mb-0"><i class="bi bi-tools"></i> मैकेनिक/टेक्निशियन लेजर</h5>
                    </div>
                    <div class="card-body">
                        <?php if (empty($reports['mechanic_ledger'])): ?>
                            <div class="alert alert-info text-center">
                                <i class="bi bi-info-circle"></i> इस अवधि में कोई मैकेनिक लेनदेन नहीं हुआ है।
                            </div>
                        <?php else: ?>
                            <div class="table-container">
                                <table class="table table-hover table-sm">
                                    <thead class="sticky-header">
                                        <tr>
                                            <th>मैकेनिक नाम</th>
                                            <th>दैनिक वेतन</th>
                                            <th>कमीशन %</th>
                                            <th>इस अवधि में दिन</th>
                                            <th>इस अवधि में वेतन देय</th>
                                            <th>इस अवधि में एडवांस</th>
                                            <th>कुल एडवांस</th>
                                            <th>कुल वेतन देय</th>
                                            <th>बैलेंस राशि</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php 
                                        $mech_total_days = 0;
                                        $mech_total_salary_due = 0;
                                        $mech_total_advance = 0;
                                        $mech_total_balance = 0;
                                        ?>
                                        <?php foreach($reports['mechanic_ledger'] as $mech): ?>
                                            <?php 
                                                $mech_total_days += $mech['days_worked_in_period'];
                                                $mech_total_salary_due += $mech['salary_due_in_period'];
                                                $mech_total_advance += $mech['advance_in_period'];
                                                $mech_total_balance += $mech['balance_amount'];
                                            ?>
                                            <tr>
                                                <td><strong><?php echo $mech['mechanic_name']; ?></strong></td>
                                                <td>₹<?php echo number_format($mech['daily_salary'], 2); ?></td>
                                                <td><?php echo $mech['commission_percent']; ?>%</td>
                                                <td><span class="badge bg-info"><?php echo number_format($mech['days_worked_in_period'], 1); ?></span></td>
                                                <td class="positive">₹<?php echo number_format($mech['salary_due_in_period'], 2); ?></td>
                                                <td class="negative">₹<?php echo number_format($mech['advance_in_period'], 2); ?></td>
                                                <td class="negative">₹<?php echo number_format($mech['total_advance_amount'], 2); ?></td>
                                                <td class="positive">₹<?php echo number_format($mech['total_salary_due'], 2); ?></td>
                                                <td class="<?php echo $mech['balance_amount'] >= 0 ? 'positive' : 'negative'; ?>">₹<?php echo number_format($mech['balance_amount'], 2); ?></td>
                                            </tr>
                                        <?php endforeach; ?>
                                        <!-- Totals Row -->
                                        <tr class="table-dark">
                                            <td><strong>कुल:</strong></td>
                                            <td><strong>-</strong></td>
                                            <td><strong>-</strong></td>
                                            <td><strong><span class="badge bg-info"><?php echo number_format($mech_total_days, 1); ?></span></strong></td>
                                            <td class="positive"><strong>₹<?php echo number_format($mech_total_salary_due, 2); ?></strong></td>
                                            <td class="negative"><strong>₹<?php echo number_format($mech_total_advance, 2); ?></strong></td>
                                            <td class="negative"><strong>-</strong></td>
                                            <td class="positive"><strong>-</strong></td>
                                            <td class="<?php echo $mech_total_balance >= 0 ? 'positive' : 'negative'; ?>"><strong>₹<?php echo number_format($mech_total_balance, 2); ?></strong></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
            
            <!-- Stock Inventory Tab -->
            <div class="tab-pane fade" id="inventory" role="tabpanel">
                <h4 class="mb-3">
                    <i class="bi bi-box-seam"></i> स्टॉक इन्वेंटरी सारांश
                    <small class="text-muted">
                        (<?php echo date('d/m/Y', strtotime($start_date)); ?> से <?php echo date('d/m/Y', strtotime($end_date)); ?>)
                    </small>
                </h4>
                
                <div class="card report-card mb-4">
                    <div class="card-header bg-success text-white">
                        <h5 class="mb-0"><i class="bi bi-box-seam"></i> स्टॉक इन्वेंटरी सारांश</h5>
                    </div>
                    <div class="card-body">
                        <?php if (empty($reports['stock_inventory'])): ?>
                            <div class="alert alert-info text-center">
                                <i class="bi bi-info-circle"></i> इस अवधि में कोई स्टॉक गतिविधि नहीं हुई है।
                            </div>
                        <?php else: ?>
                            <div class="table-container">
                                <table class="table table-hover table-sm">
                                    <thead class="sticky-header">
                                        <tr>
                                            <th>उत्पाद नाम</th>
                                            <th>विवरण</th>
                                            <th>बिक्री मूल्य</th>
                                            <th>कुल स्टॉक में</th>
                                            <th>इस अवधि में बेचा गया</th>
                                            <th>शेष स्टॉक</th>
                                            <th>स्टॉक मूल्य</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php 
                                        $total_stock_in = 0;
                                        $total_sold = 0;
                                        $total_remaining = 0;
                                        $total_value = 0;
                                        ?>
                                        <?php foreach($reports['stock_inventory'] as $stock): ?>
                                            <?php 
                                                $total_stock_in += $stock['total_stock_in'];
                                                $total_sold += $stock['sold_quantity'];
                                                $total_remaining += $stock['remaining_stock'];
                                                $total_value += $stock['stock_value'];
                                            ?>
                                            <tr>
                                                <td><strong><?php echo $stock['product_name']; ?></strong></td>
                                                <td><?php echo $stock['description']; ?></td>
                                                <td>₹<?php echo number_format($stock['sale_price'], 2); ?></td>
                                                <td><span class="badge bg-primary"><?php echo $stock['total_stock_in']; ?></span></td>
                                                <td><span class="badge bg-warning"><?php echo $stock['sold_quantity']; ?></span></td>
                                                <td><span class="badge bg-info"><?php echo $stock['remaining_stock']; ?></span></td>
                                                <td class="positive">₹<?php echo number_format($stock['stock_value'], 2); ?></td>
                                            </tr>
                                        <?php endforeach; ?>
                                        <!-- Totals Row -->
                                        <tr class="table-dark">
                                            <td><strong>कुल:</strong></td>
                                            <td><strong>-</strong></td>
                                            <td><strong>-</strong></td>
                                            <td><strong><span class="badge bg-primary"><?php echo $total_stock_in; ?></span></strong></td>
                                            <td><strong><span class="badge bg-warning"><?php echo $total_sold; ?></span></strong></td>
                                            <td><strong><span class="badge bg-info"><?php echo $total_remaining; ?></span></strong></td>
                                            <td class="positive"><strong>₹<?php echo number_format($total_value, 2); ?></strong></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
            
            <!-- Income Summary Tab -->
            <div class="tab-pane fade" id="income" role="tabpanel">
                <h4 class="mb-3">
                    <i class="bi bi-currency-rupee"></i> आय सारांश
                    <small class="text-muted">
                        (<?php echo date('d/m/Y', strtotime($start_date)); ?> से <?php echo date('d/m/Y', strtotime($end_date)); ?>)
                    </small>
                </h4>
                
                <div class="card report-card mb-4">
                    <div class="card-header bg-success text-white">
                        <h5 class="mb-0"><i class="bi bi-currency-rupee"></i> आय सारांश</h5>
                    </div>
                    <div class="card-body">
                        <?php if (empty($reports['income_summary'])): ?>
                            <div class="alert alert-info text-center">
                                <i class="bi bi-info-circle"></i> इस अवधि में कोई आय नहीं हुई है।
                            </div>
                        <?php else: ?>
                            <div class="table-container">
                                <table class="table table-hover table-sm">
                                    <thead class="sticky-header">
                                        <tr>
                                            <th>विवरण</th>
                                            <th>राशि</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php $total_income = 0; ?>
                                        <?php foreach($reports['income_summary'] as $income): ?>
                                            <?php $total_income += $income['amount']; ?>
                                            <tr>
                                                <td><strong><?php echo $income['description']; ?></strong></td>
                                                <td class="positive">₹<?php echo number_format($income['amount'], 2); ?></td>
                                            </tr>
                                        <?php endforeach; ?>
                                        <!-- Totals Row -->
                                        <tr class="table-dark">
                                            <td><strong>कुल आय:</strong></td>
                                            <td class="positive"><strong>₹<?php echo number_format($total_income, 2); ?></strong></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
            
            <!-- Expense Summary Tab -->
            <div class="tab-pane fade" id="expense" role="tabpanel">
                <h4 class="mb-3">
                    <i class="bi bi-wallet"></i> व्यय सारांश
                    <small class="text-muted">
                        (<?php echo date('d/m/Y', strtotime($start_date)); ?> से <?php echo date('d/m/Y', strtotime($end_date)); ?>)
                    </small>
                </h4>
                
                <div class="card report-card mb-4">
                    <div class="card-header bg-danger text-white">
                        <h5 class="mb-0"><i class="bi bi-wallet"></i> व्यय सारांश</h5>
                    </div>
                    <div class="card-body">
                        <?php if (empty($reports['expense_summary'])): ?>
                            <div class="alert alert-info text-center">
                                <i class="bi bi-info-circle"></i> इस अवधि में कोई व्यय नहीं हुआ है।
                            </div>
                        <?php else: ?>
                            <div class="table-container">
                                <table class="table table-hover table-sm">
                                    <thead class="sticky-header">
                                        <tr>
                                            <th>श्रेणी</th>
                                            <th>राशि</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php $total_exp = 0; ?>
                                        <?php foreach($reports['expense_summary'] as $exp): ?>
                                            <?php $total_exp += $exp['amount']; ?>
                                            <tr>
                                                <td><strong><?php echo $exp['expense_category']; ?></strong></td>
                                                <td class="negative">₹<?php echo number_format($exp['amount'], 2); ?></td>
                                            </tr>
                                        <?php endforeach; ?>
                                        <!-- Totals Row -->
                                        <tr class="table-dark">
                                            <td><strong>कुल व्यय:</strong></td>
                                            <td class="negative"><strong>₹<?php echo number_format($total_exp, 2); ?></strong></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
            
            <!-- Top Customers Tab -->
            <div class="tab-pane fade" id="top_customers" role="tabpanel">
                <h4 class="mb-3">
                    <i class="bi bi-star"></i> शीर्ष 10 ग्राहक
                    <small class="text-muted">
                        (<?php echo date('d/m/Y', strtotime($start_date)); ?> से <?php echo date('d/m/Y', strtotime($end_date)); ?>)
                    </small>
                </h4>
                
                <div class="card report-card mb-4">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0"><i class="bi bi-star"></i> शीर्ष 10 ग्राहक</h5>
                    </div>
                    <div class="card-body">
                        <?php if (empty($reports['top_customers'])): ?>
                            <div class="alert alert-info text-center">
                                <i class="bi bi-info-circle"></i> इस अवधि में कोई शीर्ष ग्राहक नहीं है।
                            </div>
                        <?php else: ?>
                            <div class="table-container">
                                <table class="table table-hover table-sm">
                                    <thead class="sticky-header">
                                        <tr>
                                            <th>ग्राहक नाम</th>
                                            <th>संपर्क</th>
                                            <th>पिछला जॉब</th>
                                            <th>इस अवधि में जॉब</th>
                                            <th>इस अवधि में राशि</th>
                                            <th>इस अवधि में भुगतान</th>
                                            <th>पिछला बैलेंस</th>
                                            <th>वर्तमान बैलेंस</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php 
                                        $top_total_jobs = 0;
                                        $top_total_amount = 0;
                                        $top_total_payment = 0;
                                        $top_total_balance = 0;
                                        ?>
                                        <?php foreach($reports['top_customers'] as $top): ?>
                                            <?php 
                                                $top_total_jobs += $top['total_jobs'];
                                                $top_total_amount += $top['total_amount'];
                                                $top_total_payment += $top['total_payment_amount'];
                                                $top_total_balance += $top['current_balance'];
                                            ?>
                                            <tr>
                                                <td><strong><?php echo $top['customer_name']; ?></strong></td>
                                                <td><?php echo $top['contact']; ?></td>
                                                <td><span class="badge bg-secondary"><?php echo $top['previous_jobs']; ?></span></td>
                                                <td><span class="badge bg-primary"><?php echo $top['total_jobs']; ?></span></td>
                                                <td class="positive">₹<?php echo number_format($top['total_amount'], 2); ?></td>
                                                <td class="positive">₹<?php echo number_format($top['total_payment_amount'], 2); ?></td>
                                                <td class="<?php echo $top['opening_balance'] >= 0 ? 'positive' : 'negative'; ?>">₹<?php echo number_format($top['opening_balance'], 2); ?></td>
                                                <td class="<?php echo $top['current_balance'] >= 0 ? 'positive' : 'negative'; ?>">₹<?php echo number_format($top['current_balance'], 2); ?></td>
                                            </tr>
                                        <?php endforeach; ?>
                                        <!-- Totals Row -->
                                        <tr class="table-dark">
                                            <td><strong>कुल:</strong></td>
                                            <td><strong>-</strong></td>
                                            <td><strong>-</strong></td>
                                            <td><strong><span class="badge bg-primary"><?php echo $top_total_jobs; ?></span></strong></td>
                                            <td class="positive"><strong>₹<?php echo number_format($top_total_amount, 2); ?></strong></td>
                                            <td class="positive"><strong>₹<?php echo number_format($top_total_payment, 2); ?></strong></td>
                                            <td><strong>-</strong></td>
                                            <td class="<?php echo $top_total_balance >= 0 ? 'positive' : 'negative'; ?>"><strong>₹<?php echo number_format($top_total_balance, 2); ?></strong></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
            
            <!-- Loan Ledger Tab -->
            <div class="tab-pane fade" id="loan" role="tabpanel">
                <h4 class="mb-3">
                    <i class="bi bi-bank"></i> लोन लेजर
                    <small class="text-muted">
                        (<?php echo date('d/m/Y', strtotime($start_date)); ?> से <?php echo date('d/m/Y', strtotime($end_date)); ?>)
                    </small>
                </h4>
                
                <div class="card report-card mb-4">
                    <div class="card-header bg-danger text-white">
                        <h5 class="mb-0"><i class="bi bi-bank"></i> लोन लेजर</h5>
                    </div>
                    <div class="card-body">
                        <?php if (empty($reports['loan_ledger'])): ?>
                            <div class="alert alert-info text-center">
                                <i class="bi bi-info-circle"></i> इस अवधि में कोई लोन गतिविधि नहीं हुई है।
                            </div>
                        <?php else: ?>
                            <div class="table-container">
                                <table class="table table-hover table-sm">
                                    <thead class="sticky-header">
                                        <tr>
                                            <th>उधारकर्ता नाम</th>
                                            <th>उधार राशि</th>
                                            <th>ब्याज दर %</th>
                                            <th>मासिक किस्त</th>
                                            <th>शुरू तारीख</th>
                                            <th>पिछला भुगतान</th>
                                            <th>इस अवधि में भुगतान</th>
                                            <th>कुल भुगतान</th>
                                            <th>शेष राशि</th>
                                            <th>शेष EMI</th>
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
                                            <th>सीधी बिक्री</th>
                                            <th>कुल आय</th>
                                            <th>कुल ग्राहक</th>
                                            <th>कुल व्यय</th>
                                            <th>शुद्ध आय</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php 
                                        $monthly_total_jobs = 0;
                                        $monthly_total_repair = 0;
                                        $monthly_total_direct = 0;
                                        $monthly_total_income = 0;
                                        $monthly_total_customers = 0;
                                        $monthly_total_expenses = 0;
                                        $monthly_total_net = 0;
                                        ?>
                                        <?php foreach($reports['monthly_summary'] as $monthly): ?>
                                            <?php 
                                                $total_income_monthly = $monthly['repair_income'] + $monthly['direct_income'];
                                                $net_income_monthly = $total_income_monthly - $monthly['total_expenses'];
                                                
                                                $monthly_total_jobs += $monthly['total_jobs'];
                                                $monthly_total_repair += $monthly['repair_income'];
                                                $monthly_total_direct += $monthly['direct_income'];
                                                $monthly_total_income += $total_income_monthly;
                                                $monthly_total_customers += $monthly['total_customers'];
                                                $monthly_total_expenses += $monthly['total_expenses'];
                                                $monthly_total_net += $net_income_monthly;
                                            ?>
                                            <tr>
                                                <td><strong><?php echo $monthly['month']; ?></strong></td>
                                                <td><span class="badge bg-primary"><?php echo $monthly['total_jobs']; ?></span></td>
                                                <td class="positive">₹<?php echo number_format($monthly['repair_income'], 2); ?></td>
                                                <td class="positive">₹<?php echo number_format($monthly['direct_income'], 2); ?></td>
                                                <td class="positive">₹<?php echo number_format($total_income_monthly, 2); ?></td>
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
                                            <td class="positive"><strong>₹<?php echo number_format($monthly_total_repair, 2); ?></strong></td>
                                            <td class="positive"><strong>₹<?php echo number_format($monthly_total_direct, 2); ?></strong></td>
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

        <!-- Footer -->
        <div class="mt-5 mb-4 text-center">
            <hr>
            <p class="text-muted">
                <i class="bi bi-clock"></i> रिपोर्ट जनरेट समय: <?php echo date('d-m-Y H:i:s'); ?> |
                <i class="bi bi-database"></i> डेटाबेस: <?php echo $dbname; ?> |
                <i class="bi bi-funnel"></i> फिल्टर: 
                <?php 
                $month_names = [
                    'January' => 'जनवरी',
                    'February' => 'फरवरी',
                    'March' => 'मार्च',
                    'April' => 'अप्रैल',
                    'May' => 'मई',
                    'June' => 'जून',
                    'July' => 'जुलाई',
                    'August' => 'अगस्त',
                    'September' => 'सितंबर',
                    'October' => 'अक्टूबर',
                    'November' => 'नवंबर',
                    'December' => 'दिसंबर'
                ]; // Full mapping
                $filter_month_name = date('F', mktime(0,0,0,$filter_month,1));
                if ($filter_type == 'monthly') {
                    echo isset($month_names[$filter_month_name]) ? $month_names[$filter_month_name] . " $filter_year" : $filter_month . " $filter_year";
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
        function toggleFilters(select) {
            const type = select.value;
            document.getElementById('month_filter').style.display = type === 'custom' ? 'none' : 'block';
            document.getElementById('year_filter').style.display = type === 'custom' ? 'none' : 'block';
            document.getElementById('custom_start').style.display = type === 'custom' ? 'block' : 'none';
            document.getElementById('custom_end').style.display = type === 'custom' ? 'block' : 'none';
        }

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