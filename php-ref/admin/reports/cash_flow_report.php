<?php
// Date Logic
$from = isset($_GET['from']) ? $_GET['from'] : date("Y-m-01");
$to = isset($_GET['to']) ? $_GET['to'] : date("Y-m-t");

// Previous/Next Month Navigation Logic
$prev_month_from = date("Y-m-01", strtotime("$from -1 month"));
$prev_month_to = date("Y-m-t", strtotime("$from -1 month"));
$next_month_from = date("Y-m-01", strtotime("$from +1 month"));
$next_month_to = date("Y-m-t", strtotime("$from +1 month"));
$current_year = date("Y", strtotime($from));

$running_balance = 0; 

// ====================================================================
// MODIFIED QUERY WITH CLIENT_ID FOR CLICKABLE LINKS
// ====================================================================
$query_string = "
    -- 1. Client Payments (Repair Jobs) [Table: client_payments]
    (SELECT cp.payment_date as date, cp.amount, 'Cash In' as type, 'Client Payment' as category, 
     CONCAT(COALESCE(cl.firstname,''), ' ', COALESCE(cl.lastname,''), ' (', COALESCE(cp.remarks,''), ')') as details,
     cl.id as client_id,
     CONCAT(COALESCE(cl.firstname,''), ' ', COALESCE(cl.lastname,'')) as client_fullname,
     COALESCE(cp.remarks, '') as payment_remarks
     FROM client_payments cp 
     LEFT JOIN client_list cl ON cp.client_id = cl.id
     WHERE date(cp.payment_date) BETWEEN '{$from}' AND '{$to}')
    
    UNION ALL
    
    -- 2. Direct Sales (Walk-in Customers Only) [Table: direct_sales]
    (SELECT date_created as date, total_amount as amount, 'Cash In' as type, 'Direct Sale' as category, 
     CONCAT(payment_mode, ' - ', COALESCE(remarks,'Walk-in Customer')) as details,
     NULL as client_id, NULL as client_fullname, NULL as payment_remarks
     FROM direct_sales 
     WHERE client_id = 0 AND date(date_created) BETWEEN '{$from}' AND '{$to}')
    
    UNION ALL
    
    -- 3. Shop Expenses [Table: expense_list]
    (SELECT date_created as date, amount, 'Cash Out' as type, 'Shop Expense' as category, 
     CONCAT(category, ' - ', COALESCE(remarks,'')) as details,
     NULL as client_id, NULL as client_fullname, NULL as payment_remarks
     FROM expense_list 
     WHERE date(date_created) BETWEEN '{$from}' AND '{$to}')
    
    UNION ALL
    
    -- 4. Loan EMI Payments [Table: loan_payments]
    (SELECT payment_date as date, amount_paid as amount, 'Cash Out' as type, 'Loan EMI' as category,
     COALESCE(remarks, 'EMI Payment') as details,
     NULL as client_id, NULL as client_fullname, NULL as payment_remarks
     FROM loan_payments
     WHERE date(payment_date) BETWEEN '{$from}' AND '{$to}')

    UNION ALL

    -- 5. Staff Advance [Table: advance_payments]
    (SELECT ap.date_paid as date, ap.amount, 'Cash Out' as type, 'Staff Advance' as category, 
     CONCAT(COALESCE(m.firstname,''), ' ', COALESCE(m.lastname,''), ' - ', COALESCE(ap.reason,'')) as details,
     NULL as client_id, NULL as client_fullname, NULL as payment_remarks
     FROM advance_payments ap 
     LEFT JOIN mechanic_list m ON ap.mechanic_id = m.id
     WHERE date(ap.date_paid) BETWEEN '{$from}' AND '{$to}')
    
    ORDER BY date ASC, details ASC";

$cash_flow_qry = $conn->query($query_string);
?>

