
<?php 
$from = isset($_GET['from']) ? $_GET['from'] : date("Y-m-01");
$to = isset($_GET['to']) ? $_GET['to'] : date("Y-m-t");

// 1. Repair Income (Total Billed)
$income_qry = $conn->query("SELECT SUM(amount) FROM transaction_list WHERE status = 5 AND date(date_created) BETWEEN '{$from}' AND '{$to}'");
$total_billed = $income_qry->fetch_array()[0] ?? 0;

// 2. Total Discount Given
$discount_qry = $conn->query("SELECT SUM(discount) FROM client_payments WHERE date(created_at) BETWEEN '{$from}' AND '{$to}'");
$total_discount = $discount_qry->fetch_array()[0] ?? 0;

// 3. Estimated Parts Cost (70%)
$parts_cost_qry = $conn->query("SELECT SUM(tp.price * tp.qty) FROM transaction_products tp INNER JOIN transaction_list t ON tp.transaction_id = t.id WHERE t.status = 5 AND date(t.date_created) BETWEEN '{$from}' AND '{$to}'");
$total_parts_cost = ($parts_cost_qry->fetch_array()[0] ?? 0) * 0.7;

// 4. Shop Expenses (Rent, Bills etc.)
$expense_qry = $conn->query("SELECT SUM(amount) FROM expense_list WHERE date(date_created) BETWEEN '{$from}' AND '{$to}'");
$total_shop_expenses = $expense_qry->fetch_array()[0] ?? 0;

