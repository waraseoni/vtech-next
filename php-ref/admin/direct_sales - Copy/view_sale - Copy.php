<?php
if(isset($_GET['id'])){
    // Query update ki gayi hai mechanic_list join karne ke liye
    $qry = $conn->query("SELECT ds.*, 
                         CONCAT(c.firstname,' ',c.middlename,' ',c.lastname) as client_name,
                         CONCAT(m.firstname,' ',m.lastname) as mechanic_name 
                         FROM direct_sales ds 
                         LEFT JOIN client_list c ON ds.client_id = c.id 
                         LEFT JOIN mechanic_list m ON ds.mechanic_id = m.id 
                         WHERE ds.id = {$_GET['id']}");
    if($qry->num_rows > 0){
        foreach($qry->fetch_assoc() as $k => $v){
            $$k = $v;
        }
    }
}
?>
<div class="content py-3">
    <div class="card card-outline card-primary rounded-0 shadow">
        <div class="card-header">
            <h5 class="card-title">Direct Sale - <?= $sale_code ?></h5>
            <div class="card-tools">
                <a href="../pdf/gst_bill.php?type=direct_sale&id=<?= $id ?>" target="_blank" class="btn btn-success btn-sm">GST Bill Print</a>
                <button class="btn btn-info btn-sm" onclick="window.print()">Print Bill</button>
                <a href="./?page=direct_sales" class="btn btn-default btn-sm">Back</a>
            </div>
        </div>
        <div class="card-body">
            <div class="container-fluid" id="print_out">
                <div class="text-center mb-4">
                    <h3 class="mb-0">V-Technologies</h3>
                    <p class="mb-0">F4, Hotel Plaza, Marhatal, Jabalpur | 9179105875</p>
                    <hr>
                </div>
                
                <div class="row mb-3">
                    <div class="col-6">
                        <p class="mb-1"><b>Sale Code:</b> <?= $sale_code ?></p>
                        <p class="mb-1"><b>Date:</b> <?= date("d-m-Y h:i A", strtotime($date_created)) ?></p>
                    </div>
                    <div class="col-6 text-right">
                        <p class="mb-1"><b>Client:</b> <?= $client_name ?: 'Walk-in Customer' ?></p>
                        <p class="mb-1"><b>Payment:</b> <?= $payment_mode ?></p>
                        <p class="mb-1"><b>Billed By:</b> <?= $mechanic_name ?: 'Admin' ?></p>
                    </div>
                </div>

                <table class="table table-bordered table-striped">
                    <thead>
                        <tr class="bg-light">
                            <th>Product</th>
                            <th class="text-center">Qty</th>
                            <th class="text-right">Price</th>
                            <th class="text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php 
                        $items = $conn->query("SELECT dsi.*, p.name FROM direct_sale_items dsi INNER JOIN product_list p ON dsi.product_id = p.id WHERE sale_id = $id");
                        while($row = $items->fetch_assoc()):
                        ?>
                        <tr>
                            <td><?= $row['name'] ?></td>
                            <td class="text-center"><?= $row['qty'] ?></td>
                            <td class="text-right">₹<?= number_format($row['price'],2) ?></td>
                            <td class="text-right">₹<?= number_format($row['qty'] * $row['price'],2) ?></td>
                        </tr>
                        <?php endwhile; ?>
                    </tbody>
                    <tfoot>
                        <tr>
                            <th colspan="3" class="text-right">Total Amount</th>
                            <th class="text-right">₹<?= number_format($total_amount,2) ?></th>
                        </tr>
                    </tfoot>
                </table>
                <?php if(!empty($remarks)): ?>
                <div class="alert alert-light border mt-3">
                    <b>Remarks:</b> <?= $remarks ?>
                </div>
                <?php endif; ?>
                <p class="text-center mt-5">Thank You! Visit Again</p>
            </div>
        </div>
    </div>
</div>

<style>
@media print {
    .btn, .card-header, .main-footer { display: none !important; }
    .content-wrapper { background: none !important; margin: 0 !important; padding: 0 !important; }
    #print_out { width: 100%; border: none; }
}
</style>