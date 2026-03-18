<?php require_once $_SERVER['DOCUMENT_ROOT'] . '/vtech-rsms/config.php'; ?>
<?php
// Check karein ki ID set hai ya nahi
if(!isset($_GET['id']) || !is_numeric($_GET['id'])){
    echo '<script> alert("Payment ID is required for editing."); location.replace("./?page=clients"); </script>';
    exit;
}

$payment_id = $_GET['id'];
$client_id = 0; // Initialize

// Payment details fetch karein
$stmt = $conn->prepare("SELECT cp.*, CONCAT(cl.firstname, ' ', IFNULL(cl.middlename,''), ' ', cl.lastname) as client_name 
                        FROM `client_payments` cp
                        JOIN `client_list` cl ON cp.client_id = cl.id
                        WHERE cp.id = ?");
$stmt->bind_param("i", $payment_id);
$stmt->execute();
$qry = $stmt->get_result(); 

if($qry->num_rows > 0){
    $p = $qry->fetch_assoc();
    // Variables define karein
    foreach($p as $k => $v){
        $$k = $v;
    }
    $client_id = $p['client_id']; // Client ID ko store karein
}else{
    echo '<script> alert("Unknown Payment ID."); location.replace("./?page=clients"); </script>';
    exit;
}
$stmt->close();

// Default values set karein agar database se kuch missing ho
$job_id = $job_id ?? ''; 
$bill_no = $bill_no ?? ''; 
$remarks = $remarks ?? '';
?>

<div class="content py-3">
    <div class="card card-outline card-primary rounded-0 shadow">
        <div class="card-header">
            <h4 class="card-title">Edit Payment for: <b><?= $client_name ?></b></h4>
            <div class="card-tools">
                <a href="./?page=clients/view_client&id=<?= $client_id ?>" class="btn btn-default border btn-sm"><i class="fa fa-angle-left"></i> Back to Client</a>
            </div>
        </div>
        <div class="card-body">
            <div class="container-fluid">
                <form action="clients/save_payment.php" method="POST">
                    <input type="hidden" name="id" value="<?= $payment_id ?>"> 
                    <input type="hidden" name="client_id" value="<?= $client_id ?>">

                    <div class="row g-3">
                        <div class="col-md-6">
                            <label>Job ID (optional)</label>
                            <input type="text" name="job_id" class="form-control" value="<?= $job_id ?>">
                        </div>
                        <div class="col-md-6">
                            <label>Bill No. (optional)</label>
                            <input type="text" name="bill_no" class="form-control" value="<?= $bill_no ?>">
                        </div>
                        <div class="col-md-6">
                            <label>Amount Received</label>
                            <input type="number" step="0.01" name="amount" class="form-control" value="<?= $amount ?>" required>
                        </div>
                        <div class="col-md-6">
                            <label>Discount</label>
                            <input type="number" step="0.01" name="discount" class="form-control" value="<?= $discount ?>">
                        </div>
                        <div class="col-md-6">
                            <label>Payment Mode</label>
                            <select name="payment_mode" class="form-control" required>
                                <?php 
                                $modes = ['Cash', 'UPI', 'NEFT', 'Cheque', 'Bank Transfer'];
                                foreach($modes as $mode_opt):
                                ?>
                                <option <?= $mode_opt == $payment_mode ? 'selected' : '' ?>><?= $mode_opt ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label>Payment Type</label>
                            <select name="payment_type" class="form-control" required>
                                <?php 
                                $types = ['Full', 'Partial', 'Advance', 'On Account'];
                                foreach($types as $type_opt):
                                ?>
                                <option <?= $type_opt == $payment_type ? 'selected' : '' ?>><?= $type_opt ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="col-md-12">
                            <label>Remarks</label>
                            <input type="text" name="remarks" class="form-control" value="<?= $remarks ?>">
                        </div>
                    </div>
                    
                    <div class="text-center mt-4">
                        <button type="submit" class="btn btn-primary btn-lg">Update Payment</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>