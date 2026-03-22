<div class="card card-outline card-navy shadow">
    <div class="card-header">
        <h3 class="card-title text-navy font-weight-bold"><i class="fas fa-hand-holding-usd mr-2"></i> Loan Lenders List</h3>
        <div class="card-tools">
			<a href=".?page=lenders/payment_history" class="btn btn-flat btn-primary btn-sm"><span class="fas fa-hand-holding-usd"></span> EMI History</a>
   
            <button id="create_new" class="btn btn-flat btn-primary bg-navy border-0 btn-sm"><i class="fa fa-plus"></i> Add New Lender</button>
        </div>
    </div>
    <div class="card-body">
        <table class="table table-bordered table-striped" id="lender-list">
            <thead>
                <tr class="bg-navy text-white">
                    <th class="text-center">#</th>
                    <th>Lender Name</th>
                    <th>Loan Details</th>
                    <th>Monthly EMI</th>
                    <th>Paid vs Balance</th> <th>Status</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                <?php 
                $i = 1;
                // Query ko join kiya gaya hai payments table ke saath balance nikalne ke liye
                $qry = $conn->query("SELECT l.*, 
                                    (SELECT SUM(amount_paid) FROM loan_payments WHERE lender_id = l.id) as total_paid 
                                    FROM `lender_list` l ORDER BY l.fullname ASC");
                while($row = $qry->fetch_assoc()):
                    $total_paid = $row['total_paid'] ?? 0;
                    $total_to_pay = $row['emi_amount'] * $row['tenure_months'];
                    $balance = $total_to_pay - $total_paid;
                ?>
                <tr>
                    <td class="text-center"><?php echo $i++; ?></td>
                    <td>
                        <b><?php echo $row['fullname'] ?></b><br>
                        <small class="text-muted"><i class="fa fa-phone"></i> <?php echo $row['contact'] ?></small>
                    </td>
                    <td>
						<small>Principal: <b>₹ <?php echo number_format($row['loan_amount'], 2) ?></b></small><br>
						<small>Total Repay: <b class="text-navy">₹ <?php echo number_format($row['emi_amount'] * $row['tenure_months'], 2) ?></b></small><br>
						<small>Interest: <b><?php echo $row['interest_rate'] ?>%</b> | Months: <b><?php echo $row['tenure_months'] ?></b></small>
					</td>
                    <td class="text-right">
                        <span class="text-danger font-weight-bold">₹ <?php echo number_format($row['emi_amount'],2) ?></span>
                    </td>
                    <td class="text-right">
                        <small>Paid: <span class="text-success">₹ <?php echo number_format($total_paid, 2) ?></span></small><br>
                        <small>Balance: <b class="text-navy">₹ <?php echo number_format($balance, 2) ?></b></small>
                    </td>
                    <td class="text-center">
                        <?php if($row['status'] == 1): ?>
                            <span class="badge badge-success">Active</span>
                        <?php else: ?>
                            <span class="badge badge-secondary">Completed</span>
                        <?php endif; ?>
                    </td>
                    <td align="center">
                        <button type="button" class="btn btn-flat btn-default btn-sm dropdown-toggle dropdown-icon" data-toggle="dropdown">
                                Action
                        </button>
                        <div class="dropdown-menu" role="menu">
                            <a class="dropdown-item" href="./?page=lenders/view_lender&id=<?php echo $row['id'] ?>"><span class="fa fa-eye text-dark"></span> View History</a>
                            <div class="dropdown-divider"></div>
                            <a class="dropdown-item pay_emi" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>" data-name="<?php echo $row['fullname'] ?>"><span class="fa fa-money-bill-wave text-success"></span> Pay EMI</a>
                            <div class="dropdown-divider"></div>
                            <a class="dropdown-item edit_data" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>"><span class="fa fa-edit text-primary"></span> Edit</a>
                            <a class="dropdown-item delete_data" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>"><span class="fa fa-trash text-danger"></span> Delete</a>
                        </div>
                    </td>
                </tr>
                <?php endwhile; ?>
            </tbody>
        </table>
    </div>
</div>

<script>
    $(document).ready(function(){
        // Naya Lender Add karne ke liye
        $('#create_new').click(function(){
            uni_modal("<i class='fa fa-plus'></i> Add New Lender","lenders/manage_lender.php","mid-large")
        })
        // Lender Edit karne ke liye
        $('.edit_data').click(function(){
            uni_modal("<i class='fa fa-edit'></i> Edit Lender Details","lenders/manage_lender.php?id="+$(this).attr('data-id'),"mid-large")
        })
        // EMI Jama karne ke liye
        $('.pay_emi').click(function(){
            uni_modal("<i class='fa fa-money-bill-wave'></i> Record EMI Payment for "+$(this).attr('data-name'),"lenders/manage_payment.php?lender_id="+$(this).attr('data-id'))
        })
        // Delete karne ke liye
        $('.delete_data').click(function(){
            _conf("Are you sure to delete this lender permanently?","delete_lender",[$(this).attr('data-id')])
        })
        $('#lender-list').DataTable();
    })

    function delete_lender($id){
        start_loader();
        $.ajax({
            url:_base_url_+"classes/Master.php?f=delete_lender",
            method:"POST",
            data:{id:$id},
            dataType:"json",
            error:err=>{
                console.log(err)
                alert_toast("An error occured.",'error');
                end_loader();
            },
            success:function(resp){
                if(typeof resp== 'object' && resp.status == 'success'){
                    location.reload();
                }else{
                    alert_toast("An error occured.",'error');
                    end_loader();
                }
            }
        })
    }
</script>