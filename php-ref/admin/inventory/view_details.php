<?php
if(isset($_GET['id']) && $_GET['id'] > 0){
    // Product details fetch karein image_path ke sath
    $qry = $conn->query("SELECT * FROM product_list WHERE id = '{$_GET['id']}'");
    if($qry->num_rows > 0){
        foreach($qry->fetch_assoc() as $k => $v){ $$k=$v; }
    }
}
?>
<style>
    /* Image styling */
    .product-view-img {
        width: 150px;
        height: 150px;
        object-fit: scale-down;
        object-position: center;
        border: 1px solid #ddd;
        border-radius: 8px;
        background: white;
    }
</style>

<div class="content py-3">
    <div class="card card-outline card-navy shadow">
        <div class="card-header">
            <h3 class="card-title"><b><i class="fas fa-info-circle text-navy"></i> Product Details & History</b></h3>
            <div class="card-tools">
                <button class="btn btn-primary btn-sm btn-flat" id="add_stock"><i class="fa fa-plus"></i> Add New Stock</button>
                <a href="./?page=inventory" class="btn btn-default border btn-sm btn-flat"><i class="fa fa-angle-left"></i> Back to List</a>
            </div>
        </div>
        <div class="card-body">
            <div class="row align-items-center mb-4 pb-3 border-bottom">
                <div class="col-auto">
                    <img src="<?= validate_image(isset($image_path) ? $image_path : '') ?>" alt="Product Image" class="product-view-img shadow-sm">
                </div>
                <div class="col">
                    <h2 class="font-weight-bold mb-0"><?= isset($name) ? $name : 'N/A' ?></h2>
                    <p class="text-muted mb-0"><?= isset($description) ? $description : 'No description available.' ?></p>
                    <div class="mt-2">
                        <span class="badge badge-info">ID: <?= isset($id) ? $id : '' ?></span>
                    </div>
                </div>
            </div>

            <div class="row">
                <?php 
                    $t_in = $conn->query("SELECT SUM(quantity) FROM inventory_list WHERE product_id = '{$id}'")->fetch_array()[0] ?? 0;
                    $t_out = $conn->query("SELECT SUM(qty) FROM (
                        SELECT product_id, qty FROM transaction_products tp JOIN transaction_list tl ON tp.transaction_id = tl.id WHERE tl.status != 4 
                        UNION ALL 
                        SELECT product_id, qty FROM direct_sale_items
                    ) as s WHERE product_id = '{$id}'")->fetch_array()[0] ?? 0;
                    $available = $t_in - $t_out;
                ?>
                <div class="col-md-4">
                    <div class="info-box bg-gradient-light border">
                        <span class="info-box-icon bg-navy"><i class="fas fa-box"></i></span>
                        <div class="info-box-content">
                            <span class="info-box-text">Available Stock</span>
                            <span class="info-box-number text-lg"><?= number_format($available) ?></span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="info-box bg-gradient-light border text-success">
                        <span class="info-box-icon bg-success"><i class="fas fa-shopping-cart"></i></span>
                        <div class="info-box-content">
                            <span class="info-box-text">Total Sold</span>
                            <span class="info-box-number text-lg"><?= number_format($t_out) ?></span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="mt-4">
                <h5><b>Stock-In History</b></h5>
                <table class="table table-bordered table-striped" id="stock-history-table">
    <thead>
        <tr class="bg-navy">
            <th class="px-2 py-1 text-center">#</th>
            <th class="px-2 py-1 text-center">Date</th>
            <th class="px-2 py-1 text-center">Quantity</th>
            <th class="px-2 py-1 text-center">Location (Place)</th> <th class="px-2 py-1 text-center">Action</th>
        </tr>
    </thead>
    <tbody>
        <?php 
        $i = 1;
        // Query mein 'place' column pehle se select ho jayega 'SELECT *' ki wajah se
        $stocks = $conn->query("SELECT * FROM `inventory_list` where product_id = '{$id}' order by `stock_date` desc");
        while($row = $stocks->fetch_assoc()):
        ?>
        <tr>
            <td class="px-2 py-1 align-middle text-center"><?php echo $i++; ?></td>
            <td class="px-2 py-1 align-middle"><?php echo date("M d, Y", strtotime($row['stock_date'])) ?></td>
            <td class="px-2 py-1 align-middle text-right"><?php echo number_format($row['quantity']) ?></td>
            <td class="px-2 py-1 align-middle text-center"><?php echo !empty($row['place']) ? $row['place'] : '<span class="text-muted">Not Specified</span>' ?></td>
            <td class="px-2 py-1 align-middle text-center">
                <button type="button" class="btn btn-flat btn-default btn-sm dropdown-toggle dropdown-icon" data-toggle="dropdown">
                    Action
                    <span class="sr-only">Toggle Dropdown</span>
                </button>
                <div class="dropdown-menu" role="menu">
                    <a class="dropdown-item edit_stock" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>"><span class="fa fa-edit text-primary"></span> Edit</a>
                    <div class="dropdown-divider"></div>
                    <a class="dropdown-item delete_stock" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>"><span class="fa fa-trash text-danger"></span> Delete</a>
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

