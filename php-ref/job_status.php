<?php 
if(isset($_GET['job_id'])){
    $qry = $conn->query("SELECT r.*,CONCAT(c.firstname,', ',c.middlename,' ',c.lastname) as client from `transaction_list` r inner join client_list c on r.client_name = c.id where r.job_id = '{$_GET['job_id']}'");
    if($qry->num_rows > 0){
        $res = $qry->fetch_array();
        foreach($res as $k => $v){
            if(!is_numeric($k)){
                $$k = $v;
            }
        }
    }else{
    echo "<script>alert('Unknown Transaction Code'); location.replace('./');</script>";
    }
}
else{
    echo "<script>alert('Transaction Code is required'); location.replace('./');</script>";
}
?>
<style>
    @media screen {
        .show-print{
            display:none;
        }
    }
    img#repair-banner{
		height: 45vh;
		width: 20vw;
		object-fit: scale-down;
		object-position: center center;
	}
    /* Dark Theme Styles */
    body {
        background-color: #121212;
        color: #e0e0e0;
    }
    .card-dark {
        background-color: #1e1e1e;
        border-color: #333;
    }
    .card-header {
        background-color: #252525;
        border-bottom: 1px solid #333;
    }
    .card-title {
        color: #4fc3f7 !important;
    }
    .table {
        background-color: #252525;
        color: #e0e0e0;
        border-color: #444;
    }
    .table th {
        background-color: #2d2d2d;
        border-color: #444;
        color: #bb86fc;
    }
    .table td {
        border-color: #444;
        background-color: #1e1e1e;
    }
    .table-stripped tbody tr:nth-of-type(odd) {
        background-color: #2a2a2a;
    }
    .bg-gradient-dark {
        background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%) !important;
        color: #e0e0e0 !important;
    }
    fieldset {
        border: 1px solid #444;
        padding: 15px;
        border-radius: 5px;
        margin-bottom: 20px;
        background-color: #252525;
    }
    legend {
        color: #bb86fc;
        font-weight: 600;
        padding: 0 10px;
        width: auto;
    }
    .text-muted {
        color: #aaa !important;
    }
    hr {
        border-color: #444;
    }
    .btn-light {
        background-color: #333;
        border-color: #555;
        color: #e0e0e0;
    }
    .btn-light:hover {
        background-color: #444;
        border-color: #666;
        color: #fff;
    }
    h3, h5 {
        color: #e0e0e0;
    }
    #total_amount {
        color: #4caf50;
    }
    .badge {
        font-weight: 500;
    }
    .badge-default {
        background-color: #555;
        color: #e0e0e0;
    }
    .badge-primary {
        background-color: #1976d2;
        color: #fff;
    }
    .badge-success {
        background-color: #388e3c;
        color: #fff;
    }
    .badge-danger {
        background-color: #d32f2f;
        color: #fff;
    }
    .bg-gradient-teal {
        background: linear-gradient(135deg, #26a69a 0%, #00796b 100%) !important;
        color: #fff !important;
    }
    .border-bottom {
        border-bottom-color: #444 !important;
    }
</style>
<div class="content py-3">
    <div class="card card-outline card-dark rounded-0">
        <div class="card-header rounded-0">
            <h5 class="card-title text-primary">Transaction Details</h5>
        </div>
        <div class="card-body">
            <div class="container-fluid">
                <div id="outprint">
                    <fieldset>
                        <div class="row">
                            <div class="col-12">
                                <table class="table table-bordered">
                                    <colgroup>
                                        <col width="30%">
                                        <col width="70%">
                                    </colgroup>
									<tr>
                                        <th class="px-2 py-1">Job No.</th>
                                        <td><?= ($job_id) ?></td>
                                    </tr>
                                    <tr>
                                        <th class="px-2 py-1">Code</th>
                                        <td><?= ($code) ?></td>
                                    </tr>
                                    <tr>
                                        <th class="px-2 py-1">Client Name</th>
                                        <td><?= ucwords($client) ?></td>
                                    </tr>
									<tr>
                                        <th class="px-2 py-1">Item</th>
                                        <td><?= ucwords($item) ?></td>
                                    </tr>
									<tr>
                                        <th class="px-2 py-1">Fault</th>
                                        <td><?= ucwords($fault) ?></td>
                                    </tr>
                                </table>
                            </div>
                        </div>
                        <div class="row">
                                <div class="col-md-6">
                                    <fieldset>
                                        <legend class="border-bottom">Services</legend>
                                        <table class="table table-stripped table-bordered" data-placeholder='true' id="service_list">
                                            <colgroup>
                                                <col width="70%">
                                                <col width="30%">
                                            </colgroup>
                                            <thead>
                                                <tr>
                                                    <th class="text-center py-1">Service</th>
                                                    <th class="text-center py-1">Price</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <?php
                                                $services = $conn->query("SELECT rs.*,s.name FROM `transaction_services` rs inner join service_list s on rs.service_id = s.id where rs.transaction_id = '{$id}' ");
                                                while($row =  $services->fetch_assoc()):
                                                ?>
                                                    <tr>
                                                        <td class="py-1 px-2"><?= $row['name'] ?></td>
                                                        <td class="py-1 px-2 text-right"><?= number_format($row['price'],2) ?></td>
                                                    </tr>
                                                <?php endwhile; ?>
                                            </tbody>
                                        </table>
                                    </fieldset>
                                </div>
                                <div class="col-md-6">
                                    <fieldset>
                                        <legend class="border-bottom">Products</legend>
                                        <table class="table table-stripped table-bordered" data-placeholder='true' id="product_list">
                                            <colgroup>
                                                <col width="70%">
												<col width="10%">
                                                <col width="20%">
                                            </colgroup>
                                            <thead>
                                                <tr>
                                                    <th class="text-center py-1">Product</th>
													<th class="text-center py-1">Qty</th>
                                                    <th class="text-center py-1">Price</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <?php
                                                $products = $conn->query("SELECT rs.*,s.name FROM `transaction_products` rs inner join product_list s on rs.product_id = s.id where rs.transaction_id = '{$id}' ");
                                                while($row =  $products->fetch_assoc()):
                                                ?>
                                                    <tr>
                                                        <td class="py-1 px-2"><?= $row['name'] ?></td>
														<td class="py-1 px-2 text-right"><?= number_format($row['qty'],2) ?></td>
                                                        <td class="py-1 px-2 text-right"><?= number_format($row['price'],2) ?></td>
                                                    </tr>
                                                <?php endwhile; ?>
                                            </tbody>
                                        </table>
                                    </fieldset>
                                </div>
                            </div>
                            <div class="row mt-3">
                                <div class="form-group col-md-12">
                                    <h3><b>Total Payable Amount: <span id="total_amount" class="pl-3"><?=number_format($amount,2)?></span></b></h3>
                                </div>
                            </div>
                            <div class="row">
                                <div class="form-group col-md-12">
                                    <small class="text-muted px-2">Remarks</small><br>
                                    <p><?= str_replace("\n","<br/>",$remark) ?></p>
                                </div>
                            </div>
                            <div class="row">
                                <div class="form-group col-md-4">
                                    <small class="text-muted px-2">Status</small><br>
                                    <?php 
									switch ($status){
										case 0:
										echo '<span class="badge badge-default border px-3 rounded-pill">Pending</span>';
										break;
									case 1:
										echo '<span class="badge badge-primary px-3 rounded-pill">On-Progress</span>';
										break;
									case 2:
										echo '<span class="badge badge-success px-3 rounded-pill">Done</span>';
										break;
									case 3:
										echo '<span class="badge badge-success bg-gradient-teal px-3 rounded-pill">Paid</span>';
										break;
									case 4:
										echo '<span class="badge badge-danger px-3 rounded-pill">Cancelled</span>';
										break;
									case 5:
										echo '<span class="badge badge-success bg-gradient-teal px-3 rounded-pill">Delivered</span>';
										break;
									}
								?>
                                </div>
                            </div>
                    </fieldset>
                </div>
                
                <hr>
                <div class="rounded-0 text-center mt-3">
                        <a class="btn btn-light border btn-flat btn-sm" href="./?p=check_status" ><i class="fa fa-angle-left"></i> Back</a>
                </div>
            </div>
        </div>
    </div>
</div>
<script>
    $(function(){
        $('#delete_data').click(function(){
			_conf("Are you sure to delete <b><?= $code ?>\'s</b> from repair permanently?","delete_repair",[$(this).attr('data-id')])
		})
    })
    function delete_repair($id){
		start_loader();
		$.ajax({
			url:_base_url_+"classes/Master.php?f=delete_repair",
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
					location.replace= './?page=repairs';
				}else{
					alert_toast("An error occured.",'error');
					end_loader();
				}
			}
		})
	}
</script>