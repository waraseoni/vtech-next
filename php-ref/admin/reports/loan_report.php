<?php 
require_once('../config.php'); 
$month = isset($_GET['month']) ? $_GET['month'] : date("Y-m");
?>

<div class="content py-3">
    <div class="card card-outline card-navy shadow">
        <div class="card-header">
            <h3 class="card-title"><b>Monthly Loan & Interest Report</b></h3>
        </div>
        <div class="card-body">
            <div class="row justify-content-center mb-4">
                <div class="col-md-4">
                    <form action="" id="filter-report">
                        <input type="hidden" name="page" value="reports/loan_report">
                        <div class="input-group">
                            <div class="input-group-prepend"><span class="input-group-text">Select Month</span></div>
                            <input type="month" name="month" class="form-control" value="<?php echo $month ?>">
                            <div class="input-group-append">
                                <button class="btn btn-primary"><i class="fa fa-filter"></i> Filter</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            <div id="print_out">
                <div class="text-center mb-3">
                    <h4>Loan Performance Report</h4>
                    <span>For the Month of: <b><?php echo date("F Y", strtotime($month)) ?></b></span>
                </div>

                <table class="table table-bordered table-striped">
                    <thead class="bg-navy">
                        <tr>
                            <th>#</th>
                            <th>Client Name</th>
                            <th>Principal Given</th>
                            <th>Interest Rate</th>
                            <th>Interest Earned (Byaj)</th>
                            <th>Target EMI</th>
                            <th>Actual Received</th>
                            <th>Pending EMI</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php 
                        $i = 1;
                        $t_principal = 0; $t_interest = 0; $t_target = 0; $t_received = 0; $t_pending = 0;

                        // Sirf wahi loans jo is mahine active the ya chal rahe hain
                        $qry = $conn->query("SELECT l.*, CONCAT(c.firstname,' ',c.lastname) as client 
                                           FROM `client_loans` l 
                                           INNER JOIN client_list c ON l.client_id = c.id 
                                           WHERE DATE_FORMAT(l.loan_date, '%Y-%m') <= '$month' AND l.status >= 0");
                        
                        while($row = $qry->fetch_assoc()):
                            $loan_id = $row['id'];
                            
                            // 1. Calculate Interest for this loan
                            $interest_val = $row['total_payable'] - $row['principal_amount'];
                            
                            // 2. Target EMI (Jo is mahine aani chahiye thi)
                            $target_emi = $row['emi_amount'];

                            // 3. Is mahine kitna paisa aaya (Actual Received)
                            $paid_stmt = $conn->query("SELECT SUM(net_amount) FROM client_payments 
                                                      WHERE loan_id = '$loan_id' 
                                                      AND DATE_FORMAT(payment_date, '%Y-%m') = '$month'");
                            $received = $paid_stmt->fetch_array()[0] ?? 0;

                            // 4. Pending Calculation
                            $pending = $target_emi - $received;
                            if($pending < 0) $pending = 0; // Overpayment check

                            // Totals
                            $t_principal += $row['principal_amount'];
                            $t_interest += $interest_val;
                            $t_target += $target_emi;
                            $t_received += $received;
                            $t_pending += $pending;
                        ?>
                        <tr>
                            <td><?php echo $i++ ?></td>
                            <td><?php echo $row['client'] ?></td>
                            <td class="text-right">₹<?php echo number_format($row['principal_amount'], 2) ?></td>
                            <td class="text-center"><?php echo $row['interest_rate'] ?>%</td>
                            <td class="text-right text-success">₹<?php echo number_format($interest_val, 2) ?></td>
                            <td class="text-right">₹<?php echo number_format($target_emi, 2) ?></td>
                            <td class="text-right text-primary">₹<?php echo number_format($received, 2) ?></td>
                            <td class="text-right text-danger font-weight-bold">₹<?php echo number_format($pending, 2) ?></td>
                        </tr>
                        <?php endwhile; ?>
                    </tbody>
                    <tfoot class="bg-light font-weight-bold">
                        <tr>
                            <td colspan="2">TOTAL SUMMARY</td>
                            <td class="text-right">₹<?php echo number_format($t_principal, 2) ?></td>
                            <td></td>
                            <td class="text-right text-success">₹<?php echo number_format($t_interest, 2) ?></td>
                            <td class="text-right">₹<?php echo number_format($t_target, 2) ?></td>
                            <td class="text-right text-primary">₹<?php echo number_format($t_received, 2) ?></td>
                            <td class="text-right text-danger">₹<?php echo number_format($t_pending, 2) ?></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            <div class="row mt-3">
                <div class="col-12 text-center">
                    <button class="btn btn-success btn-flat" type="button" id="print"><i class="fa fa-print"></i> Print Report</button>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
    $(function(){
        $('#print').click(function(){
            start_loader();
            var _h = $('head').clone();
            var _p = $('#print_out').clone();
            var _el = $('<div>');
            _h.find('title').text("Loan Report - Print");
            _el.append(_h);
            _el.append('<h3 class="text-center"><?php echo $_settings->info('name') ?></h3>');
            _el.append(_p);
            var nw = window.open("","","width=1000,height=900");
                nw.document.write(_el.html());
                nw.document.close();
                setTimeout(() => {
                    nw.print();
                    setTimeout(() => {
                        nw.close();
                        end_loader();
                    }, 300);
                }, 500);
        });
    });
</script>