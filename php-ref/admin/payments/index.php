<?php if($_settings->chk_flashdata('success')): ?>
<script>
    alert_toast("<?php echo $_settings->flashdata('success') ?>",'success')
</script>
<?php endif;?>

<div class="card card-outline card-primary shadow">
    <div class="card-header">
        <h3 class="card-title">List of Client Payments</h3>
        <div class="card-tools">
            <a href="javascript:void(0)" id="create_new" class="btn btn-flat btn-primary"><span class="fas fa-plus"></span> Record New Payment</a>
        </div>
    </div>
    <div class="card-body">
        <div class="container-fluid">
            <div class="row justify-content-center mb-4">
                <div class="col-md-5">
                    <div class="input-group shadow-sm">
                        <div class="input-group-prepend">
                            <span class="input-group-text bg-primary text-white border-0">Filter by Client:</span>
                        </div>
                        <select id="client_filter" class="form-control select2 border-0">
                            <option value="all">All Clients</option>
                            <?php 
                            $clients = $conn->query("SELECT id, CONCAT(firstname, ' ', lastname) as fullname FROM client_list WHERE delete_flag = 0 ORDER BY fullname ASC");
                            while($c_row = $clients->fetch_assoc()):
                            ?>
                            <option value="<?= $c_row['fullname'] ?>"><?= $c_row['fullname'] ?></option>
                            <?php endwhile; ?>
                        </select>
                    </div>
                </div>
            </div>

            <div class="table-responsive">
                <table class="table table-bordered table-hover" id="payment-table">
                    <colgroup>
                        <col width="5%">
                        <col width="12%">
                        <col width="13%">
                        <col width="20%">
                        <col width="15%">
                        <col width="10%">
                        <col width="15%">
                        <col width="10%">
                    </colgroup>
                    <thead class="bg-light">
                        <tr>
                            <th>#</th>
                            <th>Payment ID</th>
                            <th>Date</th>
                            <th>Client Name</th>
                            <th>Amount Paid</th>
                            <th>Discount</th>
                            <th>Mode</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php 
$i = 1;
/** * EXACT LOGIC FROM view_client.php:
 * 1. Total Repair = Status 5 (Delivered) from transaction_list
 * 2. Total Direct Sales = from direct_sales table
 * 3. Total Paid/Settled = (amount + discount) from client_payments
 */
$qry = $conn->query("SELECT p.*, c.firstname, c.lastname, p.client_id 
                     FROM `client_payments` p 
                     LEFT JOIN `client_list` c ON p.client_id = c.id 
                     ORDER BY p.payment_date DESC, p.id DESC");

while($row = $qry->fetch_assoc()):
    $c_id = $row['client_id'];
    
    // A. Total Repair Billed (Status 5 = Delivered)
    $billed_qry = $conn->query("SELECT SUM(amount) as total FROM transaction_list WHERE client_name = '{$c_id}' AND status = 5");
    $total_repair = $billed_qry->fetch_assoc()['total'] ?? 0;

    // B. Total Direct Sales
    $sales_qry = $conn->query("SELECT SUM(total_amount) as total FROM direct_sales WHERE client_id = '{$c_id}'");
    $total_sales = $sales_qry->fetch_assoc()['total'] ?? 0;

    // Total Bill = Repair + Sales
    $total_bill = $total_repair + $total_sales;

    // C. Total Paid + Discount (Total Settled)
    $paid_qry = $conn->query("SELECT SUM(amount + discount) as total_settled FROM client_payments WHERE client_id = '{$c_id}'");
    $total_settled = $paid_qry->fetch_assoc()['total_settled'] ?? 0;

    // Final Due calculation
    $due = $total_bill - $total_settled;
?>
    <tr>
        <td class="text-center"><?php echo $i++; ?></td>
       <td class="font-weight-bold">
    <a href="javascript:void(0)" class="view_data text-navy" data-id="<?php echo $row['id'] ?>">
        PY-<?= str_pad($row['id'], 4, '0', STR_PAD_LEFT) ?>
    </a>
</td>
        <td><?php echo date("M d, Y", strtotime($row['payment_date'])) ?></td>
        
        <td>
            <div style="line-height:1.2em">
                <a href="./?page=clients/view_client&id=<?php echo $row['client_id'] ?>" class="text-primary font-weight-bold">
                    <i class="fa fa-user-circle mr-1"></i>
                    <?php echo ucwords($row['firstname'].' '.$row['lastname']) ?>
                </a>
                <br>
                <small class="text-muted">
                    Total Bill: ₹<?php echo number_format($total_bill, 2) ?><br>
                    Balance Due: <span class="text-danger font-weight-bold">₹<?php echo number_format($due, 2) ?></span>
                </small>
            </div>
        </td>

        <td class="text-right">₹<?php echo number_format($row['amount'], 2) ?></td>
        <td class="text-right text-danger">₹<?php echo number_format($row['discount'] ?? 0, 2) ?></td>
        <td class="text-center">
            <span class="badge badge-info px-3 rounded-pill"><?php echo $row['payment_mode'] ?></span>
        </td>
        <td align="center">
             <button type="button" class="btn btn-flat btn-default btn-sm dropdown-toggle dropdown-icon" data-toggle="dropdown">
                      Action
                <span class="sr-only">Toggle Dropdown</span>
              </button>
              <div class="dropdown-menu" role="menu">
                <a class="dropdown-item view_data" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>"><span class="fa fa-eye text-dark"></span> View Receipt</a>
                <div class="dropdown-divider"></div>
                <a class="dropdown-item delete_data" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>"><span class="fa fa-trash text-danger"></span> Delete</a>
              </div>
        </td>
    </tr>
<?php endwhile; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<script>
    $(document).ready(function(){
        // DataTables Initialization
        var table = $('#payment-table').DataTable({
            columnDefs: [
                { orderable: false, targets: [7] }
            ],
            order: [0, 'asc'],
            language: {
                search: "Global Search:"
            }
        });

        // Client Filter Logic
        $('#client_filter').on('change', function(){
            var val = $(this).val();
            if(val == 'all'){
                table.column(3).search('').draw(); 
            } else {
                table.column(3).search(val).draw();
            }
        });

        // Modals
        $('.delete_data').click(function(){
            _conf("Are you sure to delete this payment record permanently?","delete_payment",[$(this).attr('data-id')])
        })
        $('.view_data').click(function(){
            uni_modal("<i class='fa fa-receipt'></i> Payment Details","payments/view_payment.php?id="+$(this).attr('data-id'))
        })
        $('#create_new').click(function(){
            uni_modal("<i class='fa fa-plus'></i> Record New Payment","payments/manage_payment.php")
        })

        if($('.select2').length > 0)
            $('.select2').select2({width:'100%'});
    })

    function delete_payment($id){
        start_loader();
        $.ajax({
            url:_base_url_+"classes/Master.php?f=delete_payment",
            method:"POST",
            data:{id: $id},
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