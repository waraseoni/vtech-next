<?php 
// Date Filter Logic
$from = isset($_GET['from']) ? $_GET['from'] : date("Y-m-01");
$to = isset($_GET['to']) ? $_GET['to'] : date("Y-m-t");

// =========================================================
// 1. INCOME CALCULATIONS
// =========================================================
$repair_income = $conn->query("SELECT SUM(amount) FROM transaction_list WHERE status = 5 AND DATE(date_completed) BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;
$direct_income = $conn->query("SELECT SUM(total_amount) FROM direct_sales WHERE DATE(date_created) BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;
$total_sales = $repair_income + $direct_income;

// =========================================================
// 2. PARTS COST & GROSS PROFIT
// =========================================================
$repair_parts_val = $conn->query("SELECT SUM(tp.price * tp.qty) FROM transaction_products tp INNER JOIN transaction_list t ON tp.transaction_id = t.id WHERE t.status = 5 AND DATE(t.date_completed) BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;
$direct_parts_val = $conn->query("SELECT SUM(ds.price * ds.qty) FROM direct_sale_items ds INNER JOIN direct_sales d ON ds.sale_id = d.id WHERE DATE(d.date_created) BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;
$total_parts_cost = ($repair_parts_val + $direct_parts_val) * 0.90; // 90% Cost Assumption
$gross_profit = $total_sales - $total_parts_cost;

// =========================================================
// 3. INDIRECT EXPENSES (Chittha)
// =========================================================
$shop_expenses = $conn->query("SELECT SUM(amount) FROM expense_list WHERE DATE(date_created) BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;
$emi_paid = $conn->query("SELECT SUM(amount_paid) FROM loan_payments WHERE DATE(payment_date) BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;
$staff_salary = $conn->query("SELECT SUM(CASE WHEN a.status = 1 THEN m.daily_salary WHEN a.status = 3 THEN (m.daily_salary / 2) ELSE 0 END) FROM attendance_list a INNER JOIN mechanic_list m ON a.mechanic_id = m.id WHERE a.curr_date BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;
$discounts = $conn->query("SELECT SUM(discount) FROM client_payments WHERE DATE(created_at) BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;

$total_indirect_expenses = $shop_expenses + $staff_salary + $emi_paid + $discounts;
$net_profit = $gross_profit - $total_indirect_expenses;

// Dynamic Colors Logic
$profit_color = ($net_profit >= 0) ? 'success' : 'danger';
$profit_text = ($net_profit >= 0) ? 'Shuddh Laabh (Net Profit)' : 'Shuddh Haani (Net Loss)';

// =========================================================
// 4. STOCK VALUE
// =========================================================
$stock_value = $conn->query("SELECT SUM(stk.balance * p.price) FROM product_list p INNER JOIN (SELECT product_id, SUM(quantity) as balance FROM inventory_list GROUP BY product_id) stk ON p.id = stk.product_id")->fetch_array()[0] ?? 0;
?>

<div class="content py-4">
    <div class="container-fluid">
        <div class="d-md-flex justify-content-between align-items-center mb-4 no-print">
            <h2 class="text-navy font-weight-bold m-0"><i class="fas fa-balance-scale mr-2"></i>Vyapar Darpan</h2>
            <div class="filter-box bg-white p-2 rounded shadow-sm border">
                <form action="" method="GET" class="d-flex align-items-end" style="gap:10px">
                    <input type="hidden" name="page" value="reports/business">
                    <div class="form-group mb-0">
                        <label class="small font-weight-bold">From</label>
                        <input type="date" name="from" class="form-control form-control-sm" value="<?= $from ?>">
                    </div>
                    <div class="form-group mb-0">
                        <label class="small font-weight-bold">To</label>
                        <input type="date" name="to" class="form-control form-control-sm" value="<?= $to ?>">
                    </div>
                    <button type="submit" class="btn btn-navy btn-sm shadow-sm"><i class="fa fa-sync"></i></button>
                    <button type="button" class="btn btn-light btn-sm border shadow-sm" onclick="window.print()"><i class="fa fa-print"></i></button>
                </form>
            </div>
        </div>

        <div class="row">
            <div class="col-md-3">
                <div class="card shadow-sm border-0 border-left-lg border-info h-100">
                    <div class="card-body">
                        <div class="text-xs font-weight-bold text-info text-uppercase mb-1">Kul Bikri (Total Sales)</div>
                        <div class="h5 mb-0 font-weight-bold text-gray-800">₹ <?= number_format($total_sales, 2) ?></div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card shadow-sm border-0 border-left-lg border-primary h-100">
                    <div class="card-body">
                        <div class="text-xs font-weight-bold text-primary text-uppercase mb-1">Sakal Laabh (Gross Profit)</div>
                        <div class="h5 mb-0 font-weight-bold text-gray-800">₹ <?= number_format($gross_profit, 2) ?></div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card shadow-sm border-0 border-left-lg border-<?= $profit_color ?> h-100 bg-<?= $profit_color ?>-light">
                    <div class="card-body">
                        <div class="text-xs font-weight-bold text-<?= $profit_color ?> text-uppercase mb-1"><?= $profit_text ?></div>
                        <div class="h5 mb-0 font-weight-bold text-<?= $profit_color ?>">₹ <?= number_format($net_profit, 2) ?></div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card shadow-sm border-0 border-left-lg border-warning h-100">
                    <div class="card-body">
                        <div class="text-xs font-weight-bold text-warning text-uppercase mb-1">Kul Stock Value</div>
                        <div class="h5 mb-0 font-weight-bold text-gray-800">₹ <?= number_format($stock_value, 2) ?></div>
                    </div>
                </div>
            </div>
        </div>

        <div class="row mt-4">
            <div class="col-md-7">
                <div class="card border-0 shadow-sm">
                    <div class="card-header bg-white border-bottom">
                        <h6 class="m-0 font-weight-bold text-navy">Munafa Calculation (Step-by-Step)</h6>
                    </div>
                    <div class="card-body">
                        <table class="table table-hover">
                            <tbody>
                                <tr>
                                    <td>Total Cash Received (Sales)</td>
                                    <td class="text-right font-weight-bold">₹ <?= number_format($total_sales, 2) ?></td>
                                </tr>
                                <tr class="text-muted small">
                                    <td>Estimated Parts Cost (Stock Out)</td>
                                    <td class="text-right">- ₹ <?= number_format($total_parts_cost, 2) ?></td>
                                </tr>
                                <tr class="bg-light">
                                    <td class="font-weight-bold">Gross Operating Profit</td>
                                    <td class="text-right font-weight-bold text-primary">₹ <?= number_format($gross_profit, 2) ?></td>
                                </tr>
                                <tr>
                                    <td>Operational Expenses (Staff/Shop/EMI)</td>
                                    <td class="text-right text-danger">- ₹ <?= number_format($total_indirect_expenses, 2) ?></td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr style="font-size: 1.25rem;">
                                    <th class="text-navy"><?= ($net_profit >= 0) ? 'Nett Savings' : 'Nett Loss' ?></th>
                                    <th class="text-right text-<?= $profit_color ?>">₹ <?= number_format($net_profit, 2) ?></th>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>

            <div class="col-md-5">
                <div class="card border-0 shadow-sm">
                    <div class="card-header bg-white border-bottom">
                        <h6 class="m-0 font-weight-bold text-navy">Quick Cash Flow (Last 10)</h6>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive" style="max-height: 350px;">
                            <table class="table table-sm table-striped mb-0">
                                <thead class="small text-muted">
                                    <tr>
                                        <th>Date</th>
                                        <th>Head</th>
                                        <th class="text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php 
                                    $recent = $conn->query("(SELECT payment_date as date, 'Income' as cat, amount, 'success' as clr FROM client_payments WHERE DATE(payment_date) BETWEEN '$from' AND '$to') UNION ALL (SELECT date_created as date, category as cat, amount, 'danger' as clr FROM expense_list WHERE DATE(date_created) BETWEEN '$from' AND '$to') ORDER BY date DESC LIMIT 10");
                                    while($row = $recent->fetch_assoc()):
                                    ?>
                                    <tr>
                                        <td class="small"><?= date("d M", strtotime($row['date'])) ?></td>
                                        <td class="small"><?= $row['cat'] ?></td>
                                        <td class="text-right text-<?= $row['clr'] ?> font-weight-bold">₹ <?= number_format($row['amount']) ?></td>
                                    </tr>
                                    <?php endwhile; ?>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    .border-left-lg { border-left: 5px solid !important; }
    .bg-success-light { background-color: #f0fff4 !important; }
    .bg-danger-light { background-color: #fff5f5 !important; }
    .text-navy { color: #001f3f !important; }
    .btn-navy { background-color: #001f3f; color: white; }
    .btn-navy:hover { background-color: #001122; color: white; }
</style>