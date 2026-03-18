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
                <div class="col-md-6">
                    <div class="d-flex flex-wrap gap-2">
                        <button class="btn btn-primary btn-sm btn-flat">
                            <i class="fa fa-filter"></i> Filter
                        </button>
                        <button type="button" class="btn btn-success btn-sm btn-flat" onclick="window.print()">
                            <i class="fa fa-print"></i> Print
                        </button>
                        <button type="button" class="btn btn-outline-secondary btn-sm btn-flat" id="lastMonthBtn">
                            <i class="fa fa-chevron-left"></i> Last Month
                        </button>
                        <button type="button" class="btn btn-outline-secondary btn-sm btn-flat" id="nextMonthBtn">
                            Next Month <i class="fa fa-chevron-right"></i>
                        </button>
                        <button type="button" class="btn btn-outline-danger btn-sm btn-flat" id="resetBtn">
                            <i class="fa fa-refresh"></i> Reset
                        </button>
                    </div>
                </div>
            </div>
        </form>

        <?php 
// Date Filter Setup
$from = isset($_GET['from']) ? $_GET['from'] : date("Y-m-01");
$to = isset($_GET['to']) ? $_GET['to'] : date("Y-m-t");

// ==============================================================
//  FINANCIAL CALCULATIONS - CORRECTED WITH DISCOUNT
// ==============================================================

