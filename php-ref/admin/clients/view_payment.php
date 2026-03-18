<?php 
require_once $_SERVER['DOCUMENT_ROOT'] . '/vtech-rsms/config.php'; 

if(!isset($_GET['id']) || !is_numeric($_GET['id'])){
    echo '<script> alert("Invalid or missing Payment ID."); location.replace("./?page=clients"); </script>';
    exit;
}

$payment_id = $_GET['id'];

// Payment details query
$stmt = $conn->prepare("SELECT 
                            cp.*, 
                            cl.firstname, 
                            cl.middlename, 
                            cl.lastname 
                        FROM `client_payments` cp
                        JOIN `client_list` cl ON cp.client_id = cl.id
                        WHERE cp.id = ?");
$stmt->bind_param("i", $payment_id);
$stmt->execute();
$qry = $stmt->get_result(); 

if($qry->num_rows == 0){
    echo '<script> alert("Payment record not found."); location.replace("./?page=clients"); </script>';
    exit;
}

$res = $qry->fetch_assoc();
foreach($res as $k => $v){
    $$k = $v; // Variables set up
}

$client_name_full = trim($firstname.' '.($middlename ? $middlename.' ' : '').$lastname);
$net_amount = $amount - $discount;
?>

<div class="content py-3">
    <div class="card card-outline card-primary rounded-0 shadow">
        <div class="card-header">
            <h4 class="card-title">Payment Details: <b><?= $job_id ?: 'On Account' ?></b></h4>
            <div class="card-tools">
                <a href="./?page=clients/view_client&id=<?= $client_id ?>" class="btn btn-default border btn-sm"><i class="fa fa-angle-left"></i> Back to Client</a>
            </div>
        </div>
        <div class="card-body">
            <div class="container-fluid">
                <div class="row mb-0">
                    <div class="col-3 py-1 px-2 border border-info bg-gradient-info mb-0 text-white"><b>Client Name</b></div>
                    <div class="col-9 py-1 px-2 border mb-0"><?= $client_name_full ?></div>
                    
                    <div class="col-3 py-1 px-2 border border-info bg-gradient-info mb-0 text-white"><b>Job ID</b></div>
                    <div class="col-9 py-1 px-2 border mb-0"><?= $job_id ?: '—' ?></div>
                    
                    <div class="col-3 py-1 px-2 border border-info bg-gradient-info mb-0 text-white"><b>Bill No.</b></div>
                    <div class="col-9 py-1 px-2 border mb-0"><?= $bill_no ?: '—' ?></div>
                    
                    <div class="col-3 py-1 px-2 border border-info bg-gradient-info mb-0 text-white"><b>Payment Date</b></div>
                    <div class="col-9 py-1 px-2 border mb-0"><?= date("d-m-Y", strtotime($payment_date)) ?></div>

                    <div class="col-3 py-1 px-2 border border-info bg-gradient-info mb-0 text-white"><b>Amount Paid</b></div>
                    <div class="col-9 py-1 px-2 border mb-0">₹<?= number_format($amount) ?></div>

                    <div class="col-3 py-1 px-2 border border-info bg-gradient-info mb-0 text-white"><b>Discount Given</b></div>
                    <div class="col-9 py-1 px-2 border mb-0">₹<?= number_format($discount) ?></div>
                    
                    <div class="col-3 py-1 px-2 border border-info bg-gradient-info mb-0 text-white"><b>Net Received</b></div>
                    <div class="col-9 py-1 px-2 border mb-0"><b>₹<?= number_format($net_amount) ?></b></div>
                    
                    <div class="col-3 py-1 px-2 border border-info bg-gradient-info mb-0 text-white"><b>Payment Mode</b></div>
                    <div class="col-9 py-1 px-2 border mb-0"><span class="badge bg-info"><?= $payment_mode ?></span></div>
                    
                    <div class="col-3 py-1 px-2 border border-info bg-gradient-info mb-0 text-white"><b>Payment Type</b></div>
                    <div class="col-9 py-1 px-2 border mb-0"><span class="badge bg-primary"><?= $payment_type ?></span></div>
                    
                    <div class="col-3 py-1 px-2 border border-info bg-gradient-info mb-0 text-white"><b>Remarks</b></div>
                    <div class="col-9 py-1 px-2 border mb-0"><?= $remarks ?: '—' ?></div>
                </div>
            </div>
            <div class="text-center mt-4">
                <a href="./?page=clients/edit_payment&id=<?= $id ?>" class="btn btn-primary btn-lg me-2"><i class="fa fa-edit"></i> Edit Payment</a>
                <a href="./?page=clients/view_client&id=<?= $client_id ?>" class="btn btn-default border btn-lg"><i class="fa fa-angle-left"></i> Back</a>
            </div>
        </div>
    </div>
</div>