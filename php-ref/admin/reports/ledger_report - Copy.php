<?php 
$from = isset($_GET['from']) ? $_GET['from'] : date("Y-m-01");
$to = isset($_GET['to']) ? $_GET['to'] : date("Y-m-d");
?>

<div class="card card-outline card-navy shadow">
    <div class="card-header">
        <h3 class="card-title font-weight-bold"><i class="fas fa-chart-pie mr-2"></i> Business Ledger & Cash Flow</h3>
    </div>
    <div class="card-body">
        <form action="" id="filter-ledger" class="mb-4 no-print">
            <input type="hidden" name="page" value="reports/ledger_report">
            <div class="row align-items-end">
                <div class="col-md-3">
                    <label class="small">From Date</label>
                    <input type="date" name="from" value="<?= $from ?>" class="form-control form-control-sm">
                </div>
                <div class="col-md-3">
                    <label class="small">To Date</label>
                    <input type="date" name="to" value="<?= $to ?>" class="form-control form-control-sm">
                </div>
                <div class="col-md-3">
                    <button class="btn btn-primary btn-sm btn-flat"><i class="fa fa-filter"></i> Filter</button>
                    <button type="button" class="btn btn-success btn-sm btn-flat" onclick="window.print()"><i class="fa fa-print"></i> Print</button>
                </div>
            </div>
        </form>

        <?php 
// Date Filter Setup
$from = isset($_GET['from']) ? $_GET['from'] : date("Y-m-01");
$to = isset($_GET['to']) ? $_GET['to'] : date("Y-m-t");

// ==============================================================
//  FINANCIAL CALCULATIONS
// ==============================================================