// 1. REPAIR JOBS INCOME (मरम्मत कार्य से आय)
$income_qry = $conn->query("SELECT SUM(amount) as total_amount 
                            FROM transaction_list 
                            WHERE status = 5 
                            AND date_completed BETWEEN '{$from} 00:00:00' AND '{$to} 23:59:59'");
$job_data = $income_qry->fetch_assoc();
$job_total = $job_data['total_amount'] ?? 0;
$job_income = $job_total;

// Repair jobs ka detailed data modal ke liye
$repair_jobs_detail = $conn->query("SELECT 
    t.*,
    c.firstname as client_firstname,
    c.middlename as client_middlename,
    c.lastname as client_lastname,
    m.firstname as mechanic_firstname,
    m.lastname as mechanic_lastname
    FROM transaction_list t
    LEFT JOIN client_list c ON t.client_name = c.id
    LEFT JOIN mechanic_list m ON t.mechanic_id = m.id
    WHERE t.status = 5 
    AND t.date_completed BETWEEN '{$from} 00:00:00' AND '{$to} 23:59:59'
    ORDER BY t.date_completed DESC");

// 2. WALK-IN DIRECT SALES (सीधी बिक्री – बिना ग्राहक ID के)
$walkin_qry = $conn->query("SELECT SUM(total_amount) as total_amount 
                           FROM direct_sales 
                           WHERE (client_id IS NULL OR client_id = 0 OR client_id = '')
                           AND date_created BETWEEN '{$from} 00:00:00' AND '{$to} 23:59:59'");
$walkin_data = $walkin_qry->fetch_assoc();
$walkin_income = $walkin_data['total_amount'] ?? 0;

// Walk-in sales ka detailed data
$walkin_sales_detail = $conn->query("SELECT 
    ds.*,
    p.name as product_name,
    p.price as unit_price
    FROM direct_sales ds
    LEFT JOIN direct_sale_items dsi ON ds.id = dsi.sale_id
    LEFT JOIN product_list p ON dsi.product_id = p.id
    WHERE (ds.client_id IS NULL OR ds.client_id = 0 OR ds.client_id = '')
    AND ds.date_created BETWEEN '{$from} 00:00:00' AND '{$to} 23:59:59'
    ORDER BY ds.date_created DESC");

// 3. CLIENT DIRECT SALES (ग्राहक को सीधी बिक्री – ग्राहक ID के साथ)
$client_sales_qry = $conn->query("SELECT SUM(total_amount) as total_amount 
                                 FROM direct_sales 
                                 WHERE client_id IS NOT NULL AND client_id != 0 AND client_id != ''
                                 AND date_created BETWEEN '{$from} 00:00:00' AND '{$to} 23:59:59'");
$client_sales_data = $client_sales_qry->fetch_assoc();
$client_sales_income = $client_sales_data['total_amount'] ?? 0;

// Client sales ka detailed data
$client_sales_detail = $conn->query("SELECT 
    ds.*,
    c.firstname as client_firstname,
    c.middlename as client_middlename,
    c.lastname as client_lastname,
    p.name as product_name,
    p.price as unit_price
    FROM direct_sales ds
    LEFT JOIN client_list c ON ds.client_id = c.id
    LEFT JOIN direct_sale_items dsi ON ds.id = dsi.sale_id
    LEFT JOIN product_list p ON dsi.product_id = p.id
    WHERE ds.client_id IS NOT NULL AND ds.client_id != 0 AND ds.client_id != ''
    AND ds.date_created BETWEEN '{$from} 00:00:00' AND '{$to} 23:59:59'
    ORDER BY ds.date_created DESC");

// 4. CLIENT PAYMENTS RECEIVED (ग्राहकों से प्राप्त भुगतान)
$client_payments_qry = $conn->query("SELECT SUM(amount) as total_amount, SUM(discount) as total_discount 
                                     FROM client_payments 
                                     WHERE date(payment_date) BETWEEN '{$from}' AND '{$to}'");
$cp_data = $client_payments_qry->fetch_assoc();
$client_payments_received = $cp_data['total_amount'] ?? 0;
$total_discount_given = $cp_data['total_discount'] ?? 0;

// Client payments ka detailed data
$client_payments_detail = $conn->query("SELECT 
    cp.*,
    c.firstname as client_firstname,
    c.middlename as client_middlename,
    c.lastname as client_lastname
    FROM client_payments cp
    LEFT JOIN client_list c ON cp.client_id = c.id
    WHERE date(cp.payment_date) BETWEEN '{$from}' AND '{$to}'
    ORDER BY cp.payment_date DESC");
$client_payments_details_array = [];
while($row = $client_payments_detail->fetch_assoc()){
    $client_payments_details_array[] = $row;
}

// 5. TOTAL INCOME (कुल आय) – अब क्लाइंट सेल्स भी शामिल
$total_income = $job_income + $walkin_income + $client_sales_income;

// 6. STAFF SALARY (कर्मचारी वेतन)
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

// 7. STAFF COMMISSION (कर्मचारी कमीशन)
$comm_qry = $conn->query("SELECT SUM(mechanic_commission_amount) as total FROM transaction_list 
                          WHERE status = 5 
                          AND date_updated BETWEEN '{$from} 00:00:00' AND '{$to} 23:59:59'");
$total_comm = $comm_qry->fetch_assoc()['total'] ?? 0;

// Commission ka detailed data
$commission_detail = $conn->query("SELECT 
    t.job_id,
    t.amount,
    t.mechanic_commission_amount,
    t.date_completed,
    m.firstname as mechanic_firstname,
    m.lastname as mechanic_lastname
    FROM transaction_list t
    LEFT JOIN mechanic_list m ON t.mechanic_id = m.id
    WHERE t.status = 5 
    AND t.date_updated BETWEEN '{$from} 00:00:00' AND '{$to} 23:59:59'
    ORDER BY t.date_completed DESC");

// 8. ADVANCE PAYMENTS (अग्रिम भुगतान)
$adv_qry = $conn->query("SELECT SUM(amount) as total FROM advance_payments 
                         WHERE date_paid BETWEEN '{$from}' AND '{$to}'");
$total_advance_given = $adv_qry->fetch_assoc()['total'] ?? 0;

// 9. OTHER EXPENSES (अन्य खर्च)
$exp_qry = $conn->query("SELECT SUM(amount) as total FROM expense_list 
                         WHERE date(date_created) BETWEEN '{$from}' AND '{$to}'");
$other_expenses = $exp_qry->fetch_assoc()['total'] ?? 0;

// 10. LOAN EMI PAYMENTS (लोन किस्त)
$emi_qry = $conn->query("SELECT SUM(amount_paid) as total FROM loan_payments 
                         WHERE date(payment_date) BETWEEN '{$from}' AND '{$to}'");
$total_emi_paid = $emi_qry->fetch_assoc()['total'] ?? 0;

// ==============================================================
//  FINAL PROFIT & LOSS CALCULATION
// ==============================================================

// Total Business Expenses (कुल व्यवसायिक खर्च)
$total_business_expense = $total_salary_earned + $total_comm + $other_expenses + $total_emi_paid + $total_discount_given;

// Net Profit (शुद्ध लाभ)
$net_profit = $total_income - $total_business_expense;

// Total Cash Inflow (कुल नकद आवक) – अब क्लाइंट सेल्स भी शामिल
$total_cash_inflow = $client_payments_received + $walkin_income + $client_sales_income;

// Total Cash Outflow (कुल नकद जावक)
$total_cash_outflow = $total_advance_given + $other_expenses + $total_emi_paid;
?>

<div class="row">
    <div class="col-md-3">
        <div class="info-box shadow-sm border">
            <div class="info-box-content">
                <span class="info-box-text text-muted">Net Revenue</span>
                <span class="info-box-number text-success" style="font-size: 1.5rem;">₹ <?= number_format($total_income, 2) ?></span>
                <small class="text-muted">Direct sales + Repair jobs</small>
            </div>
        </div>
    </div>
    <div class="col-md-3">
        <div class="info-box shadow-sm border">
            <div class="info-box-content">
                <span class="info-box-text text-muted">Total Expenses</span>
                <span class="info-box-number text-danger" style="font-size: 1.5rem;">₹ <?= number_format($total_business_expense, 2) ?></span>
                <small class="text-muted">Sal+Comm+Exp+EMI+Discount</small>
            </div>
        </div>
    </div>
    <div class="col-md-3">
        <div class="info-box shadow-sm border">
            <div class="info-box-content">
                <span class="info-box-text text-muted">Cash Received</span>
                <span class="info-box-number text-info" style="font-size: 1.5rem;">₹ <?= number_format($total_cash_inflow, 2) ?></span>
                <small class="text-muted">Actual cash inflow (after discount)</small>
            </div>
        </div>
    </div>
    <div class="col-md-3">
        <div class="info-box shadow-sm border <?= $net_profit >= 0 ? 'bg-light' : 'bg-warning' ?>">
            <div class="info-box-content">
                <span class="info-box-text text-muted">Net Profit/Loss</span>
                <span class="info-box-number <?= $net_profit >= 0 ? 'text-primary' : 'text-danger' ?>" style="font-size: 1.5rem;">
                    ₹ <?= number_format($net_profit, 2) ?>
                </span>
            </div>
        </div>
    </div>
</div>

<div class="row mt-4">
    <div class="col-md-6">
        <h5 class="text-navy border-bottom pb-2">Business Performance (P&L)</h5>
        <table class="table table-sm table-hover">
            <tr class="bg-light">
                <th colspan="2">Revenue (कमाई)</th>
            </tr>
            <tr>
                <td>
                    <a href="javascript:void(0)" class="text-primary" onclick="showRepairJobsDetails()" data-toggle="tooltip" title="Click to view details">
                        <i class="fas fa-eye mr-1"></i> Repair Jobs Income
                    </a>
                </td>
                <td class="text-right">₹ <?= number_format($job_income, 2) ?></td>
            </tr>
            <tr>
                <td>
                    <a href="javascript:void(0)" class="text-primary" onclick="showWalkinSalesDetails()" data-toggle="tooltip" title="Click to view details">
                        <i class="fas fa-eye mr-1"></i> Walk-in Direct Sales
                    </a>
                </td>
                <td class="text-right">₹ <?= number_format($walkin_income, 2) ?></td>
            </tr>
            <tr>
                <td>
                    <a href="javascript:void(0)" class="text-primary" onclick="showClientSalesDetails()" data-toggle="tooltip" title="Click to view details">
                        <i class="fas fa-eye mr-1"></i> Client Direct Sales
                    </a>
                </td>
                <td class="text-right">₹ <?= number_format($client_sales_income, 2) ?></td>
            </tr>
            <tr class="bg-light">
                <th>Net Revenue</th>
                <th class="text-right text-primary">₹ <?= number_format($total_income, 2) ?></th>
            </tr>
            
            <tr class="bg-light">
                <th colspan="2">Expenses (खर्च)</th>
            </tr>
            <tr>
                <td>
                    <a href="javascript:void(0)" class="text-primary" onclick="showStaffSalariesDetails()" data-toggle="tooltip" title="Click to view details">
                        <i class="fas fa-eye mr-1"></i> Staff Salaries
                    </a>
                </td>
                <td class="text-right text-danger">(-) ₹ <?= number_format($total_salary_earned, 2) ?></td>
            </tr>
            <tr>
                <td>
                    <a href="javascript:void(0)" class="text-primary" onclick="showCommissionDetails()" data-toggle="tooltip" title="Click to view details">
                        <i class="fas fa-eye mr-1"></i> Mechanic Commission
                    </a>
                </td>
                <td class="text-right text-danger">(-) ₹ <?= number_format($total_comm, 2) ?></td>
            </tr>
            <tr>
                <td>
                    <a href="javascript:void(0)" class="text-primary" onclick="showShopExpensesDetails()" data-toggle="tooltip" title="Click to view details">
                        <i class="fas fa-eye mr-1"></i> Shop Expenses
                    </a>
                </td>
                <td class="text-right text-danger">(-) ₹ <?= number_format($other_expenses, 2) ?></td>
            </tr>
            <tr>
                <td>Loan EMI Payments</td>
                <td class="text-right text-danger">(-) ₹ <?= number_format($total_emi_paid, 2) ?></td>
            </tr>
            <tr>
                <td>
                    <a href="javascript:void(0)" class="text-primary" onclick="showDiscountDetails()" data-toggle="tooltip" title="Click to view details">
                        <i class="fas fa-eye mr-1"></i> Customer Discount Given
                    </a>
                </td>
                <td class="text-right text-danger">(-) ₹ <?= number_format($total_discount_given, 2) ?></td>
            </tr>
            <tr class="bg-light">
                <th>Total Expenses</th>
                <th class="text-right text-danger">₹ <?= number_format($total_business_expense, 2) ?></th>
            </tr>
            
            <tr class="bg-navy text-white">
                <th>Net Profit/Loss</th>
                <th class="text-right <?= $net_profit >= 0 ? 'text-success' : 'text-danger' ?>">
                    ₹ <?= number_format($net_profit, 2) ?>
                </th>
            </tr>
        </table>
    </div>
    
    <div class="col-md-6">
        <h5 class="text-navy border-bottom pb-2">Cash Flow (नकदी प्रवाह)</h5>
        <table class="table table-sm table-hover">
            <tr class="bg-light">
                <th colspan="2">Cash Inflow (नकद आय)</th>
            </tr>
            <tr>
                <td>
                    <a href="javascript:void(0)" class="text-primary" onclick="showClientPaymentsDetails()" data-toggle="tooltip" title="Click to view details">
                        <i class="fas fa-eye mr-1"></i> Client Payments Received (After Discount)
                    </a>
                </td>
                <td class="text-right text-success">₹ <?= number_format($client_payments_received, 2) ?></td>
            </tr>
            <tr>
                <td>
                    <a href="javascript:void(0)" class="text-primary" onclick="showWalkinSalesDetails()" data-toggle="tooltip" title="Click to view details">
                        <i class="fas fa-eye mr-1"></i> Walk-in Direct Sales (Cash)
                    </a>
                </td>
                <td class="text-right text-success">₹ <?= number_format($walkin_income, 2) ?></td>
            </tr>
            <tr>
                <td>
                    <a href="javascript:void(0)" class="text-primary" onclick="showClientSalesDetails()" data-toggle="tooltip" title="Click to view details">
                        <i class="fas fa-eye mr-1"></i> Client Direct Sales (Cash)
                    </a>
                </td>
                <td class="text-right text-success">₹ <?= number_format($client_sales_income, 2) ?></td>
            </tr>
            <tr class="bg-light">
                <th>Total Cash In</th>
                <th class="text-right text-success">₹ <?= number_format($total_cash_inflow, 2) ?></th>
            </tr>
            
            <tr class="bg-light">
                <th colspan="2">Cash Outflow (नकद भुगतान)</th>
            </tr>
            <tr>
                <td>
                    <a href="javascript:void(0)" class="text-primary" onclick="showStaffAdvanceDetails()" data-toggle="tooltip" title="Click to view details">
                        <i class="fas fa-eye mr-1"></i> Staff Advance/Salary Paid
                    </a>
                </td>
                <td class="text-right text-danger">(-) ₹ <?= number_format($total_advance_given, 2) ?></td>
            </tr>
            <tr>
                <td>
                    <a href="javascript:void(0)" class="text-primary" onclick="showShopExpensesDetails()" data-toggle="tooltip" title="Click to view details">
                        <i class="fas fa-eye mr-1"></i> Shop Expenses Paid
                    </a>
                </td>
                <td class="text-right text-danger">(-) ₹ <?= number_format($other_expenses, 2) ?></td>
            </tr>
            <tr>
                <td>Loan EMI Paid</td>
                <td class="text-right text-danger">(-) ₹ <?= number_format($total_emi_paid, 2) ?></td>
            </tr>
            <tr class="bg-light">
                <th>Total Cash Out</th>
                <th class="text-right text-danger">₹ <?= number_format($total_cash_outflow, 2) ?></th>
            </tr>
            
            <tr class="bg-info text-white">
                <th>Net Cash Flow</th>
                <th class="text-right">
                    ₹ <?= number_format($total_cash_inflow - $total_cash_outflow, 2) ?>
                </th>
            </tr>
        </table>
        
        <div class="alert alert-warning mt-3">
            <i class="fa fa-info-circle"></i> 
            <strong>Important:</strong> 
            <ul class="mb-0 pl-3">
                <li>Repair Job Revenue is recognized when job is completed/delivered</li>
                <li>Client Payments are collections against invoices (not new revenue)</li>
                <li>Direct Sales (both walk‑in and client) are recognized at time of sale</li>
                <li>Discount given to customers is treated as business expense</li>
                <li>Click on <i class="fas fa-eye text-primary"></i> icons to view detailed transactions</li>
            </ul>
        </div>
    </div>
</div>

<!-- Modals for Detailed Views -->

<!-- Repair Jobs Modal (unchanged) -->
<div class="modal fade" id="repairJobsModal" tabindex="-1" role="dialog" aria-labelledby="repairJobsModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-xl" role="document">
        <div class="modal-content">
            <div class="modal-header bg-navy text-white">
                <h5 class="modal-title" id="repairJobsModalLabel">
                    <i class="fas fa-tools mr-2"></i> Repair Jobs Details
                    <small class="text-light">(<?= date("d M Y", strtotime($from)) ?> to <?= date("d M Y", strtotime($to)) ?>)</small>
                </h5>
                <button type="button" class="close text-white" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <div class="table-responsive">
                    <table class="table table-bordered table-striped table-sm">
                        <thead class="bg-light">
                            <tr>
                                <th>Job Code</th>
                                <th>Client</th>
                                <th>Items</th>
                                <th>Mechanic</th>
                                <th class="text-right">Amount</th>
                                <th class="text-right">Commission</th>
                                <th>Completed Date</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php 
                            $repair_jobs_total = 0;
                            $repair_commission_total = 0;
                            if($repair_jobs_detail->num_rows > 0):
                                while($row = $repair_jobs_detail->fetch_assoc()):
                                    $repair_jobs_total += $row['amount'];
                                    $repair_commission_total += $row['mechanic_commission_amount'];
                            ?>
                            <tr>
                                <td><?= $row['job_id'] ?></td>
                                <td><?= $row['client_firstname'] . ' ' . $row['client_middlename'] . ' ' . $row['client_lastname'] ?></td>
                                <td><?= $row['item'] ?></td>
                                <td><?= $row['mechanic_firstname'] . ' ' . $row['mechanic_lastname'] ?></td>
                                <td class="text-right text-success">₹ <?= number_format($row['amount'], 2) ?></td>
                                <td class="text-right text-warning">₹ <?= number_format($row['mechanic_commission_amount'], 2) ?></td>
                                <td><?= date("d-M-Y", strtotime($row['date_completed'])) ?></td>
                                <td><span class="badge badge-success">Completed</span></td>
                            </tr>
                            <?php endwhile; ?>
                        </tbody>
                        <tfoot class="bg-light">
                            <tr class="font-weight-bold">
                                <td colspan="4" class="text-right">Total:</td>
                                <td class="text-right text-success">₹ <?= number_format($repair_jobs_total, 2) ?></td>
                                <td class="text-right text-warning">₹ <?= number_format($repair_commission_total, 2) ?></td>
                                <td colspan="2"></td>
                            </tr>
                        </tfoot>
                        <?php else: ?>
                        <tr><td colspan="8" class="text-center text-muted">No repair jobs found in this period.</td></tr>
                        <?php endif; ?>
                    </table>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
            </div>
        </div>
    </div>
</div>

<!-- Walk-in Direct Sales Modal (unchanged, but renamed from directSalesModal) -->
<div class="modal fade" id="walkinSalesModal" tabindex="-1" role="dialog" aria-labelledby="walkinSalesModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-xl" role="document">
        <div class="modal-content">
            <div class="modal-header bg-primary text-white">
                <h5 class="modal-title" id="walkinSalesModalLabel">
                    <i class="fas fa-shopping-cart mr-2"></i> Walk-in Direct Sales Details
                    <small class="text-light">(<?= date("d M Y", strtotime($from)) ?> to <?= date("d M Y", strtotime($to)) ?>)</small>
                </h5>
                <button type="button" class="close text-white" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <div class="table-responsive">
                    <table class="table table-bordered table-striped table-sm">
                        <thead class="bg-light">
                            <tr>
                                <th>Invoice No</th>
                                <th>Product</th>
                                <th>Quantity</th>
                                <th class="text-right">Unit Price</th>
                                <th class="text-right">Total</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php 
                            $walkin_sales_total = 0;
                            if($walkin_sales_detail->num_rows > 0):
                                while($row = $walkin_sales_detail->fetch_assoc()):
                                    $walkin_sales_total += $row['total_amount'];
                            ?>
                            <tr>
                                <td><?= $row['sale_code'] ?></td>
                                <td><?= $row['product_name'] ?? 'Multiple Items' ?></td>
                                <td><?= $row['quantity'] ?? 'N/A' ?></td>
                                <td class="text-right">₹ <?= number_format($row['unit_price'] ?? 0, 2) ?></td>
                                <td class="text-right text-success">₹ <?= number_format($row['total_amount'], 2) ?></td>
                                <td><?= date("d-M-Y H:i", strtotime($row['date_created'])) ?></td>
                            </tr>
                            <?php endwhile; ?>
                        </tbody>
                        <tfoot class="bg-light">
                            <tr class="font-weight-bold">
                                <td colspan="4" class="text-right">Total Sales:</td>
                                <td class="text-right text-success">₹ <?= number_format($walkin_sales_total, 2) ?></td>
                                <td></td>
                            </tr>
                        </tfoot>
                        <?php else: ?>
                        <tr><td colspan="6" class="text-center text-muted">No walk-in sales found in this period.</td></tr>
                        <?php endif; ?>
                    </table>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
            </div>
        </div>
    </div>
</div>

<!-- New Client Direct Sales Modal -->
<div class="modal fade" id="clientSalesModal" tabindex="-1" role="dialog" aria-labelledby="clientSalesModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-xl" role="document">
        <div class="modal-content">
            <div class="modal-header bg-info text-white">
                <h5 class="modal-title" id="clientSalesModalLabel">
                    <i class="fas fa-user-tie mr-2"></i> Client Direct Sales Details
                    <small class="text-light">(<?= date("d M Y", strtotime($from)) ?> to <?= date("d M Y", strtotime($to)) ?>)</small>
                </h5>
                <button type="button" class="close text-white" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <div class="table-responsive">
                    <table class="table table-bordered table-striped table-sm">
                        <thead class="bg-light">
                            <tr>
                                <th>Invoice No</th>
                                <th>Client</th>
                                <th>Product</th>
                                <th>Quantity</th>
                                <th class="text-right">Unit Price</th>
                                <th class="text-right">Total</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php 
                            $client_sales_total = 0;
                            if($client_sales_detail->num_rows > 0):
                                while($row = $client_sales_detail->fetch_assoc()):
                                    $client_sales_total += $row['total_amount'];
                            ?>
                            <tr>
                                <td><?= $row['sale_code'] ?></td>
                                <td><?= $row['client_firstname'] . ' ' . $row['client_middlename'] . ' ' . $row['client_lastname'] ?></td>
                                <td><?= $row['product_name'] ?? 'Multiple Items' ?></td>
                                <td><?= $row['quantity'] ?? 'N/A' ?></td>
                                <td class="text-right">₹ <?= number_format($row['unit_price'] ?? 0, 2) ?></td>
                                <td class="text-right text-success">₹ <?= number_format($row['total_amount'], 2) ?></td>
                                <td><?= date("d-M-Y H:i", strtotime($row['date_created'])) ?></td>
                            </tr>
                            <?php endwhile; ?>
                        </tbody>
                        <tfoot class="bg-light">
                            <tr class="font-weight-bold">
                                <td colspan="5" class="text-right">Total Client Sales:</td>
                                <td class="text-right text-success">₹ <?= number_format($client_sales_total, 2) ?></td>
                                <td></td>
                            </tr>
                        </tfoot>
                        <?php else: ?>
                        <tr><td colspan="7" class="text-center text-muted">No client sales found in this period.</td></tr>
                        <?php endif; ?>
                    </table>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
            </div>
        </div>
    </div>
</div>

<!-- Client Payments Modal (unchanged) -->
<div class="modal fade" id="clientPaymentsModal" tabindex="-1" role="dialog" aria-labelledby="clientPaymentsModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-xl" role="document">
        <div class="modal-content">
            <div class="modal-header bg-success text-white">
                <h5 class="modal-title" id="clientPaymentsModalLabel">
                    <i class="fas fa-money-bill-wave mr-2"></i> Client Payments Details
                    <small class="text-light">(<?= date("d M Y", strtotime($from)) ?> to <?= date("d M Y", strtotime($to)) ?>)</small>
                </h5>
                <button type="button" class="close text-white" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <div class="table-responsive">
                    <table class="table table-bordered table-striped table-sm">
                        <thead class="bg-light">
                            <tr>
                                <th>Client</th>
                                <th>Payment Date</th>
                                <th class="text-right">Net Received</th>
                                <th class="text-right">Discount</th>
                                <th class="text-right">Total Amount</th>
                                <th>Remarks</th>
                                <th>Payment Method</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php 
                            $cp_total = 0;
                            $cp_discount_total = 0;
                            if(count($client_payments_details_array) > 0):
                                foreach($client_payments_details_array as $row):
                                    $cp_total += $row['amount'];
                                    $cp_discount_total += $row['discount'];
                                    $net_received = $row['amount'] + $row['discount'];
                            ?>
                            <tr>
                                <td><?= $row['client_firstname'] . ' ' . $row['client_middlename'] . ' ' . $row['client_lastname'] ?></td>
                                <td><?= date("d-M-Y", strtotime($row['payment_date'])) ?></td>
                                <td class="text-right">₹ <?= number_format($row['amount'], 2) ?></td>
                                <td class="text-right text-danger">₹ <?= number_format($row['discount'], 2) ?></td>
                                <td class="text-right text-success">₹ <?= number_format($net_received, 2) ?></td>
                                <td><?= $row['remarks'] ?></td>
                                <td><?= $row['payment_method'] ?? 'Cash' ?></td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                        <tfoot class="bg-light">
                            <tr class="font-weight-bold">
                                <td colspan="2" class="text-right">Total:</td>
                                <td class="text-right">₹ <?= number_format($cp_total, 2) ?></td>
                                <td class="text-right text-danger">₹ <?= number_format($cp_discount_total, 2) ?></td>
                                <td class="text-right text-success">₹ <?= number_format($cp_total + $cp_discount_total, 2) ?></td>
                                <td colspan="2"></td>
                            </tr>
                        </tfoot>
                        <?php else: ?>
                        <tr><td colspan="7" class="text-center text-muted">No client payments found in this period.</td></tr>
                        <?php endif; ?>
                    </table>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
            </div>
        </div>
    </div>
</div>

<!-- Commission Modal (unchanged) -->
<div class="modal fade" id="commissionModal" tabindex="-1" role="dialog" aria-labelledby="commissionModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-xl" role="document">
        <div class="modal-content">
            <div class="modal-header bg-warning text-dark">
                <h5 class="modal-title" id="commissionModalLabel">
                    <i class="fas fa-hand-holding-usd mr-2"></i> Mechanic Commission Details
                    <small class="text-dark">(<?= date("d M Y", strtotime($from)) ?> to <?= date("d M Y", strtotime($to)) ?>)</small>
                </h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <div class="table-responsive">
                    <table class="table table-bordered table-striped table-sm">
                        <thead class="bg-light">
                            <tr>
                                <th>Job Code</th>
                                <th>Mechanic</th>
                                <th class="text-right">Job Amount</th>
                                <th class="text-right">Commission</th>
                                <th>Commission %</th>
                                <th>Completed Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php 
                            $commission_total = 0;
                            $job_amount_total = 0;
                            if($commission_detail->num_rows > 0):
                                while($row = $commission_detail->fetch_assoc()):
                                    $commission_total += $row['mechanic_commission_amount'];
                                    $job_amount_total += $row['amount'];
                                    $commission_percent = $row['amount'] > 0 ? ($row['mechanic_commission_amount'] / $row['amount']) * 100 : 0;
                            ?>
                            <tr>
                                <td><?= $row['job_id'] ?></td>
                                <td><?= $row['mechanic_firstname'] . ' ' . $row['mechanic_lastname'] ?></td>
                                <td class="text-right">₹ <?= number_format($row['amount'], 2) ?></td>
                                <td class="text-right text-warning">₹ <?= number_format($row['mechanic_commission_amount'], 2) ?></td>
                                <td class="text-center"><?= number_format($commission_percent, 1) ?>%</td>
                                <td><?= date("d-M-Y", strtotime($row['date_completed'])) ?></td>
                            </tr>
                            <?php endwhile; ?>
                        </tbody>
                        <tfoot class="bg-light">
                            <tr class="font-weight-bold">
                                <td colspan="2" class="text-right">Total:</td>
                                <td class="text-right">₹ <?= number_format($job_amount_total, 2) ?></td>
                                <td class="text-right text-warning">₹ <?= number_format($commission_total, 2) ?></td>
                                <td class="text-center"><?= $job_amount_total > 0 ? number_format(($commission_total / $job_amount_total) * 100, 1) : 0 ?>%</td>
                                <td></td>
                            </tr>
                        </tfoot>
                        <?php else: ?>
                        <tr><td colspan="6" class="text-center text-muted">No commission data found in this period.</td></tr>
                        <?php endif; ?>
                    </table>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
            </div>
        </div>
    </div>
</div>

<!-- Discount Modal (unchanged) -->
<div class="modal fade" id="discountModal" tabindex="-1" role="dialog" aria-labelledby="discountModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-xl" role="document">
        <div class="modal-content">
            <div class="modal-header bg-danger text-white">
                <h5 class="modal-title" id="discountModalLabel">
                    <i class="fas fa-tag mr-2"></i> Customer Discount Details
                    <small class="text-light">(<?= date("d M Y", strtotime($from)) ?> to <?= date("d M Y", strtotime($to)) ?>)</small>
                </h5>
                <button type="button" class="close text-white" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <div class="table-responsive">
                    <table class="table table-bordered table-striped table-sm">
                        <thead class="bg-light">
                            <tr>
                                <th>Client</th>
                                <th>Payment Date</th>
                                <th class="text-right">Original Amount</th>
                                <th class="text-right">Discount Given</th>
                                <th>Discount %</th>
                                <th>Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php 
                            $discount_total = 0;
                            $original_total = 0;
                            if(count($client_payments_details_array) > 0):
                                foreach($client_payments_details_array as $row):
                                    if($row['discount'] > 0):
                                        $discount_total += $row['discount'];
                                        $original_total += $row['amount'];
                                        $discount_percent = $row['amount'] > 0 ? ($row['discount'] / $row['amount']) * 100 : 0;
                            ?>
                            <tr>
                                <td><?= $row['client_firstname'] . ' ' . $row['client_lastname'] ?></td>
                                <td><?= date("d-M-Y", strtotime($row['payment_date'])) ?></td>
                                <td class="text-right">₹ <?= number_format($row['amount'], 2) ?></td>
                                <td class="text-right text-danger">₹ <?= number_format($row['discount'], 2) ?></td>
                                <td class="text-center"><?= number_format($discount_percent, 1) ?>%</td>
                                <td><?= $row['remarks'] ?></td>
                            </tr>
                            <?php 
                                    endif;
                                endforeach; 
                            ?>
                        </tbody>
                        <tfoot class="bg-light">
                            <tr class="font-weight-bold">
                                <td colspan="2" class="text-right">Total:</td>
                                <td class="text-right">₹ <?= number_format($original_total, 2) ?></td>
                                <td class="text-right text-danger">₹ <?= number_format($discount_total, 2) ?></td>
                                <td class="text-center"><?= $original_total > 0 ? number_format(($discount_total / $original_total) * 100, 1) : 0 ?>%</td>
                                <td></td>
                            </tr>
                        </tfoot>
                        <?php else: ?>
                        <tr><td colspan="6" class="text-center text-muted">No discount data found in this period.</td></tr>
                        <?php endif; ?>
                    </table>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
            </div>
        </div>
    </div>
</div>

<!-- Staff Salaries Modal (unchanged) -->
<div class="modal fade" id="staffSalariesModal" tabindex="-1" role="dialog" aria-labelledby="staffSalariesModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-xl" role="document">
        <div class="modal-content">
            <div class="modal-header bg-warning text-dark">
                <h5 class="modal-title" id="staffSalariesModalLabel">
                    <i class="fas fa-money-check-alt mr-2"></i> Staff Salaries Details
                    <small class="text-dark">(<?= date("d M Y", strtotime($from)) ?> to <?= date("d M Y", strtotime($to)) ?>)</small>
                </h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <div class="table-responsive">
                    <table class="table table-bordered table-striped table-sm">
                        <thead class="bg-light">
                            <tr>
                                <th>Mechanic</th>
                                <th class="text-center">Full Days</th>
                                <th class="text-center">Half Days</th>
                                <th class="text-center">Total Days</th>
                                <th class="text-right">Daily Rate</th>
                                <th class="text-right">Salary Earned</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php 
                            $salary_total = 0;
                            $salary_qry = $conn->query("
                                SELECT m.id, CONCAT(m.firstname, ' ', m.lastname) as mechanic_name,
                                       SUM(CASE WHEN a.status = 1 THEN 1 ELSE 0 END) as full_days,
                                       SUM(CASE WHEN a.status = 3 THEN 1 ELSE 0 END) as half_days,
                                       m.daily_salary
                                FROM mechanic_list m
                                LEFT JOIN attendance_list a ON m.id = a.mechanic_id 
                                    AND a.curr_date BETWEEN '{$from}' AND '{$to}'
                                    AND a.status IN (1,3)
                                GROUP BY m.id
                                ORDER BY mechanic_name
                            ");
                            
                            if($salary_qry->num_rows > 0):
                                while($row = $salary_qry->fetch_assoc()):
                                    $total_days = $row['full_days'] + ($row['half_days'] * 0.5);
                                    $salary_earned = $total_days * $row['daily_salary'];
                                    $salary_total += $salary_earned;
                            ?>
                            <tr>
                                <td><?= $row['mechanic_name'] ?></td>
                                <td class="text-center"><?= $row['full_days'] ?></td>
                                <td class="text-center"><?= $row['half_days'] ?></td>
                                <td class="text-center"><?= number_format($total_days, 1) ?></td>
                                <td class="text-right">₹ <?= number_format($row['daily_salary'], 2) ?></td>
                                <td class="text-right text-warning">₹ <?= number_format($salary_earned, 2) ?></td>
                            </tr>
                            <?php endwhile; ?>
                        </tbody>
                        <tfoot class="bg-light">
                            <tr class="font-weight-bold">
                                <td colspan="5" class="text-right">Total Salary Expense:</td>
                                <td class="text-right text-danger">₹ <?= number_format($salary_total, 2) ?></td>
                            </tr>
                        </tfoot>
                        <?php else: ?>
                        <tr><td colspan="6" class="text-center text-muted">No salary data found in this period.</td></tr>
                        <?php endif; ?>
                    </table>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
            </div>
        </div>
    </div>
</div>

<!-- Staff Advance Modal (unchanged) -->
<div class="modal fade" id="staffAdvanceModal" tabindex="-1" role="dialog" aria-labelledby="staffAdvanceModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content">
            <div class="modal-header bg-info text-white">
                <h5 class="modal-title" id="staffAdvanceModalLabel">
                    <i class="fas fa-hand-holding-usd mr-2"></i> Staff Advance Payments
                    <small class="text-light">(<?= date("d M Y", strtotime($from)) ?> to <?= date("d M Y", strtotime($to)) ?>)</small>
                </h5>
                <button type="button" class="close text-white" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <div class="table-responsive">
                    <table class="table table-bordered table-striped table-sm">
                        <thead class="bg-light">
                            <tr>
                                <th>Date</th>
                                <th>Staff</th>
                                <th class="text-right">Amount</th>
                                <th>Reason</th>
                                <th>Payment Mode</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php 
                            $advance_total = 0;
                            $advance_detail = $conn->query("
                                SELECT ap.*, 
                                       CONCAT(m.firstname, ' ', m.lastname) as mechanic_name
                                FROM advance_payments ap
                                LEFT JOIN mechanic_list m ON ap.mechanic_id = m.id
                                WHERE date(ap.date_paid) BETWEEN '{$from}' AND '{$to}'
                                ORDER BY ap.date_paid DESC
                            ");
                            
                            if($advance_detail->num_rows > 0):
                                while($row = $advance_detail->fetch_assoc()):
                                    $advance_total += $row['amount'];
                            ?>
                            <tr>
                                <td><?= date("d-M-Y", strtotime($row['date_paid'])) ?></td>
                                <td><?= $row['mechanic_name'] ?></td>
                                <td class="text-right text-danger">₹ <?= number_format($row['amount'], 2) ?></td>
                                <td><?= $row['reason'] ?></td>
                                <td><?= $row['payment_mode'] ?? 'Cash' ?></td>
                            </tr>
                            <?php endwhile; ?>
                        </tbody>
                        <tfoot class="bg-light">
                            <tr class="font-weight-bold">
                                <td colspan="2" class="text-right">Total Advance Paid:</td>
                                <td class="text-right text-danger">₹ <?= number_format($advance_total, 2) ?></td>
                                <td colspan="2"></td>
                            </tr>
                        </tfoot>
                        <?php else: ?>
                        <tr><td colspan="5" class="text-center text-muted">No advance payments found in this period.</td></tr>
                        <?php endif; ?>
                    </table>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
            </div>
        </div>
    </div>
</div>

<!-- Shop Expenses Modal (unchanged) -->
<div class="modal fade" id="shopExpensesModal" tabindex="-1" role="dialog" aria-labelledby="shopExpensesModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-xl" role="document">
        <div class="modal-content">
            <div class="modal-header bg-danger text-white">
                <h5 class="modal-title" id="shopExpensesModalLabel">
                    <i class="fas fa-file-invoice-dollar mr-2"></i> Shop Expenses Details
                    <small class="text-light">(<?= date("d M Y", strtotime($from)) ?> to <?= date("d M Y", strtotime($to)) ?>)</small>
                </h5>
                <button type="button" class="close text-white" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <div class="table-responsive">
                    <table class="table table-bordered table-striped table-sm">
                        <thead class="bg-light">
                            <tr>
                                <th>Date</th>
                                <th>Expense Category</th>
                                <th>Description</th>
                                <th class="text-right">Amount</th>
                                <th>Payment Mode</th>
                                <th>Reference</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php 
                            $expenses_total = 0;
                            $expenses_detail = $conn->query("
                                SELECT * FROM expense_list 
                                WHERE date(date_created) BETWEEN '{$from}' AND '{$to}'
                                ORDER BY date_created DESC
                            ");
                            
                            if($expenses_detail->num_rows > 0):
                                while($row = $expenses_detail->fetch_assoc()):
                                    $expenses_total += $row['amount'];
                            ?>
                            <tr>
                                <td><?= date("d-M-Y", strtotime($row['date_created'])) ?></td>
                                <td><?= $row['category'] ?></td>
                                <td><?= $row['remarks'] ?></td>
                                <td class="text-right text-danger">₹ <?= number_format($row['amount'], 2) ?></td>
                                <td><?= $row['payment_mode'] ?? 'Cash' ?></td>
                                <td><?= $row['reference'] ?? '-' ?></td>
                            </tr>
                            <?php endwhile; ?>
                        </tbody>
                        <tfoot class="bg-light">
                            <tr class="font-weight-bold">
                                <td colspan="3" class="text-right">Total Shop Expenses:</td>
                                <td class="text-right text-danger">₹ <?= number_format($expenses_total, 2) ?></td>
                                <td colspan="2"></td>
                            </tr>
                        </tfoot>
                        <?php else: ?>
                        <tr><td colspan="6" class="text-center text-muted">No expenses found in this period.</td></tr>
                        <?php endif; ?>
                    </table>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
            </div>
        </div>
    </div>
</div>

<?php 
// LEDGER QUERY - अब सभी डायरेक्ट सेल्स शामिल हैं (वॉक-इन + क्लाइंट)
$running_balance = 0;

$query_string = "
    -- 1. Client Payments (ग्राहक भुगतान) - NET AMOUNT (after discount)
    (SELECT cp.payment_date as date, cp.amount as net_amount, 'Cash In' as type, 'Client Payment' as category, 
     CONCAT(COALESCE(cl.firstname,''), ' ', COALESCE(cl.lastname,''), ' (', COALESCE(cp.remarks,''), 
     IF(cp.discount > 0, CONCAT(' | Discount: ₹', cp.discount), ''), ')') as details,
     cl.id as client_id,
     CONCAT(COALESCE(cl.firstname,''), ' ', COALESCE(cl.lastname,'')) as client_fullname,
     COALESCE(cp.remarks, '') as payment_remarks,
     cp.discount as discount_amount
     FROM client_payments cp 
     LEFT JOIN client_list cl ON cp.client_id = cl.id
     WHERE date(cp.payment_date) BETWEEN '{$from}' AND '{$to}')
    
    UNION ALL
    
     -- 2. Direct Sales (WALK-IN only - immediate cash)
    (SELECT date_created as date, total_amount as net_amount, 'Cash In' as type, 'Direct Sale (Walk-in)' as category,
     CONCAT('Invoice: ', sale_code) as details,
     NULL as client_id, NULL as client_fullname, NULL as payment_remarks, 0 as discount_amount
     FROM direct_sales
     WHERE (client_id IS NULL OR client_id = 0 OR client_id = '')
     AND date(date_created) BETWEEN '{$from}' AND '{$to}')
    
    UNION ALL
    
    -- 3. Shop Expenses (दुकान खर्च)
    (SELECT date_created as date, amount as net_amount, 'Cash Out' as type, 'Shop Expense' as category, 
     CONCAT(category, ' - ', COALESCE(remarks,'')) as details,
     NULL as client_id, NULL as client_fullname, NULL as payment_remarks, 0 as discount_amount
     FROM expense_list 
     WHERE date(date_created) BETWEEN '{$from}' AND '{$to}')
    
    UNION ALL
    
    -- 4. Loan EMI Payments (लोन किस्त)
    (SELECT payment_date as date, amount_paid as net_amount, 'Cash Out' as type, 'Loan EMI' as category,
     COALESCE(remarks, 'EMI Payment') as details,
     NULL as client_id, NULL as client_fullname, NULL as payment_remarks, 0 as discount_amount
     FROM loan_payments
     WHERE date(payment_date) BETWEEN '{$from}' AND '{$to}')

    UNION ALL
    
    -- 5. Staff Advance Payments (कर्मचारी अग्रिम)
    (SELECT ap.date_paid as date, ap.amount as net_amount, 'Cash Out' as type, 'Staff Advance' as category,
     CONCAT(COALESCE(m.firstname,''), ' ', COALESCE(m.lastname,''), ' - ', COALESCE(ap.reason,'')) as details,
     NULL as client_id, NULL as client_fullname, NULL as payment_remarks, 0 as discount_amount
     FROM advance_payments ap 
     LEFT JOIN mechanic_list m ON ap.mechanic_id = m.id
     WHERE date(ap.date_paid) BETWEEN '{$from}' AND '{$to}')
    
    ORDER BY date ASC, details ASC";

$ledger_qry = $conn->query($query_string);
?>

<!-- COMPACT TRANSACTION LEDGER -->
<div class="card card-outline card-navy shadow mt-4">
    <div class="card-header d-flex justify-content-between align-items-center py-2">
        <h3 class="card-title font-weight-bold mb-0" style="font-size: 1.1rem;">
            <i class="fas fa-list mr-2"></i> Transaction Ledger (Cash Flow)
        </h3>
        <div class="small">
            <span class="badge badge-success">Cash In</span>
            <span class="badge badge-danger ml-2">Cash Out</span>
        </div>
    </div>
    <div class="card-body p-0">
        <div class="ledger-details compact-ledger" style="max-height: 350px; overflow-y: auto;">
            <table class="table table-sm table-hover mb-0">
                <thead class="bg-navy text-white sticky-top" style="top: 0;">
                    <tr>
                        <th style="width: 15%;">Date</th>
                        <th style="width: 20%;">Category</th>
                        <th style="width: 30%;">Details</th>
                        <th style="width: 15%;" class="text-right">Cash In</th>
                        <th style="width: 15%;" class="text-right">Cash Out</th>
                        <th style="width: 15%;" class="text-right">Balance</th>
                    </tr>
                </thead>
                <tbody>
                    <?php 
                    $total_in = 0; $total_out = 0;
                    if($ledger_qry && $ledger_qry->num_rows > 0):
                        while($row = $ledger_qry->fetch_assoc()):
                            if($row['type'] == 'Cash In'){
                                $total_in += $row['net_amount'];
                                $running_balance += $row['net_amount'];
                            } else {
                                $total_out += $row['net_amount'];
                                $running_balance -= $row['net_amount'];
                            }
                            
                            // Compact details
                            if($row['category'] == 'Client Payment' && !empty($row['client_id'])) {
                                $display_details = '<span class="text-dark">' . 
                                                    $row['client_fullname'] . '</span>';
                                if($row['discount_amount'] > 0) {
                                    $display_details .= ' <small class="text-danger">(-₹' . 
                                                        number_format($row['discount_amount'], 0) . ')</small>';
                                }
                            } else {
                                $display_details = '<small>' . substr($row['details'], 0, 30) . 
                                                  (strlen($row['details']) > 30 ? '...' : '') . '</small>';
                            }
                    ?>
                    <tr>
                        <td><small><?= date("d-m-y", strtotime($row['date'])) ?></small></td>
                        <td>
                            <span class="badge <?= $row['type'] == 'Cash In' ? 'badge-success' : 'badge-danger' ?>">
                                <?= $row['category'] ?>
                            </span>
                        </td>
                        <td><?= $display_details ?></td>
                        <td class="text-right <?= $row['type'] == 'Cash In' ? 'text-success font-weight-bold' : 'text-muted' ?>">
                            <?= $row['type'] == 'Cash In' ? '₹' . number_format($row['net_amount'],0) : '-' ?>
                        </td>
                        <td class="text-right <?= $row['type'] == 'Cash Out' ? 'text-danger font-weight-bold' : 'text-muted' ?>">
                            <?= $row['type'] == 'Cash Out' ? '₹' . number_format($row['net_amount'],0) : '-' ?>
                        </td>
                        <td class="text-right font-weight-bold <?= $running_balance >= 0 ? 'text-primary' : 'text-danger' ?>">
                            ₹<?= number_format($running_balance, 0) ?>
                        </td>
                    </tr>
                    <?php endwhile; else: ?>
                        <tr><td colspan="6" class="text-center py-3 text-muted">No cash transactions found.</td></tr>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
        <div class="ledger-summary p-3 border-top">
            <div class="row">
                <div class="col-md-4">
                    <div class="small text-muted">Total Cash In</div>
                    <div class="h5 text-success mb-0">₹ <?= number_format($total_in, 2) ?></div>
                </div>
                <div class="col-md-4">
                    <div class="small text-muted">Total Cash Out</div>
                    <div class="h5 text-danger mb-0">₹ <?= number_format($total_out, 2) ?></div>
                </div>
                <div class="col-md-4">
                    <div class="small text-muted">Closing Balance</div>
                    <div class="h5 <?= $running_balance >= 0 ? 'text-primary' : 'text-danger' ?> mb-0">
                        ₹ <?= number_format($running_balance, 2) ?>
                    </div>
                </div>
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
                    <tr class="bg-light">
                        <th colspan="2">आय (Income)</th>
                    </tr>
                    <tr>
                        <td>सर्विस राजस्व (Service Revenue)</td>
                        <td class="text-right">₹ <?= number_format($job_income, 2) ?></td>
                    </tr>
                    <tr>
                        <td>वॉक-इन बिक्री (Walk-in Sales)</td>
                        <td class="text-right">₹ <?= number_format($walkin_income, 2) ?></td>
                    </tr>
                    <tr>
                        <td>ग्राहक बिक्री (Client Sales)</td>
                        <td class="text-right">₹ <?= number_format($client_sales_income, 2) ?></td>
                    </tr>
                    <tr class="bg-light">
                        <th>शुद्ध आय (Net Revenue)</th>
                        <th class="text-right">₹ <?= number_format($total_income, 2) ?></th>
                    </tr>
                    
                    <tr class="bg-light">
                        <th colspan="2">व्यय (Expenses)</th>
                    </tr>
                    <tr>
                        <td>वेतन (Salaries)</td>
                        <td class="text-right text-danger">₹ <?= number_format($total_salary_earned, 2) ?></td>
                    </tr>
                    <tr>
                        <td>कमीशन (Commission)</td>
                        <td class="text-right text-danger">₹ <?= number_format($total_comm, 2) ?></td>
                    </tr>
                    <tr>
                        <td>दुकान खर्च (Shop Expenses)</td>
                        <td class="text-right text-danger">₹ <?= number_format($other_expenses, 2) ?></td>
                    </tr>
                    <tr>
                        <td>लोन किस्त (Loan EMI)</td>
                        <td class="text-right text-danger">₹ <?= number_format($total_emi_paid, 2) ?></td>
                    </tr>
                    <tr>
                        <td>ग्राहक छूट (Customer Discount)</td>
                        <td class="text-right text-danger">₹ <?= number_format($total_discount_given, 2) ?></td>
                    </tr>
                    <tr class="bg-light">
                        <th>कुल व्यय (Total Expenses)</th>
                        <th class="text-right text-danger">₹ <?= number_format($total_business_expense, 2) ?></th>
                    </tr>
                    
                    <tr class="bg-navy text-white">
                        <th>शुद्ध लाभ/हानि (Net Profit/Loss)</th>
                        <th class="text-right <?= $net_profit >= 0 ? 'text-success' : 'text-danger' ?>">
                            ₹ <?= number_format($net_profit, 2) ?>
                        </th>
                    </tr>
                </table>
            </div>
        </div>
    </div>

    <?php 
    // Stock Value Calculation (स्टॉक मूल्य)
    $stock_qry = $conn->query("SELECT SUM(p.price * i.quantity) as total_val 
                               FROM product_list p 
                               INNER JOIN inventory_list i ON p.id = i.product_id");
    $stock_val = $stock_qry->fetch_assoc()['total_val'] ?? 0;
    
    // Outstanding Liability (Staff Payable) - स्टाफ बकाया
    $all_mechanics = $conn->query("SELECT id FROM mechanic_list");
    $total_pending_liability = 0;
    while($m = $all_mechanics->fetch_assoc()){
        $m_id = $m['id'];
        
        // कमीशन कमाया
        $earned_comm = $conn->query("SELECT SUM(mechanic_commission_amount) FROM transaction_list WHERE mechanic_id = $m_id AND status = 5")->fetch_array()[0] ?? 0;
        
        // वेतन कमाया
        $earned_sal = 0;
        $att_h = $conn->query("SELECT curr_date, status FROM attendance_list WHERE mechanic_id = $m_id AND status IN (1,3)");
        while($rh = $att_h->fetch_assoc()){
            $d = $rh['curr_date'];
            $rate_h = $conn->query("SELECT salary FROM mechanic_salary_history WHERE mechanic_id = $m_id AND effective_date <= '$d' ORDER BY effective_date DESC, id DESC LIMIT 1");
            $daily = ($rate_h->num_rows > 0) ? $rate_h->fetch_assoc()['salary'] : 0;
            $earned_sal += ($rh['status'] == 3) ? ($daily / 2) : $daily;
        }

        // कुल भुगतान किया
        $paid = $conn->query("SELECT SUM(amount) FROM advance_payments WHERE mechanic_id = $m_id")->fetch_array()[0] ?? 0;
        
        $total_pending_liability += (($earned_comm + $earned_sal) - $paid);
    }
    
    // Net Cash Position (नकद स्थिति)
    $net_cash = $total_cash_inflow - $total_cash_outflow;
    
    // Loan Outstanding (लोन बकाया)
    $total_loan = $conn->query("SELECT SUM(loan_amount) as total FROM lender_list WHERE status = 1")->fetch_array()[0] ?? 0;
    $total_loan_paid = $conn->query("SELECT SUM(amount_paid) as total FROM loan_payments")->fetch_array()[0] ?? 0;
    $loan_outstanding = $total_loan - $total_loan_paid;
    ?>
    
    <div class="col-md-6">
        <div class="card card-outline card-success shadow-sm">
            <div class="card-header"><h5 class="card-title">चिट्ठा (Balance Sheet)</h5></div>
            <div class="card-body p-0">
                <table class="table table-sm mb-0">
                    <thead>
                        <tr class="bg-light">
                            <th>संपत्ति (Assets)</th>
                            <th class="text-right">राशि (Amount)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>स्टॉक मूल्य (Inventory Value)</td>
                            <td class="text-right">₹ <?= number_format($stock_val, 2) ?></td>
                        </tr>
                        <tr>
                            <td>नकद शेष (Cash Balance)</td>
                            <td class="text-right">₹ <?= number_format($net_cash, 2) ?></td>
                        </tr>
                        <tr class="bg-light">
                            <th>कुल संपत्ति (Total Assets)</th>
                            <th class="text-right">₹ <?= number_format($stock_val + $net_cash, 2) ?></th>
                        </tr>
                        
                        <tr class="bg-light">
                            <th>दायित्व (Liabilities)</th>
                            <th></th>
                        </tr>
                        <tr>
                            <td>स्टाफ बकाया (Staff Payable)</td>
                            <td class="text-right text-danger">₹ <?= number_format($total_pending_liability, 2) ?></td>
                        </tr>
                        <tr>
                            <td>लोन बकाया (Loan Outstanding)</td>
                            <td class="text-right text-danger">₹ <?= number_format(max(0, $loan_outstanding), 2) ?></td>
                        </tr>
                        <tr class="bg-light">
                            <th>कुल दायित्व (Total Liabilities)</th>
                            <th class="text-right text-danger">₹ <?= number_format($total_pending_liability + max(0, $loan_outstanding), 2) ?></th>
                        </tr>
                        
                        <tr class="bg-navy text-white">
                            <th>पूंजी (Capital)</th>
                            <th class="text-right">
                                <?php 
                                $capital = ($stock_val + $net_cash) - ($total_pending_liability + max(0, $loan_outstanding));
                                ?>
                                ₹ <?= number_format($capital, 2) ?>
                            </th>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<div class="alert alert-info mt-4 no-print">
    <i class="fa fa-info-circle"></i> 
    <strong>सुझाव (Note):</strong> 
    <ul class="mb-0">
        <li>Balance Sheet अनुमानित है, सटीक चिट्ठा के लिए सभी लेनदेन रिकॉर्ड करें</li>
        <li>Revenue जॉब डिलीवर होने पर माना जाता है (भुगतान मिलने पर नहीं)</li>
        <li>Client Payments नकद आवक है, नई आय नहीं</li>
        <li>ग्राहक को दी गई छूट व्यवसायिक खर्च में जोड़ी गई है</li>
        <li>Client payments के लिए client name पर click करके profile देख सकते हैं</li>
    </ul>
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
    // Modal functions
    function showRepairJobsDetails() {
        $('#repairJobsModal').modal('show');
    }
    
    function showWalkinSalesDetails() {
        $('#walkinSalesModal').modal('show');
    }
    
    function showClientSalesDetails() {
        $('#clientSalesModal').modal('show');
    }
    
    function showClientPaymentsDetails() {
        $('#clientPaymentsModal').modal('show');
    }
    
    function showCommissionDetails() {
        $('#commissionModal').modal('show');
    }
    
    function showDiscountDetails() {
        $('#discountModal').modal('show');
    }
    
    // New modal functions
    function showStaffSalariesDetails() {
        $('#staffSalariesModal').modal('show');
    }
    
    function showStaffAdvanceDetails() {
        $('#staffAdvanceModal').modal('show');
    }
    
    function showShopExpensesDetails() {
        $('#shopExpensesModal').modal('show');
    }
    
    // Helper function to format date as YYYY-MM-DD
    function formatDate(date) {
        var year = date.getFullYear();
        var month = String(date.getMonth() + 1).padStart(2, '0');
        var day = String(date.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    }
    
    // Helper function to get first day of month
    function getFirstDayOfMonth(date) {
        return new Date(date.getFullYear(), date.getMonth(), 1);
    }
    
    // Helper function to get last day of month
    function getLastDayOfMonth(date) {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0);
    }
    
    $(document).ready(function(){
        $('#toggleStockTable').change(function(){
            if($(this).is(':checked')){
                $('#stockDetailSection').fadeIn();
            } else {
                $('#stockDetailSection').fadeOut();
            }
        });
        
        // Initialize tooltips
        $('[data-toggle="tooltip"]').tooltip();
        
        // Simple logic to keep date inputs valid
        $('#filter-ledger').submit(function(e){
            e.preventDefault()
            location.href = "./?page=reports/ledger_report&"+$(this).serialize()
        })
        
        // Last Month button
        $('#lastMonthBtn').click(function(){
            var fromDate = new Date($('input[name="from"]').val());
            var toDate = new Date($('input[name="to"]').val());
            
            // Calculate last month
            var lastMonthFrom = new Date(fromDate);
            lastMonthFrom.setMonth(lastMonthFrom.getMonth() - 1);
            
            var lastMonthTo = new Date(toDate);
            lastMonthTo.setMonth(lastMonthTo.getMonth() - 1);
            
            // Adjust to first and last day of the month
            var firstDay = getFirstDayOfMonth(lastMonthFrom);
            var lastDay = getLastDayOfMonth(lastMonthFrom);
            
            // Format dates to YYYY-MM-DD
            var formattedFirstDay = formatDate(firstDay);
            var formattedLastDay = formatDate(lastDay);
            
            // Update input values
            $('input[name="from"]').val(formattedFirstDay);
            $('input[name="to"]').val(formattedLastDay);
            
            // Submit form
            $('#filter-ledger').submit();
        });
        
        // Next Month button
        $('#nextMonthBtn').click(function(){
            var fromDate = new Date($('input[name="from"]').val());
            var toDate = new Date($('input[name="to"]').val());
            
            // Calculate next month
            var nextMonthFrom = new Date(fromDate);
            nextMonthFrom.setMonth(nextMonthFrom.getMonth() + 1);
            
            var nextMonthTo = new Date(toDate);
            nextMonthTo.setMonth(nextMonthTo.getMonth() + 1);
            
            // Adjust to first and last day of the month
            var firstDay = getFirstDayOfMonth(nextMonthFrom);
            var lastDay = getLastDayOfMonth(nextMonthFrom);
            
            // Format dates to YYYY-MM-DD
            var formattedFirstDay = formatDate(firstDay);
            var formattedLastDay = formatDate(lastDay);
            
            // Update input values
            $('input[name="from"]').val(formattedFirstDay);
            $('input[name="to"]').val(formattedLastDay);
            
            // Submit form
            $('#filter-ledger').submit();
        });
        
        // Reset button - Set to current month (1st to last day)
        $('#resetBtn').click(function(){
            // Set to current month (1st to last day)
            var today = new Date();
            var firstDay = getFirstDayOfMonth(today);
            var lastDay = getLastDayOfMonth(today);
            
            // Format dates to YYYY-MM-DD
            var formattedFirstDay = formatDate(firstDay);
            var formattedLastDay = formatDate(lastDay);
            
            // Update input values
            $('input[name="from"]').val(formattedFirstDay);
            $('input[name="to"]').val(formattedLastDay);
            
            // Submit form
            $('#filter-ledger').submit();
        });
    });
</script>

<style>
    @media print {
        .no-print { display: none !important; }
        .card { border: none !important; box-shadow: none !important; }
        .table-responsive { overflow: visible !important; }
        .bg-navy { background-color: #001f3f !important; color: white !important; -webkit-print-color-adjust: exact; }
    }
    .text-navy { color: #001f3f; }
    .client-link {
        color: #0d47a1;
        font-weight: 600;
        text-decoration: none;
        border-bottom: 1px dotted #0d47a1;
        transition: all 0.3s ease;
    }
    .client-link:hover {
        color: #ff5722;
        border-bottom: 1px solid #ff5722;
        text-decoration: none;
    }
    
    /* Compact Transaction Ledger */
    .compact-ledger {
        font-size: 0.85rem;
    }
    
    .compact-ledger table {
        margin-bottom: 0;
    }
    
    .compact-ledger th {
        padding: 6px 8px;
        font-weight: 600;
        white-space: nowrap;
    }
    
    .compact-ledger td {
        padding: 5px 8px;
        vertical-align: middle;
    }
    
    .compact-ledger .badge {
        font-size: 0.75rem;
        padding: 2px 6px;
    }
    
    .ledger-details {
        max-height: 350px;
        overflow-y: auto;
        border-bottom: 1px solid #dee2e6;
    }
    
    .ledger-summary {
        background-color: #f8f9fa;
        border-top: 2px solid #dee2e6;
    }
    
    .sticky-top {
        position: sticky;
        z-index: 100;
    }
    
    @media (max-width: 768px) {
        .compact-ledger {
            font-size: 0.8rem;
        }
        
        .compact-ledger th,
        .compact-ledger td {
            padding: 4px 6px;
        }
    }
</style>