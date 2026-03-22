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

<?php 
// Date Filter Logic
$from = isset($_GET['from']) ? $_GET['from'] : date("Y-m-01");
$to = isset($_GET['to']) ? $_GET['to'] : date("Y-m-t");

// =========================================================
// 1. INCOME (Kahan se Paisa Aaya)
// =========================================================
$total_repair = $conn->query("SELECT SUM(amount) FROM transaction_list WHERE status = 5 AND DATE(date_completed) BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;
$total_direct = $conn->query("SELECT SUM(total_amount) FROM direct_sales WHERE DATE(date_created) BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;
$grand_total_income = $total_repair + $total_direct;

// =========================================================
// 2. PARTS COST LOGIC (90% of Selling Price)
// =========================================================
$repair_parts_sell_price = $conn->query("SELECT SUM(tp.price * tp.qty) FROM transaction_products tp INNER JOIN transaction_list t ON tp.transaction_id = t.id WHERE t.status = 5 AND DATE(t.date_completed) BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;
$direct_parts_sell_price = $conn->query("SELECT SUM(ds.price * ds.qty) FROM direct_sale_items ds INNER JOIN direct_sales d ON ds.sale_id = d.id WHERE DATE(d.date_created) BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;

$total_parts_sell_value = $repair_parts_sell_price + $direct_parts_sell_price;
$estimated_parts_cost = $total_parts_sell_value * 0.90; // 90% Cost Logic

// --- GROSS PROFIT CALCULATION ---
$gross_profit = $grand_total_income - $estimated_parts_cost;

// =========================================================
// 3. EXPENSES (Kahan Paisa Gaya)
// =========================================================
$total_exp = $conn->query("SELECT SUM(amount) FROM expense_list WHERE DATE(date_created) BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;
$total_emi = $conn->query("SELECT SUM(amount_paid) FROM loan_payments WHERE DATE(payment_date) BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;
$total_salary = $conn->query("SELECT SUM(CASE WHEN a.status = 1 THEN m.daily_salary WHEN a.status = 3 THEN (m.daily_salary / 2) ELSE 0 END) FROM attendance_list a INNER JOIN mechanic_list m ON a.mechanic_id = m.id WHERE a.curr_date BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;
$total_discount = $conn->query("SELECT SUM(discount) FROM client_payments WHERE DATE(payment_date) BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;

$grand_total_indirect_expense = $total_exp + $total_emi + $total_salary + $total_discount;

// --- NET PROFIT CALCULATION ---
$net_profit = $gross_profit - $grand_total_indirect_expense;
$status_color = ($net_profit >= 0) ? 'success' : 'danger';
?>

<div class="container-fluid py-4">
    <div class="row">
        <div class="col-md-8">
            <div class="card shadow-sm mb-4">
                <div class="card-header bg-navy text-white font-weight-bold">1. Vyaparik Labh (Gross Profit Calculation)</div>
                <div class="card-body">
                    <table class="table table-bordered">
                        <tr>
                            <td>Total Income (Repair + Direct Sales)</td>
                            <td class="text-right">₹ <?= number_format($grand_total_income, 2) ?></td>
                        </tr>
                        <tr class="text-danger small">
                            <td>Estimated Parts Purchase Cost (90% of ₹<?= number_format($total_parts_sell_value) ?>)</td>
                            <td class="text-right">- ₹ <?= number_format($estimated_parts_cost, 2) ?></td>
                        </tr>
                        <tr class="bg-light font-weight-bold">
                            <td>Gross Operating Profit</td>
                            <td class="text-right text-primary">₹ <?= number_format($gross_profit, 2) ?></td>
                        </tr>
                    </table>
                </div>
            </div>

            <div class="card shadow-sm mb-4">
                <div class="card-header bg-danger text-white font-weight-bold">2. Anya Kharche (Indirect Expenses)</div>
                <div class="card-body">
                    <table class="table table-bordered">
                        <tr><td>Staff Salary (Attendance Based)</td><td class="text-right">- ₹ <?= number_format($total_salary, 2) ?></td></tr>
                        <tr><td>Shop Expenses (Bills/Rent/Misc)</td><td class="text-right">- ₹ <?= number_format($total_exp, 2) ?></td></tr>
                        <tr><td>Loan EMI Payments</td><td class="text-right">- ₹ <?= number_format($total_emi, 2) ?></td></tr>
                        <tr><td>Discounts Given to Clients</td><td class="text-right">- ₹ <?= number_format($total_discount, 2) ?></td></tr>
                        <tr class="bg-light font-weight-bold">
                            <td>Total Indirect Expenses</td>
                            <td class="text-right text-danger">₹ <?= number_format($grand_total_indirect_expense, 2) ?></td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>

        <div class="col-md-4">
            <div class="card shadow-sm border-<?= $status_color ?>">
                <div class="card-header bg-<?= $status_color ?> text-white font-weight-bold text-center">Final Chittha</div>
                <div class="card-body">
                    <div class="text-center py-3">
                        <small class="text-uppercase">Total Savings for this period</small>
                        <h2 class="font-weight-bold text-<?= $status_color ?>">₹ <?= number_format($net_profit, 2) ?></h2>
                    </div>
                    <hr>
                    <ul class="list-group list-group-unbordered">
                        <li class="list-group-item"><b>Gross Profit:</b> <span class="float-right text-primary">₹<?= number_format($gross_profit) ?></span></li>
                        <li class="list-group-item"><b>All Expenses:</b> <span class="float-right text-danger">₹<?= number_format($grand_total_indirect_expense) ?></span></li>
                    </ul>
                    <div class="alert alert-<?= $status_color ?> mt-3 small">
                        <?php if($net_profit >= 0): ?>
                            <i class="fa fa-check-circle mr-1"></i> Aapka vyapar sahi disha mein hai.
                        <?php else: ?>
                            <i class="fa fa-exclamation-triangle mr-1"></i> Kharchon par niyantran ki zaroorat hai.
                        <?php endif; ?>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    .border-left-info { border-left: 5px solid #17a2b8 !important; }
    .border-left-primary { border-left: 5px solid #007bff !important; }
    .border-left-success { border-left: 5px solid #28a745 !important; }
    .border-left-danger { border-left: 5px solid #dc3545 !important; }
    .bg-navy { background-color: #001f3f; }
</style>

<?php 
// ... (Purana Profit/Loss Calculation code upar rahega) ...

// =========================================================
// 4. ADVANCED BALANCE SHEET CALCULATIONS (Assets vs Liabilities)
// =========================================================

// --- A. ASSETS (Sampatti) ---
// 1. Stock Value
$current_stock_val = $conn->query("SELECT SUM(stk.balance * p.price) FROM product_list p INNER JOIN (SELECT product_id, SUM(quantity) as balance FROM inventory_list GROUP BY product_id) stk ON p.id = stk.product_id")->fetch_array()[0] ?? 0;

// 2. Cash/Bank (Is mahine ki bachat)
$cash_asset = ($net_profit > 0) ? $net_profit : 0;

// 3. Fixed Assets (Dukan ka saaman)
$fixed_assets = 50000; // Tools, Furniture etc.

$total_assets = $current_stock_val + $cash_asset + $fixed_assets;


// --- B. LIABILITIES (Dindari) ---
// 1. Loan Liability (Lender List - Payments)
$total_loan_taken = $conn->query("SELECT SUM(loan_amount) FROM lender_list")->fetch_array()[0] ?? 0;
$total_loan_paid = $conn->query("SELECT SUM(amount_paid) FROM loan_payments")->fetch_array()[0] ?? 0;
$pending_loan = $total_loan_taken - $total_loan_paid;

// 2. Outstanding Staff Salary (Is mahine ki banti hui salary)
$outstanding_salary = $conn->query("SELECT SUM(CASE WHEN a.status = 1 THEN m.daily_salary WHEN a.status = 3 THEN (m.daily_salary / 2) ELSE 0 END) FROM attendance_list a INNER JOIN mechanic_list m ON a.mechanic_id = m.id WHERE a.curr_date BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;

// 3. Outstanding Shop Expenses (Rent, Electricity etc. jo is period mein enter hue)
$pending_shop_exp = $conn->query("SELECT SUM(amount) FROM expense_list WHERE DATE(date_created) BETWEEN '{$from}' AND '{$to}'")->fetch_array()[0] ?? 0;

$total_liabilities = $pending_loan + $outstanding_salary + $pending_shop_exp;

// --- C. NET WORTH ---
$final_net_worth = $total_assets - $total_liabilities;
?>

<div class="row mt-5 mb-5">
    <div class="col-md-12">
        <div class="card shadow-lg border-0">
            <div class="card-header bg-navy text-white py-3">
                <h4 class="m-0 font-weight-bold text-center"><i class="fas fa-university mr-2"></i> Vyaparik Balance Sheet (Current Financial Status)</h4>
            </div>
            <div class="card-body bg-white">
                <div class="row">
                    <div class="col-md-6 border-right">
                        <h5 class="text-success font-weight-bold border-bottom pb-2 mb-3"><i class="fas fa-plus-circle"></i> Sampatti (Assets)</h5>
                        <table class="table table-sm table-borderless">
                            <tr>
                                <td>Inventory (Current Stock Value)</td>
                                <td class="text-right font-weight-bold">₹ <?= number_format($current_stock_val, 2) ?></td>
                            </tr>
                            <tr>
                                <td>Liquid Cash (Monthly Net Profit)</td>
                                <td class="text-right font-weight-bold">₹ <?= number_format($cash_asset, 2) ?></td>
                            </tr>
                            <tr>
                                <td>Fixed Assets (Tools & Machinery)</td>
                                <td class="text-right font-weight-bold">₹ <?= number_format($fixed_assets, 2) ?></td>
                            </tr>
                            <tr class="border-top mt-2" style="background:#f0fff4">
                                <td class="font-weight-bold">Total Assets Value</td>
                                <td class="text-right font-weight-bold text-success" style="font-size:1.2rem">₹ <?= number_format($total_assets, 2) ?></td>
                            </tr>
                        </table>
                    </div>

                    <div class="col-md-6">
                        <h5 class="text-danger font-weight-bold border-bottom pb-2 mb-3"><i class="fas fa-minus-circle"></i> Dindari (Liabilities)</h5>
                        <table class="table table-sm table-borderless">
                            <tr>
                                <td class="font-weight-bold text-muted" colspan="2">Long-Term:</td>
                            </tr>
                            <tr>
                                <td class="pl-3">Pending Loan Balance</td>
                                <td class="text-right">₹ <?= number_format($pending_loan, 2) ?></td>
                            </tr>
                            <tr>
                                <td class="font-weight-bold text-muted" colspan="2">Short-Term (Monthly Accrued):</td>
                            </tr>
                            <tr>
                                <td class="pl-3">Staff Salary (This Month)</td>
                                <td class="text-right">₹ <?= number_format($outstanding_salary, 2) ?></td>
                            </tr>
                            <tr>
                                <td class="pl-3">Shop Bills/Rent (Entered)</td>
                                <td class="text-right">₹ <?= number_format($pending_shop_exp, 2) ?></td>
                            </tr>
                            <tr class="border-top mt-2" style="background:#fff5f5">
                                <td class="font-weight-bold">Total Liabilities</td>
                                <td class="text-right font-weight-bold text-danger" style="font-size:1.2rem">₹ <?= number_format($total_liabilities, 2) ?></td>
                            </tr>
                        </table>
                    </div>
                </div>

                <div class="mt-4 p-4 rounded text-center shadow <?= $final_net_worth >= 0 ? 'bg-success' : 'bg-danger' ?> text-white">
                    <h6 class="text-uppercase small font-weight-bold mb-1">Business Net Worth (Asli Value)</h6>
                    <h1 class="font-weight-bold mb-0">₹ <?= number_format($final_net_worth, 2) ?></h1>
                    <p class="mb-0 small mt-2">
                        <?php if($final_net_worth >= 0): ?>
                            <i class="fa fa-info-circle"></i> Aapka vyapar "Positive Net Worth" mein hai. Assets deindari se zyada hain.
                        <?php else: ?>
                            <i class="fa fa-exclamation-triangle"></i> Savdhan! Aapki deindari (Loans/Bills) aapki sampatti se zyada hai.
                        <?php endif; ?>
                    </p>
                </div>
            </div>
        </div>
    </div>
</div>