<style>
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
    .badge-success { background-color: #28a745; }
    .badge-danger { background-color: #dc3545; }
</style>

<div class="card card-outline card-navy shadow-sm">
    <div class="card-header">
        <h3 class="card-title font-weight-bold"><i class="fas fa-wallet mr-2"></i> Monthly Cash Flow</h3>
        <div class="card-tools">
            <button class="btn btn-success btn-sm btn-flat" onclick="window.print()"><i class="fa fa-print"></i> Print</button>
        </div>
    </div>
    <div class="card-body">
        <div class="no-print mb-4 border p-3 bg-light rounded shadow-sm">
            <form action="" method="GET">
                <input type="hidden" name="page" value="reports/cash_flow_report">
                <div class="row align-items-end">
                    <div class="col-md-2">
                        <label class="small text-muted font-weight-bold">From Date</label>
                        <input type="date" name="from" value="<?= $from ?>" class="form-control form-control-sm">
                    </div>
                    <div class="col-md-2">
                        <label class="small text-muted font-weight-bold">To Date</label>
                        <input type="date" name="to" value="<?= $to ?>" class="form-control form-control-sm">
                    </div>
                    <div class="col-md-2">
                        <label class="small text-muted font-weight-bold">Quick Year</label>
                        <select class="form-control form-control-sm" onchange="location.href='./?page=reports/cash_flow_report&from='+this.value+'-01-01&to='+this.value+'-12-31'">
                            <?php for($y=date('Y'); $y>=2020; $y--): ?>
                                <option value="<?= $y ?>" <?= $current_year == $y ? 'selected' : '' ?>><?= $y ?></option>
                            <?php endfor; ?>
                        </select>
                    </div>
                    <div class="col-md-6">
                        <div class="btn-group btn-group-sm w-100 shadow-sm">
                            <button type="submit" class="btn btn-primary"><i class="fa fa-filter"></i> Filter</button>
                            <a href="./?page=reports/cash_flow_report&from=<?= $prev_month_from ?>&to=<?= $prev_month_to ?>" class="btn btn-info"><i class="fa fa-chevron-left"></i> Prev Month</a>
                            <a href="./?page=reports/cash_flow_report" class="btn btn-warning text-bold"><i class="fa fa-sync-alt"></i> Reset</a>
                            <a href="./?page=reports/cash_flow_report&from=<?= $next_month_from ?>&to=<?= $next_month_to ?>" class="btn btn-info">Next Month <i class="fa fa-chevron-right"></i></a>
                        </div>
                    </div>
                </div>
            </form>
        </div>

        <div class="table-responsive">
            <table class="table table-bordered table-striped table-sm">
                <thead class="bg-navy">
                    <tr>
                        <th width="12%">Date</th>
                        <th width="15%">Category</th>
                        <th>Details</th>
                        <th class="text-right" width="12%">In (+)</th>
                        <th class="text-right" width="12%">Out (-)</th>
                        <th class="text-right" width="15%">Balance</th>
                    </tr>
                </thead>
                <tbody>
                    <?php 
                    $total_in = 0; $total_out = 0;
                    if($cash_flow_qry && $cash_flow_qry->num_rows > 0):
                        while($row = $cash_flow_qry->fetch_assoc()): 
                            if($row['type'] == 'Cash In'){
                                $total_in += $row['amount'];
                                $running_balance += $row['amount'];
                            } else {
                                $total_out += $row['amount'];
                                $running_balance -= $row['amount'];
                            }
                            
                            // Prepare details with clickable client name if applicable
                            // DELIVERED_REPORT.PHP के जैसे link format use करें
                            if($row['category'] == 'Client Payment' && !empty($row['client_id'])) {
                                // DELIVERED_REPORT.PHP की तरह link बनाएं
                                $display_details = '<a href="./?page=clients/view_client&id=' . $row['client_id'] . '" 
                                                     target="_blank" class="text-dark font-weight-bold">' . 
                                                     $row['client_fullname'] . '</a> (' . $row['payment_remarks'] . ')';
                            } else {
                                $display_details = $row['details'];
                            }
                    ?>
                    <tr>
                        <td class="text-nowrap"><?= date("d-M-Y", strtotime($row['date'])) ?></td>
                        <td>
                            <span class="badge badge-<?= $row['type'] == 'Cash In' ? 'success' : 'danger' ?>">
                                <?= $row['category'] ?>
                            </span>
                        </td>
                        <td><?= $display_details ?></td>
                        <td class="text-right text-success font-weight-bold">
                            <?= ($row['type'] == 'Cash In') ? number_format($row['amount'], 2) : '-' ?>
                        </td>
                        <td class="text-right text-danger font-weight-bold">
                            <?= ($row['type'] == 'Cash Out') ? number_format($row['amount'], 2) : '-' ?>
                        </td>
                        <td class="text-right font-weight-bold <?= $running_balance < 0 ? 'text-danger' : 'text-primary' ?>">
                            ₹ <?= number_format($running_balance, 2) ?>
                        </td>
                    </tr>
                    <?php endwhile; else: ?>
                    <tr><td colspan="6" class="text-center py-4 text-muted">No transactions found for this period.</td></tr>
                    <?php endif; ?>
                </tbody>
                <tfoot class="bg-light">
                    <tr>
                        <th colspan="3" class="text-right text-uppercase">Period Total:</th>
                        <th class="text-right text-success" style="font-size: 1.1rem;">₹ <?= number_format($total_in, 2) ?></th>
                        <th class="text-right text-danger" style="font-size: 1.1rem;">₹ <?= number_format($total_out, 2) ?></th>
                        <th class="text-right <?= $running_balance >= 0 ? 'text-success' : 'text-danger' ?>" style="font-size: 1.2rem;">
                            ₹ <?= number_format($running_balance, 2) ?>
                        </th>
                    </tr>
                </tfoot>
            </table>
            
            <?php if($cash_flow_qry && $cash_flow_qry->num_rows > 0): ?>
            <div class="alert alert-info no-print mt-3 p-2 small">
                <i class="fas fa-info-circle mr-1"></i> 
                <strong>Note:</strong> Click on client names to view their complete profile and transaction history.
            </div>
            <?php endif; ?>
        </div>
    </div>
</div>

<script>
// Optional: Add JavaScript for better user experience
document.addEventListener('DOMContentLoaded', function() {
    // Add click event to all client links
    document.querySelectorAll('a[href*="view_client"]').forEach(function(link) {
        link.addEventListener('click', function(e) {
            // Optional: Show loading indicator
            console.log('Opening client profile: ' + this.href);
        });
    });
});
</script>