// 1. TOTAL INCOME (Based on Status 5 - Finished Jobs)
// Sahi tarika: Report unhi jobs ki banegi jo is mahine complete hui hain
$income_qry = $conn->query("SELECT SUM(amount) as total FROM transaction_list 
                            WHERE status = 5 
                            AND date_completed BETWEEN '{$from} 00:00:00' AND '{$to} 23:59:59'");
$total_income = $income_qry->fetch_assoc()['total'] ?? 0;

// 2. STAFF SALARY (Earned in Period - Logic provided by you)
$total_salary_earned = 0;
$att_qry = $conn->query("SELECT a.mechanic_id, a.curr_date, a.status, m.daily_salary 
                         FROM attendance_list a 
                         INNER JOIN mechanic_list m ON a.mechanic_id = m.id 
                         WHERE a.status IN (1,3) AND a.curr_date BETWEEN '{$from}' AND '{$to}'");
while($row = $att_qry->fetch_assoc()){
    $rate_qry = $conn->query("SELECT salary FROM mechanic_salary_history WHERE mechanic_id = '{$row['mechanic_id']}' AND effective_date <= '{$row['curr_date']}' ORDER BY effective_date DESC LIMIT 1");
    $rate = ($rate_qry->num_rows > 0) ? $rate_qry->fetch_assoc()['salary'] : $row['daily_salary'];
    $total_salary_earned += ($row['status'] == 3) ? ($rate / 2) : $rate;
}

// 3. STAFF COMMISSION (Earned)
$comm_qry = $conn->query("SELECT SUM(mechanic_commission_amount) as total FROM transaction_list WHERE status = 5 AND date_updated BETWEEN '{$from} 00:00:00' AND '{$to} 23:59:59'");
$total_comm = $comm_qry->fetch_assoc()['total'] ?? 0;

// 4. ADVANCE PAYMENTS (Actual Cash Outflow - For Info)
$adv_qry = $conn->query("SELECT SUM(amount) as total FROM advance_payments WHERE date_paid BETWEEN '{$from}' AND '{$to}'");
$total_advance_given = $adv_qry->fetch_assoc()['total'] ?? 0;

// 5. OTHER EXPENSES (Shop Rent, Bills etc.)
$exp_qry = $conn->query("SELECT SUM(amount) as total FROM expense_list WHERE date(date_created) BETWEEN '{$from}' AND '{$to}'");
$other_expenses = $exp_qry->fetch_assoc()['total'] ?? 0;

// 6. LOAN EMI PAYMENTS (NEW ADDITION)
// Ye naya code hai jo loan_payments table se data lega
$emi_qry = $conn->query("SELECT SUM(amount_paid) as total FROM loan_payments WHERE date(payment_date) BETWEEN '{$from}' AND '{$to}'");
$total_emi_paid = $emi_qry->fetch_assoc()['total'] ?? 0;


// ==============================================================
//  FINAL PROFIT & LOSS CALCULATION
// ==============================================================

// Total Expenses mein ab EMI bhi judegi
$total_business_expense = $total_salary_earned + $total_comm + $other_expenses + $total_emi_paid;

// Net Profit
$net_profit = $total_income - $total_business_expense;
?>
<!--
<div class="content py-3">
    <div class="card card-outline card-navy shadow">
        <div class="card-header">
            <h3 class="card-title"><b>Business Ledger Report</b></h3>
        </div>
        <div class="card-body">
            
            <form action="" id="filter-form">
                <div class="row align-items-end mb-4">
                    <div class="col-md-3">
                        <label for="from" class="control-label">From Date</label>
                        <input type="date" name="from" id="from" value="<?= $from ?>" class="form-control form-control-sm rounded-0">
                    </div>
                    <div class="col-md-3">
                        <label for="to" class="control-label">To Date</label>
                        <input type="date" name="to" id="to" value="<?= $to ?>" class="form-control form-control-sm rounded-0">
                    </div>
                    <div class="col-md-3">
                        <button class="btn btn-sm btn-primary bg-navy rounded-0"><i class="fa fa-filter"></i> Filter</button>
                        <button class="btn btn-sm btn-success rounded-0" type="button" onclick="window.print()"><i class="fa fa-print"></i> Print</button>
                    </div>
                </div>
            </form>

            <div id="out-print">
                <div class="row mb-3">
                    <div class="col-12 col-sm-6 col-md-3">
                        <div class="info-box bg-light shadow-sm">
                            <span class="info-box-icon bg-success elevation-1"><i class="fas fa-money-bill-wave"></i></span>
                            <div class="info-box-content">
                                <span class="info-box-text">Total Income</span>
                                <span class="info-box-number">₹ <?= number_format($total_income, 2) ?></span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-12 col-sm-6 col-md-3">
                        <div class="info-box bg-light shadow-sm">
                            <span class="info-box-icon bg-danger elevation-1"><i class="fas fa-file-invoice-dollar"></i></span>
                            <div class="info-box-content">
                                <span class="info-box-text">Total Expense</span>
                                <span class="info-box-number">₹ <?= number_format($total_business_expense, 2) ?></span>
                                <small class="mb-0 text-muted">(Includes Salary, Comm, Exp & EMI)</small>
                            </div>
                        </div>
                    </div>

                    <div class="col-12 col-sm-6 col-md-3">
                        <div class="info-box bg-light shadow-sm">
                            <span class="info-box-icon bg-orange elevation-1"><i class="fas fa-hand-holding-usd text-white"></i></span>
                            <div class="info-box-content">
                                <span class="info-box-text">EMI Paid (Loan)</span>
                                <span class="info-box-number">₹ <?= number_format($total_emi_paid, 2) ?></span>
                            </div>
                        </div>
                    </div>

                    <div class="col-12 col-sm-6 col-md-3">
                        <div class="info-box bg-light shadow-sm">
                            <span class="info-box-icon bg-info elevation-1"><i class="fas fa-chart-pie"></i></span>
                            <div class="info-box-content">
                                <span class="info-box-text">Net Profit</span>
                                <span class="info-box-number">₹ <?= number_format($net_profit, 2) ?></span>
                            </div>
                        </div>
                    </div>
                </div>

                <h5 class="text-navy mt-4 border-bottom pb-2">Detailed Breakdown</h5>
                <table class="table table-bordered table-striped table-sm">
                    <thead class="bg-navy text-white">
                        <tr>
                            <th class="text-center" width="5%">Type</th>
                            <th>Description</th>
                            <th class="text-center">Category</th>
                            <th class="text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="text-center"><i class="fa fa-plus text-success"></i></td>
                            <td>Total Services & Sales Revenue</td>
                            <td class="text-center"><span class="badge badge-success">Income</span></td>
                            <td class="text-right font-weight-bold">₹ <?= number_format($total_income, 2) ?></td>
                        </tr>

                        <tr>
                            <td class="text-center"><i class="fa fa-minus text-danger"></i></td>
                            <td>Staff Salaries (Earned)</td>
                            <td class="text-center"><span class="badge badge-danger">Expense</span></td>
                            <td class="text-right text-danger">₹ <?= number_format($total_salary_earned, 2) ?></td>
                        </tr>
                        <tr>
                            <td class="text-center"><i class="fa fa-minus text-danger"></i></td>
                            <td>Mechanic Commissions</td>
                            <td class="text-center"><span class="badge badge-danger">Expense</span></td>
                            <td class="text-right text-danger">₹ <?= number_format($total_comm, 2) ?></td>
                        </tr>
                        <tr>
                            <td class="text-center"><i class="fa fa-minus text-danger"></i></td>
                            <td>Shop Expenses (Rent/Bills)</td>
                            <td class="text-center"><span class="badge badge-danger">Expense</span></td>
                            <td class="text-right text-danger">₹ <?= number_format($other_expenses, 2) ?></td>
                        </tr>

                        <tr>
                            <td class="text-center"><i class="fa fa-minus text-danger"></i></td>
                            <td><b>Loan EMI Payments</b></td>
                            <td class="text-center"><span class="badge badge-warning">Loan Repayment</span></td>
                            <td class="text-right text-danger font-weight-bold">₹ <?= number_format($total_emi_paid, 2) ?></td>
                        </tr>
                    </tbody>
                    <tfoot class="bg-light">
                        <tr>
                            <th colspan="3" class="text-right">Net Profit / Loss:</th>
                            <th class="text-right <?= $net_profit >= 0 ? 'text-success' : 'text-danger' ?>" style="font-size: 1.2em;">
                                ₹ <?= number_format($net_profit, 2) ?>
                            </th>
                        </tr>
                    </tfoot>
                </table>

                <div class="alert alert-info mt-3">
                    <i class="icon fas fa-info"></i> Note: Total Cash Advance given to staff in this period is <b>₹ <?= number_format($total_advance_given, 2) ?></b>. (This is cash flow, adjusted against salaries).
                </div>
            </div>
        </div>
    </div>
</div>
-->
<script>
    $(function(){
        // Simple logic to keep date inputs valid
        $('#filter-form').submit(function(e){
            e.preventDefault()
            location.href = "./?page=reports/ledger_report&"+$(this).serialize()
        })
    })
</script>

        <div class="row">
            <div class="col-md-3">
                <div class="info-box shadow-sm border">
                    <div class="info-box-content">
                        <span class="info-box-text text-muted">Total Income</span>
                        <span class="info-box-number text-success" style="font-size: 1.5rem;">₹ <?= number_format($total_income, 2) ?></span>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="info-box shadow-sm border">
                    <div class="info-box-content">
                        <span class="info-box-text text-muted">Expenses (Sal+Comm+Exp+Emi)</span>
                        <span class="info-box-number text-danger" style="font-size: 1.5rem;">₹ <?= number_format($total_business_expense, 2) ?></span>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="info-box shadow-sm border">
                    <div class="info-box-content">
                        <span class="info-box-text text-muted">Advance Given</span>
                        <span class="info-box-number text-warning" style="font-size: 1.5rem;">₹ <?= number_format($total_advance_given, 2) ?></span>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="info-box shadow-sm border <?= $net_profit >= 0 ? 'bg-light' : 'bg-warning' ?>">
                    <div class="info-box-content">
                        <span class="info-box-text text-muted">Net Profit</span>
                        <span class="info-box-number text-primary" style="font-size: 1.5rem;">₹ <?= number_format($net_profit, 2) ?></span>
                    </div>
                </div>
            </div>
        </div>

        <div class="row mt-4">
            <div class="col-md-6">
                <h5 class="text-navy border-bottom pb-2">Business Performance (P&L)</h5>
                <table class="table table-sm table-hover">
                    <tr>
                        <td>Total Job Revenue (Status: Done)</td>
                        <td class="text-right text-success">₹ <?= number_format($total_income, 2) ?></td>
                    </tr>
                    <tr>
                        <td>Total Salary Cost (Attendance Based)</td>
                        <td class="text-right text-danger">(-) ₹ <?= number_format($total_salary_earned, 2) ?></td>
                    </tr>
                    <tr>
                        <td>Total Mechanic Commission</td>
                        <td class="text-right text-danger">(-) ₹ <?= number_format($total_comm, 2) ?></td>
                    </tr>
                    <tr>
                        <td>Shop Expenses</td>
                        <td class="text-right text-danger">(-) ₹ <?= number_format($other_expenses, 2) ?></td>
                    </tr>
					<tr>
                        <td>Loan Repayment</td>
                        <td class="text-right text-danger">(-) ₹ <?= number_format($total_emi_paid, 2) ?></td>
                    </tr>
                    <tr class="bg-light">
                        <th>Calculated Net Profit</th>
                        <th class="text-right text-primary">₹ <?= number_format($net_profit, 2) ?></th>
                    </tr>
                </table>
            </div>
            <div class="col-md-6">
                <h5 class="text-navy border-bottom pb-2">Cash Flow (Staff Payments)</h5>
                <table class="table table-sm table-hover">
                    <tr>
                        <td>Total Advance/Salaries Distributed</td>
                        <td class="text-right text-warning">₹ <?= number_format($total_advance_given, 2) ?></td>
                    </tr>
                    <tr class="text-muted small">
                        <td colspan="2"><i>*Note: Advance payments are actual cash handed over to staff.</i></td>
                    </tr>
                </table>
            </div>
        </div>
    </div>
</div>

<div class="row mt-5">
            <div class="col-md-7">
                <h5 class="text-navy border-bottom pb-2"><i class="fas fa-receipt mr-2"></i> Shop Expense Details</h5>
                <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                    <table class="table table-sm table-bordered table-striped">
                        <thead class="bg-light">
                            <tr>
                                <th>Date</th>
                                <th>Expense Name</th>
                                <th class="text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php 
                            $e_list = $conn->query("SELECT * FROM expense_list WHERE date(date_created) BETWEEN '{$from}' AND '{$to}' ORDER BY date(date_created) ASC");
                            if($e_list->num_rows > 0):
                                while($erow = $e_list->fetch_assoc()):
                            ?>
                            <tr>
                                <td><?= date("d-M-Y", strtotime($erow['date_created'])) ?></td>
                                <td><?= $erow['remarks'] ?></td>
                                <td class="text-right text-danger">₹ <?= number_format($erow['amount'], 2) ?></td>
                            </tr>
                            <?php endwhile; else: ?>
                            <tr><td colspan="3" class="text-center">No expenses found in this period.</td></tr>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="col-md-5">
                <h5 class="text-navy border-bottom pb-2"><i class="fas fa-hand-holding-usd mr-2"></i> Staff Advance List</h5>
                <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                    <table class="table table-sm table-bordered table-striped">
                        <thead class="bg-light">
                            <tr>
                                <th>Date</th>
                                <th>Staff</th>
                                <th class="text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php 
                            $p_list = $conn->query("SELECT p.*, CONCAT(m.firstname,' ',m.lastname) as mname FROM advance_payments p INNER JOIN mechanic_list m ON p.mechanic_id = m.id WHERE p.date_paid BETWEEN '{$from}' AND '{$to}' ORDER BY p.date_paid ASC");
                            if($p_list->num_rows > 0):
                                while($prow = $p_list->fetch_assoc()):
                            ?>
                            <tr>
                                <td><?= date("d-M-Y", strtotime($prow['date_paid'])) ?></td>
                                <td><?= $prow['mname'] ?></td>
                                <td class="text-right text-warning">₹ <?= number_format($prow['amount'], 2) ?></td>
                            </tr>
                            <?php endwhile; else: ?>
                            <tr><td colspan="3" class="text-center">No advance payments found.</td></tr>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

				<div class="row mt-5 pt-4 border-top">
            <div class="col-12 text-center mb-4">
                <h4 class="font-weight-bold text-navy">व्यापारिक विवरण (Business Statements)</h4>
                <p class="text-muted small">Report Period: <?= date("d M Y", strtotime($from)) ?> to <?= date("d M Y", strtotime($to)) ?></p>
            </div>

            <div class="col-md-6">
                <div class="card card-outline card-primary shadow-sm">
                    <div class="card-header"><h5 class="card-title">व्यापारिक खाता (Trading/P&L Account)</h5></div>
                    <div class="card-body p-0">
                        <table class="table table-sm table-hover mb-0">
                            <tr>
                                <td>कुल बिक्री (Total Service Revenue)</td>
                                <td class="text-right text-success">₹ <?= number_format($total_income, 2) ?></td>
                            </tr>
                            <tr>
                                <td>प्रत्यक्ष व्यय (Staff Salaries & Comm.)</td>
                                <td class="text-right text-danger">(-) ₹ <?= number_format($total_salary_earned + $total_comm, 2) ?></td>
                            </tr>
                            <tr class="bg-light">
                                <th class="pl-2">सकल लाभ (Gross Profit)</th>
                                <th class="text-right">₹ <?= number_format($total_income - ($total_salary_earned + $total_comm), 2) ?></th>
                            </tr>
                            <tr>
                                <td>अप्रत्यक्ष व्यय (Shop/Misc Expenses)</td>
                                <td class="text-right text-danger">(-) ₹ <?= number_format($other_expenses, 2) ?></td>
                            </tr>
                            <tr class="bg-navy text-white">
                                <th class="pl-2">शुद्ध लाभ (Net Profit)</th>
                                <th class="text-right">₹ <?= number_format($net_profit, 2) ?></th>
                            </tr>
                        </table>
                    </div>
                </div>
            </div>

            <?php 
                // Stock Value Logic: product_list se price aur inventory_list se balance quantity
                // Hum inner join use kar rahe hain taaki wahi products calculate hon jinka stock record hai
                $stock_qry = $conn->query("SELECT SUM(p.price * i.quantity) as total_val 
                                           FROM product_list p 
                                           INNER JOIN inventory_list i ON p.id = i.product_id");
                $stock_val = $stock_qry->fetch_assoc()['total_val'] ?? 0;
                
                // Outstanding Liability (Staff ka bacha hua paisa)
                $all_mechanics = $conn->query("SELECT id FROM mechanic_list");
                $total_pending_liability = 0;
                while($m = $all_mechanics->fetch_assoc()){
                    $m_id = $m['id'];
                    
                    // 1. Total Commission Earned
                    $earned_comm = $conn->query("SELECT SUM(mechanic_commission_amount) FROM transaction_list WHERE mechanic_id = $m_id AND status = 5")->fetch_array()[0] ?? 0;
                    
                    // 2. Total Salary Earned (Based on Attendance History)
                    $earned_sal = 0;
                    $att_h = $conn->query("SELECT curr_date, status FROM attendance_list WHERE mechanic_id = $m_id AND status IN (1,3)");
                    while($rh = $att_h->fetch_assoc()){
                        $d = $rh['curr_date'];
                        $rate_h = $conn->query("SELECT salary FROM mechanic_salary_history WHERE mechanic_id = $m_id AND effective_date <= '$d' ORDER BY effective_date DESC, id DESC LIMIT 1");
                        $daily = ($rate_h->num_rows > 0) ? $rate_h->fetch_assoc()['salary'] : 0; 
                        // Note: Agar history nahi hai toh mechanic_list ki default salary use karne ke liye aap fallback laga sakte hain
                        $earned_sal += ($rh['status'] == 3) ? ($daily / 2) : $daily;
                    }

                    // 3. Total Paid
                    $paid = $conn->query("SELECT SUM(amount) FROM advance_payments WHERE mechanic_id = $m_id")->fetch_array()[0] ?? 0;
                    
                    $total_pending_liability += (($earned_comm + $earned_sal) - $paid);
                }
            ?>
            <div class="col-md-6">
                <div class="card card-outline card-success shadow-sm">
                    <div class="card-header"><h5 class="card-title">चिट्ठा (Balance Sheet)</h5></div>
                    <div class="card-body p-0">
                        <table class="table table-sm mb-0">
                            <thead>
                                <tr class="bg-light">
                                    <th>संपत्ति (Assets)</th>
                                    <th class="text-right">राशि (Amt)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>स्टॉक मूल्य (Inventory Value)</td>
                                    <td class="text-right">₹ <?= number_format($stock_val, 2) ?></td>
                                </tr>
                                <tr>
                                    <td>नकद अनुमान (Cash Flow Estimate)</td>
                                    <td class="text-right">₹ <?= number_format($total_income - $total_advance_given - $other_expenses, 2) ?></td>
                                </tr>
                                <tr class="bg-light">
                                    <th>दायित्व (Liabilities)</th>
                                    <th></th>
                                </tr>
                                <tr>
                                    <td>स्टाफ बकाया (Net Payable to Staff)</td>
                                    <td class="text-right text-danger">₹ <?= number_format($total_pending_liability, 2) ?></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div class="alert alert-info mt-4 no-print">
            <i class="fa fa-info-circle"></i> <strong>Sujhav:</strong> Balance Sheet mein "Stock Value" aapke <code>product_list</code> table se li gayi hai. Sahi chittha dekhne ke liye apna inventory stock hamesha update rakhein.
        </div>
		
		<div class="row mb-3 no-print">
    <div class="col-12">
        <div class="custom-control custom-switch">
            <input type="checkbox" class="custom-control-input" id="toggleStockTable">
            <label class="custom-control-label font-weight-bold text-navy" for="toggleStockTable" style="cursor:pointer">
                <i class="fas fa-list-alt mr-1"></i> विस्तृत स्टॉक विवरण देखें (Show Detailed Stock Table)
            </label>
        </div>
    </div>
</div>

<div class="row mt-4" id="stockDetailSection" style="display:none;">
    <div class="col-12">
        <h5 class="text-navy border-bottom pb-2">
            <i class="fas fa-boxes mr-2"></i> विस्तृत स्टॉक विवरण (Detailed Stock Report)
        </h5>
        <div class="table-responsive">
            <table class="table table-sm table-bordered table-striped">
                <thead class="bg-navy text-white">
                    <tr>
                        <th class="text-center">#</th>
                        <th>Product Name (Item)</th>
                        <th class="text-center">Available Qty</th>
                        <th class="text-right">Unit Price (Rate)</th>
                        <th class="text-right">Total Value</th>
                    </tr>
                </thead>
                <tbody>
                    <?php 
                    $i = 1;
                    $grand_total_stock = 0;
                    $stock_details = $conn->query("SELECT p.name, p.price, i.quantity 
                                                   FROM product_list p 
                                                   INNER JOIN inventory_list i ON p.id = i.product_id 
                                                   WHERE i.quantity > 0 
                                                   ORDER BY p.name ASC");
                    
                    if($stock_details->num_rows > 0):
                        while($srow = $stock_details->fetch_assoc()):
                            $subtotal = $srow['price'] * $srow['quantity'];
                            $grand_total_stock += $subtotal;
                    ?>
                    <tr>
                        <td class="text-center"><?= $i++ ?></td>
                        <td><?= $srow['name'] ?></td>
                        <td class="text-center"><?= number_format($srow['quantity']) ?></td>
                        <td class="text-right">₹ <?= number_format($srow['price'], 2) ?></td>
                        <td class="text-right font-weight-bold">₹ <?= number_format($subtotal, 2) ?></td>
                    </tr>
                    <?php endwhile; ?>
                </tbody>
                <tfoot class="bg-light">
                    <tr>
                        <th colspan="4" class="text-right text-uppercase">Grand Total Stock Value:</th>
                        <th class="text-right text-primary" style="font-size: 1.1rem;">
                            ₹ <?= number_format($grand_total_stock, 2) ?>
                        </th>
                    </tr>
                </tfoot>
                <?php else: ?>
                <tr>
                    <td colspan="5" class="text-center text-muted">No stock available in inventory.</td>
                </tr>
                <?php endif; ?>
            </table>
        </div>
    </div>
</div>

<script>
    $(document).ready(function(){
        $('#toggleStockTable').change(function(){
            if($(this).is(':checked')){
                $('#stockDetailSection').fadeIn(); // Dikhane ke liye
            } else {
                $('#stockDetailSection').fadeOut(); // Chhupane ke liye
            }
        });
    });
</script>

    </div> </div> <style>
    @media print {
        .no-print { display: none !important; }
        .card { border: none !important; box-shadow: none !important; }
        .table-responsive { overflow: visible !important; }
        .bg-navy { background-color: #001f3f !important; color: white !important; -webkit-print-color-adjust: exact; }
    }
    .text-navy { color: #001f3f; }
</style>