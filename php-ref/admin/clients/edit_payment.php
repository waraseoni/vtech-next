<?php require_once $_SERVER['DOCUMENT_ROOT'] . '/vtech-rsms/config.php'; ?>
<?php
$payment_id = $_GET['id'] ?? '';
$client_id = $_GET['client_id'] ?? 0;
$client_name = "New Payment";

if(!empty($payment_id) && is_numeric($payment_id)){
    $stmt = $conn->prepare("SELECT cp.*, CONCAT(cl.firstname, ' ', IFNULL(cl.middlename,''), ' ', cl.lastname) as client_name 
                            FROM `client_payments` cp
                            JOIN `client_list` cl ON cp.client_id = cl.id
                            WHERE cp.id = ?");
    $stmt->bind_param("i", $payment_id);
    $stmt->execute();
    $qry = $stmt->get_result(); 
    if($qry->num_rows > 0){
        $p = $qry->fetch_assoc();
        foreach($p as $k => $v){ $$k = $v; }
    }
    $stmt->close();
}
?>

<div class="container-fluid">
    <form action="clients/save_payment.php" method="POST" id="payment-form">
        <input type="hidden" name="id" value="<?= $payment_id ?>"> 
        <input type="hidden" name="client_id" value="<?= $client_id ?>">

        <div class="row">
            <div class="col-md-6 form-group">
                <label>Job ID / Ref. (Optional)</label>
                <input type="text" name="job_id" class="form-control form-control-sm" value="<?= $job_id ?? '' ?>">
            </div>
            <div class="col-md-6 form-group">
                <label>Bill No. (Optional)</label>
                <input type="text" name="bill_no" class="form-control form-control-sm" value="<?= $bill_no ?? '' ?>">
            </div>
            <div class="col-md-6 form-group">
                <label>Amount Received</label>
                <input type="number" step="any" name="amount" class="form-control form-control-sm" value="<?= $amount ?? '' ?>" required>
            </div>
            <div class="col-md-6 form-group">
                <label>Discount</label>
                <input type="number" step="any" name="discount" class="form-control form-control-sm" value="<?= $discount ?? 0 ?>">
            </div>
            <div class="col-md-6 form-group">
                <label>Payment Date</label>
                <input type="date" name="payment_date" class="form-control form-control-sm" value="<?= isset($payment_date) ? date('Y-m-d', strtotime($payment_date)) : date('Y-m-d') ?>" required>
            </div>
            <div class="col-md-6 form-group">
                <label>Payment Mode</label>
                <select name="payment_mode" class="form-control form-control-sm" required>
                    <?php 
                    $modes = ['Cash', 'PhonePe/GPay', 'UPI', 'NEFT', 'Bank Transfer'];
                    foreach($modes as $m):
                    ?>
                    <option <?= (isset($payment_mode) && $payment_mode == $m) ? 'selected' : '' ?>><?= $m ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="col-md-6 form-group">
                <label>Payment Type</label>
                <select name="payment_type" class="form-control form-control-sm" required>
                    <?php 
                    $types = ['Full', 'Partial', 'Advance', 'On Account'];
                    foreach($types as $t):
                    ?>
                    <option <?= (isset($payment_type) && $payment_type == $t) ? 'selected' : '' ?>><?= $t ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="col-md-12 form-group">
                <label>Remarks</label>
                <textarea name="remarks" class="form-control form-control-sm" rows="2"><?= $remarks ?? '' ?></textarea>
            </div>
        </div>
    </form>
</div>