<div class="mt-4">
                <h5><b>Stock-Out (Usage) History</b></h5>
                <table class="table table-bordered table-striped" id="stock-out-table">
                    <thead>
                        <tr class="bg-navy">
                            <th class="px-2 py-1 text-center">#</th>
                            <th class="px-2 py-1 text-center">Date</th>
                            <th class="px-2 py-1 text-center">Reference (Job ID / Code)</th>
                            <th class="px-2 py-1 text-center">Type</th>
                            <th class="px-2 py-1 text-center">Client Name</th>
                            <th class="px-2 py-1 text-center">Rate</th>
                            <th class="px-2 py-1 text-center">Qty</th>
                            <th class="px-2 py-1 text-center">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php 
                        $j = 1;
                        // Query updated to include IDs for linking
                        $usage_qry = $conn->query("
                            (SELECT 
                                tl.id as t_id,
                                tl.date_created as t_date,
                                tl.job_id as ref_no,
                                tl.code as transaction_code,
                                'Repair Job' as type,
                                CONCAT(cl.firstname, ' ', COALESCE(cl.lastname,'')) as client_name,
                                tl.client_name as raw_client_id,
                                tp.qty as qty,
                                tp.price as unit_price
                            FROM transaction_products tp 
                            INNER JOIN transaction_list tl ON tp.transaction_id = tl.id 
                            LEFT JOIN client_list cl ON tl.client_name = cl.id
                            WHERE tp.product_id = '{$id}' AND tl.status != 4)
                            
                            UNION ALL
                            
                            (SELECT 
                                ds.id as t_id,
                                ds.date_created as t_date,
                                ds.sale_code as ref_no,
                                '' as transaction_code,
                                'Direct Sale' as type,
                                CONCAT(cl.firstname, ' ', COALESCE(cl.lastname,'')) as client_name,
                                '' as raw_client_id,
                                dsi.qty as qty,
                                dsi.price as unit_price
                            FROM direct_sale_items dsi 
                            INNER JOIN direct_sales ds ON dsi.sale_id = ds.id 
                            LEFT JOIN client_list cl ON ds.client_id = cl.id
                            WHERE dsi.product_id = '{$id}')
                            
                            ORDER BY t_date DESC
                        ");

                        while($row = $usage_qry->fetch_assoc()):
                            $display_client = !empty($row['client_name']) ? $row['client_name'] : $row['raw_client_id'];
                            if(empty($display_client)) $display_client = 'N/A';
                            
                            $rate = $row['unit_price'];
                            $qty = $row['qty'];
                            $total = $rate * $qty;

                            // Dynamic Link Logic
                            if($row['type'] == 'Repair Job'){
                                $view_link = "./?page=transactions/view_details&id=" . $row['t_id'];
                            } else {
                                $view_link = "./?page=direct_sales/view_sale&id=" . $row['t_id'];
                            }
                        ?>
                        <tr>
                            <td class="px-2 py-1 align-middle text-center"><?php echo $j++; ?></td>
                            <td class="px-2 py-1 align-middle"><?php echo date("M d, Y", strtotime($row['t_date'])) ?></td>
                            <td class="px-2 py-1 align-middle text-center">
                                <a href="<?php echo $view_link ?>" class="text-decoration-none">
                                    <?php if($row['type'] == 'Repair Job'): ?>
                                        <span class="badge badge-primary"><?php echo $row['ref_no'] ?></span>
                                        <br>
                                        <small class="text-muted">Code: <?php echo $row['transaction_code'] ?></small>
                                    <?php else: ?>
                                        <span class="badge badge-success"><?php echo $row['ref_no'] ?></span>
                                    <?php endif; ?>
                                </a>
                            </td>
                            <td class="px-2 py-1 align-middle text-center"><?php echo $row['type'] ?></td>
                            <td class="px-2 py-1 align-middle"><?php echo $display_client ?></td>
                            <td class="px-2 py-1 align-middle text-right"><?php echo number_format($rate, 2) ?></td>
                            <td class="px-2 py-1 align-middle text-center font-weight-bold"><?php echo number_format($qty) ?></td>
                            <td class="px-2 py-1 align-middle text-right font-weight-bold"><?php echo number_format($total, 2) ?></td>
                        </tr>
                        <?php endwhile; ?>
                    </tbody>
                </table>
            </div>
         
<script>
    $(document).ready(function(){
		// New DataTable for Usage History
        $('#stock-out-table').DataTable({
            "order": [[1, "desc"]]
        });
        // DataTable Initialize
        $('#stock-history-table').DataTable({
            "order": [[1, "desc"]]
        });

        // Add Stock Modal
        $('#add_stock').click(function(){
            uni_modal("<i class='fa fa-plus'></i> Add Stock to <?= $name ?>", "inventory/manage_stock.php?product_id=<?= $id ?>");
        });

        // Edit Stock (Event Delegation)
        $(document).on('click', '.edit_stock', function(){
            uni_modal("<i class='fa fa-edit'></i> Edit Stock Entry", "inventory/manage_stock.php?product_id=<?= $id ?>&id="+$(this).attr('data-id'));
        });

        // Delete Stock
        $(document).on('click', '.delete_stock', function(){
            _conf("Are you sure to delete this stock entry?", "delete_inventory", [$(this).attr('data-id')]);
        });
    });

    function delete_inventory($id){
        start_loader();
        $.ajax({
            url:_base_url_+"classes/Master.php?f=delete_inventory",
            method:"POST",
            data:{id: $id},
            dataType:"json",
            success:function(resp){
                if(resp.status == 'success') location.reload();
                else alert_toast("Error deleting stock",'error');
                end_loader();
            }
        });
    }
</script>