<?php 
$lender_id = isset($_GET['lender_id']) ? $_GET['lender_id'] : 'all';
?>
<div class="card card-outline card-navy shadow">
    <div class="card-header">
        <h3 class="card-title text-navy font-weight-bold"><i class="fas fa-history mr-2"></i> Loan EMI Payment History</h3>
    </div>
		                   
            <a href="./?page=lenders" class="btn btn-light btn-sm border">
                <i class="fa fa-angle-left"></i> Back to List
            </a>
        
    <div class="card-body">
        <div class="row mb-4 no-print border-bottom pb-3">
            <div class="col-md-4">
                <label>Filter by Lender</label>
                <select id="filter_lender" class="form-control form-control-sm select2">
                    <option value="all" <?php echo $lender_id == 'all' ? 'selected' : '' ?>>All Lenders</option>
                    <?php 
                    $lenders = $conn->query("SELECT id, fullname FROM lender_list order by fullname asc");
                    while($l = $lenders->fetch_assoc()):
                    ?>
                    <option value="<?php echo $l['id'] ?>" <?php echo $lender_id == $l['id'] ? 'selected' : '' ?>><?php echo $l['fullname'] ?></option>
                    <?php endwhile; ?>
                </select>
            </div>
            <div class="col-md-4 d-flex align-items-end">
                <button class="btn btn-navy bg-navy btn-sm" id="filter_btn"><i class="fa fa-filter"></i> Filter</button>
                <button class="btn btn-success btn-sm ml-2" onclick="window.print()"><i class="fa fa-print"></i> Print</button>
            </div>
        </div>

        <div id="out-print">
            <table class="table table-bordered table-striped table-sm" id="payment-history-table">
                <thead>
                    <tr class="bg-navy text-white">
                        <th class="text-center">Date</th>
                        <th>Lender Name</th>
                        <th>Remarks/Note</th>
                        <th class="text-right">Amount Paid</th>
                        <th class="text-center no-print">Action</th>
                    </tr>
                </thead>
                <tbody>
                    <?php 
                    $where = "";
                    if($lender_id != 'all') $where = " WHERE p.lender_id = '{$lender_id}' ";

                    $total_paid = 0;
                    $qry = $conn->query("SELECT p.*, l.fullname 
                                        FROM loan_payments p 
                                        INNER JOIN lender_list l ON p.lender_id = l.id 
                                        $where ORDER BY p.payment_date DESC");
                    
                    if($qry->num_rows > 0):
                    while($row = $qry->fetch_assoc()):
                        $total_paid += $row['amount_paid'];
                    ?>
                    <tr>
                        <td class="text-center" data-order="<?= strtotime($row['payment_date']) ?>">
                            <?php echo date("d-M-Y", strtotime($row['payment_date'])) ?>
                        </td>
                        <td><b><?php echo $row['fullname'] ?></b></td>
                        <td><?php echo $row['remarks'] ?></td>
                        <td class="text-right font-weight-bold text-success">₹ <?php echo number_format($row['amount_paid'], 2) ?></td>
                        <td class="text-center no-print">
                            <button type="button" class="btn btn-flat btn-default btn-xs dropdown-toggle dropdown-icon" data-toggle="dropdown">
                                Action <span class="sr-only">Toggle Dropdown</span>
                            </button>
                            <div class="dropdown-menu" role="menu">
                                <a class="dropdown-item edit_payment" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>"><span class="fa fa-edit text-primary"></span> Edit</a>
                                <div class="dropdown-divider"></div>
                                <a class="dropdown-item delete_payment" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>"><span class="fa fa-trash text-danger"></span> Delete</a>
                            </div>
                        </td>
                    </tr>
                    <?php endwhile; ?>
                <?php else: ?>
                    <tr>
                        <td colspan="5" class="text-center">No payment records found.</td>
                    </tr>
                <?php endif; ?>
                </tbody>
                <tfoot>
                    <tr class="bg-light">
                        <th colspan="3" class="text-right">Total Amount Paid:</th>
                        <th class="text-right text-navy" style="font-size:1.1rem">₹ <?php echo number_format($total_paid, 2) ?></th>
                        <th class="no-print"></th>
                    </tr>
                </tfoot>
            </table>
        </div>
    </div>
</div>

<script>
    $(function(){
        // DataTable for sorting
        $('#payment-history-table').DataTable({
            "order": [[0, "desc"]]
        });

        // Filter functionality
        $('#filter_btn').click(function(){
            var lid = $('#filter_lender').val();
            location.href = "./?page=lenders/payment_history&lender_id="+lid;
        });

        // Edit Payment
        $('.edit_payment').click(function(){
            uni_modal("<i class='fa fa-edit'></i> Edit EMI Payment","lenders/manage_payment.php?id="+$(this).attr('data-id'))
        });

        // Delete Payment
        $('.delete_payment').click(function(){
            _conf("Are you sure to delete this payment record?","delete_loan_payment",[$(this).attr('data-id')])
        });
    })

    function delete_loan_payment($id){
        start_loader();
        $.ajax({
            url:_base_url_+"classes/Master.php?f=delete_loan_payment",
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