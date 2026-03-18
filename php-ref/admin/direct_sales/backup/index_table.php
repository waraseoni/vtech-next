<?php if($_settings->chk_flashdata('success')): ?>
<script>alert_toast("<?php echo $_settings->flashdata('success') ?>",'success')</script>
<?php endif;?>

<div class="card card-outline card-primary">
    <div class="card-header">
        <h3 class="card-title"><b>Direct Sales List</b></h3>
        <div class="card-tools">
            <a href="./?page=direct_sales/manage_sale" class="btn btn-flat btn-primary"><span class="fas fa-plus"></span> New Sale</a>
        </div>
    </div>
    <div class="card-body">
        <div class="container-fluid">
            <table class="table table-hover table-striped table-bordered">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Sale Code</th>
                        <th>Client</th>
                        <th>Amount</th>
                        <th>Payment Mode</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    <?php 
                    $i = 1;
                    $sales = $conn->query("SELECT ds.*, CONCAT(c.firstname,' ',c.middlename,' ',c.lastname) as client_name 
                                           FROM direct_sales ds 
                                           LEFT JOIN client_list c ON ds.client_id = c.id 
                                           ORDER BY ds.date_created DESC");
                    while($row = $sales->fetch_assoc()):
                    ?>
                    <tr>
                        <td><?= $i++ ?></td>
                        <td><?= date("M d, Y", strtotime($row['date_created'])) ?></td>
                        <td><?= $row['sale_code'] ?></td>
                        <td><?= $row['client_name'] ?: 'Walk-in Customer' ?></td>
                        <td class="text-right">₹<?= number_format($row['total_amount'], 2) ?></td>
                        <td><?= $row['payment_mode'] ?></td>
                        <td align="center">
                            <button type="button" class="btn btn-flat btn-default btn-sm dropdown-toggle dropdown-icon" data-toggle="dropdown">
                                Action
                            </button>
                            <div class="dropdown-menu">
                                <a class="dropdown-item" href="./?page=direct_sales/view_sale&id=<?= $row['id'] ?>">View</a>
                                <div class="dropdown-divider"></div>
                                <a class="dropdown-item delete_data" href="javascript:void(0)" data-id="<?= $row['id'] ?>">Delete</a>
                            </div>
                        </td>
                    </tr>
                    <?php endwhile; ?>
                </tbody>
            </table>
        </div>
    </div>
</div>

<script>
$(document).ready(function(){
    $('.delete_data').click(function(){
        _conf("Are you sure to delete this direct sale permanently?","delete_sale",[$(this).attr('data-id')])
    })
    $('.table').dataTable();
})

function delete_sale($id){
    start_loader();
    $.ajax({
        url:_base_url_+"classes/Master.php?f=delete_direct_sale",
        method:"POST",
        data:{id: $id},
        dataType:"json",
        success:function(resp){
            if(resp.status=='success'){
                location.reload();
            }else{
                alert_toast("An error occured.",'error');
                end_loader();
            }
        }
    })
}
</script>