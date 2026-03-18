<?php
if(isset($_GET['id']) && $_GET['id'] > 0){
    $qry = $conn->query("SELECT * from `lender_list` where id = '{$_GET['id']}' ");
    if($qry->num_rows > 0){
        foreach($qry->fetch_assoc() as $k => $v){ $$k=$v; }
    }
}

// Total Repayment Calculate karne ka logic (EMI * Tenure)
$total_repayment = $emi_amount * $tenure_months;
?>
<div class="content py-3">
    <div class="card card-outline card-navy shadow">
        <div class="card-header">
				<h3 class="card-title text-navy font-weight-bold">Lender Details: <?php echo $fullname ?></h3>
			<div class="card-tools">
				<button class="btn btn-sm btn-flat btn-primary edit_lender" type="button" data-id="<?php echo $id ?>">
					<i class="fa fa-edit"></i> Edit Details
				</button>
        
				<button class="btn btn-sm btn-flat btn-info bg-navy pay_emi" type="button" data-id="<?php echo $id ?>" data-name="<?php echo $fullname ?>">
					<i class="fa fa-money-bill-wave"></i> Pay EMI
				</button>
        
				<button class="btn btn-sm btn-flat btn-default border" type="button" onclick="location.href='./?page=lenders'"><i class="fa fa-angle-left"></i> Back to List</button>
			</div>
		</div>
        <div class="card-body">
            <div class="container-fluid">
                <div class="row">
                    <div class="col-md-4 border-right">
                        <p><b>Contact:</b> <?php echo $contact ?></p>
                        <p><b>Loan Principal:</b> ₹ <?php echo number_format($loan_amount, 2) ?></p>
                        <p><b>Interest Rate:</b> <?php echo $interest_rate ?>% p.a.</p>
                        <p><b>Tenure:</b> <?php echo $tenure_months ?> Months</p>
                        <p class="mb-1"><b>Monthly EMI:</b> <span class="text-danger font-weight-bold">₹ <?php echo number_format($emi_amount, 2) ?></span></p>
                        
                        <p><b>Total Repayment:</b> <span class="text-navy font-weight-bold">₹ <?php echo number_format($total_repayment, 2) ?></span></p>
                        
                        <p><b>Start Date:</b> <?php echo date("M d, Y", strtotime($start_date)) ?></p>
                        <p><b>Loan Reason:</b> <br><span class="text-muted"><?php echo isset($reason) ? $reason : 'N/A' ?></span></p>
                    </div>
                    
                    <div class="col-md-8">
                        <h5 class="text-navy border-bottom pb-2">EMI Payment History</h5>
                        <table class="table table-sm table-bordered table-striped" id="emi-history">
                            <thead>
                                <tr class="bg-navy text-white">
                                    <th>Date</th>
                                    <th>Remarks</th>
                                    <th class="text-right">Amount Paid</th>
									<th class="text-center">Action</th> </tr>
                                </tr>
                            </thead>
                            <tbody>
                                <?php 
                                $total_paid = 0;
                                $payments = $conn->query("SELECT * FROM loan_payments WHERE lender_id = '{$id}' ORDER BY payment_date DESC");
                                while($prow = $payments->fetch_assoc()):
                                    $total_paid += $prow['amount_paid'];
                                ?>
                                <tr>
                                    <td><?php echo date("d-M-Y", strtotime($prow['payment_date'])) ?></td>
                                    <td><?php echo $prow['remarks'] ?></td>
                                    <td class="text-right">₹ <?php echo number_format($prow['amount_paid'], 2) ?></td>
									<td class="text-center">
                <button type="button" class="btn btn-flat btn-default btn-xs edit_payment" data-id="<?php echo $prow['id'] ?>">
                    <span class="fa fa-edit text-primary"></span>
                </button>
            </td>
                                </tr>
                                <?php endwhile; ?>
                            </tbody>
                            <tfoot>
                                <tr>
                                    <th colspan="2" class="text-right">Total Amount Paid:</th>
                                    <th class="text-right text-success">₹ <?php echo number_format($total_paid, 2) ?></th>
                                </tr>
                                <tr>
                                    <th colspan="2" class="text-right">Outstanding (Against Total):</th>
                                    <th class="text-right text-danger">₹ <?php echo number_format($total_repayment - $total_paid, 2) ?></th>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
    $(function(){
			// Edit Lender button click handler
    $('.edit_lender').click(function(){
        uni_modal("<i class='fa fa-edit'></i> Edit Lender Details", "lenders/manage_lender.php?id="+$(this).attr('data-id'), "mid-large")
    })

    // Baaki purana code (Pay EMI aur DataTable) waise hi rahega
    $('.pay_emi').click(function(){
        uni_modal("<i class='fa fa-money-bill-wave'></i> Record EMI Payment for "+$(this).attr('data-name'), "lenders/manage_payment.php?lender_id="+$(this).attr('data-id'))
    })
        // Pay EMI button click handler
        $('.pay_emi').click(function(){
            uni_modal("<i class='fa fa-money-bill-wave'></i> Record EMI Payment for "+$(this).attr('data-name'), "lenders/manage_payment.php?lender_id="+$(this).attr('data-id'))
        })		
		// EMI Edit button click handler
    $('.edit_payment').click(function(){
        // manage_payment.php ko payment ID ke saath modal mein kholna
        uni_modal("<i class='fa fa-edit'></i> Edit EMI Payment", "lenders/manage_payment.php?id="+$(this).attr('data-id'))
    })
    
    // DataTable update karein taaki 4th column (Action) par sorting na ho
    $('#emi-history').DataTable({
        "paging": true,
        "searching": false,
        "ordering": false,
        "info": true,
        "columnDefs": [
            { "orderable": false, "targets": 3 }
        ]
    });
    })
</script>