// 5. Staff/Mechanic Salary (Based on Attendance)
$salary_qry = $conn->query("SELECT 
    SUM(CASE WHEN a.status = 1 THEN m.daily_salary WHEN a.status = 3 THEN (m.daily_salary / 2) ELSE 0 END) as total_salary 
    FROM attendance_list a 
    INNER JOIN mechanic_list m ON a.mechanic_id = m.id 
    WHERE a.curr_date BETWEEN '{$from}' AND '{$to}'");
$total_staff_salary = $salary_qry->fetch_assoc()['total_salary'] ?? 0;

// ==========================================
// 6. NEW: Loan EMI Expense (Ye naya joda gaya hai)
// ==========================================
$emi_qry = $conn->query("SELECT SUM(amount_paid) FROM loan_payments WHERE date(payment_date) BETWEEN '{$from}' AND '{$to}'");
$total_emi_paid = $emi_qry->fetch_array()[0] ?? 0;

// --- TOTAL EXPENSES CALCULATION ---
// Ab saare kharche ek sath: Shop Exp + Staff Salary + Loan EMI
$final_total_expense = $total_shop_expenses + $total_staff_salary + $total_emi_paid + $total_discount;

// --- FINAL NET PROFIT CALCULATION ---
// Formula: Income - Parts Cost - (Salary+Shop+EMI) - Discount
$net_profit = $total_billed - $total_parts_cost - $final_total_expense;
?>
<!--
<h1 class="text-dark">Dashboard</h1>
<hr class="border-dark">-->

<div class="card card-outline card-primary shadow-sm mb-4">
    <div class="card-body">
        <form id="filter-form">
            <input type="hidden" name="p" value="home"> <div class="row align-items-end">
                <div class="col-md-4">
                    <label>From Date</label>
                    <input type="date" name="from" class="form-control" value="<?= $from ?>" required>
                </div>
                <div class="col-md-4">
                    <label>To Date</label>
                    <input type="date" name="to" class="form-control" value="<?= $to ?>" required>
                </div>
                <div class="col-md-4">
                    <button class="btn btn-primary btn-flat"><i class="fa fa-filter"></i> Filter Results</button>
                    <a href="./?p=home" class="btn btn-default border btn-flat">Reset</a>
                </div>
            </div>
        </form>
    </div>
</div>

<div class="row">
    <div class="col-12 col-sm-6 col-md-3">
        <div class="info-box shadow-sm border">
            <span class="info-box-icon bg-info elevation-1"><i class="fas fa-file-invoice-dollar"></i></span>
            <div class="info-box-content">
                <span class="info-box-text">Period Sales</span>
                <span class="info-box-number">₹ <?= number_format($total_billed, 2) ?></span>
            </div>
        </div>
    </div>

    <div class="col-12 col-sm-6 col-md-3">
        <div class="info-box shadow-sm border">
            <span class="info-box-icon bg-warning elevation-1"><i class="fas fa-tools"></i></span>
            <div class="info-box-content">
                <span class="info-box-text">Parts Cost (Est.)</span>
                <span class="info-box-number">₹ <?= number_format($total_parts_cost, 2) ?></span>
            </div>
        </div>
    </div>
	
	<div class="col-12 col-sm-6 col-md-3">
        <div class="info-box shadow-sm border">
            <span class="info-box-icon bg-warning elevation-1"><i class="fas fa-tools"></i></span>
            <div class="info-box-content">
                <span class="info-box-text">Loan Repayment</span>
                <span class="info-box-number">₹ <?= number_format($total_emi_paid, 2) ?></span>
            </div>
        </div>
    </div>
	
	<div class="col-12 col-sm-6 col-md-3">
        <div class="info-box shadow-sm border">
            <span class="info-box-icon bg-danger elevation-1"><i class="fas fa-money-bill-wave"></i></span>
            <div class="info-box-content">
                <span class="info-box-text">Total Expenses</span>
                <span class="info-box-number">₹ <?= number_format($final_total_expense, 2) ?></span>
            </div>
        </div>
    </div>

    <div class="col-12 col-sm-6 col-md-3">
        <div class="info-box shadow-sm border">
            <span class="info-box-icon bg-danger elevation-1"><i class="fas fa-money-bill-wave"></i></span>
            <div class="info-box-content">
                <span class="info-box-text">Expenses</span>
                <span class="info-box-number">₹ <?= number_format($total_shop_expenses, 2) ?></span>
            </div>
        </div>
    </div>
	
	<div class="col-12 col-sm-6 col-md-3">
        <div class="info-box shadow-sm border">
            <span class="info-box-icon bg-danger elevation-1"><i class="fas fa-tags"></i></span>
            <div class="info-box-content">
                <span class="info-box-text">Total Discounts</span>
                <span class="info-box-number">₹ <?= number_format($total_discount, 2) ?></span>
            </div>
        </div>
    </div>
	
		
	<div class="col-12 col-sm-6 col-md-3">
        <div class="info-box shadow-sm border">
            <span class="info-box-icon bg-danger elevation-1"><i class="fas fa-money-bill-wave"></i></span>
            <div class="info-box-content">
                <span class="info-box-text">Mechanic Salery
                <span class="info-box-number">₹ <?= number_format($total_staff_salary, 2) ?></span>
            </div>
        </div>
    </div>

    <div class="col-12 col-sm-6 col-md-3">
        <div class="info-box shadow-sm border">
            <span class="info-box-icon bg-success elevation-1"><i class="fas fa-chart-line"></i></span>
            <div class="info-box-content">
                <span class="info-box-text">Net Profit</span>
                <span class="info-box-number">₹ <?= number_format($net_profit, 2) ?></span>
            </div>
        </div>
    </div>
</div>
<!--
<div class="container-fluid text-center mt-4">
    <img src="<?= validate_image($_settings->info('cover')) ?>" alt="Banner" class="img-fluid rounded shadow-sm" style="max-height: 350px; width: 100%; object-fit: cover;">
</div>
-->

<style>
    .info-box-number { font-size: 1.3rem; font-weight: bold; }
    #filter-form label { font-weight: bold; color: #555; }
</style>

<?php
// Is saal ka data nikalne ke liye
$year = isset($_GET['year']) ? $_GET['year'] : date("Y");

// Optimized SQL Query with Table Aliases to fix Ambiguous Error
$monthly_data_qry = $conn->query("
    SELECT 
        m.month_num,
        COALESCE(sales.total_billed, 0) as total_billed,
        COALESCE(sales.parts_cost, 0) * 0.7 as est_parts_cost,
        COALESCE(payments.total_discount, 0) as total_discount,
        COALESCE(expenses.total_expenses, 0) as total_expenses,
        COALESCE(loans.total_emi, 0) as total_emi,
        COALESCE(salary.total_salary, 0) as total_salary
    FROM (
        SELECT 1 AS month_num UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION 
        SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION 
        SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
    ) m
    LEFT JOIN (
        SELECT MONTH(t.date_created) as mnt, SUM(t.amount) as total_billed, 
        (SELECT SUM(tp.price * tp.qty) FROM transaction_products tp WHERE tp.transaction_id = t.id) as parts_cost
        FROM transaction_list t 
        WHERE t.status = 5 AND YEAR(t.date_created) = '$year' 
        GROUP BY MONTH(t.date_created)
    ) sales ON m.month_num = sales.mnt
    LEFT JOIN (
        SELECT MONTH(created_at) as mnt, SUM(discount) as total_discount 
        FROM client_payments WHERE YEAR(created_at) = '$year' GROUP BY MONTH(created_at)
    ) payments ON m.month_num = payments.mnt
    LEFT JOIN (
        SELECT MONTH(date_created) as mnt, SUM(amount) as total_expenses 
        FROM expense_list WHERE YEAR(date_created) = '$year' GROUP BY MONTH(date_created)
    ) expenses ON m.month_num = expenses.mnt
    LEFT JOIN (
        SELECT MONTH(payment_date) as mnt, SUM(amount_paid) as total_emi 
        FROM loan_payments WHERE YEAR(payment_date) = '$year' GROUP BY MONTH(payment_date)
    ) loans ON m.month_num = loans.mnt
    LEFT JOIN (
        SELECT MONTH(a.curr_date) as mnt, 
        SUM(CASE WHEN a.status = 1 THEN mech.daily_salary WHEN a.status = 3 THEN (mech.daily_salary / 2) ELSE 0 END) as total_salary
        FROM attendance_list a 
        INNER JOIN mechanic_list mech ON a.mechanic_id = mech.id
        WHERE YEAR(a.curr_date) = '$year' 
        GROUP BY MONTH(a.curr_date)
    ) salary ON m.month_num = salary.mnt
    ORDER BY m.month_num ASC
");
?>

<div class="card card-outline card-primary">
   <div class="card-header">
    <h3 class="card-title">Month-wise Report (Year: <?= $year ?>)</h3>
    <div class="card-tools">
        <form action="" method="get" id="year-filter-form">
            <input type="hidden" name="page" value="reports/month_profit"> 
            
            <div class="input-group input-group-sm">
                <div class="input-group-prepend">
                    <span class="input-group-text">Select Year</span>
                </div>
                <select name="year" onchange="this.form.submit()" class="form-control">
                    <?php 
                    $current_y = date('Y');
                    for($y = $current_y; $y >= 2020; $y--): 
                    ?>
                        <option value="<?= $y ?>" <?= ($year == $y) ? 'selected' : '' ?>><?= $y ?></option>
                    <?php endfor; ?>
                </select>
            </div>
        </form>
    </div>
</div>
    <div class="card-body">
        <table class="table table-bordered table-striped">
            <thead>
                <tr class="bg-navy">
                    <th>Month</th>
                    <th>Sales</th>
                    <th>Parts (70%)</th>
                    <th>Expenses</th>
                    <th>Salaries</th>
                    <th>EMI</th>
                    <th>Discounts</th>
                    <th>Net Profit</th>
                </tr>
            </thead>
            <tbody>
    <?php 
    // Totals initialize kar rahe hain
    $gt_sales = 0; $gt_parts = 0; $gt_exp = 0; $gt_salary = 0; $gt_emi = 0; $gt_discount = 0; $gt_net = 0;

    if($monthly_data_qry):
    while($row = $monthly_data_qry->fetch_assoc()): 
        $total_exp = $row['total_expenses'] + $row['total_salary'] + $row['total_emi'] + $row['total_discount'];
        $net_profit = $row['total_billed'] - $row['est_parts_cost'] - $total_exp;
        $monthName = date("F", mktime(0, 0, 0, $row['month_num'], 10));

        // Grand Totals jama karna
        $gt_sales += $row['total_billed'];
        $gt_parts += $row['est_parts_cost'];
        $gt_exp += $row['total_expenses'];
        $gt_salary += $row['total_salary'];
        $gt_emi += $row['total_emi'];
        $gt_discount += $row['total_discount'];
        $gt_net += $net_profit;
    ?>
    <tr>
        <td><b><?= $monthName ?></b></td>
        <td>₹ <?= number_format($row['total_billed'], 2) ?></td>
        <td class="text-orange">₹ <?= number_format($row['est_parts_cost'], 2) ?></td>
        <td>₹ <?= number_format($row['total_expenses'], 2) ?></td>
        <td>₹ <?= number_format($row['total_salary'], 2) ?></td>
        <td>₹ <?= number_format($row['total_emi'], 2) ?></td>
        <td class="text-danger">₹ <?= number_format($row['total_discount'], 2) ?></td>
        <td class="<?= $net_profit >= 0 ? 'text-success' : 'text-danger' ?> font-weight-bold">
            ₹ <?= number_format($net_profit, 2) ?>
        </td>
    </tr>
    <?php endwhile; endif; ?>
</tbody>

<tfoot class="bg-light font-weight-bold">
    <tr style="border-top: 2px solid #001f3f;">
        <td>GRAND TOTAL</td>
        <td>₹ <?= number_format($gt_sales, 2) ?></td>
        <td>₹ <?= number_format($gt_parts, 2) ?></td>
        <td>₹ <?= number_format($gt_exp, 2) ?></td>
        <td>₹ <?= number_format($gt_salary, 2) ?></td>
        <td>₹ <?= number_format($gt_emi, 2) ?></td>
        <td>₹ <?= number_format($gt_discount, 2) ?></td>
        <td class="<?= $gt_net >= 0 ? 'bg-success text-white' : 'bg-danger text-white' ?>">
            ₹ <?= number_format($gt_net, 2) ?>
        </td>
    </tr>
</tfoot>
        </table>
    </div>
</div>
