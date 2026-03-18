<?php
// 1. Data aur Filters ka logic
$year = isset($_GET['year']) ? $_GET['year'] : date("Y");

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

<style>
    /* Print ke waqt sirf table dikhe, baki sab hide ho jaye */
    @media print {
        .btn, .card-tools, .main-footer, .sidebar, .nav, .input-group-prepend {
            display: none !important;
        }
        .card { border: none !important; }
        .table-bordered th, .table-bordered td { border: 1px solid #000 !important; }
        .text-success { color: green !important; }
        .text-danger { color: red !important; }
        body { background: white !important; }
    }
</style>

<div class="card card-outline card-primary">
    <div class="card-header">
        <h3 class="card-title">Month-wise Report (Year: <?= $year ?>)</h3>
        <div class="card-tools d-flex align-items-center">
            <form action="" method="get" id="year-filter-form" class="mr-2">
                <input type="hidden" name="page" value="reports/month_profit"> 
                <div class="input-group input-group-sm">
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
            <button class="btn btn-sm btn-flat btn-success" type="button" onclick="window.print()">
                <i class="fa fa-print"></i> Print Report
            </button>
        </div>
    </div>
    <div class="card-body" id="printout">
        <div class="text-center d-none d-print-block">
            <h3>V-Tech RSMS</h3>
            <h4>Monthly Profit/Loss Report - <?= $year ?></h4>
            <hr>
        </div>
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
                $gt_sales = 0; $gt_parts = 0; $gt_exp = 0; $gt_salary = 0; $gt_emi = 0; $gt_discount = 0; $gt_net = 0;
                if($monthly_data_qry):
                while($row = $monthly_data_qry->fetch_assoc()): 
                    $total_exp = $row['total_expenses'] + $row['total_salary'] + $row['total_emi'] + $row['total_discount'];
                    $net_profit = $row['total_billed'] - $row['est_parts_cost'] - $total_exp;
                    $monthName = date("F", mktime(0, 0, 0, $row['month_num'], 10));

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