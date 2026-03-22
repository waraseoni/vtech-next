<?php if($_settings->chk_flashdata('success')): ?>
<script>
    alert_toast("<?php echo $_settings->flashdata('success') ?>",'success')
</script>
<?php endif;?>

<link rel="stylesheet" href="https://cdn.datatables.net/buttons/2.4.2/css/buttons.bootstrap4.min.css">

<style>
    .img-avatar{ width:45px; height:45px; object-fit:cover; border-radius:100%; }
    .address-text { font-size: 0.95rem; color: #444; line-height: 1.3; }
    .client-name-text { font-size: 1.05rem; font-weight: 600; }
    /* Dashboard Cards Styling */
    .info-box { box-shadow: 0 0 1px rgba(0,0,0,.125), 0 1px 3px rgba(0,0,0,.2); border-radius: .25rem; background: #fff; display: flex; margin-bottom: 1rem; min-height: 80px; padding: .5rem; position: relative; width: 100%; }
    .info-box .info-box-icon { border-radius: .25rem; align-items: center; display: flex; font-size: 1.875rem; justify-content: center; text-align: center; width: 70px; }
    .info-box .info-box-content { display: flex; flex-direction: column; justify-content: center; line-height: 1.2; flex: 1; padding: 0 10px; }
    .high-balance { background-color: #fff5f5 !important; } /* High balance highlighting */
</style>

<div class="row">
    <?php
    // Optimized: Ek hi baar mein poore system ka total nikalna
    $totals = $conn->query("SELECT 
        SUM(opening_balance) as total_opening,
        (SELECT SUM(amount) FROM transaction_list WHERE status = 5) as total_billed,
        (SELECT SUM(amount + discount) FROM client_payments) as total_paid,
        (SELECT COUNT(id) FROM client_list WHERE delete_flag = 0) as total_clients
    FROM client_list WHERE delete_flag = 0")->fetch_assoc();
    
    $grand_receivable = ($totals['total_opening'] + $totals['total_billed']) - $totals['total_paid'];
    ?>
    <div class="col-12 col-sm-6 col-md-4">
        <div class="info-box">
            <span class="info-box-icon bg-primary elevation-1"><i class="fas fa-users"></i></span>
            <div class="info-box-content">
                <span class="info-box-text">Total Clients</span>
                <span class="info-box-number"><?php echo number_format($totals['total_clients']) ?></span>
            </div>
        </div>
    </div>
    <div class="col-12 col-sm-6 col-md-4">
        <div class="info-box">
            <span class="info-box-icon bg-danger elevation-1"><i class="fas fa-money-bill-wave"></i></span>
            <div class="info-box-content">
                <span class="info-box-text">Total Outstanding Due</span>
                <span class="info-box-number">₹ <?php echo number_format($grand_receivable, 2) ?></span>
            </div>
        </div>
    </div>
    <div class="col-12 col-sm-6 col-md-4">
        <div class="info-box shadow-none border">
            <span class="info-box-icon bg-success elevation-1"><i class="fas fa-check-circle"></i></span>
            <div class="info-box-content">
                <span class="info-box-text">Total Collections</span>
                <span class="info-box-number">₹ <?php echo number_format($totals['total_paid'], 2) ?></span>
            </div>
        </div>
    </div>
</div>

<div class="card card-outline card-primary shadow-sm">
    <div class="card-header">
        <h3 class="card-title"><b><i class="fa fa-users text-primary"></i> Client Management</b></h3>
        <div class="card-tools">
            <a href="javascript:void(0)" id="create_new" class="btn btn-flat btn-sm btn-primary">
                <span class="fas fa-plus"></span> Add New Client
            </a>
        </div>
    </div>
    <div class="card-body">
        <div class="container-fluid">
            <table class="table table-hover table-striped table-bordered" id="client-list-main">
                <thead class="bg-navy">
                    <tr>
                        <th class="text-center">#</th>
                        <th>Client Details</th>
                        <th>Contact Info</th>
                        <th width="20%">Address</th>
                        <th class="text-right">Balance</th>
                        <th class="text-center">Action</th>
                    </tr>
                </thead>
                <tbody>
                    <?php 
                    $i = 1;
                    // IMPROVEMENT: Single Optimized Query using Subqueries to prevent N+1 problem
                    $qry = $conn->query("SELECT c.*, 
                        COALESCE((SELECT SUM(amount) FROM transaction_list WHERE client_name = c.id AND status = 5), 0) as total_billed,
                        COALESCE((SELECT SUM(amount + discount) FROM client_payments WHERE client_id = c.id), 0) as total_paid
                        FROM `client_list` c WHERE c.delete_flag = 0 ORDER BY c.firstname ASC");
                    
                    while($row = $qry->fetch_assoc()):
                        $current_balance = ($row['opening_balance'] + $row['total_billed']) - $row['total_paid'];
                        $fullname = ucwords($row['firstname'] . ' ' . $row['lastname']);
                        // High balance highlight logic
                        $row_class = ($current_balance > 10000) ? 'high-balance' : ''; 
                    ?>
                    <tr class="<?php echo $row_class ?>">
                        <td class="text-center"><?php echo $i++; ?></td>
                        <td>
                            <div class="client-name-text"><?php echo $fullname ?></div>
                            <small class="text-muted">ID: <?php echo $row['id'] ?></small>
                        </td>
                        <td>
                            <div class="lh-1">
                                <div><i class="fa fa-phone-alt fa-fw text-primary"></i> <?php echo $row['contact'] ?></div>
                                <div class="mt-1"><i class="fa fa-envelope fa-fw text-danger"></i> <?php echo $row['email'] ?: 'No Email' ?></div>
                                <?php if(!empty($row['contact'])): 
                                    $wa_msg = "Namaste ". $fullname .", aapka pending balance ₹". number_format($current_balance, 2) ." hai. Kripya bhugtan karein.";
                                ?>
                                <a href="https://wa.me/91<?php echo $row['contact'] ?>?text=<?php echo urlencode($wa_msg) ?>" target="_blank" class="badge badge-success mt-1">
                                    <i class="fab fa-whatsapp"></i> Send Reminder
                                </a>
                                <?php endif; ?>
                            </div>
                        </td>
                        <td class="address-text"><?php echo $row['address'] ?></td>
                        <td class="text-right font-weight-bold" data-order="<?php echo $current_balance ?>">
                            <span class="<?php echo ($current_balance > 0) ? 'text-danger' : 'text-success' ?>">
                                ₹ <?php echo number_format($current_balance, 2) ?>
                            </span>
                        </td>
                        <td align="center">
                             <div class="btn-group">
                                <button type="button" class="btn btn-flat btn-default btn-sm dropdown-toggle dropdown-icon" data-toggle="dropdown">Action</button>
                                <div class="dropdown-menu" role="menu">
                                    <a class="dropdown-item" href="./?page=clients_admin/view_client&id=<?php echo $row['id'] ?>"><span class="fa fa-eye text-primary"></span> View</a>
                                    <div class="dropdown-divider"></div>
                                    <a class="dropdown-item edit_data" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>"><span class="fa fa-edit text-info"></span> Edit</a>
                                    <div class="dropdown-divider"></div>
                                    <a class="dropdown-item delete_data" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>"><span class="fa fa-trash text-danger"></span> Delete</a>
                                </div>
                            </div>
                        </td>
                    </tr>
                    <?php endwhile; ?>
                </tbody>
                <tfoot>
                    <tr class="bg-light">
                        <th colspan="4" class="text-right">Total Outstanding:</th>
                        <th class="text-right text-danger">₹ <?php echo number_format($grand_receivable, 2) ?></th>
                        <th></th>
                    </tr>
                </tfoot>
            </table>
        </div>
    </div>
</div>

<script src="https://cdn.datatables.net/buttons/2.4.2/js/dataTables.buttons.min.js"></script>
<script src="https://cdn.datatables.net/buttons/2.4.2/js/buttons.bootstrap4.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.53/pdfmake.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.53/vfs_fonts.js"></script>
<script src="https://cdn.datatables.net/buttons/2.4.2/js/buttons.html5.min.js"></script>
<script src="https://cdn.datatables.net/buttons/2.4.2/js/buttons.print.min.js"></script>

<script>
    $(document).ready(function(){
        // DataTable Initialization with Buttons
        var table = $('#client-list-main').DataTable({
            "pageLength": 25,
            "order": [[4, "desc"]],
            "dom": 'Bfrtip', // 'B' for buttons
            "buttons": [
                { extend: 'excelHtml5', className: 'btn-sm btn-success', text: '<i class="fas fa-file-excel"></i> Excel', exportOptions: { columns: [0,1,2,3,4] } },
                { extend: 'pdfHtml5', className: 'btn-sm btn-danger', text: '<i class="fas fa-file-pdf"></i> PDF', exportOptions: { columns: [0,1,2,3,4] } },
                { extend: 'print', className: 'btn-sm btn-info', text: '<i class="fas fa-print"></i> Print' }
            ],
            "columnDefs": [
                { "orderable": false, "targets": [5] }, 
                { "type": "num", "targets": 4 }        
            ]
        });

        $('#create_new').click(function(e){
            e.preventDefault();
            uni_modal("<i class='fa fa-plus'></i> Add New Client","clients/manage_client.php",'mid-large')
        });

        $(document).on('click', '.edit_data', function(e){
            e.preventDefault();
            uni_modal("<i class='fa fa-edit'></i> Update Client Details","clients/manage_client.php?id=" + $(this).attr('data-id'), 'mid-large');
        });

        $(document).on('click', '.delete_data', function(e){
            e.preventDefault();
            _conf("Are you sure to delete this client permanently?","delete_client",[$(this).attr('data-id')])
        });
    });

    function delete_client($id){
        start_loader();
        $.ajax({
            url: _base_url_ + "classes/Master.php?f=delete_client",
            method: "POST",
            data: {id: $id},
            dataType: "json",
            error: err => {
                console.log(err);
                alert_toast("An error occurred.",'error');
                end_loader();
            },
            success: function(resp){
                if(typeof resp == 'object' && resp.status == 'success'){
                    location.reload();
                } else {
                    alert_toast("An error occurred.",'error');
                    end_loader();
                }
            }
        })
    }
</script>